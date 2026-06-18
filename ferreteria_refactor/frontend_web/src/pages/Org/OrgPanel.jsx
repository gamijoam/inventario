/**
 * OrgPanel.jsx - Portal empresarial / owner console
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Building2, BarChart3, ArrowLeftRight, Package,
  ChevronRight, LogOut, ExternalLink, Store, Wifi,
  PackageSearch, ShieldCheck, Menu, X, MessageCircle
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
      { to: '/org/chat',         icon: MessageCircle,  label: 'Chat',         desc: 'Consultas y archivos' },
    ],
  },
  {
    title: 'Administracion',
    items: [
      { to: '/org/admin',        icon: ShieldCheck,    label: 'Admin',        desc: 'Permisos y ajustes' },
    ],
  },
];


const buildOrgWsUrl = (orgId) => {
  const token = localStorage.getItem('token');
  if (!token || !orgId) return null;
  const apiBase = apiClient.defaults.baseURL || `${window.location.origin}/api/v1`;
  const wsProtocol = apiBase.startsWith('https') ? 'wss:' : 'ws:';
  const cleanBase = apiBase.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const wsUrl = cleanBase.includes('/api/v1')
    ? `${wsProtocol}//${cleanBase}/ws`
    : `${wsProtocol}//${cleanBase}/api/v1/ws`;
  const sep = wsUrl.includes('?') ? '&' : '?';
  return `${wsUrl}${sep}tenant_id=${encodeURIComponent(`org:${orgId}`)}&token=${encodeURIComponent(token)}`;
};

function CompanyList({ companies, loading, switching, onEnter, compact = false }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />)}
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm font-semibold text-slate-400">
        No hay empresas cargadas.
      </div>
    );
  }

  return (
    <div className={compact ? 'grid gap-2 sm:grid-cols-2' : ''}>
      {companies.map(c => {
        const id = c.id || c.tenant_id;
        const active = c.is_active !== false;
        return (
          <button
            key={id || c.schema_name}
            onClick={() => active && onEnter(c)}
            disabled={!active || switching === id}
            title={active ? 'Entrar a la empresa' : 'Empresa suspendida'}
            className={`group mb-2 flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-all disabled:cursor-not-allowed ${active ? 'border-slate-100 bg-slate-50 hover:border-indigo-200 hover:bg-white hover:shadow-sm' : 'border-rose-100 bg-rose-50 opacity-80'}`}
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 transition-colors ${active ? 'text-indigo-600 ring-slate-200 group-hover:bg-indigo-600 group-hover:text-white' : 'text-rose-500 ring-rose-100'}`}>
              <Store size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-black text-slate-900">{c.name}</p>
                {!active && <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700">Suspendida</span>}
              </div>
              <p className="truncate text-[11px] font-semibold text-slate-400">{c.schema_name}</p>
            </div>
            {switching === id
              ? <Wifi size={15} className="shrink-0 animate-pulse text-indigo-500" />
              : <ExternalLink size={15} className={`shrink-0 transition-colors ${active ? 'text-slate-300 group-hover:text-indigo-500' : 'text-rose-300'}`} />
            }
          </button>
        );
      })}
    </div>
  );
}

export default function OrgPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const [org, setOrg] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [panelError, setPanelError] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [switching, setSwitching] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);
  const orgSocketRef = useRef(null);
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

  const fetchChatUnread = useCallback(async (targetOrgId = org?.id) => {
    if (!targetOrgId) return;
    try {
      const r = await apiClient.get(`/organizations/${targetOrgId}/chat/unread-count`, { _silentNetworkError: true, _silent403: true });
      setChatUnread(Number(r.data?.count || 0));
    } catch {
      setChatUnread(0);
    }
  }, [org?.id]);

  useEffect(() => {
    if (org?.id) fetchChatUnread(org.id);
  }, [org?.id, fetchChatUnread]);

  useEffect(() => {
    if (location.pathname.endsWith('/chat')) setChatUnread(0);
  }, [location.pathname]);

  useEffect(() => {
    const handleRead = (event) => {
      if (!org?.id || Number(event.detail?.orgId) !== Number(org.id)) return;
      setChatUnread(0);
    };
    window.addEventListener('org-chat-read', handleRead);
    return () => window.removeEventListener('org-chat-read', handleRead);
  }, [org?.id]);

  useEffect(() => {
    if (!org?.id) return undefined;
    const url = buildOrgWsUrl(org.id);
    if (!url) return undefined;
    const socket = new WebSocket(url);
    orgSocketRef.current = socket;
    socket.onmessage = (event) => {
      if (event.data === 'pong') return;
      try {
        const packet = JSON.parse(event.data);
        if (packet.type !== 'org_chat:message_created') return;
        if (location.pathname.endsWith('/chat')) {
          setChatUnread(0);
        } else {
          fetchChatUnread(org.id);
        }
      } catch {}
    };
    socket.onopen = () => {
      socket._pingTimer = window.setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send('ping');
      }, 30000);
    };
    return () => {
      if (socket._pingTimer) window.clearInterval(socket._pingTimer);
      try { socket.close(); } catch {}
    };
  }, [org?.id, location.pathname, fetchChatUnread]);

  useEffect(() => {
    let alive = true;
    const loadShell = async () => {
      setCompaniesLoading(true);
      setPanelError(null);
      try {
        const r = await apiClient.get('/organizations/my-org');
        if (!alive) return;
        if (r.data && r.data.length > 0) {
          const o = r.data[0];
          setOrg(o);
          const tenantsRes = await apiClient.get(`/organizations/${o.id}/tenants`);
          if (alive) setCompanies(tenantsRes.data || []);
        } else {
          setPanelError('No encontramos una organizacion vinculada a esta cuenta.');
        }
      } catch {
        try {
          const cached = JSON.parse(localStorage.getItem('org_companies') || '[]');
          if (alive && cached.length > 0) setCompanies(cached);
          if (alive) setPanelError('No se pudo refrescar el portal. Mostrando datos locales si existen.');
        } catch {
          if (alive) setPanelError('No se pudo cargar el portal empresarial.');
        }
      } finally {
        if (alive) setCompaniesLoading(false);
      }
    };
    loadShell();
    return () => { alive = false; };
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
    const isChat = item.to.endsWith('/chat');
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
        {isChat && chatUnread > 0 && (
          <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-black text-white">
            {chatUnread > 99 ? '99+' : chatUnread}
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
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 lg:hidden">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Empresas</p>
              <button onClick={() => navigate('/')} className="rounded-lg bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm ring-1 ring-slate-200">Ir al sistema</button>
            </div>
            <CompanyList
              companies={companies}
              loading={companiesLoading}
              switching={switching}
              onEnter={handleEnterCompany}
              compact
            />
          </div>
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
          {panelError && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
              {panelError}
            </div>
          )}
          <Outlet />
        </main>

        <aside className="hidden space-y-4 lg:sticky lg:top-[92px] lg:block lg:self-start">
          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Empresas</p>
              <h2 className="text-base font-black text-slate-950">Acceso rapido</h2>
            </div>
            <div className="max-h-[calc(100vh-210px)] overflow-y-auto p-2">
              <CompanyList
                companies={companies}
                loading={companiesLoading}
                switching={switching}
                onEnter={handleEnterCompany}
              />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
