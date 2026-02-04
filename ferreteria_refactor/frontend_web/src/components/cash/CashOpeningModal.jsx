import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Vault, ArrowRight, X } from 'lucide-react'; // Changed Lock to Vault
import { useConfig } from '../../context/ConfigContext';
import { Button } from '../ui/button'; // Assuming Button exists
// import { Input } from '../ui/input'; // Not using standard input as requested

const CashOpeningModal = ({ onOpen }) => {
    const navigate = useNavigate();
    const { getActiveCurrencies } = useConfig();
    const [amounts, setAmounts] = useState({});
    const [currencies, setCurrencies] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        // Get active currencies including USD base
        const rawCurrencies = [
            { symbol: 'USD', name: 'Dólar Americano' }, // More formal name
            ...getActiveCurrencies()
        ];

        // DEDUPLICATION LOGIC:
        const uniqueSymbols = new Set();
        const uniqueCurrencies = [];

        rawCurrencies.forEach(c => {
            const sym = (c.symbol || c.currency_symbol || '').trim();
            if (sym && !uniqueSymbols.has(sym)) {
                uniqueSymbols.add(sym);
                uniqueCurrencies.push({
                    ...c,
                    symbol: sym,
                    name: c.name
                });
            }
        });

        setCurrencies(uniqueCurrencies);

        // Initialize amounts
        const initialAmounts = {};
        uniqueCurrencies.forEach(curr => {
            initialAmounts[curr.symbol] = '';
        });
        setAmounts(initialAmounts);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Simulate small delay for UX or just proceed
        // Prepare data for backend
        const currencyData = currencies.map(curr => ({
            currency_symbol: curr.symbol,
            initial_amount: parseFloat(amounts[curr.symbol]) || 0
        }));

        await onOpen({
            initial_cash: parseFloat(amounts['USD']) || 0,
            initial_cash_bs: parseFloat(amounts['Bs']) || 0,
            currencies: currencyData
        });
        setIsSubmitting(false);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
            {/* Dialog Content styled to match Shadcn/Revolut look */}
            <div className="bg-white dark:bg-zinc-950 rounded-xl shadow-2xl w-full sm:max-w-[425px] overflow-hidden flex flex-col border border-zinc-200 dark:border-zinc-800">

                {/* Header */}
                <div className="flex flex-col items-center pt-8 pb-4 px-6 text-center space-y-4">
                    <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shadow-sm">
                        <Vault size={32} strokeWidth={1.5} />
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                            Apertura de Turno
                        </h2>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">
                            Ingresa el monto inicial en caja para comenzar a operar.
                        </p>
                    </div>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="space-y-5">
                        {currencies.map(curr => (
                            <div key={curr.symbol} className="space-y-2">
                                <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 pl-1">
                                    {curr.name}
                                </label>

                                {/* Custom Card-Like Input */}
                                <div className="relative flex items-center group">
                                    <div className="absolute left-4 text-zinc-400 font-medium text-2xl select-none group-focus-within:text-blue-600 transition-colors">
                                        {curr.symbol === 'USD' ? '$' : curr.symbol}
                                    </div>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={amounts[curr.symbol]}
                                        onChange={(e) => setAmounts({ ...amounts, [curr.symbol]: e.target.value })}
                                        className="w-full h-16 pl-14 pr-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-3xl font-bold text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-right tabular-nums"
                                        placeholder="0.00"
                                        autoFocus={curr.symbol === 'USD'}
                                        required
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-2 space-y-3">
                        <Button
                            type="submit"
                            size="lg"
                            className="w-full h-14 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20 rounded-xl"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Abriendo...' : 'Abrir Turno'}
                            {!isSubmitting && <ArrowRight className="ml-2 h-5 w-5" />}
                        </Button>

                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => navigate('/')}
                            className="w-full text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
                        >
                            Cancelar
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CashOpeningModal;
