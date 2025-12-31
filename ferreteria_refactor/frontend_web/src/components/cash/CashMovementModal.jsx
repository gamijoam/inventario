import { useState, useEffect } from 'react';
import { X, DollarSign, TrendingDown, TrendingUp } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';
import apiClient from '../../config/axios';

const CashMovementModal = ({ isOpen, onClose, onSuccess }) => {
    const { getActiveCurrencies } = useConfig();
    const [type, setType] = useState('OUT'); // OUT (expense/withdrawal) or IN (deposit)
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState('USD');
    const [description, setDescription] = useState('');
    const [currencies, setCurrencies] = useState([]);
    const [loading, setLoading] = useState(false);

    const [availableBalance, setAvailableBalance] = useState(0);
    const [loadingBalance, setLoadingBalance] = useState(false);

    // Fetch balance when currency changes
    useEffect(() => {
        if (isOpen) {
            fetchAvailableBalance();
        }
    }, [isOpen, currency]);

    const fetchAvailableBalance = async () => {
        setLoadingBalance(true);
        try {
            const response = await apiClient.get('/cash/balance', { params: { currency } });
            setAvailableBalance(response.data.available);
        } catch (error) {
            console.error("Error fetching balance:", error);
        } finally {
            setLoadingBalance(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            // Get active currencies including USD base
            const activeCurr = [
                { symbol: 'USD', name: 'Dólar' },
                ...getActiveCurrencies()
            ];
            setCurrencies(activeCurr);

            // Reset form
            setAmount('');
            setDescription('');
            setCurrency('USD');
            setType('OUT');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const movementData = {
                type: type,
                amount: parseFloat(amount),
                currency: currency,
                description: description
            };

            await apiClient.post('/cash/movements', movementData);

            alert("Movimiento Registrado Exitosamente");
            onSuccess && onSuccess();
            onClose();
        } catch (err) {
            console.error('Error registering movement:', err);
            alert('Error al registrar movimiento: ' + (err.response?.data?.detail || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center p-5 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800 text-lg">Movimiento de Caja</h3>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Type Selection */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 pl-1">Tipo de Movimiento</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setType('OUT')}
                                className={`py-3 rounded-xl border-2 text-sm font-bold transition-all flex flex-col items-center justify-center gap-1 ${type === 'OUT'
                                    ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-sm'
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                            >
                                <TrendingDown size={20} />
                                Salida / Retiro
                            </button>
                            <button
                                type="button"
                                onClick={() => setType('IN')}
                                className={`py-3 rounded-xl border-2 text-sm font-bold transition-all flex flex-col items-center justify-center gap-1 ${type === 'IN'
                                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm'
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                            >
                                <TrendingUp size={20} />
                                Entrada / Depósito
                            </button>
                        </div>
                    </div>

                    {/* Currency Selection */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 pl-1">Moneda</label>
                        <select
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700 font-medium"
                        >
                            {currencies.map(curr => (
                                <option key={curr.symbol} value={curr.symbol}>
                                    {curr.name} ({curr.symbol})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Amount */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 pl-1">
                            Monto ({currency})
                        </label>
                        <div className="relative">
                            <DollarSign size={18} className="absolute left-3 top-3.5 text-slate-400" />
                            <input
                                type="number"
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full pl-10 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-lg font-bold text-slate-800 placeholder:text-slate-300"
                                placeholder="0.00"
                                required
                            />
                        </div>
                        {/* Balance Display */}
                        {type === 'OUT' && (
                            <div className="mt-2 text-xs flex justify-end">
                                {loadingBalance ? (
                                    <span className="text-slate-400 animate-pulse">Verificando saldo...</span>
                                ) : (
                                    <span className={`px-2 py-0.5 rounded font-medium ${availableBalance < parseFloat(amount || 0) ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                                        Disponible: {currency} {availableBalance.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 pl-1">Descripción</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm text-slate-700 placeholder:text-slate-300 resize-none"
                            rows="3"
                            placeholder={type === 'OUT' ? 'Ej: Pago de almuerzo, compra de suministros...' : 'Ej: Depósito adicional, ingreso extra...'}
                            required
                        ></textarea>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading || (type === 'OUT' && parseFloat(amount) > availableBalance)}
                            className={`w-full font-bold py-4 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 ${loading || (type === 'OUT' && parseFloat(amount) > availableBalance)
                                ? 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none'
                                : type === 'OUT'
                                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
                                }`}
                        >
                            {loading ? 'Procesando...' : (
                                <>
                                    {type === 'OUT' ? <TrendingDown size={20} /> : <TrendingUp size={20} />}
                                    Confirmar {type === 'OUT' ? 'Retiro' : 'Ingreso'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CashMovementModal;
