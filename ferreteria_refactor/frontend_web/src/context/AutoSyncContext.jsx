import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useCloudConfig } from './CloudConfigContext';

const AutoSyncContext = createContext();

export const useAutoSync = () => {
    const context = useContext(AutoSyncContext);
    if (!context) {
        throw new Error('useAutoSync must be used within AutoSyncProvider');
    }
    return context;
};

export const AutoSyncProvider = ({ children }) => {
    const { config: cloudConfig } = useCloudConfig();

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
            const response = await axios.post('/api/v1/cloud/test-connection', {
                url: cloudConfig.cloudUrl
            });

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

    // SELF-HEALING: Asegurar que el backend tenga la configuración cuando iniciamos sesión
    useEffect(() => {
        const syncToBackend = async () => {
            if (cloudConfig.isConfigured && cloudConfig.cloudUrl) {
                const token = localStorage.getItem('token');
                if (token) {
                    try {
                        // Enviamos la configuración al backend silenciosamente
                        await axios.put('/api/v1/config/cloud_url', {
                            key: 'cloud_url',
                            value: cloudConfig.cloudUrl
                        }, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        console.log('[AutoSync] ✅ Configuración sincronizada con Backend (Self-Healing)');
                    } catch (e) {
                        // Ignoramos errores aquí para no molestar, reintentará luego
                        console.warn('[AutoSync] Falló self-healing de config:', e.message);
                    }
                }
            }
        };

        syncToBackend();
        // Ejecutar cada vez que cambie la config o cada 30 seg por si el token aparece recién
        const interval = setInterval(syncToBackend, 30000);
        return () => clearInterval(interval);

    }, [cloudConfig.isConfigured, cloudConfig.cloudUrl]);

    // Función de sincronización
    const performSync = useCallback(async (manual = false) => {
        if (syncStatus.isSyncing) {
            console.log('⏳ Sincronización ya en progreso...');
            return;
        }

        if (!cloudConfig.isConfigured) {
            if (manual) {
                showNotification('⚠️ No configurado', 'Configura la URL del servidor primero', 'warning');
            }
            return { success: false, reason: 'not_configured' };
        }

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
            const response = await axios.post('/api/v1/sync-local/trigger');

            // 3. Actualizar estado
            setSyncStatus(prev => ({
                ...prev,
                lastSync: new Date(),
                isSyncing: false,
                pendingSales: 0,
                error: null
            }));

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
    }, [syncStatus.isSyncing, checkOnlineStatus, cloudConfig.isConfigured]);

    // Sincronización manual (desde botón)
    const syncNow = useCallback(() => {
        return performSync(true);
    }, [performSync]);

    // Configurar sincronización automática
    useEffect(() => {
        if (!cloudConfig.syncEnabled || !cloudConfig.isConfigured) return;

        // Sincronización inicial después de 30 segundos
        const initialSync = setTimeout(() => {
            console.log('🔄 Sincronización inicial automática...');
            performSync(false);
        }, 30000);

        // Sincronización periódica
        const interval = setInterval(() => {
            console.log(`🔄 Sincronización automática (cada ${cloudConfig.syncIntervalMinutes} min)...`);
            performSync(false);
        }, cloudConfig.syncIntervalMinutes * 60 * 1000);

        return () => {
            clearTimeout(initialSync);
            clearInterval(interval);
        };
    }, [cloudConfig.syncEnabled, cloudConfig.syncIntervalMinutes, cloudConfig.isConfigured, performSync]);

    // Verificar estado online cada 2 minutos
    useEffect(() => {
        if (!cloudConfig.isConfigured) return;

        const interval = setInterval(checkOnlineStatus, 120000);
        checkOnlineStatus(); // Check inicial
        return () => clearInterval(interval);
    }, [checkOnlineStatus, cloudConfig.isConfigured]);

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
