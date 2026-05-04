import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DollarSign, CreditCard, Banknote, CheckCircle, Calculator, Users, X, UserPlus, User, Receipt, Layers, Trash2, Tag, Calendar, FileText } from 'lucide-react';
import { createPrescription } from '../../services/pharmacyService';
import { useConfig } from '../../context/ConfigContext';
import { useWebSocket } from '../../context/WebSocketContext';
import { useCash } from '../../context/CashContext';
import apiClient from '../../config/axios';
import toast from 'react-hot-toast';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import QuickCustomerModal from './QuickCustomerModal';
import CustomerSearch from './CustomerSearch';
import CurrencyInput from '../common/CurrencyInput';
import { cn } from '../../lib/utils';
import CreditoCelularModal from '../credit/CreditoCelularModal';

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
    const { getActiveCurrencies, convertPrice, getExchangeRate, paymentMethods, formatCurrency, featureFlags } = useConfig();
    const { subscribe } = useWebSocket();
    const { session } = useCash();
    const allCurrencies = [{ id: 'base', symbol: 'USD', name: 'Dólar', rate: 1, is_anchor: true }, ...getActiveCurrencies()];

    // Deduplicate currencies by symbol (to avoid double Bs if multiple rates exist)
    const currencies = allCurrencies.filter((curr, index, self) =>
        index === self.findIndex((c) => c.symbol === curr.symbol)
    );

    // State for multiple payments
    const [payments, setPayments] = useState([]);
    const [processing, setProcessing] = useState(false);

    // Credit sale states
    const [isCreditSale, setIsCreditSale]         = useState(false);
    const [showCalcCredito, setShowCalcCredito]   = useState(false);
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    // Quick Customer Modal
    const [isQuickCustomerOpen, setIsQuickCustomerOpen] = useState(false);

    // Prescription Modal state
    const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
    const [prescriptionForm, setPrescriptionForm] = useState({
        patient_name: '',
        patient_cedula: '',
        doctor_name: '',
        doctor_mpps: '',
        prescription_date: new Date().toISOString().split('T')[0],
    });
    const [savingPrescription, setSavingPrescription] = useState(false);

    // Credit availability state
    const [creditInfo, setCreditInfo] = useState(null);
    const [loadingCredit, setLoadingCredit] = useState(false);

    // Fetch financial status when customer is selected and credit mode is on
    useEffect(() => {
        if (isCreditSale && selectedCustomer?.id) {
            setLoadingCredit(true);
            apiClient.get(`/customers/${selectedCustomer.id}/financial-status`)
                .then(res => {
                    setCreditInfo(res.data);
                })
                .catch(err => {
                    console.error('Error fetching credit info:', err);
                    setCreditInfo(null);
                })
                .finally(() => setLoadingCredit(false));
        } else {
            setCreditInfo(null);
        }
    }, [isCreditSale, selectedCustomer?.id]);

    useEffect(() => {
        if (isOpen) {
            // Default to first non-USD active currency (e.g. COP, Bs), fallback to USD
            const activeCurrencies = getActiveCurrencies();
            const primaryLocal = activeCurrencies.find(c => c.symbol !== 'USD' && !c.is_anchor);
            const defaultCurrency = primaryLocal ? primaryLocal.symbol : 'USD';
            const defaultMethod = primaryLocal
                ? (paymentMethods.find(m => m.is_active && m.name.toLowerCase().includes(defaultCurrency.toLowerCase()))?.name || paymentMethods.find(m => m.is_active)?.name || `Efectivo ${defaultCurrency}`)
                : 'Efectivo USD';
            setPayments([{ amount: '', currency: defaultCurrency, method: defaultMethod, payment_date: new Date().toISOString().split('T')[0] }]);
            setIsCreditSale(false);

            // Priority: Initial Customer > Null
            if (initialCustomer) {
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
            const response = await apiClient.get('/customers', { params: { limit: 500 } });
            setCustomers(response.data.items || response.data);
        } catch (error) {
            console.error('Error fetching customers:', error);
        }
    };

    const handleQuickCustomerSuccess = (newCustomer) => {
        // Add new customer directly to list for immediate visibility in CustomerSearch
        setCustomers(prev => {
            const alreadyExists = prev.some(c => c.id === newCustomer.id);
            if (alreadyExists) return prev;
            return [newCustomer, ...prev];
        });
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
            // FIX: usar totalsByCurrency.VES (siempre tasa VES pura),
            // no totalBs que puede ser COP si el producto tiene rate COP asignado
            const vesTotal = totalsByCurrency?.VES || totalsByCurrency?.Bs;
            const effectiveRate = (vesTotal && totalUSD) ? (vesTotal / totalUSD) : defaultBsRate;
            rate = effectiveRate;
        } else {
            // Tasa ponderada del carrito si existe, si no tasa global
            const currTotal = totalsByCurrency?.[p.currency];
            const weightedRate = (currTotal && totalUSD) ? (currTotal / totalUSD) : null;
            rate = weightedRate || getExchangeRate(p.currency) || 1;
        }

        return round2(acc + round2(amount / rate));
    }, 0);


    
    const remainingUSD = round2(Math.max(0, totalUSD - totalPaidUSD));
    const changeUSD    = round2(Math.max(0, totalPaidUSD - totalUSD));
    const isComplete   = remainingUSD <= 0.005;

    // BLOQUECELULAR logic
    const phoneItemsTotalUSD = cart?.filter(item => item.product?.requires_imei || item.requires_imei).reduce((sum, item) => sum + (item.subtotal || (item.quantity * item.unit_price)), 0) || 0;
    const nonPhoneItemsTotalUSD = totalUSD - phoneItemsTotalUSD;
    const phoneDebtUSD = Math.max(0, phoneItemsTotalUSD - Math.max(0, totalPaidUSD - nonPhoneItemsTotalUSD));
    const showBloqueCelularAlert = isCreditSale && phoneItemsTotalUSD > 0 && featureFlags?.bloqueocelular_split_logic;

    const addPaymentRow = () => {
        const activeCurrencies = getActiveCurrencies();
        const primaryLocal = activeCurrencies.find(c => c.symbol !== "USD" && !c.is_anchor);
        const defaultCurrency = primaryLocal ? primaryLocal.symbol : "USD";
        const defaultMethod = primaryLocal
            ? (paymentMethods.find(m => m.is_active && m.name.toLowerCase().includes(defaultCurrency.toLowerCase()))?.name || paymentMethods.find(m => m.is_active)?.name || "Efectivo " + defaultCurrency)
            : "Efectivo USD";
        setPayments([...payments, { amount: "", currency: defaultCurrency, method: defaultMethod, payment_date: new Date().toISOString().split("T")[0] }]);
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

    
    // Check if cart has any item requiring a prescription
    const cartRequiresPrescription = () => {
        if (!cart || cart.length === 0) return false;
        return cart.some(item =>
            item.requires_prescription === true ||
            item.drug_classification === 'CONTROLLED'
        );
    };

    // Execute the actual sale after prescription check
    // onSaleComplete is an optional async callback (saleId) => void to run BEFORE onConfirm/onClose
    const executeSale = async (onSaleComplete) => {
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
                    if (changeUSD <= 0.005) return 0;
                    const allUSD = payments.every(p => p.currency === '$' || p.currency === 'USD');
                    if (allUSD) return changeUSD;
                    // Find the first non-USD payment currency to determine change currency
                    const firstLocalPayment = payments.find(p => p.currency !== '$' && p.currency !== 'USD');
                    const localCurrency = firstLocalPayment?.currency;
                    if (localCurrency === 'Bs' || localCurrency === 'VES') {
                        return changeUSD * defaultBsRate;
                    } else if (localCurrency) {
                        return changeUSD * (getExchangeRate(localCurrency) || 1);
                    }
                    return changeUSD * defaultBsRate;
                })(),
                change_currency: isCreditSale ? "USD" : (() => {
                    const allUSD = payments.every(p => p.currency === '$' || p.currency === 'USD');
                    if (allUSD) return "USD";
                    const firstLocalPayment = payments.find(p => p.currency !== '$' && p.currency !== 'USD');
                    return firstLocalPayment?.currency || "USD";
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
                        payment_date: p.payment_date || null, // Date when payment was made
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
                    unit_id: item.unit_id || null,        // Presentación/unidad seleccionada (kg, litro, etc.)
                    discount: item.is_discount_active ? item.discount_percentage : 0,
                    discount_type: item.is_discount_active ? "PERCENT" : "NONE",
                    salesperson_id: item.salesperson_id || null,
                    employee_id: item.employee_id || null,
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
                discount_auth_user_id: cartDiscount?.auth_user_id || null,
                session_id: session?.id || null  // Multi-register: link sale to the open session
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

            // Optional post-sale callback (e.g. save prescription with sale_id)
            if (onSaleComplete) {
                try { await onSaleComplete(saleId); } catch { /* ignore secondary errors */ }
            }

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

    const handleConfirm = async () => {
        if (isCreditSale && !selectedCustomer) {
            toast.error('Debe seleccionar un cliente para venta a crédito');
            return;
        }

        // Use the strict checking here too
        if (!isCreditSale && !isComplete) {
            toast.error('El pago no está completo');
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

        // If cart has controlled/prescription items, intercept and show prescription modal
        if (cartRequiresPrescription()) {
            setPrescriptionForm({
                patient_name: '',
                patient_cedula: '',
                doctor_name: '',
                doctor_mpps: '',
                prescription_date: new Date().toISOString().split('T')[0],
            });
            setIsPrescriptionModalOpen(true);
            return;
        }

        await executeSale();
    };

    const handlePrescriptionSave = async () => {
        if (!prescriptionForm.patient_name.trim()) {
            toast.error('Ingresa el nombre del paciente');
            return;
        }
        if (!prescriptionForm.doctor_name.trim()) {
            toast.error('Ingresa el nombre del médico');
            return;
        }

        setSavingPrescription(true);
        setIsPrescriptionModalOpen(false);
        try {
            await executeSale(async (saleId) => {
                if (saleId) {
                    await createPrescription({
                        sale_id: saleId,
                        patient_name: prescriptionForm.patient_name.trim(),
                        patient_cedula: prescriptionForm.patient_cedula.trim() || null,
                        doctor_name: prescriptionForm.doctor_name.trim(),
                        doctor_mpps: prescriptionForm.doctor_mpps.trim() || null,
                        prescription_date: prescriptionForm.prescription_date || null,
                    }).catch(() => {
                        // Non-blocking: sale already completed, just warn
                        toast.error('Venta registrada, pero no se pudo guardar la receta');
                    });
                }
            });
        } catch {
            // executeSale already shows toast
        } finally {
            setSavingPrescription(false);
        }
    };

    const handlePrescriptionSkip = async () => {
        setIsPrescriptionModalOpen(false);
        await executeSale();
    };

    // Modal calculadora de crédito para celulares
    const celularEnCarrito = cart.find(item => item.has_imei);
    const clienteSeleccionado = selectedCustomer;

    return (
        <>
        {showCalcCredito && celularEnCarrito && createPortal(
            <CreditoCelularModal
                isOpen={showCalcCredito}
                onClose={() => setShowCalcCredito(false)}
                producto={celularEnCarrito}
                cliente={clienteSeleccionado}
                sessionId={session?.id || null}
                exchangeRate={defaultBsRate}
                onVentaExitosa={() => {
                    setShowCalcCredito(false);
                    onClose?.();
                    onConfirm?.();
                }}
            />,
            document.body
        )}

        <div className="fixed inset-0 bg-[#0f172a]/70 flex items-end sm:items-center justify-center z-50 backdrop-blur-md p-0 sm:p-4">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row animate-in fade-in zoom-in-95 slide-in-from-bottom-5 duration-300"
                style={{ maxHeight: '92vh' }}>

                {/* ── PANEL IZQUIERDO: Resumen ─────────────────────────────── */}
                <div className="bg-slate-900 text-white md:w-5/12 flex flex-col shrink-0 relative overflow-hidden"
                    style={{ maxHeight: '30vh', minHeight: 'unset' }}
                    className="bg-slate-900 text-white md:w-5/12 flex flex-col shrink-0 relative overflow-hidden md:max-h-none">

                    {/* Acento decorativo */}
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                    <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

                    <div className="p-5 flex flex-col h-full z-10 overflow-y-auto">
                        {/* Label */}
                        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.25em] mb-3 flex items-center gap-1.5">
                            <Receipt size={10} /> Resumen
                        </p>

                        {/* Total principal */}
                        <div className="mb-4">
                            <p className="text-[10px] text-slate-500 mb-0.5">Total a Pagar</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-lg text-indigo-400 font-light">$</span>
                                <span className="text-4xl font-black text-white tracking-tighter">
                                    {formatLocalCurrency(totalUSD)}
                                </span>
                            </div>
                            {discountUSD > 0 && (
                                <div className="flex items-center gap-1.5 mt-1.5 bg-rose-500/15 border border-rose-500/20 rounded-lg px-2.5 py-1">
                                    <Tag size={9} className="text-rose-400" />
                                    <span className="text-[9px] font-black text-rose-300">
                                        Desc {cartDiscount?.type === 'percent' ? `${cartDiscount.value}%` : 'Fijo'}: −${formatLocalCurrency(discountUSD)}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Equivalentes en otras monedas */}
                        <div className="space-y-2 mb-auto">
                            {Object.entries(totalsByCurrency || {}).filter(([code, amt]) => code !== 'USD' && amt > 0.005).map(([code, amt]) => {
                                const curr = getActiveCurrencies().find(c => c.currency_code === code);
                                const sym = curr?.currency_symbol || code;
                                const rate = getExchangeRate(code) || 1;
                                return (
                                    <div key={code} className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{curr?.name || code}</span>
                                            <span className="text-[9px] bg-indigo-500/10 text-indigo-300 px-1.5 py-0.5 rounded-full font-mono border border-indigo-500/20">
                                                Tasa: {formatLocalCurrency(rate)}
                                            </span>
                                        </div>
                                        <span className="text-xl font-black text-emerald-400 font-mono">
                                            {formatLocalCurrency(amt)} <span className="text-xs font-bold">{sym}</span>
                                        </span>
                                    </div>
                                );
                            })}
                            {Object.entries(totalsByCurrency || {}).filter(([code, amt]) => code !== 'USD' && amt > 0.005).length === 0 && (
                                <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Bolívares</span>
                                        <span className="text-[9px] bg-indigo-500/10 text-indigo-300 px-1.5 py-0.5 rounded-full font-mono border border-indigo-500/20">
                                            Tasa: {formatLocalCurrency(defaultBsRate)}
                                        </span>
                                    </div>
                                    <span className="text-xl font-black text-emerald-400 font-mono">
                                        {formatLocalCurrency(displayTotalBs)} <span className="text-xs font-bold">Bs</span>
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Estado del pago */}
                        {!isCreditSale && (
                            <div className={`mt-4 rounded-xl p-3 border transition-all duration-500 ${
                                isComplete
                                    ? 'bg-emerald-500/20 border-emerald-500/30'
                                    : 'bg-slate-800/60 border-slate-700/50'
                            }`}>
                                {isComplete ? (
                                    <div className="text-center">
                                        <div className="flex items-center justify-center gap-1.5 mb-1">
                                            <CheckCircle size={14} className="text-emerald-400" strokeWidth={3} />
                                            <span className="text-[10px] font-black text-emerald-300 uppercase tracking-wider">Pago Completo</span>
                                        </div>
                                        {changeUSD > 0.005 ? (() => {
                                            const allUSD = payments.every(p => p.currency === '$' || p.currency === 'USD');
                                            const firstLocal = payments.find(p => p.currency !== '$' && p.currency !== 'USD');
                                            const localCurr = firstLocal?.currency;
                                            let changeLocal = 0, localSym = '';
                                            if (!allUSD && localCurr) {
                                                if (localCurr === 'Bs' || localCurr === 'VES') {
                                                    const vesTotal = totalsByCurrency?.VES || totalsByCurrency?.Bs;
                                                    const eff = (vesTotal && totalUSD) ? (vesTotal / totalUSD) : defaultBsRate;
                                                    changeLocal = changeUSD * eff; localSym = 'Bs';
                                                } else {
                                                    changeLocal = changeUSD * (getExchangeRate(localCurr) || 1); localSym = localCurr;
                                                }
                                            }
                                            return (
                                                <div>
                                                    <p className="text-[10px] text-emerald-400 mb-0.5">Vuelto</p>
                                                    <p className="text-2xl font-black text-white">${formatLocalCurrency(changeUSD)}</p>
                                                    {!allUSD && localSym && (
                                                        <p className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                                                            {localSym} {formatLocalCurrency(changeLocal)}
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        })() : (
                                            <p className="text-base font-black text-white">Cuenta Saldada</p>
                                        )}
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-[9px] font-black text-rose-400 uppercase tracking-wider mb-1">Falta por pagar</p>
                                        <p className="text-2xl font-black text-rose-400 font-mono">${formatLocalCurrency(remainingUSD)}</p>
                                        <div className="space-y-0.5 mt-1">
                                            {Object.entries(totalsByCurrency || {}).filter(([code, amt]) => code !== 'USD' && amt > 0.005).map(([code]) => {
                                                const curr = getActiveCurrencies().find(c => c.currency_code === code);
                                                const sym = curr?.currency_symbol || code;
                                                return (
                                                    <p key={code} className="text-xs font-bold text-slate-400 font-mono">
                                                        {sym} {formatLocalCurrency(remainingUSD * (getExchangeRate(code) || 1))}
                                                    </p>
                                                );
                                            })}
                                            {Object.entries(totalsByCurrency || {}).filter(([code, amt]) => code !== 'USD' && amt > 0.005).length === 0 && (
                                                <p className="text-xs font-bold text-slate-400 font-mono">
                                                    Bs {formatLocalCurrency(remainingUSD * defaultBsRate)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {isCreditSale && (
                            <div className="mt-4 bg-indigo-600/20 border border-indigo-500/30 rounded-xl p-3 flex items-center gap-2.5">
                                <CreditCard className="text-indigo-400 shrink-0" size={16} />
                                <div>
                                    <p className="text-indigo-300 font-black text-xs">Venta a Crédito</p>
                                    <p className="text-indigo-400/70 text-[10px]">Pago diferido al cliente</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── PANEL DERECHO: Acciones ──────────────────────────────── */}
                <div className="flex flex-col flex-1 overflow-hidden bg-white">

                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
                        <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                            <span className="w-1 h-5 bg-indigo-600 rounded-full" />
                            Procesar Pago
                        </h2>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Contenido scrollable */}
                    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

                        {/* ── Cliente ─────────────────────────────────────── */}
                        <div className={`rounded-2xl border p-3 transition-all ${isCreditSale && !selectedCustomer ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200 bg-white'}`}>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                    <User size={11} /> Cliente
                                    {isCreditSale && <span className="bg-rose-100 text-rose-600 text-[9px] px-1.5 py-0.5 rounded-full font-black">Requerido</span>}
                                </label>
                                <button
                                    onClick={() => setIsQuickCustomerOpen(true)}
                                    className="flex items-center gap-1 text-[10px] font-black text-indigo-600 hover:text-indigo-800 transition-colors"
                                >
                                    <UserPlus size={11} /> Nuevo
                                </button>
                            </div>
                            <CustomerSearch
                                customers={customers}
                                selectedCustomer={selectedCustomer}
                                onSelect={setSelectedCustomer}
                                className="scale-100"
                            />
                            {/* Info crédito del cliente */}
                            {isCreditSale && selectedCustomer && (
                                <div className="mt-2">
                                    {loadingCredit ? (
                                        <div className="flex items-center gap-2 py-2 text-[10px] text-slate-400">
                                            <div className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                                            Consultando crédito...
                                        </div>
                                    ) : creditInfo ? (
                                        <div className="space-y-1.5">
                                            <div className="grid grid-cols-3 gap-1.5 mt-1">
                                                <div className="bg-slate-50 rounded-xl p-2 text-center border border-slate-100">
                                                    <p className="text-[8px] text-slate-400 font-bold uppercase mb-0.5">Límite</p>
                                                    <p className="text-xs font-black text-slate-700 font-mono">${formatLocalCurrency(creditInfo.credit_limit)}</p>
                                                </div>
                                                <div className="bg-rose-50 rounded-xl p-2 text-center border border-rose-100">
                                                    <p className="text-[8px] text-rose-400 font-bold uppercase mb-0.5">Deuda</p>
                                                    <p className="text-xs font-black text-rose-600 font-mono">${formatLocalCurrency(creditInfo.total_debt)}</p>
                                                </div>
                                                <div className={`rounded-xl p-2 text-center border ${creditInfo.available_credit >= totalUSD ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-200'}`}>
                                                    <p className="text-[8px] font-bold uppercase mb-0.5" style={{ color: creditInfo.available_credit >= totalUSD ? '#16a34a' : '#dc2626' }}>Disp.</p>
                                                    <p className={`text-xs font-black font-mono ${creditInfo.available_credit >= totalUSD ? 'text-emerald-700' : 'text-rose-700'}`}>${formatLocalCurrency(creditInfo.available_credit)}</p>
                                                </div>
                                            </div>
                                            {creditInfo.available_credit < totalUSD && (
                                                <div className="flex items-center gap-1.5 p-2 bg-rose-50 border border-rose-200 rounded-xl">
                                                    <X size={11} className="text-rose-500 shrink-0" />
                                                    <span className="text-[10px] text-rose-700 font-bold">Crédito insuficiente. Falta ${formatLocalCurrency(totalUSD - creditInfo.available_credit)}</span>
                                                </div>
                                            )}
                                            {creditInfo.is_blocked && (
                                                <div className="flex items-center gap-1.5 p-2 bg-rose-50 border border-rose-200 rounded-xl">
                                                    <X size={11} className="text-rose-500 shrink-0" />
                                                    <span className="text-[10px] text-rose-700 font-bold">Cliente bloqueado para crédito</span>
                                                </div>
                                            )}
                                            {creditInfo.overdue_invoices > 0 && (
                                                <div className="flex items-center gap-1.5 p-2 bg-amber-50 border border-amber-200 rounded-xl">
                                                    <Calculator size={11} className="text-amber-500 shrink-0" />
                                                    <span className="text-[10px] text-amber-700 font-bold">{creditInfo.overdue_invoices} factura(s) vencida(s) — ${formatLocalCurrency(creditInfo.overdue_amount)}</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="mt-1 bg-indigo-50 rounded-xl p-2 border border-indigo-100">
                                            <p className="text-[9px] text-indigo-400 font-bold uppercase">Límite Crédito</p>
                                            <p className="text-xs font-black text-indigo-700 font-mono">${formatLocalCurrency(Number(selectedCustomer.credit_limit || 0))}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ── Toggle crédito ───────────────────────────────── */}
                        <label className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all select-none ${isCreditSale ? 'border-indigo-300 bg-indigo-50/40' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${isCreditSale ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                                {isCreditSale && <CheckCircle size={12} className="text-white" strokeWidth={4} />}
                            </div>
                            <input type="checkbox" checked={isCreditSale} onChange={e => setIsCreditSale(e.target.checked)} className="hidden" />
                            <div>
                                <p className={`font-black text-xs ${isCreditSale ? 'text-indigo-700' : 'text-slate-600'}`}>Venta a Crédito</p>
                                <p className="text-[10px] text-slate-400">La cuenta se asignará al cliente</p>
                            </div>
                        </label>

                        {/* ── Calculadora crédito celular ───────────────────── */}
                        {isCreditSale && cart.some(item => item.has_imei) && (
                            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-black text-indigo-700">📱 Celular en carrito</p>
                                    <p className="text-[10px] text-indigo-500">Calcula las cuotas antes de confirmar</p>
                                </div>
                                <button
                                    onClick={() => setShowCalcCredito(true)}
                                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-black rounded-xl hover:bg-indigo-700 transition-colors"
                                >
                                    🧮 Calculadora
                                </button>
                            </div>
                        )}

                        {/* ── BloqueoCelular alert ──────────────────────────── */}
                        {showBloqueCelularAlert && (
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
                                <p className="text-xs font-black text-amber-700">⚠️ Venta con celular a crédito</p>
                                <p className="text-[10px] text-amber-600 mt-0.5">El equipo quedará vinculado al cliente vía BloqueoCelular</p>
                            </div>
                        )}

                        {/* ── Métodos de pago ──────────────────────────────── */}
                        {!isCreditSale && (
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                        <Layers size={11} /> Métodos de Pago
                                    </p>
                                    <button
                                        onClick={addPaymentRow}
                                        className="text-[10px] font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg transition-all"
                                    >
                                        + Agregar método
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {payments.map((payment, index) => {
                                        const selectedMethod = paymentMethods.find(m => m.name === payment.method);
                                        const needsReference = selectedMethod?.requires_reference;
                                        return (
                                            <div key={index} className="bg-white border-2 border-slate-200 rounded-2xl p-3 focus-within:border-indigo-400 transition-all">
                                                <div className="flex gap-2 mb-2">
                                                    {/* Selector método */}
                                                    <select
                                                        className="flex-1 bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-2.5 py-2 focus:outline-none focus:border-indigo-400"
                                                        value={payment.method}
                                                        onChange={e => updatePayment(index, 'method', e.target.value)}
                                                    >
                                                        {paymentMethods.filter(m => m.is_active).map(m => (
                                                            <option key={m.id} value={m.name}>{m.name}</option>
                                                        ))}
                                                    </select>
                                                    {/* Pills moneda */}
                                                    <div className="flex gap-1 shrink-0">
                                                        {currencies.map(c => (
                                                            <button
                                                                key={c.symbol}
                                                                onClick={() => updatePayment(index, 'currency', c.symbol)}
                                                                className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all border ${
                                                                    payment.currency === c.symbol
                                                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                                        : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                                                                }`}
                                                            >
                                                                {c.symbol}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    {/* Botón eliminar */}
                                                    {payments.length > 1 && (
                                                        <button
                                                            onClick={() => removePaymentRow(index)}
                                                            className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all shrink-0"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Input monto */}
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-black text-slate-400">
                                                        {payment.currency === 'USD' || payment.currency === '$' ? '$' : payment.currency}
                                                    </span>
                                                    <CurrencyInput
                                                        autoFocus={index === 0}
                                                        className="w-full pl-8 pr-4 py-3 text-2xl font-black text-right text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-all font-mono"
                                                        placeholder="0,00"
                                                        value={payment.amount}
                                                        onChange={val => updatePayment(index, 'amount', val)}
                                                    />
                                                </div>

                                                {/* Tasa hint */}
                                                {payment.currency !== 'USD' && payment.currency !== '$' && (() => {
                                                    const currTotal = totalsByCurrency?.[payment.currency];
                                                    const rate = (currTotal && totalUSD) ? (currTotal / totalUSD) : (getExchangeRate(payment.currency) || 1);
                                                    return (
                                                        <p className="text-[9px] text-slate-400 font-mono mt-1 text-right">
                                                            Tasa: {rate.toFixed(2)} {payment.currency} / $
                                                        </p>
                                                    );
                                                })()}

                                                {/* Referencia si requiere */}
                                                {needsReference && (
                                                    <div className="flex gap-2 mt-2 animate-in fade-in slide-in-from-top-1">
                                                        <Input
                                                            type="text"
                                                            placeholder="Referencia / # Transferencia"
                                                            className="flex-1 text-xs h-8 rounded-xl border-indigo-100 bg-indigo-50/50"
                                                            value={payment.reference || ''}
                                                            onChange={e => updatePayment(index, 'reference', e.target.value)}
                                                        />
                                                        <div className="relative w-36 shrink-0">
                                                            <Calendar size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" />
                                                            <Input
                                                                type="date"
                                                                className="text-xs h-8 rounded-xl border-indigo-100 bg-indigo-50/50 pl-6 w-full"
                                                                value={payment.payment_date || new Date().toISOString().split('T')[0]}
                                                                onChange={e => updatePayment(index, 'payment_date', e.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Footer fijo: botones ─────────────────────────────── */}
                    <div className="px-5 py-4 bg-white border-t border-slate-100 flex gap-2.5 shrink-0">
                        <button
                            onClick={onClose}
                            className="px-5 py-3 rounded-2xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={processing || (!isCreditSale && !isComplete) || (isCreditSale && !selectedCustomer) || (isCreditSale && creditInfo && (creditInfo.available_credit < totalUSD || creditInfo.is_blocked))}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm transition-all ${
                                processing || (!isCreditSale && !isComplete) || (isCreditSale && !selectedCustomer) || (isCreditSale && creditInfo && (creditInfo.available_credit < totalUSD || creditInfo.is_blocked))
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 hover:-translate-y-0.5 active:scale-[0.98]'
                            }`}
                        >
                            {processing ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <CheckCircle size={16} strokeWidth={3} />
                                    {isCreditSale ? 'Registrar Crédito' : 'Confirmar Pago'}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* ── Modales auxiliares ───────────────────────────────────────────── */}
        <QuickCustomerModal
            isOpen={isQuickCustomerOpen}
            onClose={() => setIsQuickCustomerOpen(false)}
            onSuccess={handleQuickCustomerSuccess}
        />

        {isPrescriptionModalOpen && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-teal-100 rounded-xl flex items-center justify-center">
                                <FileText size={18} className="text-teal-600" />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800 text-sm">Datos de Receta Médica</h3>
                                <p className="text-[10px] text-slate-500">Este producto requiere receta médica</p>
                            </div>
                        </div>
                        <button onClick={() => setIsPrescriptionModalOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                            <X size={16} />
                        </button>
                    </div>
                    <div className="px-5 py-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-slate-600 mb-1">Nombre del Paciente *</label>
                                <input type="text" value={prescriptionForm.patient_name} onChange={e => setPrescriptionForm(p => ({ ...p, patient_name: e.target.value }))} placeholder="Nombre completo" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" autoFocus />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Cédula del Paciente</label>
                                <input type="text" value={prescriptionForm.patient_cedula} onChange={e => setPrescriptionForm(p => ({ ...p, patient_cedula: e.target.value }))} placeholder="V-12345678" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Fecha Receta *</label>
                                <input type="date" value={prescriptionForm.prescription_date} onChange={e => setPrescriptionForm(p => ({ ...p, prescription_date: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-slate-600 mb-1">Nombre del Médico *</label>
                                <input type="text" value={prescriptionForm.doctor_name} onChange={e => setPrescriptionForm(p => ({ ...p, doctor_name: e.target.value }))} placeholder="Dr. Nombre Apellido" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-slate-600 mb-1">MPPS / Nro. Registro</label>
                                <input type="text" value={prescriptionForm.doctor_mpps} onChange={e => setPrescriptionForm(p => ({ ...p, doctor_mpps: e.target.value }))} placeholder="MPPS-12345" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
                            </div>
                        </div>
                    </div>
                    <div className="px-5 pb-5 flex gap-3">
                        <button onClick={handlePrescriptionSkip} disabled={savingPrescription} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors disabled:opacity-60">Omitir</button>
                        <button onClick={handlePrescriptionSave} disabled={savingPrescription} className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white font-bold text-sm hover:bg-teal-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                            {savingPrescription && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            Guardar Receta y Confirmar
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export default PaymentModal;
