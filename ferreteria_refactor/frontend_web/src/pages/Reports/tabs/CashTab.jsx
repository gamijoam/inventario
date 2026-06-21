import { useState, useEffect, useCallback } from 'react';
import {
    TrendingUp, TrendingDown, AlertTriangle, DollarSign, Clock,
    User, CheckCircle, ChevronDown, Download, Printer, FileText, ShieldCheck
} from 'lucide-react';
import cashService from '../../../services/cashService';
import reportService from '../../../services/reportService';
import printerService from '../../../services/printerService';
import { useConfig } from '../../../context/ConfigContext';
import { toast } from 'react-hot-toast';
import { getApiErrorMessage } from '../../../utils/apiErrors';
import { pdf } from '@react-pdf/renderer';
import CashAuditReportPDF from '../../../components/pdf/CashAuditReportPDF';
import CashAuditModal from '../../../components/cash/CashAuditModal';
import apiClient from '../../../config/axios';
import clsx from 'clsx';

// ============================================================
// CashTab - Migrated from CashHistory.jsx
// ============================================================
const CashTab = ({ dateRange }) => {
    const { formatCurrency, business } = useConfig();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [expandedId, setExpandedId] = useState(null);
    const [downloading, setDownloading] = useState(false);
    const [auditSession, setAuditSession] = useState(null);

    // Local date state synced from parent dateRange
    const [startDate, setStartDate] = useState(dateRange?.start || '');
    const [endDate, setEndDate] = useState(dateRange?.end || '');

    // Sync local dates when parent dateRange changes
    useEffect(() => {
        if (dateRange?.start) setStartDate(dateRange.start);
        if (dateRange?.end) setEndDate(dateRange.end);
    }, [dateRange]);

    // Fetch sessions when dates change
    const fetchHistory = useCallback(async (start, end) => {
        if (!start || !end) return;
        setLoading(true);
        try {
            const data = await cashService.getHistory({ startDate: start, endDate: end });
            setSessions(Array.isArray(data) ? data : []);
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Error al cargar el historial'));
            setSessions([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHistory(startDate, endDate);
    }, [startDate, endDate, fetchHistory]);

    // --- Currency Symbol Helper ---
    const getSymbol = (currency) => {
        const symbols = { 'USD': '$', 'VES': 'Bs', 'Bs': 'Bs', 'COP': 'COP', 'EUR': '€' };
        return symbols[currency] || currency || 'Bs';
    };

    // --- Helpers ---
    const toggleExpand = (id) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('es-VE', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const showRecentSessions = () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 90);
        const toDateInput = (date) => date.toISOString().slice(0, 10);
        setStartDate(toDateInput(start));
        setEndDate(toDateInput(end));
    };

    const getSessionAlertStatus = (session) => {
        if (!session.currencies || session.currencies.length === 0) {
            const diff = parseFloat(session.difference || 0);
            if (Math.abs(diff) < 0.01) return 'ok';
            return diff < 0 ? 'shortage' : 'overage';
        }

        let hasShortage = false;
        let hasOverage = false;

        session.currencies.forEach(curr => {
            const diff = parseFloat(curr.difference || 0);
            if (diff < -0.01) hasShortage = true;
            if (diff > 0.01) hasOverage = true;
        });

        if (hasShortage) return 'shortage';
        if (hasOverage) return 'overage';
        return 'ok';
    };

    const getDifferenceBadge = (difference, currencySymbol) => {
        const diff = parseFloat(difference || 0);

        if (Math.abs(diff) < 0.01) {
            return (
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] font-black rounded-md inline-flex items-center gap-1 border border-emerald-100">
                    <CheckCircle size={12} />
                    OK
                </span>
            );
        }

        if (diff < 0) {
            return (
                <span className="px-2 py-0.5 bg-rose-50 text-rose-700 text-[11px] font-black rounded-md inline-flex items-center gap-1 border border-rose-100">
                    <TrendingDown size={12} />
                    Faltan {currencySymbol} {formatCurrency(Math.abs(diff), currencySymbol)}
                </span>
            );
        }

        return (
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-black rounded-md inline-flex items-center gap-1 border border-blue-100">
                <TrendingUp size={12} />
                Sobran {currencySymbol} {formatCurrency(diff, currencySymbol)}
            </span>
        );
    };

    // --- KPI Calculation ---
    const calculateKPIs = () => {
        const closedSessions = sessions.filter(s => s.status === 'CLOSED');
        let totalShortages = 0;
        let totalOverages = 0;
        let totalCashSales = 0;

        closedSessions.forEach(session => {
            if (session.currencies && session.currencies.length > 0) {
                const relevant = session.currencies.find(c => c.is_anchor) || session.currencies[0];
                const diff = parseFloat(relevant.difference || 0);
                if (diff < -0.01) totalShortages += Math.abs(diff);
                else if (diff > 0.01) totalOverages += diff;

                const expected = parseFloat(relevant.final_expected || 0);
                const initial = parseFloat(relevant.initial_amount || 0);
                const sales = expected - initial;
                if (sales > 0) totalCashSales += sales;
            } else {
                const diff = parseFloat(session.difference || 0);
                if (diff < -0.01) totalShortages += Math.abs(diff);
                else if (diff > 0.01) totalOverages += diff;
                const sales = (parseFloat(session.final_cash_expected || 0) - parseFloat(session.initial_cash || 0));
                if (sales > 0) totalCashSales += sales;
            }
        });

        return { totalShortages, totalOverages, totalCashSales };
    };

    const kpis = calculateKPIs();

    // --- Actions ---
    const handleDownloadReport = async () => {
        setDownloading(true);
        const toastId = toast.loading('Generando reporte auditoria...');
        try {
            await reportService.downloadGeneralReport(startDate, endDate);
            toast.success('Reporte descargado', { id: toastId });
        } catch (error) {
            console.error('Error downloading report:', error);
            toast.error(getApiErrorMessage(error, 'Error al descargar reporte'), { id: toastId });
        } finally {
            setDownloading(false);
        }
    };

    const handleReprintZReport = async (sessionId) => {
        const toastId = toast.loading('Enviando a impresora...');
        try {
            const response = await apiClient.get(`/cash/sessions/${sessionId}/z-report-payload`);
            await printerService.printRaw(response.data);
            toast.success('Reporte Z enviado a impresora', { id: toastId });
        } catch (error) {
            console.error('Error reprinting Z-Report:', error);
            toast.error(getApiErrorMessage(error, 'Error al reimprimir. Verifica que el Hardware Bridge este activo.'), { id: toastId });
        }
    };

    const handleDownloadAuditPDF = async (session) => {
        const toastId = toast.loading('Generando auditoria PDF...');
        try {
            const auditReport = await cashService.getAuditReport(session.id);
            const blob = await pdf(<CashAuditReportPDF report={auditReport} business={business} />).toBlob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Auditoria-Arqueo-Sesion-${session.id}.pdf`;
            link.click();
            URL.revokeObjectURL(url);
            toast.success('Auditoria PDF descargada', { id: toastId });
        } catch (error) {
            console.error('Error generating audit PDF:', error);
            toast.error(getApiErrorMessage(error, 'Error al generar auditoria PDF'), { id: toastId });
        }
    };

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <div className="space-y-4">
            {/* Header actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div>
                    <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                        <div className="bg-indigo-100 p-1.5 rounded-lg text-indigo-600">
                            <Clock size={16} />
                        </div>
                        Historial de Caja
                    </h2>
                    <p className="text-slate-500 text-xs font-semibold ml-8">
                        Auditoria de cierres y movimientos
                    </p>
                </div>

                <button
                    onClick={handleDownloadReport}
                    disabled={downloading || loading}
                    className="h-9 inline-flex items-center gap-2 bg-emerald-600 text-white px-3 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm font-black text-xs active:scale-95 disabled:opacity-50"
                >
                    <Download size={15} />
                    <span>{downloading ? '...' : 'Exportar Auditoria'}</span>
                </button>
            </div>

            {/* KPIs */}
            {!loading && sessions.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-[11px] font-black uppercase mb-1">Faltantes (Aprox)</p>
                            <p className="text-xl font-black text-rose-600">{formatCurrency(kpis.totalShortages)}</p>
                        </div>
                        <div className="bg-rose-50 p-2.5 rounded-lg text-rose-600 border border-rose-100">
                            <TrendingDown size={20} />
                        </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-[11px] font-black uppercase mb-1">Sobrantes (Aprox)</p>
                            <p className="text-xl font-black text-emerald-600">{formatCurrency(kpis.totalOverages)}</p>
                        </div>
                        <div className="bg-emerald-50 p-2.5 rounded-lg text-emerald-600 border border-emerald-100">
                            <TrendingUp size={20} />
                        </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-[11px] font-black uppercase mb-1">Ventas Efectivo (Aprox)</p>
                            <p className="text-xl font-black text-indigo-600">{formatCurrency(kpis.totalCashSales)}</p>
                        </div>
                        <div className="bg-indigo-50 p-2.5 rounded-lg text-indigo-600 border border-indigo-100">
                            <DollarSign size={20} />
                        </div>
                    </div>
                </div>
            )}

            {/* Sessions list */}
            <div className="space-y-3">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
                        Cargando historial...
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-slate-500">
                        <div className="mb-3 rounded-xl bg-slate-100 p-3 text-slate-400">
                            <Clock size={28} />
                        </div>
                        <p className="text-sm font-black text-slate-700">No hay sesiones en este rango</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                            Rango actual: {startDate || 'inicio'} - {endDate || 'fin'}
                        </p>
                        <button
                            type="button"
                            onClick={showRecentSessions}
                            className="mt-4 h-9 rounded-lg bg-indigo-600 px-3 text-xs font-black text-white shadow-sm transition-colors hover:bg-indigo-700 active:scale-95"
                        >
                            Ver ultimas sesiones
                        </button>
                    </div>
                ) : (
                    sessions.map((session) => {
                        const isExpanded = expandedId === session.id;
                        const isClosed = session.status === 'CLOSED';
                        const alertStatus = getSessionAlertStatus(session);

                        return (
                            <div
                                key={session.id}
                                className={clsx(
                                    "bg-white rounded-xl shadow-sm border overflow-hidden transition-all",
                                    alertStatus === 'shortage' ? "border-rose-200" :
                                        alertStatus === 'overage' ? "border-blue-200" :
                                            "border-slate-200"
                                )}
                            >
                                {/* Collapsed header */}
                                <div
                                    className={clsx(
                                        "p-4 cursor-pointer hover:bg-slate-50 transition-colors flex flex-col md:flex-row gap-3 justify-between",
                                        isExpanded && "bg-slate-50/80"
                                    )}
                                    onClick={() => toggleExpand(session.id)}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={clsx(
                                            "p-2.5 rounded-lg",
                                            isClosed ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                                        )}>
                                            {isClosed ? <CheckCircle size={20} /> : <Clock size={20} />}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <span className="font-black text-slate-800 text-base">
                                                    Sesion #{session.id}
                                                </span>
                                                <span className={clsx(
                                                    "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
                                                    isClosed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                                )}>
                                                    {isClosed ? 'Cerrada' : 'Abierta'}
                                                </span>
                                                {session.register && (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 uppercase tracking-wider">
                                                        {session.register.code}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-500">
                                                <span className="flex items-center gap-1">
                                                    <User size={12} /> {session.user?.full_name || session.user?.username}
                                                </span>
                                                {session.register && (
                                                    <span className="flex items-center gap-1 text-blue-600">
                                                        <FileText size={12} /> {session.register.name}
                                                    </span>
                                                )}
                                                <span className="flex items-center gap-1">
                                                    <Clock size={12} /> {formatDate(session.opened_at || session.start_time)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Mini currency summary */}
                                    <div className="flex flex-wrap gap-2 items-center justify-end">
                                        {(session.currencies || []).slice(0, 3).map(curr => (
                                            <div key={curr.id} className="flex items-center gap-2 bg-white border border-slate-100 px-2.5 py-1.5 rounded-lg shadow-sm">
                                                <span className="text-xs font-bold text-slate-400">{curr.currency_symbol}</span>
                                                <span className="text-xs font-black text-slate-700">
                                                    {formatCurrency(curr.final_reported || 0, curr.currency_code || curr.currency_symbol)}
                                                </span>
                                                {isClosed && getDifferenceBadge(curr.difference, curr.currency_symbol || '$')}
                                            </div>
                                        ))}
                                        <ChevronDown className={clsx(
                                            "text-slate-400 transition-transform",
                                            isExpanded && "rotate-180"
                                        )} />
                                    </div>
                                </div>

                                {/* Expanded details */}
                                {isExpanded && (
                                    <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                                        {/* Multi-currency breakdown grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                            {(session.currencies || []).map(curr => {
                                                const diff = parseFloat(curr.difference || 0);
                                                return (
                                                    <div key={curr.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <span className="font-black text-slate-700 text-base">{curr.currency_symbol}</span>
                                                            {isClosed && Math.abs(diff) >= 0.01 && (
                                                                <span className={clsx(
                                                                    "text-xs font-bold px-2 py-1 rounded-lg border",
                                                                    diff > 0 ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-rose-50 text-rose-700 border-rose-100"
                                                                )}>
                                                                    {diff > 0 ? 'Sobrante' : 'Faltante'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="space-y-1.5 text-xs">
                                                            <div className="flex justify-between">
                                                                <span className="text-slate-500 font-medium">Inicial</span>
                                                                <span className="font-bold text-slate-700">
                                                                    {formatCurrency(curr.initial_amount, curr.currency_code || curr.currency_symbol)}
                                                                </span>
                                                            </div>
                                                            {isClosed && (
                                                                <>
                                                                    <div className="flex justify-between">
                                                                        <span className="text-slate-500 font-medium">Esperado</span>
                                                                        <span className="font-bold text-indigo-600">
                                                                            {formatCurrency(curr.final_expected, curr.currency_code || curr.currency_symbol)}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex justify-between border-t border-dashed border-slate-200 pt-2 mt-2">
                                                                        <span className="text-slate-500 font-bold">Reportado</span>
                                                                        <span className="font-black text-slate-800 text-sm">
                                                                            {formatCurrency(curr.final_reported, curr.currency_code || curr.currency_symbol)}
                                                                        </span>
                                                                    </div>
                                                                    {Math.abs(diff) >= 0.01 && (
                                                                        <div className={clsx(
                                                                            "flex justify-between p-2 rounded-lg mt-2",
                                                                            diff > 0 ? "bg-blue-50" : "bg-rose-50"
                                                                        )}>
                                                                            <span className={clsx(
                                                                                "font-bold text-xs uppercase",
                                                                                diff > 0 ? "text-blue-600" : "text-rose-600"
                                                                            )}>Diferencia</span>
                                                                            <span className={clsx(
                                                                                "font-black",
                                                                                diff > 0 ? "text-blue-700" : "text-rose-700"
                                                                            )}>
                                                                                {diff > 0 ? '+' : ''}{formatCurrency(diff, curr.currency_code || curr.currency_symbol)}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Payment method breakdown */}
                                        {session.payment_breakdown && session.payment_breakdown.length > 0 && (
                                            <div className="mt-4 mb-3">
                                                <h4 className="text-xs font-black text-slate-700 mb-2 border-b border-slate-200 pb-2 uppercase tracking-wide">
                                                    Detalle de Metodos de Pago
                                                </h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
                                                    {session.payment_breakdown.map((item, idx) => (
                                                        <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm flex flex-col">
                                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide truncate" title={item.method}>
                                                                {item.method}
                                                            </span>
                                                            <div className="flex items-end justify-between mt-1">
                                                                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                                                    {item.currency}
                                                                </span>
                                                                <span className="font-bold text-slate-700">
                                                                    {getSymbol(item.currency)} {parseFloat(item.amount || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Session notes */}
                                        {session.notes && (
                                            <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-800 text-xs font-semibold flex items-start gap-3">
                                                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                                                <div className="min-w-0">
                                                    <p className="font-bold text-amber-900 mb-1">Notas del Cierre:</p>
                                                    {session.notes}
                                                </div>
                                            </div>
                                        )}

                                        {/* Action buttons for closed sessions */}
                                        {isClosed && (
                                            <div className="mt-4 flex flex-col sm:flex-row gap-2.5 border-t border-slate-200 pt-3">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setAuditSession(session);
                                                    }}
                                                    className="flex-1 h-10 px-3 bg-slate-900 text-white rounded-lg font-black text-xs flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors shadow-sm active:scale-95"
                                                >
                                                    <ShieldCheck size={15} />
                                                    Ver Auditoria
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleReprintZReport(session.id);
                                                    }}
                                                    className="flex-1 h-10 px-3 bg-indigo-600 text-white rounded-lg font-black text-xs flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm active:scale-95"
                                                >
                                                    <Printer size={15} />
                                                    Reimprimir Reporte Z
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDownloadAuditPDF(session);
                                                    }}
                                                    className="flex-1 h-10 px-3 bg-white border border-indigo-200 text-indigo-600 rounded-lg font-black text-xs flex items-center justify-center gap-2 hover:border-indigo-300 transition-colors active:scale-95"
                                                >
                                                    <FileText size={15} />
                                                    Descargar Auditoria
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            <CashAuditModal
                session={auditSession}
                isOpen={Boolean(auditSession)}
                onClose={() => setAuditSession(null)}
            />
        </div>
    );
};

export default CashTab;
