import { useState, useEffect, useMemo } from 'react';
import {
    DollarSign, Search, CheckCircle, Download, AlertTriangle,
    X, TrendingUp
} from 'lucide-react';
import apiClient from '../../../config/axios';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';

// ---------------------------------------------------------------------------
// Inline confirmation modal (no window.confirm)
// ---------------------------------------------------------------------------
const ConfirmPayModal = ({ commission, employeeName, onConfirm, onCancel, isProcessing }) => {
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
                        Se liquidara la comision y se registrara un egreso en la caja activa.
                    </p>
                    <div className="bg-slate-50 rounded-xl p-4 space-y-2 border border-slate-100">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Barbero / Estilista</span>
                            <span className="font-bold text-slate-800">{employeeName}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Venta base</span>
                            <span className="font-medium text-slate-700">
                                ${parseFloat(commission.base_amount).toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between text-base border-t border-slate-200 pt-2 mt-2">
                            <span className="font-bold text-slate-700">Comision a pagar</span>
                            <span className="font-black text-emerald-600">
                                ${parseFloat(commission.calculated_commission).toFixed(2)}
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

// ---------------------------------------------------------------------------
// Currency helper
// ---------------------------------------------------------------------------
const formatUSD = (amount) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
    }).format(Number(amount) || 0);

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------
const CommissionsTab = ({ dateRange }) => {
    const [commissions, setCommissions] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');

    // Inline confirmation state
    const [pendingPayment, setPendingPayment] = useState(null);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [commRes, empRes] = await Promise.all([
                apiClient.get('/employees/commissions'),
                apiClient.get('/employees/'),
            ]);
            setCommissions(commRes.data);
            setEmployees(empRes.data);
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

    const getEmployeeName = (id) => {
        const emp = employees.find(e => e.id === id);
        return emp ? emp.name : `ID: ${id}`;
    };

    const handlePayClick = (comm) => setPendingPayment(comm);

    const handleConfirmPay = async () => {
        if (!pendingPayment) return;
        setIsProcessing(true);
        try {
            const response = await apiClient.post(`/employees/commissions/${pendingPayment.id}/pay`);
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
            toast.error(typeof detail === 'string' ? detail : 'Error al procesar el pago de comision');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCancelPay = () => {
        if (!isProcessing) setPendingPayment(null);
    };

    // Filtering
    const filtered = useMemo(() => {
        return commissions.filter(c => {
            const empName = getEmployeeName(c.employee_id).toLowerCase();
            const matchesSearch = empName.includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [commissions, employees, searchTerm, statusFilter]);

    // Summary cards (only pending)
    const pendingFiltered = useMemo(
        () => filtered.filter(c => c.status === 'PENDING'),
        [filtered]
    );
    const totalComisiones = pendingFiltered.reduce((acc, curr) => acc + parseFloat(curr.calculated_commission || 0), 0);
    const totalVentasBase = pendingFiltered.reduce((acc, curr) => acc + parseFloat(curr.base_amount || 0), 0);

    // Format date
    const fmtDate = (dateStr) => {
        try {
            return new Date(dateStr).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    // ---------------------------------------------------------------------------
    // RENDER
    // ---------------------------------------------------------------------------
    return (
        <div className="space-y-6">
            {/* Confirmation Modal */}
            <ConfirmPayModal
                commission={pendingPayment}
                employeeName={pendingPayment ? getEmployeeName(pendingPayment.employee_id) : ''}
                onConfirm={handleConfirmPay}
                onCancel={handleCancelPay}
                isProcessing={isProcessing}
            />

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 group hover:-translate-y-0.5">
                    <div className="flex justify-between items-start mb-3">
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Pendiente de Pago</p>
                        <div className="p-2 rounded-lg bg-emerald-500 bg-opacity-10 group-hover:bg-opacity-20 transition-colors">
                            <DollarSign size={16} className="text-emerald-500" />
                        </div>
                    </div>
                    <h3 className="text-2xl font-black text-emerald-600 tracking-tight">{formatUSD(totalComisiones)}</h3>
                    <p className="text-xs text-slate-400 font-medium mt-1">{pendingFiltered.length} comisiones pendientes</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 group hover:-translate-y-0.5">
                    <div className="flex justify-between items-start mb-3">
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Volumen Generado</p>
                        <div className="p-2 rounded-lg bg-indigo-500 bg-opacity-10 group-hover:bg-opacity-20 transition-colors">
                            <TrendingUp size={16} className="text-indigo-500" />
                        </div>
                    </div>
                    <h3 className="text-2xl font-black text-indigo-600 tracking-tight">{formatUSD(totalVentasBase)}</h3>
                    <p className="text-xs text-slate-400 font-medium mt-1">Ventas base de servicios</p>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Toolbar */}
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
                    <div className="relative w-full sm:w-80">
                        <Search className="w-5 h-5 absolute left-3 top-2.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre de empleado..."
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow bg-white text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <select
                            className="border border-slate-200 rounded-xl px-4 py-2 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-medium"
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                        >
                            <option value="ALL">Todos los Estados</option>
                            <option value="PENDING">Pendientes</option>
                            <option value="PAID">Pagadas</option>
                        </select>
                        <button className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl transition-colors font-medium text-sm">
                            <Download className="w-4 h-4" />
                            <span className="hidden sm:inline">Exportar</span>
                        </button>
                    </div>
                </div>

                {/* Data */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50/80 text-slate-500 text-xs font-bold uppercase tracking-wider">
                            <tr>
                                <th className="p-4 text-left">Fecha</th>
                                <th className="p-4 text-left">Empleado</th>
                                <th className="p-4 text-right">Venta Base</th>
                                <th className="p-4 text-right">Comision</th>
                                <th className="p-4 text-center">Estado</th>
                                <th className="p-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="6" className="p-12 text-center text-slate-400">
                                        <div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full mx-auto mb-3" />
                                        Cargando comisiones...
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-12 text-center text-slate-400">
                                        No se encontraron registros de comision
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(comm => (
                                    <tr key={comm.id} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="p-4 text-slate-600 font-medium">
                                            {fmtDate(comm.created_at)}
                                        </td>
                                        <td className="p-4 font-bold text-slate-800">
                                            {getEmployeeName(comm.employee_id)}
                                        </td>
                                        <td className="p-4 text-right font-medium text-slate-600">
                                            ${parseFloat(comm.base_amount || 0).toFixed(2)}
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg border border-emerald-200">
                                                ${parseFloat(comm.calculated_commission || 0).toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            {comm.status === 'PENDING' ? (
                                                <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
                                                    PENDIENTE
                                                </span>
                                            ) : (
                                                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
                                                    PAGADO
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            {comm.status === 'PENDING' && (
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

export default CommissionsTab;
