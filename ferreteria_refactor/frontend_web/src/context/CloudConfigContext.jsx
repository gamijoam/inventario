import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const CloudConfigContext = createContext();

export const useCloudConfig = () => {
    const context = useContext(CloudConfigContext);
    if (!context) {
        throw new Error('useCloudConfig must be used within CloudConfigProvider');
    }
    return context;
};

export const CloudConfigProvider = ({ children }) => {
    const [config, setConfig] = useState({
        cloudUrl: '',
        isConfigured: false,
        syncEnabled: true,
        syncIntervalMinutes: 10
    });

    const [isLoading, setIsLoading] = useState(true);

    // Cargar configuración al iniciar
    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            // Intentar cargar desde localStorage primero (para desarrollo web)
            const savedConfig = localStorage.getItem('cloud_config');

            if (savedConfig) {
                const parsed = JSON.parse(savedConfig);
                setConfig({
                    ...parsed,
                    isConfigured: !!parsed.cloudUrl
                });
            } else {
                // Si no hay configuración, marcar como no configurado
                setConfig(prev => ({ ...prev, isConfigured: false }));
            }
        } catch (error) {
            console.error('Error loading config:', error);
            setConfig(prev => ({ ...prev, isConfigured: false }));
        } finally {
            setIsLoading(false);
        }
    };

    const saveConfig = async (newConfig) => {
        try {
            // Clean URL before saving
            let cleanUrl = newConfig.cloudUrl ? newConfig.cloudUrl.trim() : '';
            if (cleanUrl) {
                // Remove trailing slash
                if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);

                // Remove trailing paths
                const pathsToRemove = ['/login', '/api', '/api/v1'];
                for (const path of pathsToRemove) {
                    if (cleanUrl.endsWith(path)) cleanUrl = cleanUrl.slice(0, -path.length);
                }
            }

            const configToSave = {
                cloudUrl: cleanUrl, // Use cleaned URL
                syncEnabled: newConfig.syncEnabled ?? true,
                syncIntervalMinutes: newConfig.syncIntervalMinutes ?? 10
            };

            // Guardar en localStorage
            localStorage.setItem('cloud_config', JSON.stringify(configToSave));

            // SAFEGUARD: Guardar también en el BACKEND para que la sincronización manual funcione
            try {
                if (cleanUrl) { // Use cleaned URL
                    console.log('[Cloud Config] Syncing URL to backend database:', cleanUrl);

                    // Obtener token explícitamente por si el interceptor no está listo
                    const token = localStorage.getItem('token');
                    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

                    await axios.put('/api/v1/config/cloud_url', {
                        key: 'cloud_url',
                        value: cleanUrl
                    }, { headers });

                    console.log('[Cloud Config] URL synced to backend successfully');
                }
            } catch (backendError) {
                // FALLBACK: Si falla por 401 (no logueado en wizard), usar endpoint de setup público
                if (backendError.response && backendError.response.status === 401) {
                    console.log('[Cloud Config] Auth failed, trying setup endpoint...');
                    try {
                        await axios.post('/api/v1/cloud/setup', {
                            cloud_url: cleanUrl
                        });
                        console.log('[Cloud Config] URL saved via Setup Endpoint');
                    } catch (setupError) {
                        console.error('[Cloud Config] Warning: Could not sync via setup endpoint:', setupError);
                    }
                } else {
                    console.error('[Cloud Config] Warning: Could not sync to backend:', backendError);
                }
            }

            setConfig({
                ...configToSave,
                isConfigured: true
            });

            return { success: true };
        } catch (error) {
            console.error('Error saving config:', error);
            return { success: false, error: error.message };
        }
    };

    const resetConfig = async () => {
        try {
            localStorage.removeItem('cloud_config');
            setConfig({
                cloudUrl: '',
                isConfigured: false,
                syncEnabled: true,
                syncIntervalMinutes: 10
            });
            return { success: true };
        } catch (error) {
            console.error('Error resetting config:', error);
            return { success: false, error: error.message };
        }
    };

    const testConnection = async (url) => {
        try {
            // Use backend endpoint to test connection (bypasses CORS)
            console.log(`[Cloud Config] Testing connection via backend: ${url}`);

            const response = await axios.post('/api/v1/cloud/test-connection', {
                url: url
            });

            const data = response.data;

            console.log(`[Cloud Config] Backend test result:`, data);

            if (data.success) {
                return {
                    success: true,
                    cleanedUrl: data.cleaned_url
                };
            } else {
                return {
                    success: false,
                    error: data.error || 'Servidor no responde correctamente'
                };
            }
        } catch (error) {
            console.error('[Cloud Config] Connection test failed:', error);
            return {
                success: false,
                error: error.response?.data?.error || 'No se puede conectar al servidor. Verifica la URL.'
            };
        }
    };

    const value = {
        config,
        isLoading,
        saveConfig,
        resetConfig,
        testConnection
    };

    return (
        <CloudConfigContext.Provider value={value}>
            {children}
        </CloudConfigContext.Provider>
    );
};
