/**
 * OrgPanel.jsx — Centro empresarial
 * Layout contenedor con navegación lateral propia.
 * Rutas hijas: /org/dashboard | /org/transfers | /org/catalog | /org/admin
 */
import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Building2, BarChart3, ArrowLeftRight, Package,
  ChevronRight, LogOut, ExternalLink,
  Menu, X, Store, Wifi, PackageSearch, ShieldCheck
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';

const NAV_GROUPS = [
  {
    title: 'Operacion',
    items: [
      { to: '/org/dashboard',    icon: BarChart3,      label: 'Dashboard',    desc: 'Resumen consolidado' },
      { to: '/org/transfers',    icon: ArrowLeftRight, label: 'Traslados',    desc: 'Entre empresas' },
      { to: '/org/stock-search', icon: PackageSearch, label: 'Buscar stock', desc: 'En todo el grupo' },
      { to: '/org/catalog',      icon: Package,       label: 'Catalogo',     desc: 'Productos compartidos' },
    ],
  },
  {
    title: 'Administracion',
    items: [
      { to: '/org/admin',        icon: ShieldCheck,   label: 'Admin',        desc: 'Permisos y ajustes' },
    ],
  },
];

const NAV = NAV_GROUPS.flatMap(group => group.items);

export default function OrgPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const [org, setOrg] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
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


  useEffect(() => {
    // Cargar org del usuario actual (endpoint propio sin necesitar superadmin)
    apiClient.get('/organizations/my-org')
      .then(r => {
        if (r.data && r.data.length > 0) {
          const o = r.data[0];
          setOrg(o);
          // Cargar tenants de esa org
          return apiClient.get(`/organizations/${o.id}/tenants`);
        }
      })
      .then(r => { if (r?.data) setCompanies(r.data); })
      .catch(() => {
        // Fallback: usar org_companies del localStorage
        try {
          const cached = JSON.parse(localStorage.getItem('org_companies') || '[]');
          if (cached.length > 0) setCompanies(cached);
        } catch {}
      });
  }, []);

  // Poll de traslados pendientes recibidos (para badge en nav)
  useEffect(() => {
    let alive = true;
    const fetchPending = async () => {
      try {
        // Necesitamos saber nuestra empresa actual
        const hostname  = window.location.hostname;
        const subParts  = hostname.split('.');
        const subdomain = subParts.length >= 3 ? subParts[0] : null;
        const lsTenant  = localStorage.getItem('selected_tenant');
        const currentSchema = subdomain || lsTenant || '';
        if (!currentSchema) { if (alive) setPendingCount(0); return; }

        const r = await apiClient.get('/inter-transfers', { params: { status: 'PENDING' } });
        if (!alive) return;
        const list = Array.isArray(r.data) ? r.data : [];
        // Contar las que apuntan a NUESTRA empresa (incoming)
        const incoming = list.filter(t => {
          // Si tenemos companies, usamos el id; si no, fallback al schema name
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
      const r = await apiClient.post('/auth/switch-company', {
        target_schema: schema
      });
      // Guardar nuevo token si viene
      if (r.data?.access_token) {
        localStorage.setItem('access_token', r.data.access_token);
      }
      if (r.data?.org_companies) {
        localStorage.setItem('org_companies', JSON.stringify(r.data.org_companies));
        localStorage.setItem('has_multiple_companies', r.data.org_companies.length > 1 ? 'true' : 'false');
      }
      // Construir URL de QA correctamente
      const isQA = window.location.hostname.includes('.qa.');
      const switchUrl = isQA
        ? (r.data?.switch_url_qa || 'https://' + schema + '.qa.miinventariofacil.com/#/')
        : (r.data?.switch_url_prod || r.data?.switch_url || 'https://' + schema + '.miinventariofacil.com/#/');
      window.location.href = switchUrl;
    } catch (e) {
      const msg = e.response?.data?.detail || 'Error al cambiar de empresa';
      toast.error(msg);
    } finally {
      setSwitching(null);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className={`
        ${sidebarOpen ? 'w-64' : 'w-16'} 
        flex-shrink-0 bg-slate-900 text-white flex flex-col
        transition-all duration-200
      `}>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          {sidebarOpen && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <Building2 size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">
                  {org?.name || 'Mi Organización'}
                </p>
                <p className="text-[10px] text-slate-400">Centro empresarial</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 flex-shrink-0"
          >
            {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>

        {/* Nav principal */}
        <nav className="flex-1 py-3 space-y-1 px-2 overflow-y-auto">
          {navGroups.map(group => (
            <div key={group.title} className="space-y-1">
              {sidebarOpen && (
                <p className="text-[10px] font-bold text-slate-500 uppercase px-2 pb-1 pt-2 ">
                  {group.title}
                </p>
              )}
              {group.items.map(({ to, icon: Icon, label, desc }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => `
                    relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all
                    ${isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'}
                  `}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  {sidebarOpen && (
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-none">{label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{desc}</p>
                    </div>
                  )}
                  {to === '/org/transfers' && pendingCount > 0 && (
                    <span className={`${sidebarOpen ? 'ml-auto' : 'absolute -top-1 -right-1'} bg-rose-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center shadow-md`}>
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}

          {/* Empresas del grupo */}
          {sidebarOpen && companies.length > 0 && (
            <>
              <div className="pt-3 pb-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase px-2">
                  Empresas ({companies.length})
                </p>
              </div>
              {companies.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleEnterCompany(c)}
                  disabled={switching === c.id}
                  className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left
                    text-slate-300 hover:bg-slate-800 hover:text-white transition-all group"
                >
                  <div className="w-7 h-7 bg-slate-700 group-hover:bg-indigo-600 rounded-lg
                    flex items-center justify-center flex-shrink-0 transition-colors">
                    <Store size={13} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{c.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{c.schema_name}</p>
                  </div>
                  {switching === c.id
                    ? <Wifi size={12} className="text-indigo-400 animate-pulse flex-shrink-0" />
                    : <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
                  }
                </button>
              ))}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-slate-700 space-y-1">
          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2
              text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
          >
            <LogOut size={16} className="flex-shrink-0" />
            {sidebarOpen && <span className="text-xs font-medium">Volver al sistema</span>}
          </button>
        </div>
      </aside>

      {/* ── Contenido principal ──────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-6 py-3
          flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Building2 size={14} className="text-indigo-500" />
            <span>{org?.name || 'Organización'}</span>
            <ChevronRight size={14} />
            <span className="font-semibold text-slate-800 capitalize">
              {nav.find(n => location.pathname.startsWith(n.to))?.label || 'Panel'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full font-bold">
              {companies.length} empresa{companies.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Página activa */}
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
