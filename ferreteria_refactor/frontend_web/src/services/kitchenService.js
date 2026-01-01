import axiosInstance from '../config/axios';

const kitchenService = {
    getPendingOrders: async () => {
        const response = await axiosInstance.get('/restaurant/orders/kitchen/pending');
        return response.data;
    },

    updateItemStatus: async (itemId, status) => {
        // status: PENDING, PREPARING, READY, SERVED
        const response = await axiosInstance.put(`/restaurant/orders/items/${itemId}/status`, null, {
            params: { status }
        });
        return response.data;
    }
};

export default kitchenService;
