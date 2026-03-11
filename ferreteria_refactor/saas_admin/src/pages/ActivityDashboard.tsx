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
    ArrowUpDown,
    ShoppingCart,
    Package,
    Users,
    DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';

type SortKey = 'name' | 'sales_count' | 'revenue_usd' | 'last_sale' | 'products_count' | 'customers_count' | 'last_login' | 'user_count' | 'activity_status';
type SortDir = 'asc' | 'desc';
type StatusFilter = 'all' | 'active' | 'low' | 'inactive' | 'abandoned';

const statusConfig = {
    active: { label: 'Activo', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    low: { label: 'Baja Actividad', color: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
    inactive: { label: 'Inactivo', color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
    abandoned: { label: 'Sin Uso', color: 'bg-slate-100 text-slate-500 border-slate-200', dot: 'bg-slate-400' },
};

const ActivityDashboard: React.FC = () => {
    const [tenants, setTenants] = useState<TenantActivity[]>([]);
    const [summary, setSummary] = useState<ActivitySummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [sortKey, setSortKey] = useState<SortKey>('revenue_usd');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    // Date range (default: current month)
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [dateFrom, setDateFrom] = useState(firstOfMonth.toISOString().split('T')[0]);
    const [dateTo, setDateTo] = useState(now.toISOString().split('T')[0]);

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

    useEffect(() => {
        fetchActivity();
    }, [dateFrom, dateTo]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
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

            // Handle nulls
            if (valA == null) valA = sortDir === 'asc' ? Infinity : -Infinity;
            if (valB == null) valB = sortDir === 'asc' ? Infinity : -Infinity;

            // String comparison
            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }

            // Numeric comparison
            return sortDir === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
        });

        return result;
    }, [tenants, search, statusFilter, sortKey, sortDir]);

    const exportCSV = () => {
        const headers = ['Empresa', 'Schema', 'Estado', 'Ventas', 'Ingresos USD', 'Productos', 'Clientes', 'Usuarios', 'Ultima Venta', 'Ultimo Login', 'Licencia'];
        const rows = filtered.map(t => [
            t.name,
            t.schema_name,
            statusConfig[t.activity_status]?.label || t.activity_status,
            t.sales_count,
            t.revenue_usd.toFixed(2),
            t.products_count,
            t.customers_count,
            t.user_count,
            t.last_sale ? new Date(t.last_sale).toLocaleDateString() : 'Nunca',
            t.last_login ? new Date(t.last_login).toLocaleDateString() : 'Nunca',
            t.license_type,
        ]);

        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `actividad_tenants_${dateFrom}_${dateTo}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('CSV exportado');
    };

    const formatDate = (iso: string | null) => {
        if (!iso) return <span className="text-slate-300 text-xs">Nunca</span>;
        return new Date(iso).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: '2-digit' });
    };

    const timeAgo = (iso: string | null) => {
        if (!iso) return '';
        const diff = Date.now() - new Date(iso).getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days === 0) return 'Hoy';
        if (days === 1) return 'Ayer';
        if (days < 30) return `hace ${days}d`;
        if (days < 365) return `hace ${Math.floor(days / 30)}m`;
        return `hace ${Math.floor(days / 365)}a`;
    };

    // Quick date presets
    const setPreset = (preset: string) => {
        const today = new Date();
        let from: Date;

        switch (preset) {
            case '7d':
                from = new Date(today);
                from.setDate(from.getDate() - 7);
                break;
            case '30d':
                from = new Date(today);
                from.setDate(from.getDate() - 30);
                break;
            case '90d':
                from = new Date(today);
                from.setDate(from.getDate() - 90);
                break;
            case 'year':
                from = new Date(today.getFullYear(), 0, 1);
                break;
            case 'month':
            default:
                from = new Date(today.getFullYear(), today.getMonth(), 1);
                break;
        }
        setDateFrom(from.toISOString().split('T')[0]);
        setDateTo(today.toISOString().split('T')[0]);
    };

    const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
        <th
            className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition-colors select-none"
            onClick={() => handleSort(field)}
        >
            <span className="flex items-center gap-1">
                {label}
                {sortKey === field && (
                    <ArrowUpDown size={12} className={sortDir === 'asc' ? 'rotate-180' : ''} />
                )}
            </span>
        </th>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Activity className="text-blue-600" size={28} /> Monitor de Actividad
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Rendimiento y uso de cada empresa en tiempo real</p>
                </div>
                <button
                    onClick={exportCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
                >
                    <Download size={16} /> Exportar CSV
                </button>
            </div>

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <SummaryCard label="Total" value={summary.total} icon={<Users size={20} />} color="blue" />
                    <SummaryCard label="Activos" value={summary.active} icon={<TrendingUp size={20} />} color="emerald" onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')} active={statusFilter === 'active'} />
                    <SummaryCard label="Baja Actividad" value={summary.low_activity} icon={<AlertTriangle size={20} />} color="amber" onClick={() => setStatusFilter(statusFilter === 'low' ? 'all' : 'low')} active={statusFilter === 'low'} />
                    <SummaryCard label="Inactivos" value={summary.inactive} icon={<TrendingDown size={20} />} color="red" onClick={() => setStatusFilter(statusFilter === 'inactive' ? 'all' : 'inactive')} active={statusFilter === 'inactive'} />
                    <SummaryCard label="Sin Uso" value={summary.abandoned} icon={<Ghost size={20} />} color="slate" onClick={() => setStatusFilter(statusFilter === 'abandoned' ? 'all' : 'abandoned')} active={statusFilter === 'abandoned'} />
                </div>
            )}

            {/* Filters Bar */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar empresa..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        />
                    </div>

                    {/* Date Range */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <Calendar size={16} className="text-slate-400" />
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        />
                        <span className="text-slate-400 text-xs">a</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        />
                    </div>

                    {/* Quick Presets */}
                    <div className="flex gap-1 flex-wrap">
                        {[
                            { key: '7d', label: '7D' },
                            { key: 'month', label: 'Mes' },
                            { key: '30d', label: '30D' },
                            { key: '90d', label: '90D' },
                            { key: 'year', label: 'Año' },
                        ].map(p => (
                            <button
                                key={p.key}
                                onClick={() => setPreset(p.key)}
                                className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {/* Status filter clear */}
                    {statusFilter !== 'all' && (
                        <button
                            onClick={() => setStatusFilter('all')}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                        >
                            Limpiar filtro: {statusConfig[statusFilter].label}
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-3 text-slate-500">Recopilando datos de actividad...</span>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <SortHeader label="Empresa" field="name" />
                                    <SortHeader label="Estado" field="activity_status" />
                                    <SortHeader label="Ventas" field="sales_count" />
                                    <SortHeader label="Ingresos $" field="revenue_usd" />
                                    <SortHeader label="Productos" field="products_count" />
                                    <SortHeader label="Clientes" field="customers_count" />
                                    <SortHeader label="Usuarios" field="user_count" />
                                    <SortHeader label="Ult. Venta" field="last_sale" />
                                    <SortHeader label="Ult. Login" field="last_login" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="text-center py-12 text-slate-400">
                                            No se encontraron empresas con los filtros seleccionados
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map(t => {
                                        const status = statusConfig[t.activity_status] || statusConfig.abandoned;
                                        return (
                                            <tr key={t.tenant_id} className="hover:bg-slate-50/50 transition-colors">
                                                {/* Empresa */}
                                                <td className="px-3 py-3">
                                                    <div>
                                                        <span className="font-semibold text-slate-800 text-sm">{t.name}</span>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[11px] text-slate-400 font-mono">{t.schema_name}</span>
                                                            {t.is_demo && (
                                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 uppercase">Demo</span>
                                                            )}
                                                            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase">{t.license_type}</span>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Estado */}
                                                <td className="px-3 py-3">
                                                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-full border ${status.color}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`}></span>
                                                        {status.label}
                                                    </span>
                                                </td>

                                                {/* Ventas */}
                                                <td className="px-3 py-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <ShoppingCart size={14} className="text-slate-300" />
                                                        <span className={`text-sm font-bold ${t.sales_count > 0 ? 'text-slate-800' : 'text-slate-300'}`}>
                                                            {t.sales_count}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Ingresos */}
                                                <td className="px-3 py-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <DollarSign size={14} className="text-slate-300" />
                                                        <span className={`text-sm font-bold ${t.revenue_usd > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                                                            {t.revenue_usd > 0 ? t.revenue_usd.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Productos */}
                                                <td className="px-3 py-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <Package size={14} className="text-slate-300" />
                                                        <span className="text-sm text-slate-600">{t.products_count}</span>
                                                    </div>
                                                </td>

                                                {/* Clientes */}
                                                <td className="px-3 py-3">
                                                    <span className="text-sm text-slate-600">{t.customers_count}</span>
                                                </td>

                                                {/* Usuarios */}
                                                <td className="px-3 py-3">
                                                    <span className="text-sm text-slate-600">{t.user_count}</span>
                                                </td>

                                                {/* Ultima venta */}
                                                <td className="px-3 py-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs text-slate-600">{formatDate(t.last_sale)}</span>
                                                        {t.last_sale && (
                                                            <span className="text-[10px] text-slate-400">{timeAgo(t.last_sale)}</span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Ultimo login */}
                                                <td className="px-3 py-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs text-slate-600">{formatDate(t.last_login)}</span>
                                                        {t.last_login && (
                                                            <span className="text-[10px] text-slate-400">{timeAgo(t.last_login)}</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Footer with count */}
                {!isLoading && (
                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
                        <span>Mostrando {filtered.length} de {tenants.length} empresas</span>
                        <span>Rango: {new Date(dateFrom).toLocaleDateString('es-VE')} - {new Date(dateTo).toLocaleDateString('es-VE')}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

// Summary Card Component
const SummaryCard = ({
    label,
    value,
    icon,
    color,
    onClick,
    active = false,
}: {
    label: string;
    value: number;
    icon: React.ReactNode;
    color: string;
    onClick?: () => void;
    active?: boolean;
}) => {
    const colorMap: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-600 border-blue-200',
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
        amber: 'bg-amber-50 text-amber-600 border-amber-200',
        red: 'bg-red-50 text-red-600 border-red-200',
        slate: 'bg-slate-50 text-slate-500 border-slate-200',
    };

    return (
        <div
            onClick={onClick}
            className={`rounded-xl border p-4 transition-all ${
                onClick ? 'cursor-pointer hover:shadow-md' : ''
            } ${active ? 'ring-2 ring-blue-500 shadow-md' : ''} ${colorMap[color] || colorMap.slate}`}
        >
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider opacity-70">{label}</span>
                {icon}
            </div>
            <p className="text-3xl font-black mt-2">{value}</p>
        </div>
    );
};

export default ActivityDashboard;
