import React, { useState, useEffect } from 'react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import { Users, DollarSign, CheckCircle, Search, Calendar, ChevronRight, X } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';

const CommissionPayout = () => {
    const [summary, setSummary] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userDetails, setUserDetails] = useState([]);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [selectedLogIds, setSelectedLogIds] = useState([]);

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

    const handlePayout = async () => {
        if (selectedLogIds.length === 0) return;

        if (!confirm(`¿Está seguro de liquidar $${calculateSelectedTotal()} a ${selectedUser.user_name}? Esta acción registrará un egreso de caja.`)) return;

        try {
            const payload = {
                user_id: selectedUser.user_id,
                log_ids: selectedLogIds,
                payment_method: "CASH"
            };

            await apiClient.post('/commissions/payout', payload);
            toast.success("Comisiones liquidadas exitosamente");
            closeModal();
            fetchSummary();
        } catch (error) {
            console.error(error);
            toast.error("Error al procesar el pago");
        }
    };

    const calculateSelectedTotal = () => {
        const selectedItems = userDetails.filter(d => selectedLogIds.includes(d.id));
        return selectedItems.reduce((acc, curr) => acc + Number(curr.amount), 0).toFixed(2);
    };

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
                    <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">Detalle de Comisiones</h2>
                                <p className="text-sm text-gray-500">Empleado: <span className="font-bold text-blue-600">{selectedUser.user_name}</span></p>
                            </div>
                            <button onClick={closeModal} className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-full transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
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
                                            <th className="p-3 font-medium">Concepto</th>
                                            <th className="p-3 font-medium text-right">Monto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {userDetails.map((log) => (
                                            <tr key={log.id} className="hover:bg-blue-50/50 transition-colors">
                                                <td className="p-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedLogIds.includes(log.id)}
                                                        onChange={() => toggleSelection(log.id)}
                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                </td>
                                                <td className="p-3 text-sm text-gray-600">
                                                    {new Date(log.created_at).toLocaleString()}
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

                        <div className="p-6 border-t bg-gray-50 rounded-b-2xl flex justify-between items-center">
                            <div>
                                <span className="text-sm text-gray-500">Seleccionados: {selectedLogIds.length}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <span className="block text-xs text-gray-500 uppercase font-bold">Total a Pagar</span>
                                    <span className="block text-2xl font-bold text-green-600">
                                        ${calculateSelectedTotal()}
                                    </span>
                                </div>
                                <button
                                    onClick={handlePayout}
                                    disabled={selectedLogIds.length === 0}
                                    className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-green-200 transition-all flex items-center gap-2"
                                >
                                    <CheckCircle size={20} />
                                    Liquidar y Pagar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CommissionPayout;
