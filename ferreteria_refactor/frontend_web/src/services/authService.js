import apiClient from '../config/axios';

const authService = {
    login: async (username, password) => {
        const params = new URLSearchParams();
        params.append('username', username);
        params.append('password', password);

        const response = await apiClient.post('/auth/token', params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        return response.data;
    },

    async impersonateLogin(token) {
        const response = await apiClient.post('/auth/exchange-token', { access_token: token });
        return response.data;
    },
};

export default authService;
