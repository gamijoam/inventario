import React, { useState, useEffect } from 'react';
import {
    BarChart3, DollarSign, Calendar, Package, TrendingUp,
    FileText, Download, Filter, RefreshCw, CreditCard, Users
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';
import unifiedReportService from '../../services/unifiedReportService';
import { useConfig } from '../../context/ConfigContext';

// Helper for formatting currency
const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
    }).format(amount || 0);
};

const KPI_Card = ({ title, value, subvalue, icon: Icon, color }) => (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between">
        <div>
            <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
            <h3 className="text-2xl font-black text-slate-800">{value}</h3>
            {subvalue && <p className="text-sm text-slate-400 mt-1">{subvalue}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
            <Icon size={24} className="text-white" />
        </div>
    </div>
);

const UnifiedReports = () => {
    // State
    const [activeTab, setActiveTab] = useState('sales'); // sales, finance, inventory
    const [loading, setLoading] = useState(false);

    // Filters
    const today = new Date().toISOString().split('T')[0];
    const [dateRange, setDateRange] = useState({
        start: today,
        end: today
    });

    // Data
    const [salesSummary, setSalesSummary] = useState(null);
    const [profitData, setProfitData] = useState(null);
    const [inventoryData, setInventoryData] = useState(null);
    const [topProducts, setTopProducts] = useState([]);
    const [dailyClose, setDailyClose] = useState(null);

    // Initial Load
    useEffect(() => {
        loadData();
    }, [activeTab, dateRange]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Parallel requests based on tab
            const promises = [];

            // Common data for Sales/Finance
            if (activeTab === 'sales' || activeTab === 'finance') {
                promises.push(unifiedReportService.getSalesSummary({
                    start_date: dateRange.start,
                    end_date: dateRange.end
                }).then(setSalesSummary));

                promises.push(unifiedReportService.getProfitability({
                    start_date: dateRange.start,
                    end_date: dateRange.end
                }).then(setProfitData));

                promises.push(unifiedReportService.getTopProducts({
                    start_date: dateRange.start,
                    end_date: dateRange.end,
                    limit: 5,
                    by: 'revenue'
                }).then(setTopProducts));
            }

            if (activeTab === 'inventory') {
                promises.push(unifiedReportService.getInventoryValuation().then(setInventoryData));
            }

            if (activeTab === 'ops') {
                // Ops is usually for "Daily Close"
                promises.push(unifiedReportService.getDailyClose(dateRange.end).then(setDailyClose));
            }

            await Promise.all(promises);

        } catch (error) {
            console.error(error);
            toast.error("Error cargando reportes");
        } finally {
            setLoading(false);
        }
    };

    const handleDateChange = (e) => {
        const { name, value } = e.target;
        setDateRange(prev => ({ ...prev, [name]: value }));
    };

    // --- RENDER CONTENT ---

    const renderSalesTab = () => (
        <div className="space-y-6">
            {/* Sales KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <KPI_Card
                    title="Ventas Totales"
                    value={formatCurrency(salesSummary?.total_revenue)}
                    subvalue={
                        <div>
                            <p>{salesSummary?.total_transactions || 0} Transacciones</p>
                            {salesSummary?.total_refunded > 0 && (
                                <p className="text-rose-400 text-xs mt-0.5">
                                    Devoluciones: -{formatCurrency(salesSummary.total_refunded)}
                                </p>
                            )}
                        </div>
                    }
                    icon={DollarSign}
                    color="bg-indigo-500"
                />
                <KPI_Card
                    title="Ticket Promedio"
                    value={formatCurrency(salesSummary?.average_ticket)}
                    icon={TrendingUp}
                    color="bg-emerald-500"
                />
                <KPI_Card
                    title="Ventas Efectivo"
                    value={formatCurrency(salesSummary?.cash_sales)}
                    icon={DollarSign}
                    color="bg-blue-500"
                />
                <KPI_Card
                    title="Ventas Crédito"
                    value={formatCurrency(salesSummary?.credit_sales)}
                    icon={CreditCard}
                    color="bg-amber-500"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Products Table */}
                {/* Updated to show Net Sales and Returns */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Top 5 Productos (Ingresos Netos)</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium">
                                <tr>
                                    <th className="px-4 py-2 rounded-l-lg">Producto</th>
                                    <th className="px-4 py-2 text-center text-xs text-rose-500">Devol.</th>
                                    <th className="px-4 py-2 rounded-r-lg text-right">Ingresos</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {topProducts.map((p, i) => (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-slate-700">
                                            {p.product_name}
                                            <div className="text-[10px] text-slate-400">
                                                Vendido: {p.gross_quantity || p.quantity_sold} {p.returned_quantity > 0 ? `| Neto: ${p.quantity_sold}` : ''}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center text-rose-600 font-bold text-xs">
                                            {p.returned_quantity > 0 ? `-${p.returned_quantity}` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-800">
                                            {formatCurrency(p.revenue)}
                                        </td>
                                    </tr>
                                ))}
                                {topProducts.length === 0 && (
                                    <tr>
                                        <td colSpan="3" className="text-center py-4 text-slate-400">Sin datos</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderFinanceTab = () => (
        <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <div className="bg-amber-100 p-2 rounded-lg text-amber-700">
                    <TrendingUp size={20} />
                </div>
                <div>
                    <h4 className="font-bold text-amber-900">Reporte de Rentabilidad Real</h4>
                    <p className="text-sm text-amber-700 mt-1">
                        Este reporte utiliza el sistema de <strong>Costo Histórico</strong>.
                        La ganancia se calcula restando el costo exacto que tenía cada producto
                        al momento de su venta, garantizando precisión financiera incluso si los costos de reposición cambian.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-slate-500 text-sm font-medium">Ingresos Totales (Neto)</p>
                    <h3 className="text-3xl font-black text-slate-800 mt-1">
                        {formatCurrency(profitData?.total_revenue)}
                    </h3>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-slate-500 text-sm font-medium">Costo de Mercancía (COGS)</p>
                    <h3 className="text-3xl font-black text-rose-600 mt-1">
                        -{formatCurrency(profitData?.total_cost)}
                    </h3>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm bg-gradient-to-br from-emerald-50 to-white">
                    <p className="text-emerald-600 text-sm font-bold">Ganancia Bruta (Profit)</p>
                    <h3 className="text-3xl font-black text-emerald-600 mt-1">
                        {formatCurrency(profitData?.total_profit)}
                    </h3>
                    <div className="mt-2 inline-flex items-center px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs font-bold">
                        Margen: {profitData?.avg_margin ? profitData.avg_margin.toFixed(1) : 0}%
                    </div>
                </div>
            </div>
        </div>
    );

    const renderInventoryTab = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KPI_Card
                    title="Total Items en Stock"
                    value={inventoryData?.total_stock_units || 0}
                    subvalue={`En ${inventoryData?.total_products || 0} productos únicos`}
                    icon={Package}
                    color="bg-indigo-500"
                />
                <KPI_Card
                    title="Valor Costo (Inversión)"
                    value={formatCurrency(inventoryData?.total_cost_usd)}
                    icon={DollarSign}
                    color="bg-slate-500"
                />
                <KPI_Card
                    title="Valor Venta (Potencial)"
                    value={formatCurrency(inventoryData?.total_revenue_usd)}
                    icon={TrendingUp}
                    color="bg-emerald-500"
                />
            </div>

            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
                <h3 className="text-xl font-bold text-slate-800 mb-2">Valoración de Inventario</h3>
                <p className="text-slate-500 max-w-lg mx-auto">
                    Si vendieras todo tu inventario hoy, generarías <strong>{formatCurrency(inventoryData?.potential_profit_usd)}</strong> de ganancia bruta
                    (Margen estimado: {inventoryData?.margin_percent}%)
                </p>
            </div>
        </div>
    );

    const handleExport = async () => {
        const toastId = toast.loading("Generando reporte Excel...");
        try {
            const blob = await unifiedReportService.downloadExcelReport({
                start_date: dateRange.start,
                end_date: dateRange.end
            });

            // Create download link
            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Reporte_Gerencial_${dateRange.start}_${dateRange.end}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);

            toast.success("Reporte descargado correctamente", { id: toastId });
        } catch (error) {
            console.error(error);
            toast.error("Error generando Excel", { id: toastId });
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800">Centro de Reportes</h1>
                    <p className="text-slate-500 font-medium">Inteligencia de Negocios Unificada</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-lg">
                        <Calendar size={16} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-500 uppercase">Desde</span>
                        <input
                            type="date"
                            name="start"
                            value={dateRange.start}
                            onChange={handleDateChange}
                            className="bg-transparent border-none p-0 text-sm font-bold text-slate-700 focus:ring-0"
                        />
                    </div>
                    <div className="w-px h-6 bg-slate-200"></div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-lg">
                        <Calendar size={16} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-500 uppercase">Hasta</span>
                        <input
                            type="date"
                            name="end"
                            value={dateRange.end}
                            onChange={handleDateChange}
                            className="bg-transparent border-none p-0 text-sm font-bold text-slate-700 focus:ring-0"
                        />
                    </div>

                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                    >
                        <RefreshCw size={18} className={clsx({ "animate-spin": loading })} />
                    </button>

                    <button
                        onClick={handleExport}
                        className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition"
                        title="Exportar Excel"
                    >
                        <Download size={18} />
                    </button>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="flex overflow-x-auto gap-2 border-b border-slate-200 pb-1">
                {[
                    { id: 'sales', label: 'Ventas', icon: BarChart3 },
                    { id: 'finance', label: 'Finanzas & Rentabilidad', icon: DollarSign },
                    { id: 'inventory', label: 'Inventario', icon: Package },
                    { id: 'ops', label: 'Cierre Diario', icon: FileText },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={clsx(
                            "flex items-center gap-2 px-6 py-3 rounded-t-xl font-bold text-sm transition-all whitespace-nowrap",
                            activeTab === tab.id
                                ? "bg-white border text-indigo-600 border-slate-200 border-b-white translate-y-px shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]"
                                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                        )}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px]">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600"></div>
                    </div>
                ) : (
                    <>
                        {activeTab === 'sales' && renderSalesTab()}
                        {activeTab === 'finance' && renderFinanceTab()}
                        {activeTab === 'inventory' && renderInventoryTab()}
                        {activeTab === 'ops' && (
                            <div className="text-center p-12 text-slate-400">
                                <FileText size={48} className="mx-auto mb-4 opacity-50" />
                                <h3 className="text-lg font-bold">Módulo de Cierre Diario</h3>
                                <p>Selecciona una fecha individual para ver el detalle de cierre.</p>
                                {dailyClose && (
                                    <div className="mt-8 text-left bg-white p-6 rounded-xl border border-slate-200 max-w-lg mx-auto">
                                        <h4 className="font-bold border-b pb-2 mb-4">Resumen del {dailyClose.date}</h4>
                                        <div className="space-y-3">
                                            {dailyClose.sales_by_method.map((m, i) => (
                                                <div key={i} className="flex justify-between">
                                                    <span>{m.method} ({m.count})</span>
                                                    <span className="font-bold">{formatCurrency(m.total)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default UnifiedReports;
