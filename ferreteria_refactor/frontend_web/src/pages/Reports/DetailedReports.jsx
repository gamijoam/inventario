import React, { useState, useEffect } from 'react';
import { BarChart, Wallet, Calendar, Users, ArrowUpRight, Download, FileText, Search, Package } from 'lucide-react';
import apiClient from '../../config/axios';
import { useConfig } from '../../context/ConfigContext';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';

const DetailedReports = () => {
    const { formatCurrency } = useConfig();

    // State
    const [activeTab, setActiveTab] = useState('payment'); // 'payment' or 'customer'
    const [dateRange, setDateRange] = useState({
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);

    // Fetch Report Data
    const fetchReport = async () => {
        setLoading(true);
        setData([]);
        try {
            let endpoint;
            if (activeTab === 'payment') endpoint = '/reports/sales/by-payment-method';
            else if (activeTab === 'customer') endpoint = '/reports/sales/by-customer';
            else if (activeTab === 'product') endpoint = '/reports/sales/by-product';

            const response = await apiClient.get(endpoint, {
                params: {
                    start_date: dateRange.start,
                    end_date: dateRange.end,
                    limit: 50 // Limit for customer report
                }
            });
            setData(response.data);
        } catch (error) {
            console.error("Error fetching report:", error);
            toast.error("Error al cargar reporte");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [activeTab, dateRange]);

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col bg-slate-50 p-6 overflow-hidden">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                            <BarChart size={24} />
                        </div>
                        Detalles de Ventas
                    </h1>
                    <p className="text-slate-500 font-medium ml-12">Análisis detallado de transacciones</p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Date Picker */}
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl shadow-sm border border-slate-200">
                        <Calendar size={18} className="text-slate-400" />
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                            className="border-none focus:ring-0 text-sm font-medium text-slate-700 outline-none bg-transparent"
                        />
                        <span className="text-slate-300 font-light mx-1">|</span>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                            className="border-none focus:ring-0 text-sm font-medium text-slate-700 outline-none bg-transparent"
                        />
                    </div>
                </div>
            </div>

            {/* Main Content Card */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                {/* Tabs */}
                <div className="border-b border-slate-100 flex p-4 gap-2 bg-slate-50/50">
                    <button
                        onClick={() => setActiveTab('payment')}
                        className={clsx(
                            "px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all",
                            activeTab === 'payment'
                                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        )}
                    >
                        <Wallet size={18} />
                        Por Método de Pago
                    </button>
                    <button
                        onClick={() => setActiveTab('customer')}
                        className={clsx(
                            "px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all",
                            activeTab === 'customer'
                                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        )}
                    >
                        <Users size={18} />
                        Por Cliente (Top 50)
                    </button>
                    <button
                        onClick={() => setActiveTab('product')}
                        className={clsx(
                            "px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all",
                            activeTab === 'product'
                                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        )}
                    >
                        <Package size={18} />
                        Por Producto
                    </button>
                </div >

                {/* Table Content */}
                < div className="flex-1 overflow-y-auto" >
                    {
                        loading ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400" >
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
                                Cargando datos...
                            </div>
                        ) : data.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                                <FileText size={48} className="mb-2" />
                                <p className="font-medium">No hay datos para el periodo seleccionado</p>
                            </div>
                        ) : (
                            <div className="min-w-full inline-block align-middle">
                                <div className="overflow-hidden">
                                    {activeTab === 'payment' ? (
                                        <table className="min-w-full divide-y divide-slate-100">
                                            <thead className="bg-slate-50">
                                                <tr>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Método</th>
                                                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Transacciones</th>
                                                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Total Ventas</th>
                                                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">% del Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-slate-100">
                                                {data.map((item, index) => {
                                                    const globalTotal = data.reduce((acc, curr) => acc + curr.total_amount, 0);
                                                    const percentage = globalTotal > 0 ? (item.total_amount / globalTotal) * 100 : 0;

                                                    return (
                                                        <tr key={index} className="hover:bg-slate-50 transition-colors">
                                                            <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-700">
                                                                {item.method}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-right text-slate-500 font-medium font-mono">
                                                                {item.count}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-right font-black text-slate-800">
                                                                {formatCurrency(item.total_amount)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                                <div className="flex items-center justify-end w-48 ml-auto">
                                                                    <span className="text-xs font-bold text-slate-400 mr-2 w-12 text-right">{percentage.toFixed(1)}%</span>
                                                                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                                        <div
                                                                            className="h-full bg-indigo-500 rounded-full"
                                                                            style={{ width: `${percentage}%` }}
                                                                        ></div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                <tr className="bg-slate-50 font-black border-t-2 border-slate-200">
                                                    <td className="px-6 py-4 text-slate-800">TOTAL</td>
                                                    <td className="px-6 py-4 text-right text-slate-800">
                                                        {data.reduce((acc, curr) => acc + curr.count, 0)}
                                                    </td>
                                                    <td className="px-6 py-4 text-right text-indigo-600 text-lg">
                                                        {formatCurrency(data.reduce((acc, curr) => acc + curr.total_amount, 0))}
                                                    </td>
                                                    <td></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    ) : activeTab === 'product' ? (
                                        <table className="min-w-full divide-y divide-slate-100">
                                            <thead className="bg-slate-50">
                                                <tr>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Producto</th>
                                                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Cantidad Vendida</th>
                                                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Total Generado</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-slate-100">
                                                {data.map((item, index) => (
                                                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-700">
                                                            {item.product_name}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-slate-500 font-medium font-mono">
                                                            {item.total_quantity || item.quantity}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right font-black text-slate-800">
                                                            {formatCurrency(Number(item.total_revenue || item.revenue || item.total_usd || 0))}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        // Customer Table
                                        <table className="min-w-full divide-y divide-slate-100">
                                            <thead className="bg-slate-50">
                                                <tr>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-12">#</th>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
                                                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Compras</th>
                                                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Total Comprado</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-slate-100">
                                                {data.map((item, index) => (
                                                    <tr key={index} className="hover:bg-slate-50 transition-colors group">
                                                        <td className="px-6 py-4 whitespace-nowrap text-slate-400 text-sm font-bold group-hover:text-indigo-500">
                                                            {index + 1}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-700">
                                                            {item.customer_name}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-slate-500 font-medium font-mono">
                                                            {item.transaction_count}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right font-black text-slate-800">
                                                            {formatCurrency(item.total_purchased)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        )}
                </div >
            </div >
        </div >
    );
};

export default DetailedReports;
