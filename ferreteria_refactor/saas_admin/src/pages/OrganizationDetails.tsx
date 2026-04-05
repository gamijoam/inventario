/**
 * OrganizationDetails.tsx
 * Detalle completo de una organización multi-empresa.
 *
 * Tabs:
 *  - Empresas   : ver, agregar y quitar tenants del grupo
 *  - Miembros   : gestionar quién puede hacer switch entre empresas
 *  - Plan       : cambiar plan, precio y fecha de vencimiento
 *  - WhatsApp   : configurar instancia compartida de Baileys
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Building2, Users, Crown, MessageCircle,
  Plus, Trash2, RefreshCw, CheckCircle2, XCircle,
  Save, ChevronRight, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getOrganization, getOrgPlanInfo, getOrgTenants, getOrgMembers,
  addTenantToOrg, removeTenantFromOrg, addOrgMember, removeOrgMember,
  updateOrgPlan, updateOrganization, updateOrgWhatsApp,
} from '../api/organizations';
import type { Organization, OrgMember, OrgTenant, PlanInfo } from '../api/organizations';
import { getTenants } from '../api/tenants';
import type { Tenant } from '../types/tenant';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PLAN_OPTIONS = [
  { value: 'duo',        label: '🤝 Dúo',        max: 2   },
  { value: 'multi',      label: '🏢 Multi',       max: 5   },
  { value: 'enterprise', label: '👑 Enterprise',  max: 999 },
];

function TabBtn({ label, active, icon: Icon, onClick }: {
  label: string; active: boolean; icon: React.ElementType; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all
        ${active ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

// ─── Tab: Empresas ─────────────────────────────────────────────────────────────

interface TenantsTabProps {
  orgId   : number;
  org     : Organization;
  onRefresh: () => void;
}

const TenantsTab: React.FC<TenantsTabProps> = ({ orgId, org, onRefresh }) => {
  const [orgTenants, setOrgTenants]   = useState<OrgTenant[]>([]);
  const [allTenants, setAllTenants]   = useState<Tenant[]>([]);
  const [loading, setLoading]         = useState(true);
  const [addingId, setAddingId]       = useState<number | null>(null);
  const [removingId, setRemovingId]   = useState<number | null>(null);
  const [showSelector, setShowSelector] = useState(false);
  const [tenantSearch, setTenantSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ot, at] = await Promise.all([
        getOrgTenants(orgId),
        getTenants(),
      ]);
      setOrgTenants(ot);
      setAllTenants(at.tenants || []);
    } catch { toast.error('Error cargando empresas'); }
    finally  { setLoading(false); }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  // Tenants disponibles para agregar (no están ya en el grupo)
  const orgSchemas     = new Set(orgTenants.map(t => t.schema_name));
  const available      = allTenants.filter(t =>
    !orgSchemas.has(t.schema_name) && t.is_active &&
    (!tenantSearch || t.name.toLowerCase().includes(tenantSearch.toLowerCase()) ||
     t.schema_name.toLowerCase().includes(tenantSearch.toLowerCase()))
  );

  const handleAdd = async (tenantId: number) => {
    if (orgTenants.length >= org.max_tenants) {
      toast.error(`Límite del plan alcanzado (${org.max_tenants} empresas). Actualiza el plan.`);
      return;
    }
    setAddingId(tenantId);
    try {
      await addTenantToOrg(orgId, tenantId);
      toast.success('✅ Empresa agregada al grupo');
      setShowSelector(false);
      load();
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Error al agregar');
    } finally { setAddingId(null); }
  };

  const handleRemove = async (tenantId: number, name: string) => {
    if (!confirm(`¿Quitar "${name}" del grupo? El tenant seguirá existiendo, solo se desvincula.`)) return;
    setRemovingId(tenantId);
    try {
      await removeTenantFromOrg(orgId, tenantId);
      toast.success('Empresa removida del grupo');
      load();
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Error al remover');
    } finally { setRemovingId(null); }
  };

  const usagePct = org.max_tenants > 0
    ? Math.min(100, Math.round((orgTenants.length / org.max_tenants) * 100))
    : 0;

  return (
    <div className="space-y-5">

      {/* Barra de uso */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-semibold text-slate-700">Uso del plan</span>
          <span className={`font-bold ${usagePct >= 90 ? 'text-red-600' : 'text-slate-600'}`}>
            {orgTenants.length} / {org.max_tenants} empresas
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${usagePct >= 90 ? 'bg-red-500' : usagePct >= 70 ? 'bg-amber-500' : 'bg-indigo-500'}`}
            style={{ width: `${usagePct}%` }}
          />
        </div>
        {usagePct >= 90 && (
          <div className="flex items-center gap-2 mt-2 p-2 bg-red-50 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-xs text-red-600 font-semibold">Límite casi alcanzado. Considera actualizar el plan.</p>
          </div>
        )}
      </div>

      {/* Header de la sección */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-700">Empresas del grupo ({orgTenants.length})</h3>
        {orgTenants.length < org.max_tenants && (
          <button
            onClick={() => setShowSelector(s => !s)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar empresa
          </button>
        )}
      </div>

      {/* Selector de empresa para agregar */}
      {showSelector && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold text-slate-600">Selecciona una empresa para agregar al grupo:</p>
          <input
            type="text"
            value={tenantSearch}
            onChange={e => setTenantSearch(e.target.value)}
            placeholder="Buscar empresa..."
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400"
          />
          <div className="max-h-48 overflow-y-auto space-y-1.5">
            {available.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">
                {tenantSearch ? 'Sin resultados' : 'No hay más empresas disponibles para agregar'}
              </p>
            ) : available.map(t => (
              <button
                key={t.id}
                onClick={() => handleAdd(t.id)}
                disabled={addingId === t.id}
                className="w-full flex items-center justify-between p-3 bg-white border border-slate-200 hover:border-indigo-300 rounded-xl text-left transition-all disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                    <span className="text-xs font-black text-indigo-600">
                      {t.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{t.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{t.schema_name}</p>
                  </div>
                </div>
                {addingId === t.id
                  ? <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
                  : <Plus className="w-4 h-4 text-slate-400" />
                }
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lista de empresas del grupo */}
      {loading ? (
        <div className="flex justify-center py-8">
          <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
        </div>
      ) : orgTenants.length === 0 ? (
        <div className="text-center py-10 bg-white border border-slate-200 rounded-2xl">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold text-sm">Sin empresas en este grupo</p>
          <p className="text-slate-400 text-xs mt-1">Agrega la primera empresa usando el botón de arriba</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orgTenants.map(t => (
            <div
              key={t.id}
              className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl"
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                <span className="text-sm font-black text-indigo-600">
                  {t.name.charAt(0).toUpperCase()}
                </span>
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-slate-800 truncate">{t.name}</p>
                  {t.is_active
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  }
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <p className="text-xs text-slate-400 font-mono">{t.schema_name}</p>
                  {t.license_type && (
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      {t.license_type}
                    </span>
                  )}
                </div>
              </div>
              {/* Ver empresa */}
              <Link
                to={`/dashboard/tenants/${t.id}`}
                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="Ver detalle de empresa"
              >
                <ChevronRight className="w-4 h-4" />
              </Link>
              {/* Quitar */}
              <button
                onClick={() => handleRemove(t.id, t.name)}
                disabled={removingId === t.id}
                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                title="Quitar del grupo"
              >
                {removingId === t.id
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : <Trash2 className="w-4 h-4" />
                }
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Tab: Miembros ─────────────────────────────────────────────────────────────

const MembersTab: React.FC<{ orgId: number }> = ({ orgId }) => {
  const [members, setMembers]   = useState<OrgMember[]>([]);
  const [loading, setLoading]   = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole]   = useState<'owner'|'manager'|'viewer'>('manager');
  const [adding, setAdding]     = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setMembers(await getOrgMembers(orgId)); }
    catch { toast.error('Error cargando miembros'); }
    finally { setLoading(false); }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newEmail.trim() || !/\S+@\S+\.\S+/.test(newEmail)) {
      toast.error('Ingresa un email válido'); return;
    }
    setAdding(true);
    try {
      await addOrgMember(orgId, { user_email: newEmail.trim(), role: newRole, can_switch: true });
      toast.success('✅ Miembro agregado');
      setNewEmail('');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Error al agregar miembro');
    } finally { setAdding(false); }
  };

  const handleRemove = async (id: number, email: string) => {
    if (!confirm(`¿Quitar a "${email}" del grupo?`)) return;
    setRemovingId(id);
    try {
      await removeOrgMember(orgId, id);
      toast.success('Miembro eliminado');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Error al eliminar');
    } finally { setRemovingId(null); }
  };

  const ROLE_COLORS: Record<string, string> = {
    owner  : 'bg-amber-50 text-amber-700 border-amber-200',
    manager: 'bg-blue-50 text-blue-700 border-blue-200',
    viewer : 'bg-slate-50 text-slate-600 border-slate-200',
  };

  return (
    <div className="space-y-5">

      {/* Agregar miembro */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <h3 className="font-bold text-slate-700 mb-3 text-sm">Agregar miembro</h3>
        <div className="flex gap-2 flex-wrap">
          <input
            type="email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="email@empresa.com"
            className="flex-1 min-w-[200px] px-3 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 text-sm outline-none"
          />
          <select
            value={newRole}
            onChange={e => setNewRole(e.target.value as any)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 bg-white"
          >
            <option value="owner">Owner (dueño)</option>
            <option value="manager">Manager (gestor)</option>
            <option value="viewer">Viewer (solo lectura)</option>
          </select>
          <button
            onClick={handleAdd}
            disabled={adding}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-60"
          >
            {adding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Agregar
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          El miembro podrá cambiar entre empresas del grupo usando su email. El rol <strong>owner</strong> tiene control total.
        </p>
      </div>

      {/* Lista de miembros */}
      <h3 className="font-bold text-slate-700 text-sm">Miembros del grupo ({members.length})</h3>
      {loading ? (
        <div className="flex justify-center py-6"><RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" /></div>
      ) : members.length === 0 ? (
        <div className="text-center py-8 bg-white border border-slate-200 rounded-2xl">
          <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">Sin miembros</p>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-2xl">
              <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                <span className="text-xs font-black text-indigo-600">
                  {m.user_email.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700 truncate">{m.user_email}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ROLE_COLORS[m.role]}`}>
                    {m.role}
                  </span>
                  {m.can_switch && (
                    <span className="text-[10px] text-emerald-600 font-semibold">🔄 puede cambiar empresa</span>
                  )}
                </div>
              </div>
              {m.role !== 'owner' && (
                <button
                  onClick={() => handleRemove(m.id, m.user_email)}
                  disabled={removingId === m.id}
                  className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  {removingId === m.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Tab: Plan ────────────────────────────────────────────────────────────────

const PlanTab: React.FC<{ orgId: number; onRefresh: () => void }> = ({ orgId, onRefresh }) => {
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({
    plan          : 'multi',
    max_tenants   : 5,
    plan_price    : 0,
    plan_notes    : '',
    plan_expires_at: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const info = await getOrgPlanInfo(orgId);
        setPlanInfo(info);
        setForm({
          plan          : info.plan,
          max_tenants   : info.max_tenants,
          plan_price    : info.plan_price,
          plan_notes    : '',
          plan_expires_at: info.plan_expires_at
            ? info.plan_expires_at.substring(0, 10)
            : '',
        });
      } catch { toast.error('Error cargando plan'); }
      finally { setLoading(false); }
    })();
  }, [orgId]);

  const handlePlanChange = (plan: string) => {
    const maxMap: Record<string, number> = { duo: 2, multi: 5, enterprise: 999 };
    setForm(p => ({ ...p, plan, max_tenants: maxMap[plan] ?? 5 }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateOrgPlan(orgId, {
        plan          : form.plan,
        max_tenants   : form.max_tenants,
        plan_price    : form.plan_price,
        plan_notes    : form.plan_notes || undefined,
        plan_expires_at: form.plan_expires_at || null,
      });
      toast.success('✅ Plan actualizado');
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Error al guardar');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-8"><RefreshCw className="w-6 h-6 animate-spin text-indigo-400" /></div>;

  return (
    <div className="space-y-5">
      {/* Info actual */}
      {planInfo && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="font-bold text-slate-700 mb-4 text-sm">Estado actual del plan</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Plan',         value: planInfo.plan_label          },
              { label: 'Empresas',     value: `${planInfo.current_tenants}/${planInfo.max_tenants}` },
              { label: 'Precio',       value: planInfo.plan_price > 0 ? `$${planInfo.plan_price}/mes` : 'Sin costo' },
              { label: 'Vence',        value: planInfo.plan_expires_at
                  ? new Date(planInfo.plan_expires_at).toLocaleDateString('es-VE')
                  : 'Sin vencimiento' },
            ].map(s => (
              <div key={s.label} className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-400 font-medium mb-1">{s.label}</p>
                <p className={`font-black text-sm ${planInfo.is_expired && s.label === 'Vence' ? 'text-red-600' : 'text-slate-800'}`}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>
          {planInfo.is_expired && (
            <div className="flex items-center gap-2 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-700 font-semibold">
                El plan ha vencido. Actualiza la fecha de vencimiento para restaurar el acceso.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Formulario de edición */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <h3 className="font-bold text-slate-700 text-sm">Modificar plan</h3>

        {/* Selector de plan */}
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-2">Plan</label>
          <div className="grid grid-cols-3 gap-2">
            {PLAN_OPTIONS.map(p => (
              <button
                key={p.value}
                onClick={() => handlePlanChange(p.value)}
                className={`p-3 rounded-xl border-2 text-xs font-bold transition-all text-center
                  ${form.plan === p.value ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Precio */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Precio mensual (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input
                type="number" min="0" step="0.01"
                value={form.plan_price}
                onChange={e => setForm(p => ({ ...p, plan_price: parseFloat(e.target.value) || 0 }))}
                className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Fecha de vencimiento</label>
            <input
              type="date"
              value={form.plan_expires_at}
              onChange={e => setForm(p => ({ ...p, plan_expires_at: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400"
            />
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Notas internas</label>
          <textarea
            value={form.plan_notes}
            onChange={e => setForm(p => ({ ...p, plan_notes: e.target.value }))}
            placeholder="Notas sobre el plan, acuerdos especiales..."
            rows={2}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 resize-none"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-60"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Guardando...' : 'Guardar plan'}
        </button>
      </div>
    </div>
  );
};

// ─── Tab: WhatsApp ────────────────────────────────────────────────────────────

const WhatsAppTab: React.FC<{ orgId: number; org: Organization; onRefresh: () => void }> = ({ orgId, org, onRefresh }) => {
  const [enabled, setEnabled]     = useState(org.use_shared_whatsapp || false);
  const [instance, setInstance]   = useState(org.whatsapp_instance || '');
  const [saving, setSaving]       = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateOrgWhatsApp(orgId, {
        use_shared_whatsapp: enabled,
        whatsapp_instance  : enabled ? (instance || null) : null,
      });
      toast.success(enabled ? '✅ WhatsApp compartido activado' : 'WhatsApp compartido desactivado');
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Error al guardar');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <h3 className="font-bold text-slate-700 text-sm">Configuración de WhatsApp compartido</h3>

        {/* Toggle */}
        <div className="flex items-start justify-between gap-4 p-4 bg-slate-50 rounded-xl">
          <div>
            <p className="text-sm font-semibold text-slate-700">WhatsApp compartido</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Todas las empresas del grupo usarán la misma instancia de Baileys para enviar mensajes a clientes.
            </p>
          </div>
          <button
            onClick={() => setEnabled(v => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
          >
            <span
              className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
              style={{ left: enabled ? '22px' : '2px' }}
            />
          </button>
        </div>

        {/* Nombre de instancia */}
        {enabled && (
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Nombre de la instancia Baileys</label>
            <input
              type="text"
              value={instance}
              onChange={e => setInstance(e.target.value)}
              placeholder="ej: grupo-rodriguez"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 text-sm outline-none font-mono"
            />
            <p className="text-xs text-slate-400 mt-1">
              Debe coincidir exactamente con la instancia configurada en el servidor de WhatsApp.
            </p>
          </div>
        )}

        {/* Info */}
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
          <p className="text-xs text-blue-700">
            <strong>¿Cómo funciona?</strong> Cuando está activo, los mensajes de WhatsApp de ventas,
            taller y créditos se enviarán desde el número del grupo. Cada mensaje indicará
            el nombre de la empresa que lo originó para que el cliente sepa de cuál proviene.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors disabled:opacity-60"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Guardando...' : 'Guardar configuración de WhatsApp'}
        </button>
      </div>
    </div>
  );
};

// ─── Página principal ─────────────────────────────────────────────────────────

type Tab = 'tenants' | 'members' | 'plan' | 'whatsapp';

const OrganizationDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const orgId  = parseInt(id ?? '0');

  const [org, setOrg]       = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]       = useState<Tab>('tenants');

  const loadOrg = useCallback(async () => {
    try {
      const data = await getOrganization(orgId);
      setOrg(data);
    } catch { toast.error('Organización no encontrada'); }
    finally   { setLoading(false); }
  }, [orgId]);

  useEffect(() => { loadOrg(); }, [loadOrg]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
    </div>
  );

  if (!org) return (
    <div className="text-center py-20">
      <p className="text-slate-500 font-semibold">Organización no encontrada</p>
      <Link to="/dashboard/organizations" className="text-indigo-600 text-sm mt-2 inline-block">← Volver</Link>
    </div>
  );

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'tenants',   label: `Empresas (${org.tenant_count})`, icon: Building2        },
    { id: 'members',   label: `Miembros (${org.member_count})`, icon: Users            },
    { id: 'plan',      label: 'Plan',                           icon: Crown            },
    { id: 'whatsapp',  label: 'WhatsApp',                       icon: MessageCircle    },
  ];

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link to="/dashboard/organizations" className="text-slate-400 hover:text-slate-600 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Organizaciones
        </Link>
        <ChevronRight className="w-4 h-4 text-slate-300" />
        <span className="font-semibold text-slate-700">{org.name}</span>
      </div>

      {/* Header de la organización */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-sm"
              style={{ backgroundColor: org.primary_color || '#4F46E5' }}
            >
              {org.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">{org.name}</h1>
              <p className="text-sm text-slate-400 font-mono">{org.slug}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border
                  ${org.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  {org.is_active ? '✅ Activa' : '🔴 Inactiva'}
                </span>
                {org.plan_price > 0 && (
                  <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    ${org.plan_price}/mes
                  </span>
                )}
              </div>
            </div>
          </div>
          {/* Activar/desactivar */}
          <button
            onClick={async () => {
              try {
                await updateOrganization(orgId, { is_active: !org.is_active });
                toast.success(org.is_active ? 'Organización desactivada' : 'Organización activada');
                loadOrg();
              } catch { toast.error('Error al cambiar estado'); }
            }}
            className={`px-4 py-2 text-sm font-bold rounded-xl transition-colors
              ${org.is_active
                ? 'text-red-600 bg-red-50 hover:bg-red-100 border border-red-200'
                : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'}`}
          >
            {org.is_active ? 'Desactivar grupo' : 'Activar grupo'}
          </button>
        </div>

        {/* Info del owner */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-black text-indigo-600">
              {(org.owner_name || org.owner_email).charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-600">{org.owner_name || 'Sin nombre'}</p>
            <p className="text-xs text-slate-400">{org.owner_email}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {TABS.map(t => (
          <TabBtn
            key={t.id}
            label={t.label}
            active={tab === t.id}
            icon={t.icon}
            onClick={() => setTab(t.id)}
          />
        ))}
      </div>

      {/* Contenido del tab */}
      {tab === 'tenants'  && <TenantsTab  orgId={orgId} org={org} onRefresh={loadOrg} />}
      {tab === 'members'  && <MembersTab  orgId={orgId} />}
      {tab === 'plan'     && <PlanTab     orgId={orgId} onRefresh={loadOrg} />}
      {tab === 'whatsapp' && <WhatsAppTab orgId={orgId} org={org} onRefresh={loadOrg} />}
    </div>
  );
};

export default OrganizationDetails;
