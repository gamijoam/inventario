import apiClient from '../config/axios';

const auditService = {
    getLogs: async (filters = {}) => {
        // skip, limit, user_id, table_name, etc.
        const params = new URLSearchParams();
        if (filters.skip) params.append('skip', filters.skip);
        if (filters.limit) params.append('limit', filters.limit);
        if (filters.table_name && filters.table_name !== 'ALL') params.append('table_name', filters.table_name);
        // Add other filters as needed

        const response = await apiClient.get(`/audit/logs?${params.toString()}`);
        return response.data;
    }
};

export default auditService;
