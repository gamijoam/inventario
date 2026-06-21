import { useState, useEffect, useMemo } from 'react';
import { useCash } from '../../context/CashContext';
import { useConfig } from '../../context/ConfigContext';
import { Banknote, ClipboardCheck, Coins, Printer, ShieldCheck, Wallet, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Button } from '../ui/button';

const formatCurrencyValue = (value) => {
    const numeric = Number(value) || 0;
    return numeric.toLocaleString('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const normalizeSymbol = (symbol) => String(symbol || '').trim();

const CashClosingModal = ({ isOpen, onClose }) => {
    const { closeSession, session, activeRegister } = useCash();
    const { getActiveCurrencies } = useConfig();
    const [counts, setCounts] = useState({});
    const [currencies, setCurrencies] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [observations, setObservations] = useState('');

    useEffect(() => {
        if (!isOpen) return;

        const rawCurrencies = [
            { symbol: 'USD', name: 'Dolar' },
            ...getActiveCurrencies(),
        ];

        const uniqueSymbols = new Set();
        const uniqueCurrencies = [];

        rawCurrencies.forEach((currency) => {
            const symbol = normalizeSymbol(currency.symbol || currency.currency_symbol);
            if (!symbol || uniqueSymbols.has(symbol)) return;
            uniqueSymbols.add(symbol);
            uniqueCurrencies.push({
                ...currency,
                symbol,
                name: currency.name || currency.currency_name || symbol,
            });
        });

        setCurrencies(uniqueCurrencies);
        setCounts(Object.fromEntries(uniqueCurrencies.map((currency) => [currency.symbol, ''])));
        setObservations('');
    }, [isOpen, getActiveCurrencies]);

    const declaredCurrencies = useMemo(() => {
        return currencies.map((currency) => ({
            ...currency,
            value: Number.parseFloat(counts[currency.symbol]) || 0,
        }));
    }, [currencies, counts]);

    const getReportedAmount = (...symbols) => {
        const normalized = symbols.map((symbol) => normalizeSymbol(symbol).toLowerCase());
        const match = Object.entries(counts).find(([symbol]) => normalized.includes(normalizeSymbol(symbol).toLowerCase()));
        return Number.parseFloat(match?.[1]) || 0;
    };

    const handleCountChange = (symbol, value) => {
        setCounts((current) => ({
            ...current,
            [symbol]: value,
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!window.confirm('Confirma que el conteo fisico ya fue revisado. Al cerrar la caja no podras modificar este arqueo.')) return;

        setIsSubmitting(true);
        const closingData = {
            final_cash_reported: getReportedAmount('USD', '$'),
            final_cash_reported_bs: getReportedAmount('Bs', 'VES', 'Bs.'),
            currencies: currencies.map((currency) => ({
                currency_symbol: currency.symbol,
                final_reported: Number.parseFloat(counts[currency.symbol]) || 0,
            })),
            notes: observations,
        };

        const success = await closeSession(closingData);
        if (success) {
            toast.success('Caja cerrada. El reporte quedo disponible para auditoria.');
            onClose();
        }
        setIsSubmitting(false);
    };

    if (!isOpen) return null;

    const registerName = activeRegister?.name || session?.register?.name || session?.cash_register_name || 'Caja activa';
    const openedBy = session?.opened_by || session?.user_name || session?.cashier_name || 'Turno actual';

    return (
        <div id="tour-cash-closing-modal" className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[94vh] border border-slate-200">
                <div className="flex items-center justify-between px-6 lg:px-8 py-5 border-b border-slate-100 bg-white">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="h-12 w-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
                            <Wallet size={24} strokeWidth={1.8} />
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-xl font-bold text-slate-950 tracking-tight">Cierre ciego de caja</h2>
                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
                                    <ShieldCheck size={13} /> Sin monto esperado
                                </span>
                            </div>
                            <p className="text-sm font-medium text-slate-500 truncate">{registerName} · {openedBy}</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-10 w-10 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                        <X size={20} />
                    </Button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto bg-slate-50/70">
                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5 p-5 lg:p-6">
                        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                                <div>
                                    <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                                        <Banknote size={19} className="text-indigo-600" /> Conteo declarado
                                    </h3>
                                    <p className="text-sm text-slate-500 mt-1">Ingresa el efectivo fisico contado por moneda.</p>
                                </div>
                            </div>

                            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                                {declaredCurrencies.map((currency) => (
                                    <label key={currency.symbol} className="group block rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-indigo-300 hover:shadow-sm focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10">
                                        <div className="flex items-center justify-between gap-3 mb-3">
                                            <div className="min-w-0">
                                                <div className="text-xs font-black uppercase tracking-widest text-slate-400">{currency.symbol}</div>
                                                <div className="font-bold text-slate-900 truncate">{currency.name}</div>
                                            </div>
                                            <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 font-black">
                                                {currency.symbol === 'USD' ? '$' : currency.symbol.slice(0, 2)}
                                            </div>
                                        </div>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 font-black pointer-events-none">
                                                {currency.symbol === 'USD' ? '$' : currency.symbol}
                                            </span>
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                min="0"
                                                step="0.01"
                                                value={counts[currency.symbol] || ''}
                                                onChange={(event) => handleCountChange(currency.symbol, event.target.value)}
                                                className="w-full h-12 pl-14 pr-4 bg-white rounded-xl border-2 border-slate-200 font-mono text-xl font-black outline-none transition-all text-slate-950 focus:border-indigo-500 placeholder:text-slate-300"
                                                placeholder="0.00"
                                                aria-label={`Monto contado en ${currency.name}`}
                                            />
                                        </div>
                                    </label>
                                ))}
                            </div>

                            <div className="px-5 pb-5">
                                <label className="block rounded-2xl border border-slate-200 bg-white p-4 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10">
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-500">Observaciones del cierre</span>
                                    <textarea
                                        className="mt-3 w-full h-24 border-0 p-0 text-sm text-slate-900 outline-none resize-none placeholder:text-slate-300"
                                        placeholder="Notas del cajero, billetes apartados, pagos pendientes por revisar..."
                                        value={observations}
                                        onChange={(event) => setObservations(event.target.value)}
                                    />
                                </label>
                            </div>
                        </section>

                        <aside className="space-y-4">
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                        <ClipboardCheck size={19} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-black text-slate-950">Resumen declarado</div>
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sin comparativo previo</div>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {declaredCurrencies.map((currency) => (
                                        <div key={currency.symbol} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 border border-slate-100">
                                            <span className="text-sm font-bold text-slate-600">{currency.symbol}</span>
                                            <span className="font-mono font-black text-slate-950">{formatCurrencyValue(currency.value)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm">
                                <div className="flex items-start gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                                        <Coins size={19} />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-sm font-black text-slate-950">Antes de confirmar</div>
                                        <p className="text-sm leading-6 text-slate-600">Cuenta el cajon completo, incluyendo el fondo inicial. El sistema calculara diferencias despues del cierre para gerencia y auditoria.</p>
                                    </div>
                                </div>
                            </div>
                        </aside>
                    </div>
                </form>

                <div className="p-5 lg:px-6 border-t border-slate-100 bg-white flex flex-col-reverse sm:flex-row justify-between gap-3 items-stretch sm:items-center z-10 shadow-[0_-4px_6px_-1px_rgba(15,23,42,0.03)]">
                    <div className="text-xs text-slate-400 flex items-center gap-2">
                        <Printer size={14} />
                        El Reporte Z se emitira al cerrar la caja.
                    </div>
                    <div className="flex gap-3">
                        <Button
                            type="button"
                            variant="ghost"
                            size="lg"
                            onClick={onClose}
                            className="flex-1 sm:flex-none text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-bold"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            size="lg"
                            className="flex-1 sm:flex-none h-12 px-8 font-bold shadow-lg flex items-center gap-2 transition-all text-white bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Cerrando...' : (
                                <>
                                    <Printer size={18} />
                                    Cerrar caja
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CashClosingModal;
