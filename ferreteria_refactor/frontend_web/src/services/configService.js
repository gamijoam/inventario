import apiClient from '../config/axios';

const configService = {
    // Business Info
    getBusinessInfo: async () => {
        // GET /config/business
        const response = await apiClient.get('/config/business');
        return response.data;
    },

    updateBusinessInfo: async (data) => {
        // PUT /config/business
        const response = await apiClient.put('/config/business', data);
        return response.data;
    },

    uploadLogo: async (file) => {
        const formData = new FormData();
        formData.append('logo', file);
        const response = await apiClient.post('/config/business/logo', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    // Currencies
    getCurrencies: async () => {
        // GET /config/currencies
        const response = await apiClient.get('/config/currencies');
        return response.data;
    },

    createCurrency: async (data) => {
        const response = await apiClient.post('/config/currencies', data);
        return response.data;
    },

    updateCurrency: async (id, data) => {
        const response = await apiClient.put(`/config/currencies/${id}`, data);
        return response.data;
    },

    deleteCurrency: async (id) => {
        const response = await apiClient.delete(`/config/currencies/${id}`);
        return response.data;
    }
};

export default configService;
