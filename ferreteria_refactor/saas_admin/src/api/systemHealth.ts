import api from './axios';

export type HealthKind = 'CLIENT_ERROR' | 'API_ERROR' | 'NETWORK_ERROR';
export type HealthSeverity = 'critical' | 'error' | 'warning';

export interface SystemHealthSummary {
    total_events: number;
    critical: number;
    error: number;
    warning: number;
    unique_groups: number;
    affected_tenants: number;
    hours: number;
    since: string;
    by_kind: Record<HealthKind, number>;
    by_severity: Record<HealthSeverity, number>;
}

export interface SystemHealthEvent {
    id: string;
    audit_id: number;
    tenant_id: number;
    tenant_name: string;
    tenant_schema: string;
    kind: HealthKind;
    severity: HealthSeverity;
    message: string;
    source: string;
    route: string;
    url: string;
    method?: string | null;
    status?: number | null;
    ip_address?: string | null;
    user_id?: number | null;
    user_agent?: string | null;
    context: Record<string, unknown>;
    timestamp: string | null;
    signature: string;
}

export interface SystemHealthGroup {
    signature: string;
    message: string;
    source: string;
    route: string;
    kind: HealthKind;
    severity: HealthSeverity;
    status?: number | null;
    count: number;
    tenant_count: number;
    tenants: { schema_name: string; name: string }[];
    first_seen: string | null;
    last_seen: string | null;
}

export interface SystemHealthTenantOption {
    id: number;
    name: string;
    schema_name: string;
    is_active: boolean;
}

export interface SystemHealthTopTenant {
    schema_name: string;
    name: string;
    count: number;
}

export interface SystemHealthAlert extends SystemHealthGroup {
    threshold: number;
    alert_level: 'critical' | 'warning';
}

export interface SystemHealthResponse {
    summary: SystemHealthSummary;
    events: SystemHealthEvent[];
    groups: SystemHealthGroup[];
    alert_candidates: SystemHealthAlert[];
    top_tenants: SystemHealthTopTenant[];
    tenant_options: SystemHealthTenantOption[];
}

export interface SystemHealthParams {
    hours?: number;
    tenant?: string;
    kind?: HealthKind | 'all';
    q?: string;
    limit?: number;
    alert_threshold?: number;
}

export const getSystemHealth = async (params: SystemHealthParams = {}): Promise<SystemHealthResponse> => {
    const cleaned = {
        ...params,
        kind: params.kind === 'all' ? undefined : params.kind,
        tenant: params.tenant === 'all' ? undefined : params.tenant,
    };
    const response = await api.get('/admin/dashboard/system-health', { params: cleaned });
    return response.data;
};
