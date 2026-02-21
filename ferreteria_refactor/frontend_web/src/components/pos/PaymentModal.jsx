import { useState, useEffect } from 'react';
import { DollarSign, CreditCard, Banknote, CheckCircle, Calculator, Users, X, UserPlus, User, Receipt, Layers, Trash2, Tag } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';
import { useWebSocket } from '../../context/WebSocketContext';
import apiClient from '../../config/axios';
import toast from 'react-hot-toast';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import QuickCustomerModal from './QuickCustomerModal';
import CustomerSearch from './CustomerSearch';
import CurrencyInput from '../common/CurrencyInput';
import { cn } from '../../lib/utils';

// Local formatCurrency removed to use ConfigContext one globaly

const formatLocalCurrency = (amount) => {
    try {
        return new Intl.NumberFormat('de-DE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    } catch (error) {
        return amount.toFixed(2);
    }
};

const PaymentModal = ({ isOpen, onClose, totalUSD, totalBs, totalsByCurrency, cart, onConfirm, warehouseId, initialCustomer, quoteId, customSubmit = null, discountUSD = 0, cartDiscount = null }) => {
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

    // Use the Passed TotalBs (Cart Logic) or Fallback to calculation
    const displayTotalBs = totalBs || (totalUSD * defaultBsRate);

    // Payment Logic using Default Rate for consistency with display
    const totalPaidUSD = payments.reduce((acc, p) => {
        const amount = parseFloat(p.amount) || 0;
        let rate = 1;

        if (p.currency === 'USD' || p.currency === '$') {
            rate = 1;
        } else if (p.currency === 'Bs' || p.currency === 'VES') {
            // UPDATED: Use Effective Rate derived from Cart Totals
            // This ensures that paying the exact TotalBs amount covers the TotalUSD amount
            const effectiveRate = (totalBs && totalUSD) ? (totalBs / totalUSD) : defaultBsRate;
            rate = effectiveRate;
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

        // Validate Amounts & References
        if (!isCreditSale) {
            for (let i = 0; i < payments.length; i++) {
                const p = payments[i];
                const amount = parseFloat(p.amount);

                if (isNaN(amount) || amount <= 0) {
                    toast.error(`El monto para el método #${i + 1} (${p.method}) no es válido.`);
                    return;
                }

                const method = paymentMethods.find(m => m.name === p.method);
                if (method?.requires_reference && !p.reference?.trim()) {
                    toast.error(`Debe ingresar la referencia para el método: ${p.method}`);
                    return;
                }
            }
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
                        reference: p.reference, // Pass reference to backend
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
                notes: "",
                total_discount_usd: discountUSD || 0,
                cart_discount_type: cartDiscount?.type || null,
                cart_discount_value: cartDiscount?.value || 0,
                discount_auth_user_id: cartDiscount?.auth_user_id || null
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
                    errorMessage = detail.map(e => {
                        const field = e.loc?.[e.loc.length - 1];
                        let msg = e.msg;

                        if (msg.includes('Decimal input should be')) msg = "debe ser un número válido o no estar vacío";
                        else if (msg.includes('field required')) msg = "es obligatorio";

                        const fieldMap = {
                            'amount': 'El monto del pago',
                            'payment_method': 'El método de pago',
                            'reference': 'La referencia'
                        };

                        return `${fieldMap[field] || field}: ${msg}`;
                    }).join('. ');
                } else {
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
        <div className="fixed inset-0 bg-[#0f172a]/70 flex items-end sm:items-center justify-center z-50 backdrop-blur-md p-0 sm:p-4 transition-all duration-300">
            <div className="bg-white rounded-t-2xl sm:rounded-[2rem] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col md:flex-row h-[90vh] sm:h-auto sm:max-h-[85vh] animate-in fade-in zoom-in-95 slide-in-from-bottom-5 duration-300 ring-1 ring-white/20">

                {/* LEFT COLUMN: Premium Summary */}
                <div className="bg-[#1e293b] text-white p-6 md:w-5/12 flex flex-col relative overflow-hidden group shrink-0 max-h-[35vh] md:max-h-none overflow-y-auto">
                    {/* Background Accents */}
                    <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                        <DollarSign size={300} strokeWidth={0.5} />
                    </div>
                    <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>

                    <h3 className="text-indigo-400 uppercase text-xs font-black tracking-[0.2em] mb-4 z-10 flex items-center gap-2">
                        <Receipt size={14} /> Resumen
                    </h3>

                    <div className="mb-4 z-10 relative">
                        <div className="text-xs text-slate-400 font-medium mb-1">Total a Pagar (Divisa)</div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-xl text-blue-400 font-light">$</span>
                            <span className="text-5xl font-black text-white tracking-tighter shadow-blue-500/10 drop-shadow-lg">
                                {formatLocalCurrency(totalUSD)}
                            </span>
                        </div>
                        {discountUSD > 0 && (
                            <div className="flex items-center gap-1.5 mt-2 bg-rose-500/20 border border-rose-500/30 rounded-lg px-3 py-1.5 text-rose-300">
                                <Tag size={11} />
                                <span className="text-[10px] font-black uppercase tracking-wider">
                                    Descuento {cartDiscount?.type === 'percent' ? `(${cartDiscount.value}%)` : '(Fijo)'}
                                </span>
                                <span className="ml-auto text-[11px] font-black font-mono">−${formatLocalCurrency(discountUSD)}</span>
                            </div>
                        )}
                    </div>

                    {/* Total in Bs Display - UPDATED to use Default Rate */}
                    <div className="z-10 relative bg-slate-800/50 backdrop-blur-sm rounded-xl p-3 border border-slate-700/50 mb-auto hover:bg-slate-800/80 transition-colors group/card">
                        <div className="flex justify-between items-start mb-1">
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total en Bolívares</div>
                            <span className="text-[9px] bg-blue-500/10 text-blue-300 px-1.5 py-0.5 rounded-full border border-blue-500/20 font-mono">
                                Tasa: {formatLocalCurrency(defaultBsRate)}
                            </span>
                        </div>
                        <div className="text-2xl font-bold text-emerald-400 font-mono tracking-tight group-hover/card:text-emerald-300 transition-colors">
                            {formatLocalCurrency(displayTotalBs)} <span className="text-xs">Bs</span>
                        </div>
                    </div>

                    {/* Pending / Change Status */}
                    <div className="z-10 mt-4">
                        {!isCreditSale && (
                            <div className={`
                                relative overflow-hidden rounded-xl p-4 transition-all duration-500 border
                                ${isComplete
                                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 border-emerald-400/50 shadow-lg shadow-emerald-900/20'
                                    : 'bg-slate-800/80 border-slate-700'
                                }
                            `}>
                                {isComplete ? (
                                    <div className="text-center relative z-10">
                                        <div className="flex items-center justify-center mb-1">
                                            <div className="bg-white/20 p-1.5 rounded-full backdrop-blur-md">
                                                <CheckCircle className="text-white" size={20} strokeWidth={3} />
                                            </div>
                                        </div>
                                        <div className="text-[10px] font-bold text-white/80 uppercase tracking-widest mb-1">Pago Completado</div>

                                        {changeUSD > 0.0001 ? (
                                            <div className="flex flex-col items-center">
                                                <div className="text-lg font-bold text-emerald-200">
                                                    Su Vuelto: <span className="text-white text-xl">${formatLocalCurrency(changeUSD)}</span>
                                                </div>
                                                <div className="text-xs font-bold text-emerald-400 font-mono mt-0.5 bg-emerald-900/40 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                                    Bs {formatLocalCurrency(changeUSD * ((totalBs && totalUSD) ? (totalBs / totalUSD) : defaultBsRate))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-lg font-bold text-white">Cuenta Saldada</div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <div className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-0.5">Falta por pagar</div>
                                            <div className="text-2xl font-bold text-rose-400 font-mono">
                                                ${formatLocalCurrency(Math.abs(remainingUSD))}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[9px] text-slate-500 uppercase font-bold">En Bolívares</div>
                                            <div className="text-base font-bold text-slate-400 font-mono">
                                                Bs {formatLocalCurrency(Math.abs(remainingUSD) * ((totalBs && totalUSD) ? (totalBs / totalUSD) : defaultBsRate))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Credit Sale Indicator */}
                        {isCreditSale && (
                            <div className="mt-3 bg-indigo-600/20 border border-indigo-500/30 rounded-xl p-3 flex items-center gap-3">
                                <CreditCard className="text-indigo-400" size={20} />
                                <div>
                                    <div className="text-indigo-300 font-bold text-xs">Venta a Crédito</div>
                                    <div className="text-indigo-400/70 text-[10px]">Pago diferido</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: Actions & Inputs */}
                <div className="p-4 md:p-6 md:w-7/12 bg-slate-50 flex flex-col h-full overflow-hidden relative">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-4 shrink-0">
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
                            <span className="w-1.5 h-6 bg-indigo-600 rounded-full inline-block"></span>
                            Procesar Pago
                        </h2>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl h-9 w-9"
                        >
                            <X size={20} />
                        </Button>
                    </div>

                    {/* Scrollable Content Area */}
                    <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-4 pb-20"> {/* pb-20 prevents content from being hidden behind absolute footer if we used one, but here we use flex, so it's a buffer */}

                        {/* Customer Section - Compact */}
                        <div className={`group transition-all duration-300 border rounded-xl p-0.5 ${isCreditSale && !selectedCustomer ? 'bg-rose-50 border-rose-200 shadow-sm' : 'bg-white border-slate-200 shadow-sm hover:border-indigo-200'}`}>
                            <div className="p-3">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <User size={12} /> Cliente
                                        {isCreditSale && <span className="bg-rose-100 text-rose-600 text-[9px] px-2 py-0.5 rounded-full">Requerido</span>}
                                    </label>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIsQuickCustomerOpen(true)}
                                        className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 h-6 text-[10px] font-bold px-2"
                                    >
                                        <UserPlus size={12} className="mr-1" /> Nuevo
                                    </Button>
                                </div>

                                <CustomerSearch
                                    customers={customers}
                                    selectedCustomer={selectedCustomer}
                                    onSelect={setSelectedCustomer}
                                    className="scale-100"
                                />

                                {isCreditSale && selectedCustomer && (
                                    <div className="mt-2 flex gap-3 p-2 bg-indigo-50/50 rounded-lg border border-indigo-100/50">
                                        <div className="flex-1">
                                            <span className="text-[9px] text-indigo-400 font-bold uppercase">Límite Crédito</span>
                                            <div className="text-xs font-black text-indigo-900 font-mono">
                                                ${formatCurrency(Number(selectedCustomer.credit_limit || 0), 'USD')}
                                            </div>
                                        </div>
                                        <div className="w-px bg-indigo-100"></div>
                                        <div className="flex-1">
                                            <span className="text-[9px] text-indigo-400 font-bold uppercase">Saldo Actual</span>
                                            <div className="text-xs font-black text-slate-700 font-mono">
                                                $0.00
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Credit Toggle - Compact */}
                        <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isCreditSale ? 'border-indigo-500 bg-indigo-50/20' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isCreditSale ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-slate-100'}`}>
                                {isCreditSale && <CheckCircle size={12} className="text-white" strokeWidth={4} />}
                            </div>
                            <input type="checkbox" checked={isCreditSale} onChange={e => setIsCreditSale(e.target.checked)} className="hidden" />
                            <div className="flex-1">
                                <div className={`font-bold text-xs ${isCreditSale ? 'text-indigo-700' : 'text-slate-600'}`}>Venta a Crédito</div>
                                <div className="text-[10px] text-slate-400">La cuenta por cobrar se asignará al cliente</div>
                            </div>
                        </label>

                        {/* Payments Section - Compact */}
                        {!isCreditSale && (
                            <div className="space-y-3">
                                <div className="flex justify-between items-end">
                                    <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                        <Layers size={14} className="text-slate-400" />
                                        Métodos de Pago
                                    </h3>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={addPaymentRow}
                                        className="text-indigo-600 bg-indigo-50 border-indigo-200 hover:bg-indigo-100 h-8 text-[10px] font-black px-3 rounded-lg shadow-sm"
                                    >
                                        + Agregar otro método de pago
                                    </Button>
                                </div>

                                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
                                    {payments.map((payment, index) => {
                                        const selectedMethod = paymentMethods.find(m => m.name === payment.method);
                                        const needsReference = selectedMethod?.requires_reference;

                                        return (
                                            <div key={index} className="flex flex-col gap-2 p-2 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500">

                                                {/* Mobile: stack vertically / Desktop: side by side */}
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    {/* Method & Currency */}
                                                    <div className="flex flex-col gap-1.5 w-full sm:w-5/12">
                                                        <select
                                                            className="w-full bg-slate-50 border-none text-[11px] font-bold text-slate-700 rounded-md py-1.5 pl-2 pr-6 focus:ring-0 leading-tight"
                                                            value={payment.method}
                                                            onChange={(e) => updatePayment(index, 'method', e.target.value)}
                                                        >
                                                            {paymentMethods.filter(m => m.is_active).map(m => (
                                                                <option key={m.id} value={m.name}>{m.name}</option>
                                                            ))}
                                                        </select>
                                                        <div className="flex gap-1">
                                                            {currencies.slice(0, 3).map(c => (
                                                                <Button
                                                                    key={c.symbol}
                                                                    size="sm"
                                                                    variant={payment.currency === c.symbol ? "default" : "outline"}
                                                                    onClick={() => updatePayment(index, 'currency', c.symbol)}
                                                                    className={`flex-1 h-7 text-[11px] font-bold px-2 rounded-md min-w-0 ${payment.currency === c.symbol ? 'bg-indigo-600 hover:bg-indigo-700' : 'text-slate-500 border-slate-200'}`}
                                                                >
                                                                    {c.symbol}
                                                                </Button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Amount Input + Remove */}
                                                    <div className="flex gap-2 flex-1">
                                                        <div className="flex-1 relative rounded-xl border-2 border-slate-200 bg-slate-50 transition-all p-1 focus-within:border-indigo-500 focus-within:bg-white focus-within:shadow-md focus-within:shadow-indigo-500/10">
                                                            <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
                                                                <span className="font-bold text-sm text-slate-400">
                                                                    {payment.currency === 'USD' ? '$' : payment.currency}
                                                                </span>
                                                            </div>
                                                            <CurrencyInput
                                                                autoFocus={index === 0}
                                                                className="w-full h-full bg-transparent text-right font-mono text-xl font-black text-slate-900 placeholder:text-slate-300 border-none focus:ring-0 p-0 pr-2"
                                                                placeholder="0.00"
                                                                value={payment.amount}
                                                                onChange={(val) => updatePayment(index, 'amount', val)}
                                                            />
                                                        </div>

                                                        {/* Remove Button */}
                                                        {payments.length > 1 && (
                                                            <button
                                                                onClick={() => removePaymentRow(index)}
                                                                className="flex items-center justify-center w-8 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Reference Input */}
                                                {needsReference && (
                                                    <div className="animate-in fade-in slide-in-from-top-1">
                                                        <Input
                                                            type="text"
                                                            placeholder="Referencia / # Transferencia"
                                                            className="bg-indigo-50/50 border-indigo-100 text-[10px] text-indigo-800 placeholder:text-indigo-300 h-7 rounded-md"
                                                            value={payment.reference || ''}
                                                            onChange={(e) => updatePayment(index, 'reference', e.target.value)}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions - Pinned */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-white/90 backdrop-blur-sm border-t border-slate-100 flex gap-3 shrink-0 z-20">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="font-bold text-slate-600 border-slate-200 hover:bg-slate-50 h-12 px-6 rounded-xl text-sm"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={processing || (!isCreditSale && !isComplete) || (isCreditSale && !selectedCustomer)}
                            title={(!isCreditSale && !isComplete) ? "El total pagado debe coincidir con el total de la venta" : ""}
                            className={`
                                flex-1 rounded-xl font-black text-base tracking-wide shadow-xl transition-all h-12
                                ${processing || (!isCreditSale && !isComplete) || (isCreditSale && !selectedCustomer)
                                    ? 'bg-slate-100 text-slate-400'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:-translate-y-1 shadow-indigo-500/30'
                                }
                            `}
                        >
                            {processing ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    {isCreditSale ? 'REGISTRAR CRÉDITO' : 'CONFIRMAR PAGO'}
                                    <CheckCircle size={18} strokeWidth={3} className="ml-2" />
                                </>
                            )}
                        </Button>
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
