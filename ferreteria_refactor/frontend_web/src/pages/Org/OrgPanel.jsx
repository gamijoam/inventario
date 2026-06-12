/**
 * OrgPanel.jsx - Portal empresarial / owner console
 */
import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Building2, BarChart3, ArrowLeftRight, Package,
  ChevronRight, LogOut, ExternalLink, Store, Wifi,
  PackageSearch, ShieldCheck, Menu, X
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import { cn } from '../../utils/cn';

const NAV_GROUPS = [
  {
    title: 'Operacion',
    items: [
      { to: '/org/dashboard',    icon: BarChart3,      label: 'Dashboard',    desc: 'Resumen consolidado' },
      { to: '/org/transfers',    icon: ArrowLeftRight, label: 'Traslados',    desc: 'Entre empresas' },
      { to: '/org/stock-search', icon: PackageSearch,  label: 'Buscar stock', desc: 'En todo el grupo' },
      { to: '/org/catalog',      icon: Package,        label: 'Catalogo',     desc: 'Productos compartidos' },
    ],
  },
  {
    title: 'Administracion',
    items: [
      { to: '/org/admin',        icon: ShieldCheck,    label: 'Admin',        desc: 'Permisos y ajustes' },
    ],
  },
];

export default function OrgPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const [org, setOrg] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [switching, setSwitching] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const basePath = location.pathname.startsWith('/owner') ? '/owner' : '/org';
  const navGroups = useMemo(() => NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.map(item => ({
      ...item,
      to: item.to.replace('/org', basePath),
    })),
  })), [basePath]);
  const nav = useMemo(() => navGroups.flatMap(group => group.items), [navGroups]);
  const activeItem = nav.find(n => location.pathname.startsWith(n.to)) || nav[0];

  useEffect(() => {
    apiClient.get('/organizations/my-org')
      .then(r => {
        if (r.data && r.data.length > 0) {
          const o = r.data[0];
          setOrg(o);
          return apiClient.get(`/organizations/${o.id}/tenants`);
        }
      })
      .then(r => { if (r?.data) setCompanies(r.data); })
      .catch(() => {
        try {
          const cached = JSON.parse(localStorage.getItem('org_companies') || '[]');
          if (cached.length > 0) setCompanies(cached);
        } catch {}
      });
  }, []);

  useEffect(() => {
    let alive = true;
    const fetchPending = async () => {
      try {
        const hostname  = window.location.hostname;
        const subParts  = hostname.split('.');
        const subdomain = subParts.length >= 3 ? subParts[0] : null;
        const lsTenant  = localStorage.getItem('selected_tenant');
        const currentSchema = subdomain || lsTenant || '';
        if (!currentSchema) { if (alive) setPendingCount(0); return; }

        const r = await apiClient.get('/inter-transfers', { params: { status: 'PENDING' } });
        if (!alive) return;
        const list = Array.isArray(r.data) ? r.data : [];
        const incoming = list.filter(t => {
          const company = companies.find(c => c.schema_name === currentSchema);
          if (company) return t.to_tenant_id === (company.id || company.tenant_id);
          return false;
        });
        setPendingCount(incoming.length);
      } catch { if (alive) setPendingCount(0); }
    };
    fetchPending();
    const iv = setInterval(fetchPending, 60000);
    return () => { alive = false; clearInterval(iv); };
  }, [companies]);

  const handleEnterCompany = async (company) => {
    const schema = company.schema_name;
    if (!schema) return toast.error('Empresa sin schema configurado');
    setSwitching(company.id || company.tenant_id);
    try {
      const r = await apiClient.post('/auth/switch-company', { target_schema: schema });
      if (r.data?.access_token) localStorage.setItem('access_token', r.data.access_token);
      if (r.data?.org_companies) {
        localStorage.setItem('org_companies', JSON.stringify(r.data.org_companies));
        localStorage.setItem('has_multiple_companies', r.data.org_companies.length > 1 ? 'true' : 'false');
      }
      const isQA = window.location.hostname.includes('.qa.');
      const switchUrl = isQA
        ? (r.data?.switch_url_qa || 'https://' + schema + '.qa.miinventariofacil.com/#/')
        : (r.data?.switch_url_prod || r.data?.switch_url || 'https://' + schema + '.miinventariofacil.com/#/');
      window.location.href = switchUrl;
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error al cambiar de empresa');
    } finally {
      setSwitching(null);
    }
  };

  const NavItem = ({ item }) => {
    const Icon = item.icon;
    const isTransfers = item.to.endsWith('/transfers');
    return (
      <NavLink
        to={item.to}
        onClick={() => setMobileNavOpen(false)}
        className={({ isActive }) => cn(
          'relative inline-flex min-h-[46px] items-center gap-2 rounded-lg border px-3 py-2 text-sm font-black transition-all',
          isActive
            ? 'border-indigo-200 bg-white text-indigo-700 shadow-sm shadow-indigo-100'
            : 'border-transparent text-slate-500 hover:border-slate-200 hover:bg-white hover:text-slate-900'
        )}
      >
        <Icon size={17} />
        <span>{item.label}</span>
        {isTransfers && pendingCount > 0 && (
          <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
            {pendingCount > 99 ? '99+' : pendingCount}
          </span>
        )}
      </NavLink>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex min-h-[76px] max-w-[1680px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-lg shadow-indigo-100">
              <Building2 size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-indigo-500">
                <span>Portal empresarial</span>
                <ChevronRight size={12} />
                <span className="truncate text-slate-400">{activeItem?.label || 'Panel'}</span>
              </div>
              <h1 className="truncate text-xl font-black tracking-tight text-slate-950">
                {org?.name || 'Mi Organizacion'}
              </h1>
            </div>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <span className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700">
              {companies.length} empresa{companies.length !== 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-600 transition-colors hover:bg-slate-50"
            >
              <LogOut size={16} /> Ir al sistema
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMobileNavOpen(v => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 lg:hidden"
          >
            {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <div className={cn('mx-auto max-w-[1680px] px-4 pb-3 sm:px-6 lg:block', mobileNavOpen ? 'block' : 'hidden')}>
          <nav className="flex flex-wrap gap-2 rounded-lg bg-slate-100 p-2">
            {nav.map(item => <NavItem key={item.to} item={item} />)}
          </nav>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1680px] gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0">
          <div className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{activeItem?.label}</p>
                <p className="text-sm font-semibold text-slate-500">{activeItem?.desc}</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-black text-slate-400">
                <ShieldCheck size={14} className="text-emerald-500" /> Acceso de dueno
              </div>
            </div>
          </div>
          <Outlet />
        </main>

        <aside className="space-y-4 lg:sticky lg:top-[92px] lg:self-start">
          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Empresas</p>
              <h2 className="text-base font-black text-slate-950">Acceso rapido</h2>
            </div>
            <div className="max-h-[calc(100vh-210px)] overflow-y-auto p-2">
              {companies.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm font-semibold text-slate-400">
                  No hay empresas cargadas.
                </div>
              )}
              {companies.map(c => (
                <button
                  key={c.id || c.tenant_id || c.schema_name}
                  onClick={() => handleEnterCompany(c)}
                  disabled={switching === (c.id || c.tenant_id)}
                  className="group mb-2 flex w-full items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-3 text-left transition-all hover:border-indigo-200 hover:bg-white hover:shadow-sm disabled:opacity-60"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                    <Store size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-900">{c.name}</p>
                    <p className="truncate text-[11px] font-semibold text-slate-400">{c.schema_name}</p>
                  </div>
                  {switching === (c.id || c.tenant_id)
                    ? <Wifi size={15} className="shrink-0 animate-pulse text-indigo-500" />
                    : <ExternalLink size={15} className="shrink-0 text-slate-300 transition-colors group-hover:text-indigo-500" />
                  }
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
