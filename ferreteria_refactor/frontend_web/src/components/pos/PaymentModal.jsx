import { useState, useEffect } from 'react';
import { DollarSign, CreditCard, Banknote, CheckCircle, Calculator, Users, X, UserPlus, User } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';
import { useWebSocket } from '../../context/WebSocketContext';
import apiClient from '../../config/axios';
import toast from 'react-hot-toast';
import QuickCustomerModal from './QuickCustomerModal';
import CustomerSearch from './CustomerSearch';
import CurrencyInput from '../common/CurrencyInput';

// Helper to format currency consistently
const formatCurrency = (amount, currencySymbol) => {
    // Determine locale based on currency
    // USD -> en-US (1,234.56)
    // Others (Bs, etc) -> es-VE (1.234,56)
    const locale = currencySymbol === '$' || currencySymbol === 'USD' ? 'en-US' : 'es-VE';

    return amount.toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

const PaymentModal = ({ isOpen, onClose, totalUSD, totalBs, totalsByCurrency, cart, onConfirm, warehouseId, initialCustomer, quoteId, customSubmit = null }) => {
    const { getActiveCurrencies, convertPrice, getExchangeRate, paymentMethods } = useConfig();
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
            setPayments([{ amount: '', currency: 'USD', method: 'Efectivo' }]);
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

    // Calculate Totals
    // Calculate Totals with Effective Rate
    // FIXED: Calculate the effective average rate of the cart (TotalBs / TotalUSD)
    // This allows payments in Bs to be credited at the same "value" they were debited.
    const effectiveBsRate = (totalBs > 0 && totalUSD > 0)
        ? (totalBs / totalUSD)
        : (getExchangeRate('Bs') || 1);

    const totalPaidUSD = payments.reduce((acc, p) => {
        const amount = parseFloat(p.amount) || 0;
        let rate = 1;

        if (p.currency === 'USD' || p.currency === '$') {
            rate = 1;
        } else if (p.currency === 'Bs' || p.currency === 'VES') {
            // Use EFFECTIVE rate for Bs payments to match debt valuation
            rate = effectiveBsRate;
        } else {
            // Other currencies use their global rate
            rate = getExchangeRate(p.currency) || 1;
        }

        return acc + (amount / rate);
    }, 0);

    // FIX: Floating point precision adjustment
    const remainingUSD = Number((totalUSD - totalPaidUSD).toFixed(4));
    const changeUSD = Number((totalPaidUSD - totalUSD).toFixed(4));

    // Strict validation: Must effectively be zero or overpaid.
    // Floating point tolerance lowered to 0.005 (half a cent) to fix "missing 2 Bs" issue.
    const isComplete = remainingUSD <= 0.005;

    const addPaymentRow = () => {
        setPayments([...payments, { amount: '', currency: 'USD', method: 'Efectivo' }]);
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
            // If single payment, use that currency. If multiple, default to USD (Base).
            let saleCurrency = "USD";
            if (!isCreditSale && payments.length === 1) {
                // Map symbol to code if necessary, or just use symbol if that's what backend expects
                // Backend seems to use "USD" or "Bs" / "VES"
                saleCurrency = payments[0].currency === "$" ? "USD" : payments[0].currency;
            }

            // Calculate Change in VES
            // FIXED: Use correct effective rate for change calculation
            const effectiveBsRate = (totalBs > 0 && totalUSD > 0)
                ? (totalBs / totalUSD)
                : (getExchangeRate('Bs') || 1);

            const changeVES = changeUSD > 0.005 ? (changeUSD * effectiveBsRate) : 0;

            const saleData = {
                total_amount: totalUSD,
                // NEW: Frontend Source of Truth for VES Total
                total_amount_bs: totalBs,
                // NEW: Register Change/Vuelto
                change_amount: changeVES,
                change_currency: "VES",

                currency: saleCurrency, // Dynamic Currency
                exchange_rate: effectiveBsRate, // Store the effective rate used for this transaction? Or Global?
                // Actually, backend stores "exchange_rate_used". If we send effective rate, 
                // recalculations based on total_usd * rate will match total_bs. 
                // This is cleaner for consistency, though backend now trusts total_amount_bs directly.

                payment_method: isCreditSale ? "Credito" : (payments[0]?.method || "Efectivo"),
                payments: isCreditSale ? [] : payments.map(p => {
                    // FIX: Split Efectivo into USD/Bs for Reporting
                    let finalMethod = p.method;
                    if (p.method === 'Efectivo') {
                        const isBs = p.currency === 'Bs' || p.currency === 'VES';
                        finalMethod = isBs ? 'Efectivo Bs' : 'Efectivo USD';
                    }

                    return {
                        amount: parseFloat(p.amount),
                        currency: p.currency === '$' ? 'USD' : p.currency,
                        method: finalMethod,
                        exchange_rate: (p.currency === 'Bs' || p.currency === 'VES') ? effectiveBsRate : (getExchangeRate(p.currency) || 1)
                    };
                }),
                items: cart.map(item => ({
                    product_id: item.product_id,
                    quantity: item.quantity,
                    // Fix: Send original price if discount active, otherwise normal price
                    // Backend calculates subtotal using unit_price * quantity * (1 - discount/100)
                    unit_price: item.is_discount_active ? item.original_price_usd : (item.unit_price_usd || item.price_unit_usd || item.price_usd),
                    subtotal: (item.is_discount_active ? item.original_price_usd : (item.unit_price_usd || item.price_unit_usd || item.price_usd)) * item.quantity, // Mandatory for schema validation
                    conversion_factor: item.conversion_factor || 1,
                    discount: item.is_discount_active ? item.discount_percentage : 0,
                    discount_type: item.is_discount_active ? "PERCENT" : "NONE"
                })),
                is_credit: isCreditSale,
                customer_id: selectedCustomer ? selectedCustomer.id : null,
                warehouse_id: (!warehouseId || warehouseId === 'all') ? null : warehouseId,
                quote_id: quoteId || null, // Pass quote ID if present (we'll attach it to customer obj in POS.jsx for convenience or pass as separate prop)
                notes: ""
            };

            let response;

            if (customSubmit) {
                // If custom handler provided, use it (Restaurant Flow)
                response = await customSubmit({
                    ...saleData,
                    payments: saleData.payments, // Ensure payments are explicit
                    client_id: saleData.customer_id
                });
            } else {
                // Standard POS Flow
                response = await apiClient.post('/products/sales/', saleData);
            }

            // Handle different response structures if necessary
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
                    // Pydantic validation error list
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
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row h-[600px] animate-in fade-in zoom-in-95 duration-200">
                {/* Left: Totals Summary */}
                <div className="bg-slate-900 text-white p-8 md:w-1/3 flex flex-col relative">
                    <h3 className="text-slate-400 uppercase text-xs font-bold tracking-widest mb-6 border-b border-slate-800 pb-2">Resumen de Pago</h3>

                    <div className="mb-8">
                        <div className="text-sm text-slate-400 font-medium">Total a Pagar</div>
                        <div className="text-4xl font-black text-white tracking-tight">
                            ${formatCurrency(totalUSD, 'USD')}
                        </div>
                    </div>

                    <div className="space-y-4 mb-8 flex-1 overflow-y-auto pr-2 custom-scrollbar-dark">
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-800">
                            <h4 className="text-[10px] text-slate-500 font-bold uppercase mb-3">Pendiente por Pagar</h4>
                            <div className="space-y-3">
                                {currencies.map(curr => {
                                    // Calculate REMAINING amount in this currency
                                    let amount = 0;
                                    // FIXED: Use TotalBS from Frontend (Cart) for true multi-rate accuracy
                                    const isLocalCurrency = curr.symbol === 'Bs' || curr.symbol === 'VES' || !curr.is_anchor;

                                    if (isLocalCurrency && totalBs > 0 && totalUSD > 0) {
                                        // Proportional Calculation to maintain source of truth total
                                        amount = totalBs * (Math.max(0, remainingUSD) / totalUSD);
                                    } else {
                                        amount = Math.max(0, remainingUSD) * (curr.rate || 1);
                                    }

                                    return (
                                        <div key={curr.symbol} className="flex justify-between items-end border-b border-slate-700/50 pb-2 last:border-0 last:pb-0">
                                            <span className="text-slate-400 text-sm font-medium">{curr.name}</span>
                                            <div className="flex flex-col items-end">
                                                <span className={`text-base font-bold font-mono ${amount > 0.005 ? 'text-white' : 'text-emerald-400'}`}>
                                                    {amount > 0.005
                                                        ? `${formatCurrency(amount, curr.symbol)}`
                                                        : 'COMPLETO'
                                                    }
                                                </span>
                                                {curr.symbol !== 'USD' && amount > 0.005 && (
                                                    <span className="text-[10px] text-slate-600">
                                                        {isLocalCurrency && totalBs ? 'Tasa Promedio' : `Tasa: ${formatCurrency(curr.rate, 'VE')}`}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {!isCreditSale && (
                        <div className={`mt-auto p-4 rounded-xl border-2 ${isComplete
                            ? 'bg-emerald-500/10 border-emerald-500/20'
                            : 'bg-rose-500/10 border-rose-500/20'
                            }`}>
                            {isComplete ? (
                                <div className="text-center">
                                    <div className="text-xs font-bold text-emerald-400 uppercase tracking-wide mb-1">Su Cambio / Vuelto</div>
                                    <div className="text-3xl font-black text-emerald-300 tracking-tight">${formatCurrency(changeUSD, 'USD')}</div>
                                    {currencies.find(c => !c.is_anchor) && (
                                        <div className="text-sm font-bold text-emerald-400/60 mt-1 font-mono">
                                            {(() => {
                                                const local = currencies.find(c => !c.is_anchor);
                                                const isLocalCurrency = local.symbol === 'Bs' || local.symbol === 'VES';

                                                let amount = 0;
                                                if (isLocalCurrency && totalBs > 0 && totalUSD > 0) {
                                                    // Use Effective Rate for Change too (Consistency)
                                                    amount = totalBs * (changeUSD / totalUSD);
                                                } else {
                                                    amount = changeUSD * (local.rate || 1);
                                                }

                                                const displayAmount = Math.max(0, amount);
                                                return `${local.symbol} ${formatCurrency(displayAmount, local.symbol)}`;
                                            })()}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center">
                                    <div className="text-xs font-bold text-rose-400 uppercase tracking-wide mb-1">Falta por Pagar</div>
                                    <div className="text-3xl font-black text-rose-300 tracking-tight">${formatCurrency(Math.abs(remainingUSD), 'USD')}</div>
                                    {currencies.find(c => !c.is_anchor) && (
                                        <div className="text-sm font-bold text-rose-400/60 mt-1 font-mono">
                                            {(() => {
                                                const local = currencies.find(c => !c.is_anchor);
                                                const amount = Math.abs(remainingUSD) * (local.rate || 1);
                                                return `${local.symbol} ${formatCurrency(amount, local.symbol)}`;
                                            })()}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {selectedCustomer && (
                        <div className={`mt-3 px-4 py-3 rounded-xl border ${isCreditSale
                            ? 'bg-indigo-500/10 border-indigo-500/30'
                            : 'bg-slate-800 border-slate-700'
                            }`}>
                            <div className="flex justify-between items-center">
                                <div className="flex flex-col text-left">
                                    <span className={`text-[10px] uppercase font-bold ${isCreditSale ? 'text-indigo-300' : 'text-slate-500'}`}>
                                        Cliente
                                    </span>
                                    <span className={`text-sm font-bold truncate max-w-[150px] ${isCreditSale ? 'text-indigo-200' : 'text-slate-300'}`}>
                                        {selectedCustomer.name}
                                    </span>
                                </div>
                                {isCreditSale && (
                                    <div className="text-right">
                                        <span className="block text-[10px] text-indigo-300 font-bold uppercase">Límite</span>
                                        <span className="text-sm font-mono font-bold text-indigo-400">
                                            ${formatCurrency(Number(selectedCustomer.credit_limit || 0), 'USD')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Payment Input */}
                <div className="p-8 md:w-2/3 bg-white flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-slate-800 font-bold text-xl flex items-center gap-2">
                            <Banknote className="text-slate-400" size={24} />
                            Método de Pago
                        </h3>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    {/* Customer Selection (Generic for ALL sales) */}
                    <div className={`mb-6 p-4 rounded-xl border-2 transition-all duration-300 ${isCreditSale && !selectedCustomer
                        ? 'bg-rose-50 border-rose-200 shadow-inner'
                        : 'bg-slate-50 border-slate-100'
                        }`}>
                        <div className="flex justify-between items-center mb-3">
                            <label className="text-sm font-bold text-slate-700 flex items-center gap-1">
                                Cliente
                                {isCreditSale && <span className="text-rose-500 font-bold text-xs bg-rose-100 px-1.5 py-0.5 rounded-full ml-1">Requerido</span>}
                            </label>
                            <button
                                onClick={() => setIsQuickCustomerOpen(true)}
                                className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition flex items-center gap-1 font-bold shadow-sm"
                            >
                                <UserPlus size={12} /> Nuevo Cliente
                            </button>
                        </div>

                        <CustomerSearch
                            customers={customers}
                            selectedCustomer={selectedCustomer}
                            onSelect={setSelectedCustomer}
                        />

                        {isCreditSale && !selectedCustomer && (
                            <div className="mt-2 text-xs text-rose-600 font-medium flex items-center gap-1 animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block"></span>
                                Debe seleccionar un cliente para proceder con la venta a crédito.
                            </div>
                        )}

                        {isCreditSale && selectedCustomer && (
                            <div className="mt-3 flex gap-4 text-sm bg-white p-3 rounded-lg border border-indigo-100 shadow-sm">
                                <div className="flex-1">
                                    <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Límite de Crédito</span>
                                    <span className="font-bold text-indigo-600 font-mono text-base">${formatCurrency(Number(selectedCustomer.credit_limit || 0), 'USD')}</span>
                                </div>
                                <div className="flex-1 border-l border-slate-100 pl-4">
                                    <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Plazo de Pago</span>
                                    <span className="font-bold text-slate-700">{selectedCustomer.payment_term_days || 15} días</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Credit Sale Toggle */}
                    <div className={`mb-6 p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-md ${isCreditSale
                        ? 'bg-indigo-50 border-indigo-200'
                        : 'bg-white border-slate-200 hover:border-indigo-200'
                        }`}>
                        <label className="flex items-center cursor-pointer w-full select-none">
                            <div className="relative flex items-center">
                                <input
                                    type="checkbox"
                                    checked={isCreditSale}
                                    onChange={(e) => setIsCreditSale(e.target.checked)}
                                    className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 bg-white checked:border-indigo-500 checked:bg-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                />
                                <CheckCircle className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100" size={14} strokeWidth={3} />
                            </div>
                            <span className="ml-3 flex-1">
                                <span className={`block font-bold transition-colors ${isCreditSale ? 'text-indigo-800' : 'text-slate-700'}`}>
                                    Venta a Crédito
                                </span>
                                <span className={`block text-xs transition-colors ${isCreditSale ? 'text-indigo-600' : 'text-slate-400'}`}>
                                    El pago se registrará como pendiente
                                </span>
                            </span>
                            <Users className={`ml-2 transition-colors ${isCreditSale ? 'text-indigo-500' : 'text-slate-300'}`} size={24} />
                        </label>
                    </div>

                    {/* Payment Rows (only for cash sales) */}
                    {!isCreditSale && (
                        <>
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Desglose de Pago</span>
                                <button
                                    onClick={addPaymentRow}
                                    className="text-xs bg-slate-50 text-indigo-600 border border-indigo-100 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-50 hover:border-indigo-200 transition"
                                >
                                    + Agregar Método
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-2 custom-scrollbar">
                                {payments.map((payment, index) => (
                                    <div key={index} className="flex gap-2 items-center bg-white p-2 rounded-xl border border-slate-200 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/10 focus-within:border-indigo-500 transition-all">
                                        <select
                                            className="bg-slate-50 border-0 text-slate-700 text-sm font-semibold rounded-lg focus:ring-0 block p-2.5 min-w-[120px]"
                                            value={payment.method}
                                            onChange={(e) => updatePayment(index, 'method', e.target.value)}
                                        >
                                            {paymentMethods.filter(m => m.is_active).map(method => (
                                                <option key={method.id} value={method.name}>{method.name}</option>
                                            ))}
                                        </select>

                                        <select
                                            className="bg-slate-50 border-0 text-slate-700 text-sm font-bold rounded-lg focus:ring-0 block p-2.5 w-20 text-center"
                                            value={payment.currency}
                                            onChange={(e) => updatePayment(index, 'currency', e.target.value)}
                                        >
                                            {currencies.map(curr => (
                                                <option key={curr.symbol} value={curr.symbol}>{curr.symbol}</option>
                                            ))}
                                        </select>

                                        <div className="h-6 w-px bg-slate-200 mx-1"></div>

                                        <CurrencyInput
                                            currencySymbol={payment.currency === 'USD' ? '$' : payment.currency}
                                            placeholder="0.00"
                                            className="flex-1 bg-transparent border-none text-slate-900 text-lg font-bold placeholder-slate-300 focus:ring-0 block p-2 text-right"
                                            value={payment.amount}
                                            onChange={(val) => updatePayment(index, 'amount', val)}
                                        />

                                        {payments.length > 1 && (
                                            <button
                                                onClick={() => removePaymentRow(index)}
                                                className="text-slate-300 hover:text-rose-500 p-2 hover:bg-rose-50 rounded-lg transition-colors"
                                            >
                                                <X size={18} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Actions */}
                    <div className="mt-auto flex gap-4 pt-4 border-t border-slate-100">
                        <button
                            onClick={onClose}
                            className="flex-1 px-6 py-4 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 hover:text-slate-800 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={processing || (!isCreditSale && !isComplete) || (isCreditSale && !selectedCustomer)}
                            className={`flex-[2] px-6 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 ${processing || (!isCreditSale && !isComplete) || (isCreditSale && !selectedCustomer)
                                ? 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
                                }`}
                        >
                            {processing ? (
                                'Procesando...'
                            ) : isCreditSale ? (
                                <>
                                    <CreditCard size={20} />
                                    Registrar Crédito
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={20} />
                                    Confirmar Pago
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Customer Modal Layer */}
            <QuickCustomerModal
                isOpen={isQuickCustomerOpen}
                onClose={() => setIsQuickCustomerOpen(false)}
                onSuccess={handleQuickCustomerSuccess}
            />
        </div>
    );
};

export default PaymentModal;
