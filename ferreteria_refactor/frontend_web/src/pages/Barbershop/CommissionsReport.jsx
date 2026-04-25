import React, { useState, useEffect } from 'react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import {
    DollarSign, Search, CheckCircle, Download, AlertTriangle, X
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../../context/AuthContext';
import { normalizeSearch } from '../../utils/search';

// Inline confirmation modal
const ConfirmPayModal = ({ commission, onConfirm, onCancel, isProcessing }) => {
    if (!commission) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-amber-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-xl text-amber-600">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">Confirmar Pago</h3>
                    </div>
                    <button
                        onClick={onCancel}
                        disabled={isProcessing}
                        className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <p className="text-slate-600 text-sm">
                        Se liquidará la comisión y se registrará un egreso en la caja activa.
                    </p>
                    <div className="bg-slate-50 rounded-xl p-4 space-y-2 border border-slate-100">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Vendedor</span>
                            <span className="font-bold text-slate-800">{commission.user_name}</span>
                        </div>
                        {commission.percentage_applied && (
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Porcentaje aplicado</span>
                                <span className="font-medium text-slate-700">
                                    {parseFloat(commission.percentage_applied).toFixed(1)}%
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between text-base border-t border-slate-200 pt-2 mt-2">
                            <span className="font-bold text-slate-700">Comisión a pagar</span>
                            <span className="font-black text-emerald-600">
                                ${parseFloat(commission.amount).toFixed(2)}
                            </span>
                        </div>
                    </div>
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        Recuerde retirar fisicamente el dinero de la caja para que coincida con el sistema.
                    </p>
                </div>
                <div className="px-5 pb-5 flex gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isProcessing}
                        className="flex-1 px-4 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isProcessing}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors shadow-sm disabled:opacity-60"
                    >
                        {isProcessing ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <CheckCircle className="w-4 h-4" />
                        )}
                        {isProcessing ? 'Procesando...' : 'Confirmar Pago'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const CommissionsReport = () => {
    const { user } = useAuth();
    const [commissions, setCommissions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');

    const [pendingPayment, setPendingPayment] = useState(null);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const res = await apiClient.get('/employees/commissions');
            setCommissions(res.data);
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar datos de comisiones');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handlePayClick = (comm) => {
        setPendingPayment(comm);
    };

    const handleConfirmPay = async () => {
        if (!pendingPayment) return;

        setIsProcessing(true);
        try {
            const response = await apiClient.post(
                `/employees/commissions/${pendingPayment.id}/pay`
            );

            if (response.data.success) {
                toast.success(response.data.message);
                setPendingPayment(null);
                loadData();
            } else {
                toast.error(response.data.message || 'Error al procesar pago');
            }
        } catch (error) {
            console.error('Payout error:', error);
            const detail = error.response?.data?.detail;
            toast.error(typeof detail === 'string' ? detail : 'Error al procesar el pago de comisión');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCancelPay = () => {
        if (!isProcessing) setPendingPayment(null);
    };

    const filtered = commissions.filter(c => {
        const name = (c.user_name || '').toLowerCase();
        const matchesSearch = normalizeSearch(name).includes(normalizeSearch(searchTerm));
        const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const pendingFiltered = filtered.filter(c => c.status === 'PENDING');
    const totalComisiones = pendingFiltered.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-6">
            <ConfirmPayModal
                commission={pendingPayment}
                onConfirm={handleConfirmPay}
                onCancel={handleCancelPay}
                isProcessing={isProcessing}
            />

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600">
                        <DollarSign className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Reporte de Comisiones</h1>
                        <p className="text-slate-500 text-sm mt-1">Historial de comisiones generadas por ventas</p>
                    </div>
                </div>

                <div className="flex gap-4">
                    <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Pendiente de Pago</p>
                        <p className="text-xl font-bold text-emerald-600">${totalComisiones.toFixed(2)}</p>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
                    <div className="relative w-full sm:w-80">
                        <Search className="w-5 h-5 absolute left-3 top-2.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por vendedor..."
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow bg-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <select
                            className="border border-slate-200 rounded-xl px-4 py-2 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                        >
                            <option value="ALL">Todos los Estados</option>
                            <option value="PENDING">Pendientes</option>
                            <option value="PAID">Pagadas</option>
                        </select>
                        <button className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl transition-colors font-medium">
                            <Download className="w-5 h-5" />
                            <span className="hidden sm:inline">Exportar</span>
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-600 text-sm border-b border-slate-100">
                                <th className="p-4 font-semibold uppercase tracking-wider text-xs">Fecha</th>
                                <th className="p-4 font-semibold uppercase tracking-wider text-xs">Vendedor</th>
                                <th className="p-4 font-semibold uppercase tracking-wider text-xs">Tipo</th>
                                <th className="p-4 font-semibold uppercase tracking-wider text-xs text-right">Comisión</th>
                                <th className="p-4 font-semibold uppercase tracking-wider text-xs text-center">Estado</th>
                                <th className="p-4 font-semibold uppercase tracking-wider text-xs text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-slate-500">
                                        <div className="animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                                        Cargando comisiones...
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-slate-500">
                                        No se encontraron registros de comisión
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(comm => (
                                    <tr key={comm.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 text-slate-600 font-medium">
                                            {format(new Date(comm.created_at), "dd MMM yyyy, p", { locale: es })}
                                        </td>
                                        <td className="p-4 font-bold text-slate-800">
                                            {comm.user_name}
                                        </td>
                                        <td className="p-4 text-slate-500 text-sm">
                                            {comm.source_type === 'SERVICE' ? 'Servicio' : 'Venta'}
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg border border-emerald-200">
                                                ${parseFloat(comm.amount).toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            {comm.status === 'PENDING'
                                                ? <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">PENDIENTE</span>
                                                : <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">PAGADO</span>
                                            }
                                        </td>
                                        <td className="p-4 text-center">
                                            {comm.status === 'PENDING' && user?.role === 'ADMIN' && (
                                                <button
                                                    onClick={() => handlePayClick(comm)}
                                                    className="inline-flex items-center gap-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                                                    disabled={isProcessing}
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                    Pagar
                                                </button>
                                            )}
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

export default CommissionsReport;
