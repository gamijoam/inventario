/**
 * InterCompanyTransfers.jsx
 * Sprint 5 — Multi-Empresa
 *
 * Módulo de transferencias de stock entre empresas del mismo grupo organizacional.
 *
 * Flujo:
 *   1. La empresa A crea una solicitud de transferencia seleccionando
 *      productos de su inventario y la empresa destino.
 *   2. La empresa B ve la solicitud entrante y puede aceptarla o rechazarla.
 *   3. Al aceptar → el stock se descuenta en A y suma en B, con Kardex en ambas.
 *
 * Vistas:
 *   - "Enviadas"   : transferencias que originé yo (desde mi empresa)
 *   - "Recibidas"  : transferencias que me enviaron a mí (para aceptar/rechazar)
 *   - "Historial"  : todas (aceptadas y rechazadas)
 *
 * Ruta: /org/transfers
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    ArrowLeftRight, Plus, Package, Building2,
    Check, X, ChevronRight, Loader2, RefreshCw,
    Clock, CheckCircle2, XCircle, Send, Inbox, History,
    Search, AlertTriangle
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Badge de estado de la transferencia con color y ícono */
function StatusBadge({ status }) {
    const map = {
        PENDING  : { label: 'Pendiente',  color: 'amber',   Icon: Clock          },
        ACCEPTED : { label: 'Aceptada',   color: 'emerald', Icon: CheckCircle2   },
        REJECTED : { label: 'Rechazada',  color: 'rose',    Icon: XCircle        },
        CANCELLED: { label: 'Cancelada',  color: 'slate',   Icon: X              },
    };
    const { label, color, Icon } = map[status] || map.PENDING;
    const colors = {
        amber  : 'bg-amber-50  text-amber-700  border-amber-200',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        rose   : 'bg-rose-50   text-rose-700   border-rose-200',
        slate  : 'bg-slate-50  text-slate-600  border-slate-200',
    };
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${colors[color]}`}>
            <Icon size={11} />
            {label}
        </span>
    );
}

/** Formatea una fecha en formato legible */
const fmtDate = (d) => d
    ? new Date(d).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })
    : '—';

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componente: Tarjeta de transferencia
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TransferCard — Tarjeta que muestra una transferencia con sus ítems.
 * Si es una transferencia entrante pendiente, muestra botones Aceptar/Rechazar.
 */
function TransferCard({ transfer, currentSchema, onAccept, onReject, processing }) {
    // Es entrante si el tenant destino es el mío
    const isIncoming = transfer.to_tenant_name &&
        transfer.to_tenant_name === currentSchema;

    // Determinar si el usuario puede actuar
    const canAct = transfer.status === 'PENDING' && isIncoming;

    return (
        <div className={`
            bg-white rounded-2xl border-2 transition-all
            ${transfer.status === 'PENDING'
                ? 'border-amber-200 shadow-sm shadow-amber-50'
                : 'border-slate-100'}
        `}>
            {/* Header de la tarjeta */}
            <div className="p-4 border-b border-slate-50">
                <div className="flex items-start justify-between gap-3">
                    {/* Empresas origen → destino */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                            <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
                                <span className="text-[10px] font-black text-slate-600">
                                    {(transfer.from_tenant_name || '?').charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <span className="text-xs font-semibold text-slate-600 max-w-[100px] truncate">
                                {transfer.from_tenant_name || 'Desconocido'}
                            </span>
                        </div>
                        <ChevronRight size={14} className="text-slate-300 shrink-0" />
                        <div className="flex items-center gap-1.5">
                            <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center">
                                <span className="text-[10px] font-black text-indigo-600">
                                    {(transfer.to_tenant_name || '?').charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <span className="text-xs font-semibold text-indigo-700 max-w-[100px] truncate">
                                {transfer.to_tenant_name || 'Desconocido'}
                            </span>
                        </div>
                    </div>

                    {/* Badge de estado */}
                    <StatusBadge status={transfer.status} />
                </div>

                {/* Fecha y notas */}
                <div className="mt-2 flex items-center justify-between">
                    <p className="text-[10px] text-slate-400">{fmtDate(transfer.created_at)}</p>
                    {transfer.notes && (
                        <p className="text-[10px] text-slate-500 italic truncate max-w-[200px]">
                            "{transfer.notes}"
                        </p>
                    )}
                </div>
            </div>

            {/* Lista de ítems */}
            <div className="px-4 py-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    {transfer.items?.length || 0} ítem{(transfer.items?.length || 0) !== 1 ? 's' : ''}
                </p>
                <div className="space-y-1.5">
                    {(transfer.items || []).slice(0, 3).map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                                <Package size={12} className="text-slate-400 shrink-0" />
                                <span className="text-slate-700 truncate max-w-[200px]">
                                    {item.product_name}
                                </span>
                                {item.product_sku && (
                                    <span className="text-slate-400 font-mono text-[10px]">
                                        ({item.product_sku})
                                    </span>
                                )}
                            </div>
                            <span className="font-bold text-slate-800 shrink-0 ml-2">
                                ×{Number(item.quantity).toLocaleString()}
                            </span>
                        </div>
                    ))}
                    {/* Si hay más de 3 ítems, mostrar cuántos más */}
                    {(transfer.items?.length || 0) > 3 && (
                        <p className="text-[10px] text-slate-400 pl-5">
                            +{(transfer.items?.length || 0) - 3} más...
                        </p>
                    )}
                </div>
            </div>

            {/* Botones de acción — solo para entrantes pendientes */}
            {canAct && (
                <div className="px-4 pb-4 flex gap-2">
                    <button
                        onClick={() => onReject(transfer.id)}
                        disabled={processing === transfer.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors disabled:opacity-50"
                    >
                        <X size={13} /> Rechazar
                    </button>
                    <button
                        onClick={() => onAccept(transfer.id)}
                        disabled={processing === transfer.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors disabled:opacity-50"
                    >
                        {processing === transfer.id
                            ? <Loader2 size={13} className="animate-spin" />
                            : <Check size={13} />
                        }
                        {processing === transfer.id ? 'Procesando...' : 'Aceptar'}
                    </button>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componente: Modal para crear transferencia
// ─────────────────────────────────────────────────────────────────────────────

/**
 * NewTransferModal — Formulario para crear una solicitud de transferencia.
 * El usuario selecciona:
 *   - Empresa destino (dentro del mismo grupo)
 *   - Productos a transferir (por SKU) con cantidades
 *   - Nota opcional
 */
function NewTransferModal({ onClose, onSuccess, orgCompanies, currentSchema }) {
    // Empresas destino disponibles (todas del grupo excepto la actual)
    const destinations = orgCompanies.filter(c => c.schema_name !== currentSchema);

    const [toTenantId, setToTenantId]   = useState('');  // Empresa destino
    const [notes, setNotes]             = useState('');   // Nota
    const [items, setItems]             = useState([      // Ítems a transferir
        { product_sku: '', product_name: '', quantity: 1, unit_cost: 0 }
    ]);
    const [saving, setSaving]           = useState(false);

    /** Actualizar un campo de un ítem por índice */
    const setItem = (idx, field, value) => {
        setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
    };

    /** Agregar una fila vacía de ítem */
    const addItem = () => {
        setItems(prev => [...prev, { product_sku: '', product_name: '', quantity: 1, unit_cost: 0 }]);
    };

    /** Eliminar una fila de ítem */
    const removeItem = (idx) => {
        if (items.length === 1) return;
        setItems(prev => prev.filter((_, i) => i !== idx));
    };

    /** Enviar la solicitud de transferencia */
    const handleSave = async () => {
        if (!toTenantId) { toast.error('Selecciona una empresa destino'); return; }
        const validItems = items.filter(it => it.product_sku.trim() && it.quantity > 0);
        if (validItems.length === 0) {
            toast.error('Agrega al menos un producto con SKU y cantidad válida');
            return;
        }
        setSaving(true);
        try {
            await apiClient.post('/inter-transfers', {
                to_tenant_id: Number(toTenantId),
                notes: notes.trim() || null,
                items: validItems.map(it => ({
                    product_sku : it.product_sku.trim(),
                    product_name: it.product_name.trim() || it.product_sku.trim(),
                    quantity    : Number(it.quantity),
                    unit_cost   : Number(it.unit_cost) || 0,
                })),
            });
            toast.success('✅ Solicitud de transferencia enviada');
            onSuccess();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al crear la transferencia');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl">

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
                            <ArrowLeftRight size={18} className="text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="font-black text-slate-800">Nueva transferencia</h2>
                            <p className="text-xs text-slate-400">Enviar stock a otra empresa del grupo</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">

                    {/* Empresa destino */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                            Empresa destino <span className="text-rose-500">*</span>
                        </label>
                        {destinations.length === 0 ? (
                            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                                <p className="text-xs text-amber-700">
                                    No hay otras empresas en tu grupo para transferir.
                                </p>
                            </div>
                        ) : (
                            <select
                                value={toTenantId}
                                onChange={e => setToTenantId(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 text-sm outline-none bg-white"
                            >
                                <option value="">Seleccionar empresa...</option>
                                {destinations.map(c => (
                                    <option key={c.tenant_id} value={c.tenant_id}>
                                        {c.name} ({c.schema_name})
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Tabla de ítems */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-bold text-slate-600">
                                Productos a transferir <span className="text-rose-500">*</span>
                            </label>
                            <button
                                onClick={addItem}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                            >
                                <Plus size={12} /> Agregar ítem
                            </button>
                        </div>
                        <div className="space-y-2">
                            {items.map((item, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                    {/* SKU */}
                                    <input
                                        type="text"
                                        value={item.product_sku}
                                        onChange={e => setItem(idx, 'product_sku', e.target.value)}
                                        placeholder="SKU"
                                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-400 text-xs outline-none font-mono"
                                    />
                                    {/* Nombre (opcional) */}
                                    <input
                                        type="text"
                                        value={item.product_name}
                                        onChange={e => setItem(idx, 'product_name', e.target.value)}
                                        placeholder="Nombre"
                                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-400 text-xs outline-none"
                                    />
                                    {/* Cantidad */}
                                    <input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={e => setItem(idx, 'quantity', e.target.value)}
                                        className="w-16 px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-400 text-xs outline-none text-center"
                                    />
                                    {/* Botón eliminar ítem */}
                                    <button
                                        onClick={() => removeItem(idx)}
                                        disabled={items.length === 1}
                                        className="p-2 hover:bg-rose-50 hover:text-rose-500 rounded-lg text-slate-300 transition-colors disabled:opacity-30"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                            El SKU debe coincidir exactamente con el producto en tu inventario.
                        </p>
                    </div>

                    {/* Nota */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                            Nota <span className="text-slate-400 font-normal">(opcional)</span>
                        </label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Ej: Reposición de stock urgente para el fin de semana..."
                            rows={2}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 text-sm outline-none resize-none"
                        />
                    </div>
                </div>

                {/* Botones */}
                <div className="p-5 border-t border-slate-100 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || destinations.length === 0}
                        className="flex-1 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                        {saving ? 'Enviando...' : 'Enviar solicitud'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export default function InterCompanyTransfers() {
    const { user } = useAuth();

    // Lista de transferencias y estado de carga
    const [transfers, setTransfers]   = useState([]);
    const [loading, setLoading]       = useState(true);

    // Tab activo: 'received' | 'sent' | 'history'
    const [tab, setTab]               = useState('received');

    // Estado de operación en curso (aceptar/rechazar)
    const [processing, setProcessing] = useState(null);

    // Modal de nueva transferencia
    const [showModal, setShowModal]   = useState(false);

    // Empresas del grupo para el modal (del localStorage)
    const [orgCompanies, setOrgCompanies] = useState([]);
    const currentSchema = localStorage.getItem('selected_tenant') || '';

    // ── Cargar empresas del grupo al montar ───────────────────────────────────
    useEffect(() => {
        try {
            const stored = localStorage.getItem('org_companies');
            if (stored) setOrgCompanies(JSON.parse(stored));
        } catch {}
    }, []);

    // ── Cargar transferencias ─────────────────────────────────────────────────
    const fetchTransfers = useCallback(async () => {
        setLoading(true);
        try {
            // El backend filtra por el tenant actual del usuario (via search_path)
            const res = await apiClient.get('/inter-transfers');
            setTransfers(res.data || []);
        } catch (err) {
            toast.error('Error al cargar las transferencias');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchTransfers(); }, [fetchTransfers]);

    // ── Filtrar transferencias por tab ────────────────────────────────────────
    const filtered = transfers.filter(t => {
        if (tab === 'received') return t.to_tenant_name   === currentSchema && t.status === 'PENDING';
        if (tab === 'sent')     return t.from_tenant_name === currentSchema && t.status === 'PENDING';
        return ['ACCEPTED','REJECTED','CANCELLED'].includes(t.status); // history
    });

    // ── Aceptar transferencia ─────────────────────────────────────────────────
    const handleAccept = async (id) => {
        setProcessing(id);
        try {
            await apiClient.patch(`/inter-transfers/${id}/accept`);
            toast.success('✅ Transferencia aceptada — stock actualizado en ambas empresas');
            fetchTransfers();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al aceptar la transferencia');
        } finally {
            setProcessing(null);
        }
    };

    // ── Rechazar transferencia ────────────────────────────────────────────────
    const handleReject = async (id) => {
        if (!window.confirm('¿Seguro que quieres rechazar esta transferencia?')) return;
        setProcessing(id);
        try {
            await apiClient.patch(`/inter-transfers/${id}/reject`);
            toast.success('Transferencia rechazada');
            fetchTransfers();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al rechazar la transferencia');
        } finally {
            setProcessing(null);
        }
    };

    // Contadores de badges para las tabs
    const receivedCount = transfers.filter(
        t => t.to_tenant_name === currentSchema && t.status === 'PENDING'
    ).length;
    const sentCount = transfers.filter(
        t => t.from_tenant_name === currentSchema && t.status === 'PENDING'
    ).length;

    // ── Render principal ──────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

                {/* ── Header ── */}
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <ArrowLeftRight size={20} className="text-indigo-600" />
                            <h1 className="text-xl font-black text-slate-900">Transferencias entre empresas</h1>
                        </div>
                        <p className="text-sm text-slate-400">
                            Mueve stock entre empresas de tu grupo sin crear una venta
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={fetchTransfers}
                            disabled={loading}
                            className="p-2.5 text-slate-400 hover:text-indigo-600 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={() => setShowModal(true)}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm shadow-indigo-200"
                        >
                            <Plus size={16} />
                            Nueva transferencia
                        </button>
                    </div>
                </div>

                {/* ── Tabs ── */}
                <div className="flex gap-1 bg-white border border-slate-200 rounded-2xl p-1">
                    {[
                        { id: 'received', label: 'Recibidas', Icon: Inbox,   count: receivedCount },
                        { id: 'sent',     label: 'Enviadas',  Icon: Send,    count: sentCount     },
                        { id: 'history',  label: 'Historial', Icon: History, count: 0             },
                    ].map(({ id, label, Icon, count }) => (
                        <button
                            key={id}
                            onClick={() => setTab(id)}
                            className={`
                                flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl transition-all
                                ${tab === id
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}
                            `}
                        >
                            <Icon size={15} />
                            {label}
                            {count > 0 && (
                                <span className={`
                                    text-[10px] font-black px-1.5 py-0.5 rounded-full
                                    ${tab === id ? 'bg-white/20 text-white' : 'bg-amber-500 text-white'}
                                `}>
                                    {count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* ── Lista de transferencias ── */}
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 size={36} className="text-indigo-400 animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16">
                        <ArrowLeftRight size={40} className="text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-semibold">
                            {tab === 'received' ? 'No tienes transferencias pendientes por aceptar'
                            : tab === 'sent'     ? 'No has enviado transferencias pendientes'
                            : 'Sin historial de transferencias aún'}
                        </p>
                        {tab !== 'history' && (
                            <button
                                onClick={() => setShowModal(true)}
                                className="mt-4 flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors mx-auto"
                            >
                                <Plus size={15} />
                                Crear primera transferencia
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filtered.map(transfer => (
                            <TransferCard
                                key={transfer.id}
                                transfer={transfer}
                                currentSchema={currentSchema}
                                onAccept={handleAccept}
                                onReject={handleReject}
                                processing={processing}
                            />
                        ))}
                    </div>
                )}

            </div>

            {/* ── Modal nueva transferencia ── */}
            {showModal && (
                <NewTransferModal
                    onClose={() => setShowModal(false)}
                    onSuccess={() => { setShowModal(false); fetchTransfers(); }}
                    orgCompanies={orgCompanies}
                    currentSchema={currentSchema}
                />
            )}
        </div>
    );
}
