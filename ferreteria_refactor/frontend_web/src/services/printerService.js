import apiClient from '../config/axios';

/**
 * Get Hardware Bridge Client ID from localStorage
 * Prompts user to configure on first use
 */
function getHardwareClientId() {
    let clientId = localStorage.getItem('hardware_client_id');

    if (!clientId) {
        // First time on this PC - prompt user to configure
        // Electron does not support prompt(). Use default or configurable ID.
        console.warn('⚠️ No Hardware ID found. Defaulting to "caja-1". Configure via Settings if needed.');
        clientId = 'caja-1';

        // Save to localStorage
        localStorage.setItem('hardware_client_id', clientId);
    }

    return clientId;
}

/**
 * Reset client ID configuration (for troubleshooting)
 * Call from browser console: window.resetPrinterConfig()
 */
window.resetPrinterConfig = function () {
    localStorage.removeItem('hardware_client_id');
    alert('Configuración de impresora eliminada. Recargue la página para configurar nuevamente.');
};

// Get client ID (will prompt on first use)
const HARDWARE_CLIENT_ID = getHardwareClientId();

console.log(`🖨️ Hardware Bridge Client ID: ${HARDWARE_CLIENT_ID}`);

const printerService = {
    /**
     * Trigger print via WebSocket to Hardware Bridge
     * @param {number} saleId - The ID of the sale to print
     */
    printTicket: async (saleId) => {
        try {
            // Send print command to backend, which forwards to Hardware Bridge via WebSocket
            const response = await apiClient.post(`/products/print/remote`, {
                client_id: HARDWARE_CLIENT_ID,
                sale_id: saleId
            });

            return response.data;
        } catch (error) {
            console.error("Print Error:", error);

            // Enhanced error messages
            if (error.response?.status === 503) {
                throw new Error(
                    `Hardware Bridge no está conectado.\n\n` +
                    `Verifique que:\n` +
                    `1. BridgeInvensoft.exe esté ejecutándose\n` +
                    `2. config.ini tenga: nombre_caja = ${HARDWARE_CLIENT_ID}\n\n` +
                    `Si el ID es incorrecto, abra la consola del navegador y ejecute:\n` +
                    `resetPrinterConfig()`
                );
            } else if (error.response?.status === 500) {
                throw new Error(error.response?.data?.detail || "Error al enviar comando de impresión");
            } else if (error.message.includes("Network Error")) {
                throw new Error("No se puede conectar con el servidor. Verifique su conexión a internet.");
            }

            throw error;
        }
    },

    /**
     * Send raw payload (e.g. Z Report) to Hardware Bridge
     * @param {Object} payload - The print payload { template, context, status }
     */
    printRaw: async (payload) => {
        try {
            const response = await apiClient.post(`/products/print/remote/payload`, {
                client_id: HARDWARE_CLIENT_ID,
                payload: payload
            });
            return response.data;
        } catch (error) {
            console.error("Print Raw Error:", error);
            // Re-throw or handle silently?
            // If offline, maybe can't print.
            if (error.response?.status === 503) {
                console.warn("Bridge Disconnected - Cannot print Z Report automatically.");
            }
        }
    },

    /**
     * Get current configured client ID
     */
    getClientId: () => HARDWARE_CLIENT_ID,

    /**
     * Reconfigure client ID
     */
    reconfigure: () => {
        window.resetPrinterConfig();
    }
};

export default printerService;
