import apiClient from '../config/axios';
import { PrintType } from '../schemas/print'; // Assuming PrintType enum is accessible

const printService = {
    sendPrintJob: async (orderId, printType, printerTarget, payload = {}) => {
        const printRequest = {
            order_id: orderId,
            print_type: printType,
            printer_target: printerTarget,
            payload: payload
        };
        const response = await apiClient.post('/restaurant/print/', printRequest);
        return response.data;
    }
};

export default printService;