import api from './axios';
import type { Payment, CreatePaymentDTO } from '../types/billing';

export const billingApi = {
    getTenantPayments: async (tenantId: number): Promise<Payment[]> => {
        const response = await api.get<Payment[]>(`/admin/tenants/${tenantId}/payments`);
        return response.data;
    },

    createPayment: async (data: CreatePaymentDTO): Promise<Payment> => {
        const response = await api.post<Payment>('/admin/payments', data);
        return response.data;
    },
};
