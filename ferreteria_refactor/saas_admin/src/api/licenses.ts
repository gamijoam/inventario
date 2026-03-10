/**
 * Gestión de licencias de tenants.
 * Todas las acciones usan PATCH /admin/tenants/{id} que ya acepta todos los campos del Tenant.
 */
import api from './axios';
import type { Tenant, LicenseType } from '../types/tenant';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Adds `days` calendar days to `from` (defaults to now) and returns ISO string. */
function addDays(days: number, from: Date = new Date()): string {
    const d = new Date(from);
    d.setDate(d.getDate() + days);
    return d.toISOString();
}

/**
 * Returns the date that is `days` after the later of (today, currentExpiry).
 * Used to stack renewals on top of an existing unexpired subscription.
 */
function extendFrom(days: number, currentExpiry: string | null): string {
    const base = currentExpiry ? new Date(Math.max(Date.now(), new Date(currentExpiry).getTime())) : new Date();
    return addDays(days, base);
}

// ─── patch helper ────────────────────────────────────────────────────────────

async function patchTenant(tenantId: number, payload: Record<string, unknown>): Promise<Tenant> {
    const response = await api.patch<Tenant>(`/admin/tenants/${tenantId}`, payload);
    return response.data;
}

// ─── public API ─────────────────────────────────────────────────────────────

/** Grant a trial period of `days` days (replaces current trial). */
export async function grantTrial(tenantId: number, days: number): Promise<Tenant> {
    return patchTenant(tenantId, {
        license_type: 'trial' as LicenseType,
        trial_days: days,
        trial_ends_at: addDays(days),
        is_active: true,
        license_blocked_reason: null,
    });
}

/** Extend monthly subscription by 30 days, stacking on top of current expiry. */
export async function extendMonthly(tenantId: number, currentExpiry: string | null): Promise<Tenant> {
    return patchTenant(tenantId, {
        license_type: 'monthly' as LicenseType,
        subscription_expires_at: extendFrom(30, currentExpiry),
        is_active: true,
        license_blocked_reason: null,
    });
}

/** Extend annual subscription by 365 days, stacking on top of current expiry. */
export async function extendAnnual(tenantId: number, currentExpiry: string | null): Promise<Tenant> {
    return patchTenant(tenantId, {
        license_type: 'annual' as LicenseType,
        subscription_expires_at: extendFrom(365, currentExpiry),
        is_active: true,
        license_blocked_reason: null,
    });
}

/** Grant lifetime license (no expiry). */
export async function grantLifetime(tenantId: number): Promise<Tenant> {
    return patchTenant(tenantId, {
        license_type: 'lifetime' as LicenseType,
        subscription_expires_at: null,
        is_active: true,
        license_blocked_reason: null,
    });
}

/** Manually suspend (block) a tenant. */
export async function revokeLicense(tenantId: number): Promise<Tenant> {
    return patchTenant(tenantId, {
        is_active: false,
        license_blocked_reason: 'manual',
    });
}

/** Reactivate a previously suspended tenant. */
export async function reactivateLicense(tenantId: number): Promise<Tenant> {
    return patchTenant(tenantId, {
        is_active: true,
        license_blocked_reason: null,
    });
}

// ─── Desktop Device / License Management ────────────────────────────────────

export interface DesktopDevice {
    id: number;
    tenant_id: number;
    license_key: string;
    plan_name: string;
    device_id: string | null;
    device_label: string | null;
    activated_at: string | null;
    last_seen_at: string | null;
    expires_at: string | null;
    created_at: string;
    is_active: boolean;
    is_revoked: boolean;
    revoked_reason: string | null;
    revoked_at: string | null;
    activations_count: number;
    max_activations: number;
    notes: string | null;
}

/** List all desktop licenses for a given tenant. */
export async function getTenantDevices(tenantId: number): Promise<DesktopDevice[]> {
    const response = await api.get<DesktopDevice[]>('/admin/desktop-licenses/', {
        params: { tenant_id: tenantId },
    });
    return response.data;
}

/** Revoke a desktop license by its ID. */
export async function revokeDevice(licenseId: number, reason = 'manual'): Promise<DesktopDevice> {
    const response = await api.patch<DesktopDevice>(
        `/admin/desktop-licenses/${licenseId}/revoke`,
        { reason },
    );
    return response.data;
}

/** Reactivate a previously revoked desktop license. */
export async function reactivateDevice(licenseId: number): Promise<DesktopDevice> {
    const response = await api.patch<DesktopDevice>(
        `/admin/desktop-licenses/${licenseId}/reactivate`,
    );
    return response.data;
}
