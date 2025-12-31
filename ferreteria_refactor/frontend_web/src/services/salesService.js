import apiClient from '../config/axios';

const salesService = {
    createSale: async (saleData) => {
        // saleData: { items: [], payment_method, total_usd, etc. }
        const response = await apiClient.post('/sales', saleData);
        return response.data;
    }
};

export default salesService;
