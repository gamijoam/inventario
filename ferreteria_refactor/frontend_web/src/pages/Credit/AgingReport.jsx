import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';

const AgingReport = () => {
    const [report, setReport] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchReport();
    }, []);

    const fetchReport = async () => {
        try {
            const response = await apiClient.get('/credits/aging-report');
            // Sort by total debt descending
            const sorted = response.data.sort((a, b) => b.total_debt - a.total_debt);
            setReport(sorted);
        } catch (error) {
            console.error('Error fetching aging report:', error);
            toast.error('Error al cargar reporte de antigüedad');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(amount);
    };

    return (
        <div className="p-4 md:p-6">
            <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold">Reporte de Antigüedad de Deuda</h1>
                    <p className="text-gray-500 text-sm">Análisis de deuda por cliente</p>
                </div>
                <button onClick={() => navigate('/credit')} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm whitespace-nowrap">
                    Volver a Crédito
                </button>
            </div>

            {loading ? (
                <div className="text-center py-10">Cargando reporte...</div>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-x-auto">
                    <table className="min-w-[600px] w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                                <th className="px-3 md:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Deuda Total</th>
                                <th className="px-3 md:px-6 py-3 text-right text-xs font-medium text-green-600 uppercase tracking-wider">Corriente (0-15)</th>
                                <th className="px-3 md:px-6 py-3 text-right text-xs font-medium text-yellow-600 uppercase tracking-wider">15-30 Días</th>
                                <th className="px-3 md:px-6 py-3 text-right text-xs font-medium text-orange-600 uppercase tracking-wider">30-60 Días</th>
                                <th className="px-3 md:px-6 py-3 text-right text-xs font-medium text-red-600 uppercase tracking-wider">60+ Vencido</th>
                                <th className="px-3 md:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {report.map((item) => (
                                <tr key={item.client_id} className="hover:bg-gray-50">
                                    <td className="px-3 md:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {item.client_name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                                        {formatCurrency(item.total_debt)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-700 bg-green-50 font-medium">
                                        {item.current > 0 ? formatCurrency(item.current) : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-yellow-700 bg-yellow-50 font-medium">
                                        {item.days_15_30 > 0 ? formatCurrency(item.days_15_30) : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-orange-700 bg-orange-50 font-medium">
                                        {item.days_30_60 > 0 ? formatCurrency(item.days_30_60) : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-white bg-red-600 font-bold">
                                        {item.days_60_plus > 0 ? formatCurrency(item.days_60_plus) : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                        <button
                                            onClick={() => navigate(`/credit/ledger/${item.client_id}`)}
                                            className="text-indigo-600 hover:text-indigo-900 font-medium"
                                        >
                                            Ver Estado
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {report.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="px-6 py-10 text-center text-gray-500">
                                        No hay deudas pendientes.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AgingReport;
