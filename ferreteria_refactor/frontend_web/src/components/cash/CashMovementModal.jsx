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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                    <h3 className="font-bold text-gray-800 text-lg">Registrar Movimiento de Caja</h3>
                    <button onClick={onClose}><X size={20} className="text-gray-500 hover:text-gray-700" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Type Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Movimiento</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setType('OUT')}
                                className={`py-3 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center ${type === 'OUT'
                                    ? 'bg-red-50 border-red-500 text-red-700'
                                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                                    }`}
                            >
                                <TrendingDown size={18} className="mr-2" />
                                Salida / Avance de Efectivo
                            </button>
                            <button
                                type="button"
                                onClick={() => setType('IN')}
                                className={`py-3 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center ${type === 'IN'
                                    ? 'bg-green-50 border-green-500 text-green-700'
                                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                                    }`}
                            >
                                <TrendingUp size={18} className="mr-2" />
                                Entrada (Depósito)
                            </button>
                        </div>
                    </div>

                    {/* Currency Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
                        <select
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Monto ({currency})
                        </label>
                        <div className="relative">
                            <DollarSign size={16} className="absolute left-3 top-3 text-gray-400" />
                            <input
                                type="number"
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="0.00"
                                required
                            />
                        </div>
                        {/* Balance Display */}
                        {type === 'OUT' && (
                            <div className="mt-1 text-xs">
                                {loadingBalance ? (
                                    <span className="text-gray-400">Verificando saldo...</span>
                                ) : (
                                    <span className={`${availableBalance < parseFloat(amount || 0) ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                                        Disponible en Caja: {currency} {availableBalance.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            rows="3"
                            placeholder={type === 'OUT' ? 'Ej: Pago de almuerzo, compra de suministros...' : 'Ej: Depósito adicional, ingreso extra...'}
                            required
                        ></textarea>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                    >
                        {loading ? 'Guardando...' : 'Guardar Movimiento'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CashMovementModal;
