import apiClient from '../config/axios';

const supportService = {
    createTicket: async (ticketData) => {
        const response = await apiClient.post('/support/tickets/', ticketData);
        return response.data;
    },

    getMyTickets: async () => {
        const response = await apiClient.get('/support/tickets/');
        return response.data;
    }
};

export default supportService;
