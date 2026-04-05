/**
 * Organizations.tsx
 * Página principal del módulo Multi-Empresa en el panel SaaS admin.
 *
 * Permite:
 *  - Ver todas las organizaciones (grupos empresariales)
 *  - Crear una nueva organización
 *  - Acceder al detalle de cada organización para gestionar empresas y miembros
 */

import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, Plus, Search, RefreshCw,
  CheckCircle2, XCircle, Layers,
  TrendingUp, MessageCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getOrganizations, createOrganization } from '../api/organizations';
import type { Organization, CreateOrgDTO } from '../api/organizations';
import { getTenants } from '../api/tenants';
import type { Tenant } from '../types/tenant';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PLAN_META: Record<string, { label: string; color: string; icon: string; maxDesc: string }> = {
  duo       : { label: 'Dúo',        color: 'bg-blue-50 text-blue-700 border-blue-200',     icon: '🤝', maxDesc: 'Hasta 2 empresas' },
  multi     : { label: 'Multi',      color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: '🏢', maxDesc: 'Hasta 5 empresas' },
  enterprise: { label: 'Enterprise', color: 'bg-amber-50 text-amber-700 border-amber-200',   icon: '👑', maxDesc: 'Ilimitadas'       },
};

function PlanBadge({ plan }: { plan: string }) {
  const m = PLAN_META[plan] ?? { label: plan, color: 'bg-slate-50 text-slate-600 border-slate-200', icon: '📦', maxDesc: '' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${m.color}`}>
      {m.icon} {m.label}
    </span>
  );
}

// ─── Modal Crear Organización ─────────────────────────────────────────────────

interface CreateOrgModalProps {
  tenants  : Tenant[];
  onClose  : () => void;
  onCreated: (org: Organization) => void;
}

const CreateOrgModal: React.FC<CreateOrgModalProps> = ({ onClose, onCreated }) => {
  const [form, setForm] = useState<CreateOrgDTO & { owner_password: string }>({
    name          : '',
    owner_email   : '',
    owner_name    : '',
    owner_password: '',
    plan          : 'multi',
    max_tenants   : 5,
    plan_price    : 0,
    plan_notes    : '',
    primary_color : '#4F46E5',
  });
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Cuando cambia el plan, actualizar max_tenants automáticamente
  const handlePlanChange = (plan: CreateOrgDTO['plan']) => {
    const maxMap: Record<string, number> = { duo: 2, multi: 5, enterprise: 999 };
    setForm(prev => ({ ...prev, plan, max_tenants: maxMap[plan] ?? 5 }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim())                 e.name         = 'El nombre es obligatorio';
    if (!form.owner_email.trim())          e.owner_email  = 'El email es obligatorio';
    if (!/\S+@\S+\.\S+/.test(form.owner_email)) e.owner_email = 'Email inválido';
    if (!form.owner_password.trim())          e.owner_password = 'La contraseña es obligatoria';
    if (form.owner_password.trim().length < 8) e.owner_password = 'Mínimo 8 caracteres';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const org = await createOrganization(form);
      toast.success(`✅ Organización "${org.name}" creada`);
      onCreated(org);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Error al crear la organización');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">

        {/* Header */}
        <div className="flex items-center gap-3 p-6 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Layers className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Nueva Organización</h2>
            <p className="text-xs text-slate-400">Crea un grupo empresarial multi-empresa</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">

          {/* Nombre */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">
              Nombre del grupo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Ej: Grupo Empresarial Rodríguez"
              className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-colors
                ${errors.name ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-indigo-400'}`}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Email dueño */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">
              Email del dueño <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={form.owner_email}
              onChange={e => setForm(p => ({ ...p, owner_email: e.target.value }))}
              placeholder="admin@empresa.com"
              className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-colors
                ${errors.owner_email ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-indigo-400'}`}
            />
            {errors.owner_email && <p className="text-red-500 text-xs mt-1">{errors.owner_email}</p>}
            <p className="text-xs text-slate-400 mt-1">
              Este usuario verá el selector de empresas al iniciar sesión.
            </p>
          </div>

          {/* Contraseña del dueño */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">
              Contraseña de acceso <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={form.owner_password}
                onChange={e => setForm(p => ({ ...p, owner_password: e.target.value }))}
                placeholder="Mínimo 8 caracteres"
                className={`w-full px-3 py-2.5 pr-16 rounded-xl border text-sm outline-none transition-colors
                  ${errors.owner_password ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-indigo-400'}`}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600"
              >
                {showPass ? 'Ocultar' : 'Ver'}
              </button>
            </div>
            {errors.owner_password && <p className="text-red-500 text-xs mt-1">{errors.owner_password}</p>}
            <p className="text-xs text-slate-400 mt-1">
              El dueño usará esta contraseña para ingresar a las empresas de la organización.
            </p>
          </div>

          {/* Nombre dueño */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Nombre del dueño</label>
            <input
              type="text"
              value={form.owner_name ?? ''}
              onChange={e => setForm(p => ({ ...p, owner_name: e.target.value }))}
              placeholder="Gabriel Rodríguez"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 text-sm outline-none"
            />
          </div>

          {/* Plan */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">Plan</label>
            <div className="grid grid-cols-3 gap-2">
              {(['duo','multi','enterprise'] as const).map(p => {
                const m = PLAN_META[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePlanChange(p)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-xs font-bold transition-all
                      ${form.plan === p
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}
                  >
                    <span className="text-lg">{m.icon}</span>
                    <span>{m.label}</span>
                    <span className="font-normal text-[10px] text-slate-400">{m.maxDesc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Precio */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Precio mensual (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input
                type="number" min="0" step="0.01"
                value={form.plan_price ?? 0}
                onChange={e => setForm(p => ({ ...p, plan_price: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 text-sm outline-none"
              />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Notas internas</label>
            <textarea
              value={form.plan_notes ?? ''}
              onChange={e => setForm(p => ({ ...p, plan_notes: e.target.value }))}
              placeholder="Ej: Cliente VIP, acordó plan especial..."
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 text-sm outline-none resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-slate-100">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {saving ? 'Creando...' : 'Crear organización'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Tarjeta de organización ──────────────────────────────────────────────────

interface OrgCardProps {
  org: Organization;
}

const OrgCard: React.FC<OrgCardProps> = ({ org }) => {
  const usagePct = org.max_tenants > 0
    ? Math.min(100, Math.round((org.tenant_count / org.max_tenants) * 100))
    : 0;

  return (
    <Link
      to={`/dashboard/organizations/${org.id}`}
      className="block bg-white border border-slate-200 rounded-2xl hover:border-indigo-300 hover:shadow-md transition-all group"
    >
      <div className="p-5">
        {/* Header de la tarjeta */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-sm"
              style={{ backgroundColor: org.primary_color || '#4F46E5' }}
            >
              {org.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-800 truncate max-w-[180px] group-hover:text-indigo-700 transition-colors">
                {org.name}
              </h3>
              <p className="text-xs text-slate-400 font-mono truncate">{org.slug}</p>
            </div>
          </div>
          {/* Estado */}
          {org.is_active
            ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            : <XCircle     className="w-4 h-4 text-red-400 shrink-0" />
          }
        </div>

        {/* Plan badge + whatsapp */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <PlanBadge plan={org.plan} />
          {org.use_shared_whatsapp && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
              <MessageCircle className="w-3 h-3" /> WA Compartido
            </span>
          )}
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-lg font-black text-slate-800">{org.tenant_count}</p>
            <p className="text-[10px] text-slate-400 font-semibold">Empresas</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-lg font-black text-slate-800">{org.member_count}</p>
            <p className="text-[10px] text-slate-400 font-semibold">Miembros</p>
          </div>
        </div>

        {/* Barra de uso */}
        <div>
          <div className="flex justify-between text-[10px] text-slate-400 mb-1.5">
            <span>Empresas usadas</span>
            <span>{org.tenant_count}/{org.max_tenants}</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${usagePct >= 90 ? 'bg-red-500' : usagePct >= 70 ? 'bg-amber-500' : 'bg-indigo-500'}`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
        </div>

        {/* Owner */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <span className="text-[9px] font-black text-indigo-600">
              {(org.owner_name || org.owner_email).charAt(0).toUpperCase()}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 truncate">{org.owner_email}</p>
          {org.plan_price > 0 && (
            <span className="ml-auto text-[11px] font-bold text-emerald-600 shrink-0">
              ${org.plan_price}/mes
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};

// ─── Stats header ─────────────────────────────────────────────────────────────

interface StatsProps {
  orgs: Organization[];
}

const OrgStats: React.FC<StatsProps> = ({ orgs }) => {
  const total    = orgs.length;
  const active   = orgs.filter(o => o.is_active).length;
  const revenue  = orgs.reduce((s, o) => s + (o.plan_price || 0), 0);
  const companies= orgs.reduce((s, o) => s + o.tenant_count, 0);

  const cards = [
    { label: 'Organizaciones',  value: total,              icon: Layers,    color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Activas',         value: active,             icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Empresas totales',value: companies,          icon: Building2, color: 'text-blue-600 bg-blue-50'    },
    { label: 'Ingreso mensual', value: `$${revenue.toFixed(0)}`, icon: TrendingUp, color: 'text-amber-600 bg-amber-50' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {cards.map(c => (
        <div key={c.label} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.color}`}>
            <c.icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-slate-800">{c.value}</p>
            <p className="text-xs text-slate-400 font-medium">{c.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Página principal ─────────────────────────────────────────────────────────

const Organizations: React.FC = () => {
  const [orgs, setOrgs]         = useState<Organization[]>([]);
  const [tenants, setTenants]   = useState<Tenant[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [orgsData, tenantsData] = await Promise.all([
        getOrganizations(),
        getTenants(),
      ]);
      setOrgs(orgsData);
      setTenants(tenantsData.tenants || []);
    } catch (err: any) {
      toast.error('Error al cargar las organizaciones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => orgs.filter(o => {
    const q = search.toLowerCase();
    const matchSearch = !q || o.name.toLowerCase().includes(q) || o.owner_email.toLowerCase().includes(q);
    const matchPlan   = !planFilter || o.plan === planFilter;
    return matchSearch && matchPlan;
  }), [orgs, search, planFilter]);

  const handleCreated = (org: Organization) => {
    setOrgs(prev => [org, ...prev]);
    setShowCreate(false);
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Layers className="w-6 h-6 text-indigo-600" />
            Organizaciones Multi-Empresa
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Gestiona grupos de empresas, sus planes y miembros con acceso compartido
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Nueva organización
        </button>
      </div>

      {/* Stats */}
      <OrgStats orgs={orgs} />

      {/* Filtros */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 transition-colors"
          />
        </div>
        <select
          value={planFilter}
          onChange={e => setPlanFilter(e.target.value)}
          className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 transition-colors"
        >
          <option value="">Todos los planes</option>
          <option value="duo">Dúo</option>
          <option value="multi">Multi</option>
          <option value="enterprise">Enterprise</option>
        </select>
        <button
          onClick={load}
          disabled={loading}
          className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
          title="Refrescar"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Layers className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="font-bold text-slate-600 mb-1">
            {search ? 'Sin resultados' : 'No hay organizaciones'}
          </h3>
          <p className="text-slate-400 text-sm mb-4">
            {search ? `No hay coincidencias para "${search}"` : 'Crea la primera organización multi-empresa'}
          </p>
          {!search && (
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Crear primera organización
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(org => <OrgCard key={org.id} org={org} />)}
        </div>
      )}

      {/* Modal crear */}
      {showCreate && (
        <CreateOrgModal
          tenants={tenants}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
};

export default Organizations;
