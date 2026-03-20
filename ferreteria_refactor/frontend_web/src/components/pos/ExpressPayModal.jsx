import { useState, useEffect } from 'react';
import { X, Zap, DollarSign, Banknote, CheckCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { useConfig } from '../../context/ConfigContext';
import { useCash } from '../../context/CashContext';
import apiClient from '../../config/axios';
import toast from 'react-hot-toast';

/**
 * ExpressPayModal — Modal de cobro simplificado para Modo Express.
 *
 * Lógica deliberadamente reducida:
 *  - Solo un método de pago (efectivo)
 *  - Moneda USD o Bs
 *  - Sin crédito, sin múltiples pagos, sin prescripciones
 *  - Reusa el mismo endpoint POST /products/sales/ con el mismo payload shape
 *    que PaymentModal.executeSale() para no romper el backend.
 */
const ExpressPayModal = ({
    isOpen,
    onClose,
    totalUSD,
    totalBs,
    cart,
    warehouseId,
    onConfirm,
}) => {
    const { getExchangeRate, paymentMethods, currencies } = useConfig();
    const { session } = useCash();

    const [selectedCurrency, setSelectedCurrency] = useState('USD');
    const [amountEntered, setAmountEntered] = useState('');
    const [processing, setProcessing] = useState(false);

    // Default Bs rate
    const defaultBsRate = getExchangeRate?.('Bs') || getExchangeRate?.('VES') || 1;

    const displayTotal = selectedCurrency === 'USD'
        ? totalUSD
        : (totalBs || totalUSD * defaultBsRate);

    const amountNum = parseFloat(amountEntered) || 0;
    const change = Math.max(0, amountNum - displayTotal);
    const canSubmit = amountNum >= displayTotal && cart.length > 0;

    // Quick-fill buttons
    const quickAmounts = (() => {
        const base = displayTotal;
        const candidates = [
            Math.ceil(base),
            Math.ceil(base / 5) * 5,
            Math.ceil(base / 10) * 10,
            Math.ceil(base / 20) * 20,
            Math.ceil(base / 50) * 50,
        ];
        const unique = [...new Set(candidates.filter(v => v >= base))].sort((a, b) => a - b).slice(0, 4);
        return unique;
    })();

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            setSelectedCurrency('USD');
            setAmountEntered('');
            setProcessing(false);
        }
    }, [isOpen]);

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setProcessing(true);

        try {
            const paymentCurrency = selectedCurrency === 'USD' ? 'USD' : 'Bs';
            const paymentMethod = paymentMethods?.find(pm => pm.name?.toLowerCase().includes('efectivo'))?.name || 'Efectivo';

            const saleData = {
                total_amount: totalUSD,
                total_amount_bs: totalBs || (totalUSD * defaultBsRate),
                change_amount: selectedCurrency === 'USD' ? change : change / defaultBsRate,
                change_currency: selectedCurrency === 'USD' ? 'USD' : 'Bs',
                currency: selectedCurrency === 'USD' ? 'USD' : 'Bs',
                exchange_rate: defaultBsRate,
                payment_method: paymentMethod,
                payments: [{
                    amount: amountNum,
                    currency: paymentCurrency,
                    payment_method: paymentMethod,
                    reference: null,
                    payment_date: null,
                    exchange_rate: selectedCurrency === 'USD' ? 1 : defaultBsRate,
                }],
                items: cart.map(item => ({
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit_price: item.unit_price_usd || item.price_unit_usd || item.price_usd || 0,
                    subtotal: (item.unit_price_usd || item.price_unit_usd || item.price_usd || 0) * item.quantity,
                    conversion_factor: item.conversion_factor || 1,
                    discount: 0,
                    discount_type: 'NONE',
                    salesperson_id: null,
                    employee_id: null,
                    serial_numbers: [],
                })),
                is_credit: false,
                customer_id: null,
                warehouse_id: (!warehouseId || warehouseId === 'all') ? null : warehouseId,
                quote_id: null,
                notes: '',
                total_discount_usd: 0,
                cart_discount_type: null,
                cart_discount_value: 0,
                discount_auth_user_id: null,
                session_id: session?.id || null,
            };

            const response = await apiClient.post('/products/sales/', saleData);
            const saleId = response.data?.sale_id;

            onConfirm({
                payments: saleData.payments,
                totalPaidUSD: selectedCurrency === 'USD' ? amountNum : amountNum / defaultBsRate,
                changeUSD: selectedCurrency === 'USD' ? change : change / defaultBsRate,
                isCreditSale: false,
                customer: null,
                saleId,
            });

            onClose();
        } catch (error) {
            console.error('ExpressPayModal error:', error);
            const detail = error.response?.data?.detail;
            const msg = typeof detail === 'string' ? detail : 'Error al procesar la venta';
            toast.error(msg);
        } finally {
            setProcessing(false);
        }
    };

    if (!isOpen) return null;

    const activeBs = currencies?.find(c => !c.is_anchor && c.is_active && (c.symbol === 'Bs' || c.symbol === 'VES'));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <Zap size={18} className="text-indigo-500" />
                        <span className="font-black text-slate-800 text-lg">Cobro Express</span>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5">
                    {/* Total */}
                    <div className="bg-indigo-50 rounded-2xl px-5 py-4 text-center">
                        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-1">Total a cobrar</p>
                        <p className="text-4xl font-black text-indigo-700">
                            {selectedCurrency === 'USD' ? '$' : 'Bs'}{displayTotal.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        {activeBs && selectedCurrency === 'USD' && totalBs > 0 && (
                            <p className="text-sm text-indigo-400 mt-1">
                                ≈ Bs {(totalBs || totalUSD * defaultBsRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        )}
                    </div>

                    {/* Currency Toggle */}
                    {activeBs && (
                        <div className="flex bg-slate-100 rounded-2xl p-1 gap-1">
                            <button
                                onClick={() => { setSelectedCurrency('USD'); setAmountEntered(''); }}
                                className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-xl font-bold text-sm transition-all ${selectedCurrency === 'USD' ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <DollarSign size={15} /> USD
                            </button>
                            <button
                                onClick={() => { setSelectedCurrency('Bs'); setAmountEntered(''); }}
                                className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-xl font-bold text-sm transition-all ${selectedCurrency === 'Bs' ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Banknote size={15} /> Bs
                            </button>
                        </div>
                    )}

                    {/* Amount Input */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                            Monto recibido ({selectedCurrency})
                        </label>
                        <input
                            type="number"
                            value={amountEntered}
                            onChange={(e) => setAmountEntered(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                            placeholder={`0.00`}
                            className="w-full h-14 px-4 text-2xl font-black text-center rounded-2xl border-2 border-slate-200 focus:border-indigo-500 outline-none transition-colors"
                            autoFocus
                        />
                    </div>

                    {/* Quick amounts */}
                    {quickAmounts.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                            {quickAmounts.map((amt) => (
                                <button
                                    key={amt}
                                    onClick={() => setAmountEntered(String(amt))}
                                    className="flex-1 min-w-[60px] h-10 rounded-xl bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 font-bold text-sm text-slate-600 transition-colors"
                                >
                                    {selectedCurrency === 'Bs' ? 'Bs' : '$'}{amt}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Change */}
                    {amountNum > 0 && (
                        <div className={`flex items-center justify-between rounded-2xl px-4 py-3 ${change > 0 ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                            <span className="text-sm font-semibold text-slate-500">Vuelto</span>
                            <span className={`text-xl font-black ${change > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {selectedCurrency === 'Bs' ? 'Bs' : '$'}{change.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    )}
                </div>

                {/* CTA */}
                <div className="px-6 pb-6">
                    <Button
                        onClick={handleSubmit}
                        disabled={!canSubmit || processing}
                        className="w-full h-14 text-lg font-black rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
                    >
                        {processing ? (
                            <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                        ) : (
                            <>
                                <CheckCircle size={20} />
                                Confirmar Venta
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ExpressPayModal;
