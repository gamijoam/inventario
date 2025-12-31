import { useState, useEffect } from 'react';
import { DollarSign, Calendar, AlertCircle, CheckCircle, X, Filter, Eye, Users, ChevronDown, ChevronRight } from 'lucide-react';
import apiClient from '../../config/axios';
import { useConfig } from '../../context/ConfigContext';
import InvoiceDetailModal from '../../components/credit/InvoiceDetailModal';

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
    }, [invoices, filter]);

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            // Get pending credit sales (invoices) from dedicated endpoint
            const response = await apiClient.get('/products/credits/pending');

            console.log('📊 Credit sales fetched:', response.data.length);

            // No need to filter client-side, backend does it
            setInvoices(response.data);
        } catch (error) {
            console.error('Error fetching invoices:', error);
            // Show error to user if strictly failure
            alert('Error al cargar cuentas por cobrar');
        } finally {
            setLoading(false);
        }
    };

    const applyFilter = () => {
        const now = new Date();
        let filtered = [];

        if (filter === 'pending') {
            // Not paid and not overdue
            filtered = invoices.filter(inv =>
                !inv.paid &&
                (!inv.due_date || new Date(inv.due_date) >= now)
            );
        } else if (filter === 'overdue') {
            // Not paid and overdue
            filtered = invoices.filter(inv =>
                !inv.paid &&
                inv.due_date &&
                new Date(inv.due_date) < now
            );
        } else if (filter === 'paid') {
            // Paid invoices
            filtered = invoices.filter(inv => inv.paid);
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

        // Calculate total amount to pay
        const totalToPay = invoices
            .filter(inv => selectedInvoices.includes(inv.id))
            .reduce((sum, inv) => sum + (inv.balance_pending || inv.total_amount), 0);

        setSelectedInvoice(null); // Indicates bulk
        setPaymentAmount(Number(totalToPay.toFixed(2))); // Fix precision
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

    // NEW: Handle view invoice detail
    const handleViewDetail = async (invoice) => {
        setLoadingDetail(true);
        setShowDetailModal(true);
        try {
            const response = await apiClient.get(`/products/sales/${invoice.id}`);
            setDetailSale(response.data);
        } catch (error) {
            console.error('Error fetching sale detail:', error);
            alert('Error al cargar el detalle de la factura');
            setShowDetailModal(false);
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleSavePayment = async () => {
        if (paymentAmount <= 0) {
            alert('Ingrese un monto válido');
            return;
        }

        const currentExchangeRate = getExchangeRate(paymentCurrency);
        const amountInAnchor = paymentAmount / (currentExchangeRate || 1);

        // BULK PAYMENT LOGIC
        if (isBulkPay) {
            const invoicesToPay = invoices.filter(inv => selectedInvoices.includes(inv.id));
            const totalBalance = invoicesToPay.reduce((sum, inv) => sum + (inv.balance_pending || inv.total_amount), 0);

            if (amountInAnchor > totalBalance + 0.01) {
                alert(`El monto ingresado excede el total de las facturas seleccionadas ($${totalBalance.toFixed(2)})`);
                return;
            }

            try {
                // Distribute payment proportionally or sequentially
                // Ideally backend should handle this, but client-side loop is requested for quick fix

                // We will pay fully each invoice until amount is exhausted, or pay fully if amount matches total
                // For simplicity in this "Pay Selected" feature, we assume FULL PAYMENT of selected items usually.
                // But user might edit the amount. If amount < total, we distribute.

                let remainingPayment = amountInAnchor;

                for (const invoice of invoicesToPay) {
                    if (remainingPayment <= 0.001) break;

                    const invBalance = invoice.balance_pending || invoice.total_amount;
                    const payAmount = Math.min(invBalance, remainingPayment);

                    // Convert back to payment currency for the record
                    const payAmountInCurrency = payAmount * (currentExchangeRate || 1);

                    // 1. Create SalePayment
                    await apiClient.post('/products/sales/payments', {
                        sale_id: invoice.id,
                        amount: payAmountInCurrency,
                        currency: paymentCurrency,
                        payment_method: paymentMethod,
                        exchange_rate: currentExchangeRate
                    });

                    // 2. Update sale
                    const newBalance = Math.max(0, invBalance - payAmount);
                    const isPaid = newBalance <= 0.01;

                    await apiClient.put(`/products/sales/${invoice.id}`, null, {
                        params: { balance_pending: isPaid ? 0 : newBalance, paid: isPaid }
                    });

                    remainingPayment -= payAmount;
                }

                alert('✅ Pagos registrados correctamente para las facturas seleccionadas.');
                setSelectedInvoices([]);
                setShowPaymentModal(false);
                await fetchInvoices();

            } catch (error) {
                console.error('Error in bulk payment:', error);
                alert('Error al registrar pagos masivos: ' + (error.response?.data?.detail || error.message));
            }
            return;
        }

        // SINGLE INVOICE LOGIC (Existing)
        if (!selectedInvoice) return;

        const balancePending = selectedInvoice.balance_pending || selectedInvoice.total_amount;

        if (amountInAnchor > balancePending + 0.01) {
            alert(`El monto ingresado ($${amountInAnchor.toFixed(2)}) excede el saldo pendiente ($${balancePending.toFixed(2)})`);
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

            alert(`✅ Pago registrado correctamente. ${isPaid ? 'Factura pagada completamente.' : `Saldo restante: $${newBalance.toFixed(2)}`}`);
            setShowPaymentModal(false);
            await fetchInvoices();
        } catch (error) {
            console.error('Error registering payment:', error);
            alert('Error al registrar el pago: ' + (error.response?.data?.detail || error.message));
        }
    };

    const getTotalStats = () => {
        // Total pending (unpaid invoices)
        const pending = invoices
            .filter(inv => !inv.paid)
            .reduce((sum, inv) => sum + Number(inv.balance_pending || inv.total_amount || 0), 0);

        // Overdue (unpaid and past due date)
        const overdue = invoices
            .filter(inv => !inv.paid && inv.due_date && new Date(inv.due_date) < new Date())
            .reduce((sum, inv) => sum + Number(inv.balance_pending || inv.total_amount || 0), 0);

        // Paid (all paid invoices)
        const paid = invoices
            .filter(inv => inv.paid)
            .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);

        // Total (all invoices)
        const total = pending + paid;

        return { total, overdue, pending, paid };
    };

    const stats = getTotalStats();

    // Group invoices by client
    const clientsData = filteredInvoices.reduce((acc, invoice) => {
        const clientName = invoice.customer?.name || 'Cliente General';
        const clientId = invoice.customer?.id || 'unknown';
        const clientKey = `${clientId}_${clientName}`; // Ensure uniqueness

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


    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Cuentas por Cobrar (CxC)</h1>
                <p className="text-gray-600">Gestión de deudas y cobros a clientes</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-6 mb-6">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-6">
                    <p className="text-blue-100 text-sm mb-2">Total por Cobrar</p>
                    <p className="text-4xl font-bold">${stats.pending.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
                    <p className="text-blue-100 text-sm opacity-90 mt-1 font-mono">
                        ~Bs {(stats.pending * getExchangeRate('VES')).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-blue-100 text-sm mt-2">{invoices.filter(i => !i.paid).length} facturas pendientes</p>
                </div>

                <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg shadow-lg p-6">
                    <p className="text-red-100 text-sm mb-2">Vencido</p>
                    <p className="text-4xl font-bold">${stats.overdue.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
                    <p className="text-red-100 text-sm mt-2">
                        {invoices.filter(i => !i.paid && i.due_date && new Date(i.due_date) < new Date()).length} facturas vencidas
                    </p>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-lg p-6">
                    <p className="text-green-100 text-sm mb-2">Cobrado (Total)</p>
                    <p className="text-4xl font-bold">${stats.paid.toFixed(2)}</p>
                    <p className="text-green-100 text-sm mt-2">{invoices.filter(i => i.paid).length} facturas pagadas</p>
                </div>
            </div>

            {/* Filters & View Toggle */}
            <div className="bg-white rounded-lg shadow-md p-4 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
                    <Filter className="text-gray-600 flex-shrink-0" size={20} />
                    <button
                        onClick={() => setFilter('pending')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${filter === 'pending'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        Por Vencer ({invoices.filter(i => !i.paid && (!i.due_date || new Date(i.due_date) >= new Date())).length})
                    </button>
                    <button
                        onClick={() => setFilter('overdue')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${filter === 'overdue'
                            ? 'bg-red-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        Vencidas ({invoices.filter(i => !i.paid && i.due_date && new Date(i.due_date) < new Date()).length})
                    </button>
                    <button
                        onClick={() => setFilter('paid')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${filter === 'paid'
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        Pagadas ({invoices.filter(i => i.paid).length})
                    </button>
                </div>

                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setViewMode('invoices')}
                        className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'invoices' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Calendar size={16} /> Facturas
                    </button>
                    <button
                        onClick={() => setViewMode('clients')}
                        className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'clients' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Users size={16} /> Por Clientes
                    </button>
                </div>
            </div>

            {/* BULK ACTION BAR */}
            {selectedInvoices.length > 0 && (
                <div className="fixed bottom-6 right-6 z-40 bg-gray-900 text-white p-4 rounded-xl shadow-2xl flex items-center gap-6 animate-fade-in-up border border-gray-700">
                    <div>
                        <p className="text-sm text-gray-400 font-bold uppercase tracking-wider">Seleccionado</p>
                        <p className="text-2xl font-bold">
                            ${invoices
                                .filter(inv => selectedInvoices.includes(inv.id))
                                .reduce((sum, inv) => sum + (inv.balance_pending || inv.total_amount), 0)
                                .toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">{selectedInvoices.length} facturas</p>
                    </div>
                    <button
                        onClick={handleBulkPayment}
                        className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg transition-all transform hover:scale-105 flex items-center gap-2"
                    >
                        <DollarSign size={20} />
                        Pagar Todo
                    </button>
                    <button
                        onClick={() => setSelectedInvoices([])}
                        className="text-gray-400 hover:text-white"
                    >
                        <X size={24} />
                    </button>
                </div>
            )}

            {/* Content: Invoices Table or Client Cards */}
            {viewMode === 'invoices' ? (
                <div className="bg-white rounded-lg shadow-md overflow-hidden animate-fade-in-up">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-4 w-10">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        onChange={handleSelectAll}
                                        checked={filteredInvoices.length > 0 && selectedInvoices.length === filteredInvoices.length}
                                    />
                                </th>
                                <th className="text-left p-4 font-semibold text-gray-700">Cliente</th>
                                <th className="text-left p-4 font-semibold text-gray-700">Factura #</th>
                                <th className="text-left p-4 font-semibold text-gray-700">Fecha Emisión</th>
                                <th className="text-left p-4 font-semibold text-gray-700">Fecha Vencimiento</th>
                                <th className="text-right p-4 font-semibold text-gray-700">Monto Original</th>
                                <th className="text-right p-4 font-semibold text-gray-700">Saldo Pendiente</th>
                                <th className="text-center p-4 font-semibold text-gray-700">Días de Retraso</th>
                                <th className="text-center p-4 font-semibold text-gray-700">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading ? (
                                <tr>
                                    <td colSpan="8" className="text-center p-8 text-gray-500">
                                        Cargando facturas...
                                    </td>
                                </tr>
                            ) : filteredInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="text-center p-8 text-gray-500">
                                        No hay facturas en esta categoría
                                    </td>
                                </tr>
                            ) : (
                                filteredInvoices.map(invoice => {
                                    const daysOverdue = getDaysOverdue(invoice.due_date);
                                    const balancePending = invoice.balance_pending || invoice.total_amount;

                                    return (
                                        <tr key={invoice.id} className={`hover:bg-gray-50 transition-colors ${selectedInvoices.includes(invoice.id) ? 'bg-blue-50' : ''}`}>
                                            <td className="p-4">
                                                {!invoice.paid && (
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                        checked={selectedInvoices.includes(invoice.id)}
                                                        onChange={() => handleSelectInvoice(invoice.id)}
                                                    />
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <div>
                                                    <p className="font-semibold text-gray-800">
                                                        {invoice.customer?.name || 'Cliente General'}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {invoice.customer?.id_number || 'Sin ID'}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="p-4 font-medium">#{invoice.id}</td>
                                            <td className="p-4">
                                                {new Date(invoice.date).toLocaleDateString('es-ES')}
                                            </td>
                                            <td className="p-4">
                                                {invoice.due_date
                                                    ? new Date(invoice.due_date).toLocaleDateString('es-ES')
                                                    : 'Sin fecha'
                                                }
                                            </td>
                                            <td className="p-4 text-right font-semibold">
                                                ${Number(invoice.total_amount).toFixed(2)}
                                            </td>
                                            <td className="p-4 text-right">
                                                <span className={`font-bold ${invoice.paid ? 'text-green-600' : 'text-red-600'
                                                    }`}>
                                                    ${Number(balancePending).toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                {daysOverdue > 0 ? (
                                                    <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-bold">
                                                        +{daysOverdue} días
                                                    </span>
                                                ) : invoice.paid ? (
                                                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                                                        Pagada
                                                    </span>
                                                ) : (
                                                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                                                        Al día
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => handleViewDetail(invoice)}
                                                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                                                        title="Ver detalle de factura"
                                                    >
                                                        <Eye size={16} />
                                                        Ver Detalle
                                                    </button>
                                                    {!invoice.paid && (
                                                        <button
                                                            onClick={() => handleRegisterPayment(invoice)}
                                                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                                                        >
                                                            <DollarSign size={16} />
                                                            Registrar Abono
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
            ) : (
                <div className="grid grid-cols-1 gap-6 animate-fade-in-up">
                    {clientsArray.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-xl shadow-sm">
                            <Users className="mx-auto text-gray-300 mb-3" size={48} />
                            <p className="text-gray-500 font-medium">No hay clientes con facturas en este estado.</p>
                        </div>
                    ) : (
                        clientsArray.map(client => {
                            const clientKey = `${client.id}_${client.name}`;
                            const isExpanded = expandedClients[clientKey];

                            return (
                                <div key={clientKey} className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
                                    <div
                                        className="p-6 cursor-pointer hover:bg-gray-50 transition-colors flex flex-col md:flex-row justify-between items-center gap-4"
                                        onClick={() => toggleClientExpand(clientKey)}
                                    >
                                        <div className="flex items-center gap-4 w-full md:w-auto">
                                            <div className="bg-blue-100 p-3 rounded-full text-blue-600 hidden md:block">
                                                <Users size={24} />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-bold text-gray-800">{client.name}</h3>
                                                <p className="text-sm text-gray-500">{client.id_number}</p>
                                                {client.overdue_count > 0 && (
                                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded mt-1">
                                                        <AlertCircle size={10} /> {client.overdue_count} facturas vencidas
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
                                            <div className="text-right">
                                                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Deuda Total</p>
                                                <p className="text-2xl font-black text-gray-800">${client.total_debt.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
                                                <p className="text-sm text-gray-400">{client.invoices_count} facturas</p>
                                            </div>
                                            <div className="text-gray-400">
                                                {isExpanded ? <ChevronDown size={24} /> : <ChevronRight size={24} />}
                                            </div>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="border-t bg-gray-50 p-4 animate-fade-in-down">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="text-gray-500 border-b">
                                                        <th className="py-2 w-10">
                                                            <input
                                                                type="checkbox"
                                                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        const clientInvoiceIds = client.invoices.filter(i => !i.paid).map(i => i.id);
                                                                        setSelectedInvoices(prev => [...new Set([...prev, ...clientInvoiceIds])]);
                                                                    } else {
                                                                        const clientInvoiceIds = client.invoices.map(i => i.id);
                                                                        setSelectedInvoices(prev => prev.filter(id => !clientInvoiceIds.includes(id)));
                                                                    }
                                                                }}
                                                                checked={client.invoices.some(i => !i.paid) && client.invoices.filter(i => !i.paid).every(i => selectedInvoices.includes(i.id))}
                                                            />
                                                        </th>
                                                        <th className="text-left py-2 font-medium">Factura #</th>
                                                        <th className="text-left py-2 font-medium">Vencimiento</th>
                                                        <th className="text-right py-2 font-medium">Saldo</th>
                                                        <th className="text-center py-2 font-medium">Estado</th>
                                                        <th className="text-right py-2 font-medium">Acción</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {client.invoices.map(inv => {
                                                        const bal = Number(inv.balance_pending || inv.total_amount);
                                                        const isOd = inv.due_date && new Date(inv.due_date) < new Date() && !inv.paid;

                                                        return (
                                                            <tr key={inv.id} className={`bg-white transition-colors ${selectedInvoices.includes(inv.id) ? 'bg-blue-50' : ''}`}>
                                                                <td className="py-3">
                                                                    {!inv.paid && (
                                                                        <input
                                                                            type="checkbox"
                                                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                                            checked={selectedInvoices.includes(inv.id)}
                                                                            onChange={() => handleSelectInvoice(inv.id)}
                                                                        />
                                                                    )}
                                                                </td>
                                                                <td className="py-3 font-medium">#{inv.id}</td>
                                                                <td className="py-3 text-gray-600">{new Date(inv.due_date).toLocaleDateString()}</td>
                                                                <td className="py-3 text-right font-bold text-gray-800">${bal.toFixed(2)}</td>
                                                                <td className="py-3 text-center">
                                                                    {inv.paid ? (
                                                                        <span className="text-green-600 font-bold text-xs">PAGADO</span>
                                                                    ) : isOd ? (
                                                                        <span className="text-red-600 font-bold text-xs bg-red-50 px-2 py-1 rounded">VENCIDO</span>
                                                                    ) : (
                                                                        <span className="text-blue-600 font-bold text-xs">PENDIENTE</span>
                                                                    )}
                                                                </td>
                                                                <td className="py-3 text-right">
                                                                    <div className="flex justify-end gap-2">
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); handleViewDetail(inv); }}
                                                                            className="text-gray-400 hover:text-blue-600 p-1"
                                                                            title="Ver Detalle"
                                                                        >
                                                                            <Eye size={16} />
                                                                        </button>
                                                                        {!inv.paid && (
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); handleRegisterPayment(inv); }}
                                                                                className="text-green-600 hover:text-green-800 text-xs font-bold border border-green-200 hover:border-green-600 px-2 py-1 rounded transition-colors"
                                                                            >
                                                                                Abonar
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentModal && (selectedInvoice || isBulkPay) && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                        <div className="p-6 border-b flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">
                                    {isBulkPay ? 'Pago Múltiple' : 'Registrar Abono'}
                                </h3>
                                <p className="text-sm text-gray-600">
                                    {isBulkPay
                                        ? `${selectedInvoices.length} facturas seleccionadas`
                                        : `Factura #${selectedInvoice.id}`
                                    }
                                </p>
                            </div>
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Customer Info */}
                            {!isBulkPay && (
                                <div className="bg-blue-50 rounded-lg p-4">
                                    <p className="text-sm text-gray-600">Cliente</p>
                                    <p className="font-bold text-lg">{selectedInvoice.customer?.name || 'Cliente General'}</p>
                                </div>
                            )}

                            {/* Debt Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <p className="text-sm text-gray-600">Monto Original</p>
                                    <p className="font-bold text-lg">
                                        ${isBulkPay
                                            ? invoices.filter(inv => selectedInvoices.includes(inv.id)).reduce((sum, inv) => sum + Number(inv.total_amount), 0).toFixed(2)
                                            : Number(selectedInvoice.total_amount).toFixed(2)
                                        }
                                    </p>
                                </div>
                                <div className="bg-red-50 rounded-lg p-4">
                                    <p className="text-sm text-gray-600">Saldo Pendiente Total</p>
                                    <p className="font-bold text-lg text-red-600">
                                        ${isBulkPay
                                            ? paymentAmount.toFixed(2) // Initial amount matches total
                                            : Number(selectedInvoice.balance_pending || selectedInvoice.total_amount).toFixed(2)
                                        }
                                    </p>
                                </div>
                            </div>

                            {/* Payment Amount */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Monto a Abonar *
                                </label>
                                <input
                                    type="number"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-lg font-bold"
                                    step="0.01"
                                    min="0"
                                    max={isBulkPay ? 9999999 : (selectedInvoice.balance_pending || selectedInvoice.total_amount)}
                                />
                            </div>

                            {/* Payment Method */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Método de Pago
                                </label>
                                <select
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                                >
                                    {paymentMethods.filter(pm => pm.is_active).map(pm => (
                                        <option key={pm.id} value={pm.name}>
                                            {pm.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Currency */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Moneda
                                </label>
                                <select
                                    value={paymentCurrency}
                                    onChange={(e) => setPaymentCurrency(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                                >
                                    {/* Merge Anchor + Active Currencies, ensuring no duplicates if anchor is also active */}
                                    {[
                                        { symbol: 'USD', name: 'Dólar', rate: 1, is_anchor: true }, // Always explicit USD option
                                        ...availableCurrencies.filter(c => c.symbol !== 'USD')
                                    ].map(curr => (
                                        <option key={curr.symbol} value={curr.symbol}>
                                            {curr.name} ({curr.symbol})
                                        </option>
                                    ))}
                                </select>
                                {paymentCurrency !== 'USD' && (
                                    <p className="text-xs text-gray-500 mt-2">
                                        Tasa: {getExchangeRate(paymentCurrency).toLocaleString('es-VE', { minimumFractionDigits: 2 })} {paymentCurrency}/USD
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="p-6 border-t flex gap-3">
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSavePayment}
                                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                            >
                                Registrar Pago
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* NEW: Invoice Detail Modal */}
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
