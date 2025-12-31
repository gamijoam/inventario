import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, DollarSign } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';

const CashOpeningModal = ({ onOpen }) => {
    const navigate = useNavigate();
    const { getActiveCurrencies } = useConfig();
    const [amounts, setAmounts] = useState({});
    const [currencies, setCurrencies] = useState([]);

    useEffect(() => {
        // Get active currencies including USD base
        const rawCurrencies = [
            { symbol: 'USD', name: 'Dólar' },
            ...getActiveCurrencies()
        ];

        // DEDUPLICATION LOGIC:
        // Group by symbol (e.g. "Bs"). If multiple rates exist for "Bs", we only want ONE input field.
        const uniqueSymbols = new Set();
        const uniqueCurrencies = [];

        rawCurrencies.forEach(c => {
            // Normalize symbol
            const sym = (c.symbol || c.currency_symbol || '').trim();
            if (sym && !uniqueSymbols.has(sym)) {
                uniqueSymbols.add(sym);
                uniqueCurrencies.push({
                    ...c,
                    symbol: sym, // Ensure consistent property
                    name: c.name
                });
            }
        });

        setCurrencies(uniqueCurrencies);

        // Initialize amounts to 0
        const initialAmounts = {};
        uniqueCurrencies.forEach(curr => {
            initialAmounts[curr.symbol] = '';
        });
        setAmounts(initialAmounts);
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();

        // Prepare data for backend
        const currencyData = currencies.map(curr => ({
            currency_symbol: curr.symbol,
            initial_amount: parseFloat(amounts[curr.symbol]) || 0
        }));

        onOpen({
            initial_cash: parseFloat(amounts['USD']) || 0,
            initial_cash_bs: parseFloat(amounts['Bs']) || 0,
            currencies: currencyData
        });
    };

    return (
        <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Lock size={40} className="text-red-500" />
                </div>

                <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Caja Cerrada</h2>
                <p className="text-gray-500 mb-6 text-center">Ingresa el dinero inicial para cada moneda</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {currencies.map(curr => (
                        <div key={curr.symbol}>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                {curr.name} ({curr.symbol})
                            </label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-3 text-gray-400" size={20} />
                                <input
                                    type="number"
                                    step="0.01"
                                    className="w-full pl-10 p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 outline-none"
                                    placeholder="0.00"
                                    value={amounts[curr.symbol]}
                                    onChange={(e) => setAmounts({ ...amounts, [curr.symbol]: e.target.value })}
                                />
                            </div>
                        </div>
                    ))}

                    <div className="flex flex-col gap-3 mt-6">
                        <button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow transition-colors"
                        >
                            Abrir Turno
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/')}
                            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 px-4 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CashOpeningModal;
