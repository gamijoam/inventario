import apiClient from '../config/axios';
import toast from 'react-hot-toast';

/**
 * Get Hardware Bridge Client ID from localStorage
 * Reads the station printer route selected by the active cash register.
 */
const ACTIVE_REGISTER_STORAGE_KEY = 'cash_active_register_id';

function getStoredRegisterId() {
    const value = localStorage.getItem(ACTIVE_REGISTER_STORAGE_KEY);
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getHardwareClientId({ required = true } = {}) {
    const clientId = localStorage.getItem('hardware_client_id');

    if (!clientId && required) {
        throw new Error(
            'Esta estacion no tiene una impresora vinculada. Selecciona o abre la caja correcta, o configura el ID de impresora en Gestion de Cajas.'
        );
    }

    return clientId || null;
}

/**
 * Reset client ID configuration (for troubleshooting)
 * Call from browser console: window.resetPrinterConfig()
 */
window.resetPrinterConfig = function () {
    localStorage.removeItem('hardware_client_id');
    localStorage.removeItem(ACTIVE_REGISTER_STORAGE_KEY);
    toast.success('Configuración de impresora eliminada. Recargue la página para configurar nuevamente.');
};

// NOTE: Do NOT cache HARDWARE_CLIENT_ID at module load time.
// CashContext updates localStorage after session open, so we must read it fresh on every call.
// Use getHardwareClientId() directly inside each function.

const PRINT_REQUEST_TIMEOUT_MS = 8000;

const printerService = {
    /**
     * Trigger print via WebSocket to Hardware Bridge
     * @param {number} saleId - The ID of the sale to print
     */
    printTicket: async (saleId, options = {}) => {
        const route = options.route || 'station';
        const body = { sale_id: saleId };

        if (route === 'sale') {
            body.prefer_sale_register = true;
        } else {
            const clientId = options.clientId || getHardwareClientId({ required: false });
            const registerId = options.registerId || getStoredRegisterId();
            if (clientId) body.client_id = clientId;
            if (registerId) body.register_id = registerId;
            if (!clientId && !registerId) body.prefer_sale_register = true;
        }

        console.log(`printTicket - route: ${route}, body:`, body);
        try {
            // Send print command to backend, which forwards to Hardware Bridge via WebSocket
            const response = await apiClient.post(`/products/print/remote`, body, { timeout: PRINT_REQUEST_TIMEOUT_MS });

            return response.data;
        } catch (error) {
            console.error("Print Error:", error);

            // Enhanced error messages
            if (error.response?.status === 503) {
                // Return exact backend error message if provided
                const detail = error.response?.data?.detail;
                if (detail) {
                    throw new Error(detail);
                }

                // Fallback generic error
                throw new Error(
                    `Invensoft Bridge no esta conectado.\n\n` +
                    `Verifique que la aplicacion puente este abierta y que el ID de la caja coincida.\n\n` +
                    `Si necesita limpiar la ruta guardada, presione F12, vaya a Consola y escriba:\n` +
                    `resetPrinterConfig()`
                );
            } else if (error.response?.status === 500) {
                throw new Error(error.response?.data?.detail || "Error al enviar comando de impresión");
            } else if (error.code === "ECONNABORTED") {
                throw new Error(`La impresora no respondió a tiempo. Verifique que Invensoft Bridge esté abierto y conectado.`);
            } else if (error.message.includes("Network Error")) {
                throw new Error("No se pudo contactar el servidor para enviar la impresión. Si el sistema carga normalmente, revise el puente/impresora antes que la conexión a internet.");
            }

            throw error;
        }
    },

    /**
     * Send raw payload (e.g. Z Report) to Hardware Bridge
     * @param {Object} payload - The print payload { template, context, status }
     */
    printRaw: async (payload, options = {}) => {
        const clientId = options.clientId || getHardwareClientId({ required: false });
        const registerId = options.registerId || getStoredRegisterId();
        if (!clientId && !registerId) {
            throw new Error('Esta estacion no tiene una impresora vinculada. Selecciona una caja antes de imprimir.');
        }
        try {
            const response = await apiClient.post(`/products/print/remote/payload`, {
                client_id: clientId,
                register_id: registerId,
                payload: payload
            }, { timeout: PRINT_REQUEST_TIMEOUT_MS });
            return response.data;
        } catch (error) {
            console.error("Print Raw Error:", error);
            // Re-throw or handle silently?
            // If offline, maybe can't print.
            if (error.response?.status === 503) {
                const detail = error.response?.data?.detail || `Impresora no conectada.`;
                throw new Error(detail);
            } else if (error.code === "ECONNABORTED") {
                throw new Error(`La impresora no respondió a tiempo.`);
            } else if (error.message?.includes("Network Error")) {
                throw new Error("No se pudo contactar el servidor para enviar la impresión.");
            }
            throw error;
        }
    },

    /**
     * Get current configured client ID (reads fresh from localStorage)
     */
    getClientId: () => getHardwareClientId(),

    /**
     * Reconfigure client ID
     */
    reconfigure: () => {
        window.resetPrinterConfig();
    }
};

export default printerService;
