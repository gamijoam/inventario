import React, { useEffect, useState, useMemo } from 'react';
import { getActivity } from '../api/activity';
import type { TenantActivity, ActivitySummary } from '../api/activity';
import {
    Activity, TrendingUp, TrendingDown, AlertTriangle, Ghost,
    Search, Calendar, Download, ShoppingCart, Package,
    Users, DollarSign, ChevronDown, ChevronUp, ArrowUpDown,
    Clock, LogIn, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

type SortKey   = 'name' | 'sales_count' | 'revenue_usd' | 'last_sale' | 'products_count' | 'customers_count' | 'last_login' | 'user_count' | 'activity_status';
type SortDir   = 'asc' | 'desc';
type StatusFilter = 'all' | 'active' | 'low' | 'inactive' | 'abandoned';

const statusConfig = {
    active   : { label: 'Activo',         color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', ring: 'ring-emerald-400' },
    low      : { label: 'Baja Actividad', color: 'bg-amber-100  text-amber-700  border-amber-200',     dot: 'bg-amber-500',   ring: 'ring-amber-400'  },
    inactive : { label: 'Inactivo',       color: 'bg-red-100    text-red-700    border-red-200',       dot: 'bg-red-500',     ring: 'ring-red-400'    },
    abandoned: { label: 'Sin Uso',        color: 'bg-slate-100  text-slate-500  border-slate-200',     dot: 'bg-slate-400',   ring: 'ring-slate-300'  },
};

const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'revenue_usd',     label: 'Ingresos'   },
    { key: 'sales_count',     label: 'Ventas'     },
    { key: 'customers_count', label: 'Clientes'   },
    { key: 'activity_status', label: 'Actividad'  },
    { key: 'name',            label: 'Nombre'     },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const timeAgo = (iso: string | null): string => {
    if (!iso) return 'Nunca';
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0)  return 'Hoy';
    if (days === 1)  return 'Ayer';
    if (days < 30)   return `${days}d`;
    if (days < 365)  return `${Math.floor(days / 30)}m`;
    return `${Math.floor(days / 365)}a`;
};

const initials = (name: string): string =>
    name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

const avatarBg = (name: string): string => {
    const palette = [
        'bg-emerald-500','bg-teal-500','bg-sky-500',
        'bg-violet-500','bg-rose-500','bg-amber-500',
        'bg-indigo-500','bg-pink-500','bg-cyan-500',
    ];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return palette[Math.abs(h) % palette.length];
};

// ─── Summary pill (clickable para filtrar) ───────────────────────────────────
const SummaryPill = ({
    label, value, color, active, onClick, icon,
}: { label: string; value: number; color: string; active: boolean; onClick?: () => void; icon: React.ReactNode }) => {
    const base: Record<string, string> = {
        blue:    'bg-blue-50    border-blue-200    text-blue-700',
        emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
        amber:   'bg-amber-50   border-amber-200   text-amber-700',
        red:     'bg-red-50     border-red-200     text-red-700',
        slate:   'bg-slate-50   border-slate-200   text-slate-600',
    };
    const ring: Record<string, string> = {
        blue:'ring-blue-400', emerald:'ring-emerald-400',
        amber:'ring-amber-400', red:'ring-red-400', slate:'ring-slate-300',
    };
    return (
        <div
            onClick={onClick}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-150
                ${base[color] ?? base.slate}
                ${active ? `ring-2 ${ring[color] ?? 'ring-slate-300'} shadow-md` : 'hover:shadow-sm'}
                ${onClick ? 'cursor-pointer' : ''}`}
        >
            <span className="opacity-70">{icon}</span>
            <div>
                <p className="text-2xl font-black leading-none">{value}</p>
                <p className="text-[10px] uppercase tracking-widest font-bold mt-0.5 opacity-70">{label}</p>
            </div>
        </div>
    );
};

// ─── Tarjeta de tenant (GRID — más compacta y visual) ────────────────────────
const TenantCard = ({ tenant }: { tenant: TenantActivity }) => {
    const [expanded, setExpanded] = useState(false);
    const status = statusConfig[tenant.activity_status] ?? statusConfig.abandoned;

    return (
        <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md
            transition-all duration-200 overflow-hidden flex flex-col`}>

            {/* ─ Header ─ */}
            <div className="p-4 flex items-start gap-3">
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center
                    text-white text-sm font-black ${avatarBg(tenant.name)}`}>
                    {initials(tenant.name)}
                </div>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-800 text-sm leading-tight truncate max-w-[140px]">{tenant.name}</span>
                        {tenant.is_demo && (
                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-600 uppercase tracking-wide shrink-0">
                                Demo
                            </span>
                        )}
                    </div>
                    <p className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">{tenant.schema_name}</p>
                    <span className={`inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold
                        px-2 py-0.5 rounded-full border ${status.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                        {status.label}
                    </span>
                </div>

                {/* Expand */}
                <button
                    onClick={() => setExpanded(v => !v)}
                    className="text-slate-300 hover:text-indigo-500 transition-colors mt-1 shrink-0"
                >
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
            </div>

            {/* ─ Métricas principales ─ */}
            <div className="px-4 pb-3 grid grid-cols-2 gap-2">
                <div className="bg-slate-50 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-1.5">
                        <DollarSign size={12} className={tenant.revenue_usd > 0 ? 'text-emerald-500' : 'text-slate-300'} />
                        <span className={`text-sm font-black ${tenant.revenue_usd > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                            ${tenant.revenue_usd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                    </div>
                    <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">ingresos</p>
                </div>
                <div className="bg-slate-50 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-1.5">
                        <ShoppingCart size={12} className="text-slate-400" />
                        <span className="text-sm font-black text-slate-700">{tenant.sales_count}</span>
                    </div>
                    <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">ventas</p>
                </div>
                <div className="bg-slate-50 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-1.5">
                        <Users size={12} className="text-slate-400" />
                        <span className="text-sm font-black text-slate-700">{tenant.customers_count}</span>
                    </div>
                    <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">clientes</p>
                </div>
                <div className="bg-slate-50 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-1.5">
                        <Package size={12} className="text-slate-400" />
                        <span className="text-sm font-black text-slate-700">{tenant.products_count}</span>
                    </div>
                    <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">productos</p>
                </div>
            </div>

            {/* ─ Timestamps siempre visibles ─ */}
            <div className="px-4 pb-3 flex gap-3 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                    <Clock size={10} />
                    Venta: <span className="font-semibold text-slate-600 ml-0.5">{timeAgo(tenant.last_sale)}</span>
                </span>
                <span className="flex items-center gap-1">
                    <LogIn size={10} />
                    Login: <span className="font-semibold text-slate-600 ml-0.5">{timeAgo(tenant.last_login)}</span>
                </span>
            </div>

            {/* ─ Detalles expandibles ─ */}
            {expanded && (
                <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 space-y-2">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                        {[
                            { l: 'Usuarios',        v: tenant.user_count },
                            { l: 'Licencia',        v: tenant.license_type },
                            { l: 'Última venta',    v: tenant.last_sale  ? new Date(tenant.last_sale).toLocaleDateString('es-VE',{day:'2-digit',month:'short',year:'2-digit'}) : 'Nunca' },
                            { l: 'Último login',    v: tenant.last_login ? new Date(tenant.last_login).toLocaleDateString('es-VE',{day:'2-digit',month:'short',year:'2-digit'}) : 'Nunca' },
                            { l: 'Miembro desde',   v: tenant.created_at ? new Date(tenant.created_at).toLocaleDateString('es-VE',{day:'2-digit',month:'short',year:'2-digit'}) : '—' },
                            { l: 'Estado cuenta',   v: tenant.is_active ? '✅ Activo' : '❌ Inactivo' },
                        ].map(row => (
                            <div key={row.l}>
                                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">{row.l}</p>
                                <p className="font-semibold text-slate-700 mt-0.5">{row.v}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Página principal ─────────────────────────────────────────────────────────
const ActivityDashboard: React.FC = () => {
    const [tenants, setTenants]   = useState<TenantActivity[]>([]);
    const [summary, setSummary]   = useState<ActivitySummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch]     = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [sortKey, setSortKey]   = useState<SortKey>('revenue_usd');
    const [sortDir, setSortDir]   = useState<SortDir>('desc');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [dateFrom, setDateFrom] = useState(firstOfMonth.toISOString().split('T')[0]);
    const [dateTo,   setDateTo]   = useState(now.toISOString().split('T')[0]);

    const fetchActivity = async () => {
        setIsLoading(true);
        try {
            const data = await getActivity({ date_from: dateFrom, date_to: dateTo });
            setTenants(data.tenants ?? []);
            setSummary(data.summary ?? null);
        } catch (error: any) {
            const msg = error?.response?.data?.detail ?? 'Error al cargar actividad';
            toast.error(msg);
            console.error('[ActivityDashboard] Error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchActivity(); }, [dateFrom, dateTo]);

    const setPreset = (preset: string) => {
        const today = new Date();
        let from: Date;
        switch (preset) {
            case '7d':   from = new Date(today); from.setDate(from.getDate() - 7);  break;
            case '30d':  from = new Date(today); from.setDate(from.getDate() - 30); break;
            case '90d':  from = new Date(today); from.setDate(from.getDate() - 90); break;
            case 'year': from = new Date(today.getFullYear(), 0, 1);                break;
            default:     from = new Date(today.getFullYear(), today.getMonth(), 1); break;
        }
        setDateFrom(from.toISOString().split('T')[0]);
        setDateTo(today.toISOString().split('T')[0]);
    };

    const filtered = useMemo(() => {
        let r = [...tenants];
        if (search) {
            const q = search.toLowerCase();
            r = r.filter(t => t.name.toLowerCase().includes(q) || t.schema_name.toLowerCase().includes(q));
        }
        if (statusFilter !== 'all') r = r.filter(t => t.activity_status === statusFilter);
        r.sort((a, b) => {
            let va: any = a[sortKey], vb: any = b[sortKey];
            if (va == null) va = sortDir === 'asc' ? Infinity : -Infinity;
            if (vb == null) vb = sortDir === 'asc' ? Infinity : -Infinity;
            if (typeof va === 'string' && typeof vb === 'string')
                return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
            return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
        });
        return r;
    }, [tenants, search, statusFilter, sortKey, sortDir]);

    const exportCSV = () => {
        const headers = ['Empresa','Schema','Estado','Ventas','Ingresos','Productos','Clientes','Usuarios','Ultima Venta','Ultimo Login','Licencia'];
        const rows = filtered.map(t => [
            t.name, t.schema_name,
            statusConfig[t.activity_status]?.label ?? t.activity_status,
            t.sales_count, t.revenue_usd.toFixed(2), t.products_count,
            t.customers_count, t.user_count,
            t.last_sale  ? new Date(t.last_sale).toLocaleDateString()  : 'Nunca',
            t.last_login ? new Date(t.last_login).toLocaleDateString() : 'Nunca',
            t.license_type,
        ]);
        const csv  = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = `actividad_${dateFrom}_${dateTo}.csv`; a.click();
        URL.revokeObjectURL(url);
        toast.success('CSV exportado');
    };

    return (
        <div className="min-h-screen bg-slate-50 font-[Plus_Jakarta_Sans,sans-serif]">
            <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 space-y-6">

                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2.5 tracking-tight">
                            <span className="p-1.5 rounded-xl bg-emerald-500 text-white">
                                <Activity size={20} />
                            </span>
                            Monitor de Actividad
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            {summary ? `${summary.total} empresas · ${dateFrom} – ${dateTo}` : 'Cargando...'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={fetchActivity}
                            className="flex items-center gap-1.5 px-3 py-2 text-slate-500 hover:text-slate-700 hover:bg-white border border-slate-200 rounded-xl text-sm transition-all">
                            <RefreshCw size={14} /> Actualizar
                        </button>
                        <button onClick={exportCSV}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 transition-all shadow-sm">
                            <Download size={14} /> CSV
                        </button>
                    </div>
                </div>

                {/* ── Summary pills ── */}
                {summary && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        <SummaryPill label="Total"         value={summary.total}        color="blue"    icon={<Users size={18} />}         active={false} />
                        <SummaryPill label="Activos"       value={summary.active}       color="emerald" icon={<TrendingUp size={18} />}    active={statusFilter==='active'}    onClick={() => setStatusFilter(s => s==='active'    ? 'all' : 'active')}    />
                        <SummaryPill label="Baja actividad"value={summary.low_activity} color="amber"   icon={<AlertTriangle size={18} />} active={statusFilter==='low'}       onClick={() => setStatusFilter(s => s==='low'       ? 'all' : 'low')}       />
                        <SummaryPill label="Inactivos"     value={summary.inactive}     color="red"     icon={<TrendingDown size={18} />}  active={statusFilter==='inactive'}  onClick={() => setStatusFilter(s => s==='inactive'  ? 'all' : 'inactive')}  />
                        <SummaryPill label="Sin Uso"       value={summary.abandoned}    color="slate"   icon={<Ghost size={18} />}         active={statusFilter==='abandoned'} onClick={() => setStatusFilter(s => s==='abandoned' ? 'all' : 'abandoned')} />
                    </div>
                )}

                {/* ── Barra de filtros ── */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                        {/* Búsqueda */}
                        <div className="relative flex-1">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input type="text" placeholder="Buscar empresa o schema..."
                                value={search} onChange={e => setSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm
                                    focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none" />
                        </div>

                        {/* Ordenar */}
                        <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl bg-white min-w-[160px]">
                            <ArrowUpDown size={13} className="text-slate-400 shrink-0" />
                            <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}
                                className="flex-1 bg-transparent outline-none text-sm font-medium text-slate-700 cursor-pointer">
                                {sortOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                            </select>
                            <button onClick={() => setSortDir(d => d==='asc'?'desc':'asc')}
                                className="text-slate-400 hover:text-emerald-500 transition-colors shrink-0">
                                {sortDir==='asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                        </div>

                        {/* Vista grid / lista */}
                        <div className="flex rounded-xl border border-slate-200 overflow-hidden shrink-0">
                            {(['grid','list'] as const).map(v => (
                                <button key={v} onClick={() => setViewMode(v)}
                                    className={`px-3 py-2 text-xs font-bold transition-colors
                                        ${viewMode===v ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                                    {v==='grid' ? '⊞ Grid' : '☰ Lista'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Fechas + presets */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                            <Calendar size={13} className="text-slate-400 shrink-0" />
                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none" />
                            <span className="text-slate-400 text-xs">–</span>
                            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none" />
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                            {[{k:'7d',l:'7D'},{k:'month',l:'Mes'},{k:'30d',l:'30D'},{k:'90d',l:'90D'},{k:'year',l:'Año'}].map(p => (
                                <button key={p.k} onClick={() => setPreset(p.k)}
                                    className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200
                                        text-slate-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-colors">
                                    {p.l}
                                </button>
                            ))}
                        </div>
                        {statusFilter !== 'all' && (
                            <button onClick={() => setStatusFilter('all')}
                                className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full
                                    bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors">
                                <span className={`w-1.5 h-1.5 rounded-full ${statusConfig[statusFilter]?.dot ?? 'bg-slate-400'}`} />
                                {statusConfig[statusFilter]?.label ?? statusFilter}
                                <span className="ml-0.5 text-emerald-400 font-black">×</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Contenido ── */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-24 gap-3 text-slate-500">
                        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm font-medium">Recopilando datos de actividad…</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
                        <Ghost size={40} className="opacity-40" />
                        <p className="text-sm font-medium">No se encontraron empresas con los filtros actuales</p>
                    </div>
                ) : viewMode === 'grid' ? (
                    /* ── GRID de tarjetas ── */
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filtered.map(t => <TenantCard key={t.tenant_id} tenant={t} />)}
                    </div>
                ) : (
                    /* ── LISTA compacta ── */
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    {['Empresa','Estado','Ingresos','Ventas','Clientes','Última venta','Último login'].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(t => {
                                    const st = statusConfig[t.activity_status] ?? statusConfig.abandoned;
                                    return (
                                        <tr key={t.tenant_id} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black shrink-0 ${avatarBg(t.name)}`}>
                                                        {initials(t.name)}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-800 text-xs leading-tight">{t.name}</p>
                                                        <p className="text-[9px] font-mono text-slate-400">{t.schema_name}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.color}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                                                    {st.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`font-black text-sm ${t.revenue_usd > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                                                    ${t.revenue_usd.toLocaleString('en-US',{maximumFractionDigits:0})}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-bold text-slate-700">{t.sales_count}</td>
                                            <td className="px-4 py-3 font-bold text-slate-700">{t.customers_count}</td>
                                            <td className="px-4 py-3 text-slate-500 text-xs">{timeAgo(t.last_sale)}</td>
                                            <td className="px-4 py-3 text-slate-500 text-xs">{timeAgo(t.last_login)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ── Footer ── */}
                {!isLoading && (
                    <div className="flex justify-between items-center text-xs text-slate-400 px-1 pb-4">
                        <span>
                            <span className="font-semibold text-slate-600">{filtered.length}</span> de {tenants.length} empresas
                            {statusFilter !== 'all' && ` · ${statusConfig[statusFilter]?.label}`}
                        </span>
                        <span>{new Date(dateFrom).toLocaleDateString('es-VE')} – {new Date(dateTo).toLocaleDateString('es-VE')}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivityDashboard;
