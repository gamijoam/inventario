import React, { useState, useEffect, useCallback } from 'react';
import {
    Plus, Edit2, Power, MonitorCheck, MonitorOff,
    RefreshCw, Clock, User, Hash, CheckCircle2, XCircle, AlertTriangle, Wallet
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import { getApiErrorMessage } from '../../utils/apiErrors';
import HelpDrawer, { HelpButton } from '../../help/HelpDrawer';
import { useHelp } from '../../help/useHelp';

// ─── Status Badge ────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const isOpen = status === 'OPEN';
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
            isOpen
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
        }`}>
            {isOpen
                ? <CheckCircle2 className="w-3 h-3" />
                : <XCircle className="w-3 h-3" />
            }
            {isOpen ? 'Abierta' : 'Cerrada'}
        </span>
    );
};

// ─── Register Card ────────────────────────────────────────────────────────────
const RegisterCard = ({ register, onEdit, onToggle, onForceClose }) => {
    const isOpen = register.session_status === 'OPEN';

    const formatTime = (isoStr) => {
        if (!isoStr) return null;
        const d = new Date(isoStr);
        return d.toLocaleString('es-VE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    };

    return (
        <div className={`bg-white dark:bg-gray-800 rounded-xl border-2 transition-all ${
            isOpen
                ? 'border-green-400 dark:border-green-600 shadow-md shadow-green-100 dark:shadow-none'
                : 'border-gray-200 dark:border-gray-700'
        }`}>
            {/* Header */}
            <div className="flex items-start justify-between p-4 pb-3">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                        isOpen
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                        {register.code}
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{register.name}</h3>
                        {register.description && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{register.description}</p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                                {register.hardware_client_id || 'sin impresora'}
                            </span>
                            {register.cash_fund && (
                                <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                    register.cash_fund.is_shared
                                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                                        : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                }`}>
                                    <Wallet className="w-3 h-3" />
                                    {register.cash_fund.is_shared ? 'Fondo compartido' : 'Fondo individual'}
                                </span>
                            )}
                            {register.hardware_client_id && (
                                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                    register.print_connected
                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                        : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                }`}>
                                    {register.print_connected ? 'Bridge conectado' : 'Bridge desconectado'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <StatusBadge status={register.session_status} />
            </div>

            {/* Session info */}
            <div className="px-4 pb-3 min-h-[44px]">
                {isOpen ? (
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                            <User className="w-3 h-3" />
                            <span className="font-medium">{register.opened_by}</span>
                        </div>
                        {register.opened_at && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                                <Clock className="w-3 h-3" />
                                <span>Abierta: {formatTime(register.opened_at)}</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500">Sin sesión activa</p>
                )}
            </div>

            {/* Actions */}
            <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2 flex-wrap">
                    {!register.isDefault && (
                        <>
                            <button
                                onClick={() => onEdit(register)}
                                disabled={isOpen}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400
                                           hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20
                                           rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                title={isOpen ? 'Cierra la caja antes de editar' : 'Editar'}
                            >
                                <Edit2 className="w-3.5 h-3.5" />
                                Editar
                            </button>
                            <button
                                onClick={() => onToggle(register)}
                                disabled={isOpen}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                                            disabled:opacity-40 disabled:cursor-not-allowed ${
                                    register.is_active
                                        ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                                        : 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                                }`}
                                title={isOpen ? 'Cierra la caja antes de desactivar' : (register.is_active ? 'Desactivar' : 'Activar')}
                            >
                                <Power className="w-3.5 h-3.5" />
                                {register.is_active ? 'Desactivar' : 'Activar'}
                            </button>
                        </>
                    )}
                    {register.isDefault && !isOpen && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 italic">Caja principal del sistema</span>
                    )}
                    {/* Force-close button: shown when OPEN (admin safety valve for orphaned sessions) */}
                    {isOpen && (
                        <button
                            onClick={() => onForceClose(register)}
                            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                                       text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20
                                       rounded-lg transition-colors"
                            title="Forzar cierre de sesión bloqueada (solo admin)"
                        >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Forzar cierre
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Form Modal ───────────────────────────────────────────────────────────────
const RegisterModal = ({ isOpen, onClose, onSave, editing, registers = [], funds = [] }) => {
    const [form, setForm] = useState({ name: '', code: '', description: '', hardware_client_id: '', cash_fund_id: '' });
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    const getNextRegisterDefaults = () => {
        const usedNumbers = registers
            .map(r => String(r.hardware_client_id || '').trim().toLowerCase().match(/^caja-(\d+)$/)?.[1])
            .filter(Boolean)
            .map(Number);
        const nextNumber = Math.max(0, ...usedNumbers) + 1;
        return {
            name: nextNumber === 1 ? 'Caja Principal' : `Caja ${nextNumber}`,
            code: `C${String(nextNumber).padStart(2, '0')}`,
            hardware_client_id: `caja-${nextNumber}`,
        };
    };

    useEffect(() => {
        if (editing) {
            setForm({
                name: editing.name,
                code: editing.code,
                description: editing.description || '',
                hardware_client_id: editing.hardware_client_id || '',
                cash_fund_id: editing.cash_fund_id ? String(editing.cash_fund_id) : '',
            });
        } else {
            const defaults = getNextRegisterDefaults();
            setForm({ name: defaults.name, code: defaults.code, description: '', hardware_client_id: defaults.hardware_client_id, cash_fund_id: '' });
        }
        setErrors({});
    }, [editing, isOpen, registers]);

    const validate = () => {
        const e = {};
        if (!form.name.trim()) e.name = 'El nombre es requerido';
        if (!form.code.trim()) e.code = 'El código es requerido';
        else if (!/^[A-Z0-9]{1,10}$/i.test(form.code.trim())) e.code = 'Solo letras y números (máx. 10)';
        return e;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length > 0) { setErrors(errs); return; }

        setSaving(true);
        try {
            await onSave({
                ...form,
                code: form.code.trim().toUpperCase(),
                hardware_client_id: form.hardware_client_id.trim().toLowerCase(),
                cash_fund_id: form.cash_fund_id ? Number(form.cash_fund_id) : null,
            });
            onClose();
        } catch (err) {
            const msg = err.response?.data?.detail || 'Error al guardar';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                        {editing ? 'Editar Caja' : 'Nueva Caja Registradora'}
                    </h2>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                        <XCircle className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Nombre <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="Ej: Caja 2, Caja Entrada, Caja Norte"
                            className={`w-full px-3 py-2 rounded-lg border text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                        placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                errors.name ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
                            }`}
                        />
                        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Código <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.code}
                            onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                            placeholder="Ej: C02, CAJA-N, ENT"
                            maxLength={10}
                            disabled={!!editing}
                            className={`w-full px-3 py-2 rounded-lg border text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                        placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500
                                        disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed ${
                                errors.code ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
                            }`}
                        />
                        {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code}</p>}
                        {editing && <p className="text-xs text-gray-400 mt-1">El código no se puede modificar</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Descripción <span className="text-gray-400 font-normal">(opcional)</span>
                        </label>
                        <input
                            type="text"
                            value={form.description}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Ej: Caja del área de cómputo"
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
                                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400
                                       focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            ID Impresora <span className="text-gray-400 font-normal">(opcional)</span>
                        </label>
                        <input
                            type="text"
                            value={form.hardware_client_id}
                            onChange={e => setForm(f => ({ ...f, hardware_client_id: e.target.value }))}
                            placeholder="Ej: caja-1, caja-2, impresora-norte"
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
                                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400
                                       focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            Debe coincidir con el "Client ID" configurado en el programa Invensoft Bridge de esta estación.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Fondo físico <span className="text-gray-400 font-normal">(cajón real)</span>
                        </label>
                        <select
                            value={form.cash_fund_id}
                            onChange={e => setForm(f => ({ ...f, cash_fund_id: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
                                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                       focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Fondo individual automático</option>
                            {funds.map(fund => (
                                <option key={fund.id} value={fund.id}>
                                    {fund.name} {fund.is_shared ? '(compartido)' : '(individual)'}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-400 mt-1">
                            Si dos cajas guardan dinero en el mismo cajón, asígnales el mismo fondo compartido.
                        </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300
                                       bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600
                                       rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 px-4 py-2.5 text-sm font-medium text-white
                                       bg-indigo-600 hover:bg-indigo-700 disabled:bg-blue-400
                                       rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                            {editing ? 'Guardar cambios' : 'Crear caja'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const CashRegistersPage = () => {
    const help = useHelp();
    const [registers, setRegisters] = useState([]);
    const [funds, setFunds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);

    const fetchFunds = useCallback(async () => {
        try {
            const { data } = await apiClient.get('/cash/funds');
            setFunds(data || []);
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Error al cargar fondos físicos'));
        }
    }, []);

    const fetchRegisters = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            const { data } = await apiClient.get('/cash/registers/status');
            // Mark C01 as the default (protected)
            const enriched = data.map(r => ({ ...r, isDefault: r.code === 'C01' }));
            setRegisters(enriched);
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Error al cargar las cajas'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchRegisters();
        fetchFunds();
        // Auto-refresh every 30s to update open/closed status
        const interval = setInterval(() => fetchRegisters(true), 30_000);
        return () => clearInterval(interval);
    }, [fetchRegisters, fetchFunds]);

    const handleCreate = async (formData) => {
        await apiClient.post('/cash/registers', formData);
        toast.success(`Caja "${formData.name}" creada exitosamente`);
        fetchRegisters(true);
        fetchFunds();
    };

    const handleEdit = async (formData) => {
        await apiClient.put(`/cash/registers/${editing.id}`, {
            name: formData.name,
            description: formData.description,
            hardware_client_id: formData.hardware_client_id || null,
            cash_fund_id: formData.cash_fund_id || null,
        });
        toast.success('Caja actualizada');
        fetchRegisters(true);
        fetchFunds();
    };

    const handleCreateFund = async () => {
        const name = window.prompt('Nombre del fondo físico compartido');
        if (!name || !name.trim()) return;
        try {
            await apiClient.post('/cash/funds', { name: name.trim(), is_shared: true });
            toast.success('Fondo compartido creado');
            fetchFunds();
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Error al crear fondo'));
        }
    };

    const handleToggleActive = async (register) => {
        const action = register.is_active ? 'desactivar' : 'activar';
        if (!window.confirm(`¿Deseas ${action} la caja "${register.name}"?`)) return;
        try {
            await apiClient.put(`/cash/registers/${register.id}`, { is_active: !register.is_active });
            toast.success(`Caja ${register.is_active ? 'desactivada' : 'activada'}`);
            fetchRegisters(true);
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Error al actualizar'));
        }
    };

    const handleForceClose = async (register) => {
        const openedBy = register.opened_by ? `abierta por: ${register.opened_by}` : 'sin usuario activo';
        if (!window.confirm(
            `⚠️ Forzar cierre de sesión en "${register.name}"?\n\n` +
            `Sesión ${openedBy}.\n\n` +
            `Usar solo si la sesión está bloqueada sin cajero activo.\n` +
            `El cajero deberá abrir una nueva sesión cuando regrese.`
        )) return;
        try {
            await apiClient.post(`/cash/registers/${register.id}/force-close-session`);
            toast.success(`✅ Sesión de ${register.name} liberada`);
            fetchRegisters(true);
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Error al forzar cierre'));
        }
    };

    const openSessions = registers.filter(r => r.session_status === 'OPEN').length;
    const totalActive = registers.filter(r => r.is_active).length;

    return (
        <div id="tour-cash-container" className="p-6 max-w-5xl mx-auto">
            {/* Page Header */}
            <div id="tour-cash-registers-header" className="flex items-start justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Gestión de Cajas
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Administra las cajas registradoras habilitadas en tu negocio
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <HelpButton contextKey="cash/registers" onClick={help.open} />
                    <button
                        id="tour-cash-refresh"
                        onClick={() => fetchRegisters(true)}
                        disabled={refreshing}
                        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
                                   hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="Actualizar"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={handleCreateFund}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700
                                   text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 text-sm font-medium rounded-lg transition-colors shadow-sm"
                    >
                        <Wallet className="w-4 h-4" />
                        Nuevo Fondo
                    </button>
                    <button
                        id="tour-cash-new-register"
                        onClick={() => { setEditing(null); setModalOpen(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700
                                   text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Nueva Caja
                    </button>
                </div>
            </div>

            {/* Stats Row */}
            <div id="tour-cash-registers-summary" className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                        <Hash className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Total activas</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">{totalActive}</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
                    <div className="w-9 h-9 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                        <MonitorCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Abiertas ahora</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">{openSessions}</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
                    <div className="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                        <MonitorOff className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Cerradas</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">{totalActive - openSessions}</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
                    <div className="w-9 h-9 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                        <Wallet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Fondos compartidos</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">{funds.filter(f => f.is_shared).length}</p>
                    </div>
                </div>
            </div>

            {/* Registers Grid */}
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                                <div className="space-y-1.5 flex-1">
                                    <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : registers.length === 0 ? (
                <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                    <MonitorOff className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p className="font-medium">No hay cajas configuradas</p>
                    <p className="text-sm mt-1">Crea la primera caja registradora</p>
                </div>
            ) : (
                <div id="tour-cash-registers-list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {registers.map(register => (
                        <RegisterCard
                            key={register.id}
                            register={register}
                            onEdit={(r) => { setEditing(r); setModalOpen(true); }}
                            onToggle={handleToggleActive}
                            onForceClose={handleForceClose}
                        />
                    ))}
                </div>
            )}

            {/* Info box */}
            <div id="tour-cash-registers-rules" className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-1">¿Cómo funciona?</p>
                <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1 list-disc list-inside">
                    <li>Cada caja puede ser abierta por un cajero diferente de forma simultánea.</li>
                    <li>Al abrir caja desde el POS, el sistema mostrará un selector de caja disponible.</li>
                    <li>No se puede editar ni desactivar una caja que tenga una sesión abierta.</li>
                    <li>La "Caja Principal" (C01) es creada automáticamente y no puede eliminarse.</li>
                    <li>Si una caja queda bloqueada sin cajero activo, usa <strong>Forzar cierre</strong> para liberarla (solo admins).</li>
                </ul>
            </div>

            {/* Modal */}
            {help.isOpen && <HelpDrawer contextKey="cash/registers" onClose={help.close} />}

            <RegisterModal
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setEditing(null); }}
                onSave={editing ? handleEdit : handleCreate}
                editing={editing}
                registers={registers}
                funds={funds}
            />
        </div>
    );
};

export default CashRegistersPage;
