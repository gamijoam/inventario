import { useState, useEffect, useMemo } from 'react';
import {
    DollarSign, Calendar, AlertCircle, CheckCircle, X, Filter,
    Eye, Users, ChevronDown, Calculator, CheckSquare, Search,
    Wallet, Printer, FileText
} from 'lucide-react';
import apiClient from '../../../config/axios';
import { useConfig } from '../../../context/ConfigContext';
import InvoiceDetailModal from '../../../components/credit/InvoiceDetailModal';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';

// ---------------------------------------------------------------------------
// Sub-tab definitions
// ---------------------------------------------------------------------------
const SUB_TABS = [
    { id: 'cxc', label: 'Cuentas por Cobrar', icon: Wallet },
    { id: 'aging', label: 'Antigüedad', icon: Calendar },
    { id: 'ledger', label: 'Estado de Cuenta', icon: FileText },
];

// ---------------------------------------------------------------------------
// Currency helpers
// ---------------------------------------------------------------------------
const formatUSD = (amount) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
    }).format(Number(amount) || 0);

// ---------------------------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------------------------
const CreditosTab = ({ dateRange }) => {
    const { getExchangeRate, currencies, getActiveCurrencies, paymentMethods } = useConfig();

    // Active currencies unique by symbol
    const availableCurrencies = useMemo(() =>
        Array.from(new Map(
            [currencies.find(c => c.is_anchor), ...getActiveCurrencies()]
                .filter(Boolean)
                .map(c => [c.symbol, c])
        ).values()),
        [currencies, getActiveCurrencies]
    );

    // Sub-tab navigation
    const [activeSubTab, setActiveSubTab] = useState('cxc');

    // -----------------------------------------------------------------------
    // CXC STATE (Cuentas por Cobrar)
    // -----------------------------------------------------------------------
    const [invoices, setInvoices] = useState([]);
    const [filteredInvoices, setFilteredInvoices] = useState([]);
    const [viewMode, setViewMode] = useState('invoices');
    const [expandedClients, setExpandedClients] = useState({});
    const [cxcFilter, setCxcFilter] = useState('pending');
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [total, setTotal] = useState(0);

    // Selection for bulk payment
    const [selectedInvoices, setSelectedInvoices] = useState([]);
    const [isBulkPay, setIsBulkPay] = useState(false);

    // Payment Modal
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState('Efectivo');
    const [paymentCurrency, setPaymentCurrency] = useState('USD');
    const [reference, setReference] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

    // Valuation state
    const [valuationData, setValuationData] = useState(null);
    const [loadingValuation, setLoadingValuation] = useState(false);
    const [amountBs, setAmountBs] = useState('');
    const [rateMode, setRateMode] = useState('valuation');
    const [customRate, setCustomRate] = useState(0);

    // Invoice detail modal
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [detailSale, setDetailSale] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // -----------------------------------------------------------------------
    // AGING STATE
    // -----------------------------------------------------------------------
    const [agingReport, setAgingReport] = useState([]);
    const [loadingAging, setLoadingAging] = useState(false);

    // -----------------------------------------------------------------------
    // LEDGER STATE
    // -----------------------------------------------------------------------
    const [ledgerClientId, setLedgerClientId] = useState(null);
    const [ledgerData, setLedgerData] = useState(null);
    const [loadingLedger, setLoadingLedger] = useState(false);
    const [clientsList, setClientsList] = useState([]);

    // -----------------------------------------------------------------------
    // FETCH FUNCTIONS
    // -----------------------------------------------------------------------
    const fetchInvoices = async (currentPage = 0, append = false, overrideFilter, overrideSearch) => {
        setLoading(true);
        try {
            const activeFilter = overrideFilter !== undefined ? overrideFilter : cxcFilter;
            const activeSearch = overrideSearch !== undefined ? overrideSearch : searchTerm;
            const params = { skip: currentPage * 100, limit: 100 };
            if (dateRange?.start) params.start_date = dateRange.start;
            if (dateRange?.end) params.end_date = dateRange.end;
            if (activeFilter && activeFilter !== 'all') params.status = activeFilter;
            if (activeSearch) params.q = activeSearch;

            const response = await apiClient.get('/products/credits', { params });
            const data = response.data;
            const items = Array.isArray(data) ? data : (data.items || []);
            const responseTotal = Array.isArray(data) ? items.length : (data.total || items.length);
            const responseHasMore = Array.isArray(data) ? false : (data.has_more || false);

            setInvoices(prev => append ? [...prev, ...items] : items);
            setTotal(responseTotal);
            setHasMore(responseHasMore);
        } catch (error) {
            console.error('Error fetching invoices:', error);
            toast.error('Error al cargar cuentas por cobrar');
        } finally {
            setLoading(false);
        }
    };

    const fetchAgingReport = async () => {
        setLoadingAging(true);
        try {
            const response = await apiClient.get('/credits/aging-report');
            const sorted = response.data.sort((a, b) => b.total_debt - a.total_debt);
            setAgingReport(sorted);
            // Build client list for ledger selector
            setClientsList(sorted.map(item => ({ id: item.client_id, name: item.client_name })));
        } catch (error) {
            console.error('Error fetching aging report:', error);
            toast.error('Error al cargar reporte de antigüedad');
        } finally {
            setLoadingAging(false);
        }
    };

    const fetchLedger = async (clientId) => {
        if (!clientId) return;
        setLoadingLedger(true);
        setLedgerData(null);
        try {
            const response = await apiClient.get(`/credits/client/${clientId}/ledger`);
            setLedgerData(response.data);
        } catch (error) {
            console.error('Error fetching ledger:', error);
            toast.error('Error al cargar estado de cuenta');
        } finally {
            setLoadingLedger(false);
        }
    };

    // -----------------------------------------------------------------------
    // EFFECTS
    // -----------------------------------------------------------------------
    useEffect(() => {
        if (activeSubTab === 'cxc') {
            setPage(0);
            setInvoices([]);
            fetchInvoices(0, false);
        }
        if (activeSubTab === 'aging') fetchAgingReport();
    }, [activeSubTab, dateRange?.start, dateRange?.end]);

    // Reset and reload when page changes (only for page > 0, i.e. "Cargar más")
    useEffect(() => {
        if (activeSubTab === 'cxc' && page > 0) {
            fetchInvoices(page, true);
        }
    }, [page]);

    useEffect(() => {
        if (ledgerClientId) fetchLedger(ledgerClientId);
    }, [ledgerClientId]);

    // When filter changes: reset and refetch from backend (server-side filtering)
    useEffect(() => {
        if (activeSubTab !== 'cxc') return;
        setPage(0);
        setInvoices([]);
        fetchInvoices(0, false, cxcFilter, searchTerm);
    }, [cxcFilter]);

    // Debounced search: send to backend after 400ms
    useEffect(() => {
        if (activeSubTab !== 'cxc') return;
        const timer = setTimeout(() => {
            setPage(0);
            setInvoices([]);
            fetchInvoices(0, false, cxcFilter, searchTerm);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // filteredInvoices = invoices (already filtered server-side)
    useEffect(() => {
        setFilteredInvoices(invoices);
    }, [invoices]);

    // -----------------------------------------------------------------------
    // CXC HELPERS
    // -----------------------------------------------------------------------
    const getDaysOverdue = (dueDate) => {
        if (!dueDate) return 0;
        const due = new Date(dueDate);
        const now = new Date();
        const diff = Math.floor((now - due) / (1000 * 60 * 60 * 24));
        return diff > 0 ? diff : 0;
    };

    const getCurrentRate = () => {
        if (rateMode === 'custom') return customRate;
        if (rateMode === 'valuation' && valuationData) return valuationData.exchange_rate_used;
        if (rateMode.startsWith('currency_')) {
            const id = parseInt(rateMode.split('_')[1]);
            const curr = currencies.find(c => c.id === id);
            return curr ? curr.rate : 1;
        }
        return getExchangeRate(paymentCurrency) || 1;
    };

    const getLocalRate = () => {
        let r = 1;
        if (rateMode === 'custom') r = customRate;
        else if (rateMode === 'valuation') r = valuationData?.exchange_rate_used || 1;
        else if (rateMode.startsWith('currency_')) {
            const id = parseInt(rateMode.split('_')[1]);
            const c = currencies.find(x => x.id === id);
            if (c) r = c.rate;
        }
        return r;
    };

    const stats = useMemo(() => {
        const pending = invoices
            .filter(inv => !inv.paid)
            .reduce((sum, inv) => sum + Number(inv.balance_pending || inv.total_amount || 0), 0);
        const overdue = invoices
            .filter(inv => !inv.paid && inv.due_date && new Date(inv.due_date) < new Date())
            .reduce((sum, inv) => sum + Number(inv.balance_pending || inv.total_amount || 0), 0);
        const paid = invoices
            .filter(inv => inv.paid)
            .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
        return { pending, overdue, paid };
    }, [invoices]);

    // Group invoices by client
    const clientsArray = useMemo(() => {
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
        return Object.values(clientsData).sort((a, b) => b.total_debt - a.total_debt);
    }, [filteredInvoices]);

    const toggleClientExpand = (clientKey) => {
        setExpandedClients(prev => ({ ...prev, [clientKey]: !prev[clientKey] }));
    };

    // -----------------------------------------------------------------------
    // CXC ACTIONS
    // -----------------------------------------------------------------------
    const handleRegisterPayment = async (invoice) => {
        setSelectedInvoice(invoice);
        const debt = invoice.balance_pending || invoice.total_amount;
        setPaymentAmount(debt);
        setPaymentMethod('Efectivo Divisa ($)');
        setPaymentCurrency('USD');
        setIsBulkPay(false);
        setReference('');
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setShowPaymentModal(true);

        // Fetch Valuation
        setLoadingValuation(true);
        setValuationData(null);
        setAmountBs('');
        try {
            const { data } = await apiClient.get(`/credits/sales/${invoice.id}/valuation`);
            setValuationData(data);

            const activeBs = currencies.find(c => c.is_active && !c.is_anchor);
            if (activeBs) {
                setRateMode(`currency_${activeBs.id}`);
                setAmountBs((debt * activeBs.rate).toFixed(2));
                setCustomRate(activeBs.rate);
            } else {
                setRateMode('custom');
                setAmountBs((debt * 1).toFixed(2));
                setCustomRate(1);
            }
        } catch (error) {
            console.error("Error fetching valuation", error);
        } finally {
            setLoadingValuation(false);
        }
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
        setReference('');
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setIsBulkPay(true);
        setShowPaymentModal(true);

        const activeBs = currencies.find(c => c.is_active && !c.is_anchor);
        if (activeBs) {
            setRateMode(`currency_${activeBs.id}`);
            setCustomRate(activeBs.rate);
            setAmountBs((totalToPay * activeBs.rate).toFixed(2));
        } else {
            setRateMode('custom');
            setCustomRate(1);
            setAmountBs((totalToPay * 1).toFixed(2));
        }
    };

    const handleSelectInvoice = (id) => {
        setSelectedInvoices(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
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

        const currentM = paymentMethods.find(pm => pm.name === paymentMethod);
        if (currentM?.requires_reference && !reference.trim()) {
            toast.error(`El método ${paymentMethod} requiere número de referencia`);
            return;
        }

        let rateToUse = getCurrentRate();
        const amountInAnchor = paymentAmount;
        const isLocal = paymentCurrency === 'Bs' || paymentCurrency === 'VES';

        const effectiveLimit = isBulkPay
            ? invoices.filter(inv => selectedInvoices.includes(inv.id)).reduce((sum, inv) => sum + (inv.balance_pending || inv.total_amount), 0)
            : (selectedInvoice?.balance_pending || selectedInvoice?.total_amount);

        if (amountInAnchor > effectiveLimit + 0.01) {
            toast.error(`El monto ingresado excede el saldo ($${effectiveLimit.toFixed(2)})`);
            return;
        }

        let finalAmount = paymentAmount;
        if (isLocal) {
            if (amountBs) finalAmount = parseFloat(amountBs);
            else finalAmount = paymentAmount * rateToUse;
        }

        // BULK PAYMENT
        if (isBulkPay) {
            const invoicesToPay = invoices.filter(inv => selectedInvoices.includes(inv.id));
            try {
                let remainingUSD = amountInAnchor;
                for (const invoice of invoicesToPay) {
                    if (remainingUSD <= 0.001) break;
                    const invBalance = invoice.balance_pending || invoice.total_amount;
                    const payAmountUSD = Math.min(invBalance, remainingUSD);
                    const payAmountCurrency = isLocal ? (payAmountUSD * rateToUse) : payAmountUSD;

                    await apiClient.post('/products/sales/payments', {
                        sale_id: invoice.id,
                        amount: payAmountCurrency,
                        currency: paymentCurrency,
                        payment_method: paymentMethod,
                        exchange_rate: rateToUse,
                        payment_date: paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString(),
                        reference: reference || null
                    });
                    remainingUSD -= payAmountUSD;
                }
                toast.success('Pagos registrados correctamente');
                setSelectedInvoices([]);
                setShowPaymentModal(false);
                setPage(0);
                setInvoices([]);
                await fetchInvoices(0, false);
            } catch (error) {
                console.error('Error in bulk payment:', error);
                toast.error('Error al registrar pagos masivos');
            }
            return;
        }

        // SINGLE PAYMENT
        try {
            await apiClient.post('/products/sales/payments', {
                sale_id: selectedInvoice.id,
                amount: finalAmount,
                currency: paymentCurrency,
                payment_method: paymentMethod,
                exchange_rate: rateToUse,
                payment_date: paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString(),
                reference: reference
            });

            try {
                if (paymentMethod.toLowerCase().includes('efectivo')) {
                    await apiClient.post('/cash/movements', {
                        type: 'DEPOSIT',
                        amount: finalAmount,
                        currency: paymentCurrency,
                        exchange_rate: rateToUse,
                        description: `Abono CxC - Factura #${selectedInvoice.id} - ${selectedInvoice.customer?.name || 'Cliente'}`
                    });
                }
            } catch (cashError) {
                console.warn('No open cash session or error recording movement');
            }

            toast.success('Pago registrado correctamente');
            setShowPaymentModal(false);
            setPage(0);
            setInvoices([]);
            await fetchInvoices(0, false);
        } catch (error) {
            console.error('Error registering payment:', error);
            toast.error('Error al registrar el pago');
        }
    };

    // -----------------------------------------------------------------------
    // AGING ACTIONS
    // -----------------------------------------------------------------------
    const handleViewLedger = (clientId) => {
        setLedgerClientId(clientId);
        setActiveSubTab('ledger');
    };

    // -----------------------------------------------------------------------
    // LEDGER ACTIONS
    // -----------------------------------------------------------------------
    const handlePrintLedger = () => {
        window.print();
    };

    // -----------------------------------------------------------------------
    // STATS CARDS
    // -----------------------------------------------------------------------
    const STATS_CARDS = [
        {
            title: 'Total por Cobrar',
            value: stats.pending,
            subtext: `${invoices.filter(i => !i.paid).length} facturas pendientes`,
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

    // ===================================================================
    // RENDER: CXC Sub-tab
    // ===================================================================
    const renderCxc = () => (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {STATS_CARDS.map((stat, idx) => (
                    <div key={idx} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <stat.icon size={80} className={`text-${stat.color}-600 transform translate-x-4 -translate-y-4`} />
                        </div>
                        <div className="relative z-10">
                            <p className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-2">{stat.title}</p>
                            <p className={`text-2xl md:text-3xl font-black text-${stat.color}-600 tracking-tight`}>
                                ${stat.value.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-slate-400 text-xs mt-2 font-medium">{stat.subtext}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Controls */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sticky top-4 z-20 flex flex-col lg:flex-row justify-between items-center gap-4">
                {/* Filters */}
                <div className="flex bg-slate-100 p-1.5 rounded-xl w-full lg:w-auto overflow-x-auto">
                    {[
                        { id: 'pending', label: 'Pendientes', icon: DollarSign },
                        { id: 'overdue', label: 'Vencidas', icon: AlertCircle },
                        { id: 'paid', label: 'Pagadas', icon: CheckCircle }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setCxcFilter(tab.id)}
                            className={clsx(
                                "px-4 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap",
                                cxcFilter === tab.id
                                    ? "bg-white text-indigo-700 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                            )}
                        >
                            <tab.icon size={16} className={cxcFilter === tab.id ? "text-indigo-600" : "text-slate-400"} />
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

                    <div className="h-8 w-px bg-slate-200 mx-2 hidden lg:block" />

                    <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
                        <button
                            onClick={() => setViewMode('invoices')}
                            className={clsx(
                                "p-2 rounded-lg transition-all",
                                viewMode === 'invoices' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                            )}
                            title="Ver Facturas"
                        >
                            <Calendar size={20} />
                        </button>
                        <button
                            onClick={() => setViewMode('clients')}
                            className={clsx(
                                "p-2 rounded-lg transition-all",
                                viewMode === 'clients' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                            )}
                            title="Ver por Clientes"
                        >
                            <Users size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Invoice View */}
            {viewMode === 'invoices' ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="py-3 px-4 w-10 text-center">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            checked={filteredInvoices.length > 0 && filteredInvoices.filter(inv => !inv.paid).every(inv => selectedInvoices.includes(inv.id))}
                                            onChange={handleSelectAll}
                                        />
                                    </th>
                                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Factura</th>
                                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
                                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Emisión / Vence</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Total</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Saldo</th>
                                    <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Accion</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan="8" className="text-center py-10 text-slate-400">Cargando facturas...</td>
                                    </tr>
                                ) : filteredInvoices.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="text-center py-10 text-slate-400">
                                            No hay facturas {cxcFilter === 'pending' ? 'pendientes' : cxcFilter === 'overdue' ? 'vencidas' : 'pagadas'}.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredInvoices.map(inv => {
                                        const daysOverdue = getDaysOverdue(inv.due_date);
                                        return (
                                            <tr key={inv.id} className={clsx(
                                                "hover:bg-slate-50/50 transition-colors",
                                                selectedInvoices.includes(inv.id) && "bg-indigo-50/30"
                                            )}>
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
                                                <td className="py-3 px-4 font-bold text-indigo-600">#{inv.id}</td>
                                                <td className="py-3 px-4">
                                                    <p className="font-medium text-slate-800">{inv.customer?.name || 'Cliente General'}</p>
                                                    <p className="text-xs text-slate-400">{inv.customer?.id_number || ''}</p>
                                                </td>
                                                <td className="py-3 px-4 text-sm">
                                                    <div className="text-slate-700">{new Date(inv.date).toLocaleDateString()}</div>
                                                    {inv.due_date && (
                                                        <div className={clsx("text-xs", daysOverdue > 0 ? "text-rose-500 font-bold" : "text-slate-400")}>
                                                            Vence: {new Date(inv.due_date).toLocaleDateString()}
                                                            {daysOverdue > 0 && ` (+${daysOverdue}d)`}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-right font-medium text-slate-700">
                                                    {formatUSD(inv.total_amount)}
                                                </td>
                                                <td className="py-3 px-4 text-right font-bold text-slate-900">
                                                    {formatUSD(inv.balance_pending || inv.total_amount)}
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
                                                            onClick={() => handleViewDetail(inv)}
                                                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                        >
                                                            <Eye size={16} />
                                                        </button>
                                                        {!inv.paid && (
                                                            <button
                                                                onClick={() => handleRegisterPayment(inv)}
                                                                className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-sm shadow-indigo-200 hover:bg-indigo-700"
                                                            >
                                                                Abonar
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {hasMore && (
                        <div className="p-4 border-t border-slate-100 flex justify-center">
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={loading}
                                className="px-6 py-2 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-xl text-sm font-bold shadow-sm transition-all disabled:opacity-50"
                            >
                                {loading ? 'Cargando...' : 'Cargar más'}
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                // Clients view
                <div className="space-y-3">
                    {loading ? (
                        <div className="text-center py-10 text-slate-400">Cargando...</div>
                    ) : clientsArray.length === 0 ? (
                        <div className="text-center py-10 bg-white rounded-2xl shadow-sm border border-slate-200 text-slate-400">
                            No hay clientes con deuda {cxcFilter === 'pending' ? 'pendiente' : cxcFilter === 'overdue' ? 'vencida' : 'pagada'}.
                        </div>
                    ) : (
                        clientsArray.map(client => {
                            const clientKey = `${client.id}_${client.name}`;
                            const isExpanded = expandedClients[clientKey];
                            return (
                                <div key={clientKey} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div
                                        className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                                        onClick={() => toggleClientExpand(clientKey)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold shrink-0">
                                                {client.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800">{client.name}</p>
                                                <p className="text-xs text-slate-400">{client.id_number} · {client.invoices_count} factura(s)</p>
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
                                                            <th className="text-left py-3 px-4 font-bold">Emision / Vence</th>
                                                            <th className="text-right py-3 px-4 font-bold">Saldo</th>
                                                            <th className="text-center py-3 px-4 font-bold">Estado</th>
                                                            <th className="text-right py-3 px-4 font-bold">Accion</th>
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
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-6 border border-slate-700/50 backdrop-blur-md bg-slate-900/90 max-w-2xl w-[90%] md:w-auto">
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
                    <div className="h-10 w-px bg-slate-700 mx-2" />
                    <button
                        onClick={handleBulkPayment}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-900/50 transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap"
                    >
                        <Wallet size={20} />
                        Pagar Seleccion
                    </button>
                    <button
                        onClick={() => setSelectedInvoices([])}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
            )}
        </div>
    );

    // ===================================================================
    // RENDER: Aging Sub-tab
    // ===================================================================
    const renderAging = () => (
        <div className="space-y-4">
            {loadingAging ? (
                <div className="text-center py-10 text-slate-400">Cargando reporte de antigüedad...</div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-[700px] w-full divide-y divide-gray-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Deuda Total</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-green-600 uppercase tracking-wider">Corriente (0-15)</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-yellow-600 uppercase tracking-wider">15-30 Dias</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-orange-600 uppercase tracking-wider">30-60 Dias</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-red-600 uppercase tracking-wider">60+ Vencido</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Accion</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {agingReport.map((item) => (
                                    <tr key={item.client_id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                                            {item.client_name}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-bold text-slate-900">
                                            {formatUSD(item.total_debt)}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-green-700 bg-green-50 font-medium">
                                            {item.current > 0 ? formatUSD(item.current) : '-'}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-yellow-700 bg-yellow-50 font-medium">
                                            {item.days_15_30 > 0 ? formatUSD(item.days_15_30) : '-'}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-orange-700 bg-orange-50 font-medium">
                                            {item.days_30_60 > 0 ? formatUSD(item.days_30_60) : '-'}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-white bg-red-600 font-bold">
                                            {item.days_60_plus > 0 ? formatUSD(item.days_60_plus) : '-'}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                                            <button
                                                onClick={() => handleViewLedger(item.client_id)}
                                                className="text-indigo-600 hover:text-indigo-900 font-bold text-xs"
                                            >
                                                Ver Estado
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {agingReport.length === 0 && (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-10 text-center text-slate-400">
                                            No hay deudas pendientes.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );

    // ===================================================================
    // RENDER: Ledger Sub-tab
    // ===================================================================
    const renderLedger = () => (
        <div className="space-y-4">
            {/* Client Selector */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <label className="text-sm font-bold text-slate-600 whitespace-nowrap">Seleccionar Cliente:</label>
                <select
                    value={ledgerClientId || ''}
                    onChange={(e) => setLedgerClientId(e.target.value ? Number(e.target.value) : null)}
                    className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-700 text-sm"
                >
                    <option value="">-- Seleccione un cliente --</option>
                    {clientsList.map(client => (
                        <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                </select>
                {ledgerData && (
                    <button
                        onClick={handlePrintLedger}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors print:hidden"
                    >
                        <Printer size={16} />
                        Imprimir
                    </button>
                )}
            </div>

            {!ledgerClientId && (
                <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-slate-200 border-dashed">
                    <FileText className="mx-auto text-slate-300 mb-4" size={64} />
                    <p className="text-slate-500 font-medium text-lg">Seleccione un cliente para ver su estado de cuenta</p>
                    <p className="text-slate-400 text-sm mt-1">O haga clic en "Ver Estado" desde la pestaña Antigüedad</p>
                </div>
            )}

            {loadingLedger && (
                <div className="text-center py-10 text-slate-400">Cargando estado de cuenta...</div>
            )}

            {ledgerData && !loadingLedger && (
                <>
                    {/* Client Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-5 rounded-2xl shadow-sm border border-slate-200 print:shadow-none">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">{ledgerData.client.name}</h3>
                            <p className="text-slate-500 text-sm">ID Cliente: {ledgerData.client.id}</p>
                        </div>
                        <div className="mt-4 md:mt-0 text-right">
                            <div className="text-sm text-slate-500">Saldo Actual</div>
                            <div className={`text-3xl font-black ${ledgerData.current_balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                {formatUSD(ledgerData.current_balance)}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">Limite: {formatUSD(ledgerData.client.limit)}</div>
                        </div>
                    </div>

                    {/* Ledger Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:shadow-none">
                        <div className="overflow-x-auto">
                            <table className="min-w-[550px] w-full divide-y divide-gray-200">
                                <thead className="bg-slate-50 print:bg-gray-100">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Referencia</th>
                                        <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo</th>
                                        <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Cargo (Venta)</th>
                                        <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Abono (Pago)</th>
                                        <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Saldo</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {ledgerData.ledger.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-10 text-center text-slate-400">
                                                No hay movimientos registrados.
                                            </td>
                                        </tr>
                                    ) : (
                                        ledgerData.ledger.map((row, index) => (
                                            <tr key={index} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-900">
                                                    {row.date ? new Date(row.date).toLocaleDateString() : 'N/A'}
                                                </td>
                                                <td className="px-4 py-4 whitespace-normal text-sm text-slate-900">
                                                    {row.ref}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-center">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                        row.type === 'VENTA' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                                                    }`}>
                                                        {row.type}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-slate-500">
                                                    {row.type === 'VENTA' ? formatUSD(row.debit) : '-'}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-slate-500">
                                                    {row.type === 'ABONO' ? formatUSD(row.credit) : '-'}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-bold text-slate-900">
                                                    {formatUSD(row.balance)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                <tfoot className="bg-slate-50 font-bold">
                                    <tr>
                                        <td colSpan="5" className="px-4 py-4 text-right text-sm text-slate-900">Saldo Final:</td>
                                        <td className="px-4 py-4 text-right text-sm text-slate-900">
                                            {formatUSD(ledgerData.current_balance)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );

    // ===================================================================
    // RENDER: Payment Modal
    // ===================================================================
    const renderPaymentModal = () => {
        if (!showPaymentModal || (!selectedInvoice && !isBulkPay)) return null;

        return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">
                                {isBulkPay ? 'Pago Multiple' : 'Registrar Abono'}
                            </h3>
                            <p className="text-xs text-slate-500 font-medium">
                                {isBulkPay ? `${selectedInvoices.length} facturas seleccionadas` : `Factura #${selectedInvoice?.id}`}
                            </p>
                        </div>
                        <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-xl transition-colors border border-slate-200 shadow-sm">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
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

                        {/* Rate Selector */}
                        <div className="bg-white/50 rounded-xl">
                            <div className="mt-3">
                                <label className="block text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2">Tasa de Cambio a Aplicar</label>
                                <select
                                    value={rateMode}
                                    onChange={(e) => {
                                        const mode = e.target.value;
                                        setRateMode(mode);

                                        let newRate = 1;
                                        if (mode === 'custom') newRate = customRate;
                                        else if (mode === 'valuation' && valuationData) newRate = valuationData.exchange_rate_used;
                                        else if (mode.startsWith('currency_')) {
                                            const id = parseInt(mode.split('_')[1]);
                                            const c = currencies.find(x => x.id === id);
                                            if (c) newRate = c.rate;
                                        }

                                        if (paymentAmount) {
                                            setAmountBs((paymentAmount * newRate).toFixed(2));
                                        }
                                    }}
                                    className="w-full p-2 bg-white border border-indigo-200 rounded-lg text-sm font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    {currencies.filter(c => c.is_active && !c.is_anchor).map(c => (
                                        <option key={c.id} value={`currency_${c.id}`}>
                                            {c.name} ({(c.rate || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })})
                                        </option>
                                    ))}
                                    <option value="custom">Manual / Personalizada</option>
                                </select>

                                {rateMode === 'custom' && (
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className="text-xs font-bold text-indigo-400">Tasa: BS</span>
                                        <input
                                            type="number"
                                            value={customRate}
                                            onChange={(e) => {
                                                const newRate = parseFloat(e.target.value) || 0;
                                                setCustomRate(newRate);
                                                if (paymentAmount) setAmountBs((paymentAmount * newRate).toFixed(2));
                                            }}
                                            className="flex-1 px-3 py-2 text-right text-sm font-bold border border-indigo-200 rounded-lg focus:border-indigo-500 outline-none"
                                            placeholder="0.00"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Payment Date Picker */}
                        <div className="bg-white/50 rounded-xl">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha de Pago</label>
                            <input
                                type="date"
                                value={paymentDate}
                                max={new Date().toISOString().split('T')[0]}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-700"
                            />
                        </div>

                        {/* Dual Inputs USD / Bs */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Monto USD ($)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-3 text-slate-400 font-bold">$</span>
                                    <input
                                        type="number"
                                        value={paymentAmount}
                                        onChange={(e) => {
                                            const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                                            setPaymentAmount(val);
                                            const r = getLocalRate();
                                            if (val !== '') setAmountBs((val * r).toFixed(2));
                                            else setAmountBs('');
                                        }}
                                        className="w-full pl-6 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-bold text-lg text-slate-800"
                                        step="0.01"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Monto Bs</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-3 text-slate-400 font-bold text-xs mt-0.5">Bs</span>
                                    <input
                                        type="number"
                                        value={amountBs}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setAmountBs(val);
                                            const r = getLocalRate();
                                            if (val && r > 0) setPaymentAmount((parseFloat(val) / r).toFixed(2));
                                            else if (!val) setPaymentAmount('');
                                        }}
                                        className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-bold text-lg text-slate-800"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Method + Currency */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Metodo</label>
                                <select
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-700 text-sm"
                                >
                                    {paymentMethods.filter(pm => pm.is_active).map(pm => (
                                        <option key={pm.id} value={pm.name}>{pm.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Reference Input (Conditional) */}
                            {paymentMethods.find(pm => pm.name === paymentMethod)?.requires_reference && (
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2">
                                        Referencia / Nro. Transaccion
                                    </label>
                                    <input
                                        type="text"
                                        value={reference}
                                        onChange={(e) => setReference(e.target.value)}
                                        placeholder="Ej: 12345678"
                                        className="w-full p-2.5 bg-indigo-50/50 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-indigo-700 placeholder:text-indigo-300"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Moneda de Pago</label>
                                <select
                                    value={paymentCurrency}
                                    onChange={(e) => setPaymentCurrency(e.target.value)}
                                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-700"
                                >
                                    {[
                                        { symbol: 'USD', name: 'Dolar', rate: 1, is_anchor: true },
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
                                Tasa de cambio: {(getExchangeRate(paymentCurrency) || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })} {paymentCurrency}/USD
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
        );
    };

    // ===================================================================
    // MAIN RENDER
    // ===================================================================
    return (
        <div className="space-y-6">
            {/* Sub-tab Navigation (pill style) */}
            <div className="flex bg-slate-100 p-1.5 rounded-xl w-fit">
                {SUB_TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSubTab(tab.id)}
                        className={clsx(
                            "px-5 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap",
                            activeSubTab === tab.id
                                ? "bg-white text-indigo-700 shadow-sm"
                                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                        )}
                    >
                        <tab.icon size={16} className={activeSubTab === tab.id ? "text-indigo-600" : "text-slate-400"} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Sub-tab Content */}
            {activeSubTab === 'cxc' && renderCxc()}
            {activeSubTab === 'aging' && renderAging()}
            {activeSubTab === 'ledger' && renderLedger()}

            {/* Payment Modal (always rendered when active) */}
            {renderPaymentModal()}

            {/* Invoice Detail Modal */}
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

export default CreditosTab;
