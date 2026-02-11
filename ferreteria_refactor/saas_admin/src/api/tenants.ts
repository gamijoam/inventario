import api from './axios';
import type { Tenant, TenantListResponse, CreateTenantDTO, UpdateTenantDTO } from '../types/tenant';

// Define User interface here for now, or move to types/user.ts
export interface TenantUser {
    id: number;
    username: string;
    email: string;
    full_name: string;
    role: string;
    is_active: boolean;
}

export const getTenants = async (): Promise<TenantListResponse> => {
    const response = await api.get<TenantListResponse>('/admin/tenants');
    return response.data;
};

export const getTenantById = async (id: number): Promise<Tenant> => {
    const response = await api.get<Tenant>(`/admin/tenants/${id}`);
    return response.data;
};

export const getTenantUsers = async (id: number): Promise<TenantUser[]> => {
    const response = await api.get<TenantUser[]>(`/admin/tenants/${id}/users`);
    return response.data;
};

export const createTenant = async (data: CreateTenantDTO): Promise<Tenant> => {
    const response = await api.post<Tenant>('/admin/tenants', data);
    return response.data;
};

export const createTenantUser = async (tenantId: number, data: any): Promise<any> => {
    const response = await api.post(`/admin/tenants/${tenantId}/users`, data);
    return response.data;
};

export const updateTenant = async (id: number, data: UpdateTenantDTO): Promise<Tenant> => {
    const response = await api.patch<Tenant>(`/admin/tenants/${id}`, data);
    return response.data;
};

export const deleteTenant = async (id: number): Promise<void> => {
    await api.delete(`/admin/tenants/${id}?confirm=true`);
};

export const updateTenantStatus = async (id: number, isActive: boolean): Promise<Tenant> => {
    const response = await api.patch<Tenant>(`/admin/tenants/${id}/status`, { is_active: isActive });
    return response.data;
};

export const impersonateTenant = async (id: number): Promise<{ access_token: string; tenant_domain: string | null; tenant_schema: string }> => {
    const response = await api.post<{ access_token: string; tenant_domain: string | null; tenant_schema: string }>(`/admin/tenants/${id}/impersonate`);
    return response.data;
};
