/**
 * OrgPanel.jsx — Panel Multi-Empresa
 * Layout contenedor con navegación lateral propia.
 * Rutas hijas: /org/dashboard | /org/transfers | /org/catalog | /org/config | /org/members
 */
import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Building2, BarChart3, ArrowLeftRight, Package,
  Settings, Users, ChevronRight, LogOut, ExternalLink,
  Menu, X, Store, Wifi
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';

const NAV = [
  { to: '/org/dashboard',  icon: BarChart3,       label: 'Dashboard',    desc: 'Resumen consolidado' },
  { to: '/org/transfers',  icon: ArrowLeftRight,  label: 'Traslados',    desc: 'Entre empresas' },
  { to: '/org/catalog',    icon: Package,         label: 'Catálogo',     desc: 'Productos compartidos' },
  { to: '/org/members',    icon: Users,           label: 'Miembros',     desc: 'Equipo del grupo' },
  { to: '/org/config',     icon: Settings,        label: 'Configuración',desc: 'Ajustes del grupo' },
];

export default function OrgPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const [org, setOrg] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [switching, setSwitching] = useState(null);

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
                <p className="text-[10px] text-slate-400">Panel Multi-Empresa</p>
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
          {sidebarOpen && (
            <p className="text-[10px] font-bold text-slate-500 uppercase px-2 pb-1">
              Gestión
            </p>
          )}
          {NAV.map(({ to, icon: Icon, label, desc }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `
                flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all
                ${isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'}
              `}
            >
              <Icon size={18} className="flex-shrink-0" />
              {sidebarOpen && (
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-none">{label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{desc}</p>
                </div>
              )}
            </NavLink>
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
              {NAV.find(n => location.pathname.startsWith(n.to))?.label || 'Panel'}
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
