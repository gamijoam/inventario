import { useState, useEffect } from 'react';
import Customer360 from '../../../components/customers/Customer360';
import { Zap, Search, User, Edit2, Save, X, Plus, Trash2, Users, FileText, AlertTriangle, CheckCircle, CreditCard, Calendar, Phone, Mail, MapPin, Building2, Truck, Check, RotateCcw, Eye, EyeOff, UserX } from 'lucide-react';
import apiClient from '../../../config/axios';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';
import { useAuth } from '../../../context/AuthContext';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
} from '../../../components/ui/sheet';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';

const ClientesTab = () => {
    const { user } = useAuth();
    const [customers, setCustomers] = useState([]);
    const [totalCustomers, setTotalCustomers] = useState(0);
    const [hasMoreCustomers, setHasMoreCustomers] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [show360, setShow360] = useState(false);
    const [financialStatus, setFinancialStatus] = useState(null);
    const [creditHistory, setCreditHistory] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [showInactive, setShowInactive] = useState(false);

    // Edit states for Profile View (Quick Edits)
    const [editingCredit, setEditingCredit] = useState(false);
    const [editingTerms, setEditingTerms] = useState(false);
    const [tempCreditLimit, setTempCreditLimit] = useState(0);
    const [tempPaymentTerms, setTempPaymentTerms] = useState(15);

    // Sheet (Create/Edit) State
    const [showSheet, setShowSheet] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null); // Full customer object for editing

    useEffect(() => {
        fetchCustomers();
    }, [showInactive]);

    useEffect(() => {
        if (selectedCustomer) {
            fetchFinancialStatus();
            fetchCreditHistory();
        }
    }, [selectedCustomer]);

    const fetchCustomers = async (loadMore = false) => {
        try {
            if (loadMore) setLoadingMore(true);
            const skip = loadMore ? customers.length : 0;
            const response = await apiClient.get('/customers', {
                params: { q: searchQuery, limit: 500, skip, include_inactive: showInactive }
            });
            const { items, total, has_more } = response.data;
            if (loadMore) {
                setCustomers(prev => [...prev, ...items]);
            } else {
                setCustomers(items);
            }
            setTotalCustomers(total);
            setHasMoreCustomers(has_more);
        } catch (error) {
            console.error('Error fetching customers:', error);
            toast.error('Error cargando clientes');
        } finally {
            setLoadingMore(false);
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

    // Sheet Handlers
    const handleCreateClick = () => {
        setEditingCustomer(null);
        setShowSheet(true);
    };

    const handleEditClick = (customer) => {
        setEditingCustomer(customer);
        setShowSheet(true);
    };

    const handleSheetClose = () => {
        setShowSheet(false);
        setEditingCustomer(null);
    };

    const handleFormSuccess = () => {
        fetchCustomers();
        // If we were editing the selected customer, update the selection
        if (editingCustomer && selectedCustomer && editingCustomer.id === selectedCustomer.id) {
            fetchFinancialStatus(); // Refresh financial status just in case
        }
        setShowSheet(false);
    };


    const handleDeactivateCustomer = async (customerId) => {
        if (!confirm('¿Desactivar este cliente? No aparecerá en listas ni en el POS.')) return;
        try {
            await apiClient.put(`/customers/${customerId}/deactivate`);
            toast.success('Cliente desactivado');
            if (selectedCustomer?.id === customerId) {
                setSelectedCustomer(null);
            }
            fetchCustomers();
        } catch (error) {
            toast.error('Error al desactivar cliente: ' + (error.response?.data?.detail || error.message));
        }
    };

    const handleActivateCustomer = async (customerId) => {
        try {
            await apiClient.put(`/customers/${customerId}/activate`);
            toast.success('Cliente reactivado');
            fetchCustomers();
            // Update selected customer if it's the one being reactivated
            if (selectedCustomer?.id === customerId) {
                setSelectedCustomer({ ...selectedCustomer, is_active: true });
            }
        } catch (error) {
            toast.error('Error al reactivar cliente: ' + (error.response?.data?.detail || error.message));
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
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <p className="text-slate-500 font-medium">Administra clientes, límites de crédito y estados de cuenta</p>
                </div>
                <Button id="tour-customers-add-btn" onClick={handleCreateClick} className="shadow-lg shadow-indigo-200 hover:-translate-y-0.5 transition-all">
                    <Plus size={20} className="mr-2" />
                    Nuevo Cliente
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
                {/* Left Panel - Customer List */}
                <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col md:col-span-1 overflow-hidden h-full ${selectedCustomer ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-4 border-b border-slate-100">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                            <Input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    fetchCustomers(); // Debounce recommended for prod
                                }}
                                placeholder="Buscar cliente..."
                                className="pl-10"
                            />
                        </div>
                    </div>

                    <div className="px-4 py-2 flex items-center justify-between border-b border-slate-100">
                        <span className="text-xs font-medium text-slate-500">
                            Mostrando {customers.length} de {totalCustomers} clientes
                        </span>
                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    checked={showInactive}
                                    onChange={() => setShowInactive(!showInactive)}
                                    className="sr-only"
                                />
                                <div className={clsx("w-7 h-4 rounded-full transition-colors", showInactive ? "bg-amber-500" : "bg-slate-300")}></div>
                                <div className={clsx("absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform", showInactive ? "translate-x-3" : "translate-x-0")}></div>
                            </div>
                            <span className="text-xs font-medium text-slate-500">{showInactive ? <Eye size={14} /> : <EyeOff size={14} />}</span>
                            <span className="text-xs font-medium text-slate-500">Inactivos</span>
                        </label>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {customers.map(customer => {
                            const isInactive = customer.is_active === false;
                            return (
                            <div
                                key={customer.id}
                                onClick={() => setSelectedCustomer(customer)}
                                className={clsx(
                                    "p-3 rounded-xl cursor-pointer transition-all border",
                                    isInactive && "opacity-50",
                                    selectedCustomer?.id === customer.id
                                        ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                                        : isInactive
                                            ? 'bg-slate-50 border-slate-200'
                                            : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'
                                )}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className={clsx(
                                            "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0",
                                            isInactive
                                                ? "bg-slate-200 text-slate-400"
                                                : selectedCustomer?.id === customer.id ? "bg-indigo-200 text-indigo-700" : "bg-slate-100 text-slate-500"
                                        )}>
                                            {customer.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className={clsx("font-bold truncate", isInactive ? "text-slate-400 line-through" : selectedCustomer?.id === customer.id ? "text-indigo-900" : "text-slate-700")}>
                                                {customer.name}
                                            </p>
                                            <div className="flex items-center gap-1.5">
                                                <p className={clsx("text-xs truncate", selectedCustomer?.id === customer.id ? "text-indigo-600/70" : "text-slate-400")}>
                                                    {customer.id_number || 'Sin ID'}
                                                </p>
                                                {isInactive && (
                                                    <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                                        Inactivo
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {selectedCustomer?.id === customer.id && (
                                        <div className="flex gap-1 animate-in fade-in slide-in-from-right-2 duration-200">
                                            {isInactive ? (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleActivateCustomer(customer.id);
                                                    }}
                                                    className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100"
                                                    title="Reactivar cliente"
                                                >
                                                    <RotateCcw size={16} />
                                                </Button>
                                            ) : (
                                                <>
                                                    {['ADMIN', 'CASHIER'].includes(user?.role) && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleEditClick(customer);
                                                        }}
                                                        className="h-8 w-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-200"
                                                    >
                                                        <Edit2 size={16} />
                                                    </Button>
                                                    )}
                                                    {user?.role === 'ADMIN' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeactivateCustomer(customer.id);
                                                        }}
                                                        className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-100"
                                                        title="Desactivar cliente"
                                                    >
                                                        <UserX size={16} />
                                                    </Button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            );
                        })}
                        {hasMoreCustomers && (
                            <button
                                onClick={() => fetchCustomers(true)}
                                disabled={loadingMore}
                                className="w-full py-2 text-sm font-bold text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors disabled:opacity-50"
                            >
                                {loadingMore ? 'Cargando...' : 'Cargar más clientes'}
                            </button>
                        )}
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
                            <Button
                                variant="ghost"
                                onClick={() => setSelectedCustomer(null)}
                                className="md:hidden self-start mb-2"
                            >
                                <Users className="mr-2" size={20} /> Volver a lista
                            </Button>

                            {/* Inactive Banner */}
                            {selectedCustomer.is_active === false && (
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-amber-100 p-2 rounded-full text-amber-600">
                                            <UserX size={24} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-amber-800">Cliente Inactivo</p>
                                            <p className="text-amber-600 text-sm">Este cliente fue desactivado y no aparece en el POS ni en listas por defecto.</p>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={() => handleActivateCustomer(selectedCustomer.id)}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                    >
                                        <RotateCcw size={16} className="mr-2" />
                                        Reactivar
                                    </Button>
                                </div>
                            )}

                            {/* Header Card */}
                            <div className={clsx("bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl shadow-lg p-6 relative overflow-hidden", selectedCustomer.is_active === false && "opacity-60")}>
                                <div className="absolute top-0 right-0 p-32 bg-white opacity-5 rounded-full blur-3xl transform translate-x-10 -translate-y-10"></div>
                                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start gap-6">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <h2 className="text-xl md:text-3xl font-bold tracking-tight">{selectedCustomer.name}</h2>
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

                                    {user?.role === 'ADMIN' && (
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
                                    )}
                                </div>
                            </div>

                            {/* Botón Vista 360° */}
                            <button
                                onClick={() => setShow360(true)}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-md"
                            >
                                <Zap size={16} />
                                Ver historial completo — Vista 360°
                            </button>

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
                                            {user?.role === 'ADMIN' && (!editingCredit ? (
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
                                            ))}
                                        </div>
                                        {editingCredit ? (
                                            <Input
                                                type="number"
                                                value={tempCreditLimit}
                                                onChange={(e) => setTempCreditLimit(parseFloat(e.target.value))}
                                                className="text-xl font-bold h-10"
                                                autoFocus
                                            />
                                        ) : (
                                            <p className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">
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
                                            <Input
                                                type="number"
                                                value={tempPaymentTerms}
                                                onChange={(e) => setTempPaymentTerms(parseInt(e.target.value))}
                                                className="text-xl font-bold h-10"
                                                autoFocus
                                            />
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
                                <div className="flex-1 overflow-x-auto">
                                    <table className="min-w-[500px] w-full">
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
                                                                ${Number(sale.total_amount || 0).toFixed(2)}
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

            {/* Sheet for Create/Edit */}
            <Sheet open={showSheet} onOpenChange={setShowSheet}>
                <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
                    <SheetHeader>
                        <SheetTitle className="flex items-center gap-2">
                            <Users className="text-indigo-600" size={24} />
                            {editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}
                        </SheetTitle>
                        <SheetDescription>
                            {editingCustomer ? 'Modifica los datos del cliente' : 'Registra un nuevo cliente para ventas y crédito'}
                        </SheetDescription>
                    </SheetHeader>

                    {showSheet && (
                        <CustomerForm
                            customer={editingCustomer}
                            onClose={handleSheetClose}
                            onSuccess={handleFormSuccess}
                        />
                    )}
                </SheetContent>
            </Sheet>
            {show360 && selectedCustomer && (
                <Customer360
                    customerId={selectedCustomer.id}
                    customerName={selectedCustomer.name}
                    onClose={() => setShow360(false)}
                />
            )}
        </div>
    );
};

// Extracted Form Component
const CustomerForm = ({ customer, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        name: customer?.name || '',
        id_number: customer?.id_number || '',
        phone: customer?.phone || '',
        email: customer?.email || '',
        address: customer?.address || '',
        credit_limit: customer?.credit_limit || 0,
        payment_term_days: customer?.payment_term_days || 15,
        is_blocked: customer?.is_blocked || false
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                ...formData,
                credit_limit: parseFloat(formData.credit_limit) || 0,
                payment_term_days: parseInt(formData.payment_term_days) || 15
            };

            if (customer) {
                await apiClient.put(`/customers/${customer.id}`, payload);
            } else {
                await apiClient.post('/customers', payload);
            }

            toast.success(customer ? 'Cliente actualizado' : 'Cliente creado exitosamente');
            onSuccess();
        } catch (error) {
            console.error('Error saving customer:', error);
            toast.error(error.response?.data?.detail || 'Error al guardar cliente');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">

                {/* Personal Info */}
                <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100">
                        Información Personal
                    </h4>

                    <div className="space-y-2">
                        <Label htmlFor="c-name">Nombre Completo <span className="text-rose-500">*</span></Label>
                        <Input
                            id="c-name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Ej: Juan Pérez"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="c-id">RIF / Cédula</Label>
                            <div className="relative">
                                <CreditCard className="absolute left-3 top-2.5 text-slate-400" size={18} />
                                <Input
                                    id="c-id"
                                    value={formData.id_number}
                                    onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
                                    placeholder="V-123..."
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="c-phone">Teléfono</Label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-2.5 text-slate-400" size={18} />
                                <Input
                                    id="c-phone"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="0414..."
                                    className="pl-10"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="c-email">Email</Label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-2.5 text-slate-400" size={18} />
                            <Input
                                id="c-email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="cliente@email.com"
                                className="pl-10"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="c-address">Dirección Fiscal</Label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-3 text-slate-400" size={18} />
                            <Textarea
                                id="c-address"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                placeholder="Dirección completa..."
                                className="pl-10 min-h-[80px]"
                            />
                        </div>
                    </div>
                </div>

                {/* Credit Info */}
                <div className="space-y-4 pt-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
                        <Building2 size={14} /> Información de Crédito
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="c-limit">Límite ($)</Label>
                            <Input
                                id="c-limit"
                                type="number"
                                step="0.01"
                                value={formData.credit_limit}
                                onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                                placeholder="0.00"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="c-terms">Plazo (Días)</Label>
                            <Input
                                id="c-terms"
                                type="number"
                                value={formData.payment_term_days}
                                onChange={(e) => setFormData({ ...formData, payment_term_days: e.target.value })}
                                placeholder="15"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <SheetFooter className="gap-3 border-t border-slate-100 p-6 bg-slate-50/50">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    className="flex-1"
                >
                    Cancelar
                </Button>
                <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1"
                >
                    {loading ? 'Guardando...' : (
                        <>
                            <Check size={18} className="mr-2" />
                            Guardar
                        </>
                    )}
                </Button>
            </SheetFooter>
        </form>
    );
};

export default ClientesTab;
