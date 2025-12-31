import { useState, useEffect } from 'react';
import { DollarSign, Calendar, AlertCircle, CheckCircle, X, Filter, Eye, Users, ChevronDown, ChevronRight, Calculator, CheckSquare, Search, Wallet } from 'lucide-react';
import apiClient from '../../config/axios';
import { useConfig } from '../../context/ConfigContext';
import InvoiceDetailModal from '../../components/credit/InvoiceDetailModal';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';

const AccountsReceivable = () => {
    const { getExchangeRate, currencies, getActiveCurrencies, paymentMethods } = useConfig();

    // Get all active currencies including USD (anchor)
    const availableCurrencies = [
        currencies.find(c => c.is_anchor), // USD
        ...getActiveCurrencies() // Other active currencies
    ].filter(Boolean); // Remove undefined if anchor not found

    const [invoices, setInvoices] = useState([]);
    const [filteredInvoices, setFilteredInvoices] = useState([]);
    const [viewMode, setViewMode] = useState('invoices'); // 'invoices' | 'clients'
    const [expandedClients, setExpandedClients] = useState({}); // { clientName: boolean }
    const [filter, setFilter] = useState('pending'); // pending, overdue, paid
    const [loading, setLoading] = useState(false);

    // Search
    const [searchTerm, setSearchTerm] = useState('');

    // Payment Modal
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState('Efectivo');
    const [paymentCurrency, setPaymentCurrency] = useState('USD');

    // NEW: Invoice Detail Modal
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [detailSale, setDetailSale] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // BULK PAYMENT STATE
    const [selectedInvoices, setSelectedInvoices] = useState([]); // Array of IDs
    const [isBulkPay, setIsBulkPay] = useState(false);

    useEffect(() => {
        fetchInvoices();
    }, []);

    useEffect(() => {
        applyFilter();
    }, [invoices, filter, searchTerm]);

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/products/credits/pending');
            setInvoices(response.data);
        } catch (error) {
            console.error('Error fetching invoices:', error);
            toast.error('Error al cargar cuentas por cobrar');
        } finally {
            setLoading(false);
        }
    };

    const applyFilter = () => {
        const now = new Date();
        let filtered = [];

        if (filter === 'pending') {
            filtered = invoices.filter(inv => !inv.paid && (!inv.due_date || new Date(inv.due_date) >= now));
        } else if (filter === 'overdue') {
            filtered = invoices.filter(inv => !inv.paid && inv.due_date && new Date(inv.due_date) < now);
        } else if (filter === 'paid') {
            filtered = invoices.filter(inv => inv.paid);
        }

        // Apply Search
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(inv =>
                inv.id.toString().includes(term) ||
                (inv.customer?.name || '').toLowerCase().includes(term) ||
                (inv.customer?.id_number || '').toLowerCase().includes(term)
            );
        }

        setFilteredInvoices(filtered);
    };

    const getDaysOverdue = (dueDate) => {
        if (!dueDate) return 0;
        const due = new Date(dueDate);
        const now = new Date();
        const diff = Math.floor((now - due) / (1000 * 60 * 60 * 24));
        return diff > 0 ? diff : 0;
    };

    const handleRegisterPayment = (invoice) => {
        setSelectedInvoice(invoice);
        setPaymentAmount(invoice.balance_pending || invoice.total_amount);
        setPaymentMethod('Efectivo');
        setPaymentCurrency('USD');
        setIsBulkPay(false);
        setShowPaymentModal(true);
    };

    const handleBulkPayment = () => {
        if (selectedInvoices.length === 0) return;

        const totalToPay = invoices
            .filter(inv => selectedInvoices.includes(inv.id))
            .reduce((sum, inv) => sum + (inv.balance_pending || inv.total_amount), 0);

        setSelectedInvoice(null);
        setPaymentAmount(Number(totalToPay.toFixed(2)));
        setPaymentMethod('Efectivo');
        setPaymentCurrency('USD');
        setIsBulkPay(true);
        setShowPaymentModal(true);
    };

    const handleSelectInvoice = (id) => {
        setSelectedInvoices(prev => {
            if (prev.includes(id)) return prev.filter(item => item !== id);
            return [...prev, id];
        });
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedInvoices(filteredInvoices.map(inv => inv.id));
        } else {
            setSelectedInvoices([]);
        }
    };

    const handleViewDetail = async (invoice) => {
        setLoadingDetail(true);
        setShowDetailModal(true);
        try {
            const response = await apiClient.get(`/products/sales/${invoice.id}`);
            setDetailSale(response.data);
        } catch (error) {
            console.error('Error fetching sale detail:', error);
            toast.error('Error al cargar el detalle de la factura');
            setShowDetailModal(false);
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleSavePayment = async () => {
        if (paymentAmount <= 0) {
            toast.error('Ingrese un monto válido');
            return;
        }

        const currentExchangeRate = getExchangeRate(paymentCurrency);
        const amountInAnchor = paymentAmount / (currentExchangeRate || 1);

        // BULK PAYMENT LOGIC
        if (isBulkPay) {
            const invoicesToPay = invoices.filter(inv => selectedInvoices.includes(inv.id));
            const totalBalance = invoicesToPay.reduce((sum, inv) => sum + (inv.balance_pending || inv.total_amount), 0);

            if (amountInAnchor > totalBalance + 0.01) {
                toast.error(`El monto ingresado excede el total de las facturas (` + totalBalance.toFixed(2) + `)`);
                return;
            }

            try {
                let remainingPayment = amountInAnchor;

                for (const invoice of invoicesToPay) {
                    if (remainingPayment <= 0.001) break;

                    const invBalance = invoice.balance_pending || invoice.total_amount;
                    const payAmount = Math.min(invBalance, remainingPayment);
                    const payAmountInCurrency = payAmount * (currentExchangeRate || 1);

                    await apiClient.post('/products/sales/payments', {
                        sale_id: invoice.id,
                        amount: payAmountInCurrency,
                        currency: paymentCurrency,
                        payment_method: paymentMethod,
                        exchange_rate: currentExchangeRate
                    });

                    const newBalance = Math.max(0, invBalance - payAmount);
                    const isPaid = newBalance <= 0.01;

                    await apiClient.put(`/products/sales/${invoice.id}`, null, {
                        params: { balance_pending: isPaid ? 0 : newBalance, paid: isPaid }
                    });

                    remainingPayment -= payAmount;
                }

                toast.success('Pagos registrados correctamente');
                setSelectedInvoices([]);
                setShowPaymentModal(false);
                await fetchInvoices();

            } catch (error) {
                console.error('Error in bulk payment:', error);
                toast.error('Error al registrar pagos masivos: ' + error.message);
            }
            return;
        }

        // SINGLE INVOICE LOGIC
        if (!selectedInvoice) return;

        const balancePending = selectedInvoice.balance_pending || selectedInvoice.total_amount;

        if (amountInAnchor > balancePending + 0.01) {
            toast.error(`El monto excede el saldo pendiente ($${balancePending.toFixed(2)})`);
            return;
        }

        try {
            await apiClient.post('/products/sales/payments', {
                sale_id: selectedInvoice.id,
                amount: paymentAmount,
                currency: paymentCurrency,
                payment_method: paymentMethod,
                exchange_rate: currentExchangeRate
            });

            const newBalance = Math.max(0, balancePending - amountInAnchor);
            const isPaid = newBalance <= 0.01;

            await apiClient.put(`/products/sales/${selectedInvoice.id}`, null, {
                params: {
                    balance_pending: isPaid ? 0 : newBalance,
                    paid: isPaid
                }
            });

            try {
                await apiClient.post('/cash/movements', {
                    type: 'DEPOSIT',
                    amount: paymentAmount,
                    currency: paymentCurrency,
                    exchange_rate: currentExchangeRate,
                    description: `Abono CxC - Factura #${selectedInvoice.id} - ${selectedInvoice.customer?.name || 'Cliente'}`
                });
            } catch (cashError) {
                console.warn('No open cash session');
            }

            toast.success(`Pago registrado correctamente`);
            setShowPaymentModal(false);
            await fetchInvoices();
        } catch (error) {
            console.error('Error registering payment:', error);
            toast.error('Error al registrar el pago');
        }
    };

    const getTotalStats = () => {
        const pending = invoices
            .filter(inv => !inv.paid)
            .reduce((sum, inv) => sum + Number(inv.balance_pending || inv.total_amount || 0), 0);

        const overdue = invoices
            .filter(inv => !inv.paid && inv.due_date && new Date(inv.due_date) < new Date())
            .reduce((sum, inv) => sum + Number(inv.balance_pending || inv.total_amount || 0), 0);

        const paid = invoices
            .filter(inv => inv.paid)
            .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);

        return { total: pending + paid, overdue, pending, paid };
    };

    const stats = getTotalStats();

    // Group invoices by client
    const clientsData = filteredInvoices.reduce((acc, invoice) => {
        const clientName = invoice.customer?.name || 'Cliente General';
        const clientId = invoice.customer?.id || 'unknown';
        const clientKey = `${clientId}_${clientName}`;

        if (!acc[clientKey]) {
            acc[clientKey] = {
                id: clientId,
                name: clientName,
                id_number: invoice.customer?.id_number || 'Sin ID',
                total_debt: 0,
                invoices_count: 0,
                invoices: [],
                overdue_count: 0
            };
        }

        const balance = Number(invoice.balance_pending || invoice.total_amount || 0);
        acc[clientKey].total_debt += balance;
        acc[clientKey].invoices_count += 1;
        acc[clientKey].invoices.push(invoice);

        if (!invoice.paid && invoice.due_date && new Date(invoice.due_date) < new Date()) {
            acc[clientKey].overdue_count += 1;
        }

        return acc;
    }, {});

    const clientsArray = Object.values(clientsData).sort((a, b) => b.total_debt - a.total_debt);

    const toggleClientExpand = (clientKey) => {
        setExpandedClients(prev => ({
            ...prev,
            [clientKey]: !prev[clientKey]
        }));
    };

    const STATS_CARDS = [
        {
            title: 'Total por Cobrar',
            value: stats.pending,
            subtext: `${invoices.filter(i => !i.paid).length} facturas pedientes`,
            color: 'blue',
            icon: Wallet
        },
        {
            title: 'Vencido',
            value: stats.overdue,
            subtext: `${invoices.filter(i => !i.paid && i.due_date && new Date(i.due_date) < new Date()).length} facturas vencidas`,
            color: 'rose',
            icon: AlertCircle
        },
        {
            title: 'Cobrado (Total)',
            value: stats.paid,
            subtext: `${invoices.filter(i => i.paid).length} facturas pagadas`,
            color: 'emerald',
            icon: CheckCircle
        }
    ];

    return (
        <div className="p-6 max-w-[1600px] mx-auto">
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Cuentas por Cobrar (CxC)</h1>
                    <p className="text-slate-500 font-medium mt-1">Gestión de créditos, abonos y deudas de clientes</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {STATS_CARDS.map((stat, idx) => (
                    <div key={idx} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col relative overflow-hidden group hover:shadow-md transition-all">
                        <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity`}>
                            <stat.icon size={80} className={`text-${stat.color}-600 transform translate-x-4 -translate-y-4`} />
                        </div>
                        <div className="relative z-10">
                            <p className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-2">{stat.title}</p>
                            <p className={`text-3xl font-black text-${stat.color}-600 tracking-tight`}>
                                ${stat.value.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-slate-400 text-xs mt-2 font-medium">{stat.subtext}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Controls */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6 sticky top-4 z-20 flex flex-col lg:flex-row justify-between items-center gap-4">

                {/* Filters */}
                <div className="flex bg-slate-100 p-1.5 rounded-xl w-full lg:w-auto overflow-x-auto">
                    {[
                        { id: 'pending', label: 'Por Vencer', icon: DollarSign },
                        { id: 'overdue', label: 'Vencidas', icon: AlertCircle },
                        { id: 'paid', label: 'Pagadas', icon: CheckCircle }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setFilter(tab.id)}
                            className={clsx(
                                "px-4 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap",
                                filter === tab.id
                                    ? "bg-white text-indigo-700 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                            )}
                        >
                            <tab.icon size={16} className={filter === tab.id ? "text-indigo-600" : "text-slate-400"} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Search & View Mode */}
                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <div className="relative flex-1 lg:w-64">
                        <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar cliente, factura..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-700 transition-all placeholder:text-slate-400"
                        />
                    </div>

                    <div className="h-8 w-px bg-slate-200 mx-2 hidden lg:block"></div>

                    <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
                        <button
                            onClick={() => setViewMode('invoices')}
                            className={clsx(
                                "p-2 rounded-md transition-all",
                                viewMode === 'invoices' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                            )}
                            title="Ver Facturas"
                        >
                            <Calendar size={20} />
                        </button>
                        <button
                            onClick={() => setViewMode('clients')}
                            className={clsx(
                                "p-2 rounded-md transition-all",
                                viewMode === 'clients' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                            )}
                            title="Ver por Clientes"
                        >
                            <Users size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Table/Grid */}
            {viewMode === 'invoices' ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-500">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="p-4 w-12 text-center">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            onChange={handleSelectAll}
                                            checked={filteredInvoices.length > 0 && selectedInvoices.length === filteredInvoices.length}
                                        />
                                    </th>
                                    <th className="text-left p-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider">Cliente</th>
                                    <th className="text-left p-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider">Detalles</th>
                                    <th className="text-right p-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider">Monto Total</th>
                                    <th className="text-right p-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider">Saldo</th>
                                    <th className="text-center p-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider">Estado</th>
                                    <th className="text-right p-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr><td colSpan="7" className="p-10 text-center text-slate-400">Cargando datos...</td></tr>
                                ) : filteredInvoices.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="p-16 text-center">
                                            <div className="flex flex-col items-center justify-center text-slate-400">
                                                <Filter size={48} className="mb-4 opacity-20" />
                                                <p className="font-medium">No se encontraron facturas con este filtro</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredInvoices.map((invoice, idx) => {
                                        const daysOverdue = getDaysOverdue(invoice.due_date);
                                        const balancePending = invoice.balance_pending || invoice.total_amount;

                                        return (
                                            <tr
                                                key={invoice.id}
                                                className={clsx(
                                                    "group transition-colors border-l-4",
                                                    selectedInvoices.includes(invoice.id) ? "bg-indigo-50/50 border-indigo-500" : "border-transparent hover:bg-slate-50/50",
                                                    idx % 2 === 0 ? "bg-white" : "bg-slate-50/20"
                                                )}
                                            >
                                                <td className="p-4 text-center">
                                                    {!invoice.paid && (
                                                        <input
                                                            type="checkbox"
                                                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                            checked={selectedInvoices.includes(invoice.id)}
                                                            onChange={() => handleSelectInvoice(invoice.id)}
                                                        />
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <div>
                                                        <div className="font-bold text-slate-800">{invoice.customer?.name || 'Cliente General'}</div>
                                                        <div className="text-xs text-slate-400 font-mono mt-0.5">{invoice.customer?.id_number || 'N/A'}</div>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="text-sm font-medium text-slate-700">Factura #{invoice.id}</div>
                                                    <div className="text-xs text-slate-400 flex flex-col gap-0.5 mt-1">
                                                        <span>Emisión: {new Date(invoice.date).toLocaleDateString()}</span>
                                                        <span>Vence: {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right font-medium text-slate-500">
                                                    ${Number(invoice.total_amount).toFixed(2)}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className={clsx("font-black text-sm", invoice.paid ? "text-emerald-600" : "text-slate-800")}>
                                                        ${Number(balancePending).toFixed(2)}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    {daysOverdue > 0 ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold border border-rose-100">
                                                            <AlertCircle size={12} /> +{daysOverdue}d
                                                        </span>
                                                    ) : invoice.paid ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold border border-emerald-100">
                                                            <CheckCircle size={12} /> Pagada
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-slate-200">
                                                            <Calendar size={12} /> Al día
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleViewDetail(invoice)}
                                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                            title="Ver Detalle"
                                                        >
                                                            <Eye size={18} />
                                                        </button>
                                                        {!invoice.paid && (
                                                            <button
                                                                onClick={() => handleRegisterPayment(invoice)}
                                                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs flex items-center gap-2 shadow-sm shadow-indigo-200"
                                                            >
                                                                Abonar
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {clientsArray.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-slate-200 border-dashed">
                            <Users className="mx-auto text-slate-300 mb-4" size={64} />
                            <p className="text-slate-500 font-medium text-lg">No hay clientes con facturas en este estado.</p>
                        </div>
                    ) : (
                        clientsArray.map(client => {
                            const clientKey = `${client.id}_${client.name}`;
                            const isExpanded = expandedClients[clientKey];

                            return (
                                <div key={clientKey} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all hover:shadow-md">
                                    <div
                                        className="p-6 cursor-pointer flex flex-col md:flex-row justify-between items-center gap-6"
                                        onClick={() => toggleClientExpand(clientKey)}
                                    >
                                        <div className="flex items-center gap-4 w-full md:w-auto">
                                            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xl uppercase border-2 border-white shadow-sm">
                                                {client.name.substring(0, 2)}
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-800">{client.name}</h3>
                                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                                    <span className="font-mono bg-slate-100 px-1.5 rounded">{client.id_number}</span>
                                                    <span>• {client.invoices_count} facturas</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Deuda Total</p>
                                                <p className="text-2xl font-black text-slate-800 tracking-tight">${client.total_debt.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
                                            </div>
                                            {client.overdue_count > 0 && (
                                                <div className="bg-rose-50 text-rose-600 px-3 py-1.5 rounded-xl text-xs font-bold border border-rose-100 flex items-center gap-1.5">
                                                    <AlertCircle size={14} />
                                                    {client.overdue_count} vencidas
                                                </div>
                                            )}
                                            <div className={clsx("text-slate-300 transition-transform duration-300", isExpanded && "rotate-180")}>
                                                <ChevronDown size={24} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Client Invoices Expanded */}
                                    {isExpanded && (
                                        <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-slate-50">
                                                        <tr className="text-slate-500 border-b border-slate-200 text-xs uppercase tracking-wider">
                                                            <th className="py-3 px-4 w-10 text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                                    checked={client.invoices.some(i => !i.paid) && client.invoices.filter(i => !i.paid).every(i => selectedInvoices.includes(i.id))}
                                                                    onChange={(e) => {
                                                                        e.stopPropagation();
                                                                        if (e.target.checked) {
                                                                            const ids = client.invoices.filter(i => !i.paid).map(i => i.id);
                                                                            setSelectedInvoices(prev => [...new Set([...prev, ...ids])]);
                                                                        } else {
                                                                            const ids = client.invoices.map(i => i.id);
                                                                            setSelectedInvoices(prev => prev.filter(id => !ids.includes(id)));
                                                                        }
                                                                    }}
                                                                />
                                                            </th>
                                                            <th className="text-left py-3 px-4 font-bold">Factura</th>
                                                            <th className="text-left py-3 px-4 font-bold">Emisión / Vence</th>
                                                            <th className="text-right py-3 px-4 font-bold">Saldo</th>
                                                            <th className="text-center py-3 px-4 font-bold">Estado</th>
                                                            <th className="text-right py-3 px-4 font-bold">Acción</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {client.invoices.map(inv => (
                                                            <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                                                                <td className="py-3 px-4 text-center">
                                                                    {!inv.paid && (
                                                                        <input
                                                                            type="checkbox"
                                                                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                                            checked={selectedInvoices.includes(inv.id)}
                                                                            onChange={() => handleSelectInvoice(inv.id)}
                                                                        />
                                                                    )}
                                                                </td>
                                                                <td className="py-3 px-4 font-medium text-slate-700">#{inv.id}</td>
                                                                <td className="py-3 px-4 text-slate-500 text-xs">
                                                                    <div>{new Date(inv.date).toLocaleDateString()}</div>
                                                                    <div className="text-slate-400">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '-'}</div>
                                                                </td>
                                                                <td className="py-3 px-4 text-right font-bold text-slate-800">
                                                                    ${Number(inv.balance_pending || inv.total_amount).toFixed(2)}
                                                                </td>
                                                                <td className="py-3 px-4 text-center">
                                                                    {inv.paid ? (
                                                                        <span className="text-emerald-600 font-bold text-[10px] bg-emerald-50 px-2 py-1 rounded">PAGADO</span>
                                                                    ) : (inv.due_date && new Date(inv.due_date) < new Date()) ? (
                                                                        <span className="text-rose-600 font-bold text-[10px] bg-rose-50 px-2 py-1 rounded">VENCIDO</span>
                                                                    ) : (
                                                                        <span className="text-slate-500 font-bold text-[10px] bg-slate-100 px-2 py-1 rounded">PENDIENTE</span>
                                                                    )}
                                                                </td>
                                                                <td className="py-3 px-4 text-right">
                                                                    <div className="flex justify-end gap-2">
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); handleViewDetail(inv); }}
                                                                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                                        >
                                                                            <Eye size={16} />
                                                                        </button>
                                                                        {!inv.paid && (
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); handleRegisterPayment(inv); }}
                                                                                className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-sm shadow-indigo-200 hover:bg-indigo-700"
                                                                            >
                                                                                Abonar
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Bulk Action Bar */}
            {selectedInvoices.length > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-10 border border-slate-700/50 backdrop-blur-md bg-slate-900/90 max-w-2xl w-[90%] md:w-auto">
                    <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Total a Pagar</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black tracking-tight">
                                ${invoices.filter(inv => selectedInvoices.includes(inv.id))
                                    .reduce((sum, inv) => sum + (inv.balance_pending || inv.total_amount), 0)
                                    .toFixed(2)}
                            </span>
                            <span className="text-xs font-bold bg-slate-700 px-2 py-0.5 rounded-full text-slate-300">{selectedInvoices.length} facturas</span>
                        </div>
                    </div>
                    <div className="h-10 w-px bg-slate-700 mx-2"></div>
                    <button
                        onClick={handleBulkPayment}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-900/50 transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap"
                    >
                        <Wallet size={20} />
                        Pagar Selección
                    </button>
                    <button
                        onClick={() => setSelectedInvoices([])}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentModal && (selectedInvoice || isBulkPay) && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">
                                    {isBulkPay ? 'Pago Múltiple' : 'Registrar Abono'}
                                </h3>
                                <p className="text-xs text-slate-500 font-medium">
                                    {isBulkPay ? `${selectedInvoices.length} facturas seleccionadas` : `Factura #${selectedInvoice?.id}`}
                                </p>
                            </div>
                            <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-xl transition-colors border border-slate-200 shadow-sm">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Monto Original</p>
                                    <p className="text-lg font-bold text-slate-700">
                                        ${isBulkPay
                                            ? invoices.filter(inv => selectedInvoices.includes(inv.id)).reduce((sum, inv) => sum + Number(inv.total_amount), 0).toFixed(2)
                                            : Number(selectedInvoice?.total_amount).toFixed(2)
                                        }
                                    </p>
                                </div>
                                <div className="p-4 rounded-xl bg-rose-50 border border-rose-100">
                                    <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-1">Saldo Pendiente</p>
                                    <p className="text-lg font-black text-rose-600">
                                        ${isBulkPay
                                            ? paymentAmount.toFixed(2)
                                            : Number(selectedInvoice?.balance_pending || selectedInvoice?.total_amount).toFixed(2)
                                        }
                                    </p>
                                </div>
                            </div>

                            {/* Input Amount */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Monto A Pagar</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3.5 text-slate-400 font-bold">$</span>
                                    <input
                                        type="number"
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                        className="w-full pl-8 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-bold text-lg text-slate-800 transition-all placeholder:text-slate-300"
                                        step="0.01"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Método</label>
                                    <select
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-700"
                                    >
                                        {paymentMethods.filter(pm => pm.is_active).map(pm => (
                                            <option key={pm.id} value={pm.name}>{pm.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Moneda de Pago</label>
                                    <select
                                        value={paymentCurrency}
                                        onChange={(e) => setPaymentCurrency(e.target.value)}
                                        className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-700"
                                    >
                                        {[
                                            { symbol: 'USD', name: 'Dólar', rate: 1, is_anchor: true },
                                            ...availableCurrencies.filter(c => c.symbol !== 'USD')
                                        ].map(curr => (
                                            <option key={curr.symbol} value={curr.symbol}>{curr.symbol}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {paymentCurrency !== 'USD' && (
                                <div className="bg-indigo-50 text-indigo-700 px-4 py-3 rounded-xl text-xs font-medium border border-indigo-100 flex items-center gap-2">
                                    <Calculator size={16} />
                                    Tasa de cambio: {getExchangeRate(paymentCurrency).toLocaleString('es-VE', { minimumFractionDigits: 2 })} {paymentCurrency}/USD
                                </div>
                            )}

                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="flex-1 py-3 font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSavePayment}
                                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
                            >
                                <CheckSquare size={18} className="inline mr-2" />
                                Confirmar Pago
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <InvoiceDetailModal
                isOpen={showDetailModal}
                onClose={() => {
                    setShowDetailModal(false);
                    setDetailSale(null);
                }}
                sale={loadingDetail ? null : detailSale}
            />
        </div>
    );
};

export default AccountsReceivable;
