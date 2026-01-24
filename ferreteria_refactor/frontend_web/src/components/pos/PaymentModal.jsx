import { useState, useEffect } from 'react';
import { DollarSign, CreditCard, Banknote, CheckCircle, Calculator, Users, X, UserPlus, User, Receipt, Layers, Trash2 } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';
import { useWebSocket } from '../../context/WebSocketContext';
import apiClient from '../../config/axios';
import toast from 'react-hot-toast';
import QuickCustomerModal from './QuickCustomerModal';
import CustomerSearch from './CustomerSearch';
import CurrencyInput from '../common/CurrencyInput';

// Local formatCurrency removed to use ConfigContext one globaly

const PaymentModal = ({ isOpen, onClose, totalUSD, totalBs, totalsByCurrency, cart, onConfirm, warehouseId, initialCustomer, quoteId, customSubmit = null }) => {
    const { getActiveCurrencies, convertPrice, getExchangeRate, paymentMethods, formatCurrency } = useConfig();
    const { subscribe } = useWebSocket();
    const allCurrencies = [{ id: 'base', symbol: 'USD', name: 'Dólar', rate: 1, is_anchor: true }, ...getActiveCurrencies()];

    // Deduplicate currencies by symbol (to avoid double Bs if multiple rates exist)
    const currencies = allCurrencies.filter((curr, index, self) =>
        index === self.findIndex((c) => c.symbol === curr.symbol)
    );

    // State for multiple payments
    const [payments, setPayments] = useState([]);
    const [processing, setProcessing] = useState(false);

    // Credit sale states
    const [isCreditSale, setIsCreditSale] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    // Quick Customer Modal
    const [isQuickCustomerOpen, setIsQuickCustomerOpen] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // FIXED: Default to "Efectivo Bolívares (Bs)" as requested
            setPayments([{ amount: '', currency: 'Bs', method: 'Efectivo Bolívares (Bs)' }]);
            setIsCreditSale(false);

            // Priority: Initial Customer > Null
            if (initialCustomer) {
                console.log("Setting initial customer:", initialCustomer);
                setSelectedCustomer(initialCustomer);
            } else {
                setSelectedCustomer(null);
            }

            fetchCustomers();
        }
    }, [isOpen, initialCustomer]);

    // WebSocket subscriptions for real-time customer updates
    useEffect(() => {
        const unsubCreate = subscribe('customer:created', (newCustomer) => {
            setCustomers(prev => [newCustomer, ...prev]);
        });

        const unsubUpdate = subscribe('customer:updated', (updatedCustomer) => {
            setCustomers(prev => prev.map(c => c.id === updatedCustomer.id ? { ...c, ...updatedCustomer } : c));
        });

        return () => {
            unsubCreate();
            unsubUpdate();
        };
    }, [subscribe]);

    const fetchCustomers = async () => {
        try {
            const response = await apiClient.get('/customers', { params: { limit: 100 } });
            setCustomers(response.data);
        } catch (error) {
            console.error('Error fetching customers:', error);
        }
    };

    const handleQuickCustomerSuccess = (newCustomer) => {
        // The websocket handles list update, but we set selection immediately
        setSelectedCustomer(newCustomer);
    };

    if (!isOpen) return null;

    // ... (imports remain)

    // Helper: Smart rounding
    const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

    // Calculate Totals using CURRENT DEFAULT RATE as requested
    const defaultBsRate = getExchangeRate('Bs') || getExchangeRate('VES') || 1;

    // Use the Default Rate for the Bs Total Display
    const displayTotalBs = totalUSD * defaultBsRate;

    // Payment Logic using Default Rate for consistency with display
    const totalPaidUSD = payments.reduce((acc, p) => {
        const amount = parseFloat(p.amount) || 0;
        let rate = 1;

        if (p.currency === 'USD' || p.currency === '$') {
            rate = 1;
        } else if (p.currency === 'Bs' || p.currency === 'VES') {
            // UPDATED: Use Default Rate as requested by user ("tasa que este por defecto")
            // This ensures the "Total in Bs" display matches the payment calculation
            rate = defaultBsRate;
        } else {
            rate = getExchangeRate(p.currency) || 1;
        }

        return acc + (amount / rate);
    }, 0);

    const remainingUSD = Number((totalUSD - totalPaidUSD).toFixed(4));
    const changeUSD = Number((totalPaidUSD - totalUSD).toFixed(4));
    const isComplete = remainingUSD <= 0.001;

    const addPaymentRow = () => {
        setPayments([...payments, { amount: '', currency: 'Bs', method: 'Efectivo Bolívares (Bs)' }]);
    };

    const removePaymentRow = (index) => {
        const newPayments = [...payments];
        newPayments.splice(index, 1);
        setPayments(newPayments);
    };

    const updatePayment = (index, field, value) => {
        const newPayments = [...payments];
        newPayments[index][field] = value;
        setPayments(newPayments);
    };

    const handleConfirm = async () => {
        if (isCreditSale && !selectedCustomer) {
            alert('Debe seleccionar un cliente para venta a crédito');
            return;
        }

        // Use the strict checking here too
        if (!isCreditSale && !isComplete) {
            alert('El pago no está completo');
            return;
        }

        setProcessing(true);

        try {
            // Determine dominant currency
            let saleCurrency = "USD";
            if (!isCreditSale && payments.length === 1) {
                saleCurrency = payments[0].currency === "$" ? "USD" : payments[0].currency;
            }

            // Calculate Change in VES
            // Use DEFAULT rate for consistency with the new UI logic
            const changeVES = changeUSD > 0.005 ? (changeUSD * defaultBsRate) : 0;

            const saleData = {
                total_amount: totalUSD,
                // Pass the cart's BS total. Fallback to calculated displayTotalBs if prop is missing (Fixes 422 error)
                total_amount_bs: totalBs || displayTotalBs,

                // NEW: Register Change/Vuelto (Dynamic Currency)
                change_amount: isCreditSale ? 0 : (() => {
                    const allUSD = payments.every(p => p.currency === '$' || p.currency === 'USD');
                    return allUSD ? changeUSD : (changeUSD > 0.005 ? (changeUSD * defaultBsRate) : 0);
                })(),
                change_currency: isCreditSale ? "Bs" : (() => {
                    const allUSD = payments.every(p => p.currency === '$' || p.currency === 'USD');
                    return allUSD ? "USD" : "Bs";
                })(),

                currency: saleCurrency,
                exchange_rate: defaultBsRate, // Signal that we transacted at the Default Rate

                payment_method: isCreditSale ? "Credito" : (payments[0]?.method || "Efectivo Bolívares (Bs)"),
                payments: isCreditSale ? [] : payments.map(p => {
                    return {
                        amount: parseFloat(p.amount),
                        currency: p.currency === '$' ? 'USD' : p.currency,
                        payment_method: p.method,
                        // Force Default Rate for Bs payments to match valid USD calculation
                        exchange_rate: (p.currency === 'Bs' || p.currency === 'VES')
                            ? defaultBsRate
                            : (getExchangeRate(p.currency) || 1)
                    };
                }),
                items: cart.map(item => ({
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit_price: item.is_discount_active ? item.original_price_usd : (item.unit_price_usd || item.price_unit_usd || item.price_usd),
                    subtotal: (item.is_discount_active ? item.original_price_usd : (item.unit_price_usd || item.price_unit_usd || item.price_usd)) * item.quantity,
                    conversion_factor: item.conversion_factor || 1,
                    discount: item.is_discount_active ? item.discount_percentage : 0,
                    discount_type: item.is_discount_active ? "PERCENT" : "NONE",
                    salesperson_id: item.salesperson_id || null,
                    serial_numbers: item.serial_numbers || []
                })),
                is_credit: isCreditSale,
                customer_id: selectedCustomer ? selectedCustomer.id : null,
                warehouse_id: (!warehouseId || warehouseId === 'all') ? null : warehouseId,
                quote_id: quoteId || null,
                notes: ""
            };

            let response;

            if (customSubmit) {
                response = await customSubmit({
                    ...saleData,
                    payments: saleData.payments,
                    client_id: saleData.customer_id
                });
            } else {
                response = await apiClient.post('/products/sales/', saleData);
            }

            const saleId = response.data?.sale_id || response.sale_id;

            onConfirm({
                payments: isCreditSale ? [] : payments,
                totalPaidUSD: isCreditSale ? 0 : totalPaidUSD,
                changeUSD: isCreditSale ? 0 : (changeUSD > 0 ? changeUSD : 0),
                isCreditSale,
                customer: selectedCustomer || null,
                saleId: saleId
            });

            setProcessing(false);
            onClose();
        } catch (error) {
            console.error('Error creating sale:', error);
            let errorMessage = "Error desconocido al procesar venta";

            if (error.response?.data?.detail) {
                const detail = error.response.data.detail;
                if (typeof detail === 'string') {
                    errorMessage = detail;
                } else if (Array.isArray(detail)) {
                    errorMessage = detail.map(e => `${e.loc.join('.')}: ${e.msg}`).join(', ');
                } else if (typeof detail === 'object') {
                    errorMessage = JSON.stringify(detail);
                }
            } else if (error.message) {
                errorMessage = error.message;
            }

            toast.error(errorMessage);
            setProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-[#0f172a]/70 flex items-center justify-center z-50 backdrop-blur-md p-4 transition-all duration-300">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col md:flex-row min-h-[650px] max-h-[90vh] animate-in fade-in zoom-in-95 duration-300 ring-1 ring-white/20">

                {/* LEFT COLUMN: Premium Summary */}
                <div className="bg-[#1e293b] text-white p-8 md:w-5/12 flex flex-col relative overflow-hidden group">
                    {/* Background Accents */}
                    <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                        <DollarSign size={300} strokeWidth={0.5} />
                    </div>
                    <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>

                    <h3 className="text-indigo-400 uppercase text-xs font-black tracking-[0.2em] mb-8 z-10 flex items-center gap-2">
                        <Receipt size={14} /> Resumen de Transacción
                    </h3>

                    <div className="mb-8 z-10 relative">
                        <div className="text-sm text-slate-400 font-medium mb-2">Total a Pagar (Divisa)</div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl text-slate-500 font-light">$</span>
                            <span className="text-6xl font-black text-white tracking-tighter shadow-indigo-500/10 drop-shadow-lg">
                                {formatCurrency(totalUSD, 'USD').replace('$', '')}
                            </span>
                        </div>
                    </div>

                    {/* Total in Bs Display - UPDATED to use Default Rate */}
                    <div className="z-10 relative bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 border border-slate-700/50 mb-auto hover:bg-slate-800/80 transition-colors group/card">
                        <div className="flex justify-between items-start mb-2">
                            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total en Bolívares</div>
                            <span className="text-[10px] bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/20 font-mono">
                                Tasa: {formatCurrency(defaultBsRate, 'VES')}
                            </span>
                        </div>
                        <div className="text-3xl font-bold text-emerald-400 font-mono tracking-tight group-hover/card:text-emerald-300 transition-colors">
                            {formatCurrency(displayTotalBs, 'VES')}
                        </div>
                        <div className="mt-2 text-[10px] text-slate-500">
                            * Calculado a la tasa de cambio actual.
                        </div>
                    </div>

                    {/* Pending / Change Status */}
                    <div className="z-10 mt-8">
                        {!isCreditSale && (
                            <div className={`
                                relative overflow-hidden rounded-2xl p-6 transition-all duration-500 border
                                ${isComplete
                                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 border-emerald-400/50 shadow-lg shadow-emerald-900/20'
                                    : 'bg-slate-800/80 border-slate-700'
                                }
                            `}>
                                {isComplete ? (
                                    <div className="text-center relative z-10">
                                        <div className="flex items-center justify-center mb-2">
                                            <div className="bg-white/20 p-2 rounded-full backdrop-blur-md">
                                                <CheckCircle className="text-white" size={24} strokeWidth={3} />
                                            </div>
                                        </div>
                                        <div className="text-xs font-bold text-white/80 uppercase tracking-widest mb-1">Pago Completado</div>

                                        {changeUSD > 0.0001 ? (
                                            <div className="flex flex-col items-center">
                                                <div className="text-xl font-bold text-emerald-200">
                                                    Su Vuelto: <span className="text-white text-2xl">${formatCurrency(changeUSD, 'USD').replace('$', '')}</span>
                                                </div>
                                                <div className="text-sm font-bold text-emerald-400 font-mono mt-1 bg-emerald-900/40 px-3 py-1 rounded-full border border-emerald-500/30">
                                                    Bs {formatCurrency(changeUSD * defaultBsRate, 'VES').replace('Bs', '')}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-xl font-bold text-white">Cuenta Saldada Exactamente</div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <div className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-1">Restante</div>
                                            <div className="text-3xl font-bold text-rose-300 font-mono">
                                                ${formatCurrency(Math.abs(remainingUSD), 'USD').replace('$', '')}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] text-slate-500 uppercase font-bold">En Bolívares</div>
                                            <div className="text-xl font-bold text-slate-400 font-mono">
                                                Bs {formatCurrency(Math.abs(remainingUSD) * defaultBsRate, 'VES').replace('Bs', '')}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Credit Sale Indicator */}
                        {isCreditSale && (
                            <div className="mt-4 bg-indigo-600/20 border border-indigo-500/30 rounded-xl p-4 flex items-center gap-3">
                                <CreditCard className="text-indigo-400" size={24} />
                                <div>
                                    <div className="text-indigo-300 font-bold text-sm">Venta a Crédito</div>
                                    <div className="text-indigo-400/70 text-xs">Pago diferido</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: Actions & Inputs */}
                <div className="p-8 md:w-7/12 bg-slate-50 flex flex-col h-full overflow-hidden">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-8 shrink-0">
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
                            <span className="w-2 h-8 bg-indigo-600 rounded-full inline-block"></span>
                            Procesar Pago
                        </h2>
                        <button
                            onClick={onClose}
                            className="group p-2 hover:bg-rose-50 rounded-xl transition-all duration-300 border border-transparent hover:border-rose-100"
                        >
                            <X size={24} className="text-slate-400 group-hover:text-rose-500 transition-colors" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6 pb-4">

                        {/* Customer Section */}
                        <div className={`group transition-all duration-300 border rounded-2xl p-1 ${isCreditSale && !selectedCustomer ? 'bg-rose-50 border-rose-200 shadow-sm' : 'bg-white border-slate-200 shadow-sm hover:border-indigo-200'}`}>
                            <div className="p-4">
                                <div className="flex justify-between items-center mb-4">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <User size={14} /> Cliente
                                        {isCreditSale && <span className="bg-rose-100 text-rose-600 text-[9px] px-2 py-0.5 rounded-full">Requerido</span>}
                                    </label>
                                    <button
                                        onClick={() => setIsQuickCustomerOpen(true)}
                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                                    >
                                        <UserPlus size={14} /> Nuevo
                                    </button>
                                </div>

                                <CustomerSearch
                                    customers={customers}
                                    selectedCustomer={selectedCustomer}
                                    onSelect={setSelectedCustomer}
                                    className="scale-100" // Ensure internal styling works
                                />

                                {isCreditSale && selectedCustomer && (
                                    <div className="mt-4 flex gap-4 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
                                        <div className="flex-1">
                                            <span className="text-[10px] text-indigo-400 font-bold uppercase">Límite Crédito</span>
                                            <div className="text-sm font-black text-indigo-900 font-mono">
                                                ${formatCurrency(Number(selectedCustomer.credit_limit || 0), 'USD')}
                                            </div>
                                        </div>
                                        <div className="w-px bg-indigo-100"></div>
                                        <div className="flex-1">
                                            <span className="text-[10px] text-indigo-400 font-bold uppercase">Saldo Actual</span>
                                            <div className="text-sm font-black text-slate-700 font-mono">
                                                $0.00 {/* Placeholder for customer balance */}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Credit Toggle */}
                        <label className={`flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${isCreditSale ? 'border-indigo-500 bg-indigo-50/20' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${isCreditSale ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-slate-100'}`}>
                                {isCreditSale && <CheckCircle size={14} className="text-white" strokeWidth={4} />}
                            </div>
                            <input type="checkbox" checked={isCreditSale} onChange={e => setIsCreditSale(e.target.checked)} className="hidden" />
                            <div className="flex-1">
                                <div className={`font-bold text-sm ${isCreditSale ? 'text-indigo-700' : 'text-slate-600'}`}>Venta a Crédito</div>
                                <div className="text-xs text-slate-400">La cuenta por cobrar se asignará al cliente</div>
                            </div>
                        </label>

                        {/* Payments Section */}
                        {!isCreditSale && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-end">
                                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                        <Layers size={16} className="text-slate-400" />
                                        Métodos de Pago
                                    </h3>
                                    <button
                                        onClick={addPaymentRow}
                                        className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                        + Agregar Otro
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {payments.map((payment, index) => (
                                        <div key={index} className="flex gap-3 p-3 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500">

                                            {/* Method & Currency */}
                                            <div className="flex flex-col gap-2 w-5/12">
                                                <select
                                                    className="w-full bg-slate-50 border-none text-xs font-bold text-slate-700 rounded-lg py-2 focus:ring-0"
                                                    value={payment.method}
                                                    onChange={(e) => updatePayment(index, 'method', e.target.value)}
                                                >
                                                    {paymentMethods.filter(m => m.is_active).map(m => (
                                                        <option key={m.id} value={m.name}>{m.name}</option>
                                                    ))}
                                                </select>
                                                <div className="flex gap-2">
                                                    {currencies.slice(0, 3).map(c => (
                                                        <button
                                                            key={c.symbol}
                                                            onClick={() => updatePayment(index, 'currency', c.symbol)}
                                                            className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-colors border ${payment.currency === c.symbol ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                                                        >
                                                            {c.symbol}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Amount Input */}
                                            <div className="flex-1 relative">
                                                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                                    <span className="text-slate-400 font-bold text-lg">
                                                        {payment.currency === 'USD' ? '$' : payment.currency}
                                                    </span>
                                                </div>
                                                <CurrencyInput
                                                    className="w-full h-full bg-transparent text-right font-mono text-2xl font-bold text-slate-800 placeholder-slate-200 border-none focus:ring-0 p-0 pr-2"
                                                    placeholder="0.00"
                                                    value={payment.amount}
                                                    onChange={(val) => updatePayment(index, 'amount', val)}
                                                />
                                            </div>

                                            {/* Remove Button */}
                                            {payments.length > 1 && (
                                                <button
                                                    onClick={() => removePaymentRow(index)}
                                                    className="flex items-center justify-center w-8 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-auto pt-6 border-t border-slate-100 flex gap-4 shrink-0">
                        <button
                            onClick={onClose}
                            className="px-6 py-4 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={processing || (!isCreditSale && !isComplete) || (isCreditSale && !selectedCustomer)}
                            className={`
                                flex-1 rounded-xl font-black text-lg tracking-wide shadow-xl transition-all flex items-center justify-center gap-3
                                ${processing || (!isCreditSale && !isComplete) || (isCreditSale && !selectedCustomer)
                                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:-translate-y-1 shadow-indigo-500/30'
                                }
                            `}
                        >
                            {processing ? (
                                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    {isCreditSale ? 'REGISTRAR CRÉDITO' : 'CONFIRMAR PAGO'}
                                    <CheckCircle size={20} strokeWidth={3} />
                                </>
                            )}
                        </button>
                    </div>

                </div>
            </div>

            <QuickCustomerModal
                isOpen={isQuickCustomerOpen}
                onClose={() => setIsQuickCustomerOpen(false)}
                onSuccess={handleQuickCustomerSuccess}
            />
        </div>
    );
};

export default PaymentModal;
