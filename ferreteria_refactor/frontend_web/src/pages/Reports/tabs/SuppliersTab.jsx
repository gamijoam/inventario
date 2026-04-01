import { useState, useEffect, useMemo } from 'react';
import {
    DollarSign, AlertTriangle, FileText, CreditCard, ArrowLeft,
    TrendingDown, Eye, CheckCircle, Clock, Calendar, Search,
    Printer, X, Wallet
} from 'lucide-react';
import apiClient from '../../../config/axios';
import { useConfig } from '../../../context/ConfigContext';
import PurchaseItemsModal from '../../../components/purchases/PurchaseItemsModal';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';

// ---------------------------------------------------------------------------
// Sub-tab definitions
// ---------------------------------------------------------------------------
const SUB_TABS = [
    { id: 'cxp', label: 'Cuentas por Pagar', icon: Wallet },
    { id: 'ledger', label: 'Estado de Cuenta', icon: FileText },
];

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
// Payment Modal (multi-currency, mirrored from AccountsPayable)
// ---------------------------------------------------------------------------
const PaymentModal = ({ purchase, onClose, onSuccess }) => {
    const { paymentMethods, currencies, exchangeRate } = useConfig();
    const balance = Number(purchase.total_amount || 0) - Number(purchase.paid_amount || 0);

    const [formData, setFormData] = useState({
        amount: balance,
        payment_method: '',
        reference: '',
        notes: '',
        currency: 'USD',
        exchange_rate: exchangeRate,
    });
    const [loading, setLoading] = useState(false);

    const activeRates = useMemo(
        () => (currencies || []).filter(c => c.is_active && !c.is_anchor),
        [currencies]
    );

    const getEquivUSD = () => {
        if (formData.currency === 'USD') return parseFloat(formData.amount) || 0;
        const rate = parseFloat(formData.exchange_rate) || 1;
        return (parseFloat(formData.amount) || 0) / rate;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const rate = parseFloat(formData.exchange_rate) || 1;
        const amount = parseFloat(formData.amount) || 0;
        let amountUSD = formData.currency !== 'USD' ? amount / rate : amount;

        if (amountUSD <= 0.001) {
            toast.error('El monto debe ser mayor a 0');
            return;
        }
        if (amountUSD > balance + 1) {
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
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Balance summary */}
                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                        <div className="flex justify-between mb-2 text-sm">
                            <span className="text-slate-600 font-medium">Total Factura:</span>
                            <span className="font-bold text-slate-800">{formatUSD(purchase.total_amount)}</span>
                        </div>
                        <div className="flex justify-between mb-3 text-sm">
                            <span className="text-slate-600 font-medium">Pagado:</span>
                            <span className="text-emerald-600 font-bold">{formatUSD(purchase.paid_amount)}</span>
                        </div>
                        <div className="flex justify-between pt-3 border-t border-indigo-200 items-center">
                            <span className="font-bold text-indigo-900">Saldo Pendiente:</span>
                            <span className="font-black text-rose-600 text-xl">{formatUSD(balance)}</span>
                        </div>
                    </div>

                    {/* Currency + Rate */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Moneda</label>
                            <select
                                value={formData.currency}
                                onChange={(e) => {
                                    const newCurr = e.target.value;
                                    let newRate = 1.0;
                                    if (newCurr !== 'USD' && activeRates.length > 0) {
                                        newRate = activeRates[0].rate;
                                    }
                                    setFormData({ ...formData, currency: newCurr, exchange_rate: newRate });
                                }}
                                className="w-full p-3 border border-slate-200 rounded-xl font-bold"
                            >
                                <option value="USD">USD ($)</option>
                                <option value="VES">Bolivares (Bs)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Tasa</label>
                            {formData.currency === 'USD' ? (
                                <input type="number" disabled value="1.00" className="w-full p-3 border border-slate-200 rounded-xl font-bold bg-slate-50 text-slate-400" />
                            ) : (
                                <div className="space-y-2">
                                    <select
                                        className="w-full p-2 text-sm border border-slate-200 rounded-lg font-medium"
                                        onChange={(e) => setFormData({ ...formData, exchange_rate: parseFloat(e.target.value) })}
                                        value={activeRates.some(r => r.rate == formData.exchange_rate) ? formData.exchange_rate : ''}
                                    >
                                        <option value="" disabled>Seleccionar Tasa</option>
                                        {activeRates.map(r => (
                                            <option key={r.id} value={r.rate}>{r.name} - {r.rate}</option>
                                        ))}
                                        <option value={formData.exchange_rate}>Manual ({formData.exchange_rate})</option>
                                    </select>
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

                    {/* Amount */}
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

                    {/* Payment Method */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Metodo de Pago *</label>
                        <select
                            value={formData.payment_method}
                            onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                            className="w-full p-3 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none font-medium text-slate-700 bg-white"
                            required
                        >
                            <option value="">Seleccione un metodo</option>
                            {(paymentMethods || []).filter(pm => pm.is_active).map(pm => (
                                <option key={pm.id} value={pm.name}>{pm.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Reference */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Referencia / Nro. Comprobante</label>
                        <input
                            type="text"
                            value={formData.reference}
                            onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                            className="w-full p-3 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none font-medium"
                            placeholder="Ej: TRF-12345"
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Notas</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full p-3 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none font-medium"
                            rows="2"
                            placeholder="Observaciones adicionales..."
                        />
                    </div>

                    {/* Buttons */}
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

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------
const SuppliersTab = ({ dateRange }) => {
    const [activeSubTab, setActiveSubTab] = useState('cxp');

    // --- CxP state ---
    const [suppliers, setSuppliers] = useState([]);
    const [selectedSupplier, setSelectedSupplier] = useState(null);
    const [supplierPurchases, setSupplierPurchases] = useState([]);
    const [selectedPurchase, setSelectedPurchase] = useState(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showItemsModal, setShowItemsModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [totalDebt, setTotalDebt] = useState(0);
    const [overdueInvoices, setOverdueInvoices] = useState(0);

    // --- Ledger state ---
    const [allSuppliers, setAllSuppliers] = useState([]);
    const [ledgerSupplierId, setLedgerSupplierId] = useState('');
    const [ledgerData, setLedgerData] = useState(null);
    const [ledgerLoading, setLedgerLoading] = useState(false);

    // -----------------------------------------------------------------------
    // CxP data loading
    // -----------------------------------------------------------------------
    useEffect(() => {
        fetchSuppliersWithDebt();
    }, []);

    const fetchSuppliersWithDebt = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/suppliers');
            const sorted = response.data.sort((a, b) => Number(b.current_balance || 0) - Number(a.current_balance || 0));
            setSuppliers(sorted);
            setAllSuppliers(response.data);

            const total = sorted.reduce((sum, s) => sum + Number(s.current_balance || 0), 0);
            setTotalDebt(total);

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

    // -----------------------------------------------------------------------
    // Ledger data loading
    // -----------------------------------------------------------------------
    const fetchLedger = async (supplierId) => {
        if (!supplierId) return;
        setLedgerLoading(true);
        try {
            const response = await apiClient.get(`/suppliers/${supplierId}/ledger`);
            setLedgerData(response.data);
        } catch (error) {
            console.error('Error fetching ledger:', error);
            toast.error('Error al cargar estado de cuenta');
        } finally {
            setLedgerLoading(false);
        }
    };

    const handleLedgerSupplierChange = (e) => {
        const id = e.target.value;
        setLedgerSupplierId(id);
        if (id) fetchLedger(id);
        else setLedgerData(null);
    };

    const handlePrintLedger = () => window.print();

    // -----------------------------------------------------------------------
    // RENDER: Sub-tab navigation
    // -----------------------------------------------------------------------
    const renderSubTabNav = () => (
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 mb-6">
            {SUB_TABS.map(tab => {
                const TabIcon = tab.icon;
                const isActive = activeSubTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSubTab(tab.id)}
                        className={clsx(
                            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all',
                            isActive
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
                        )}
                    >
                        <TabIcon size={16} />
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );

    // -----------------------------------------------------------------------
    // RENDER: Cuentas por Pagar - Supplier list
    // -----------------------------------------------------------------------
    const renderCxPList = () => (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center justify-between group hover:border-indigo-300 transition-all">
                    <div>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Deuda Total</p>
                        <p className="text-2xl font-black text-slate-800 group-hover:text-indigo-600 transition-colors">{formatUSD(totalDebt)}</p>
                    </div>
                    <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl border border-indigo-100">
                        <TrendingDown size={28} />
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center justify-between group hover:border-rose-300 transition-all">
                    <div>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Facturas Vencidas</p>
                        <p className="text-2xl font-black text-rose-600">{overdueInvoices}</p>
                    </div>
                    <div className="bg-rose-50 text-rose-600 p-3 rounded-xl border border-rose-100">
                        <AlertTriangle size={28} />
                    </div>
                </div>
            </div>

            {/* Suppliers Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                    <h2 className="text-base font-bold text-slate-900">Proveedores con Deuda</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50/80 text-slate-500 text-xs font-bold uppercase tracking-wider">
                            <tr>
                                <th className="text-left p-4">Proveedor</th>
                                <th className="text-left p-4">Contacto</th>
                                <th className="text-right p-4">Deuda Actual</th>
                                <th className="text-right p-4">Limite Credito</th>
                                <th className="text-right p-4 w-32">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {suppliers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="text-center p-12 text-slate-400">
                                        <div className="flex flex-col items-center">
                                            <CheckCircle size={48} className="mb-3 text-emerald-200" />
                                            <p className="font-bold text-slate-500">Al dia! No hay deudas pendientes</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                suppliers.map(supplier => (
                                    <tr key={supplier.id} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="p-4 font-bold text-slate-700">{supplier.name}</td>
                                        <td className="p-4 text-slate-500 font-medium">{supplier.phone || '-'}</td>
                                        <td className="p-4 text-right">
                                            <span className="bg-rose-50 text-rose-700 font-black px-2 py-1 rounded-lg border border-rose-100">
                                                {formatUSD(supplier.current_balance)}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right text-slate-500 font-medium">
                                            {supplier.credit_limit ? formatUSD(supplier.credit_limit) : '-'}
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

    // -----------------------------------------------------------------------
    // RENDER: Cuentas por Pagar - Supplier detail (invoices)
    // -----------------------------------------------------------------------
    const renderCxPDetail = () => (
        <div className="space-y-6">
            <button
                onClick={handleBackToList}
                className="flex items-center text-slate-500 hover:text-slate-800 font-bold text-sm bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm transition-all hover:shadow-md"
            >
                <ArrowLeft size={18} className="mr-2" />
                Volver a la lista
            </button>

            {/* Supplier header card */}
            <div className="bg-indigo-900 rounded-2xl shadow-xl p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-10">
                    <DollarSign size={180} />
                </div>
                <h2 className="text-xl md:text-2xl font-black relative z-10">{selectedSupplier.name}</h2>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10 border-t border-indigo-800 pt-4">
                    <div>
                        <p className="text-indigo-200 text-xs font-bold uppercase mb-1">Deuda Actual</p>
                        <p className="text-2xl font-black text-white">{formatUSD(selectedSupplier.current_balance)}</p>
                    </div>
                    <div>
                        <p className="text-indigo-200 text-xs font-bold uppercase mb-1">Terminos de Pago</p>
                        <div className="flex items-center gap-2">
                            <Calendar className="text-indigo-300" size={18} />
                            <p className="text-lg font-bold">{selectedSupplier.payment_terms || 0} dias</p>
                        </div>
                    </div>
                    <div>
                        <p className="text-indigo-200 text-xs font-bold uppercase mb-1">Limite de Credito</p>
                        <p className="text-lg font-bold">
                            {selectedSupplier.credit_limit ? formatUSD(selectedSupplier.credit_limit) : 'Sin limite'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Invoices Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <FileText size={18} className="text-slate-400" />
                        Facturas Pendientes
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50/80 text-slate-500 text-xs font-bold uppercase tracking-wider">
                            <tr>
                                <th className="text-left p-4">Nro. Factura</th>
                                <th className="text-left p-4">Fecha</th>
                                <th className="text-left p-4">Vencimiento</th>
                                <th className="text-right p-4">Total</th>
                                <th className="text-right p-4">Pagado</th>
                                <th className="text-right p-4">Saldo</th>
                                <th className="text-center p-4">Estado</th>
                                <th className="text-right p-4">Acciones</th>
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
                                        <tr key={purchase.id} className={clsx('hover:bg-slate-50/60 transition-colors', isOverdue && 'bg-rose-50/30')}>
                                            <td className="p-4 font-bold text-slate-700">{purchase.invoice_number || `#${purchase.id}`}</td>
                                            <td className="p-4 text-slate-500 text-sm font-medium">{new Date(purchase.purchase_date).toLocaleDateString()}</td>
                                            <td className="p-4 text-sm">
                                                {purchase.due_date ? (
                                                    <span className={clsx('font-bold flex items-center gap-1', isOverdue ? 'text-rose-600' : 'text-slate-500')}>
                                                        {isOverdue && <AlertTriangle size={14} />}
                                                        {new Date(purchase.due_date).toLocaleDateString()}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td className="p-4 text-right font-bold text-slate-700">{formatUSD(purchase.total_amount)}</td>
                                            <td className="p-4 text-right text-emerald-600 font-bold">{formatUSD(purchase.paid_amount)}</td>
                                            <td className="p-4 text-right">
                                                <span className="text-rose-600 font-black">{formatUSD(balance)}</span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={clsx(
                                                    'px-2.5 py-1 rounded-full text-xs font-bold border',
                                                    purchase.payment_status === 'PENDING'
                                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                        : 'bg-blue-50 text-blue-700 border-blue-200'
                                                )}>
                                                    {purchase.payment_status === 'PENDING' ? 'Pendiente' : 'Parcial'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleViewItems(purchase)}
                                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                        title="Ver Productos"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleRegisterPayment(purchase)}
                                                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md shadow-emerald-200 transition-all active:scale-95"
                                                    >
                                                        Registrar Pago
                                                    </button>
                                                </div>
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
    );

    // -----------------------------------------------------------------------
    // RENDER: Estado de Cuenta (Ledger)
    // -----------------------------------------------------------------------
    const renderLedger = () => (
        <div className="space-y-6">
            {/* Supplier selector */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex-1 w-full">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Seleccionar Proveedor</label>
                        <select
                            value={ledgerSupplierId}
                            onChange={handleLedgerSupplierChange}
                            className="w-full p-3 border border-slate-200 rounded-xl font-medium text-slate-700 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        >
                            <option value="">-- Seleccione un proveedor --</option>
                            {allSuppliers.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                    {ledgerData && (
                        <button
                            onClick={handlePrintLedger}
                            className="flex items-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors print:hidden"
                        >
                            <Printer size={16} />
                            Imprimir
                        </button>
                    )}
                </div>
            </div>

            {ledgerLoading && (
                <div className="flex items-center justify-center h-40 text-slate-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 mr-3" />
                    Cargando estado de cuenta...
                </div>
            )}

            {!ledgerLoading && ledgerData && (
                <>
                    {/* Supplier summary */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">{ledgerData.supplier?.name}</h3>
                            <p className="text-sm text-slate-500">ID: {ledgerData.supplier?.id}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-500 font-bold uppercase">Saldo Actual</p>
                            <p className={clsx('text-2xl font-black', Number(ledgerData.current_balance) > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                                {formatUSD(ledgerData.current_balance)}
                            </p>
                            {ledgerData.supplier?.limit != null && (
                                <p className="text-xs text-slate-400 mt-1">Limite: {formatUSD(ledgerData.supplier.limit)}</p>
                            )}
                        </div>
                    </div>

                    {/* Ledger table */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50/80 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                    <tr>
                                        <th className="text-left p-4">Fecha</th>
                                        <th className="text-left p-4">Referencia</th>
                                        <th className="text-center p-4">Tipo</th>
                                        <th className="text-right p-4">Cargo</th>
                                        <th className="text-right p-4">Abono</th>
                                        <th className="text-right p-4">Saldo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(ledgerData.ledger || []).length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="text-center p-12 text-slate-400">
                                                No hay movimientos registrados
                                            </td>
                                        </tr>
                                    ) : (
                                        ledgerData.ledger.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="p-4 font-medium text-slate-700">
                                                    {row.date ? new Date(row.date).toLocaleDateString() : 'N/A'}
                                                </td>
                                                <td className="p-4 text-slate-600">{row.ref}</td>
                                                <td className="p-4 text-center">
                                                    <span className={clsx(
                                                        'px-2.5 py-1 rounded-full text-xs font-bold border',
                                                        row.type === 'COMPRA'
                                                            ? 'bg-orange-50 text-orange-700 border-orange-200'
                                                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    )}>
                                                        {row.type}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right text-slate-500 font-medium">
                                                    {row.type === 'COMPRA' ? formatUSD(row.debit) : '-'}
                                                </td>
                                                <td className="p-4 text-right text-emerald-600 font-bold">
                                                    {row.type === 'PAGO' ? formatUSD(row.credit) : '-'}
                                                </td>
                                                <td className="p-4 text-right font-black text-slate-900">
                                                    {formatUSD(row.balance)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                {(ledgerData.ledger || []).length > 0 && (
                                    <tfoot className="bg-slate-50/80 font-bold">
                                        <tr>
                                            <td colSpan="5" className="p-4 text-right text-sm text-slate-700">Saldo Final:</td>
                                            <td className="p-4 text-right text-sm font-black text-slate-900">
                                                {formatUSD(ledgerData.current_balance)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                </>
            )}

            {!ledgerLoading && !ledgerData && ledgerSupplierId === '' && (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                    <FileText size={40} className="mb-3 opacity-40" />
                    <p className="font-bold">Seleccione un proveedor para ver su estado de cuenta</p>
                </div>
            )}
        </div>
    );

    // -----------------------------------------------------------------------
    // LOADING STATE
    // -----------------------------------------------------------------------
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-200 border-t-indigo-600 mb-4" />
                <p className="font-medium animate-pulse">Cargando proveedores...</p>
            </div>
        );
    }

    // -----------------------------------------------------------------------
    // MAIN RENDER
    // -----------------------------------------------------------------------
    return (
        <div className="space-y-0">
            {renderSubTabNav()}

            {activeSubTab === 'cxp' && (
                selectedSupplier ? renderCxPDetail() : renderCxPList()
            )}

            {activeSubTab === 'ledger' && renderLedger()}

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

export default SuppliersTab;
