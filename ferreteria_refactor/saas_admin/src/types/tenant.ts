export interface Tenant {
    id: number;
    name: string;
    schema_name: string;
    domain: string | null;
    is_active: boolean;
    created_at: string;
    config?: Record<string, any>;
    // Subscription Fields
    is_demo: boolean;
    subscription_expires_at: string | null; // ISO Date
    days_remaining?: number; // Calculated helper
    user_count?: number;

    // Module Flags
    has_restaurant_module: boolean;
    has_laundry_module: boolean;
    has_hardware_module: boolean;
    has_services_module: boolean;
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
    // Subscription Fields
    is_demo: boolean;
    subscription_expires_at: string | null;
}

export interface UpdateTenantDTO {
    name?: string;
    domain?: string;
    is_active?: boolean;
    config?: Record<string, any>;
    is_demo?: boolean;
    subscription_expires_at?: string | null;

    // Module Flags
    has_restaurant_module?: boolean;
    has_laundry_module?: boolean;
    has_hardware_module?: boolean;
    has_services_module?: boolean;
}
