import apiClient from '../config/axios';

const userService = {
    getAll: async () => {
        const response = await apiClient.get('/users');
        return response.data;
    },

    getById: async (id) => {
        const response = await apiClient.get(`/users/${id}`);
        return response.data;
    },

    create: async (userData) => {
        const response = await apiClient.post('/users', userData);
        return response.data;
    },

    update: async (id, userData) => {
        const response = await apiClient.put(`/users/${id}`, userData);
        return response.data;
    },

    delete: async (id) => {
        const response = await apiClient.delete(`/users/${id}`);
        return response.data;
    },

    updatePin: async (userId, pin) => {
        // PUT /users/{id}/pin
        // Body: { pin: string }
        const response = await apiClient.put(`/users/${userId}/pin`, { pin });
        return response.data;
    }
};

export default userService;
