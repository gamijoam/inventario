import { useState, useEffect, useCallback } from 'react';
import {
    Package, DollarSign, TrendingUp, AlertTriangle, Download,
    RefreshCw, BarChart3
} from 'lucide-react';
import unifiedReportService from '../../../services/unifiedReportService';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';

// ---------------------------------------------------------------------------
// Currency helpers
// ---------------------------------------------------------------------------
const formatUSD = (amount) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
    }).format(Number(amount) || 0);

const fmtNumber = (n) => new Intl.NumberFormat('es-VE').format(Number(n) || 0);

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------
const SkeletonCard = () => (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm animate-pulse">
        <div className="h-3 w-24 bg-slate-200 rounded mb-4" />
        <div className="h-7 w-32 bg-slate-200 rounded mb-3" />
        <div className="h-3 w-20 bg-slate-100 rounded" />
    </div>
);

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
const KPICard = ({ title, value, subtitle, icon: Icon, color = 'bg-indigo-500' }) => (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-lg hover:ring-1 hover:ring-emerald-500/20 transition-all duration-300 relative overflow-hidden group hover:-translate-y-0.5">
        <div className="flex justify-between items-start mb-3">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider leading-tight">{title}</p>
            <div className={`p-2 rounded-lg ${color} bg-opacity-10 group-hover:bg-opacity-20 transition-colors`}>
                <Icon size={16} className={color.replace('bg-', 'text-')} />
            </div>
        </div>
        <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-1">{value}</h3>
        {subtitle && <p className="text-xs text-slate-400 font-medium">{subtitle}</p>}
    </div>
);

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------
const InventoryTab = ({ dateRange }) => {
    const [loading, setLoading] = useState(true);
    const [inventoryData, setInventoryData] = useState(null);
    const [lowStock, setLowStock] = useState([]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [invRes, lowRes] = await Promise.allSettled([
                unifiedReportService.getInventoryValuation(),
                unifiedReportService.getLowStock(5),
            ]);
            if (invRes.status === 'fulfilled') setInventoryData(invRes.value);
            if (lowRes.status === 'fulfilled') setLowStock(Array.isArray(lowRes.value) ? lowRes.value : []);
        } catch (error) {
            console.error('Error loading inventory data:', error);
            toast.error('Error al cargar datos de inventario');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Export inventory Excel
    const handleExport = async () => {
        const toastId = toast.loading('Generando reporte de inventario...');
        try {
            const blob = await unifiedReportService.downloadExcelReport({
                start_date: dateRange?.start,
                end_date: dateRange?.end,
            });
            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Inventario_${new Date().toISOString().split('T')[0]}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            toast.success('Reporte descargado correctamente', { id: toastId });
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Error al generar el reporte', { id: toastId });
        }
    };

    // Sort low stock by urgency (ratio of current / min stock)
    const sortedLowStock = [...lowStock].sort((a, b) => {
        const ratioA = (Number(a.current_stock || a.stock) || 0) / (Number(a.min_stock || a.minimum_stock) || 1);
        const ratioB = (Number(b.current_stock || b.stock) || 0) / (Number(b.min_stock || b.minimum_stock) || 1);
        return ratioA - ratioB;
    });

    // ---------------------------------------------------------------------------
    // LOADING
    // ---------------------------------------------------------------------------
    if (loading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                    {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-pulse">
                    <div className="h-4 w-40 bg-slate-200 rounded mb-6" />
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex gap-4 mb-3">
                            <div className="h-3 flex-1 bg-slate-100 rounded" />
                            <div className="h-3 w-16 bg-slate-100 rounded" />
                            <div className="h-3 w-20 bg-slate-100 rounded" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Calculated values
    const totalStock = Number(inventoryData?.total_stock_units) || 0;
    const totalCost = Number(inventoryData?.total_cost_usd) || 0;
    const totalRevenue = Number(inventoryData?.total_revenue_usd) || 0;
    const potentialProfit = Number(inventoryData?.potential_profit_usd) || (totalRevenue - totalCost);
    const marginPct = Number(inventoryData?.margin_percent) || (totalRevenue > 0 ? ((potentialProfit / totalRevenue) * 100) : 0);

    // ---------------------------------------------------------------------------
    // RENDER
    // ---------------------------------------------------------------------------
    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex justify-end gap-2">
                <button
                    onClick={loadData}
                    disabled={loading}
                    className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
                    title="Actualizar"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
                <button
                    onClick={handleExport}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                >
                    <Download size={14} />
                    Exportar
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                <KPICard
                    title="Total Items en Stock"
                    value={fmtNumber(totalStock)}
                    subtitle={`En ${fmtNumber(inventoryData?.total_products || 0)} productos`}
                    icon={Package}
                    color="bg-indigo-500"
                />
                <KPICard
                    title="Inversion en Inventario"
                    value={formatUSD(totalCost)}
                    subtitle="Costo USD"
                    icon={DollarSign}
                    color="bg-slate-500"
                />
                <KPICard
                    title="Valor Venta Potencial"
                    value={formatUSD(totalRevenue)}
                    subtitle="USD"
                    icon={TrendingUp}
                    color="bg-emerald-500"
                />
                <KPICard
                    title="Ganancia Potencial"
                    value={formatUSD(potentialProfit)}
                    subtitle="USD"
                    icon={BarChart3}
                    color="bg-teal-500"
                />
                <KPICard
                    title="Margen %"
                    value={`${marginPct.toFixed(1)}%`}
                    subtitle="Margen bruto estimado"
                    icon={TrendingUp}
                    color="bg-purple-500"
                />
            </div>

            {/* Valuation summary banner */}
            {inventoryData && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-center">
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Valoracion de Inventario</h3>
                    <p className="text-slate-500 max-w-lg mx-auto">
                        Si vendieras todo tu inventario hoy, generarias <strong className="text-emerald-600">{formatUSD(potentialProfit)}</strong> de ganancia bruta
                        (Margen estimado: <strong>{marginPct.toFixed(1)}%</strong>)
                    </p>
                </div>
            )}

            {/* Low Stock Alerts Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <AlertTriangle size={18} className="text-amber-500" />
                            Stock Bajo - Alertas
                        </h3>
                        <p className="text-sm text-slate-500">Productos con stock bajo o agotado, ordenados por urgencia</p>
                    </div>
                    <span className="bg-amber-50 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200">
                        {sortedLowStock.length} alertas
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50/80 text-slate-500 text-xs font-bold uppercase tracking-wider">
                            <tr>
                                <th className="text-left px-4 py-3">Producto</th>
                                <th className="text-left px-4 py-3">SKU</th>
                                <th className="text-right px-4 py-3">Stock Actual</th>
                                <th className="text-right px-4 py-3">Stock Minimo</th>
                                <th className="text-center px-4 py-3">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sortedLowStock.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-4 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center">
                                            <Package size={40} className="mb-3 text-emerald-200" />
                                            <p className="font-bold text-slate-500">Sin alertas de stock bajo</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                sortedLowStock.map((item, idx) => {
                                    const current = Number(item.current_stock ?? item.stock) || 0;
                                    const min = Number(item.min_stock ?? item.minimum_stock) || 1;
                                    const isOut = current <= 0;
                                    const isCritical = current > 0 && current <= min * 0.5;

                                    return (
                                        <tr key={item.id || idx} className={clsx('hover:bg-slate-50/60 transition-colors', isOut && 'bg-rose-50/30')}>
                                            <td className="px-4 py-3 font-medium text-slate-800 max-w-[250px] truncate">
                                                {item.product_name || item.name}
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                                                {item.sku || item.barcode || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-700">{current}</td>
                                            <td className="px-4 py-3 text-right text-slate-500">{min}</td>
                                            <td className="px-4 py-3 text-center">
                                                {isOut ? (
                                                    <span className="px-2.5 py-1 rounded-full text-xs font-bold border bg-rose-50 text-rose-700 border-rose-200">
                                                        Agotado
                                                    </span>
                                                ) : isCritical ? (
                                                    <span className="px-2.5 py-1 rounded-full text-xs font-bold border bg-amber-50 text-amber-700 border-amber-200">
                                                        Critico
                                                    </span>
                                                ) : (
                                                    <span className="px-2.5 py-1 rounded-full text-xs font-bold border bg-yellow-50 text-yellow-700 border-yellow-200">
                                                        Bajo
                                                    </span>
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

export default InventoryTab;
