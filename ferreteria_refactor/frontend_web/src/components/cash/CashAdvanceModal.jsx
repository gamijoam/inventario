import { useState, useEffect } from 'react';
import { X, TrendingDown, RefreshCw, Calculator, DollarSign } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';
import apiClient from '../../config/axios';
import toast from 'react-hot-toast';

const CashAdvanceModal = ({ isOpen, onClose, onSuccess }) => {
    const { getActiveCurrencies, formatCurrency } = useConfig();

    // Inputs
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState('USD');
    const [commissionPercent, setCommissionPercent] = useState(10); // Default 10%
    const [description, setDescription] = useState('');

    // State
    const [loading, setLoading] = useState(false);
    const [availableBalance, setAvailableBalance] = useState(0);
    const [currencies, setCurrencies] = useState([]);

    // Derived Values
    const numAmount = parseFloat(amount) || 0;
    const commissionAmount = numAmount * (commissionPercent / 100);
    const totalToTransfer = numAmount + commissionAmount;

    // Load Data
    useEffect(() => {
        if (isOpen) {
            // Setup Currencies
            const activeCurr = [{ symbol: 'USD', name: 'Dólar' }, ...getActiveCurrencies()];
            setCurrencies(activeCurr);

            // Reset Fields
            setAmount('');
            setCurrency('USD');
            setDescription('');
            setCommissionPercent(10);

            // Check Balance
            fetchAvailableBalance('USD');
        }
    }, [isOpen]);

    const fetchAvailableBalance = async (curr) => {
        try {
            const response = await apiClient.get('/cash/balance', { params: { currency: curr } });
            setAvailableBalance(response.data.available);
        } catch (error) {
            console.error("Balance Check Failed", error);
        }
    };

    // Update balance when currency changes
    const handleCurrencyChange = (e) => {
        const newCurr = e.target.value;
        setCurrency(newCurr);
        fetchAvailableBalance(newCurr);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (numAmount > availableBalance) {
            toast.error("Fondos insuficientes en caja");
            return;
        }

        if (description.length < 5) {
            toast.error("La descripción es obligatoria (min 5 chars)");
            return;
        }

        setLoading(true);
        try {
            // 1. Create CASH_ADVANCE Movement (Out from Cash Drawer)
            const movementData = {
                type: 'CASH_ADVANCE',
                amount: numAmount,
                currency: currency,
                description: `Avance Efectivo - ${description} (Comisión ${commissionPercent}%)`
            };

            await apiClient.post('/cash/movements', movementData);

            // NOTE: Ideally we should also register the Commission Income here 
            // but for now we focus on the Cash Movement as requested.
            // Future requirement: Register Service Sale for the commission?

            toast.success("Avance registrado exitosamente");
            onSuccess && onSuccess();
            onClose();
        } catch (err) {
            console.error("Cash Advance Error", err);
            toast.error(err.response?.data?.detail || "Error al procesar avance");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 backdrop-blur-md">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="bg-slate-900 text-white p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <DollarSign size={100} />
                    </div>
                    <div className="flex justify-between items-center relative z-10">
                        <div>
                            <h3 className="font-black text-2xl tracking-tight">Avance de Efectivo</h3>
                            <p className="text-slate-400 text-sm font-medium mt-1">Retiro de caja con comisión</p>
                        </div>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-all">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">

                    {/* Currency & Amount Grid */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Moneda</label>
                            <select
                                value={currency}
                                onChange={handleCurrencyChange}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3.5"
                            >
                                {currencies.map(c => (
                                    <option key={c.symbol} value={c.symbol}>{c.name} ({c.symbol})</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                                Monto que el Cliente RECIBE (Efectivo)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-3.5 text-slate-400 font-bold">{currency === 'USD' ? '$' : currency}</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 font-black text-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    autoFocus
                                    required
                                />
                            </div>
                            <div className="flex justify-end">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${availableBalance < numAmount ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                    Disponible: {formatCurrency(availableBalance, currency)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Commission Configuration */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                <Calculator size={14} />
                                % Comisión
                            </label>
                            <div className="flex items-center bg-white rounded-lg border border-slate-200 px-2">
                                <input
                                    type="number"
                                    className="w-12 py-1 text-center font-bold text-slate-700 border-none focus:ring-0 text-sm"
                                    value={commissionPercent}
                                    onChange={e => setCommissionPercent(parseFloat(e.target.value) || 0)}
                                />
                                <span className="text-slate-400 font-bold text-sm pr-1">%</span>
                            </div>
                        </div>

                        {/* Calculation Preview */}
                        <div className="space-y-2 pt-2 border-t border-dashed border-slate-200">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500 font-medium">Monto Efectivo (Cliente recibe):</span>
                                <span className="font-bold text-slate-700">{formatCurrency(numAmount, currency)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500 font-medium">Comisión Negocio ({commissionPercent}%):</span>
                                <span className="font-bold text-emerald-600">+{formatCurrency(commissionAmount, currency)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-slate-800 font-bold">Total a Cobrar/Transferir:</span>
                                <span className="font-black text-xl text-indigo-600">{formatCurrency(totalToTransfer, currency)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Referencia / Banco</label>
                        <textarea
                            className="w-full p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-medium resize-none transition-all placeholder:text-slate-300"
                            rows="2"
                            placeholder="Ej: Pago Móvil Banesco - Ref 123456"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        ></textarea>
                        <p className="text-[10px] text-slate-400 text-right">* Mínimo 5 caracteres</p>
                    </div>

                    {/* Action Button */}
                    <button
                        type="submit"
                        disabled={loading || numAmount <= 0 || numAmount > availableBalance}
                        className={`w-full py-4 rounded-xl font-bold text-lg shadow-xl shadow-indigo-100 transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2 ${loading || numAmount <= 0 || numAmount > availableBalance
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            }`}
                    >
                        {loading ? 'Procesando...' : (
                            <>
                                <RefreshCw size={20} />
                                Registrar Transacción
                            </>
                        )}
                    </button>

                </form>
            </div>
        </div>
    );
};

export default CashAdvanceModal;
