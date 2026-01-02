import React, { useState, useEffect } from 'react';
import { Calendar, Search, TrendingUp, TrendingDown, AlertTriangle, DollarSign, Clock, User, CheckCircle, XCircle, ChevronDown, ChevronUp, Plus, Download, Printer, FileText } from 'lucide-react';
import cashService from '../services/cashService';
import reportService from '../services/reportService';
import { useConfig } from '../context/ConfigContext';
import { toast } from 'react-hot-toast';
import { pdf } from '@react-pdf/renderer';
import ZReportPDF from '../components/pdf/ZReportPDF';
import apiClient from '../config/axios';
import clsx from 'clsx';

const CashHistory = () => {
    const { formatCurrency, business } = useConfig();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [expandedId, setExpandedId] = useState(null);
    const [downloading, setDownloading] = useState(false);

    // Date filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        // Load last 30 days by default
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);

        setEndDate(today.toISOString().split('T')[0]);
        setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);

        fetchHistory({
            startDate: thirtyDaysAgo.toISOString().split('T')[0],
            endDate: today.toISOString().split('T')[0]
        });
    }, []);

    const fetchHistory = async (filters) => {
        setLoading(true);
        try {
            const data = await cashService.getHistory(filters);
            setSessions(Array.isArray(data) ? data : []);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al cargar el historial');
            setSessions([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        fetchHistory({ startDate, endDate });
    };

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
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg flex items-center gap-1 border border-emerald-100">
                    <CheckCircle size={14} />
                    OK
                </span>
            );
        }

        if (diff < 0) {
            return (
                <span className="px-2.5 py-1 bg-rose-50 text-rose-700 text-xs font-bold rounded-lg flex items-center gap-1 border border-rose-100">
                    <TrendingDown size={14} />
                    Faltan {currencySymbol} {formatCurrency(Math.abs(diff), 'USD').replace('$', '')}
                </span>
            );
        }

        return (
            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg flex items-center gap-1 border border-blue-100">
                <TrendingUp size={14} />
                Sobran {currencySymbol} {formatCurrency(diff, 'USD').replace('$', '')}
            </span>
        );
    };

    const calculateKPIs = () => {
        const closedSessions = sessions.filter(s => s.status === 'CLOSED');
        let totalShortages = 0;
        let totalOverages = 0;
        let totalCashSales = 0;

        closedSessions.forEach(session => {
            // Simplified logic for KPI approximation (using base currency or USD if simpler)
            // Real multi-currency KPI aggregation is complex without normalization
            // We'll trust the backend or simple summing for "primary" currency indicators
            if (session.currencies && session.currencies.length > 0) {
                // Try to find USD or base currency for stats
                const relevant = session.currencies.find(c => c.is_anchor) || session.currencies[0];
                const diff = parseFloat(relevant.difference || 0);
                if (diff < -0.01) totalShortages += Math.abs(diff);
                else if (diff > 0.01) totalOverages += diff;

                const expected = parseFloat(relevant.final_expected || 0);
                const initial = parseFloat(relevant.initial_amount || 0);
                const sales = expected - initial;
                if (sales > 0) totalCashSales += sales;
            } else {
                // Legacy
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

    const handleDownloadReport = async () => {
        setDownloading(true);
        const toastId = toast.loading('Generando reporte auditoría...');
        try {
            await reportService.downloadGeneralReport(startDate, endDate);
            toast.success('Reporte descargado', { id: toastId });
        } catch (error) {
            console.error('Error downloading report:', error);
            toast.error('Error al descargar reporte', { id: toastId });
        } finally {
            setDownloading(false);
        }
    };

    const handleReprintZReport = async (sessionId) => {
        const toastId = toast.loading('Enviando a impresora...');
        try {
            const response = await apiClient.get(`/cash/sessions/${sessionId}/z-report-payload`);
            const bridgeUrl = 'http://localhost:5001/print';
            await fetch(bridgeUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(response.data)
            });
            toast.success('✅ Reporte Z enviado a impresora', { id: toastId });
        } catch (error) {
            console.error('Error reprinting Z-Report:', error);
            toast.error('❌ Error al reimprimir. Verifica que el Hardware Bridge esté activo.', { id: toastId });
        }
    };

    const handleDownloadZReportPDF = async (session) => {
        const toastId = toast.loading('Generando PDF...');
        try {
            const blob = await pdf(<ZReportPDF session={session} business={business} />).toBlob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Reporte-Z-Sesion-${session.id}.pdf`;
            link.click();
            URL.revokeObjectURL(url);
            toast.success('✅ PDF descargado', { id: toastId });
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast.error('❌ Error al generar PDF', { id: toastId });
        }
    };

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col bg-slate-50 p-6 overflow-hidden">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                            <Clock size={24} />
                        </div>
                        Historial de Caja
                    </h1>
                    <p className="text-slate-500 font-medium ml-12">Auditoría de cierres y movimientos</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl shadow-sm border border-slate-200">
                        <Calendar size={18} className="text-slate-400" />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="border-none focus:ring-0 text-sm font-medium text-slate-700 outline-none bg-transparent"
                        />
                        <span className="text-slate-300 font-light mx-1">|</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="border-none focus:ring-0 text-sm font-medium text-slate-700 outline-none bg-transparent"
                        />
                        <button
                            onClick={handleSearch}
                            className="ml-2 p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                            <Search size={16} />
                        </button>
                    </div>

                    <button
                        onClick={handleDownloadReport}
                        disabled={downloading || loading}
                        className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 font-bold text-sm active:scale-95 disabled:opacity-50"
                    >
                        <Download size={18} />
                        <span>{downloading ? '...' : 'Exportar'}</span>
                    </button>
                </div>
            </div>

            {/* KPIs */}
            {!loading && sessions.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 flex-shrink-0">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-xs font-bold uppercase mb-1">Faltantes (Aprox)</p>
                            <p className="text-2xl font-black text-rose-600">{formatCurrency(kpis.totalShortages)}</p>
                        </div>
                        <div className="bg-rose-50 p-3 rounded-xl text-rose-600 border border-rose-100">
                            <TrendingDown size={24} />
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-xs font-bold uppercase mb-1">Sobrantes (Aprox)</p>
                            <p className="text-2xl font-black text-emerald-600">{formatCurrency(kpis.totalOverages)}</p>
                        </div>
                        <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600 border border-emerald-100">
                            <TrendingUp size={24} />
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-xs font-bold uppercase mb-1">Ventas Efectivo (Aprox)</p>
                            <p className="text-2xl font-black text-indigo-600">{formatCurrency(kpis.totalCashSales)}</p>
                        </div>
                        <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600 border border-indigo-100">
                            <DollarSign size={24} />
                        </div>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
                        Cargando historial...
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 opacity-60">
                        <Clock size={48} className="mb-2" />
                        <p className="font-medium">No se encontraron sesiones</p>
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
                                    "bg-white rounded-2xl shadow-sm border transaction-all overflow-hidden transition-all",
                                    alertStatus === 'shortage' ? "border-rose-200" :
                                        alertStatus === 'overage' ? "border-blue-200" :
                                            "border-slate-200"
                                )}
                            >
                                <div
                                    className={clsx("p-5 cursor-pointer hover:bg-slate-50 transition-colors flex flex-col md:flex-row gap-4 justify-between", isExpanded && "bg-slate-50/80")}
                                    onClick={() => toggleExpand(session.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={clsx("p-3 rounded-xl", isClosed ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>
                                            {isClosed ? <CheckCircle size={24} /> : <Clock size={24} />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <span className="font-bold text-slate-800 text-lg">Sesión #{session.id}</span>
                                                <span className={clsx("px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider", isClosed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                                                    {isClosed ? 'Cerrada' : 'Abierta'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                                                <span className="flex items-center gap-1"><User size={12} /> {session.user?.full_name || session.user?.username}</span>
                                                <span className="flex items-center gap-1"><Clock size={12} /> {formatDate(session.opened_at || session.start_time)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Mini Summary */}
                                    <div className="flex flex-wrap gap-3 items-center justify-end">
                                        {(session.currencies || []).slice(0, 3).map(curr => (
                                            <div key={curr.id} className="flex items-center gap-2 bg-white border border-slate-100 px-3 py-1.5 rounded-lg shadow-sm">
                                                <span className="text-xs font-bold text-slate-400">{curr.currency_symbol}</span>
                                                <span className="text-sm font-bold text-slate-700">{formatCurrency(curr.final_reported || 0)}</span>
                                                {isClosed && getDifferenceBadge(curr.difference, '')}
                                            </div>
                                        ))}
                                        <ChevronDown className={clsx("text-slate-400 transition-transform", isExpanded && "rotate-180")} />
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="p-6 border-t border-slate-100 bg-slate-50/50">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {(session.currencies || []).map(curr => {
                                                const diff = parseFloat(curr.difference || 0);
                                                return (
                                                    <div key={curr.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                                        <div className="flex justify-between items-center mb-3">
                                                            <span className="font-black text-slate-700 text-lg">{curr.currency_symbol}</span>
                                                            {isClosed && Math.abs(diff) >= 0.01 && (
                                                                <span className={clsx("text-xs font-bold px-2 py-1 rounded-md border", diff > 0 ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-rose-50 text-rose-700 border-rose-100")}>
                                                                    {diff > 0 ? 'Sobrante' : 'Faltante'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="space-y-2 text-sm">
                                                            <div className="flex justify-between">
                                                                <span className="text-slate-500 font-medium">Inicial</span>
                                                                <span className="font-bold text-slate-700">{formatCurrency(curr.initial_amount)}</span>
                                                            </div>
                                                            {isClosed && (
                                                                <>
                                                                    <div className="flex justify-between">
                                                                        <span className="text-slate-500 font-medium">Esperado</span>
                                                                        <span className="font-bold text-indigo-600">{formatCurrency(curr.final_expected)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between border-t border-dashed border-slate-200 pt-2 mt-2">
                                                                        <span className="text-slate-500 font-bold">Reportado</span>
                                                                        <span className="font-black text-slate-800 text-base">{formatCurrency(curr.final_reported)}</span>
                                                                    </div>
                                                                    {Math.abs(diff) >= 0.01 && (
                                                                        <div className={clsx("flex justify-between bg-slate-50 p-2 rounded-lg mt-2", diff > 0 ? "bg-blue-50" : "bg-rose-50")}>
                                                                            <span className={clsx("font-bold text-xs uppercase", diff > 0 ? "text-blue-600" : "text-rose-600")}>Diferencia</span>
                                                                            <span className={clsx("font-black", diff > 0 ? "text-blue-700" : "text-rose-700")}>
                                                                                {diff > 0 ? '+' : ''}{formatCurrency(diff)}
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
                                        {session.notes && (
                                            <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-xl text-amber-800 text-sm font-medium flex items-start gap-3">
                                                <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="font-bold text-amber-900 mb-1">Notas del Cierre:</p>
                                                    {session.notes}
                                                </div>
                                            </div>
                                        )}

                                        {/* Action Buttons for Closed Sessions */}
                                        {isClosed && (
                                            <div className="mt-4 flex gap-3 border-t border-slate-200 pt-4">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleReprintZReport(session.id);
                                                    }}
                                                    className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 active:scale-95"
                                                >
                                                    <Printer size={18} />
                                                    Reimprimir Reporte Z
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDownloadZReportPDF(session);
                                                    }}
                                                    className="flex-1 px-4 py-3 bg-white border-2 border-indigo-200 text-indigo-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:border-indigo-300 transition-colors active:scale-95"
                                                >
                                                    <FileText size={18} />
                                                    Descargar PDF
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
        </div>
    );
};

export default CashHistory;
