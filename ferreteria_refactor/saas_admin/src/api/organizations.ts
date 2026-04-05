/**
 * organizations.ts
 * API client para gestión de organizaciones multi-empresa.
 * Conecta el panel admin SaaS con los endpoints /organizations del backend.
 */
import api from './axios';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface Organization {
  id                  : number;
  name                : string;
  slug                : string;
  owner_email         : string;
  owner_name          : string | null;
  plan                : 'duo' | 'multi' | 'enterprise';
  max_tenants         : number;
  is_active           : boolean;
  created_at          : string;
  logo_url            : string | null;
  primary_color       : string;
  use_shared_whatsapp : boolean;
  whatsapp_instance   : string | null;
  plan_expires_at     : string | null;
  plan_price          : number;
  plan_notes          : string | null;
  member_count        : number;
  tenant_count        : number;
}

export interface OrgMember {
  id              : number;
  user_email      : string;
  role            : 'owner' | 'manager' | 'viewer';
  can_switch      : boolean;
  invited_at      : string;
  accepted_at     : string | null;
}

export interface OrgTenant {
  id           : number;
  schema_name  : string;
  name         : string;
  is_active    : boolean;
  license_type : string | null;
  trial_ends_at: string | null;
}

export interface PlanInfo {
  organization_id    : number;
  organization_name  : string;
  plan               : string;
  plan_label         : string;
  plan_description   : string;
  max_tenants        : number;
  current_tenants    : number;
  slots_available    : number;
  plan_price         : number;
  plan_expires_at    : string | null;
  is_expired         : boolean;
  days_left          : number | null;
  use_shared_whatsapp: boolean;
  whatsapp_instance  : string | null;
  is_active          : boolean;
}

export interface CreateOrgDTO {
  name          : string;
  owner_email   : string;
  owner_name?   : string;
  plan          : 'duo' | 'multi' | 'enterprise';
  max_tenants   : number;
  primary_color?: string;
  plan_price?   : number;
  plan_notes?   : string;
}

export interface UpdatePlanDTO {
  plan           : string;
  max_tenants    : number;
  plan_price     : number;
  plan_notes?    : string;
  plan_expires_at?: string | null;
}

// ─── Llamadas API ─────────────────────────────────────────────────────────────

/** Listar todas las organizaciones */
export const getOrganizations = async (): Promise<Organization[]> => {
  const r = await api.get<Organization[]>('/organizations');
  return r.data;
};

/** Obtener detalle de una organización */
export const getOrganization = async (id: number): Promise<Organization> => {
  const r = await api.get<Organization>(`/organizations/${id}`);
  return r.data;
};

/** Crear una organización nueva */
export const createOrganization = async (data: CreateOrgDTO): Promise<Organization> => {
  const r = await api.post<Organization>('/organizations', data);
  return r.data;
};

/** Editar una organización */
export const updateOrganization = async (id: number, data: Partial<Organization>): Promise<Organization> => {
  const r = await api.patch<Organization>(`/organizations/${id}`, data);
  return r.data;
};

/** Obtener info del plan de una organización */
export const getOrgPlanInfo = async (id: number): Promise<PlanInfo> => {
  const r = await api.get<PlanInfo>(`/organizations/${id}/plan-info`);
  return r.data;
};

/** Actualizar el plan de una organización */
export const updateOrgPlan = async (id: number, data: UpdatePlanDTO): Promise<Organization> => {
  const r = await api.patch<Organization>(`/organizations/${id}/plan`, data);
  return r.data;
};

/** Listar tenants de una organización */
export const getOrgTenants = async (id: number): Promise<OrgTenant[]> => {
  const r = await api.get<OrgTenant[]>(`/organizations/${id}/tenants`);
  return r.data;
};

/** Agregar un tenant a una organización */
export const addTenantToOrg = async (orgId: number, tenantId: number): Promise<{ message: string }> => {
  const r = await api.post<{ message: string }>(`/organizations/${orgId}/tenants/${tenantId}`);
  return r.data;
};

/** Quitar un tenant de una organización */
export const removeTenantFromOrg = async (orgId: number, tenantId: number): Promise<void> => {
  await api.delete(`/organizations/${orgId}/tenants/${tenantId}`);
};

/** Listar miembros de una organización */
export const getOrgMembers = async (id: number): Promise<OrgMember[]> => {
  const r = await api.get<OrgMember[]>(`/organizations/${id}/members`);
  return r.data;
};

/** Agregar miembro a una organización */
export const addOrgMember = async (
  orgId: number,
  data: { user_email: string; role: string; can_switch: boolean }
): Promise<OrgMember> => {
  const r = await api.post<OrgMember>(`/organizations/${orgId}/members`, data);
  return r.data;
};

/** Eliminar miembro de una organización */
export const removeOrgMember = async (orgId: number, memberId: number): Promise<void> => {
  await api.delete(`/organizations/${orgId}/members/${memberId}`);
};

/** Configurar WhatsApp compartido */
export const updateOrgWhatsApp = async (
  orgId: number,
  data: { use_shared_whatsapp: boolean; whatsapp_instance?: string | null }
): Promise<Organization> => {
  const r = await api.patch<Organization>(`/organizations/${orgId}/whatsapp`, data);
  return r.data;
};
