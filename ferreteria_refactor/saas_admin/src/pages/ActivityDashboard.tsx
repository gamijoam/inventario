import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { getActivity } from '../api/activity';
import type { TenantActivity, ActivitySummary } from '../api/activity';
import {
    Activity, TrendingUp, TrendingDown, AlertTriangle, Ghost,
    Search, Calendar, Download, ShoppingCart, Package, Users,
    DollarSign, ArrowUpDown, RefreshCw, ChevronDown, ChevronUp,
    Wifi, WifiOff, Clock, BarChart2,
} from 'lucide-react';
import toast from 'react-hot-toast';

type SortKey  = 'name' | 'sales_count' | 'revenue_usd' | 'last_sale' | 'products_count' | 'customers_count' | 'last_login' | 'user_count' | 'activity_status';
type SortDir   = 'asc' | 'desc';
type StatusFilter = 'all' | 'active' | 'low' | 'inactive' | 'abandoned';

const statusConfig = {
    active   : { label: 'Activo',         color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', ring: 'ring-emerald-200', bar: 'bg-emerald-500' },
    low      : { label: 'Baja Actividad', color: 'bg-amber-50  text-amber-700  border-amber-200',    dot: 'bg-amber-500',   ring: 'ring-amber-200',   bar: 'bg-amber-400'   },
    inactive : { label: 'Inactivo',       color: 'bg-red-50    text-red-700    border-red-200',      dot: 'bg-red-500',     ring: 'ring-red-200',     bar: 'bg-red-400'     },
    abandoned: { label: 'Sin Uso',        color: 'bg-slate-100 text-slate-500  border-slate-200',    dot: 'bg-slate-400',   ring: 'ring-slate-200',   bar: 'bg-slate-300'   },
} as const;

const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'revenue_usd',     label: 'Ingresos'    },
    { key: 'sales_count',     label: 'Ventas'      },
    { key: 'customers_count', label: 'Clientes'    },
    { key: 'activity_status', label: 'Actividad'   },
    { key: 'name',            label: 'Nombre'      },
    { key: 'last_sale',       label: 'Última venta'},
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const timeAgo = (iso: string | null): string => {
    if (!iso) return 'Nunca';
    const diff = Date.now() - new Date(iso).getTime();
    const h  = Math.floor(diff / 36e5);
    const d  = Math.floor(diff / 864e5);
    if (h < 1)   return 'Ahora';
    if (h < 24)  return `hace ${h}h`;
    if (d === 1) return 'Ayer';
    if (d < 30)  return `hace ${d}d`;
    if (d < 365) return `hace ${Math.floor(d/30)}m`;
    return `hace ${Math.floor(d/365)}a`;
};

const initials = (name: string) =>
    name.split(/\s+/).slice(0,2).map(w => w[0]).join('').toUpperCase();

const avatarBg = (name: string) => {
    const p = ['bg-emerald-500','bg-teal-500','bg-sky-500','bg-violet-500','bg-rose-500','bg-amber-500','bg-indigo-500','bg-pink-500','bg-cyan-500'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return p[Math.abs(h) % p.length];
};

const fmt = (n: number) => n.toLocaleString('es-VE');
const fmtUsd = (n: number) => `$${n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

// ─── KPI Card (summary) ───────────────────────────────────────────────────────
const KpiCard = ({ label, value, icon, color, onClick, active = false }:
    { label: string; value: number; icon: React.ReactNode; color: string; onClick?: () => void; active?: boolean }) => {
    const styles: Record<string, string> = {
        blue:    'text-blue-600    border-blue-200    hover:border-blue-400    bg-blue-50',
        emerald: 'text-emerald-600 border-emerald-200 hover:border-emerald-400 bg-emerald-50',
        amber:   'text-amber-600   border-amber-200   hover:border-amber-400   bg-amber-50',
        red:     'text-red-600     border-red-200     hover:border-red-400     bg-red-50',
        slate:   'text-slate-500   border-slate-200   hover:border-slate-300   bg-slate-50',
    };
    const rings: Record<string, string> = {
        blue: 'ring-2 ring-blue-400', emerald: 'ring-2 ring-emerald-400',
        amber: 'ring-2 ring-amber-400', red: 'ring-2 ring-red-400', slate: 'ring-2 ring-slate-400',
    };
    return (
        <button onClick={onClick} disabled={!onClick}
            className={`rounded-2xl border p-4 shadow-sm transition-all duration-200 text-left w-full
                ${onClick ? 'cursor-pointer hover:shadow-md active:scale-95' : 'cursor-default'}
                ${active ? rings[color] : ''} ${styles[color] ?? styles.slate}`}>
            <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-widest opacity-60">{label}</span>
                <span className="opacity-50">{icon}</span>
            </div>
            <p className="text-3xl font-black tracking-tight">{value}</p>
        </button>
    );
};

// ─── Tenant card (grid) ───────────────────────────────────────────────────────
const TenantCard = ({ tenant }: { tenant: TenantActivity }) => {
    const [open, setOpen] = useState(false);
    const st = statusConfig[tenant.activity_status] ?? statusConfig.abandoned;

    return (
        <div className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col ${open ? `ring-1 ${st.ring}` : 'border-slate-200'}`}>

            {/* ── Header ─────────────────────────────────── */}
            <div className="p-4 flex items-start gap-3">
                {/* Avatar */}
                <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black ${avatarBg(tenant.name)}`}>
                    {initials(tenant.name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm leading-tight truncate">{tenant.name}</p>
                    <p className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">{tenant.schema_name}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                            {st.label}
                        </span>
                        {tenant.is_demo && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-600 uppercase tracking-wide">Demo</span>
                        )}
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 uppercase">{tenant.license_type}</span>
                    </div>
                </div>
            </div>

            {/* ── Métricas principales ─────────────────── */}
            <div className="px-4 pb-3 grid grid-cols-2 gap-2">
                {[
                    { icon: <ShoppingCart size={12}/>, val: fmt(tenant.sales_count),      label: 'Ventas',    hi: tenant.sales_count > 0 },
                    { icon: <DollarSign  size={12}/>, val: fmtUsd(tenant.revenue_usd),   label: 'Ingresos',  hi: tenant.revenue_usd > 0 },
                    { icon: <Package     size={12}/>, val: fmt(tenant.products_count),    label: 'Productos', hi: false },
                    { icon: <Users       size={12}/>, val: fmt(tenant.customers_count),   label: 'Clientes',  hi: false },
                ].map(m => (
                    <div key={m.label} className="flex items-center gap-1.5 bg-slate-50 rounded-xl px-2.5 py-2">
                        <span className={m.hi ? 'text-emerald-500' : 'text-slate-400'}>{m.icon}</span>
                        <div>
                            <p className={`text-xs font-black leading-none ${m.hi ? 'text-emerald-700' : 'text-slate-700'}`}>{m.val}</p>
                            <p className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wide">{m.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Última actividad ─────────────────────── */}
            <div className="px-4 pb-3 flex items-center justify-between text-[10px] text-slate-400">
                <div className="flex items-center gap-1">
                    <ShoppingCart size={10}/>
                    <span>Venta: <span className="font-semibold text-slate-600">{timeAgo(tenant.last_sale)}</span></span>
                </div>
                <div className="flex items-center gap-1">
                    <Wifi size={10}/>
                    <span>Login: <span className="font-semibold text-slate-600">{timeAgo(tenant.last_login)}</span></span>
                </div>
            </div>

            {/* ── Expandir detalles ─────────────────────── */}
            <button onClick={() => setOpen(v=>!v)}
                className="mt-auto border-t border-slate-100 px-4 py-2 flex items-center justify-between text-[11px] text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
                <span className="font-semibold">{open ? 'Ocultar detalles' : 'Ver detalles'}</span>
                {open ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
            </button>

            {open && (
                <div className="bg-slate-50 border-t border-slate-100 px-4 py-3 grid grid-cols-2 gap-3 text-xs">
                    {[
                        { l: 'Usuarios',        v: fmt(tenant.user_count) },
                        { l: 'Miembro desde',   v: tenant.created_at ? new Date(tenant.created_at).toLocaleDateString('es-VE',{day:'2-digit',month:'short',year:'2-digit'}) : '—' },
                        { l: 'Última Venta',    v: tenant.last_sale    ? new Date(tenant.last_sale).toLocaleDateString('es-VE',{day:'2-digit',month:'short',year:'2-digit'}) : 'Nunca' },
                        { l: 'Último Login',    v: tenant.last_login   ? new Date(tenant.last_login).toLocaleDateString('es-VE',{day:'2-digit',month:'short',year:'2-digit'}) : 'Nunca' },
                    ].map(row => (
                        <div key={row.l}>
                            <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold mb-0.5">{row.l}</p>
                            <p className="font-bold text-slate-700">{row.v}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Main page ────────────────────────────────────────────────────────────────
const ActivityDashboard: React.FC = () => {
    const [tenants, setTenants]     = useState<TenantActivity[]>([]);
    const [summary, setSummary]     = useState<ActivitySummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError]         = useState<string | null>(null);
    const [search, setSearch]       = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [sortKey, setSortKey]     = useState<SortKey>('revenue_usd');
    const [sortDir, setSortDir]     = useState<SortDir>('desc');

    const now          = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [dateFrom, setDateFrom]   = useState(firstOfMonth.toISOString().split('T')[0]);
    const [dateTo,   setDateTo]     = useState(now.toISOString().split('T')[0]);

    const fetchActivity = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getActivity({ date_from: dateFrom, date_to: dateTo });
            // Soporta tanto { tenants, summary } como respuestas planas
            const list = Array.isArray(data)
                ? (data as unknown as TenantActivity[])
                : data.tenants ?? [];
            const sum  = !Array.isArray(data) ? data.summary : null;
            setTenants(list);
            if (sum) setSummary(sum);
        } catch (err: any) {
            const msg = err?.response?.data?.detail
                     ?? err?.message
                     ?? 'Error al conectar con el API';
            setError(msg);
            toast.error(msg, { duration: 4000 });
        } finally {
            setIsLoading(false);
        }
    }, [dateFrom, dateTo]);

    useEffect(() => { fetchActivity(); }, [fetchActivity]);

    const setPreset = (preset: string) => {
        const today = new Date();
        let from: Date;
        switch (preset) {
            case '7d':    from = new Date(today); from.setDate(from.getDate()-7);   break;
            case '30d':   from = new Date(today); from.setDate(from.getDate()-30);  break;
            case '90d':   from = new Date(today); from.setDate(from.getDate()-90);  break;
            case 'year':  from = new Date(today.getFullYear(),0,1);                 break;
            default:      from = new Date(today.getFullYear(),today.getMonth(),1);  break;
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
            let A: any = a[sortKey], B: any = b[sortKey];
            if (A == null) A = sortDir === 'asc' ? Infinity  : -Infinity;
            if (B == null) B = sortDir === 'asc' ? Infinity  : -Infinity;
            if (typeof A === 'string' && typeof B === 'string')
                return sortDir === 'asc' ? A.localeCompare(B) : B.localeCompare(A);
            return sortDir === 'asc' ? (A > B ? 1 : -1) : (A < B ? 1 : -1);
        });
        return r;
    }, [tenants, search, statusFilter, sortKey, sortDir]);

    const exportCSV = () => {
        const h = ['Empresa','Schema','Estado','Ventas','Ingresos USD','Productos','Clientes','Usuarios','Ultima Venta','Ultimo Login','Licencia'];
        const rows = filtered.map(t => [
            t.name, t.schema_name, statusConfig[t.activity_status]?.label ?? t.activity_status,
            t.sales_count, t.revenue_usd.toFixed(2), t.products_count, t.customers_count,
            t.user_count,
            t.last_sale    ? new Date(t.last_sale).toLocaleDateString()  : 'Nunca',
            t.last_login   ? new Date(t.last_login).toLocaleDateString() : 'Nunca',
            t.license_type,
        ]);
        const csv  = [h,...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
        const url  = URL.createObjectURL(blob);
        const a    = Object.assign(document.createElement('a'),{href:url,download:`actividad_${dateFrom}_${dateTo}.csv`});
        a.click(); URL.revokeObjectURL(url);
        toast.success('CSV exportado');
    };

    // ── Render ──────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-50 font-[Plus_Jakarta_Sans,sans-serif]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">

                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2.5 tracking-tight">
                            <span className="p-1.5 rounded-xl bg-emerald-500 text-white"><Activity size={20}/></span>
                            Monitor de Actividad
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">Rendimiento y uso de cada empresa en tiempo real</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={fetchActivity} disabled={isLoading}
                            className="flex items-center gap-2 px-3 py-2.5 border border-slate-200 bg-white text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 active:scale-95 transition-all shadow-sm disabled:opacity-50">
                            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''}/> Actualizar
                        </button>
                        <button onClick={exportCSV}
                            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 active:scale-95 transition-all shadow-sm">
                            <Download size={14}/> CSV
                        </button>
                    </div>
                </div>

                {/* ── Error state ─────────────────────────────────────────── */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <WifiOff size={18} className="text-red-500 shrink-0"/>
                            <div>
                                <p className="font-bold text-red-800 text-sm">Error al cargar actividad</p>
                                <p className="text-xs text-red-600 mt-0.5">{error}</p>
                            </div>
                        </div>
                        <button onClick={fetchActivity}
                            className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-colors shrink-0">
                            Reintentar
                        </button>
                    </div>
                )}

                {/* ── KPI Summary ──────────────────────────────────────────── */}
                {summary && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <KpiCard label="Total"          value={summary.total}        icon={<BarChart2 size={16}/>}     color="blue"    />
                        <KpiCard label="Activos"        value={summary.active}       icon={<TrendingUp size={16}/>}    color="emerald" onClick={() => setStatusFilter(s => s==='active'    ? 'all' : 'active')}    active={statusFilter==='active'}    />
                        <KpiCard label="Baja Actividad" value={summary.low_activity} icon={<AlertTriangle size={16}/>} color="amber"   onClick={() => setStatusFilter(s => s==='low'       ? 'all' : 'low')}       active={statusFilter==='low'}       />
                        <KpiCard label="Inactivos"      value={summary.inactive}     icon={<TrendingDown size={16}/>}  color="red"     onClick={() => setStatusFilter(s => s==='inactive'  ? 'all' : 'inactive')}  active={statusFilter==='inactive'}  />
                        <KpiCard label="Sin Uso"        value={summary.abandoned}    icon={<Ghost size={16}/>}         color="slate"   onClick={() => setStatusFilter(s => s==='abandoned' ? 'all' : 'abandoned')} active={statusFilter==='abandoned'} />
                    </div>
                )}

                {/* ── Filters ──────────────────────────────────────────────── */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                        {/* Search */}
                        <div className="relative flex-1">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                            <input type="text" placeholder="Buscar empresa o schema..."
                                value={search} onChange={e => setSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-colors"/>
                        </div>
                        {/* Sort */}
                        <div className="flex items-center gap-2 px-3 py-2.5 border border-slate-200 rounded-xl bg-white min-w-[180px]">
                            <ArrowUpDown size={13} className="text-slate-400 shrink-0"/>
                            <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}
                                className="flex-1 bg-transparent outline-none text-sm font-medium text-slate-700 cursor-pointer">
                                {sortOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                            </select>
                            <button onClick={() => setSortDir(d => d==='asc'?'desc':'asc')}
                                className="text-slate-400 hover:text-emerald-500 transition-colors shrink-0">
                                {sortDir==='asc' ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Calendar size={13} className="text-slate-400 shrink-0"/>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-emerald-500"/>
                        <span className="text-slate-400 text-xs">–</span>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-emerald-500"/>
                        <div className="flex gap-1.5 flex-wrap ml-1">
                            {[{k:'7d',l:'7D'},{k:'month',l:'Mes'},{k:'30d',l:'30D'},{k:'90d',l:'90D'},{k:'year',l:'Año'}].map(p => (
                                <button key={p.k} onClick={() => setPreset(p.k)}
                                    className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-colors">
                                    {p.l}
                                </button>
                            ))}
                        </div>
                        {statusFilter !== 'all' && (
                            <button onClick={() => setStatusFilter('all')}
                                className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors ml-auto">
                                <span className={`w-1.5 h-1.5 rounded-full ${statusConfig[statusFilter].dot}`}/>
                                {statusConfig[statusFilter].label}
                                <span className="text-emerald-400 font-black ml-0.5">×</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Grid de tenants ──────────────────────────────────────── */}
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-500">
                        <RefreshCw size={28} className="animate-spin text-emerald-500"/>
                        <p className="text-sm font-medium">Recopilando actividad de todas las empresas…</p>
                    </div>
                ) : !error && filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
                        <Ghost size={40} className="opacity-30"/>
                        <p className="text-sm font-medium">No se encontraron empresas</p>
                    </div>
                ) : !error ? (
                    // ── GRID 3 COLUMNAS ──────────────────────────────────────
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.map(t => <TenantCard key={t.tenant_id} tenant={t}/>)}
                    </div>
                ) : null}

                {/* ── Footer ──────────────────────────────────────────────── */}
                {!isLoading && !error && (
                    <div className="flex justify-between items-center text-xs text-slate-400 px-1 pb-2">
                        <span>
                            <span className="font-semibold text-slate-600">{filtered.length}</span> de {tenants.length} empresas
                            {statusFilter !== 'all' && ` · ${statusConfig[statusFilter].label}`}
                        </span>
                        <span className="flex items-center gap-1">
                            <Clock size={10}/>
                            {new Date(dateFrom).toLocaleDateString('es-VE')} – {new Date(dateTo).toLocaleDateString('es-VE')}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivityDashboard;
