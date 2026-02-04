import { useState, useEffect, useMemo } from 'react';
import { useCash } from '../../context/CashContext';
import { useConfig } from '../../context/ConfigContext';
import { AlertTriangle, CheckCircle, TrendingUp, Calculator, X, Printer, Banknote, CreditCard, Coins, ArrowRight, Wallet } from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient from '../../config/axios';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';

const CashClosingModal = ({ isOpen, onClose }) => {
    const { closeSession, session } = useCash();
    const { getActiveCurrencies } = useConfig();
    const [counts, setCounts] = useState({});
    const [currencies, setCurrencies] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [observations, setObservations] = useState('');

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
            setObservations('');
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
            toast.error("Error obteniendo detalles del sistema");
        } finally {
            setLoadingDetails(false);
        }
    };

    const auditData = useMemo(() => {
        if (!sessionDetails) return [];

        return currencies.map(curr => {
            const expected = parseFloat(sessionDetails.expected_by_currency?.[curr.symbol] || 0);
            const reported = parseFloat(counts[curr.symbol]) || 0;
            const diff = reported - expected;

            // Color Logic (Clean & Vivid):
            // Match (Green)
            // Missing (Red)
            // Surplus (Blue)
            const diffColor = Math.abs(diff) < 0.01
                ? 'text-emerald-700 bg-white border-emerald-500 ring-1 ring-emerald-500'
                : diff < 0
                    ? 'text-rose-700 bg-white border-rose-500 ring-1 ring-rose-500'
                    : 'text-blue-700 bg-white border-blue-500 ring-1 ring-blue-500';

            return {
                ...curr,
                expected,
                reported,
                diff,
                diffColor,
                isMatch: Math.abs(diff) < 0.01,
                hasValue: counts[curr.symbol] !== ''
            };
        });
    }, [currencies, counts, sessionDetails]);

    const isBalanced = auditData.every(d => d.isMatch);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!window.confirm("¿Está seguro de cerrar la caja? Esta acción no se puede deshacer.")) return;

        setIsSubmitting(true);
        const closingData = {
            final_cash_reported: parseFloat(counts['USD']) || 0,
            final_cash_reported_bs: parseFloat(counts['Bs']) || 0,
            currencies: currencies.map(c => ({
                currency_symbol: c.symbol,
                final_reported: parseFloat(counts[c.symbol]) || 0
            })),
            notes: observations
        };

        const success = await closeSession(closingData);
        if (success) {
            toast.success("Caja cerrada y reporte enviado");
            onClose();
        }
        setIsSubmitting(false);
    };

    if (!isOpen) return null;

    // Destructure Details for Right Panel
    const details = sessionDetails?.details || {};
    const {
        expenses_usd = 0, expenses_bs = 0,
        cash_advances_usd = 0, cash_advances_bs = 0,
        transfers_by_currency = {},
        sales_total = 0
    } = details;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[95vh] border border-slate-200 dark:border-slate-800">

                {/* Header - PURE WHITE */}
                <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 dark:border-slate-800 bg-white">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-white text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100 shadow-sm">
                            <Wallet size={24} strokeWidth={1.5} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">Cierre de Turno</h2>
                            <p className="text-sm font-medium text-slate-500">Arqueo de Caja y Verificación de Ventas</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-10 w-10 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                        <X size={20} />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto bg-white">
                    <div className="grid grid-cols-1 lg:grid-cols-12 min-h-full divide-x divide-slate-100">

                        {/* LEFT COLUMN: AUDIT (7 cols) - PURE WHITE */}
                        <div className="lg:col-span-7 p-6 lg:p-8 space-y-8 bg-white">

                            {/* Summary Status Header - SOLID COLORS for Contrast */}
                            <div className={`p-5 rounded-2xl border flex items-center justify-between transition-colors ${isBalanced ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-full shadow-sm bg-white ${isBalanced ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {isBalanced ? <CheckCircle size={28} strokeWidth={2.5} /> : <AlertTriangle size={28} strokeWidth={2.5} />}
                                    </div>
                                    <div>
                                        <div className={`text-lg font-black tracking-tight leading-none ${isBalanced ? 'text-emerald-900' : 'text-rose-900'}`}>
                                            {isBalanced ? 'CAJA CUADRADA' : 'DESCUADRE DETECTADO'}
                                        </div>
                                        <div className={`text-sm font-bold mt-1 ${isBalanced ? 'text-emerald-700' : 'text-rose-700'}`}>
                                            {isBalanced ? 'Todo coincide perfectamente' : 'Diferencia en conteo de caja'}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right pl-4 border-l border-slate-200/50">
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Ventas Totales</div>
                                    <div className="text-2xl font-mono font-bold text-slate-900 tracking-tight">${Number(sales_total).toFixed(2)}</div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <Banknote size={16} /> Arqueo de Efectivo
                                </h3>

                                {loadingDetails ? (
                                    <div className="py-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
                                ) : (
                                    <div className="space-y-4">
                                        {auditData.map((data) => (
                                            <div key={data.symbol} className="group relative bg-white border border-slate-200 rounded-2xl transition-all hover:border-indigo-300 hover:shadow-md p-1">
                                                <div className="p-4 flex items-start justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center font-bold text-slate-700 text-lg border border-slate-100">
                                                            {data.symbol}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-900 text-lg">{data.name}</div>
                                                            <div className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md inline-block mt-1">
                                                                Esperado: <span className="font-mono text-slate-900">{data.symbol === 'USD' ? '$' : 'Bs'} {Number(data.expected).toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Badge Diff */}
                                                    {data.hasValue && (
                                                        <div className={`px-4 py-2 rounded-xl border font-bold text-sm flex items-center gap-2 shadow-sm ${data.diffColor}`}>
                                                            {data.isMatch ? 'Exacto' : (data.diff > 0 ? `+${Number(data.diff).toFixed(2)}` : Number(data.diff).toFixed(2))}
                                                            {data.isMatch ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="bg-white p-4 rounded-b-2xl border-t border-slate-100 flex items-center gap-3">
                                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                                        Contado:
                                                    </label>
                                                    <div className="relative flex-1">
                                                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 font-bold pointer-events-none">
                                                            {data.symbol === 'USD' ? '$' : 'Bs'}
                                                        </span>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={counts[data.symbol] || ''}
                                                            onChange={(e) => setCounts({ ...counts, [data.symbol]: e.target.value })}
                                                            className={`w-full h-11 pl-10 pr-4 bg-white rounded-lg border-2 font-mono text-lg font-bold outline-none transition-all shadow-sm text-slate-900 ${!data.hasValue ? 'border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10' :
                                                                    data.isMatch ? 'border-emerald-300 text-emerald-700' : 'border-rose-300 text-rose-700'
                                                                }`}
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3 pt-4">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Observaciones</label>
                                <div className="relative">
                                    <textarea
                                        className="w-full h-24 p-4 bg-white border border-slate-200 rounded-xl text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none resize-none placeholder:text-slate-300 text-slate-900 shadow-sm"
                                        placeholder="Indique motivo de descuadre o notas del turno..."
                                        value={observations}
                                        onChange={(e) => setObservations(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: DETAILS - PURE WHITE (Removed bg-slate-50) */}
                        <div className="lg:col-span-5 p-6 lg:p-8 space-y-8 bg-white">

                            {/* NON-CASH SUMMARY */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <CreditCard size={16} /> Pagos Digitales
                                    </h3>
                                    <span className="text-[10px] bg-blue-50 text-blue-700 font-black px-2 py-1 rounded-md border border-blue-200">AUTO-VERIFICADO</span>
                                </div>

                                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                                    {Object.keys(transfers_by_currency).length === 0 ? (
                                        <div className="p-8 text-center text-slate-400 italic text-sm">No hubo pagos digitales en este turno.</div>
                                    ) : (
                                        <div className="divide-y divide-slate-100">
                                            {Object.entries(transfers_by_currency).map(([currency, methods]) => (
                                                <div key={currency} className="p-4 hover:bg-slate-50 transition-colors">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <div className="w-1.5 h-6 rounded-full bg-indigo-500"></div>
                                                        <div className="text-xs font-black text-slate-600 uppercase tracking-wider">{currency}</div>
                                                    </div>
                                                    <div className="space-y-2 pl-3.5">
                                                        {Object.entries(methods).map(([method, amount]) => (
                                                            <div key={method} className="flex items-center justify-between group">
                                                                <span className="text-sm font-medium text-slate-600 group-hover:text-indigo-600 transition-colors">{method}</span>
                                                                <span className="text-sm font-bold font-mono text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">{Number(amount).toFixed(2)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* MOVEMENTS SUMMARY */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <TrendingUp size={16} /> Salidas de Caja
                                </h3>

                                <div className="grid gap-4">
                                    {/* Gastos */}
                                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-slate-300 transition-all flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-slate-50 rounded-lg text-slate-400 group-hover:text-amber-600 group-hover:bg-amber-50 transition-colors">
                                                <Coins size={20} />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-800">Gastos Operativos</div>
                                                <div className="text-xs text-slate-500">Pagos a proveedores</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-mono font-bold text-rose-600">-${Number(expenses_usd).toFixed(2)}</div>
                                            <div className="text-xs font-mono text-slate-500">Bs {Number(expenses_bs).toFixed(2)}</div>
                                        </div>
                                    </div>

                                    {/* Avances */}
                                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-slate-300 transition-all flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-slate-50 rounded-lg text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                                                <ArrowRight size={20} />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-800">Avances</div>
                                                <div className="text-xs text-slate-500">Retiros de efectivo</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-mono font-bold text-rose-600">-${Number(cash_advances_usd).toFixed(2)}</div>
                                            <div className="text-xs font-mono text-slate-500">Bs {Number(cash_advances_bs).toFixed(2)}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-slate-100 bg-white flex justify-between items-center z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
                    <div className="text-xs text-slate-400 hidden lg:flex items-center gap-2">
                        <Printer size={14} />
                        <strong>Nota:</strong> Al cerrar, se generará el Reporte Z automáticamente.
                    </div>
                    <div className="flex gap-3 w-full lg:w-auto">
                        <Button
                            variant="ghost"
                            size="lg"
                            onClick={onClose}
                            className="flex-1 lg:flex-none text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-bold"
                        >
                            Cancelar
                        </Button>
                        <Button
                            size="lg"
                            className={`flex-1 lg:flex-none h-12 px-8 font-bold shadow-lg flex items-center gap-2 transition-all text-white ${isBalanced ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'}`}
                            onClick={handleSubmit}
                            disabled={isSubmitting || loadingDetails}
                        >
                            {isSubmitting ? 'Procesando...' : (
                                <>
                                    <Printer size={18} />
                                    Confirmar Cierre
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
