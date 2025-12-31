import apiClient from '../config/axios';

const cashService = {
    getStatus: async () => {
        const response = await apiClient.get('/cash/sessions/current');
        return response.data;
    },

    openSession: async (data) => {
        const response = await apiClient.post('/cash/sessions/open', data);
        return response.data;
    },

    closeSession: async (sessionId, data) => {
        // Needs sessionId now
        const response = await apiClient.post(`/cash/sessions/${sessionId}/close`, data);
        return response.data;
    },

    addMovement: async (data) => {
        const response = await apiClient.post('/cash/movements', data);
        return response.data;
    },

    getHistory: async (filters = {}) => {
        const params = {};
        if (filters.startDate) params.start_date = filters.startDate;
        if (filters.endDate) params.end_date = filters.endDate;

        const response = await apiClient.get('/cash/sessions/history', { params });
        return response.data;
    }
};

export default cashService;
