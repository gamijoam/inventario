import { useState, useEffect } from 'react';
import { Search, User, Edit2, Save, X, Plus, Trash2, Users, FileText, AlertTriangle, CheckCircle, CreditCard, Calendar, Phone, Mail, MapPin } from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';

const CustomerManager = () => {
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [financialStatus, setFinancialStatus] = useState(null);
    const [creditHistory, setCreditHistory] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);

    // Edit states
    const [editingCredit, setEditingCredit] = useState(false);
    const [editingTerms, setEditingTerms] = useState(false);
    const [tempCreditLimit, setTempCreditLimit] = useState(0);
    const [tempPaymentTerms, setTempPaymentTerms] = useState(15);

    // CRUD Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [customerForm, setCustomerForm] = useState({
        name: '',
        id_number: '',
        phone: '',
        email: '',
        address: '',
        credit_limit: '',
        payment_term_days: '',
        is_blocked: false
    });

    // Helper to reset form
    const resetForm = () => {
        setCustomerForm({
            name: '',
            id_number: '',
            phone: '',
            email: '',
            address: '',
            credit_limit: '',
            payment_term_days: '',
            is_blocked: false
        });
    };

    useEffect(() => {
        fetchCustomers();
    }, []);

    useEffect(() => {
        if (selectedCustomer) {
            fetchFinancialStatus();
            fetchCreditHistory();
        }
    }, [selectedCustomer]);

    const fetchCustomers = async () => {
        try {
            const response = await apiClient.get('/customers', {
                params: { q: searchQuery, limit: 100 }
            });
            setCustomers(response.data);
        } catch (error) {
            console.error('Error fetching customers:', error);
            toast.error('Error cargando clientes');
        }
    };

    const fetchFinancialStatus = async () => {
        if (!selectedCustomer) return;
        setLoading(true);
        try {
            const response = await apiClient.get(`/customers/${selectedCustomer.id}/financial-status`);
            setFinancialStatus(response.data);
        } catch (error) {
            console.error('Error fetching financial status:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCreditHistory = async () => {
        if (!selectedCustomer) return;
        try {
            const response = await apiClient.get('/returns/sales/search', {
                params: { limit: 50 }
            });
            const customerSales = response.data.filter(
                sale => sale.customer_id === selectedCustomer.id && sale.is_credit
            );
            setCreditHistory(customerSales);
        } catch (error) {
            console.error('Error fetching credit history:', error);
        }
    };

    const handleCreateCustomer = async () => {
        try {
            await apiClient.post('/customers', customerForm);
            toast.success('Cliente creado exitosamente');
            setShowCreateModal(false);
            setCustomerForm({
                name: '',
                id_number: '',
                phone: '',
                email: '',
                address: '',
                credit_limit: 0,
                payment_term_days: 15,
                is_blocked: false
            });
            fetchCustomers();
        } catch (error) {
            toast.error('Error al crear cliente: ' + (error.response?.data?.detail || error.message));
        }
    };

    const handleEditCustomer = async () => {
        try {
            await apiClient.put(`/customers/${selectedCustomer.id}`, customerForm);
            toast.success('Cliente actualizado');
            setShowEditModal(false);
            setSelectedCustomer({ ...selectedCustomer, ...customerForm });
            fetchCustomers();
            fetchFinancialStatus();
        } catch (error) {
            toast.error('Error al actualizado cliente');
        }
    };

    const handleDeleteCustomer = async (customerId) => {
        if (!confirm('¿Estás seguro de eliminar este cliente?')) return;
        try {
            await apiClient.delete(`/customers/${customerId}`);
            toast.success('Cliente eliminado');
            if (selectedCustomer?.id === customerId) {
                setSelectedCustomer(null);
            }
            fetchCustomers();
        } catch (error) {
            toast.error('Error al eliminar cliente: ' + (error.response?.data?.detail || error.message));
        }
    };

    const handleUpdateCreditLimit = async () => {
        try {
            await apiClient.put(`/customers/${selectedCustomer.id}`, {
                ...selectedCustomer,
                credit_limit: tempCreditLimit
            });
            setSelectedCustomer({ ...selectedCustomer, credit_limit: tempCreditLimit });
            setEditingCredit(false);
            fetchFinancialStatus();
            toast.success('Límite de crédito actualizado');
        } catch (error) {
            toast.error('Error al actualizar límite de crédito');
        }
    };

    const handleUpdatePaymentTerms = async () => {
        try {
            await apiClient.put(`/customers/${selectedCustomer.id}`, {
                ...selectedCustomer,
                payment_term_days: tempPaymentTerms
            });
            setSelectedCustomer({ ...selectedCustomer, payment_term_days: tempPaymentTerms });
            setEditingTerms(false);
            fetchFinancialStatus();
            toast.success('Días de crédito actualizados');
        } catch (error) {
            toast.error('Error al actualizar días de crédito');
        }
    };

    const handleToggleBlock = async () => {
        try {
            const newBlockStatus = !selectedCustomer.is_blocked;
            await apiClient.put(`/customers/${selectedCustomer.id}`, {
                ...selectedCustomer,
                is_blocked: newBlockStatus
            });
            setSelectedCustomer({ ...selectedCustomer, is_blocked: newBlockStatus });
            fetchFinancialStatus();
            toast.success(newBlockStatus ? 'Cliente bloqueado' : 'Cliente desbloqueado');
        } catch (error) {
            toast.error('Error al cambiar estado de bloqueo');
        }
    };

    const getInvoiceStatus = (sale) => {
        if (sale.paid) return { label: 'Pagada', color: 'text-emerald-700 bg-emerald-50 border-emerald-100' };
        if (!sale.due_date) return { label: 'Pendiente', color: 'text-amber-700 bg-amber-50 border-amber-100' };

        const dueDate = new Date(sale.due_date);
        const now = new Date();
        const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));

        if (daysOverdue > 0) {
            return { label: `Vencida (+${daysOverdue}d)`, color: 'text-rose-700 bg-rose-50 border-rose-100' };
        }

        return { label: 'A Tiempo', color: 'text-emerald-700 bg-emerald-50 border-emerald-100' };
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto min-h-screen">
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
                        <Users className="text-indigo-600" size={32} />
                        Gestión de Clientes
                    </h1>
                    <p className="text-slate-500 font-medium">Administra clientes, límites de crédito y estados de cuenta</p>
                </div>
                <button
                    onClick={() => {
                        resetForm();  // Reset form before opening
                        setShowCreateModal(true);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5"
                >
                    <Plus size={20} />
                    Nuevo Cliente
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 h-[calc(100vh-140px)]">
                {/* Left Panel - Customer List */}
                <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col md:col-span-1 overflow-hidden h-full ${selectedCustomer ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-4 border-b border-slate-100">
                        <div className="relative group">
                            <Search className="absolute left-3 top-3 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    fetchCustomers();
                                }}
                                placeholder="Buscar cliente..."
                                className="w-full pl-10 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-700 bg-slate-50 focus:bg-white transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {customers.map(customer => (
                            <div
                                key={customer.id}
                                onClick={() => setSelectedCustomer(customer)}
                                className={clsx(
                                    "p-3 rounded-xl cursor-pointer transition-all border",
                                    selectedCustomer?.id === customer.id
                                        ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                                        : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'
                                )}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className={clsx(
                                            "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0",
                                            selectedCustomer?.id === customer.id ? "bg-indigo-200 text-indigo-700" : "bg-slate-100 text-slate-500"
                                        )}>
                                            {customer.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className={clsx("font-bold truncate", selectedCustomer?.id === customer.id ? "text-indigo-900" : "text-slate-700")}>
                                                {customer.name}
                                            </p>
                                            <p className={clsx("text-xs truncate", selectedCustomer?.id === customer.id ? "text-indigo-600/70" : "text-slate-400")}>
                                                {customer.id_number || 'Sin ID'}
                                            </p>
                                        </div>
                                    </div>

                                    {selectedCustomer?.id === customer.id && (
                                        <div className="flex gap-1 animate-in fade-in slide-in-from-right-2 duration-200">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setCustomerForm(customer);
                                                    setShowEditModal(true);
                                                }}
                                                className="p-1.5 text-indigo-600 hover:bg-indigo-200 rounded-lg transition-colors"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteCustomer(customer.id);
                                                }}
                                                className="p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Panel - Customer Profile */}
                <div className={`md:col-span-2 h-full flex flex-col ${!selectedCustomer ? 'hidden md:flex' : 'flex'}`}>
                    {!selectedCustomer ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 h-full flex flex-col items-center justify-center text-center p-8 border-dashed">
                            <div className="bg-slate-50 p-6 rounded-full mb-4">
                                <Users className="text-slate-300" size={64} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-700">Ningún cliente seleccionado</h3>
                            <p className="text-slate-500 max-w-sm mt-2">Selecciona un cliente de la lista para ver su perfil, historial de crédito y gestionar sus datos.</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
                            {/* Mobile Back Button */}
                            <button
                                onClick={() => setSelectedCustomer(null)}
                                className="md:hidden flex items-center text-slate-500 font-bold mb-2 hover:bg-slate-100 p-2 rounded-lg self-start"
                            >
                                <Users className="mr-2" size={20} /> Volver a lista
                            </button>

                            {/* Header Card */}
                            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl shadow-lg p-6 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-32 bg-white opacity-5 rounded-full blur-3xl transform translate-x-10 -translate-y-10"></div>
                                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start gap-6">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <h2 className="text-3xl font-bold tracking-tight">{selectedCustomer.name}</h2>
                                            {selectedCustomer.is_blocked && (
                                                <span className="bg-rose-500/20 text-rose-200 border border-rose-500/30 px-3 py-0.5 rounded-lg text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
                                                    Bloqueado
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-4 text-slate-300 text-sm font-medium">
                                            <div className="flex items-center gap-1.5"><CreditCard size={14} /> {selectedCustomer.id_number || 'No ID'}</div>
                                            <div className="flex items-center gap-1.5"><Phone size={14} /> {selectedCustomer.phone || 'No Tel'}</div>
                                            <div className="flex items-center gap-1.5"><Mail size={14} /> {selectedCustomer.email || 'No Email'}</div>
                                        </div>
                                    </div>

                                    <div className="bg-white/10 backdrop-blur-md p-1 rounded-xl flex items-center">
                                        <label className={clsx(
                                            "flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all select-none",
                                            selectedCustomer.is_blocked
                                                ? "bg-rose-500/20 text-rose-200"
                                                : "hover:bg-white/10 text-slate-300 hover:text-white"
                                        )}>
                                            <div className="relative">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCustomer.is_blocked || false}
                                                    onChange={handleToggleBlock}
                                                    className="sr-only"
                                                />
                                                <div className={clsx("w-8 h-4 rounded-full transition-colors", selectedCustomer.is_blocked ? "bg-rose-500" : "bg-slate-600")}></div>
                                                <div className={clsx("absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform", selectedCustomer.is_blocked ? "translate-x-4" : "translate-x-0")}></div>
                                            </div>
                                            <span className="font-bold text-xs uppercase tracking-wider">Bloqueo Crédito</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Financial KPIs */}
                            {loading ? (
                                <div className="text-center p-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                                    <p className="text-slate-400">Cargando datos financieros...</p>
                                </div>
                            ) : financialStatus && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {/* Credit Limit */}
                                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 group hover:border-indigo-200 transition-colors">
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Límite Crédito</p>
                                            {!editingCredit ? (
                                                <button
                                                    onClick={() => { setEditingCredit(true); setTempCreditLimit(financialStatus.credit_limit); }}
                                                    className="text-indigo-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <button onClick={handleUpdateCreditLimit} className="text-emerald-600 hover:bg-emerald-50 rounded p-1"><CheckCircle size={14} /></button>
                                                    <button onClick={() => setEditingCredit(false)} className="text-rose-600 hover:bg-rose-50 rounded p-1"><X size={14} /></button>
                                                </div>
                                            )}
                                        </div>
                                        {editingCredit ? (
                                            <input
                                                type="number"
                                                value={tempCreditLimit}
                                                onChange={(e) => setTempCreditLimit(parseFloat(e.target.value))}
                                                className="w-full text-xl font-bold text-slate-800 border-b-2 border-indigo-500 focus:outline-none bg-transparent"
                                                autoFocus
                                            />
                                        ) : (
                                            <p className="text-2xl font-black text-slate-800 tracking-tight">
                                                ${financialStatus.credit_limit.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                                            </p>
                                        )}
                                    </div>

                                    {/* Current Debt */}
                                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Deuda Actual</p>
                                        <p className={clsx("text-2xl font-black tracking-tight",
                                            financialStatus.total_debt > financialStatus.credit_limit * 0.8 ? 'text-rose-600' : 'text-slate-800'
                                        )}>
                                            ${financialStatus.total_debt.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>

                                    {/* Available Credit */}
                                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Cupo Disponible</p>
                                        <p className="text-2xl font-black text-emerald-600 tracking-tight">
                                            ${financialStatus.available_credit.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>

                                    {/* Payment Terms */}
                                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 group hover:border-indigo-200 transition-colors">
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Días Crédito</p>
                                            {!editingTerms ? (
                                                <button
                                                    onClick={() => { setEditingTerms(true); setTempPaymentTerms(financialStatus.payment_term_days); }}
                                                    className="text-indigo-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <button onClick={handleUpdatePaymentTerms} className="text-emerald-600 hover:bg-emerald-50 rounded p-1"><CheckCircle size={14} /></button>
                                                    <button onClick={() => setEditingTerms(false)} className="text-rose-600 hover:bg-rose-50 rounded p-1"><X size={14} /></button>
                                                </div>
                                            )}
                                        </div>
                                        {editingTerms ? (
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    value={tempPaymentTerms}
                                                    onChange={(e) => setTempPaymentTerms(parseInt(e.target.value))}
                                                    className="w-full text-xl font-bold text-indigo-600 border-b-2 border-indigo-500 focus:outline-none bg-transparent"
                                                    autoFocus
                                                />
                                            </div>
                                        ) : (
                                            <p className="text-2xl font-black text-indigo-600 tracking-tight">
                                                {financialStatus.payment_term_days} <span className="text-sm font-bold text-indigo-300 uppercase">días</span>
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Overdue Alert */}
                            {financialStatus && financialStatus.overdue_invoices > 0 && (
                                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-center gap-4 animate-pulse">
                                    <div className="bg-rose-100 p-2 rounded-full text-rose-600">
                                        <AlertTriangle size={24} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-rose-800 text-lg">
                                            {financialStatus.overdue_invoices} Factura(s) Vencida(s)
                                        </p>
                                        <p className="text-rose-600 font-medium text-sm">
                                            Monto total vencido: <span className="font-bold">${financialStatus.overdue_amount.toFixed(2)}</span>
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Credit History */}
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
                                <div className="p-5 border-b border-slate-100 bg-white">
                                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                        <FileText size={20} className="text-slate-400" />
                                        Historial de Crédito
                                    </h3>
                                </div>
                                <div className="flex-1 overflow-auto">
                                    <table className="w-full">
                                        <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                                            <tr>
                                                <th className="text-left py-3 px-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Factura</th>
                                                <th className="text-left py-3 px-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Emisión</th>
                                                <th className="text-right py-3 px-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Monto</th>
                                                <th className="text-left py-3 px-5 text-xs font-bold text-slate-500 uppercase tracking-wider pl-8">Vencimiento</th>
                                                <th className="text-center py-3 px-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {creditHistory.length === 0 ? (
                                                <tr>
                                                    <td colSpan="5" className="text-center py-12 text-slate-400">
                                                        <FileText size={48} className="mx-auto mb-3 opacity-20" />
                                                        <p>No hay historial de crédito disponible</p>
                                                    </td>
                                                </tr>
                                            ) : (
                                                creditHistory.map((sale, idx) => {
                                                    const status = getInvoiceStatus(sale);
                                                    return (
                                                        <tr key={sale.id} className={clsx("hover:bg-slate-50/80 transition-colors", idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30')}>
                                                            <td className="py-3 px-5 font-bold text-indigo-600">#{sale.id}</td>
                                                            <td className="py-3 px-5 text-slate-600 text-sm">
                                                                {new Date(sale.date).toLocaleDateString('es-ES')}
                                                            </td>
                                                            <td className="py-3 px-5 text-right font-bold text-slate-800">
                                                                ${sale.total_amount.toFixed(2)}
                                                            </td>
                                                            <td className="py-3 px-5 text-slate-600 pl-8 text-sm">
                                                                {sale.due_date ? new Date(sale.due_date).toLocaleDateString('es-ES') : '-'}
                                                            </td>
                                                            <td className="py-3 px-5 text-center">
                                                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${status.color}`}>
                                                                    {status.label}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Create/Edit Modal */}
            {(showCreateModal || showEditModal) && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform scale-100 transition-all">
                        <div className="p-5 border-b border-slate-100 bg-white sticky top-0 z-10 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                {showCreateModal ? <Plus className="text-indigo-600" size={24} /> : <Edit2 className="text-indigo-600" size={24} />}
                                {showCreateModal ? 'Nuevo Cliente' : 'Editar Cliente'}
                            </h3>
                            <button onClick={() => { setShowCreateModal(false); setShowEditModal(false); }} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nombre Completo *</label>
                                <input
                                    type="text"
                                    value={customerForm.name}
                                    onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-700 placeholder:text-slate-300"
                                    placeholder="Ej: Juan Pérez"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">RIF / Cédula</label>
                                    <div className="relative">
                                        <CreditCard className="absolute left-3 top-3 text-slate-400" size={18} />
                                        <input
                                            type="text"
                                            value={customerForm.id_number}
                                            onChange={(e) => setCustomerForm({ ...customerForm, id_number: e.target.value })}
                                            className="w-full pl-10 pr-4 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-700 placeholder:text-slate-300"
                                            placeholder="V-12345678"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Teléfono</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-3 text-slate-400" size={18} />
                                        <input
                                            type="text"
                                            value={customerForm.phone}
                                            onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                                            className="w-full pl-10 pr-4 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-700 placeholder:text-slate-300"
                                            placeholder="0414-1234567"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                                    <input
                                        type="email"
                                        value={customerForm.email}
                                        onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                                        className="w-full pl-10 pr-4 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-700 placeholder:text-slate-300"
                                        placeholder="cliente@email.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Dirección</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-3 text-slate-400" size={18} />
                                    <textarea
                                        value={customerForm.address}
                                        onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                                        className="w-full pl-10 pr-4 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-700 resize-none placeholder:text-slate-300"
                                        rows="2"
                                        placeholder="Dirección fiscal..."
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Límite Crédito ($)</label>
                                    <input
                                        type="number"
                                        value={customerForm.credit_limit}
                                        onChange={(e) => setCustomerForm({ ...customerForm, credit_limit: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                                        className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-bold text-slate-700"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Plazo (Días)</label>
                                    <input
                                        type="number"
                                        value={customerForm.payment_term_days}
                                        onChange={(e) => setCustomerForm({ ...customerForm, payment_term_days: e.target.value === '' ? '' : parseInt(e.target.value) })}
                                        className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-bold text-slate-700"
                                        placeholder="15"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                            <button
                                onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}
                                className="flex-1 py-2.5 font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={showCreateModal ? handleCreateCustomer : handleEditCustomer}
                                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 transition-all active:scale-95"
                            >
                                {showCreateModal ? 'Crear Cliente' : 'Guardar Cambios'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerManager;
