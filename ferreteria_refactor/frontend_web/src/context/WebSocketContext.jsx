import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import apiClient from '../config/axios';

const WebSocketContext = createContext(null);

const normalizeTenantId = (value) => {
    if (!value) return 'public';
    return String(value).trim().toLowerCase().replace('.qa', '') || 'public';
};

const resolveBrowserTenant = () => {
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    let tenantId = 'public';
    if (parts.length >= 3 && !hostname.includes('localhost') && !hostname.includes('app-qa') && !hostname.includes('app.')) {
        const sub = parts[0];
        if (!['www', 'api', 'app', 'dashboard', 'admin'].includes(sub)) {
            tenantId = sub;
        }
    }
    if (tenantId === 'public') {
        const storedTenant = localStorage.getItem('selected_tenant');
        if (storedTenant && !storedTenant.includes('public')) {
            tenantId = storedTenant;
        }
    }
    return normalizeTenantId(tenantId);
};

export const WebSocketProvider = ({ children }) => {
    const [status, setStatus] = useState('DISCONNECTED'); // CONNECTED, DISCONNECTED, RECONNECTING
    const ws = useRef(null);
    const listeners = useRef({});
    const reconnectTimeout = useRef(null);
    const pingInterval = useRef(null);
    const retryCount = useRef(0);
    const maxRetries = 5; // Reducido para evitar loops de reconexión agresivos
    const isMounting = useRef(true);
    const tenantIdRef = useRef(resolveBrowserTenant());

    const connect = useCallback(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            console.log('WS: No authenticated session. Skipping connection.');
            setStatus('DISCONNECTED');
            return;
        }

        // 1. Check if already connected or connecting
        if (ws.current) {
            if (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING) {
                console.log('🔌 WS: Connection already active/pending. Skipping.');
                return;
            }
            // If closing or closed, proceed to create new one, but ensure old one is cleaned
            try { ws.current.close(); } catch (e) { }
        }

        // En desarrollo local (localhost): usa 127.0.0.1:8000
        // En producción: usa el API_BASE_URL configurado
        const isDev = import.meta.env.DEV;
        let wsUrl;

        if (isDev && window.location.hostname === 'localhost') {
            wsUrl = 'ws://127.0.0.1:8000/api/v1/ws';
        } else {
            // Obtener la URL base de la configuración (ej: https://api.miinventariofacil.com/api/v1)
            // Y convertirla a ws/wss
            const apiBase = apiClient.defaults.baseURL || '';
            const wsProtocol = apiBase.startsWith('https') ? 'wss:' : 'ws:';

            // Reemplazar http/https por ws/wss y asegurar que termina en /ws
            let cleanBase = apiBase
                .replace(/^https?:\/\//, '')
                .replace(/\/+$/, '');

            // Si la base ya incluye /api/v1, solo añadimos /ws
            // Si no, lo construimos completo
            if (cleanBase.includes('/api/v1')) {
                wsUrl = `${wsProtocol}//${cleanBase}/ws`;
            } else {
                wsUrl = `${wsProtocol}//${cleanBase}/api/v1/ws`;
            }
        }

        try {
            // Agregar tenant_id como query param para que el backend sepa el tenant
            const tenantId = resolveBrowserTenant();
            tenantIdRef.current = tenantId;
            
            const queryPrefix = wsUrl.includes('?') ? '&' : '?';
            const wsUrlWithTenant = `${wsUrl}${queryPrefix}tenant_id=${encodeURIComponent(tenantId)}&token=${encodeURIComponent(token)}`;
            const safeWsUrl = `${wsUrl}${queryPrefix}tenant_id=${encodeURIComponent(tenantId)}&token=[redacted]`;

            console.log("WS: Connecting to", safeWsUrl, "tenant:", tenantId);
            console.log(`WS: Connecting to ${safeWsUrl} (Attempt ${retryCount.current + 1})`);

            setStatus(retryCount.current > 0 ? 'RECONNECTING' : 'DISCONNECTED');

            ws.current = new WebSocket(wsUrlWithTenant);

            ws.current.onopen = () => {
                console.log('✅ WS: Connected');
                setStatus('CONNECTED');
                retryCount.current = 0;

                // Start Ping Heartbeat
                if (pingInterval.current) clearInterval(pingInterval.current);
                pingInterval.current = setInterval(() => {
                    if (ws.current?.readyState === WebSocket.OPEN) {
                        ws.current.send('ping');
                    }
                }, 30000);
            };

            ws.current.onmessage = (event) => {
                if (event.data === 'pong') return;
                try {
                    const message = JSON.parse(event.data);
                    const { type, data } = message;
                    const messageTenant = normalizeTenantId(message.tenant_id || data?.tenant_id || data?.tenant);
                    const currentTenant = tenantIdRef.current;

                    if (messageTenant !== 'public' && currentTenant !== 'public' && messageTenant !== currentTenant) {
                        console.warn('WS: Ignoring cross-tenant event', { type, messageTenant, currentTenant });
                        return;
                    }

                    if (listeners.current[type]) {
                        listeners.current[type].forEach(cb => cb(data));
                    }
                } catch (err) {
                    console.warn('WS: Non-JSON message', event.data);
                }
            };

            ws.current.onclose = () => {
                console.log('❌ WS: Disconnected');
                setStatus('DISCONNECTED');
                if (pingInterval.current) clearInterval(pingInterval.current);

                // Exponential Backoff Reconnect (with max retries limit)
                if (isMounting.current && ws.current && retryCount.current < maxRetries) {
                    const delay = Math.min(2000 * Math.pow(2, retryCount.current), 60000);
                    console.log(`🔄 WS: Reconnecting in ${delay}ms... (${retryCount.current + 1}/${maxRetries})`);

                    if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
                    reconnectTimeout.current = setTimeout(() => {
                        if (isMounting.current) {
                            retryCount.current++;
                            connect();
                        }
                    }, delay);
                } else if (retryCount.current >= maxRetries) {
                    console.warn('🛑 WS: Max retries reached. Stopping reconnection.');
                }
            };

            ws.current.onerror = (err) => {
                console.error('WS: Error', err);
                ws.current?.close(); // Force close to trigger onclose logic safely
            };
        } catch (error) {
            console.error('❌ WS: Critical Error initializing connection:', error);
            // Schedule retry on critical failure
            const delay = 5000;
            if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
            reconnectTimeout.current = setTimeout(() => {
                retryCount.current++;
                connect();
            }, delay);
        }

    }, []);

    useEffect(() => {
        connect();

        return () => {
            console.log('🛑 WS: Cleanup');
            isMounting.current = false;
            // Prevent reconnect loops
            if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
            if (pingInterval.current) clearInterval(pingInterval.current);

            if (ws.current) {
                // Remove onclose listener to prevent reconnect trigger during unmount
                ws.current.onclose = null;
                ws.current.close();
                ws.current = null;
            }
        };
    }, [connect]);

    const subscribe = useCallback((eventType, callback) => {
        if (!listeners.current[eventType]) {
            listeners.current[eventType] = [];
        }
        listeners.current[eventType].push(callback);

        // Unsubscribe function
        return () => {
            if (listeners.current[eventType]) {
                listeners.current[eventType] = listeners.current[eventType].filter(cb => cb !== callback);
            }
        };
    }, []);

    return (
        <WebSocketContext.Provider value={{ status, subscribe }}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = () => {
    const context = useContext(WebSocketContext);
    if (!context) throw new Error('useWebSocket must be used within WebSocketProvider');
    return context;
};
