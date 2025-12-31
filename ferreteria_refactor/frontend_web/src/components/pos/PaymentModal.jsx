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

const PaymentModal = ({ isOpen, onClose, totalUSD, totalsByCurrency, cart, onConfirm, warehouseId, initialCustomer, quoteId }) => {
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
    const totalPaidUSD = payments.reduce((acc, p) => {
        const amount = parseFloat(p.amount) || 0;
        const rate = getExchangeRate(p.currency);
        return acc + (amount / (rate || 1));
    }, 0);

    const remainingUSD = totalUSD - totalPaidUSD;
    const changeUSD = totalPaidUSD - totalUSD;

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

            const saleData = {
                total_amount: totalUSD,
                currency: saleCurrency, // Dynamic Currency
                exchange_rate: getExchangeRate('Bs') || 1,
                payment_method: isCreditSale ? "Credito" : (payments[0]?.method || "Efectivo"),
                payments: isCreditSale ? [] : payments.map(p => ({
                    amount: parseFloat(p.amount) || 0,
                    currency: p.currency === "$" ? "USD" : p.currency, // Ensure consistency
                    payment_method: p.method,
                    exchange_rate: getExchangeRate(p.currency) || 1
                })),
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

            const response = await apiClient.post('/products/sales/', saleData);
            const saleId = response.data.sale_id;

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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row h-[600px]">
                {/* Left: Totals Summary */}
                <div className="bg-slate-900 text-white p-8 md:w-1/3 flex flex-col relative">
                    <h3 className="text-gray-400 uppercase text-sm font-bold mb-6">Resumen de Pago</h3>

                    <div className="mb-8">
                        <div className="text-sm text-gray-400">Total a Pagar</div>
                        <div className="text-4xl font-bold text-white tracking-tight">
                            ${formatCurrency(totalUSD, 'USD')}
                        </div>
                    </div>

                    <div className="space-y-4 mb-8 flex-1 overflow-y-auto">
                        <div className="space-y-4 mb-8 flex-1 overflow-y-auto">
                            <h4 className="text-xs text-gray-500 font-bold uppercase border-b border-gray-700 pb-1 mb-2">Restante por Pagar</h4>
                            {currencies.map(curr => {
                                // Calculate REMAINING amount in this currency
                                const amount = Math.max(0, remainingUSD) * (curr.rate || 1);

                                return (
                                    <div key={curr.symbol} className="flex justify-between items-center border-b border-gray-700 pb-2 last:border-0">
                                        <span className="text-gray-400 text-sm">{curr.name}</span>
                                        <span className="font-mono text-blue-300 flex flex-col items-end">
                                            <span className={`text-lg font-bold ${amount > 0.005 ? 'text-white' : 'text-green-500'}`}>
                                                {amount > 0.005
                                                    ? `${formatCurrency(amount, curr.symbol)} ${curr.symbol}`
                                                    : '¡COMPLETO!'
                                                }
                                            </span>
                                            {curr.symbol !== 'USD' && (
                                                <span className="text-xs text-gray-500">Tasa: {formatCurrency(curr.rate, 'VE')}</span>
                                            )}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {!isCreditSale && (
                        <div className={`mt-auto p-4 rounded-lg ${isComplete ? 'bg-green-600/20 border border-green-500' : 'bg-red-600/20 border border-red-500'}`}>
                            {isComplete ? (
                                <div className="text-center">
                                    <div className="text-sm text-green-300 mb-1">Cambio / Vuelto</div>
                                    <div className="text-3xl font-bold text-green-400">${formatCurrency(changeUSD, 'USD')}</div>
                                    {currencies.find(c => !c.is_anchor) && (
                                        <div className="text-lg font-bold text-green-400/70 mt-1">
                                            {(() => {
                                                const local = currencies.find(c => !c.is_anchor);
                                                const amount = changeUSD * (local.rate || 1);
                                                // Ensure we don't show negative change roughly
                                                const displayAmount = Math.max(0, amount);
                                                return `${local.symbol} ${formatCurrency(displayAmount, local.symbol)}`;
                                            })()}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center">
                                    <div className="text-sm text-red-300 mb-1">Falta por Pagar</div>
                                    <div className="text-3xl font-bold text-red-400">${formatCurrency(Math.abs(remainingUSD), 'USD')}</div>
                                    {currencies.find(c => !c.is_anchor) && (
                                        <div className="text-lg font-bold text-red-400/70 mt-1">
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
                        <div className={`mt-auto p-4 rounded-lg ${isCreditSale ? 'bg-blue-600/20 border border-blue-500' : 'bg-gray-800 border border-gray-700'}`}>
                            <div className="text-center">
                                <div className={`text-sm mb-1 ${isCreditSale ? 'text-blue-300' : 'text-gray-400'}`}>Cliente Asignado</div>
                                <div className={`text-lg font-bold ${isCreditSale ? 'text-blue-400' : 'text-white'}`}>{selectedCustomer.name}</div>
                                {isCreditSale && (
                                    <div className="text-xs text-blue-300 mt-2">
                                        Límite: ${formatCurrency(Number(selectedCustomer.credit_limit || 0), 'USD')}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Payment Input */}
                <div className="p-8 md:w-2/3 bg-gray-50 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-gray-800 font-bold text-xl flex items-center">
                            <Banknote className="mr-2" /> Método de Pago
                        </h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                            <X size={24} />
                        </button>
                    </div>

                    {/* Customer Selection (Generic for ALL sales) */}
                    <div className={`mb-6 p-4 rounded-xl border-2 transition-colors ${isCreditSale && !selectedCustomer
                        ? 'bg-red-50 border-red-200'
                        : 'bg-white border-transparent'
                        }`}>
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex justify-between items-center">
                            <span className="flex items-center gap-1">
                                Cliente
                                {isCreditSale && <span className="text-red-500 font-bold" title="Requerido para crédito">*</span>}
                            </span>
                            <button
                                onClick={() => setIsQuickCustomerOpen(true)}
                                className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full hover:bg-blue-200 transition flex items-center gap-1 font-bold shadow-sm"
                            >
                                <UserPlus size={14} /> Nuevo Cliente
                            </button>
                        </label>

                        <CustomerSearch
                            customers={customers}
                            selectedCustomer={selectedCustomer}
                            onSelect={setSelectedCustomer}
                        />

                        {isCreditSale && !selectedCustomer && (
                            <div className="mt-2 text-xs text-red-600 font-medium animate-pulse">
                                ⚠ Debe seleccionar un cliente para proceder con la venta a crédito.
                            </div>
                        )}

                        {isCreditSale && selectedCustomer && (
                            <div className="mt-3 flex gap-3 text-sm bg-blue-50 p-2 rounded-lg border border-blue-100">
                                <div className="flex-1">
                                    <span className="block text-xs text-gray-500 uppercase font-bold">Límite de Crédito</span>
                                    <span className="font-bold text-blue-700">${formatCurrency(Number(selectedCustomer.credit_limit || 0), 'USD')}</span>
                                </div>
                                <div className="flex-1 border-l border-blue-200 pl-3">
                                    <span className="block text-xs text-gray-500 uppercase font-bold">Plazo de Pago</span>
                                    <span className="font-bold text-blue-700">{selectedCustomer.payment_term_days || 15} días</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Credit Sale Toggle */}
                    <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isCreditSale}
                                onChange={(e) => setIsCreditSale(e.target.checked)}
                                className="w-5 h-5 mr-3"
                            />
                            <Users className="mr-2 text-blue-600" size={20} />
                            <span className="font-semibold text-blue-800">Venta a Crédito</span>
                        </label>
                    </div>

                    {/* Payment Rows (only for cash sales) */}
                    {!isCreditSale && (
                        <>
                            <div className="flex justify-end mb-3">
                                <button
                                    onClick={addPaymentRow}
                                    className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold hover:bg-blue-200 transition"
                                >
                                    + Agregar Método
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-2">
                                {payments.map((payment, index) => (
                                    <div key={index} className="flex gap-2 items-center bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                                        <select
                                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                                            value={payment.method}
                                            onChange={(e) => updatePayment(index, 'method', e.target.value)}
                                        >
                                            {paymentMethods.filter(m => m.is_active).map(method => (
                                                <option key={method.id} value={method.name}>{method.name}</option>
                                            ))}
                                        </select>

                                        <select
                                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 w-24"
                                            value={payment.currency}
                                            onChange={(e) => updatePayment(index, 'currency', e.target.value)}
                                        >
                                            {currencies.map(curr => (
                                                <option key={curr.symbol} value={curr.symbol}>{curr.symbol}</option>
                                            ))}
                                        </select>

                                        <span className="flex items-center bg-gray-50 border border-gray-300 border-r-0 rounded-l-lg px-3 text-gray-500 font-bold min-w-[3rem] justify-center">
                                            {payment.currency}
                                        </span>
                                        <CurrencyInput
                                            currencySymbol={payment.currency === 'USD' ? '$' : payment.currency}
                                            placeholder="Monto"
                                            className="flex-1 bg-white border border-gray-300 text-gray-900 text-sm rounded-r-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                                            value={payment.amount}
                                            onChange={(val) => updatePayment(index, 'amount', val)}
                                        />

                                        {payments.length > 1 && (
                                            <button
                                                onClick={() => removePaymentRow(index)}
                                                className="text-red-400 hover:text-red-600 p-2"
                                            >
                                                &times;
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Actions */}
                    <div className="mt-auto flex gap-4">
                        <button
                            onClick={onClose}
                            className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={processing || (!isCreditSale && !isComplete) || (isCreditSale && !selectedCustomer)}
                            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${processing || (!isCreditSale && !isComplete) || (isCreditSale && !selectedCustomer)
                                ? 'bg-gray-300 cursor-not-allowed'
                                : 'bg-green-600 hover:bg-green-700 text-white'
                                }`}
                        >
                            {processing ? (
                                'Procesando...'
                            ) : isCreditSale ? (
                                <>
                                    <CreditCard size={20} />
                                    Registrar Venta a Crédito
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
