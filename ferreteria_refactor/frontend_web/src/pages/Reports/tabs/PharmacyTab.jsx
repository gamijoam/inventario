import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Pill, Package, AlertTriangle, TrendingUp, DollarSign,
    Download, RefreshCw, ShoppingCart, FlaskConical, Shield
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer
} from 'recharts';
import { toast } from 'react-hot-toast';
import { getLots, getAlerts } from '../../../services/pharmacyService';
import apiClient from '../../../config/axios';

// ---------------------------------------------------------------------------
// Sub-tab definitions
// ---------------------------------------------------------------------------
const SUB_TABS = [
    { id: 'vencimientos', label: 'Vencimientos', icon: AlertTriangle },
    { id: 'ventas', label: 'Ventas por Clasificación', icon: ShoppingCart },
    { id: 'valoracion', label: 'Valoración Farmacéutica', icon: TrendingUp },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const formatUSD = (amount) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
    }).format(Number(amount) || 0);

const fmtNumber = (n) => new Intl.NumberFormat('es-VE').format(Number(n) || 0);

const today = () => new Date();
const daysDiff = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const now = today();
    now.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return Math.round((d - now) / (1000 * 60 * 60 * 24));
};

const expiryStatus = (days) => {
    if (days === null) return { label: 'Sin fecha', color: 'bg-slate-50 text-slate-500 border-slate-200', row: '' };
    if (days < 0) return { label: 'Vencido', color: 'bg-rose-100 text-rose-700 border-rose-200', row: 'bg-rose-50/40' };
    if (days <= 30) return { label: `${days}d`, color: 'bg-amber-100 text-amber-700 border-amber-200', row: 'bg-amber-50/30' };
    if (days <= 90) return { label: `${days}d`, color: 'bg-yellow-100 text-yellow-700 border-yellow-200', row: 'bg-yellow-50/20' };
    return { label: `${days}d`, color: 'bg-emerald-50 text-emerald-700 border-emerald-200', row: '' };
};

// CSV export utility
const exportCSV = (rows, columns, filename) => {
    const header = columns.map(c => c.label).join(',');
    const body = rows.map(row =>
        columns.map(c => {
            const val = c.value(row);
            const str = String(val ?? '').replace(/"/g, '""');
            return str.includes(',') || str.includes('\n') ? `"${str}"` : str;
        }).join(',')
    ).join('\n');
    const csv = `${header}\n${body}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    URL.revokeObjectURL(url);
};

// ---------------------------------------------------------------------------
// Skeleton loaders
// ---------------------------------------------------------------------------
const SkeletonCard = () => (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm animate-pulse">
        <div className="h-3 w-24 bg-slate-200 rounded mb-4" />
        <div className="h-7 w-32 bg-slate-200 rounded mb-3" />
        <div className="h-3 w-20 bg-slate-100 rounded" />
    </div>
);

const SkeletonTable = () => (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm animate-pulse">
        <div className="h-4 w-40 bg-slate-200 rounded mb-6" />
        {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-3 mb-3">
                <div className="h-3 flex-1 bg-slate-100 rounded" />
                <div className="h-3 w-16 bg-slate-100 rounded" />
                <div className="h-3 w-20 bg-slate-100 rounded" />
            </div>
        ))}
    </div>
);

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
const KPICard = ({ title, value, subtitle, icon: Icon, color = 'bg-indigo-500' }) => (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-lg hover:ring-1 hover:ring-emerald-500/20 transition-all duration-300 relative overflow-hidden group hover:-translate-y-0.5">
        <div className="flex justify-between items-start mb-3">
            <p className="text-slate-500 text-[11px] font-black uppercase tracking-wider leading-tight">{title}</p>
            <div className={`p-2 rounded-lg ${color} bg-opacity-10 group-hover:bg-opacity-20 transition-colors`}>
                <Icon size={16} className={color.replace('bg-', 'text-')} />
            </div>
        </div>
        <h3 className="text-xl font-black text-slate-900 tracking-tight mb-1">{value}</h3>
        {subtitle && <p className="text-xs text-slate-400 font-medium">{subtitle}</p>}
    </div>
);

// ---------------------------------------------------------------------------
// SUB-TAB 1: Vencimientos
// ---------------------------------------------------------------------------
const VencimientosSubTab = () => {
    const [loading, setLoading] = useState(true);
    const [alerts, setAlerts] = useState([]);
    const [lots, setLots] = useState([]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [alertsRes, lotsRes] = await Promise.allSettled([
                getAlerts(),
                getLots(),
            ]);
            if (alertsRes.status === 'fulfilled') {
                const data = alertsRes.value?.data ?? alertsRes.value ?? [];
                setAlerts(Array.isArray(data) ? data : []);
            }
            if (lotsRes.status === 'fulfilled') {
                const data = lotsRes.value?.data ?? lotsRes.value ?? [];
                setLots(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error('Error loading pharmacy expiry data:', err);
            toast.error('Error al cargar datos de vencimientos');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // Build rows from lots (combining alert info)
    const rows = useMemo(() => {
        return lots.map(lot => {
            const days = daysDiff(lot.expiry_date);
            return {
                product: lot.product_name || lot.product?.name || '-',
                lot_number: lot.lot_number || lot.batch || '-',
                expiry_date: lot.expiry_date ? new Date(lot.expiry_date + 'T12:00:00').toLocaleDateString('es-VE') : '-',
                days_remaining: days,
                quantity: Number(lot.quantity ?? lot.stock ?? 0),
                status: expiryStatus(days),
            };
        }).sort((a, b) => {
            if (a.days_remaining === null) return 1;
            if (b.days_remaining === null) return -1;
            return a.days_remaining - b.days_remaining;
        });
    }, [lots]);

    const summary = useMemo(() => ({
        expired: rows.filter(r => r.days_remaining !== null && r.days_remaining < 0).length,
        expire30: rows.filter(r => r.days_remaining !== null && r.days_remaining >= 0 && r.days_remaining <= 30).length,
        expire90: rows.filter(r => r.days_remaining !== null && r.days_remaining > 30 && r.days_remaining <= 90).length,
        ok: rows.filter(r => r.days_remaining === null || r.days_remaining > 90).length,
    }), [rows]);

    const handleExport = () => {
        exportCSV(
            rows,
            [
                { label: 'Producto', value: r => r.product },
                { label: 'Lote', value: r => r.lot_number },
                { label: 'Fecha Vencimiento', value: r => r.expiry_date },
                { label: 'Días Restantes', value: r => r.days_remaining ?? '' },
                { label: 'Cantidad', value: r => r.quantity },
                { label: 'Estado', value: r => r.status.label },
            ],
            `Vencimientos_Farmacia_${new Date().toISOString().split('T')[0]}.csv`
        );
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
                <SkeletonTable />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex justify-end gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <button
                    onClick={loadData}
                    className="h-8 w-8 inline-flex items-center justify-center bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                    title="Actualizar"
                >
                    <RefreshCw size={16} />
                </button>
                <button
                    onClick={handleExport}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-[11px] font-black rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                >
                    <Download size={14} />
                    Exportar CSV
                </button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <KPICard
                    title="Vencidos"
                    value={fmtNumber(summary.expired)}
                    subtitle="Lotes vencidos"
                    icon={AlertTriangle}
                    color="bg-rose-500"
                />
                <KPICard
                    title="Vencen en 30d"
                    value={fmtNumber(summary.expire30)}
                    subtitle="Próximos 30 días"
                    icon={AlertTriangle}
                    color="bg-amber-500"
                />
                <KPICard
                    title="Vencen en 90d"
                    value={fmtNumber(summary.expire90)}
                    subtitle="31 a 90 días"
                    icon={Pill}
                    color="bg-yellow-500"
                />
                <KPICard
                    title="En Regla"
                    value={fmtNumber(summary.ok)}
                    subtitle="Más de 90 días"
                    icon={Package}
                    color="bg-emerald-500"
                />
            </div>

            {/* Lots table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                            <AlertTriangle size={18} className="text-amber-500" />
                            Control de Vencimientos por Lote
                        </h3>
                        <p className="text-xs font-semibold text-slate-500">Todos los lotes ordenados por proximidad de vencimiento</p>
                    </div>
                    <span className="bg-slate-100 text-slate-600 text-[11px] font-black px-2.5 py-1 rounded-full">
                        {rows.length} lotes
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50/80 text-slate-500 text-[11px] font-black uppercase tracking-wider">
                            <tr>
                                <th className="text-left px-3 py-2.5">Producto</th>
                                <th className="text-left px-3 py-2.5">Lote</th>
                                <th className="text-left px-3 py-2.5">Fecha Vencimiento</th>
                                <th className="text-right px-3 py-2.5">Días Restantes</th>
                                <th className="text-right px-3 py-2.5">Cantidad</th>
                                <th className="text-center px-3 py-2.5">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-3">
                                            <Pill size={40} className="text-slate-300" />
                                            <p className="font-bold text-slate-500">Sin lotes registrados</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                rows.map((row, idx) => (
                                    <tr key={idx} className={`hover:bg-slate-50/60 transition-colors ${row.status.row}`}>
                                        <td className="px-3 py-2.5 font-medium text-slate-800 max-w-[220px] truncate">{row.product}</td>
                                        <td className="px-3 py-2.5 text-slate-500 font-mono text-xs">{row.lot_number}</td>
                                        <td className="px-3 py-2.5 text-slate-600">{row.expiry_date}</td>
                                        <td className="px-3 py-2.5 text-right font-bold text-slate-700">
                                            {row.days_remaining !== null ? row.days_remaining : '-'}
                                        </td>
                                        <td className="px-3 py-2.5 text-right text-slate-600">{fmtNumber(row.quantity)}</td>
                                        <td className="px-3 py-2.5 text-center">
                                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-black border ${row.status.color}`}>
                                                {row.status.label === 'Vencido' ? 'Vencido' :
                                                    row.days_remaining !== null && row.days_remaining < 0 ? 'Vencido' :
                                                    row.days_remaining !== null && row.days_remaining <= 30 ? 'Próximo' :
                                                    row.days_remaining !== null && row.days_remaining <= 90 ? 'Advertencia' : 'En regla'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Classification constants
// ---------------------------------------------------------------------------
const CLASSIFICATIONS = [
    { id: 'otc', label: 'OTC (Venta Libre)', color: '#10b981', icon: Package },
    { id: 'rx', label: 'Receta', color: '#3b82f6', icon: FlaskConical },
    { id: 'controlled', label: 'Controlados', color: '#f59e0b', icon: Shield },
];

const normalizeClassification = (cls) => {
    if (!cls) return 'other';
    const c = String(cls).toLowerCase();
    if (c === 'otc' || c === 'venta libre' || c === 'libre') return 'otc';
    if (c === 'rx' || c === 'receta' || c === 'prescription') return 'rx';
    if (c === 'controlled' || c === 'controlado' || c === 'control') return 'controlled';
    return 'other';
};

// ---------------------------------------------------------------------------
// SUB-TAB 2: Ventas por Clasificación
// ---------------------------------------------------------------------------
const VentasClasificacionSubTab = ({ dateRange }) => {
    const [loading, setLoading] = useState(true);
    const [salesRows, setSalesRows] = useState([]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                start_date: dateRange?.start,
                end_date: dateRange?.end,
                limit: 500,
            };
            const res = await apiClient.get('/reports/sales/summary', { params });
            const data = res.data ?? res ?? [];
            // accept array or object with items/results
            const items = Array.isArray(data) ? data :
                Array.isArray(data?.items) ? data.items :
                Array.isArray(data?.results) ? data.results :
                Array.isArray(data?.sales) ? data.sales : [];
            setSalesRows(items);
        } catch (err) {
            console.error('Error loading pharmacy sales data:', err);
            toast.error('Error al cargar ventas farmacéuticas');
            setSalesRows([]);
        } finally {
            setLoading(false);
        }
    }, [dateRange?.start, dateRange?.end]);

    useEffect(() => { loadData(); }, [loadData]);

    // Filter only drug products (those with a classification field set)
    const drugRows = useMemo(() =>
        salesRows.filter(r => r.drug_classification || r.classification || r.categoria === 'farmacia'),
        [salesRows]
    );

    // KPIs per classification
    const kpis = useMemo(() => {
        const map = { otc: { count: 0, revenue: 0 }, rx: { count: 0, revenue: 0 }, controlled: { count: 0, revenue: 0 } };
        drugRows.forEach(r => {
            const cls = normalizeClassification(r.drug_classification || r.classification);
            const target = map[cls] || map.otc;
            target.count += Number(r.quantity || r.qty || 1);
            target.revenue += Number(r.total_amount || r.amount || r.total || 0);
        });
        return map;
    }, [drugRows]);

    // Daily bar chart data
    const chartData = useMemo(() => {
        const byDay = {};
        drugRows.forEach(r => {
            const day = (r.date || r.created_at || r.sale_date || '').split('T')[0];
            if (!day) return;
            if (!byDay[day]) byDay[day] = { date: day, OTC: 0, Receta: 0, Controlados: 0 };
            const cls = normalizeClassification(r.drug_classification || r.classification);
            const qty = Number(r.quantity || r.qty || 1);
            if (cls === 'otc') byDay[day].OTC += qty;
            else if (cls === 'rx') byDay[day].Receta += qty;
            else if (cls === 'controlled') byDay[day].Controlados += qty;
        });
        return Object.values(byDay)
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(d => ({
                ...d,
                name: new Date(d.date + 'T12:00:00').toLocaleDateString('es-VE', { day: '2-digit', month: 'short' }),
            }));
    }, [drugRows]);

    // Table rows with normalized classification label
    const tableRows = useMemo(() =>
        drugRows.map(r => ({
            date: (r.date || r.created_at || r.sale_date || '').split('T')[0],
            product: r.product_name || r.name || r.product || '-',
            classification: r.drug_classification || r.classification || '-',
            quantity: Number(r.quantity || r.qty || 1),
            amount: Number(r.total_amount || r.amount || r.total || 0),
        })).sort((a, b) => b.date.localeCompare(a.date)),
        [drugRows]
    );

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
                <SkeletonTable />
                <SkeletonTable />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex justify-end gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <button
                    onClick={loadData}
                    className="h-8 w-8 inline-flex items-center justify-center bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                    title="Actualizar"
                >
                    <RefreshCw size={16} />
                </button>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {CLASSIFICATIONS.map(cls => (
                    <div
                        key={cls.id}
                        className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <p className="text-slate-500 text-[11px] font-black uppercase tracking-wider">{cls.label}</p>
                            <div className="p-2 rounded-lg" style={{ backgroundColor: `${cls.color}18` }}>
                                <cls.icon size={16} style={{ color: cls.color }} />
                            </div>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-1">{fmtNumber(kpis[cls.id]?.count ?? 0)}</h3>
                        <p className="text-xs text-slate-400 font-medium">{formatUSD(kpis[cls.id]?.revenue ?? 0)} en ventas</p>
                    </div>
                ))}
            </div>

            {/* Bar chart */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="mb-4">
                    <h3 className="text-sm font-black text-slate-900">Ventas por Clasificación por Día</h3>
                    <p className="text-xs font-semibold text-slate-500">Unidades vendidas en el periodo seleccionado</p>
                </div>
                {chartData.length > 0 ? (
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                                    dy={10}
                                    interval="preserveStartEnd"
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                                    width={35}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '10px 14px' }}
                                />
                                <Bar dataKey="OTC" fill="#10b981" radius={[3, 3, 0, 0]} />
                                <Bar dataKey="Receta" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                                <Bar dataKey="Controlados" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-72 flex items-center justify-center text-slate-400 text-sm">
                        Sin datos de ventas farmacéuticas en este periodo
                    </div>
                )}
                {/* Legend */}
                <div className="mt-3 flex flex-wrap gap-3">
                    {CLASSIFICATIONS.map(cls => (
                        <div key={cls.id} className="flex items-center gap-1.5 text-xs">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cls.color }} />
                            <span className="text-slate-600">{cls.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Sales table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-black text-slate-900">Detalle de Ventas Farmacéuticas</h3>
                        <p className="text-xs font-semibold text-slate-500">Ventas filtradas por productos con clasificación farmacéutica</p>
                    </div>
                    <span className="bg-slate-100 text-slate-600 text-[11px] font-black px-2.5 py-1 rounded-full">
                        {tableRows.length} registros
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50/80 text-slate-500 text-[11px] font-black uppercase tracking-wider">
                            <tr>
                                <th className="text-left px-3 py-2.5">Fecha</th>
                                <th className="text-left px-3 py-2.5">Producto</th>
                                <th className="text-left px-3 py-2.5">Clasificación</th>
                                <th className="text-right px-3 py-2.5">Cantidad</th>
                                <th className="text-right px-3 py-2.5">Monto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {tableRows.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-3">
                                            <ShoppingCart size={40} className="text-slate-300" />
                                            <p className="font-bold text-slate-500">Sin ventas farmacéuticas en este periodo</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                tableRows.map((row, idx) => {
                                    const norm = normalizeClassification(row.classification);
                                    const clsCfg = CLASSIFICATIONS.find(c => c.id === norm);
                                    return (
                                        <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-3 py-2.5 text-slate-500 text-xs font-mono">{row.date || '-'}</td>
                                            <td className="px-3 py-2.5 font-medium text-slate-800 max-w-[220px] truncate">{row.product}</td>
                                            <td className="px-3 py-2.5">
                                                <span
                                                    className="px-2.5 py-1 rounded-full text-[11px] font-black border"
                                                    style={{
                                                        backgroundColor: clsCfg ? `${clsCfg.color}18` : '#f1f5f9',
                                                        color: clsCfg ? clsCfg.color : '#64748b',
                                                        borderColor: clsCfg ? `${clsCfg.color}30` : '#e2e8f0',
                                                    }}
                                                >
                                                    {row.classification}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-right text-slate-600">{fmtNumber(row.quantity)}</td>
                                            <td className="px-3 py-2.5 text-right font-bold text-slate-900">{formatUSD(row.amount)}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// SUB-TAB 3: Valoración Farmacéutica
// ---------------------------------------------------------------------------
const ValoracionSubTab = () => {
    const [loading, setLoading] = useState(true);
    const [lots, setLots] = useState([]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getLots();
            const data = res.data ?? res ?? [];
            setLots(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error loading pharmacy valuation:', err);
            toast.error('Error al cargar valoración farmacéutica');
            setLots([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // Aggregate by product: sum quantities, costs, find nearest expiry
    const rows = useMemo(() => {
        const byProduct = {};
        lots.forEach(lot => {
            const key = lot.product_id || lot.product?.id || lot.product_name || lot.product?.name || 'unknown';
            if (!byProduct[key]) {
                byProduct[key] = {
                    product: lot.product_name || lot.product?.name || '-',
                    classification: lot.drug_classification || lot.classification || lot.product?.drug_classification || '-',
                    stock: 0,
                    cost_unit: Number(lot.cost_price || lot.purchase_price || lot.cost || lot.product?.cost_price || 0),
                    price_unit: Number(lot.sale_price || lot.price || lot.product?.sale_price || 0),
                    nearest_expiry: null,
                };
            }
            byProduct[key].stock += Number(lot.quantity ?? lot.stock ?? 0);
            // Keep nearest (soonest) expiry
            if (lot.expiry_date) {
                if (!byProduct[key].nearest_expiry || lot.expiry_date < byProduct[key].nearest_expiry) {
                    byProduct[key].nearest_expiry = lot.expiry_date;
                }
            }
        });
        return Object.values(byProduct).map(p => ({
            ...p,
            valor_stock: p.stock * p.price_unit,
            costo_total: p.stock * p.cost_unit,
        })).sort((a, b) => b.valor_stock - a.valor_stock);
    }, [lots]);

    const kpis = useMemo(() => {
        const valorTotal = rows.reduce((s, r) => s + r.valor_stock, 0);
        const inversionCosto = rows.reduce((s, r) => s + r.costo_total, 0);
        const ganancia = valorTotal - inversionCosto;
        const margen = valorTotal > 0 ? (ganancia / valorTotal) * 100 : 0;
        return { valorTotal, inversionCosto, ganancia, margen };
    }, [rows]);

    const handleExport = () => {
        exportCSV(
            rows,
            [
                { label: 'Producto', value: r => r.product },
                { label: 'Clasificación', value: r => r.classification },
                { label: 'Stock', value: r => r.stock },
                { label: 'Costo Unitario', value: r => r.cost_unit.toFixed(2) },
                { label: 'Precio Venta', value: r => r.price_unit.toFixed(2) },
                { label: 'Valor Stock', value: r => r.valor_stock.toFixed(2) },
                { label: 'Vence Próximo Lote', value: r => r.nearest_expiry ? new Date(r.nearest_expiry + 'T12:00:00').toLocaleDateString('es-VE') : '' },
            ],
            `Valoracion_Farmacia_${new Date().toISOString().split('T')[0]}.csv`
        );
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
                <SkeletonTable />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex justify-end gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <button
                    onClick={loadData}
                    className="h-8 w-8 inline-flex items-center justify-center bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                    title="Actualizar"
                >
                    <RefreshCw size={16} />
                </button>
                <button
                    onClick={handleExport}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-[11px] font-black rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                >
                    <Download size={14} />
                    Exportar CSV
                </button>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <KPICard
                    title="Valor Total Inventario"
                    value={formatUSD(kpis.valorTotal)}
                    subtitle="Al precio de venta"
                    icon={DollarSign}
                    color="bg-emerald-500"
                />
                <KPICard
                    title="Inversión en Costo"
                    value={formatUSD(kpis.inversionCosto)}
                    subtitle="Costo de adquisición"
                    icon={Package}
                    color="bg-slate-500"
                />
                <KPICard
                    title="Ganancia Potencial"
                    value={formatUSD(kpis.ganancia)}
                    subtitle="Si se vende todo"
                    icon={TrendingUp}
                    color="bg-teal-500"
                />
                <KPICard
                    title="Margen %"
                    value={`${kpis.margen.toFixed(1)}%`}
                    subtitle="Margen bruto estimado"
                    icon={TrendingUp}
                    color="bg-purple-500"
                />
            </div>

            {/* Valuation table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-black text-slate-900">Valoración por Producto</h3>
                        <p className="text-xs font-semibold text-slate-500">Stock agrupado por producto, con fecha de vencimiento más próxima</p>
                    </div>
                    <span className="bg-slate-100 text-slate-600 text-[11px] font-black px-2.5 py-1 rounded-full">
                        {rows.length} productos
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50/80 text-slate-500 text-[11px] font-black uppercase tracking-wider">
                            <tr>
                                <th className="text-left px-3 py-2.5">Producto</th>
                                <th className="text-left px-3 py-2.5">Clasificación</th>
                                <th className="text-right px-3 py-2.5">Stock</th>
                                <th className="text-right px-3 py-2.5">Costo Unit.</th>
                                <th className="text-right px-3 py-2.5">Precio</th>
                                <th className="text-right px-3 py-2.5">Valor Stock</th>
                                <th className="text-center px-3 py-2.5">Vence Próximo Lote</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-3">
                                            <Pill size={40} className="text-slate-300" />
                                            <p className="font-bold text-slate-500">Sin datos de valoración</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                rows.map((row, idx) => {
                                    const days = daysDiff(row.nearest_expiry);
                                    const expStatus = expiryStatus(days);
                                    const norm = normalizeClassification(row.classification);
                                    const clsCfg = CLASSIFICATIONS.find(c => c.id === norm);
                                    return (
                                        <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-3 py-2.5 font-medium text-slate-800 max-w-[220px] truncate">{row.product}</td>
                                            <td className="px-3 py-2.5">
                                                {row.classification !== '-' ? (
                                                    <span
                                                        className="px-2.5 py-1 rounded-full text-[11px] font-black border"
                                                        style={{
                                                            backgroundColor: clsCfg ? `${clsCfg.color}18` : '#f1f5f9',
                                                            color: clsCfg ? clsCfg.color : '#64748b',
                                                            borderColor: clsCfg ? `${clsCfg.color}30` : '#e2e8f0',
                                                        }}
                                                    >
                                                        {row.classification}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300 text-xs">-</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5 text-right font-bold text-slate-700">{fmtNumber(row.stock)}</td>
                                            <td className="px-3 py-2.5 text-right text-slate-500">{formatUSD(row.cost_unit)}</td>
                                            <td className="px-3 py-2.5 text-right text-slate-600">{formatUSD(row.price_unit)}</td>
                                            <td className="px-3 py-2.5 text-right font-bold text-emerald-700">{formatUSD(row.valor_stock)}</td>
                                            <td className="px-3 py-2.5 text-center">
                                                {row.nearest_expiry ? (
                                                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-black border ${expStatus.color}`}>
                                                        {new Date(row.nearest_expiry + 'T12:00:00').toLocaleDateString('es-VE')}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300 text-xs">Sin lotes</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// MAIN COMPONENT: PharmacyTab
// ---------------------------------------------------------------------------
const PharmacyTab = ({ dateRange }) => {
    const [activeSubTab, setActiveSubTab] = useState('vencimientos');

    const renderSubTabContent = () => {
        switch (activeSubTab) {
            case 'vencimientos':
                return <VencimientosSubTab />;
            case 'ventas':
                return <VentasClasificacionSubTab dateRange={dateRange} />;
            case 'valoracion':
                return <ValoracionSubTab />;
            default:
                return null;
        }
    };

    return (
        <div className="space-y-4">
            {/* Sub-tab navigation */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex overflow-x-auto border-b border-slate-100">
                    {SUB_TABS.map(tab => {
                        const TabIcon = tab.icon;
                        const isActive = activeSubTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveSubTab(tab.id)}
                                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-bold whitespace-nowrap border-b-2 transition-all ${
                                    isActive
                                        ? 'text-emerald-600 border-emerald-600 bg-emerald-50/30'
                                        : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'
                                }`}
                            >
                                <TabIcon size={15} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Sub-tab content */}
            {renderSubTabContent()}
        </div>
    );
};

export default PharmacyTab;
