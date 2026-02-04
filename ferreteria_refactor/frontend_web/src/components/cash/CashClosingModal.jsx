import { useState, useEffect } from 'react';
import { useCash } from '../../context/CashContext';
import { useConfig } from '../../context/ConfigContext';
import { Lock, DollarSign, X, TrendingUp, CreditCard, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient from '../../config/axios';

const CashClosingModal = ({ isOpen, onClose }) => {
    const { closeSession, session } = useCash();
    const { getActiveCurrencies } = useConfig();
    const [counts, setCounts] = useState({});
    const [currencies, setCurrencies] = useState([]);
    const [submitting, setSubmitting] = useState(false);

    // Detailed Session Data State
    const [sessionDetails, setSessionDetails] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchSessionDetails();

            // Get currencies to count
            const rawCurrencies = [
                { symbol: 'USD', name: 'Dólar' },
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

            // Reset counts
            const initialCounts = {};
            uniqueCurrencies.forEach(c => initialCounts[c.symbol] = '');
            setCounts(initialCounts);
        }
    }, [isOpen]);

    const fetchSessionDetails = async () => {
        if (!session?.id) return;
        setLoadingDetails(true);
        try {
            const response = await apiClient.get(`/cash/sessions/${session.id}/details`);
            setSessionDetails(response.data);
        } catch (error) {
            console.error("Error fetching detailed closing info:", error);
            // Non-blocking error
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        const closingData = {
            final_cash: parseFloat(counts['USD']) || 0,
            final_cash_bs: parseFloat(counts['Bs']) || 0,
        };

        const success = await closeSession(closingData);
        if (success) {
            toast.success("Caja cerrada correctamente");
            onClose();
        }
        setSubmitting(false);
    };

    if (!isOpen) return null;

    // Destructure Details
    const details = sessionDetails?.details || {};
    const {
        expenses_usd = 0, expenses_bs = 0,
        cash_advances_usd = 0, cash_advances_bs = 0,
        transfers_by_currency = {}
    } = details;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Lock className="text-rose-500" size={24} /> Cerrar Caja
                        </h3>
                        <p className="text-sm text-slate-500">Verifica montos antes de generar el Reporte Z.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-50/30">

                    {/* LEFT COLUMN: COUNTS */}
                    <div className="space-y-6">
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                            <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold border-b border-slate-100 pb-2">
                                <DollarSign className="text-emerald-500" size={20} />
                                <h2>Conteo de Efectivo (Físico)</h2>
                            </div>

                            <form id="closing-form" onSubmit={handleSubmit} className="space-y-4">
                                {currencies.map(curr => (
                                    <div key={curr.symbol}>
                                        <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 pl-1">
                                            <span>{curr.name} ({curr.symbol})</span>
                                            {sessionDetails && (
                                                <span className="text-emerald-600">Sistema: {Number(sessionDetails.expected_by_currency?.[curr.symbol] || 0).toFixed(2)}</span>
                                            )}
                                        </div>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <DollarSign className="text-slate-400 group-focus-within:text-rose-500 transition-colors" size={20} />
                                            </div>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="w-full pl-10 p-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 outline-none transition-all font-bold text-slate-800 placeholder:text-slate-300"
                                                placeholder="0.00"
                                                value={counts[curr.symbol]}
                                                onChange={(e) => setCounts({ ...counts, [curr.symbol]: e.target.value })}
                                                autoFocus={curr.symbol === 'USD'}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </form>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: DETAILS */}
                    <div className="space-y-6">
                        {loadingDetails ? (
                            <div className="flex items-center justify-center h-40">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                            </div>
                        ) : (
                            <>
                                {/* MOVIMIENTOS */}
                                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold border-b border-slate-100 pb-2">
                                        <TrendingUp className="text-rose-500" size={20} />
                                        <h2>Movimientos (Salidas)</h2>
                                    </div>

                                    <div className="space-y-3">
                                        {/* Advances */}
                                        <div className="bg-rose-50/50 border border-rose-100 rounded-lg p-3">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-bold text-rose-800 uppercase">Avances de Efectivo</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">USD</span>
                                                    <span className="font-bold text-slate-800">${Number(cash_advances_usd).toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Bs</span>
                                                    <span className="font-bold text-slate-800">Bs {Number(cash_advances_bs).toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expenses */}
                                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-bold text-slate-600 uppercase">Gastos Operativos</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">USD</span>
                                                    <span className="font-bold text-slate-800">${Number(expenses_usd).toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Bs</span>
                                                    <span className="font-bold text-slate-800">Bs {Number(expenses_bs).toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* TRANSFERENCIAS */}
                                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold border-b border-slate-100 pb-2">
                                        <CreditCard className="text-blue-500" size={20} />
                                        <h2>Transferencias (Informativo)</h2>
                                    </div>

                                    <div className="space-y-3">
                                        {Object.keys(transfers_by_currency).length === 0 ? (
                                            <p className="text-slate-400 text-sm italic text-center py-2">No hay transferencias registradas</p>
                                        ) : (
                                            Object.entries(transfers_by_currency).map(([currency, methods]) => (
                                                <div key={currency} className="border-l-4 border-blue-400 pl-3 bg-blue-50/30 py-2 rounded-r-lg">
                                                    <div className="font-bold text-slate-700 text-xs mb-1 uppercase">{currency}</div>
                                                    {Object.entries(methods).map(([method, amount]) => (
                                                        <div key={method} className="flex justify-between text-sm mb-1 last:mb-0">
                                                            <span className="text-slate-600">{method}</span>
                                                            <span className="font-bold text-slate-800">{Number(amount).toFixed(2)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="p-5 border-t border-slate-100 bg-white flex gap-3 justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="closing-form"
                        disabled={submitting}
                        className="px-6 py-3 bg-rose-600 text-white font-bold rounded-xl shadow-lg shadow-rose-200 hover:bg-rose-700 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
                    >
                        {submitting ? 'Cerrando...' : 'Confirmar Cierre'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CashClosingModal;
