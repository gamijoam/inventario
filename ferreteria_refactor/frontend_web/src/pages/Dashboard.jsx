import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, ShoppingCart, Users, Calendar, Download } from 'lucide-react';
import apiClient from '../config/axios';
import reportService from '../services/reportService';

const Dashboard = () => {
    const [financials, setFinancials] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState('today');
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        fetchFinancials();
    }, [dateRange]);

    const fetchFinancials = async () => {
        setLoading(true);
        try {
            const params = {};
            // FIX: Use local date instead of UTC to avoid "tomorrow" date late in day
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const today = `${year}-${month}-${day}`;

            if (dateRange === 'today') {
                params.start_date = today;
                params.end_date = today;
            } else if (dateRange === 'week') {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                const wYear = weekAgo.getFullYear();
                const wMonth = String(weekAgo.getMonth() + 1).padStart(2, '0');
                const wDay = String(weekAgo.getDate()).padStart(2, '0');
                params.start_date = `${wYear}-${wMonth}-${wDay}`; // Local week ago
                params.end_date = today;
            } else if (dateRange === 'month') {
                const monthAgo = new Date();
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                const mYear = monthAgo.getFullYear();
                const mMonth = String(monthAgo.getMonth() + 1).padStart(2, '0');
                const mDay = String(monthAgo.getDate()).padStart(2, '0');
                params.start_date = `${mYear}-${mMonth}-${mDay}`; // Local month ago
                params.end_date = today;
            }

            const response = await apiClient.get('/reports/dashboard/financials', { params });
            setFinancials(response.data);
        } catch (error) {
            console.error('Error fetching financials:', error);
        } finally {
            setLoading(false);
        }
    };

    const getCurrencyColor = (currency) => {
        const colors = {
            'USD': 'from-green-500 to-green-600',
            '$': 'from-green-500 to-green-600',
            'Bs': 'from-blue-500 to-blue-600',
            'VES': 'from-blue-500 to-blue-600',
            'COP': 'from-purple-500 to-purple-600',
            'EUR': 'from-indigo-500 to-indigo-600',
        };
        return colors[currency] || 'from-gray-500 to-gray-600';
    };

    const getCurrencySymbol = (currency) => {
        const symbols = {
            'USD': '$',
            'Bs': 'Bs',
            'VES': 'Bs',
            'COP': '$',
            'EUR': '€',
        };
        return symbols[currency] || currency;
    };

    const handleDownloadExcel = async () => {
        setDownloading(true);
        try {
            // Calculate date range based on current selection
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const today = `${year}-${month}-${day}`;

            let startDate = today;
            let endDate = today;

            if (dateRange === 'week') {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                const wYear = weekAgo.getFullYear();
                const wMonth = String(weekAgo.getMonth() + 1).padStart(2, '0');
                const wDay = String(weekAgo.getDate()).padStart(2, '0');
                startDate = `${wYear}-${wMonth}-${wDay}`;
            } else if (dateRange === 'month') {
                const monthAgo = new Date();
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                const mYear = monthAgo.getFullYear();
                const mMonth = String(monthAgo.getMonth() + 1).padStart(2, '0');
                const mDay = String(monthAgo.getDate()).padStart(2, '0');
                startDate = `${mYear}-${mMonth}-${mDay}`;
            }

            await reportService.downloadExcelReport(startDate, endDate);
        } catch (error) {
            console.error('Error downloading Excel:', error);
            alert('Error al descargar el reporte. Por favor intenta de nuevo.');
        } finally {
            setDownloading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-xl text-gray-600">Cargando dashboard...</div>
            </div>
        );
    }

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Dashboard Financiero</h1>
                    <p className="text-gray-600">Resumen de ventas y métricas en tiempo real</p>
                </div>
                <button
                    onClick={handleDownloadExcel}
                    disabled={downloading}
                    className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex items-center justify-center gap-2"
                >
                    <Download size={20} />
                    {downloading ? 'Generando...' : 'Exportar a Excel'}
                </button>
            </div>

            {/* Date Range Selector */}
            <div className="mb-6 flex flex-wrap gap-2 md:gap-3">
                <button
                    onClick={() => setDateRange('today')}
                    className={`flex-1 md:flex-none px-4 py-2 rounded-lg font-medium transition-colors ${dateRange === 'today'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100'
                        }`}
                >
                    Hoy
                </button>
                <button
                    onClick={() => setDateRange('week')}
                    className={`flex-1 md:flex-none px-4 py-2 rounded-lg font-medium transition-colors ${dateRange === 'week'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100'
                        }`}
                >
                    Última Semana
                </button>
                <button
                    onClick={() => setDateRange('month')}
                    className={`flex-1 md:flex-none px-4 py-2 rounded-lg font-medium transition-colors ${dateRange === 'month'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100'
                        }`}
                >
                    Último Mes
                </button>
            </div>

            {/* Dynamic Currency Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                {financials?.sales_by_currency?.map((currencyData, index) => (
                    <div
                        key={index}
                        className={`bg-gradient-to-br ${getCurrencyColor(currencyData.currency)} text-white rounded-xl shadow-lg p-6 transform hover:scale-105 transition-transform duration-200`}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="bg-white/20 p-3 rounded-lg">
                                <DollarSign size={24} />
                            </div>
                            <div className="text-right">
                                <p className="text-sm opacity-90">Ventas en</p>
                                <p className="text-lg font-bold">{currencyData.currency}</p>
                            </div>
                        </div>
                        <div className="mb-2">
                            <p className="text-4xl font-bold">
                                {getCurrencySymbol(currencyData.currency)} {currencyData.total_collected.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                        <div className="flex items-center text-sm opacity-90">
                            <ShoppingCart size={16} className="mr-2" />
                            <span>{currencyData.count} transacciones</span>
                        </div>
                    </div>
                ))}

                {/* Total in USD Base Card */}
                <div className="bg-gradient-to-br from-yellow-500 to-orange-500 text-white rounded-xl shadow-lg p-6 transform hover:scale-105 transition-transform duration-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="bg-white/20 p-3 rounded-lg">
                            <TrendingUp size={24} />
                        </div>
                        <div className="text-right">
                            <p className="text-sm opacity-90">Total Base</p>
                            <p className="text-lg font-bold">USD</p>
                        </div>
                    </div>
                    <div className="mb-2">
                        <p className="text-4xl font-bold">
                            $ {financials?.total_sales_base_usd?.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                    <div className="text-sm opacity-90">
                        Todas las monedas convertidas
                    </div>
                </div>

                {/* Profit Card */}
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl shadow-lg p-6 transform hover:scale-105 transition-transform duration-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="bg-white/20 p-3 rounded-lg">
                            <TrendingUp size={24} />
                        </div>
                        <div className="text-right">
                            <p className="text-sm opacity-90">Ganancia</p>
                            <p className="text-lg font-bold">Estimada</p>
                        </div>
                    </div>
                    <div className="mb-2">
                        <p className="text-4xl font-bold">
                            $ {financials?.profit_estimated?.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                    <div className="text-sm opacity-90">
                        Ventas - Costos
                    </div>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Sales Summary */}
                <div className="bg-white rounded-xl shadow-md p-6">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                        <ShoppingCart className="mr-2 text-blue-600" size={24} />
                        Resumen de Ventas
                    </h3>
                    <div className="space-y-4">
                        {financials?.sales_by_currency?.map((currencyData, index) => (
                            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div>
                                    <p className="font-semibold text-gray-800">{currencyData.currency}</p>
                                    <p className="text-sm text-gray-600">{currencyData.count} transacciones</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold text-gray-800">
                                        {getCurrencySymbol(currencyData.currency)} {currencyData.total_collected.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="bg-white rounded-xl shadow-md p-6">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                        <Calendar className="mr-2 text-purple-600" size={24} />
                        Estadísticas Rápidas
                    </h3>
                    <div className="space-y-4">
                        <div className="p-4 bg-blue-50 rounded-lg">
                            <p className="text-sm text-gray-600 mb-1">Total Transacciones</p>
                            <p className="text-3xl font-bold text-blue-600">
                                {financials?.sales_by_currency?.reduce((sum, curr) => sum + curr.count, 0) || 0}
                            </p>
                        </div>
                        <div className="p-4 bg-green-50 rounded-lg">
                            <p className="text-sm text-gray-600 mb-1">Margen de Ganancia</p>
                            <p className="text-3xl font-bold text-green-600">
                                {financials?.total_sales_base_usd > 0
                                    ? ((financials.profit_estimated / financials.total_sales_base_usd) * 100).toFixed(1)
                                    : 0}%
                            </p>
                        </div>
                        <div className="p-4 bg-purple-50 rounded-lg">
                            <p className="text-sm text-gray-600 mb-1">Ticket Promedio</p>
                            <p className="text-3xl font-bold text-purple-600">
                                $ {financials?.sales_by_currency?.length > 0
                                    ? (financials.total_sales_base_usd / financials.sales_by_currency.reduce((sum, curr) => sum + curr.count, 0)).toFixed(2)
                                    : '0.00'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Info Message */}
            {(!financials?.sales_by_currency || financials.sales_by_currency.length === 0) && (
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6 text-center">
                    <p className="text-yellow-800 font-medium">
                        📊 No hay ventas registradas en el período seleccionado
                    </p>
                    <p className="text-yellow-600 text-sm mt-2">
                        Las métricas se actualizarán automáticamente cuando se registren ventas
                    </p>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
