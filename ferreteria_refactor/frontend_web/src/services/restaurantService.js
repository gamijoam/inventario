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

    updateTableStatus: async (id, status) => {
        const response = await axiosInstance.patch(`/restaurant/tables/${id}/status`, null, {
            params: { status }
        });
        return response.data;
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

    openTakeout: async (customerName = null) => {
        const params = customerName ? { customer_name: customerName } : {};
        const response = await axiosInstance.post(`/restaurant/orders/open-takeout`, null, { params });
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
    },

    getPreCheckThermal: async (orderId, width = '58') => {
        const response = await axiosInstance.get(`/restaurant/orders/${orderId}/print/thermal?width=${width}`);
        return response.data;
    },

    moveOrder: async (orderId, targetTableId) => {
        const response = await axiosInstance.post(`/restaurant/orders/${orderId}/move`, { target_table_id: targetTableId });
        return response.data;
    },

    splitOrder: async (orderId, itemsToSplit) => {
        // itemsToSplit: [{ item_id: 1, quantity: 1 }]
        const response = await axiosInstance.post(`/restaurant/orders/${orderId}/split`, { items_to_split: itemsToSplit });
        return response.data;
    },

    getOrder: async (orderId) => {
        const response = await axiosInstance.get(`/restaurant/orders/${orderId}`);
        return response.data;
    },

    // --- MODIFIERS ---
    getProductModifiers: async (productId) => {
        const response = await axiosInstance.get(`/restaurant/modifiers/product/${productId}`);
        return response.data;
    },

    createModifierGroup: async (productId, groupData) => {
        const response = await axiosInstance.post(`/restaurant/modifiers/product/${productId}`, groupData);
        return response.data;
    },

    deleteModifierGroup: async (groupId) => {
        await axiosInstance.delete(`/restaurant/modifiers/group/${groupId}`);
        return true;
    },

    addModifierOption: async (groupId, optionData) => {
        const response = await axiosInstance.post(`/restaurant/modifiers/option/${groupId}`, optionData);
        return response.data;
    },

    deleteModifierOption: async (optionId) => {
        await axiosInstance.delete(`/restaurant/modifiers/option/${optionId}`);
        return true;
    },

    // --- KITCHEN (KDS) ---
    getKitchenOrders: async () => {
        const response = await axiosInstance.get('/restaurant/orders/kitchen/pending');
        return response.data;
    },

    updateItemStatus: async (itemId, status) => {
        const response = await axiosInstance.put(`/restaurant/orders/items/${itemId}/status`, null, {
            params: { status }
        });
        return response.data;
    },

    cancelItem: async (itemId) => {
        const response = await axiosInstance.delete(`/restaurant/orders/items/${itemId}`);
        return response.data;
    },

    getProductStock: async (productId) => {
        const response = await axiosInstance.get(`/restaurant/orders/stock/${productId}`);
        return response.data;
    },

    getProductRecipe: async (productId) => {
        const response = await axiosInstance.get(`/restaurant/menu/recipes/${productId}`);
        return response.data;
    }
};

export default restaurantService;
