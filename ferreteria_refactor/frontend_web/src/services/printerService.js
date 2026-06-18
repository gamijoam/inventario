import apiClient from '../config/axios';
import toast from 'react-hot-toast';

/**
 * Get Hardware Bridge Client ID from localStorage
 * Reads the station printer route selected by the active cash register.
 */
function getHardwareClientId() {
    const clientId = localStorage.getItem('hardware_client_id');

    if (!clientId) {
        throw new Error(
            'Esta estacion no tiene una impresora vinculada. Selecciona o abre la caja correcta, o configura el ID de impresora en Gestion de Cajas.'
        );
    }

    return clientId;
}

/**
 * Reset client ID configuration (for troubleshooting)
 * Call from browser console: window.resetPrinterConfig()
 */
window.resetPrinterConfig = function () {
    localStorage.removeItem('hardware_client_id');
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
    printTicket: async (saleId) => {
        const clientId = getHardwareClientId(); // Read fresh from localStorage on each call
        console.log(`printTicket - Client ID: ${clientId}`);
        try {
            // Send print command to backend, which forwards to Hardware Bridge via WebSocket
            const response = await apiClient.post(`/products/print/remote`, {
                client_id: clientId,
                sale_id: saleId
            }, { timeout: PRINT_REQUEST_TIMEOUT_MS });

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
                    `Invensoft Bridge no está conectado.\n\n` +
                    `El sistema web está buscando una impresora con el ID: "${clientId}".\n` +
                    `Verifique que la aplicación puente esté abierta y configurada con el mismo "Client ID".\n\n` +
                    `Si necesita cambiar el ID en la web, presione F12, vaya a Consola y escriba:\n` +
                    `resetPrinterConfig()`
                );
            } else if (error.response?.status === 500) {
                throw new Error(error.response?.data?.detail || "Error al enviar comando de impresión");
            } else if (error.code === "ECONNABORTED") {
                throw new Error(`La impresora '${clientId}' no respondió a tiempo. Verifique que Invensoft Bridge esté abierto y conectado.`);
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
    printRaw: async (payload) => {
        const clientId = getHardwareClientId(); // Read fresh from localStorage on each call
        try {
            const response = await apiClient.post(`/products/print/remote/payload`, {
                client_id: clientId,
                payload: payload
            }, { timeout: PRINT_REQUEST_TIMEOUT_MS });
            return response.data;
        } catch (error) {
            console.error("Print Raw Error:", error);
            // Re-throw or handle silently?
            // If offline, maybe can't print.
            if (error.response?.status === 503) {
                const detail = error.response?.data?.detail || `Impresora '${clientId}' no conectada.`;
                throw new Error(detail);
            } else if (error.code === "ECONNABORTED") {
                throw new Error(`La impresora '${clientId}' no respondió a tiempo.`);
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
