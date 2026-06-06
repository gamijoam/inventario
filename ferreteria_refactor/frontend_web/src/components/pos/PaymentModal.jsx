import { useState, useEffect, useCallback } from 'react';
import FinancingStep from './FinancingStep';
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
    const { getActiveCurrencies, convertPrice, getExchangeRate, paymentMethods, formatCurrency, featureFlags, business} = useConfig();
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
    const [isFinancingMode, setIsFinancingMode]   = useState(false);
    const [financingData, setFinancingData]       = useState(null);
    const [showCalcCredito, setShowCalcCredito]   = useState(false);
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [loadingCustomers, setLoadingCustomers] = useState(false);

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
            const activeMethods = paymentMethods.filter(m => m.is_active);
            const isDefaultUSD = !primaryLocal;

            // Buscar el método por defecto que coincida con la moneda inicial
            let defaultMethod;
            if (isDefaultUSD) {
                defaultMethod = activeMethods.find(m =>
                    m.name.toLowerCase().includes('usd') ||
                    m.name.toLowerCase().includes('dólar') ||
                    m.name.toLowerCase().includes('dollar')
                )?.name || activeMethods[0]?.name || 'Efectivo USD';
            } else {
                // Moneda local (Bs, VES, etc.) — buscar método que NO sea USD
                defaultMethod = activeMethods.find(m =>
                    m.name.toLowerCase().includes('ves') ||
                    m.name.toLowerCase().includes('bs') ||
                    m.name.toLowerCase().includes('bolívar') ||
                    m.name.toLowerCase().includes('bolivar') ||
                    (m.name.toLowerCase().includes('efectivo') && !m.name.toLowerCase().includes('usd'))
                )?.name || activeMethods.find(m =>
                    !m.name.toLowerCase().includes('usd')
                )?.name || activeMethods[0]?.name || `Efectivo ${defaultCurrency}`;
            }

            setPayments([{ amount: '', currency: defaultCurrency, method: defaultMethod, payment_date: new Date().toISOString().split('T')[0] }]);
            setIsCreditSale(false);

            // Priority: Initial Customer > Null
            if (initialCustomer) {
                setSelectedCustomer(initialCustomer);
            } else {
                setSelectedCustomer(null);
            }

            setCustomers(initialCustomer ? [initialCustomer] : []);
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

    const fetchCustomers = useCallback(async (query = '') => {
        const q = query.trim();
        if (q.length < 2) {
            setCustomers(selectedCustomer ? [selectedCustomer] : []);
            return;
        }
        setLoadingCustomers(true);
        try {
            const response = await apiClient.get('/customers', { params: { q, limit: 20 } });
            const items = response.data.items || response.data;
            setCustomers(prev => {
                const merged = selectedCustomer ? [selectedCustomer, ...items] : items;
                return merged.filter((customer, index, arr) =>
                    customer?.id && arr.findIndex(c => c?.id === customer.id) === index
                );
            });
        } catch (error) {
            console.error('Error searching customers:', error);
            setCustomers(selectedCustomer ? [selectedCustomer] : []);
        } finally {
            setLoadingCustomers(false);
        }
    }, [selectedCustomer]);

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

        // Si cambia la moneda → buscar automáticamente el método más apropiado
        if (field === 'currency') {
            const isUSD = value === 'USD' || value === '$';
            const activeMethods = paymentMethods.filter(m => m.is_active);

            // Buscar método que coincida con la moneda seleccionada
            let bestMethod = null;
            if (isUSD) {
                // Para USD: buscar "Efectivo (USD)" o similar
                bestMethod = activeMethods.find(m =>
                    m.name.toLowerCase().includes('usd') ||
                    m.name.toLowerCase().includes('dólar') ||
                    m.name.toLowerCase().includes('dollar')
                );
            } else {
                // Para Bs u otra moneda local: buscar "Efectivo (VES)" o similar
                bestMethod = activeMethods.find(m =>
                    m.name.toLowerCase().includes('ves') ||
                    m.name.toLowerCase().includes('bs') ||
                    m.name.toLowerCase().includes('bolívar') ||
                    m.name.toLowerCase().includes('bolivar') ||
                    m.name.toLowerCase().includes('efectivo') && !m.name.toLowerCase().includes('usd')
                );
            }

            // Si no encontró método específico, usar el primer método activo
            if (!bestMethod && activeMethods.length > 0) {
                bestMethod = activeMethods[0];
            }

            if (bestMethod) {
                newPayments[index]['method'] = bestMethod.name;
            }
        }

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
                    serial_numbers: item.serial_numbers || [],
                    combo_serials: item.combo_serials || null
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

    const processFinancingSale = async (fData) => {
        setProcessing(true);
        try {
            const saleData = {
                total_amount: totalUSD,
                total_amount_bs: totalBs || (totalUSD * defaultBsRate),
                change_amount: 0,
                change_currency: "USD",
                currency: "USD",
                exchange_rate: defaultBsRate,
                payment_method: fData.financer_name,
                payments: fData.initial_payment > 0 ? [{
                    amount: fData.initial_payment,
                    currency: "USD",
                    payment_method: fData.financer_name + " (Inicial)",
                    exchange_rate: 1
                }] : [],
                items: cart.map(item => ({
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit_price: item.is_discount_active ? item.original_price_usd : (item.unit_price_usd || item.price_usd),
                    subtotal: (item.is_discount_active ? item.original_price_usd : (item.unit_price_usd || item.price_usd)) * item.quantity,
                    discount: item.is_discount_active ? item.discount_percentage : 0,
                    discount_type: item.is_discount_active ? "PERCENT" : "NONE",
                    serial_numbers: item.serial_numbers || [],
                    combo_serials: item.combo_serials || null
                })),
                is_credit: false,
                customer_id: selectedCustomer ? selectedCustomer.id : null,
                warehouse_id: (!warehouseId || warehouseId === 'all') ? null : warehouseId,
                notes: "Financiamiento: " + fData.financer_name,
                total_discount_usd: discountUSD || 0,
            };
            const response = await apiClient.post('/products/sales/', saleData);
            // El backend devuelve { status: "success", sale_id: N }
            const responseData = response?.data || response;
            const saleId = responseData?.sale_id || responseData?.id;

            // Registrar el financiamiento (no bloquear la venta si falla)
            if (saleId) {
                try {
                    await apiClient.post('/external-financing/', {
                        sale_id: saleId,
                        customer_id: selectedCustomer ? selectedCustomer.id : null,
                        financer_name: fData.financer_name,
                        total_price: fData.total_price,
                        initial_payment: fData.initial_payment,
                        initial_currency: "USD",
                        financed_amount: fData.financed_amount,
                    });
                } catch (finErr) {
                    // El financiamiento falló pero la venta ya se creó
                    console.warn('Financiamiento no registrado:', finErr?.response?.data?.detail || finErr?.message);
                    toast('Venta creada. El registro de financiamiento falló, verifica en Reportes.', { icon: '⚠️' });
                }
            }

            // Enviar estructura completa que espera el POS
            onConfirm?.({
                payments: fData.initial_payment > 0 ? [{
                    amount: fData.initial_payment,
                    currency: 'USD',
                    payment_method: fData.financer_name + ' (Inicial)',
                }] : [],
                totalPaidUSD: fData.initial_payment,
                changeUSD: 0,
                isCreditSale: false,
                isFinancing: true,
                financingData: fData,
                customer: selectedCustomer || null,
                saleId: saleId,
            });
            setProcessing(false);
            onClose();
        } catch (error) {
            const detail = error?.response?.data?.detail;
            let msg = typeof detail === 'string' ? detail
                    : Array.isArray(detail) ? detail.map(d => d?.msg || '').join(', ')
                    : error?.message || 'Error al procesar la venta';
            toast.error(msg);
            setProcessing(false);
        }
    };

    const handleConfirm = async () => {
        if (isFinancingMode && financingData) { await processFinancingSale(financingData); return; }
        if (isCreditSale && !selectedCustomer) {
            toast.error('Debe seleccionar un cliente para venta a crédito');
            return;
        }

        // Use the strict checking here too
        if (!isCreditSale && !isComplete && !isFinancingMode) {
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
                onVentaExitosa={() => { setShowCalcCredito(false); onClose?.(); onConfirm?.(); }}
            />,
            document.body
        )}

        {/* ── OVERLAY ──────────────────────────────────────────────────────── */}
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
            style={{ background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(8px)' }}>

            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
                style={{ maxHeight: '92vh' }}>

                {/* ── TOP: Total destacado ──────────────────────────────────── */}
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 px-5 py-4 relative overflow-hidden">
                    <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/5 rounded-full" />
                    <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-white/5 rounded-full" />

                    <div className="flex items-start justify-between relative z-10">
                        <div>
                            <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest mb-0.5">Total a Cobrar</p>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-indigo-300 text-lg font-light">$</span>
                                <span className="text-4xl font-black text-white tracking-tighter leading-none">
                                    {formatLocalCurrency(totalUSD)}
                                </span>
                            </div>
                            {/* Equivalentes monedas */}
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {Object.entries(totalsByCurrency || {}).filter(([c, a]) => c !== 'USD' && a > 0.005).map(([code, amt]) => {
                                    const curr = getActiveCurrencies().find(c => c.currency_code === code);
                                    const sym = curr?.currency_symbol || code;
                                    const rate = getExchangeRate(code) || 1;
                                    return (
                                        <span key={code} className="bg-white/10 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                                            {sym} {formatLocalCurrency(amt)} <span className="text-white/60 text-xs">· {formatLocalCurrency(rate)}</span>
                                        </span>
                                    );
                                })}
                                {Object.entries(totalsByCurrency || {}).filter(([c, a]) => c !== 'USD' && a > 0.005).length === 0 && (
                                    <span className="bg-white/10 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                                        Bs {formatLocalCurrency(displayTotalBs)} <span className="text-white/60 text-xs">· {formatLocalCurrency(defaultBsRate)}</span>
                                    </span>
                                )}
                                {discountUSD > 0 && (
                                    <span className="bg-rose-500/30 text-rose-200 text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1">
                                        <Tag size={9} /> −${formatLocalCurrency(discountUSD)}
                                    </span>
                                )}
                            </div>
                        </div>
                        <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all shrink-0">
                            <X size={16} />
                        </button>
                    </div>

                    {/* Estado pago */}
                    {!isCreditSale && totalPaidUSD > 0 && (
                        <div className={`mt-3 rounded-xl px-3 py-2.5 relative z-10 transition-all ${
                            isComplete ? 'bg-emerald-500/25 border border-emerald-400/30' : 'bg-rose-500/20 border border-rose-400/20'
                        }`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {isComplete
                                        ? <CheckCircle size={15} className="text-emerald-300" strokeWidth={3} />
                                        : <Calculator size={15} className="text-rose-300" />
                                    }
                                    <span className={`text-xs font-black ${isComplete ? 'text-emerald-200' : 'text-rose-200'}`}>
                                        {isComplete ? (changeUSD > 0.005 ? 'Vuelto' : 'Pago completo ✓') : 'Falta por pagar'}
                                    </span>
                                </div>
                                {/* Montos: USD + equivalente en moneda local */}
                                <div className="text-right">
                                    {isComplete && changeUSD > 0.005 ? (() => {
                                        // Calcular vuelto en la moneda del pago
                                        const allUSD = payments.every(p => p.currency === "$" || p.currency === "USD");
                                        const firstLocal = payments.find(p => p.currency !== "$" && p.currency !== "USD");
                                        const localCurr = firstLocal?.currency;
                                        let changeLocal = 0, localSym = "";
                                        if (!allUSD && localCurr) {
                                            if (localCurr === "Bs" || localCurr === "VES") {
                                                const vesTotal = totalsByCurrency?.VES || totalsByCurrency?.Bs;
                                                const eff = (vesTotal && totalUSD) ? (vesTotal / totalUSD) : defaultBsRate;
                                                changeLocal = changeUSD * eff; localSym = "Bs";
                                            } else {
                                                changeLocal = changeUSD * (getExchangeRate(localCurr) || 1); localSym = localCurr;
                                            }
                                        }
                                        return (
                                            <>
                                                <p className="text-white font-black text-lg font-mono">${formatLocalCurrency(changeUSD)}</p>
                                                {!allUSD && localSym && (
                                                    <p className="text-emerald-300 font-bold text-sm font-mono">{localSym} {formatLocalCurrency(changeLocal)}</p>
                                                )}
                                                {allUSD && defaultBsRate > 1 && (
                                                    <p className="text-emerald-300 font-bold text-sm font-mono">Bs {formatLocalCurrency(changeUSD * defaultBsRate)}</p>
                                                )}
                                            </>
                                        );
                                    })() : !isComplete ? (
                                        <>
                                            <p className={`font-black text-lg font-mono ${isComplete ? "text-white" : "text-rose-200"}`}>${formatLocalCurrency(remainingUSD)}</p>
                                            {defaultBsRate > 1 && (
                                                <p className="text-rose-300 font-bold text-sm font-mono">Bs {formatLocalCurrency(remainingUSD * defaultBsRate)}</p>
                                            )}
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    )}
                    {isCreditSale && (
                        <div className="mt-3 bg-white/10 border border-white/20 rounded-xl px-3 py-2 flex items-center gap-2 relative z-10">
                            <CreditCard size={16} className="text-indigo-200 shrink-0" />
                            <span className="text-xs font-black text-indigo-100">Venta a Crédito — pago diferido</span>
                        </div>
                    )}
                    {isFinancingMode && (
                        <div className="mt-3 bg-white/10 border border-emerald-300/30 rounded-xl px-3 py-2 flex items-center gap-2 relative z-10">
                            <span className="text-emerald-200 shrink-0">🏦</span>
                            <span className="text-xs font-black text-emerald-100">Financiamiento — Cashea / Krece</span>
                        </div>
                    )}
                </div>

                {/* ── BODY scrollable ──────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">

                    {isFinancingMode ? (
                        <FinancingStep
                            totalUSD={totalUSD}
                            onConfirm={(fData) => { setFinancingData(fData); processFinancingSale(fData); }}
                            onCancel={() => setIsFinancingMode(false)}
                        />
                    ) : <>

                    {/* Cliente */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                <User size={12} /> Cliente {isCreditSale && <span className="text-rose-500">*</span>}
                            </p>
                            <button onClick={() => setIsQuickCustomerOpen(true)} className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors">
                                <UserPlus size={10} /> Registrar nuevo cliente
                            </button>
                        </div>
                        <CustomerSearch customers={customers} selectedCustomer={selectedCustomer} onSelect={setSelectedCustomer} onSearch={fetchCustomers} loading={loadingCustomers} />

                        {isCreditSale && selectedCustomer && (
                            <div className="mt-2">
                                {loadingCredit ? (
                                    <div className="flex items-center gap-2 py-2 text-[10px] text-slate-400">
                                        <div className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                                        Consultando crédito...
                                    </div>
                                ) : creditInfo ? (
                                    <div className="space-y-1.5">
                                        <div className="grid grid-cols-3 gap-1.5">
                                            <div className="bg-slate-50 rounded-xl p-2 text-center border border-slate-100">
                                                <p className="text-[8px] text-slate-400 font-bold uppercase mb-0.5">Límite</p>
                                                <p className="text-xs font-black text-slate-700 font-mono">${formatLocalCurrency(creditInfo.credit_limit)}</p>
                                            </div>
                                            <div className="bg-rose-50 rounded-xl p-2 text-center border border-rose-100">
                                                <p className="text-[8px] text-rose-400 font-bold uppercase mb-0.5">Deuda</p>
                                                <p className="text-xs font-black text-rose-600 font-mono">${formatLocalCurrency(creditInfo.total_debt)}</p>
                                            </div>
                                            <div className={`rounded-xl p-2 text-center border ${creditInfo.available_credit >= totalUSD ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-200'}`}>
                                                <p className={`text-[8px] font-bold uppercase mb-0.5 ${creditInfo.available_credit >= totalUSD ? 'text-emerald-500' : 'text-rose-500'}`}>Disp.</p>
                                                <p className={`text-xs font-black font-mono ${creditInfo.available_credit >= totalUSD ? 'text-emerald-700' : 'text-rose-700'}`}>${formatLocalCurrency(creditInfo.available_credit)}</p>
                                            </div>
                                        </div>
                                        {creditInfo.available_credit < totalUSD && <div className="flex items-center gap-1.5 p-2 bg-rose-50 border border-rose-200 rounded-xl text-[10px] text-rose-700 font-bold"><X size={11} className="shrink-0 text-rose-500" />Crédito insuficiente. Falta ${formatLocalCurrency(totalUSD - creditInfo.available_credit)}</div>}
                                        {creditInfo.is_blocked && <div className="flex items-center gap-1.5 p-2 bg-rose-50 border border-rose-200 rounded-xl text-[10px] text-rose-700 font-bold"><X size={11} className="shrink-0 text-rose-500" />Cliente bloqueado</div>}
                                        {creditInfo.overdue_invoices > 0 && <div className="flex items-center gap-1.5 p-2 bg-amber-50 border border-amber-200 rounded-xl text-[10px] text-amber-700 font-bold"><Calculator size={11} className="shrink-0 text-amber-500" />{creditInfo.overdue_invoices} factura(s) vencida(s) — ${formatLocalCurrency(creditInfo.overdue_amount)}</div>}
                                    </div>
                                ) : (
                                    <div className="mt-1 bg-indigo-50 rounded-xl p-2 border border-indigo-100 text-xs font-black text-indigo-700">
                                        Límite: ${formatLocalCurrency(Number(selectedCustomer.credit_limit || 0))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Toggle crédito */}
                    <label className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all select-none ${isCreditSale ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'}`}>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${isCreditSale ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                            {isCreditSale && <CheckCircle size={12} className="text-white" strokeWidth={4} />}
                        </div>
                        <input type="checkbox" checked={isCreditSale} onChange={e => { setIsCreditSale(e.target.checked); setIsFinancingMode(false); }} className="hidden" />
                        <div>
                            <p className={`font-black text-sm ${isCreditSale ? 'text-indigo-700' : 'text-slate-600'}`}>Venta a Crédito</p>
                            <p className="text-[10px] text-slate-400">La cuenta se asignará al cliente</p>
                        </div>
                    </label>
                    {business?.external_financing_enabled !== false && (
                    <label className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all select-none ${isFinancingMode ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'}`}>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${isFinancingMode ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'}`}>
                            {isFinancingMode && <CheckCircle size={12} className="text-white" strokeWidth={4} />}
                        </div>
                        <input type="checkbox" checked={isFinancingMode} onChange={e => { setIsFinancingMode(e.target.checked); setIsCreditSale(false); }} className="hidden" />
                        <div>
                            <p className={`font-black text-sm ${isFinancingMode ? 'text-emerald-700' : 'text-slate-600'}`}>Financiamiento Externo</p>
                            <p className="text-[10px] text-slate-400">Cashea, Krece u otras</p>
                        </div>
                    </label>
                    )}

                    {/* Calculadora crédito celular */}
                    {isCreditSale && cart.some(i => i.has_imei) && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black text-indigo-700">📱 Celular en carrito</p>
                                <p className="text-[10px] text-indigo-500 mt-0.5">Calcula las cuotas antes de confirmar</p>
                            </div>
                            <button onClick={() => setShowCalcCredito(true)} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-black rounded-lg hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200">
                                🧮 Calculadora
                            </button>
                        </div>
                    )}

                    {/* Métodos de pago */}
                    {!isCreditSale && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <Layers size={10} /> Métodos de Pago
                                </p>
                                <button onClick={addPaymentRow} className="text-[11px] font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg transition-all">
                                    + Agregar
                                </button>
                            </div>

                            <div className="space-y-2">
                                {payments.map((payment, index) => {
                                    const selMethod = paymentMethods.find(m => m.name === payment.method);
                                    const needsRef = selMethod?.requires_reference;
                                    const currTotal = totalsByCurrency?.[payment.currency];
                                    const rate = payment.currency !== 'USD' && payment.currency !== '$'
                                        ? ((currTotal && totalUSD) ? (currTotal / totalUSD) : (getExchangeRate(payment.currency) || 1))
                                        : null;

                                    return (
                                        <div key={index} className="rounded-xl border border-slate-200 overflow-hidden focus-within:border-indigo-400 transition-all bg-white">
                                            {/* Fila superior: método + moneda */}
                                            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/50">
                                                <select
                                                    className="flex-1 bg-transparent text-xs font-bold text-slate-700 focus:outline-none"
                                                    value={payment.method}
                                                    onChange={e => updatePayment(index, 'method', e.target.value)}
                                                >
                                                    {paymentMethods.filter(m => m.is_active).map(m => (
                                                        <option key={m.id} value={m.name}>{m.name}</option>
                                                    ))}
                                                </select>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    {currencies.map(c => (
                                                        <button
                                                            key={c.symbol}
                                                            onClick={() => updatePayment(index, 'currency', c.symbol)}
                                                            className={`px-2.5 py-1 rounded-md text-xs font-black transition-all ${
                                                                payment.currency === c.symbol
                                                                    ? 'bg-indigo-600 text-white shadow-sm'
                                                                    : 'bg-white text-slate-500 border border-slate-200 hover:border-indigo-300'
                                                            }`}
                                                        >{c.symbol}</button>
                                                    ))}
                                                    {payments.length > 1 && (
                                                        <button onClick={() => removePaymentRow(index)} className="ml-1 w-7 h-7 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-all">
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Input monto grande */}
                                            <div className="flex items-center px-3 py-2.5">
                                                <span className="text-2xl font-black text-slate-300 mr-2">
                                                    {payment.currency === 'USD' || payment.currency === '$' ? '$' : payment.currency}
                                                </span>
                                                <CurrencyInput
                                                    autoFocus={index === 0}
                                                    className="flex-1 text-3xl font-black text-slate-900 bg-transparent border-none focus:ring-0 focus:outline-none text-right font-mono placeholder:text-slate-200"
                                                    placeholder="0,00"
                                                    value={payment.amount}
                                                    onChange={val => updatePayment(index, 'amount', val)}
                                                />
                                            </div>
                                            {/* Tasa hint */}
                                            {rate && (
                                                <div className="px-3 pb-2 flex justify-end">
                                                    <span className="text-[11px] text-slate-500 font-mono bg-slate-100 px-2.5 py-1 rounded-full font-bold">
                                                        Tasa: {formatLocalCurrency(rate)} {payment.currency}/$
                                                    </span>
                                                </div>
                                            )}
                                            {/* Referencia */}
                                            {needsRef && (
                                                <div className="flex gap-2 px-3 pb-2.5 animate-in fade-in slide-in-from-top-1">
                                                    <Input type="text" placeholder="Referencia / # Transferencia" className="flex-1 text-xs h-8 rounded-xl border-indigo-200 bg-indigo-50/50"
                                                        value={payment.reference || ''} onChange={e => updatePayment(index, 'reference', e.target.value)} />
                                                    <div className="relative w-36 shrink-0">
                                                        <Calendar size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" />
                                                        <Input type="date" className="text-xs h-8 rounded-xl border-indigo-200 bg-indigo-50/50 pl-6 w-full"
                                                            value={payment.payment_date || new Date().toISOString().split('T')[0]}
                                                            onChange={e => updatePayment(index, 'payment_date', e.target.value)} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                {/* ── FOOTER: botones ───────────────────────────────────────── */}
                    </>}
                </div>

                {!isFinancingMode && (
                <div className="px-4 pb-4 pt-2.5 border-t border-slate-100 flex gap-2 shrink-0 bg-white">
                    <button onClick={onClose} className="px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all">
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={processing || (!isCreditSale && !isComplete && !isFinancingMode) || (isCreditSale && !selectedCustomer) || (isCreditSale && creditInfo && (creditInfo.available_credit < totalUSD || creditInfo.is_blocked))}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all',
                            processing || (!isCreditSale && !isComplete && !isFinancingMode) || (isCreditSale && !selectedCustomer) || (isCreditSale && creditInfo && (creditInfo.available_credit < totalUSD || creditInfo.is_blocked))
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200/60 hover:-translate-y-0.5 active:scale-[0.98]'
                        )}
                    >
                        {processing
                            ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            : <><CheckCircle size={16} strokeWidth={3} />{isCreditSale ? 'Registrar Crédito' : 'Confirmar Pago'}</>
                        }
                    </button>
                </div>
                )}
            </div>
        </div>

        {/* ── Modales auxiliares ───────────────────────────────────────────── */}
        <QuickCustomerModal isOpen={isQuickCustomerOpen} onClose={() => setIsQuickCustomerOpen(false)} onSuccess={handleQuickCustomerSuccess} />

        {isPrescriptionModalOpen && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-teal-100 rounded-xl flex items-center justify-center"><FileText size={18} className="text-teal-600" /></div>
                            <div><h3 className="font-black text-slate-800 text-sm">Receta Médica</h3><p className="text-[10px] text-slate-500">Este producto requiere receta</p></div>
                        </div>
                        <button onClick={() => setIsPrescriptionModalOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
                    </div>
                    <div className="px-5 py-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2"><label className="block text-xs font-bold text-slate-600 mb-1">Paciente *</label><input type="text" value={prescriptionForm.patient_name} onChange={e => setPrescriptionForm(p => ({ ...p, patient_name: e.target.value }))} placeholder="Nombre completo" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" autoFocus /></div>
                            <div><label className="block text-xs font-bold text-slate-600 mb-1">Cédula</label><input type="text" value={prescriptionForm.patient_cedula} onChange={e => setPrescriptionForm(p => ({ ...p, patient_cedula: e.target.value }))} placeholder="V-12345678" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" /></div>
                            <div><label className="block text-xs font-bold text-slate-600 mb-1">Fecha Receta *</label><input type="date" value={prescriptionForm.prescription_date} onChange={e => setPrescriptionForm(p => ({ ...p, prescription_date: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" /></div>
                            <div className="col-span-2"><label className="block text-xs font-bold text-slate-600 mb-1">Médico *</label><input type="text" value={prescriptionForm.doctor_name} onChange={e => setPrescriptionForm(p => ({ ...p, doctor_name: e.target.value }))} placeholder="Dr. Nombre Apellido" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" /></div>
                            <div className="col-span-2"><label className="block text-xs font-bold text-slate-600 mb-1">MPPS / Registro</label><input type="text" value={prescriptionForm.doctor_mpps} onChange={e => setPrescriptionForm(p => ({ ...p, doctor_mpps: e.target.value }))} placeholder="MPPS-12345" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" /></div>
                        </div>
                    </div>
                    <div className="px-5 pb-5 flex gap-3">
                        <button onClick={handlePrescriptionSkip} disabled={savingPrescription} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 disabled:opacity-60">Omitir</button>
                        <button onClick={handlePrescriptionSave} disabled={savingPrescription} className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white font-bold text-sm hover:bg-teal-700 disabled:opacity-60 flex items-center justify-center gap-2">
                            {savingPrescription && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            Guardar y Confirmar
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export default PaymentModal;
