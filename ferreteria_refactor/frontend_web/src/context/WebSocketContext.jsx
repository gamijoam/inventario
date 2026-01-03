import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import apiClient from '../config/axios';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
    const [status, setStatus] = useState('DISCONNECTED'); // CONNECTED, DISCONNECTED, RECONNECTING
    const ws = useRef(null);
    const listeners = useRef({});
    const reconnectTimeout = useRef(null);
    const pingInterval = useRef(null);
    const retryCount = useRef(0);
    const maxRetries = 10;
    const isMounting = useRef(true);

    const connect = useCallback(() => {
        // 1. Check if already connected or connecting
        if (ws.current) {
            if (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING) {
                console.log('🔌 WS: Connection already active/pending. Skipping.');
                return;
            }
            // If closing or closed, proceed to create new one, but ensure old one is cleaned
            try { ws.current.close(); } catch (e) { }
        }

        // --- CONFIGURACIÓN AGNÓSTICA AL DOMINIO ---
        // En desarrollo: usa localhost:8001
        // En producción: usa el dominio actual con protocolo correcto

        const isDev = import.meta.env.DEV;
        let wsUrl;

        if (isDev) {
            // Desarrollo: backend en localhost:8001
            wsUrl = 'ws://localhost:8001/api/v1/ws';
        } else {
            // Producción: construir URL dinámicamente
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host; // Obtiene 'demo3.invensoft.lat' o el dominio actual
            wsUrl = `${protocol}//${host}/api/v1/ws`;
        }

        try {
            console.log("🔌 Conectando WS a:", wsUrl);
            console.log(`🔌 WS: Connecting to ${wsUrl} (Attempt ${retryCount.current + 1})`);

            setStatus(retryCount.current > 0 ? 'RECONNECTING' : 'DISCONNECTED');

            ws.current = new WebSocket(wsUrl);

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

                // Exponential Backoff Reconnect
                if (isMounting.current && ws.current) { // Check mount status
                    const delay = Math.min(1000 * Math.pow(2, retryCount.current), 30000);
                    console.log(`🔄 WS: Reconnecting in ${delay}ms...`);

                    if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
                    reconnectTimeout.current = setTimeout(() => {
                        if (isMounting.current) { // Double check before firing
                            retryCount.current++;
                            connect();
                        }
                    }, delay);
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
