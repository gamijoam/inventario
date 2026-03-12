import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Search, RefreshCw, Download, FileText, Users, Package, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getControlLog } from '../../services/pharmacyService';

// --- Helpers ---
const getFirstDayOfMonth = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

const getTodayStr = () => new Date().toISOString().slice(0, 10);

const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
        return dateStr;
    }
};

// --- Summary Card ---
const SummaryCard = ({ label, value, icon: Icon, color }) => (
    <div className={`bg-white rounded-2xl shadow-sm border p-5 flex items-center gap-4 ${color.border}`}>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color.bg}`}>
            <Icon size={22} className={color.icon} />
        </div>
        <div>
            <p className="text-2xl font-black text-slate-800">{value ?? '—'}</p>
            <p className="text-sm font-semibold text-slate-500">{label}</p>
        </div>
    </div>
);

// --- Main Component ---
const ControlLog = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState(getFirstDayOfMonth());
    const [dateTo, setDateTo] = useState(getTodayStr());

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = { date_from: dateFrom, date_to: dateTo };
            if (search.trim()) params.search = search.trim();
            const res = await getControlLog(params);
            const data = res.data?.items || res.data || [];
            setRows(data);
        } catch (err) {
            const detail = err.response?.data?.detail;
            toast.error(typeof detail === 'string' ? detail : 'Error al cargar el libro de control');
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo, search]);

    // Fetch on mount only; user triggers explicit refresh via button
    useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSearch = (e) => {
        e.preventDefault();
        fetchData();
    };

    // Derived stats
    const uniquePatients = new Set(rows.map(r => r.patient_cedula).filter(Boolean)).size;
    const uniqueProducts = new Set(rows.map(r => r.product_name || r.product_id).filter(Boolean)).size;

    const summaryCards = [
        {
            label: 'Total transacciones (mes)',
            value: rows.length,
            icon: FileText,
            color: { border: 'border-indigo-200', bg: 'bg-indigo-100', icon: 'text-indigo-600' },
        },
        {
            label: 'Pacientes únicos (mes)',
            value: uniquePatients,
            icon: Users,
            color: { border: 'border-teal-200', bg: 'bg-teal-100', icon: 'text-teal-600' },
        },
        {
            label: 'Productos controlados',
            value: uniqueProducts,
            icon: Package,
            color: { border: 'border-amber-200', bg: 'bg-amber-100', icon: 'text-amber-600' },
        },
    ];

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl shadow-sm">
                        <Shield size={30} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Libro de Control</h1>
                        <p className="text-slate-500 mt-0.5 font-medium">Registro de sustancias controladas — uso regulatorio</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => toast('Exportar PDF — próximamente', { icon: '📄' })}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold text-sm hover:bg-rose-100 transition-colors"
                    >
                        <Download size={15} />
                        Exportar PDF
                    </button>
                    <button
                        onClick={() => toast('Exportar Excel — próximamente', { icon: '📊' })}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold text-sm hover:bg-emerald-100 transition-colors"
                    >
                        <Download size={15} />
                        Exportar Excel
                    </button>
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors disabled:opacity-60"
                    >
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        Actualizar
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {summaryCards.map((card, i) => (
                    <SummaryCard key={i} {...card} />
                ))}
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 flex-wrap">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar por cédula o producto..."
                            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                        />
                    </div>
                    {/* Date From */}
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-500 whitespace-nowrap">Desde</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                        />
                    </div>
                    {/* Date To */}
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-500 whitespace-nowrap">Hasta</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                        />
                    </div>
                    <button
                        type="submit"
                        className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-colors"
                    >
                        Buscar
                    </button>
                </form>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Shield size={18} className="text-indigo-500" />
                        <h2 className="font-bold text-slate-800">Transacciones de Sustancias Controladas</h2>
                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-mono">
                            {rows.length} registros
                        </span>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <RefreshCw size={24} className="animate-spin text-slate-400" />
                    </div>
                ) : rows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Shield size={36} className="mb-3 opacity-40" />
                        <p className="font-semibold">No hay transacciones controladas para el período</p>
                        <p className="text-sm mt-1">Ajusta los filtros de fecha o el término de búsqueda</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="text-left px-5 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap">Fecha</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap">Venta #</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Producto</th>
                                    <th className="text-center px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Cantidad</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Paciente</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Cédula</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Médico</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">MPPS</th>
                                    <th className="text-left px-5 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Lote</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, i) => {
                                    const noPrescription = !row.patient_name && !row.patient_cedula;
                                    return (
                                        <tr
                                            key={row.id ?? i}
                                            className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors"
                                        >
                                            <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
                                                {formatDate(row.sale_date || row.created_at)}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-indigo-600 font-semibold text-xs whitespace-nowrap">
                                                {row.sale_id ? `#${row.sale_id}` : '—'}
                                            </td>
                                            <td className="px-4 py-3 font-semibold text-slate-800 max-w-[180px] truncate">
                                                {row.product_name || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-center font-bold text-slate-700">
                                                {row.quantity ?? '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                {noPrescription ? (
                                                    <span className="flex items-center gap-1 text-red-600 font-semibold text-xs">
                                                        <AlertCircle size={13} />
                                                        Sin receta
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-700 font-medium">{row.patient_name || '—'}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-slate-600 text-xs">
                                                {row.patient_cedula || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                                {row.doctor_name || '—'}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-slate-500 text-xs">
                                                {row.doctor_mpps || '—'}
                                            </td>
                                            <td className="px-5 py-3 font-mono text-slate-500 text-xs">
                                                {row.lot_number || '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Regulatory Footer Note */}
            <p className="text-xs text-slate-400 text-center pb-2">
                Este registro es de uso regulatorio. Conserve una copia para inspecciones del SACS.
            </p>
        </div>
    );
};

export default ControlLog;
