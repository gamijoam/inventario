import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../config/axios';
import { useCloudConfig } from './CloudConfigContext';
import { useAuth } from './AuthContext';

const AutoSyncContext = createContext();

export const useAutoSync = () => {
    const context = useContext(AutoSyncContext);
    if (!context) {
        throw new Error('useAutoSync must be used within AutoSyncProvider');
    }
    return context;
};

const buildSyncStateFromStatus = (data) => ({
    pendingSales: Number(data?.pending_sales || 0),
    pendingSummary: data?.pending_summary || null,
    totalPending: Number(data?.pending_summary?.total_pending || data?.pending_sales || 0),
    metadataReady: data?.pending_summary?.metadata_ready !== false,
});

export const AutoSyncProvider = ({ children }) => {
    // Feature flag: Skip all sync logic if disabled
    const isSyncEnabled = import.meta.env.VITE_ENABLE_SYNC === 'true';

    const { config: cloudConfig } = useCloudConfig();
    const { user } = useAuth();

    const [syncStatus, setSyncStatus] = useState({
        lastSync: null,
        isOnline: true,
        isSyncing: false,
        pendingSales: 0,
        pendingSummary: null,
        totalPending: 0,
        metadataReady: true,
        error: null
    });

    const refreshSyncStatus = useCallback(async () => {
        if (!user) return { success: false, reason: 'not_authenticated' };

        try {
            const response = await apiClient.get('/sync-local/status', {
                _silent403: true,
                _silentNetworkError: true,
            });
            const statusPatch = buildSyncStateFromStatus(response.data);
            setSyncStatus(prev => ({
                ...prev,
                ...statusPatch,
                error: response.data?.configured ? prev.error : 'Modo local no configurado',
            }));
            return { success: true, data: response.data };
        } catch (error) {
            if (![401, 403].includes(error.response?.status)) {
                console.warn('[AutoSync] No se pudo leer estado local:', error.message);
            }
            return { success: false, reason: 'error', error };
        }
    }, [user]);

    // Detectar conexion a internet
    const checkOnlineStatus = useCallback(async () => {
        // SAFEGUARD: No intentar conectar si no hay URL configurada o es localhost
        if (!cloudConfig.cloudUrl ||
            !cloudConfig.isConfigured ||
            cloudConfig.cloudUrl.includes('localhost') ||
            cloudConfig.cloudUrl.includes('127.0.0.1') ||
            cloudConfig.cloudUrl.trim() === '') {
            setSyncStatus(prev => ({
                ...prev,
                isOnline: false,
                error: 'Modo local'
            }));
            return false;
        }

        try {
            // USAR BACKEND PARA VERIFICAR CONEXION (evita CORS)
            const response = await apiClient.post('/cloud/test-connection', {
                url: cloudConfig.cloudUrl,
                tenant_subdomain: cloudConfig.tenantSubdomain || '',
            }, { _silentNetworkError: true });

            if (response.data.success) {
                setSyncStatus(prev => ({ ...prev, isOnline: true, error: null }));
                return true;
            }

            setSyncStatus(prev => ({ ...prev, isOnline: false, error: 'Servidor no responde' }));
            return false;
        } catch (error) {
            console.warn('[AutoSync] Conexion fallida:', error);
            setSyncStatus(prev => ({
                ...prev,
                isOnline: false,
                error: 'Sin conexion a nube'
            }));
            return false;
        }
    }, [cloudConfig.cloudUrl, cloudConfig.isConfigured, cloudConfig.tenantSubdomain]);

    // Sync cloud_url to backend once when config changes (uses cookies, not localStorage token)
    // Solo admin tiene permiso para PUT /config/cloud_url; cajeros quedan fuera para evitar 403.
    useEffect(() => {
        if (!cloudConfig.isConfigured || !cloudConfig.cloudUrl) return;
        if (user?.role && user.role !== 'ADMIN') return;

        apiClient.put('/config/cloud_url', {
            key: 'cloud_url',
            value: cloudConfig.cloudUrl
        }, {
            _silent403: true,
            _silentNetworkError: true
        }).catch(e => {
            console.warn('[AutoSync] Fallo sync de cloud_url:', e.message);
        });
    }, [cloudConfig.isConfigured, cloudConfig.cloudUrl, user?.role]);

    // Funcion de sincronizacion
    const isSyncingRef = React.useRef(false);

    const performSync = useCallback(async (manual = false) => {
        // Feature flag: Skip if sync is disabled
        if (!isSyncEnabled) {
            console.log('[SYNC] Sync is disabled via VITE_ENABLE_SYNC flag');
            return { success: false, reason: 'disabled' };
        }

        if (isSyncingRef.current) {
            console.log('[SYNC] Sincronizacion ya en progreso...');
            return { success: false, reason: 'already_syncing' };
        }

        if (!cloudConfig.isConfigured) {
            if (manual) {
                showNotification('No configurado', 'Configura la URL del servidor primero', 'warning');
            }
            return { success: false, reason: 'not_configured' };
        }

        isSyncingRef.current = true;
        setSyncStatus(prev => ({ ...prev, isSyncing: true, error: null }));

        try {
            // 1. Verificar conexion
            const isOnline = await checkOnlineStatus();

            if (!isOnline) {
                if (manual) {
                    showNotification('Sin conexion', 'No se puede sincronizar sin internet', 'warning');
                }
                setSyncStatus(prev => ({ ...prev, isSyncing: false }));
                isSyncingRef.current = false;
                return { success: false, reason: 'offline' };
            }

            // 2. Ejecutar sincronizacion
            console.log('[SYNC] Iniciando sincronizacion...');
            const response = await apiClient.post('/sync-local/trigger');
            const statusPatch = buildSyncStateFromStatus(response.data);

            // 3. Actualizar estado
            setSyncStatus(prev => ({
                ...prev,
                ...statusPatch,
                lastSync: new Date(),
                isSyncing: false,
                error: null
            }));
            isSyncingRef.current = false;

            // 4. Notificar exito
            if (manual) {
                showNotification('Sincronizacion exitosa', 'Datos actualizados correctamente', 'success');
            } else {
                console.log('[SYNC] Sincronizacion automatica completada');
            }

            return { success: true, data: response.data };

        } catch (error) {
            console.error('[SYNC] Error en sincronizacion:', error);

            const errorMsg = error.response?.data?.detail || error.message || 'Error desconocido';

            isSyncingRef.current = false;
            setSyncStatus(prev => ({
                ...prev,
                isSyncing: false,
                error: errorMsg
            }));

            if (manual) {
                showNotification('Error de sincronizacion', errorMsg, 'error');
            }

            return { success: false, reason: 'error', error: errorMsg };
        }
    }, [checkOnlineStatus, cloudConfig.isConfigured, isSyncEnabled]);

    // Sincronizacion manual (desde boton)
    const syncNow = useCallback(() => {
        return performSync(true);
    }, [performSync]);

    // Configurar sincronizacion automatica
    useEffect(() => {
        // Feature flag: Skip auto-sync if disabled
        if (!isSyncEnabled) {
            console.log('[SYNC] Auto-sync is disabled via VITE_ENABLE_SYNC flag');
            return;
        }

        if (!cloudConfig.syncEnabled || !cloudConfig.isConfigured) return;

        // Sincronizacion inicial despues de 2 minutos
        const initialSync = setTimeout(() => {
            console.log('[SYNC] Sincronizacion inicial automatica...');
            performSync(false);
        }, 120000);

        // Sincronizacion periodica
        const interval = setInterval(() => {
            console.log(`[SYNC] Sincronizacion automatica cada ${cloudConfig.syncIntervalMinutes} min...`);
            performSync(false);
        }, cloudConfig.syncIntervalMinutes * 60 * 1000);

        return () => {
            clearTimeout(initialSync);
            clearInterval(interval);
        };
    }, [cloudConfig.syncEnabled, cloudConfig.syncIntervalMinutes, cloudConfig.isConfigured, isSyncEnabled]);

    // Refrescar estado local para el asistente tecnico/indicadores.
    useEffect(() => {
        if (!user) return;
        refreshSyncStatus();
        const interval = setInterval(refreshSyncStatus, 60000);
        return () => clearInterval(interval);
    }, [refreshSyncStatus, user]);

    // Verificar estado online cada 5 minutos
    useEffect(() => {
        if (!cloudConfig.isConfigured) return;

        const interval = setInterval(checkOnlineStatus, 300000);
        checkOnlineStatus();
        return () => clearInterval(interval);
    }, [cloudConfig.isConfigured, checkOnlineStatus]);

    const value = {
        syncStatus,
        syncNow,
        refreshSyncStatus,
        checkOnlineStatus
    };

    return (
        <AutoSyncContext.Provider value={value}>
            {children}
        </AutoSyncContext.Provider>
    );
};

function showNotification(title, message, type) {
    console.log(`[${type.toUpperCase()}] ${title}: ${message}`);

    if (type === 'error') {
        console.error(`[AutoSync] ${title}: ${message}`);
    } else if (type === 'warning') {
        console.warn(`[AutoSync] ${title}: ${message}`);
    }
}
