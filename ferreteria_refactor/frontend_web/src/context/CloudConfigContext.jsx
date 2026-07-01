import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/constants';

const CloudConfigContext = createContext();

const isDesktopOffline = import.meta.env.VITE_DESKTOP_OFFLINE === 'true' || import.meta.env.VITE_OFFLINE_SETUP === 'true';

const cleanCloudUrl = (value = '') => {
    let cleanUrl = value.trim();
    if (!cleanUrl) return '';

    cleanUrl = cleanUrl.split('#')[0].trim();
    cleanUrl = cleanUrl.replace(/\/+$/, '');

    const pathsToRemove = ['/login', '/api/v1', '/api'];
    for (const path of pathsToRemove) {
        if (cleanUrl.endsWith(path)) {
            cleanUrl = cleanUrl.slice(0, -path.length).replace(/\/+$/, '');
        }
    }

    return cleanUrl;
};

const defaultConfig = {
    cloudUrl: isDesktopOffline ? '' : API_BASE_URL,
    tenantSubdomain: '',
    installMode: 'store_server',
    localServerName: 'Servidor local',
    isConfigured: !isDesktopOffline,
    syncEnabled: true,
    syncIntervalMinutes: 10,
    safeStockMode: true,
};

export const useCloudConfig = () => {
    const context = useContext(CloudConfigContext);
    if (!context) {
        throw new Error('useCloudConfig must be used within CloudConfigProvider');
    }
    return context;
};

export const CloudConfigProvider = ({ children }) => {
    const [config, setConfig] = useState(defaultConfig);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const savedConfig = localStorage.getItem('cloud_config');
            if (savedConfig) {
                const parsed = JSON.parse(savedConfig);
                setConfig({
                    ...defaultConfig,
                    ...parsed,
                    cloudUrl: isDesktopOffline ? (parsed.cloudUrl || '') : API_BASE_URL,
                    isConfigured: isDesktopOffline ? Boolean(parsed.cloudUrl) : true,
                });
            } else {
                setConfig(defaultConfig);
            }
        } catch (error) {
            console.error('Error loading config:', error);
            setConfig(prev => ({ ...prev, isConfigured: !isDesktopOffline }));
        } finally {
            setIsLoading(false);
        }
    };

    const saveConfig = async (newConfig) => {
        try {
            const cleanUrl = cleanCloudUrl(newConfig.cloudUrl || '');

            const configToSave = {
                cloudUrl: cleanUrl,
                tenantSubdomain: (newConfig.tenantSubdomain || '').trim().toLowerCase(),
                installMode: newConfig.installMode || 'store_server',
                localServerName: newConfig.localServerName || 'Servidor local',
                syncEnabled: newConfig.syncEnabled ?? true,
                syncIntervalMinutes: Number(newConfig.syncIntervalMinutes || 10),
                safeStockMode: newConfig.safeStockMode ?? true,
                isConfigured: Boolean(cleanUrl),
            };

            localStorage.setItem('cloud_config', JSON.stringify(configToSave));
            localStorage.setItem('offline_setup_completed', 'true');

            try {
                if (cleanUrl) {
                    await axios.post('/api/v1/cloud/setup', {
                        cloud_url: cleanUrl,
                        tenant_subdomain: configToSave.tenantSubdomain,
                        install_mode: configToSave.installMode,
                        local_server_name: configToSave.localServerName,
                        sync_enabled: configToSave.syncEnabled,
                        sync_interval_minutes: configToSave.syncIntervalMinutes,
                        safe_stock_mode: configToSave.safeStockMode,
                    });
                }
            } catch (setupError) {
                console.warn('[Cloud Config] No se pudo guardar en backend local:', setupError);
            }

            try {
                if (cleanUrl) {
                    const token = localStorage.getItem('token');
                    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

                    await axios.put('/api/v1/config/cloud_url', {
                        key: 'cloud_url',
                        value: cleanUrl
                    }, { headers, _silent403: true });
                }
            } catch (backendError) {
                if (backendError.response && backendError.response.status === 403) {
                    // Normal para cajeros: la configuracion ya fue guardada en /cloud/setup.
                } else if (backendError.response && backendError.response.status === 401) {
                    // Normal durante el asistente inicial antes de iniciar sesion.
                } else {
                    console.warn('[Cloud Config] Config secundaria no guardada:', backendError);
                }
            }

            setConfig(configToSave);
            return { success: true, config: configToSave };
        } catch (error) {
            console.error('Error saving config:', error);
            return { success: false, error: error.message };
        }
    };

    const resetConfig = async () => {
        try {
            localStorage.removeItem('cloud_config');
            localStorage.removeItem('offline_setup_completed');
            setConfig(defaultConfig);
            return { success: true };
        } catch (error) {
            console.error('Error resetting config:', error);
            return { success: false, error: error.message };
        }
    };

    const testConnection = async (url, tenantSubdomain = '') => {
        try {
            const response = await axios.post('/api/v1/cloud/test-connection', {
                url,
                tenant_subdomain: tenantSubdomain,
            });

            const data = response.data;
            if (data.success) {
                return {
                    success: true,
                    cleanedUrl: data.cleaned_url,
                    apiUrl: data.api_url,
                    tenantName: data.tenant_name,
                    tenantSubdomain: data.tenant_subdomain,
                    healthOk: data.health_ok,
                    tenantOk: data.tenant_ok,
                };
            }

            return {
                success: false,
                error: data.error || 'Servidor no responde correctamente',
                cleanedUrl: data.cleaned_url,
                apiUrl: data.api_url,
            };
        } catch (error) {
            console.error('[Cloud Config] Connection test failed:', error);
            return {
                success: false,
                error: error.response?.data?.error || error.response?.data?.detail || 'No se puede conectar al servidor. Verifica la URL.',
            };
        }
    };

    const value = {
        config,
        isLoading,
        isDesktopOffline,
        saveConfig,
        resetConfig,
        testConnection,
        reloadConfig: loadConfig,
    };

    return (
        <CloudConfigContext.Provider value={value}>
            {children}
        </CloudConfigContext.Provider>
    );
};
