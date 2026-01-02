import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';

// Simple local component for currency formatting since the shared one wasn't found
const FormatCurrency = ({ amount, currency = 'USD' }) => {
    const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
    }).format(amount || 0);
    return <span>{formatted}</span>;
};

const ClientLedger = () => {
    const { clientId } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (clientId) {
            fetchLedger();
        }
    }, [clientId]);

    const fetchLedger = async () => {
        try {
            const response = await apiClient.get(`/credits/client/${clientId}/ledger`);
            setData(response.data);
        } catch (error) {
            console.error('Error fetching ledger:', error);
            toast.error('Error al cargar estado de cuenta');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) return <div className="p-10 text-center">Cargando estado de cuenta...</div>;

    if (!data) return <div className="p-10 text-center">No se encontraron datos.</div>;

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 bg-white p-4 rounded-lg shadow print:shadow-none">
                <div>
                    <button
                        onClick={() => navigate('/credit/aging')}
                        className="text-gray-500 hover:text-gray-700 text-sm mb-2 print:hidden"
                    >
                        &larr; Volver a Reporte Aging
                    </button>
                    <h1 className="text-2xl font-bold text-gray-800">{data.client.name}</h1>
                    <p className="text-gray-500">ID Cliente: {data.client.id}</p>
                </div>
                <div className="mt-4 md:mt-0 text-right">
                    <div className="text-sm text-gray-500">Saldo Actual</div>
                    <div className={`text-3xl font-bold ${data.current_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        <FormatCurrency amount={data.current_balance} currency="USD" />
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Límite: <FormatCurrency amount={data.client.limit} currency="USD" /></div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="mb-4 flex justify-end print:hidden">
                <button
                    onClick={handlePrint}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center"
                >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Imprimir Estado
                </button>
            </div>

            {/* Ledger Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden print:shadow-none">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 print:bg-gray-100">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referencia</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cargo (Venta)</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Abono (Pago)</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Saldo</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {data.ledger.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="px-6 py-10 text-center text-gray-500">
                                    No hay movimientos registrados.
                                </td>
                            </tr>
                        ) : (
                            data.ledger.map((row, index) => (
                                <tr key={index} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {row.date ? new Date(row.date).toLocaleDateString() : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-normal text-sm text-gray-900">
                                        {row.ref}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${row.type === 'VENTA' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                                            }`}>
                                            {row.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                                        {row.type === 'VENTA' ? <FormatCurrency amount={row.debit} currency="USD" /> : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                                        {row.type === 'ABONO' ? <FormatCurrency amount={row.credit} currency="USD" /> : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                                        <FormatCurrency amount={row.balance} currency="USD" />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                    <tfoot className="bg-gray-50 font-bold">
                        <tr>
                            <td colSpan="5" className="px-6 py-4 text-right text-sm text-gray-900">Saldo Final:</td>
                            <td className="px-6 py-4 text-right text-sm text-gray-900">
                                <FormatCurrency amount={data.current_balance} currency="USD" />
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

export default ClientLedger;
