import React, { useEffect, useState, useMemo } from 'react';
import { getActivity } from '../api/activity';
import type { TenantActivity, ActivitySummary } from '../api/activity';
import {
    Activity,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    Ghost,
    Search,
    Calendar,
    Download,
    ShoppingCart,
    Package,
    Users,
    DollarSign,
    ChevronDown,
    ChevronUp,
    ArrowUpDown,
} from 'lucide-react';
import toast from 'react-hot-toast';

type SortKey = 'name' | 'sales_count' | 'revenue_usd' | 'last_sale' | 'products_count' | 'customers_count' | 'last_login' | 'user_count' | 'activity_status';
type SortDir = 'asc' | 'desc';
type StatusFilter = 'all' | 'active' | 'low' | 'inactive' | 'abandoned';

const statusConfig = {
    active:    { label: 'Activo',          color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    low:       { label: 'Baja Actividad',  color: 'bg-amber-100 text-amber-700 border-amber-200',       dot: 'bg-amber-500'   },
    inactive:  { label: 'Inactivo',        color: 'bg-red-100 text-red-700 border-red-200',             dot: 'bg-red-500'     },
    abandoned: { label: 'Sin Uso',         color: 'bg-slate-100 text-slate-500 border-slate-200',       dot: 'bg-slate-400'   },
};

const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'activity_status', label: 'Por actividad' },
    { key: 'revenue_usd',     label: 'Por ingresos'  },
    { key: 'customers_count', label: 'Por clientes'  },
    { key: 'name',            label: 'Por nombre'    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const timeAgo = (iso: string | null): string => {
    if (!iso) return 'Nunca';
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Hoy';
    if (days === 1) return 'Ayer';
    if (days < 30)  return `hace ${days}d`;
    if (days < 365) return `hace ${Math.floor(days / 30)}m`;
    return `hace ${Math.floor(days / 365)}a`;
};

const initials = (name: string): string =>
    name
        .split(/\s+/)
        .slice(0, 2)
        .map(w => w[0])
        .join('')
        .toUpperCase();

// Deterministic pastel background from tenant name
const avatarBg = (name: string): string => {
    const palette = [
        'bg-emerald-500', 'bg-teal-500', 'bg-sky-500',
        'bg-violet-500',  'bg-rose-500', 'bg-amber-500',
        'bg-indigo-500',  'bg-pink-500', 'bg-cyan-500',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const SummaryCard = ({
    label, value, icon, color, onClick, active = false,
}: {
    label: string; value: number; icon: React.ReactNode;
    color: string; onClick?: () => void; active?: boolean;
}) => {
    const colorMap: Record<string, string> = {
        blue:    'bg-white text-blue-600   border-blue-200   hover:border-blue-400',
        emerald: 'bg-white text-emerald-600 border-emerald-200 hover:border-emerald-400',
        amber:   'bg-white text-amber-600  border-amber-200  hover:border-amber-400',
        red:     'bg-white text-red-600    border-red-200    hover:border-red-400',
        slate:   'bg-white text-slate-500  border-slate-200  hover:border-slate-400',
    };
    const activeRing: Record<string, string> = {
        blue:    'ring-2 ring-blue-400',
        emerald: 'ring-2 ring-emerald-400',
        amber:   'ring-2 ring-amber-400',
        red:     'ring-2 ring-red-400',
        slate:   'ring-2 ring-slate-400',
    };

    return (
        <div
            onClick={onClick}
            className={`rounded-2xl border p-4 shadow-sm transition-all duration-200 ${
                onClick ? 'cursor-pointer hover:shadow-md' : ''
            } ${active ? activeRing[color] ?? '' : ''} ${colorMap[color] ?? colorMap.slate}`}
        >
            <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-widest opacity-60">{label}</span>
                <span className="opacity-60">{icon}</span>
            </div>
            <p className="text-4xl font-black tracking-tight">{value}</p>
        </div>
    );
};

// Metric chip shown inline inside each tenant card
const MetricChip = ({
    icon, value, label, highlight = false,
}: {
    icon: React.ReactNode; value: string | number; label: string; highlight?: boolean;
}) => (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
        <span className={highlight ? 'text-emerald-500' : 'text-slate-400'}>{icon}</span>
        <div>
            <p className={`text-sm font-bold leading-none ${highlight ? 'text-emerald-600' : 'text-slate-800'}`}>{value}</p>
            <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wide">{label}</p>
        </div>
    </div>
);

// Individual expandable tenant card
const TenantCard = ({ tenant }: { tenant: TenantActivity }) => {
    const [expanded, setExpanded] = useState(false);
    const status = statusConfig[tenant.activity_status] ?? statusConfig.abandoned;

    const lastSaleLabel  = timeAgo(tenant.last_sale);
    const lastLoginLabel = timeAgo(tenant.last_login);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
            {/* Card header row */}
            <button
                onClick={() => setExpanded(prev => !prev)}
                className="w-full text-left px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 group"
                aria-expanded={expanded}
            >
                {/* Avatar */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black ${avatarBg(tenant.name)}`}>
                    {initials(tenant.name)}
                </div>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-800 text-base leading-tight truncate">{tenant.name}</span>
                        {tenant.is_demo && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-600 uppercase tracking-wide">Demo</span>
                        )}
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 uppercase tracking-wide">{tenant.license_type}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-1">
                        <span className="text-[11px] font-mono text-slate-400">{tenant.schema_name}</span>
                        <span className="text-[11px] text-slate-400">
                            Venta: <span className="font-semibold text-slate-600">{lastSaleLabel}</span>
                        </span>
                        <span className="text-[11px] text-slate-400">
                            Login: <span className="font-semibold text-slate-600">{lastLoginLabel}</span>
                        </span>
                    </div>
                </div>

                {/* Status badge */}
                <span className={`flex-shrink-0 inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${status.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                    {status.label}
                </span>

                {/* Expand chevron */}
                <span className="flex-shrink-0 text-slate-300 group-hover:text-emerald-500 transition-colors ml-1">
                    {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </span>
            </button>

            {/* Metric chips row */}
            <div className="px-5 pb-4 flex flex-wrap gap-2">
                <MetricChip
                    icon={<ShoppingCart size={15} />}
                    value={tenant.sales_count.toLocaleString()}
                    label="Ventas"
                />
                <MetricChip
                    icon={<DollarSign size={15} />}
                    value={`$${tenant.revenue_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    label="Ingresos"
                    highlight={tenant.revenue_usd > 0}
                />
                <MetricChip
                    icon={<Package size={15} />}
                    value={tenant.products_count.toLocaleString()}
                    label="Productos"
                />
                <MetricChip
                    icon={<Users size={15} />}
                    value={tenant.customers_count.toLocaleString()}
                    label="Clientes"
                />
            </div>

            {/* Expandable details */}
            {expanded && (
                <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Usuarios</p>
                            <p className="font-bold text-slate-700 text-base">{tenant.user_count}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Última Venta</p>
                            <p className="font-semibold text-slate-700">
                                {tenant.last_sale
                                    ? new Date(tenant.last_sale).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: '2-digit' })
                                    : <span className="text-slate-400 font-normal">Nunca</span>
                                }
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Último Login</p>
                            <p className="font-semibold text-slate-700">
                                {tenant.last_login
                                    ? new Date(tenant.last_login).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: '2-digit' })
                                    : <span className="text-slate-400 font-normal">Nunca</span>
                                }
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Miembro desde</p>
                            <p className="font-semibold text-slate-700">
                                {tenant.created_at
                                    ? new Date(tenant.created_at).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: '2-digit' })
                                    : <span className="text-slate-400 font-normal">—</span>
                                }
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const ActivityDashboard: React.FC = () => {
    const [tenants, setTenants]       = useState<TenantActivity[]>([]);
    const [summary, setSummary]       = useState<ActivitySummary | null>(null);
    const [isLoading, setIsLoading]   = useState(true);
    const [search, setSearch]         = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [sortKey, setSortKey]       = useState<SortKey>('revenue_usd');
    const [sortDir, setSortDir]       = useState<SortDir>('desc');

    const now          = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [dateFrom, setDateFrom] = useState(firstOfMonth.toISOString().split('T')[0]);
    const [dateTo,   setDateTo]   = useState(now.toISOString().split('T')[0]);

    const fetchActivity = async () => {
        setIsLoading(true);
        try {
            const data = await getActivity({ date_from: dateFrom, date_to: dateTo });
            setTenants(data.tenants);
            setSummary(data.summary);
        } catch (error) {
            toast.error('Error al cargar actividad de tenants');
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchActivity(); }, [dateFrom, dateTo]);

    const setPreset = (preset: string) => {
        const today = new Date();
        let from: Date;
        switch (preset) {
            case '7d':   from = new Date(today); from.setDate(from.getDate() - 7);    break;
            case '30d':  from = new Date(today); from.setDate(from.getDate() - 30);   break;
            case '90d':  from = new Date(today); from.setDate(from.getDate() - 90);   break;
            case 'year': from = new Date(today.getFullYear(), 0, 1);                   break;
            default:     from = new Date(today.getFullYear(), today.getMonth(), 1);    break;
        }
        setDateFrom(from.toISOString().split('T')[0]);
        setDateTo(today.toISOString().split('T')[0]);
    };

    const handleSortSelect = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('desc');
        }
    };

    const filtered = useMemo(() => {
        let result = [...tenants];

        if (search) {
            const q = search.toLowerCase();
            result = result.filter(t =>
                t.name.toLowerCase().includes(q) || t.schema_name.toLowerCase().includes(q)
            );
        }

        if (statusFilter !== 'all') {
            result = result.filter(t => t.activity_status === statusFilter);
        }

        result.sort((a, b) => {
            let valA: any = a[sortKey];
            let valB: any = b[sortKey];
            if (valA == null) valA = sortDir === 'asc' ? Infinity : -Infinity;
            if (valB == null) valB = sortDir === 'asc' ? Infinity : -Infinity;
            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            return sortDir === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
        });

        return result;
    }, [tenants, search, statusFilter, sortKey, sortDir]);

    const exportCSV = () => {
        const headers = ['Empresa', 'Schema', 'Estado', 'Ventas', 'Ingresos USD', 'Productos', 'Clientes', 'Usuarios', 'Ultima Venta', 'Ultimo Login', 'Licencia'];
        const rows = filtered.map(t => [
            t.name,
            t.schema_name,
            statusConfig[t.activity_status]?.label ?? t.activity_status,
            t.sales_count,
            t.revenue_usd.toFixed(2),
            t.products_count,
            t.customers_count,
            t.user_count,
            t.last_sale  ? new Date(t.last_sale).toLocaleDateString()  : 'Nunca',
            t.last_login ? new Date(t.last_login).toLocaleDateString() : 'Nunca',
            t.license_type,
        ]);
        const csv  = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `actividad_tenants_${dateFrom}_${dateTo}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('CSV exportado');
    };

    return (
        <div className="min-h-screen bg-white font-[Plus_Jakarta_Sans,sans-serif]">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">

                {/* ── Page header ── */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2.5 tracking-tight">
                            <span className="p-1.5 rounded-xl bg-emerald-500 text-white">
                                <Activity size={20} />
                            </span>
                            Monitor de Actividad
                        </h1>
                        <p className="text-sm text-slate-500 mt-1.5">Rendimiento y uso de cada empresa en tiempo real</p>
                    </div>
                    <button
                        onClick={exportCSV}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 active:scale-95 transition-all shadow-sm"
                    >
                        <Download size={15} /> Exportar CSV
                    </button>
                </div>

                {/* ── Summary cards ── */}
                {summary && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <SummaryCard label="Total"          value={summary.total}         icon={<Users size={18} />}         color="blue"    />
                        <SummaryCard label="Activos"        value={summary.active}        icon={<TrendingUp size={18} />}    color="emerald" onClick={() => setStatusFilter(statusFilter === 'active'    ? 'all' : 'active')}    active={statusFilter === 'active'}    />
                        <SummaryCard label="Baja Actividad" value={summary.low_activity}  icon={<AlertTriangle size={18} />} color="amber"   onClick={() => setStatusFilter(statusFilter === 'low'       ? 'all' : 'low')}       active={statusFilter === 'low'}       />
                        <SummaryCard label="Inactivos"      value={summary.inactive}      icon={<TrendingDown size={18} />}  color="red"     onClick={() => setStatusFilter(statusFilter === 'inactive'  ? 'all' : 'inactive')}  active={statusFilter === 'inactive'}  />
                        <SummaryCard label="Sin Uso"        value={summary.abandoned}     icon={<Ghost size={18} />}         color="slate"   onClick={() => setStatusFilter(statusFilter === 'abandoned' ? 'all' : 'abandoned')} active={statusFilter === 'abandoned'} />
                    </div>
                )}

                {/* ── Filters bar ── */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                        {/* Search */}
                        <div className="relative flex-1">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar empresa o schema..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-colors"
                            />
                        </div>

                        {/* Sort selector */}
                        <div className="relative">
                            <div className="flex items-center gap-2 px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 bg-white min-w-[170px]">
                                <ArrowUpDown size={14} className="text-slate-400 flex-shrink-0" />
                                <select
                                    value={sortKey}
                                    onChange={e => handleSortSelect(e.target.value as SortKey)}
                                    className="flex-1 bg-transparent outline-none cursor-pointer text-sm font-medium text-slate-700"
                                    aria-label="Criterio de ordenamiento"
                                >
                                    {sortOptions.map(o => (
                                        <option key={o.key} value={o.key}>{o.label}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                                    className="flex-shrink-0 text-slate-400 hover:text-emerald-500 transition-colors"
                                    title={sortDir === 'asc' ? 'Ascendente' : 'Descendente'}
                                >
                                    {sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
                        {/* Date range */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <Calendar size={14} className="text-slate-400 flex-shrink-0" />
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                            />
                            <span className="text-slate-400 text-xs font-medium">–</span>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                            />
                        </div>

                        {/* Quick presets */}
                        <div className="flex gap-1.5 flex-wrap">
                            {[
                                { key: '7d',   label: '7D'  },
                                { key: 'month', label: 'Mes' },
                                { key: '30d',  label: '30D' },
                                { key: '90d',  label: '90D' },
                                { key: 'year', label: 'Año' },
                            ].map(p => (
                                <button
                                    key={p.key}
                                    onClick={() => setPreset(p.key)}
                                    className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>

                        {/* Active status filter chip */}
                        {statusFilter !== 'all' && (
                            <button
                                onClick={() => setStatusFilter('all')}
                                className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${statusConfig[statusFilter].dot}`} />
                                {statusConfig[statusFilter].label}
                                <span className="ml-0.5 text-emerald-400 font-black">×</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Cards list ── */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-24 gap-3 text-slate-500">
                        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm font-medium">Recopilando datos de actividad…</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
                        <Ghost size={40} className="opacity-40" />
                        <p className="text-sm font-medium">No se encontraron empresas con los filtros seleccionados</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map(t => (
                            <TenantCard key={t.tenant_id} tenant={t} />
                        ))}
                    </div>
                )}

                {/* ── Footer count ── */}
                {!isLoading && (
                    <div className="flex justify-between items-center text-xs text-slate-400 px-1 pb-4">
                        <span>
                            Mostrando <span className="font-semibold text-slate-600">{filtered.length}</span> de {tenants.length} empresas
                            {statusFilter !== 'all' && ` · filtro: ${statusConfig[statusFilter].label}`}
                        </span>
                        <span>
                            {new Date(dateFrom).toLocaleDateString('es-VE')} – {new Date(dateTo).toLocaleDateString('es-VE')}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivityDashboard;
