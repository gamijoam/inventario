import apiClient from '../config/axios';

const inventoryService = {
    getKardex: async (params = {}) => {
        // params can include page, start_date, end_date, product_id
        const response = await apiClient.get('/inventory/kardex', { params });
        return response.data;
    },

    createAdjustment: async (data) => {
        // data: { product_id, type, quantity (base unit), reason, etc. }
        const response = await apiClient.post('/inventory/adjustment', data);
        return response.data;
    },

    // Helper to fetch products for autocomplete (if not in product service)
    searchProducts: async (query) => {
        const response = await apiClient.get('/products', { params: { search: query } });
        return response.data;
    }
};

export default inventoryService;
