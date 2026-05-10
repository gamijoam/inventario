import apiClient from '../config/axios';

const LAST_VISIT_KEY = 'support_last_visit';

const supportService = {
    createTicket: async (ticketData) => {
        const response = await apiClient.post('/support/tickets/', ticketData);
        return response.data;
    },

    getMyTickets: async () => {
        const response = await apiClient.get('/support/tickets/');
        return response.data;
    },

    /**
     * Get count of tickets with admin responses since last visit.
     * Used for the notification badge in the Sidebar.
     */
    getUnreadCount: async () => {
        const since = localStorage.getItem(LAST_VISIT_KEY);
        const params = since ? { since } : {};
        const response = await apiClient.get('/support/tickets/unread-count', { params, _silentNetworkError: true });
        return response.data.count;
    },

    /**
     * Mark support page as visited (resets unread badge).
     */
    markAsRead: () => {
        localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());
    }
};

export default supportService;
