import { useState, useEffect } from 'react';
import { BarChart, Wallet, Calendar, Users, ArrowUpRight, Download } from 'lucide-react';
import apiClient from '../../config/axios';
import { useConfig } from '../../context/ConfigContext';

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
            const endpoint = activeTab === 'payment'
                ? '/reports/sales/by-payment-method'
                : '/reports/sales/by-customer';

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
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [activeTab, dateRange]);

    return (
        <div className="container mx-auto pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                        <BarChart className="mr-2 text-blue-600" /> Reportes Avanzados
                    </h1>
                    <p className="text-gray-500">Análisis detallado de ventas</p>
                </div>

                {/* Date Picker */}
                <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-gray-100">
                    <Calendar size={18} className="text-gray-400 ml-2" />
                    <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                        className="border-none focus:ring-0 text-sm text-gray-600"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                        className="border-none focus:ring-0 text-sm text-gray-600"
                    />
                </div>
            </div>

            {/* Export Button */}
            <button
                onClick={async () => {
                    try {
                        const response = await apiClient.get('/reports/export/detailed', {
                            params: {
                                start_date: dateRange.start,
                                end_date: dateRange.end,
                                format: 'xlsx'
                            },
                            responseType: 'blob' // Important for file download
                        });

                        // Create download link
                        const url = window.URL.createObjectURL(new Blob([response.data]));
                        const link = document.createElement('a');
                        link.href = url;
                        link.setAttribute('download', `Reporte_Completo_${dateRange.start}.xlsx`);
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                    } catch (error) {
                        console.error("Download failed:", error);
                        alert("Error al descargar el reporte");
                    }
                }}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-sm"
            >
                <Download size={18} />
                <span>Exportar Excel</span>
            </button>


            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('payment')}
                    className={`pb-3 px-4 font-medium text-sm flex items-center transition-colors ${activeTab === 'payment'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Wallet size={18} className="mr-2" />
                    Por Método de Pago
                </button>
                <button
                    onClick={() => setActiveTab('customer')}
                    className={`pb-3 px-4 font-medium text-sm flex items-center transition-colors ${activeTab === 'customer'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Users size={18} className="mr-2" />
                    Por Cliente (Top 50)
                </button>
            </div>

            {/* Content */}
            {
                loading ? (
                    <div className="p-12 text-center text-gray-400">Cargando datos...</div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-fade-in-up">
                        {data.length === 0 ? (
                            <div className="p-12 text-center text-gray-400">No hay datos para el periodo seleccionado.</div>
                        ) : (
                            activeTab === 'payment' ? (
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Método</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Transacciones</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Ventas</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">% del Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {data.map((item, index) => {
                                            const globalTotal = data.reduce((acc, curr) => acc + curr.total_amount, 0);
                                            const percentage = globalTotal > 0 ? (item.total_amount / globalTotal) * 100 : 0;

                                            return (
                                                <tr key={index} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                                                        {item.method}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-500">
                                                        {item.count}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-gray-900">
                                                        {formatCurrency(item.total_amount)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                                        <div className="flex items-center justify-end">
                                                            <span className="text-xs text-gray-500 mr-2">{percentage.toFixed(1)}%</span>
                                                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-blue-500"
                                                                    style={{ width: `${percentage}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        <tr className="bg-gray-50 font-bold">
                                            <td className="px-6 py-4 text-gray-900">TOTAL</td>
                                            <td className="px-6 py-4 text-right text-gray-900">
                                                {data.reduce((acc, curr) => acc + curr.count, 0)}
                                            </td>
                                            <td className="px-6 py-4 text-right text-blue-600 text-lg">
                                                {formatCurrency(data.reduce((acc, curr) => acc + curr.total_amount, 0))}
                                            </td>
                                            <td></td>
                                        </tr>
                                    </tbody>
                                </table>
                            ) : (
                                // Customer Table
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Compras</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Comprado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {data.map((item, index) => (
                                            <tr key={index} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-400 text-sm">
                                                    {index + 1}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                                                    {item.customer_name}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-gray-500">
                                                    {item.transaction_count}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-gray-900">
                                                    {formatCurrency(item.total_purchased)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )
                        )}
                    </div>
                )
            }
        </div >
    );
};

export default DetailedReports;
