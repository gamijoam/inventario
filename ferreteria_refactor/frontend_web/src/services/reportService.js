import apiClient from '../config/axios';

const reportService = {
    /**
     * Download Excel report for a date range
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @returns {Promise<Blob>} Excel file as blob
     */
    async downloadExcelReport(startDate, endDate) {
        try {
            const params = {};
            if (startDate) params.start_date = startDate;
            if (endDate) params.end_date = endDate;

            const response = await apiClient.get('/reports/export/excel', {
                params,
                responseType: 'blob' // Important for file download
            });

            // Create blob from response
            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            // Generate filename
            const filename = `Reporte_Gerencial_${startDate || 'inicio'}_${endDate || 'fin'}.xlsx`;
            link.setAttribute('download', filename);

            // Trigger download
            document.body.appendChild(link);
            link.click();

            // Cleanup
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);

            return blob;
        } catch (error) {
            console.error('Error downloading Excel report:', error);
            throw error;
        }
    },

    /**
     * Get dashboard financial metrics
     */
    async getDashboardFinancials(startDate, endDate) {
        const params = {};
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;

        const response = await apiClient.get('/reports/dashboard/financials', { params });
        return response.data;
    },

    /**
     * Get dashboard cashflow
     */
    async getDashboardCashflow() {
        const response = await apiClient.get('/reports/dashboard/cashflow');
        return response.data;
    },

    /**
     * Download comprehensive 360° audit report with flattened multi-currency columns
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @returns {Promise<Blob>} Excel file as blob
     */
    async downloadGeneralReport(startDate, endDate) {
        try {
            const params = {};
            if (startDate) params.start_date = startDate;
            if (endDate) params.end_date = endDate;

            const response = await apiClient.get('/reports/export/general', {
                params,
                responseType: 'blob'
            });

            // Create blob from response
            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            // Generate filename
            const filename = `Auditoria_360_General_${startDate || 'inicio'}_${endDate || 'fin'}.xlsx`;
            link.setAttribute('download', filename);

            // Trigger download
            document.body.appendChild(link);
            link.click();

            // Cleanup
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);

            return blob;
        } catch (error) {
            console.error('Error downloading general report:', error);
            throw error;
        }
    }
};

export default reportService;
