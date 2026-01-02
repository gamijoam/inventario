import { createContext, useState, useContext, useEffect } from 'react';
import apiClient from '../config/axios';
import { useWebSocket } from './WebSocketContext';
import toast from 'react-hot-toast';
import printerService from '../services/printerService';

const CashContext = createContext();

export const CashProvider = ({ children }) => {
    const [isSessionOpen, setIsSessionOpen] = useState(false);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const { subscribe } = useWebSocket();

    const checkStatus = async (retryCount = 0) => {
        try {
            const response = await apiClient.get('/cash/sessions/current');
            console.log('✅ Cash session check successful:', response.data);
            setIsSessionOpen(true);
            setSession(response.data);
            setLoading(false);
        } catch (error) {
            // If 401 Unauthorized, token might be invalid (server restarted)
            if (error.response?.status === 401) {
                // Clear potentially invalid token
                const hasToken = localStorage.getItem('token');
                if (hasToken) {
                    console.log('⚠️ Invalid token detected after server restart, clearing...');
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                }
                setIsSessionOpen(false);
                setSession(null);
                setLoading(false);
                return;
            }

            // Retry on network errors OR if backend not ready (increase retry limit)
            if ((error.code === 'ERR_NETWORK' || !error.response) && retryCount < 5) {
                const delay = retryCount === 0 ? 1000 : (retryCount + 1) * 500; // First retry after 1s
                console.warn(`⏳ Cash session check failed (attempt ${retryCount + 1}/5), retrying in ${delay}ms...`);
                setTimeout(() => checkStatus(retryCount + 1), delay);
                return;
            }

            // No active session or max retries reached
            console.warn('⚠️ No active cash session found or error checking status:', error);
            if (error.response?.status !== 404) {
                // Only alert if it's NOT a 404 (404 is normal for "Closed")
                console.error('🔥 Error Checking Cash Session:', error);
                // Show toast to user for diagnostics
                toast.error(`Error verificando caja: ${error.response?.status || 'Network Error'} - ${error.message}`);
            }

            setIsSessionOpen(false);
            setSession(null);
            setLoading(false);
        }
    };

    useEffect(() => {
        checkStatus();

        // WebSocket Subscriptions
        const unsubOpen = subscribe('cash_session:opened', (data) => {
            console.log('💵 Session Opened Real-time:', data);
            setIsSessionOpen(true);
            checkStatus();
        });

        const unsubClose = subscribe('cash_session:closed', (data) => {
            console.log('💵 Session Closed Real-time:', data);
            setIsSessionOpen(false);
            setSession(null);

            // AUTO-PRINT Z REPORT
            if (data.print_payload) {
                console.log("🖨️ Printing Z Report automatically...");
                printerService.printRaw(data.print_payload).then(() => {
                    toast.success("Reporte Z enviado a la impresora");
                }).catch(err => {
                    console.error("Failed to auto-print Z Report", err);
                    toast.error("Error imprimiendo Reporte Z");
                });
            }
        });

        return () => {
            unsubOpen();
            unsubClose();
        };
    }, [subscribe]);

    const openSession = async (sessionData) => {
        try {
            const response = await apiClient.post('/cash/sessions/open', sessionData);
            setIsSessionOpen(true);
            setSession(response.data);
            return true;
        } catch (error) {
            console.error('Error opening session:', error);
            alert('Error al abrir caja: ' + (error.response?.data?.detail || error.message));
            return false;
        }
    };

    const closeSession = async (closeData) => {
        try {
            if (!session) return false;
            await apiClient.post(`/cash/sessions/${session.id}/close`, closeData);
            setIsSessionOpen(false);
            setSession(null);
            return true;
        } catch (error) {
            console.error('Error closing session:', error);
            alert('Error al cerrar caja: ' + (error.response?.data?.detail || error.message));
            return false;
        }
    };

    return (
        <CashContext.Provider value={{
            isSessionOpen,
            session,
            loading,
            openSession,
            closeSession,
            refreshStatus: checkStatus
        }}>
            {children}
        </CashContext.Provider>
    );
};

export const useCash = () => useContext(CashContext);
