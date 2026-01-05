import React, { useState, useEffect } from 'react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import { Users, DollarSign, CheckCircle, Search, Calendar, ChevronRight, X } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';

import { useConfig } from '../../context/ConfigContext';

const CommissionPayout = () => {
    const { getExchangeRate, formatCurrency: formatCurrencyCtx } = useConfig();
    const [summary, setSummary] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userDetails, setUserDetails] = useState([]);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [selectedLogIds, setSelectedLogIds] = useState([]);

    // Payout Form State
    const [source, setSource] = useState('DRAWER'); // DRAWER, EXTERNAL
    const [method, setMethod] = useState('');
    const [reference, setReference] = useState('');

    useEffect(() => {
        fetchSummary();
    }, []);

    const fetchSummary = async () => {
        try {
            setLoading(true);
            const { data } = await apiClient.get('/commissions/summary');
            setSummary(data);
        } catch (error) {
            console.error(error);
            toast.error("Error al cargar resumen de comisiones");
        } finally {
            setLoading(false);
        }
    };

    const handleUserClick = async (user) => {
        setSelectedUser(user);
        try {
            setDetailsLoading(true);
            const { data } = await apiClient.get(`/commissions/details/${user.user_id}`);
            setUserDetails(data);
            // Select all by default
            setSelectedLogIds(data.map(log => log.id));
            setMethod(''); // Reset method
            setReference('');
            setSource('DRAWER');
        } catch (error) {
            toast.error("Error al cargar detalles");
        } finally {
            setDetailsLoading(false);
        }
    };

    const closeModal = () => {
        setSelectedUser(null);
        setUserDetails([]);
        setSelectedLogIds([]);
    };

    const toggleSelection = (id) => {
        if (selectedLogIds.includes(id)) {
            setSelectedLogIds(selectedLogIds.filter(pid => pid !== id));
        } else {
            setSelectedLogIds([...selectedLogIds, id]);
        }
    };

    const calculateSelectedTotal = () => {
        const selectedItems = userDetails.filter(d => selectedLogIds.includes(d.id));
        return selectedItems.reduce((acc, curr) => acc + Number(curr.amount), 0);
    };

    // Calculate Final Payment in Target Currency
    const getPaymentDetails = () => {
        const totalUSD = calculateSelectedTotal();
        const rate = getExchangeRate('VES');

        let finalAmount = totalUSD;
        let currency = 'USD';

        if (method === 'CASH_VES' || method === 'PAGO_MOVIL' || method === 'TRANSFER_VES') {
            finalAmount = totalUSD * rate;
            currency = 'VES';
        }

        return { totalUSD, finalAmount, currency, rate };
    };

    const handlePayout = async () => {
        if (selectedLogIds.length === 0) return;
        if (!method) {
            toast.error("Seleccione un método de pago");
            return;
        }
        if (source === 'EXTERNAL' && !reference) {
            toast.error("Referencia obligatoria para pagos externos");
            return;
        }

        const { totalUSD, rate } = getPaymentDetails();

        const confirmMsg = source === 'DRAWER'
            ? `¿Confirmar pago de $${totalUSD.toFixed(2)} USD?\n\n⚠️ IMPORTANTE: Recuerde RETIRAR físicamente el dinero de la caja para que coincida con el sistema.`
            : `¿Confirmar pago externo de $${totalUSD.toFixed(2)} USD?`;

        if (!confirm(confirmMsg)) return;

        try {
            const payload = {
                user_id: selectedUser.user_id,
                log_ids: selectedLogIds,
                payment_source: source,
                payment_method: method,
                amount_usd_total: totalUSD,
                exchange_rate: rate,
                reference: reference
            };

            await apiClient.post('/commissions/payout', payload);
            toast.success("Comisiones liquidadas exitosamente");
            closeModal();
            fetchSummary();
        } catch (error) {
            console.error(error);
            const msg = error.response?.data?.detail || "Error al procesar el pago";
            toast.error(msg);
        }
    };

    const { totalUSD, finalAmount, currency, rate } = selectedUser ? getPaymentDetails() : {};

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <header className="mb-8">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <DollarSign className="text-green-600" />
                    Liquidación de Comisiones
                </h1>
                <p className="text-gray-500">Gestione y pague las comisiones pendientes a sus empleados.</p>
            </header>

            {loading ? (
                <div className="text-center py-10">Cargando...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {summary.map((item) => (
                        <div
                            key={item.user_id}
                            onClick={() => handleUserClick(item)}
                            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="bg-blue-100 p-3 rounded-full text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <Users size={24} />
                                </div>
                                <div className="text-right">
                                    <span className="block text-2xl font-bold text-gray-800">
                                        {formatCurrency(item.pending_amount)}
                                    </span>
                                    <span className="text-sm text-gray-500">Pendiente</span>
                                </div>
                            </div>
                            <div className="border-t pt-4 flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-700">{item.user_name}</h3>
                                    <span className="text-xs text-gray-400">{item.count} comisiones pendientes</span>
                                </div>
                                <ChevronRight className="text-gray-300 group-hover:text-blue-500" />
                            </div>
                        </div>
                    ))}

                    {summary.length === 0 && (
                        <div className="col-span-full text-center py-10 bg-gray-50 rounded-xl border border-dashed text-gray-400">
                            No hay comisiones pendientes por liquidar.
                        </div>
                    )}
                </div>
            )}

            {/* DETAIL MODAL */}
            {selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">Liquidación de Nómina</h2>
                                <p className="text-sm text-gray-500">Beneficiario: <span className="font-bold text-blue-600">{selectedUser.user_name}</span></p>
                            </div>
                            <button onClick={closeModal} className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-full transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex flex-1 overflow-hidden">
                            {/* LEFT: List of Items */}
                            <div className="w-2/3 overflow-y-auto p-6 border-r">
                                <h3 className="font-bold text-gray-700 mb-4">Conceptos Pendientes</h3>
                                {detailsLoading ? (
                                    <div className="text-center py-10">Cargando detalles...</div>
                                ) : (
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b text-sm text-gray-500 bg-gray-50/50">
                                                <th className="p-3 w-10">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedLogIds.length === userDetails.length && userDetails.length > 0}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedLogIds(userDetails.map(u => u.id));
                                                            else setSelectedLogIds([]);
                                                        }}
                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                </th>
                                                <th className="p-3 font-medium">Fecha</th>
                                                <th className="p-3 font-medium">Origen</th>
                                                <th className="p-3 font-medium text-right">Monto</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {userDetails.map((log) => (
                                                <tr key={log.id} className={`hover:bg-blue-50/50 transition-colors ${selectedLogIds.includes(log.id) ? 'bg-blue-50/30' : ''}`}>
                                                    <td className="p-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedLogIds.includes(log.id)}
                                                            onChange={() => toggleSelection(log.id)}
                                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                        />
                                                    </td>
                                                    <td className="p-3 text-sm text-gray-600">
                                                        {new Date(log.created_at).toLocaleDateString()}
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="text-sm font-medium text-gray-700">
                                                            {log.source_type} #{log.source_reference || log.source_id}
                                                        </div>
                                                        {log.notes && <div className="text-xs text-gray-400">{log.notes}</div>}
                                                    </td>
                                                    <td className="p-3 text-right font-mono font-bold text-gray-800">
                                                        ${Number(log.amount).toFixed(2)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {/* RIGHT: Payment Logic */}
                            <div className="w-1/3 p-6 bg-gray-50 flex flex-col gap-6 overflow-y-auto">
                                <div>
                                    <h3 className="font-bold text-gray-700 mb-2">Resumen de Pago</h3>
                                    <div className="bg-white p-4 rounded-xl border shadow-sm">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-gray-500">Deuda Total (USD)</span>
                                            <span className="font-bold">${totalUSD?.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Source Switch */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Fuente de Fondos</label>
                                    <div className="grid grid-cols-2 gap-2 bg-gray-200 p-1 rounded-lg">
                                        <button
                                            onClick={() => { setSource('DRAWER'); setMethod(''); }}
                                            className={`py-2 px-3 text-sm font-bold rounded-md transition-all ${source === 'DRAWER' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
                                        >
                                            🏪 Caja (Físico)
                                        </button>
                                        <button
                                            onClick={() => { setSource('EXTERNAL'); setMethod(''); }}
                                            className={`py-2 px-3 text-sm font-bold rounded-md transition-all ${source === 'EXTERNAL' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-600 hover:text-gray-800'}`}
                                        >
                                            🏦 Externo
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">
                                        {source === 'DRAWER' ? 'Se descontará del efectivo de caja.' : 'No afecta la caja (Banco/Zelle propio).'}
                                    </p>
                                </div>

                                {/* Method Selector */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Método de Pago</label>
                                    <select
                                        value={method}
                                        onChange={(e) => setMethod(e.target.value)}
                                        className="w-full rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="">Seleccione...</option>
                                        {source === 'DRAWER' ? (
                                            <>
                                                <option value="CASH_USD">💵 Efectivo USD</option>
                                                <option value="CASH_VES">💴 Efectivo Bolívares</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="ZELLE">🇺🇸 Zelle</option>
                                                <option value="PAGO_MOVIL">📱 Pago Móvil</option>
                                                <option value="TRANSFER_VES">🏦 Transferencia Bs</option>
                                                <option value="TRANSFER_USD">🏦 Transferencia USD</option>
                                            </>
                                        )}
                                    </select>
                                </div>

                                {/* Conversion Preview */}
                                {(method === 'CASH_VES' || method === 'PAGO_MOVIL' || method === 'TRANSFER_VES') && (
                                    <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-sm text-yellow-800">
                                        <div className="flex justify-between">
                                            <span>Tasa de Cambio:</span>
                                            <span className="font-bold">{rate.toFixed(2)} Bs/$</span>
                                        </div>
                                        <div className="border-t border-yellow-200 my-2"></div>
                                        <div className="flex justify-between items-center text-lg font-bold">
                                            <span>Monto Bs:</span>
                                            <span>{finalAmount.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs</span>
                                        </div>
                                    </div>
                                )}

                                {/* Reference Field */}
                                {source === 'EXTERNAL' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Referencia / Nota</label>
                                        <input
                                            type="text"
                                            value={reference}
                                            onChange={(e) => setReference(e.target.value)}
                                            placeholder="Ej. Zelle #1234..."
                                            className="w-full rounded-lg border-gray-300 focus:ring-purple-500 focus:border-purple-500"
                                        />
                                    </div>
                                )}

                                <div className="mt-auto pt-4 border-t">
                                    <button
                                        onClick={handlePayout}
                                        disabled={selectedLogIds.length === 0 || !method || (source === 'EXTERNAL' && !reference)}
                                        className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold shadow-lg shadow-green-200 transition-all flex justify-center items-center gap-2"
                                    >
                                        <CheckCircle size={20} />
                                        Confirmar Pago
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CommissionPayout;
