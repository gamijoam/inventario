export interface Payment {
    id: number;
    tenant_id: number;
    amount: number;
    currency: 'USD' | 'VES';
    payment_method: string;
    reference: string;
    status: 'completed' | 'pending';
    notes?: string;
    created_at: string;
}

export interface CreatePaymentDTO {
    tenant_id: number;
    amount: number;
    currency: 'USD' | 'VES';
    payment_method: string;
    reference: string;
    status?: 'completed' | 'pending';
    notes?: string;
}
