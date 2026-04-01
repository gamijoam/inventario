import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Vault, ArrowRight, CheckCircle2, Lock, AlertCircle } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';
import { useCash } from '../../context/CashContext';
import { Button } from '../ui/button';
import apiClient from '../../config/axios';

const CashOpeningModal = ({ onOpen }) => {
    const navigate = useNavigate();
    const { getActiveCurrencies } = useConfig();
    const { registers } = useCash();

    // Step: 'register' | 'amounts'
    const [step, setStep] = useState('register');
    const [selectedRegister, setSelectedRegister] = useState(null);
    const [registersStatus, setRegistersStatus] = useState([]);
    const [loadingRegisters, setLoadingRegisters] = useState(true);

    const [amounts, setAmounts] = useState({});
    const [currencies, setCurrencies] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Load registers status on mount
    useEffect(() => {
        const load = async () => {
            setLoadingRegisters(true);
            try {
                const res = await apiClient.get('/cash/registers/status');
                const list = Array.isArray(res.data) ? res.data : [];
                setRegistersStatus(list);
                // Auto-select if only one available register
                const available = list.filter(r => r.session_status === 'CLOSED');
                if (available.length === 1) {
                    setSelectedRegister(available[0]);
                }
            } catch (e) {
                console.error('Error loading registers:', e);
                setRegistersStatus([]);
            } finally {
                setLoadingRegisters(false);
            }
        };
        load();
    }, []);

    // Build currency list when moving to step 2
    useEffect(() => {
        if (step !== 'amounts') return;
        const rawCurrencies = [
            { symbol: 'USD', name: 'Dólar Americano' },
            ...getActiveCurrencies()
        ];
        const uniqueSymbols = new Set();
        const uniqueCurrencies = [];
        rawCurrencies.forEach(c => {
            const sym = (c.symbol || c.currency_symbol || '').trim();
            if (sym && !uniqueSymbols.has(sym)) {
                uniqueSymbols.add(sym);
                uniqueCurrencies.push({ ...c, symbol: sym });
            }
        });
        setCurrencies(uniqueCurrencies);
        const initialAmounts = {};
        uniqueCurrencies.forEach(curr => { initialAmounts[curr.symbol] = ''; });
        setAmounts(initialAmounts);
    }, [step]);

    const handleSelectRegister = (reg) => {
        if (reg.session_status === 'OPEN') return;
        setSelectedRegister(reg);
    };

    const handleContinue = () => {
        if (!selectedRegister) return;
        setStep('amounts');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const currencyData = currencies.map(curr => ({
            currency_symbol: curr.symbol,
            initial_amount: parseFloat(amounts[curr.symbol]) || 0
        }));
        await onOpen({
            initial_cash: parseFloat(amounts['USD']) || 0,
            initial_cash_bs: parseFloat(amounts['Bs']) || 0,
            currencies: currencyData,
            register_id: selectedRegister?.id || null
        });
        setIsSubmitting(false);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
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
                            {step === 'register'
                                ? 'Selecciona la caja que vas a operar.'
                                : `${selectedRegister?.name} · ${selectedRegister?.code}`
                            }
                        </p>
                    </div>
                </div>

                {/* STEP 1: Register Selector */}
                {step === 'register' && (
                    <div className="p-6 space-y-4">
                        {loadingRegisters ? (
                            <div className="space-y-2">
                                {[1, 2].map(i => (
                                    <div key={i} className="h-16 rounded-xl bg-zinc-100 animate-pulse" />
                                ))}
                            </div>
                        ) : registersStatus.length === 0 ? (
                            <div className="text-center py-6 bg-amber-50 rounded-xl border border-amber-200">
                                <AlertCircle size={24} className="text-amber-500 mx-auto mb-2" />
                                <p className="text-sm text-amber-700 font-medium">No hay cajas configuradas.</p>
                                <p className="text-xs text-amber-600 mt-1">Contacta al administrador para crear cajas.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {registersStatus.map(reg => {
                                    const isOccupied = reg.session_status === 'OPEN';
                                    const isSelected = selectedRegister?.id === reg.id;
                                    return (
                                        <button
                                            key={reg.id}
                                            type="button"
                                            disabled={isOccupied}
                                            onClick={() => handleSelectRegister(reg)}
                                            className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left
                                                ${isOccupied
                                                    ? 'border-zinc-100 bg-zinc-50 opacity-60 cursor-not-allowed'
                                                    : isSelected
                                                        ? 'border-blue-500 bg-blue-50'
                                                        : 'border-zinc-200 hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer'
                                                }`}
                                        >
                                            <div>
                                                <p className="font-semibold text-zinc-900 text-sm">{reg.name}</p>
                                                <p className="text-xs text-zinc-400">{reg.code}</p>
                                                {isOccupied && (
                                                    <p className="text-xs text-amber-600 mt-0.5">
                                                        Usada por {reg.opened_by || 'otro usuario'}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                                                {isOccupied ? (
                                                    <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded-full">
                                                        <Lock size={11} /> Ocupada
                                                    </span>
                                                ) : isSelected ? (
                                                    <CheckCircle2 size={22} className="text-blue-500" />
                                                ) : (
                                                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                                                        Libre
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div className="pt-2 space-y-3">
                            <Button
                                type="button"
                                size="lg"
                                disabled={!selectedRegister}
                                onClick={handleContinue}
                                className="w-full h-14 text-base font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 rounded-xl disabled:opacity-50"
                            >
                                Continuar <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => navigate('/')}
                                className="w-full text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-xl"
                            >
                                Cancelar
                            </Button>
                        </div>
                    </div>
                )}

                {/* STEP 2: Amounts (existing logic) */}
                {step === 'amounts' && (
                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        <div className="space-y-5">
                            {currencies.map(curr => (
                                <div key={curr.symbol} className="space-y-2">
                                    <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 pl-1">
                                        {curr.name}
                                    </label>
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

                        <div className="pt-2 space-y-3">
                            <Button
                                type="submit"
                                size="lg"
                                className="w-full h-14 text-base font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 dark:shadow-blue-900/20 rounded-xl"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Abriendo...' : 'Abrir Turno'}
                                {!isSubmitting && <ArrowRight className="ml-2 h-5 w-5" />}
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setStep('register')}
                                className="w-full text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
                            >
                                Volver
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default CashOpeningModal;
