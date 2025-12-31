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
        <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in duration-300">
                <div className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <Lock size={40} className="text-rose-500" />
                </div>

                <h2 className="text-2xl font-black text-slate-800 mb-2 text-center tracking-tight">Caja Cerrada</h2>
                <p className="text-slate-500 mb-8 text-center px-4 leading-relaxed">
                    Para comenzar a vender, ingresa el dinero inicial disponible en caja para cada moneda.
                </p>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        {currencies.map(curr => (
                            <div key={curr.symbol}>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 pl-1">
                                    {curr.name} ({curr.symbol})
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <DollarSign className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                    </div>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full pl-10 p-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold text-lg text-slate-800 placeholder:text-slate-300"
                                        placeholder="0.00"
                                        value={amounts[curr.symbol]}
                                        onChange={(e) => setAmounts({ ...amounts, [curr.symbol]: e.target.value })}
                                        autoFocus={curr.symbol === 'USD'}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col gap-3 pt-4">
                        <button
                            type="submit"
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-indigo-200 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                        >
                            Abrir Turno
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/')}
                            className="w-full bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 font-bold py-4 px-6 rounded-xl transition-colors border-2 border-transparent hover:border-slate-100"
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
