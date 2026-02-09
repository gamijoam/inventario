import api from './axios';
import type { Tenant, TenantListResponse, CreateTenantDTO } from '../types/tenant';

export const getTenants = async (): Promise<TenantListResponse> => {
    const response = await api.get<TenantListResponse>('/admin/tenants');
    return response.data;
};

export const createTenant = async (data: CreateTenantDTO): Promise<Tenant> => {
    const response = await api.post<Tenant>('/admin/tenants', data);
    return response.data;
};
