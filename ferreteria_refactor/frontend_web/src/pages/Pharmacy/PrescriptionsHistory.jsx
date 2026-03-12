import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Search, RefreshCw, Plus, X, Users, ClipboardList, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getPrescriptions, createPrescription } from '../../services/pharmacyService';

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

// --- Nueva Receta Modal ---
const EMPTY_FORM = {
    patient_name: '',
    patient_cedula: '',
    doctor_name: '',
    doctor_mpps: '',
    prescription_date: getTodayStr(),
    notes: '',
};

const NewPrescriptionModal = ({ onClose, onSuccess }) => {
    const [form, setForm] = useState(EMPTY_FORM);
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.patient_name.trim()) { toast.error('Ingresa el nombre del paciente'); return; }
        if (!form.patient_cedula.trim()) { toast.error('Ingresa la cédula del paciente'); return; }
        if (!form.doctor_name.trim()) { toast.error('Ingresa el nombre del médico'); return; }
        if (!form.prescription_date) { toast.error('Ingresa la fecha de la receta'); return; }

        setLoading(true);
        try {
            await createPrescription({
                patient_name: form.patient_name.trim(),
                patient_cedula: form.patient_cedula.trim(),
                doctor_name: form.doctor_name.trim(),
                doctor_mpps: form.doctor_mpps.trim() || null,
                prescription_date: form.prescription_date,
                notes: form.notes.trim() || null,
            });
            toast.success('Receta registrada exitosamente');
            onSuccess();
            onClose();
        } catch (err) {
            const detail = err.response?.data?.detail;
            toast.error(typeof detail === 'string' ? detail : 'Error al registrar la receta');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-teal-100 rounded-xl flex items-center justify-center">
                            <FileText size={18} className="text-teal-600" />
                        </div>
                        <h2 className="font-black text-slate-800 text-lg">Nueva Receta</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Modal Body */}
                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Patient Name */}
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">Nombre del Paciente *</label>
                            <input
                                type="text"
                                name="patient_name"
                                value={form.patient_name}
                                onChange={handleChange}
                                placeholder="Nombre completo"
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                            />
                        </div>
                        {/* Patient Cedula */}
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">Cédula del Paciente *</label>
                            <input
                                type="text"
                                name="patient_cedula"
                                value={form.patient_cedula}
                                onChange={handleChange}
                                placeholder="V-00000000"
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                            />
                        </div>
                        {/* Prescription Date */}
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">Fecha de Receta *</label>
                            <input
                                type="date"
                                name="prescription_date"
                                value={form.prescription_date}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                            />
                        </div>
                        {/* Doctor Name */}
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">Nombre del Médico *</label>
                            <input
                                type="text"
                                name="doctor_name"
                                value={form.doctor_name}
                                onChange={handleChange}
                                placeholder="Dr. Nombre Apellido"
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                            />
                        </div>
                        {/* Doctor MPPS */}
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">
                                MPPS del Médico <span className="text-slate-400 font-normal">(opcional)</span>
                            </label>
                            <input
                                type="text"
                                name="doctor_mpps"
                                value={form.doctor_mpps}
                                onChange={handleChange}
                                placeholder="Nro. MPPS"
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                            />
                        </div>
                    </div>
                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                            Notas <span className="text-slate-400 font-normal">(opcional)</span>
                        </label>
                        <textarea
                            name="notes"
                            value={form.notes}
                            onChange={handleChange}
                            rows={3}
                            placeholder="Observaciones sobre la receta..."
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 resize-none"
                        />
                    </div>
                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2.5 rounded-xl bg-teal-600 text-white font-bold text-sm hover:bg-teal-700 transition-colors disabled:opacity-60 flex items-center gap-2"
                        >
                            {loading && <RefreshCw size={14} className="animate-spin" />}
                            Guardar Receta
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Main Component ---
const PrescriptionsHistory = () => {
    const [prescriptions, setPrescriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState(getFirstDayOfMonth());
    const [dateTo, setDateTo] = useState(getTodayStr());
    const [showModal, setShowModal] = useState(false);
    const [skip, setSkip] = useState(0);
    const LIMIT = 50;

    const fetchData = useCallback(async (resetPage = true) => {
        setLoading(true);
        const currentSkip = resetPage ? 0 : skip;
        if (resetPage) setSkip(0);
        try {
            const params = {
                skip: currentSkip,
                limit: LIMIT,
                date_from: dateFrom,
                date_to: dateTo,
            };
            if (search.trim()) params.patient_cedula = search.trim();
            const res = await getPrescriptions(params);
            const data = res.data?.items || res.data || [];
            setPrescriptions(data);
        } catch (err) {
            const detail = err.response?.data?.detail;
            toast.error(typeof detail === 'string' ? detail : 'Error al cargar recetas');
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo, search, skip]);

    useEffect(() => { fetchData(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSearch = (e) => {
        e.preventDefault();
        fetchData(true);
    };

    // Derived stats
    const uniquePatients = new Set(prescriptions.map(p => p.patient_cedula).filter(Boolean)).size;
    const pendingCount = prescriptions.filter(p => !p.sale_id).length;

    const summaryCards = [
        {
            label: 'Total recetas del mes',
            value: prescriptions.length,
            icon: FileText,
            color: { border: 'border-teal-200', bg: 'bg-teal-100', icon: 'text-teal-600' },
        },
        {
            label: 'Pacientes únicos',
            value: uniquePatients,
            icon: Users,
            color: { border: 'border-indigo-200', bg: 'bg-indigo-100', icon: 'text-indigo-600' },
        },
        {
            label: 'Pendientes de asociar',
            value: pendingCount,
            icon: AlertCircle,
            color: { border: 'border-amber-200', bg: 'bg-amber-100', icon: 'text-amber-600' },
        },
    ];

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-teal-100 text-teal-600 rounded-2xl shadow-sm">
                        <FileText size={30} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Historial de Recetas</h1>
                        <p className="text-slate-500 mt-0.5 font-medium">Registro de recetas médicas del establecimiento</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors disabled:opacity-60"
                    >
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        Actualizar
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 text-white font-bold text-sm hover:bg-teal-700 transition-colors shadow-sm shadow-teal-200"
                    >
                        <Plus size={16} />
                        Nueva Receta
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
                            placeholder="Buscar por nombre o cédula..."
                            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                        />
                    </div>
                    {/* Date From */}
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-500 whitespace-nowrap">Desde</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                        />
                    </div>
                    {/* Date To */}
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-500 whitespace-nowrap">Hasta</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                        />
                    </div>
                    <button
                        type="submit"
                        className="px-5 py-2.5 rounded-xl bg-teal-600 text-white font-bold text-sm hover:bg-teal-700 transition-colors"
                    >
                        Buscar
                    </button>
                </form>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <ClipboardList size={18} className="text-teal-600" />
                        <h2 className="font-bold text-slate-800">Recetas Registradas</h2>
                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-mono">
                            {prescriptions.length} recetas
                        </span>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <RefreshCw size={24} className="animate-spin text-slate-400" />
                    </div>
                ) : prescriptions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <FileText size={36} className="mb-3 opacity-40" />
                        <p className="font-semibold">No hay recetas para el período seleccionado</p>
                        <p className="text-sm mt-1">Usa el botón "Nueva Receta" para registrar una manualmente</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="text-left px-5 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap">Fecha</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Paciente</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Cédula</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Médico</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">MPPS</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap">Venta #</th>
                                    <th className="text-left px-5 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Notas</th>
                                </tr>
                            </thead>
                            <tbody>
                                {prescriptions.map((rx, i) => (
                                    <tr
                                        key={rx.id ?? i}
                                        className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors"
                                    >
                                        <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
                                            {formatDate(rx.prescription_date || rx.created_at)}
                                        </td>
                                        <td className="px-4 py-3 font-semibold text-slate-800">
                                            {rx.patient_name || '—'}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-slate-600 text-xs">
                                            {rx.patient_cedula || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                            {rx.doctor_name || '—'}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-slate-500 text-xs">
                                            {rx.doctor_mpps || '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {rx.sale_id ? (
                                                <span className="font-mono text-indigo-600 font-semibold text-xs">
                                                    #{rx.sale_id}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                                                    <AlertCircle size={11} />
                                                    Sin venta
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-slate-500 text-xs max-w-[160px] truncate">
                                            {rx.notes || '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Nueva Receta Modal */}
            {showModal && (
                <NewPrescriptionModal
                    onClose={() => setShowModal(false)}
                    onSuccess={() => fetchData(true)}
                />
            )}
        </div>
    );
};

export default PrescriptionsHistory;
