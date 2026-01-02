import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfig } from '../../context/ConfigContext';
import { DollarSign, AlertTriangle, FileText, CreditCard, ArrowLeft, TrendingDown, Eye, CheckCircle, Clock, Calendar } from 'lucide-react';
import apiClient from '../../config/axios';
import PurchaseItemsModal from '../../components/purchases/PurchaseItemsModal';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';

const AccountsPayable = () => {
    const navigate = useNavigate();
    const [suppliers, setSuppliers] = useState([]);
    const [selectedSupplier, setSelectedSupplier] = useState(null);
    const [supplierPurchases, setSupplierPurchases] = useState([]);
    const [selectedPurchase, setSelectedPurchase] = useState(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showItemsModal, setShowItemsModal] = useState(false);
    const [loading, setLoading] = useState(true);

    // Summary stats
    const [totalDebt, setTotalDebt] = useState(0);
    const [overdueInvoices, setOverdueInvoices] = useState(0);

    useEffect(() => {
        fetchSuppliersWithDebt();
    }, []);

    const fetchSuppliersWithDebt = async () => {
        try {
            const response = await apiClient.get('/suppliers');
            // Show all suppliers, sort by debt descending
            const allSuppliers = response.data.sort((a, b) => Number(b.current_balance || 0) - Number(a.current_balance || 0));
            setSuppliers(allSuppliers);

            // Calculate totals
            const total = allSuppliers.reduce((sum, s) => sum + Number(s.current_balance || 0), 0);
            setTotalDebt(total);

            // Get overdue count
            const pendingRes = await apiClient.get('/purchases/pending');
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const overdue = pendingRes.data.filter(p => {
                if (!p.due_date || p.payment_status === 'PAID') return false;
                const dueDate = new Date(p.due_date);
                dueDate.setHours(0, 0, 0, 0);
                return dueDate < today;
            });
            setOverdueInvoices(overdue.length);
        } catch (error) {
            console.error('Error fetching suppliers:', error);
            toast.error('Error al cargar proveedores con deuda');
        } finally {
            setLoading(false);
        }
    };

    const fetchSupplierPurchases = async (supplierId) => {
        try {
            const response = await apiClient.get(`/suppliers/${supplierId}/purchases?status=PENDING,PARTIAL`);
            setSupplierPurchases(response.data);
        } catch (error) {
            console.error('Error fetching purchases:', error);
            toast.error('Error al cargar facturas');
        }
    };

    const handleSupplierClick = (supplier) => {
        setSelectedSupplier(supplier);
        fetchSupplierPurchases(supplier.id);
    };

    const handleBackToList = () => {
        setSelectedSupplier(null);
        setSupplierPurchases([]);
    };

    const handleRegisterPayment = (purchase) => {
        setSelectedPurchase(purchase);
        setShowPaymentModal(true);
    };

    const handleViewItems = (purchase) => {
        setSelectedPurchase(purchase);
        setShowItemsModal(true);
    };

    const handlePaymentSuccess = () => {
        setShowPaymentModal(false);
        setSelectedPurchase(null);
        fetchSuppliersWithDebt();
        if (selectedSupplier) {
            fetchSupplierPurchases(selectedSupplier.id);
        }
    };

    if (loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-slate-400">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600 mb-4"></div>
                <p className="font-medium animate-pulse">Cargando cuentas por pagar...</p>
            </div>
        );
    }

    // Main view - Summary
    if (!selectedSupplier) {
        return (
            <div className="h-[calc(100vh-64px)] overflow-y-auto bg-slate-50 p-6">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-800">Cuentas por Pagar</h1>
                    <p className="text-slate-500 font-medium">Gestión de deudas con proveedores</p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex items-center justify-between group hover:border-indigo-300 transition-all">
                        <div>
                            <p className="text-slate-500 text-sm font-bold uppercase mb-1">Deuda Total</p>
                            <p className="text-3xl font-black text-slate-800 group-hover:text-indigo-600 transition-colors">${Number(totalDebt || 0).toFixed(2)}</p>
                        </div>
                        <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl border border-indigo-100">
                            <TrendingDown size={32} />
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex items-center justify-between group hover:border-rose-300 transition-all">
                        <div>
                            <p className="text-slate-500 text-sm font-bold uppercase mb-1">Facturas Vencidas</p>
                            <p className="text-3xl font-black text-rose-600">{overdueInvoices}</p>
                        </div>
                        <div className="bg-rose-50 text-rose-600 p-3 rounded-xl border border-rose-100">
                            <AlertTriangle size={32} />
                        </div>
                    </div>
                </div>

                {/* Suppliers Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                        <h2 className="text-lg font-bold text-slate-800">Proveedores con Deuda</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="text-left p-4 font-bold text-slate-600 text-sm uppercase tracking-wide">Proveedor</th>
                                    <th className="text-left p-4 font-bold text-slate-600 text-sm uppercase tracking-wide">Contacto</th>
                                    <th className="text-right p-4 font-bold text-slate-600 text-sm uppercase tracking-wide">Deuda Actual</th>
                                    <th className="text-right p-4 font-bold text-slate-600 text-sm uppercase tracking-wide">Límite Crédito</th>
                                    <th className="text-right p-4 font-bold text-slate-600 text-sm uppercase tracking-wide w-32">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {suppliers.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="text-center p-12 text-slate-400">
                                            <div className="flex flex-col items-center">
                                                <CheckCircle size={48} className="mb-3 text-emerald-200" />
                                                <p className="font-bold text-slate-500">¡Al día! No hay deudas pendientes</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    suppliers.map(supplier => (
                                        <tr key={supplier.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4 font-bold text-slate-700">{supplier.name}</td>
                                            <td className="p-4 text-slate-500 font-medium">{supplier.phone || '-'}</td>
                                            <td className="p-4 text-right">
                                                <span className="bg-rose-50 text-rose-700 font-black px-2 py-1 rounded-md border border-rose-100">
                                                    ${Number(supplier.current_balance || 0).toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right text-slate-500 font-medium">
                                                {supplier.credit_limit ? `$${Number(supplier.credit_limit).toFixed(2)}` : '-'}
                                            </td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => handleSupplierClick(supplier)}
                                                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 px-4 py-2 rounded-lg font-bold text-xs transition-colors shadow-sm"
                                                >
                                                    Ver Facturas
                                                </button>
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
    }

    // Detail view - Supplier Invoices
    return (
        <div className="h-[calc(100vh-64px)] overflow-y-auto bg-slate-50 p-6">
            <button
                onClick={handleBackToList}
                className="flex items-center text-slate-500 hover:text-slate-800 mb-6 font-bold text-sm bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm transition-all hover:shadow-md"
            >
                <ArrowLeft size={18} className="mr-2" />
                Volver a la lista
            </button>

            <div className="bg-indigo-900 rounded-2xl shadow-xl p-8 mb-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-10">
                    <DollarSign size={200} />
                </div>
                <h2 className="text-3xl font-black relative z-10">{selectedSupplier.name}</h2>
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10 border-t border-indigo-800 pt-6">
                    <div>
                        <p className="text-indigo-200 text-sm font-bold uppercase mb-1">Deuda Actual</p>
                        <p className="text-4xl font-black text-white">
                            ${Number(selectedSupplier.current_balance || 0).toFixed(2)}
                        </p>
                    </div>
                    <div>
                        <p className="text-indigo-200 text-sm font-bold uppercase mb-1">Términos de Pago</p>
                        <div className="flex items-center gap-2">
                            <Calendar className="text-indigo-300" size={20} />
                            <p className="text-xl font-bold">{selectedSupplier.payment_terms || 0} días</p>
                        </div>
                    </div>
                    <div>
                        <p className="text-indigo-200 text-sm font-bold uppercase mb-1">Límite de Crédito</p>
                        <p className="text-xl font-bold">
                            {selectedSupplier.credit_limit ? `$${Number(selectedSupplier.credit_limit).toFixed(2)}` : 'Sin límite'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Invoices Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <FileText size={20} className="text-slate-400" />
                        Facturas Pendientes
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="text-left p-4 font-bold text-slate-600 text-xs uppercase tracking-wide">Nro. Factura</th>
                                <th className="text-left p-4 font-bold text-slate-600 text-xs uppercase tracking-wide">Fecha</th>
                                <th className="text-left p-4 font-bold text-slate-600 text-xs uppercase tracking-wide">Vencimiento</th>
                                <th className="text-right p-4 font-bold text-slate-600 text-xs uppercase tracking-wide">Total</th>
                                <th className="text-right p-4 font-bold text-slate-600 text-xs uppercase tracking-wide">Pagado</th>
                                <th className="text-right p-4 font-bold text-slate-600 text-xs uppercase tracking-wide">Saldo</th>
                                <th className="text-center p-4 font-bold text-slate-600 text-xs uppercase tracking-wide">Estado</th>
                                <th className="text-right p-4 font-bold text-slate-600 text-xs uppercase tracking-wide">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {supplierPurchases.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="text-center p-12 text-slate-400">
                                        No hay facturas pendientes
                                    </td>
                                </tr>
                            ) : (
                                supplierPurchases.map(purchase => {
                                    const balance = Number(purchase.total_amount || 0) - Number(purchase.paid_amount || 0);

                                    const isOverdue = purchase.due_date && purchase.payment_status !== 'PAID' && (() => {
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        const dueDate = new Date(purchase.due_date);
                                        dueDate.setHours(0, 0, 0, 0);
                                        return dueDate < today;
                                    })();

                                    return (
                                        <tr key={purchase.id} className={clsx("hover:bg-slate-50 transition-colors", isOverdue && "bg-rose-50/30")}>
                                            <td className="p-4 font-bold text-slate-700">{purchase.invoice_number || `#${purchase.id}`}</td>
                                            <td className="p-4 text-slate-500 text-sm font-medium">{new Date(purchase.purchase_date).toLocaleDateString()}</td>
                                            <td className="p-4 text-sm">
                                                {purchase.due_date ? (
                                                    <span className={clsx("font-bold flex items-center gap-1", isOverdue ? 'text-rose-600' : 'text-slate-500')}>
                                                        {isOverdue && <AlertTriangle size={14} />}
                                                        {new Date(purchase.due_date).toLocaleDateString()}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td className="p-4 text-right font-bold text-slate-700">${Number(purchase.total_amount).toFixed(2)}</td>
                                            <td className="p-4 text-right text-emerald-600 font-bold">${Number(purchase.paid_amount).toFixed(2)}</td>
                                            <td className="p-4 text-right">
                                                <span className="text-rose-600 font-black">${Number(balance).toFixed(2)}</span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={clsx(
                                                    "px-2.5 py-1 rounded-full text-xs font-bold border",
                                                    purchase.payment_status === 'PENDING'
                                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                        : 'bg-blue-50 text-blue-700 border-blue-200'
                                                )}>
                                                    {purchase.payment_status === 'PENDING' ? 'Pendiente' : 'Parcial'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => navigate(`/suppliers/${selectedSupplier.id}/ledger`)}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    title="Ver Historial"
                                                >
                                                    <Clock size={20} />
                                                </button>
                                                <button
                                                    onClick={() => handleViewItems(purchase)}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    title="Ver Productos"
                                                >
                                                    <Eye size={20} />
                                                </button>
                                                <button
                                                    onClick={() => handleRegisterPayment(purchase)}
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md shadow-emerald-200 transition-all active:scale-95"
                                                >
                                                    Registrar Pago
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Payment Modal */}
            {showPaymentModal && selectedPurchase && (
                <PaymentModal
                    purchase={selectedPurchase}
                    onClose={() => setShowPaymentModal(false)}
                    onSuccess={handlePaymentSuccess}
                />
            )}

            {/* Purchase Items Modal */}
            <PurchaseItemsModal
                isOpen={showItemsModal}
                onClose={() => setShowItemsModal(false)}
                purchaseId={selectedPurchase?.id}
            />
        </div>
    );
};

// Payment Modal Component
const PaymentModal = ({ purchase, onClose, onSuccess }) => {
    const { paymentMethods, currencies, exchangeRate } = useConfig();
    const balance = Number(purchase.total_amount || 0) - Number(purchase.paid_amount || 0);
    const [formData, setFormData] = useState({
        amount: balance,
        payment_method: '',
        reference: '',
        notes: '',
        currency: 'USD',
        exchange_rate: exchangeRate
    });
    const [loading, setLoading] = useState(false);

    // Filter Currencies for Rate Selection (Non-anchor ie. Non-USD)
    const activeRates = (currencies || []).filter(c => c.is_active && !c.is_anchor);

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Calculate USD equivalent for validation
        const rate = parseFloat(formData.exchange_rate) || 1;
        const amount = parseFloat(formData.amount) || 0;

        let amountUSD = amount;
        if (formData.currency !== 'USD') {
            amountUSD = amount / rate;
        }

        // Tolerance for float comparison
        if (amountUSD <= 0.001) {
            toast.error("El monto debe ser mayor a 0");
            return;
        }

        if (amountUSD > (balance + 1)) {
            toast.error(`El monto ($${amountUSD.toFixed(2)}) excede el saldo pendiente ($${balance.toFixed(2)})`);
            return;
        }

        setLoading(true);
        try {
            await apiClient.post(`/purchases/${purchase.id}/payment`, formData);
            toast.success('Pago registrado exitosamente');
            onSuccess();
        } catch (error) {
            console.error('Error registering payment:', error);
            toast.error(error.response?.data?.detail || 'Error al registrar pago');
        } finally {
            setLoading(false);
        }
    };

    const getEquivUSD = () => {
        if (formData.currency === 'USD') return parseFloat(formData.amount) || 0;
        const rate = parseFloat(formData.exchange_rate) || 1;
        const amount = parseFloat(formData.amount) || 0;
        return amount / rate;
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">Registrar Pago</h3>
                        <p className="text-sm text-slate-500 font-medium">
                            Factura: {purchase.invoice_number || `#${purchase.id}`}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                        <div className="flex justify-between mb-2 text-sm">
                            <span className="text-slate-600 font-medium">Total Factura:</span>
                            <span className="font-bold text-slate-800">${Number(purchase.total_amount || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between mb-3 text-sm">
                            <span className="text-slate-600 font-medium">Pagado:</span>
                            <span className="text-emerald-600 font-bold">${Number(purchase.paid_amount || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between pt-3 border-t border-indigo-200 items-center">
                            <span className="font-bold text-indigo-900">Saldo Pendiente:</span>
                            <span className="font-black text-rose-600 text-xl">${Number(balance).toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Moneda</label>
                            <select
                                value={formData.currency}
                                onChange={(e) => {
                                    const newCurr = e.target.value;
                                    // Default to first active rate if switching to VES
                                    let newRate = 1.0;
                                    if (newCurr !== 'USD' && activeRates.length > 0) {
                                        newRate = activeRates[0].rate;
                                    }

                                    setFormData({
                                        ...formData,
                                        currency: newCurr,
                                        exchange_rate: newRate
                                    });
                                }}
                                className="w-full p-3 border border-slate-200 rounded-xl font-bold"
                            >
                                <option value="USD">USD ($)</option>
                                <option value="VES">Bolívares (Bs)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Tasa</label>
                            {formData.currency === 'USD' ? (
                                <input
                                    type="number"
                                    disabled
                                    value="1.00"
                                    className="w-full p-3 border border-slate-200 rounded-xl font-bold bg-slate-50 text-slate-400"
                                />
                            ) : (
                                <div className="space-y-2">
                                    <select
                                        className="w-full p-2 text-sm border border-slate-200 rounded-lg font-medium"
                                        onChange={(e) => setFormData({ ...formData, exchange_rate: parseFloat(e.target.value) })}
                                        value={activeRates.some(r => r.rate == formData.exchange_rate) ? formData.exchange_rate : ''}
                                    >
                                        <option value="" disabled>Seleccionar Tasa</option>
                                        {activeRates.map(r => (
                                            <option key={r.id} value={r.rate}>
                                                {r.name} - {r.rate}
                                            </option>
                                        ))}
                                        <option value={formData.exchange_rate}>Manual ({formData.exchange_rate})</option>
                                    </select>

                                    {/* Allow manual override always visible or just use the select? 
                                        User asked for 'Tasas Activas'. Let's keep input for fine tuning.
                                    */}
                                    <input
                                        type="number"
                                        value={formData.exchange_rate}
                                        onChange={(e) => setFormData({ ...formData, exchange_rate: e.target.value })}
                                        className="w-full p-2 border border-slate-200 rounded-lg font-bold text-sm"
                                        placeholder="Tasa manual"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            Monto a Abonar ({formData.currency}) *
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                                className="w-full pl-4 pr-4 py-3 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-lg font-bold text-slate-800"
                                step="0.01"
                                min="0.01"
                                required
                            />
                            {formData.currency !== 'USD' && (
                                <div className="absolute right-4 top-3.5 text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                                    = ${getEquivUSD().toFixed(2)} USD
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            Método de Pago *
                        </label>
                        <select
                            value={formData.payment_method}
                            onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                            className="w-full p-3 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none font-medium text-slate-700 bg-white"
                            required
                        >
                            <option value="">Seleccione un método</option>
                            {paymentMethods.filter(pm => pm.is_active).map(pm => (
                                <option key={pm.id} value={pm.name}>{pm.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            Referencia / Nro. Comprobante
                        </label>
                        <input
                            type="text"
                            value={formData.reference}
                            onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                            className="w-full p-3 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none font-medium"
                            placeholder="Ej: TRF-12345"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            Notas
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full p-3 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none font-medium"
                            rows="2"
                            placeholder="Observaciones adicionales..."
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? 'Procesando...' : (
                                <>
                                    <CreditCard size={18} />
                                    Registrar Pago
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AccountsPayable;
