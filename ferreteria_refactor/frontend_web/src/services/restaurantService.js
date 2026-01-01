import axiosInstance from '../config/axios';

const restaurantService = {
    // --- TABLES ---
    getTables: async () => {
        const response = await axiosInstance.get('/restaurant/tables/'); // Remove /api/v1
        return response.data;
    },

    createTable: async (tableData) => {
        const response = await axiosInstance.post('/restaurant/tables/', tableData);
        return response.data;
    },

    updateTable: async (id, tableData) => {
        const response = await axiosInstance.put(`/restaurant/tables/${id}`, tableData);
        return response.data;
    },

    deleteTable: async (id) => {
        await axiosInstance.delete(`/restaurant/tables/${id}`);
        return true;
    },

    // --- MENU ---
    getMenuFull: async () => {
        const response = await axiosInstance.get('/restaurant/menu/full');
        return response.data;
    },

    // --- ORDERS (Phase 3) ---
    openTable: async (tableId) => {
        const response = await axiosInstance.post(`/restaurant/orders/open/${tableId}`);
        return response.data;
    },

    getCurrentOrder: async (tableId) => {
        const response = await axiosInstance.get(`/restaurant/orders/${tableId}/current`);
        return response.data;
    },

    addItemsToOrder: async (orderId, items) => {
        const response = await axiosInstance.post(`/restaurant/orders/${orderId}/items`, items);
        return response.data;
    },

    checkoutOrder: async (orderId, checkoutData) => {
        const response = await axiosInstance.post(`/restaurant/orders/${orderId}/checkout`, checkoutData);
        return response.data;
    },

    printPreCheck: async (orderId) => {
        const response = await axiosInstance.post(`/restaurant/orders/${orderId}/precheck`);
        return response.data;
    }
};

export default restaurantService;
