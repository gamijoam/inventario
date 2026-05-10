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
        error: null
    });

    // Detectar conexión a internet
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
            // USAR BACKEND PARA VERIFICAR CONEXIÓN (Evita CORS)
            const response = await apiClient.post('/cloud/test-connection', {
                url: cloudConfig.cloudUrl
            }, { _silentNetworkError: true });

            if (response.data.success) {
                setSyncStatus(prev => ({ ...prev, isOnline: true, error: null }));
                return true;
            } else {
                setSyncStatus(prev => ({ ...prev, isOnline: false, error: 'Servidor no responde' }));
                return false;
            }
        } catch (error) {
            console.warn('[AutoSync] Conexión fallida:', error);
            setSyncStatus(prev => ({
                ...prev,
                isOnline: false,
                error: 'Sin conexión a nube'
            }));
            return false;
        }
    }, [cloudConfig.cloudUrl, cloudConfig.isConfigured]);

    // Sync cloud_url to backend once when config changes (uses cookies, not localStorage token)
    // ⚠️ ONLY admin users have permission to PUT /config/cloud_url — skip for CASHIER/WAREHOUSE
    useEffect(() => {
        if (!cloudConfig.isConfigured || !cloudConfig.cloudUrl) return;
        // If user role is known and is NOT admin, skip entirely to avoid 403
        if (user?.role && user.role !== 'ADMIN') return;

        apiClient.put('/config/cloud_url', {
            key: 'cloud_url',
            value: cloudConfig.cloudUrl
        }, {
            _silent403: true  // Tell the axios interceptor NOT to show a toast for 403
        }).catch(e => {
            console.warn('[AutoSync] Falló sync de cloud_url:', e.message);
        });
    }, [cloudConfig.isConfigured, cloudConfig.cloudUrl, user?.role]);

    // Función de sincronización
    const isSyncingRef = React.useRef(false);

    const performSync = useCallback(async (manual = false) => {
        // Feature flag: Skip if sync is disabled
        if (!isSyncEnabled) {
            console.log('[SYNC] Sync is disabled via VITE_ENABLE_SYNC flag');
            return { success: false, reason: 'disabled' };
        }

        if (isSyncingRef.current) {
            console.log('⏳ Sincronización ya en progreso...');
            return;
        }

        if (!cloudConfig.isConfigured) {
            if (manual) {
                showNotification('⚠️ No configurado', 'Configura la URL del servidor primero', 'warning');
            }
            return { success: false, reason: 'not_configured' };
        }

        isSyncingRef.current = true;
        setSyncStatus(prev => ({ ...prev, isSyncing: true, error: null }));

        try {
            // 1. Verificar conexión
            const isOnline = await checkOnlineStatus();

            if (!isOnline) {
                if (manual) {
                    // Solo notificar si fue manual
                    showNotification('⚠️ Sin conexión', 'No se puede sincronizar sin internet', 'warning');
                }
                setSyncStatus(prev => ({ ...prev, isSyncing: false }));
                return { success: false, reason: 'offline' };
            }

            // 2. Ejecutar sincronización
            console.log('🔄 Iniciando sincronización...');
            const response = await apiClient.post('/sync-local/trigger');

            // 3. Actualizar estado
            setSyncStatus(prev => ({
                ...prev,
                lastSync: new Date(),
                isSyncing: false,
                pendingSales: 0,
                error: null
            }));
            isSyncingRef.current = false;

            // 4. Notificar éxito
            if (manual) {
                showNotification('✅ Sincronización exitosa', 'Datos actualizados correctamente', 'success');
            } else {
                console.log('✅ Sincronización automática completada');
            }

            return { success: true };

        } catch (error) {
            console.error('❌ Error en sincronización:', error);

            const errorMsg = error.response?.data?.detail || error.message || 'Error desconocido';

            isSyncingRef.current = false;
            setSyncStatus(prev => ({
                ...prev,
                isSyncing: false,
                error: errorMsg
            }));

            if (manual) {
                showNotification('❌ Error de sincronización', errorMsg, 'error');
            }

            return { success: false, reason: 'error', error: errorMsg };
        }
    }, [checkOnlineStatus, cloudConfig.isConfigured]); // syncStatus.isSyncing reemplazado por ref

    // Sincronización manual (desde botón)
    const syncNow = useCallback(() => {
        return performSync(true);
    }, [performSync]);

    // Configurar sincronización automática
    useEffect(() => {
        // Feature flag: Skip auto-sync if disabled
        if (!isSyncEnabled) {
            console.log('[SYNC] Auto-sync is disabled via VITE_ENABLE_SYNC flag');
            return;
        }

        if (!cloudConfig.syncEnabled || !cloudConfig.isConfigured) return;

        // Sincronización inicial después de 30 segundos
        const initialSync = setTimeout(() => {
            console.log('🔄 Sincronización inicial automática...');
            performSync(false);
        }, 120000); // cada 2 min

        // Sincronización periódica
        const interval = setInterval(() => {
            console.log(`🔄 Sincronización automática (cada ${cloudConfig.syncIntervalMinutes} min)...`);
            performSync(false);
        }, cloudConfig.syncIntervalMinutes * 60 * 1000);

        return () => {
            clearTimeout(initialSync);
            clearInterval(interval);
        };
    }, [cloudConfig.syncEnabled, cloudConfig.syncIntervalMinutes, cloudConfig.isConfigured]); // performSync excluido intencionalmente - usa ref para evitar re-renders

    // Verificar estado online cada 2 minutos
    useEffect(() => {
        if (!cloudConfig.isConfigured) return;

        const interval = setInterval(checkOnlineStatus, 300000); // cada 5 min
        checkOnlineStatus(); // Check inicial
        return () => clearInterval(interval);
    }, [cloudConfig.isConfigured]); // checkOnlineStatus excluido para evitar re-renders

    const value = {
        syncStatus,
        syncNow,
        checkOnlineStatus
    };

    return (
        <AutoSyncContext.Provider value={value}>
            {children}
        </AutoSyncContext.Provider>
    );
};

// Helper para notificaciones (puedes usar react-toastify o similar)
function showNotification(title, message, type) {
    // Implementar con tu librería de notificaciones preferida
    // Por ahora, solo console
    console.log(`[${type.toUpperCase()}] ${title}: ${message}`);

    // Ejemplo con alert (reemplazar con toast)
    if (type === 'error' || type === 'warning') {
        // En producción, usar console en lugar de alert para no bloquear la UI
        if (type === 'error') console.error(`[AutoSync] ${title}: ${message}`);
        else console.warn(`[AutoSync] ${title}: ${message}`);

        // TODO: Integrar con react-hot-toast si está disponible:
        // import toast from 'react-hot-toast'; toast.error(message);
    }
}
