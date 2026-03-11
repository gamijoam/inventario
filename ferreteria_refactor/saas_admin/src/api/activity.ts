import api from './axios';

export interface TenantActivity {
    tenant_id: number;
    name: string;
    schema_name: string;
    is_active: boolean;
    is_demo: boolean;
    license_type: string;
    created_at: string | null;
    sales_count: number;
    revenue_usd: number;
    last_sale: string | null;
    products_count: number;
    customers_count: number;
    last_login: string | null;
    user_count: number;
    activity_status: 'active' | 'low' | 'inactive' | 'abandoned';
}

export interface ActivitySummary {
    total: number;
    active: number;
    low_activity: number;
    inactive: number;
    abandoned: number;
    date_from: string;
    date_to: string;
}

export interface ActivityResponse {
    summary: ActivitySummary;
    tenants: TenantActivity[];
}

export const getActivity = async (params?: { date_from?: string; date_to?: string }): Promise<ActivityResponse> => {
    const response = await api.get('/admin/dashboard/activity', { params });
    return response.data;
};
