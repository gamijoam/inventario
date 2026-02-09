export interface Tenant {
    id: number;
    name: string;
    schema_name: string;
    domain?: string;
    is_active: boolean;
    created_at: string;
    user_count?: number;
    config?: Record<string, any>;
}

export interface TenantListResponse {
    total: number;
    tenants: Tenant[];
}

export interface CreateTenantDTO {
    name: string;
    schema_name: string;
    domain?: string;
    admin_email: string;
    admin_password: string;
    config?: Record<string, any>;
}
