export type LicenseType = 'trial' | 'monthly' | 'annual' | 'lifetime';

export interface Tenant {
    id: number;
    name: string;
    schema_name: string;
    domain: string | null;
    is_active: boolean;
    created_at: string;
    config?: Record<string, unknown>;
    // Subscription Fields
    is_demo: boolean;
    subscription_expires_at: string | null; // ISO Date
    days_remaining?: number; // Calculated helper
    user_count?: number;

    // License Fields
    license_type: LicenseType;
    trial_days: number;
    trial_ends_at: string | null;
    license_blocked_reason: string | null;

    // Module Flags
    has_restaurant_module: boolean;
    has_laundry_module: boolean;
    has_hardware_module: boolean;
    has_services_module: boolean;
    has_barbershop_module: boolean;
    has_pharmacy_module: boolean;

    // Feature flags a la carta
    feature_flags: Record<string, boolean>;
}

export interface FeatureFlagDef {
    label: string;
    description: string;
    category: string;
}

export interface FeatureFlagsRegistry {
    registry: Record<string, FeatureFlagDef>;
    categories: string[];
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
    config?: Record<string, unknown>;
    is_demo?: boolean;
    subscription_expires_at?: string | null;

    // License Fields
    license_type?: LicenseType;
    trial_days?: number;
    trial_ends_at?: string | null;
    license_blocked_reason?: string | null;

    // Module Flags
    has_restaurant_module?: boolean;
    has_laundry_module?: boolean;
    has_hardware_module?: boolean;
    has_services_module?: boolean;
    has_barbershop_module?: boolean;
    has_pharmacy_module?: boolean;
}
