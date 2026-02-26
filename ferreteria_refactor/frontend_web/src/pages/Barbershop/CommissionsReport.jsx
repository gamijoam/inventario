import React, { useState, useEffect } from 'react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import {
    DollarSign, Search, Filter, CheckCircle, Download
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const CommissionsReport = () => {
    const [commissions, setCommissions] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [commRes, empRes] = await Promise.all([
                apiClient.get('/employees/commissions'),
                apiClient.get('/employees/')
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

    const handleMarkAsPaid = async (comm) => {
        if (!window.confirm(`¿Confirmar pago de comisión por $${parseFloat(comm.calculated_commission).toFixed(2)} a ${getEmployeeName(comm.employee_id)}?`)) {
            return;
        }

        setIsProcessing(true);
        try {
            const payload = {
                employee_id: comm.employee_id,
                commission_ids: [comm.id],
                payment_method: "Efectivo",
                notes: `Pago individual desde reporte de comisiones - Servicio ID: ${comm.sale_item_id}`
            };

            const response = await apiClient.post('/employees/payout', payload);

            if (response.data.success) {
                toast.success(response.data.message);
                loadData();
            } else {
                toast.error(response.data.message || "Error al procesar pago");
            }
        } catch (error) {
            console.error("Payout error:", error);
            const detail = error.response?.data?.detail;
            toast.error(typeof detail === 'string' ? detail : 'Error al procesar el pago de comisión');
        } finally {
            setIsProcessing(false);
        }
    };

    const filtered = commissions.filter(c => {
        const empName = getEmployeeName(c.employee_id).toLowerCase();
        const matchesSearch = empName.includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const totalComisiones = filtered.reduce((acc, curr) => acc + parseFloat(curr.calculated_commission), 0);
    const totalVentasBase = filtered.reduce((acc, curr) => acc + parseFloat(curr.base_amount), 0);

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600">
                        <DollarSign className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Reporte de Comisiones</h1>
                        <p className="text-slate-500 text-sm mt-1">Historial de servicios y comisiones generadas por estilistas</p>
                    </div>
                </div>

                <div className="flex gap-4">
                    <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total a Pagar</p>
                        <p className="text-xl font-bold text-emerald-600">${totalComisiones.toFixed(2)}</p>
                    </div>
                    <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Volumen Generado</p>
                        <p className="text-xl font-bold text-indigo-600">${totalVentasBase.toFixed(2)}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
                    <div className="relative w-full sm:w-80">
                        <Search className="w-5 h-5 absolute left-3 top-2.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por barbero..."
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
                                <th className="p-4 font-semibold uppercase tracking-wider text-xs">Barbero / Estilista</th>
                                <th className="p-4 font-semibold uppercase tracking-wider text-xs text-right">Venta Base</th>
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
                                            {getEmployeeName(comm.employee_id)}
                                        </td>
                                        <td className="p-4 text-right font-medium text-slate-600">
                                            ${parseFloat(comm.base_amount).toFixed(2)}
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg border border-emerald-200">
                                                ${parseFloat(comm.calculated_commission).toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            {comm.status === 'PENDING'
                                                ? <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">PENDIENTE</span>
                                                : <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">PAGADO</span>
                                            }
                                        </td>
                                        <td className="p-4 text-center">
                                            {comm.status === 'PENDING' && (
                                                <button
                                                    onClick={() => handleMarkAsPaid(comm)}
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
