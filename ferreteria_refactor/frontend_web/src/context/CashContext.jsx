import { createContext, useState, useContext, useEffect } from 'react';
import apiClient from '../config/axios';
import { useWebSocket } from './WebSocketContext';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';
import printerService from '../services/printerService';

const CashContext = createContext();

const ACTIVE_REGISTER_STORAGE_KEY = 'cash_active_register_id';

const readStoredRegisterId = () => {
    try {
        const value = localStorage.getItem(ACTIVE_REGISTER_STORAGE_KEY);
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    } catch {
        return null;
    }
};

const persistStationRegister = (register) => {
    if (!register?.id) return;
    localStorage.setItem(ACTIVE_REGISTER_STORAGE_KEY, String(register.id));
    if (register.hardware_client_id) {
        localStorage.setItem('hardware_client_id', register.hardware_client_id);
    } else {
        localStorage.removeItem('hardware_client_id');
    }
};

const clearPrinterRoute = () => {
    localStorage.removeItem('hardware_client_id');
};

export const CashProvider = ({ children }) => {
    const [isSessionOpen, setIsSessionOpen] = useState(false);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    // Multi-register support
    const [registers, setRegisters] = useState([]);
    const [activeRegister, setActiveRegisterState] = useState(null); // Register selected for this terminal
    const { subscribe } = useWebSocket();

    // Get Auth Context to prevent race conditions
    const { isAuthenticated, user } = useAuth();

    const setActiveRegister = (register) => {
        setActiveRegisterState(register || null);
        if (register) persistStationRegister(register);
    };

    const selectStationRegister = async (register) => {
        if (!register?.id) return false;
        setActiveRegister(register);
        await checkStatus(0, registers);
        return true;
    };

    const fetchRegisters = async () => {
        try {
            // _silentNetworkError + _silent403: CashContext handles its own errors;
            // avoid duplicate toasts from the interceptor for this background poll.
            const res = await apiClient.get('/cash/registers/status', {
                _silentNetworkError: true,
                _silent403: true,
            });
            const list = Array.isArray(res.data) ? res.data : [];
            setRegisters(list);

            const storedRegisterId = readStoredRegisterId();
            const storedRegister = storedRegisterId ? list.find(r => Number(r.id) === storedRegisterId) : null;
            if (storedRegister) {
                setActiveRegisterState(storedRegister);
                persistStationRegister(storedRegister);
            } else if (list.length === 1) {
                setActiveRegister(list[0]);
            }
            return list;
        } catch (e) {
            console.warn('Could not fetch registers:', e);
            setRegisters([]);
            return [];
        }
    };

    const checkStatus = async (retryCount = 0, knownRegisters = registers) => {
        // Prevent checking if not authenticated yet
        if (!isAuthenticated) return;

        console.log(`Checking cash session status... (Attempt ${retryCount + 1})`);
        if (retryCount === 0) setLoading(true); // Only set loading on first attempt to avoid flicker on retries

        const storedRegisterId = readStoredRegisterId();
        const registerList = Array.isArray(knownRegisters) ? knownRegisters : [];
        const isAdmin = user?.is_superuser || user?.role === 'ADMIN' || user?.role === 'UserRole.ADMIN';
        const mustAvoidAdminFallback = isAdmin && registerList.length > 1 && !storedRegisterId;

        try {
            if (mustAvoidAdminFallback) {
                console.warn('Admin without station register selected; refusing to bind to an arbitrary open cash session.');
                setIsSessionOpen(false);
                setSession(null);
                clearPrinterRoute();
                setLoading(false);
                return;
            }

            const requestConfig = { _silentNetworkError: true };
            if (storedRegisterId) {
                requestConfig.params = { register_id: storedRegisterId };
            }
            // _silentNetworkError: true: interceptor no muestra toast; CashContext gestiona sus propios reintentos
            const response = await apiClient.get('/cash/sessions/current', requestConfig);

            if (!response.data) {
                // Handle 200 OK with null/empty body -> No active session
                console.log('No active cash session found (Server returned null).');
                setIsSessionOpen(false);
                setSession(null);
                clearPrinterRoute();
            } else {
                console.log('Cash session check successful:', response.data);
                setIsSessionOpen(true);
                setSession(response.data);
                setActiveRegisterState(response.data.register || null);
                if (response.data.register) persistStationRegister(response.data.register);
                // Sync hardware_client_id so printerService routes to the correct printer
                const hwId = response.data?.register?.hardware_client_id;
                if (hwId) {
                    console.log(`Printer ID synced from register: ${hwId}`);
                } else {
                    clearPrinterRoute();
                    console.warn('Active register has no hardware_client_id configured.');
                }
            }
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
                clearPrinterRoute();
                return;
            }

            // Retry on network errors OR if backend not ready (increase retry limit)
            if ((error.code === 'ERR_NETWORK' || !error.response) && retryCount < 5) {
                const delay = retryCount === 0 ? 1000 : (retryCount + 1) * 500; // First retry after 1s
                console.warn(`⏳ Cash session check failed (attempt ${retryCount + 1}/5), retrying in ${delay}ms...`);
                setTimeout(() => checkStatus(retryCount + 1, knownRegisters), delay);
                return; // Don't stop loading yet
            }

            // No active session or max retries reached
            console.warn('⚠️ Error checking status:', error);
            if (error.response?.status !== 404) {
                // 404 should technically be handled by the null check above if backend is updated,
                // but keep this for backward compat or if backend still throws 404.
                console.error('🔥 Error Checking Cash Session:', error);

                // Only show toast for actual errors, not 404 "Not Found"
                // Solo mostrar error si es un error HTTP real (no Network Error intermitente)
                if (error.response?.status && error.response.status !== 404) {
                    toast.error(`Error verificando caja: ${error.response.status} - ${error.message}`);
                }
                // Network Error (sin response) se suprime — es normal al iniciar la app
            }

            setIsSessionOpen(false);
            setSession(null);
            clearPrinterRoute();
        }
        // Refactored flow to avoid finally block complexity with retry
        setLoading(false);
    };

    useEffect(() => {
        if (isAuthenticated) {
            (async () => {
                const list = await fetchRegisters();
                await checkStatus(0, list);
            })();
        } else {
            setLoading(false); // Stop loading if not auth
        }

        // WebSocket Subscriptions
        const unsubOpen = subscribe('cash_session:opened', (data) => {
            console.log('Session Opened Real-time:', data);
            setIsSessionOpen(true);
            fetchRegisters().then(list => checkStatus(0, list));
        });

        const unsubClose = subscribe('cash_session:closed', (data) => {
            console.log('Session Closed Real-time:', data);
            setIsSessionOpen(false);
            setSession(null);
            fetchRegisters();

            // AUTO-PRINT Z REPORT
            if (data.print_payload) {
                console.log("Printing Z Report automatically...");
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
    }, [subscribe, isAuthenticated]);

    const openSession = async (sessionData) => {
        try {
            const response = await apiClient.post('/cash/sessions/open', sessionData);
            setIsSessionOpen(true);
            setSession(response.data);
            if (response.data?.register) setActiveRegister(response.data.register);
            // Sync hardware_client_id for per-register printer routing on session open
            const hwId = response.data?.register?.hardware_client_id;
            if (hwId) {
                console.log(`Printer ID set for this register: ${hwId}`);
            } else {
                clearPrinterRoute();
                console.warn('Opened register has no hardware_client_id configured.');
            }
            return true;
        } catch (error) {
            console.error('Error opening session:', error);
            let errorMessage = "Error desconocido";
            const detail = error.response?.data?.detail;

            if (typeof detail === 'string') {
                errorMessage = detail;
            } else if (Array.isArray(detail)) {
                errorMessage = detail.map(e => `${e.loc.join('.')}: ${e.msg}`).join(', ');
            } else if (typeof detail === 'object') {
                errorMessage = JSON.stringify(detail);
            } else {
                errorMessage = error.message;
            }

            toast.error(`Error al abrir caja: ${errorMessage}`);
            return false;
        }
    };

    const closeSession = async (closeData) => {
        try {
            if (!session) return false;
            await apiClient.post(`/cash/sessions/${session.id}/close`, closeData);
            setIsSessionOpen(false);
            setSession(null);
            clearPrinterRoute();
            return true;
        } catch (error) {
            console.error('Error closing session:', error);
            let errorMessage = "Error desconocido";
            const detail = error.response?.data?.detail;

            if (typeof detail === 'string') {
                errorMessage = detail;
            } else if (Array.isArray(detail)) {
                errorMessage = detail.map(e => `${e.loc.join('.')}: ${e.msg}`).join(', ');
            } else if (typeof detail === 'object') {
                errorMessage = JSON.stringify(detail);
            } else {
                errorMessage = error.message;
            }

            toast.error(`Error al cerrar caja: ${errorMessage}`);
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
            refreshStatus: checkStatus,
            // Multi-register
            registers,
            activeRegister,
            setActiveRegister,
            selectStationRegister,
            fetchRegisters,
        }}>
            {children}
        </CashContext.Provider>
    );
};

export const useCash = () => useContext(CashContext);
