import apiClient from '../config/axios';

const unifiedReportService = {
    // Sales & Financials
    getSalesSummary: async (params) => {
        // params: { start_date, end_date }
        const response = await apiClient.get('/reports/sales/summary', { params });
        return response.data;
    },

    getDailyClose: async (date) => {
        // date: YYYY-MM-DD
        const response = await apiClient.get('/reports/daily-close', { params: { date } });
        return response.data;
    },

    getProfitability: async (params) => {
        // params: { start_date, end_date }
        const response = await apiClient.get('/reports/profit/sales', { params });
        return response.data;
    },

    // Inventory
    getInventoryValuation: async (exchangeRate = 1.0) => {
        const response = await apiClient.get('/reports/inventory-valuation', { params: { exchange_rate: exchangeRate } });
        return response.data;
    },

    getLowStock: async (threshold = 5) => {
        const response = await apiClient.get('/reports/low-stock', { params: { threshold } });
        return response.data;
    },

    getTopProducts: async (params) => {
        // params: { start_date, end_date, limit, by }
        const response = await apiClient.get('/reports/top-products', { params });
        return response.data;
    }
};

export default unifiedReportService;
