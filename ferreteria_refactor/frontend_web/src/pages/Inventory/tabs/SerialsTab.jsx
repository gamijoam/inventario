import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import SerializedReportPDF from '../../../components/inventory/SerializedReportPDF';
import { useFeatureFlag } from '../../../hooks/useFeatureFlag';
import InversionReportPDF from '../../../components/inventory/InversionReportPDF';
import apiClient from '../../../config/axios';
import { toast } from 'react-hot-toast';
import {
    Search, Loader2, Smartphone, Save, X, Trash2, Edit2, Check, Layers,
    ChevronDown, ChevronRight, Package, CheckCircle2, Clock,
    AlertTriangle, Warehouse, Hash, Plus, RefreshCw, Filter,
    ScanLine, ArrowLeft, Zap, Info, Copy, TimerReset
} from 'lucide-react';
import ProductThumbnail from '../../../components/products/ProductThumbnail';
import clsx from 'clsx';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
    AVAILABLE: { label: 'Disponible', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', icon: CheckCircle2 },
    SOLD:      { label: 'Vendido',    color: 'text-rose-700',    bg: 'bg-rose-50',    border: 'border-rose-200',    dot: 'bg-rose-500',    icon: AlertTriangle },
    TRANSIT:   { label: 'En transito', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', dot: 'bg-violet-500', icon: TimerReset },
    RESERVED:  { label: 'Reservado', color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   dot: 'bg-amber-500',   icon: Clock },
    DAMAGED:   { label: 'Dañado',    color: 'text-slate-600',   bg: 'bg-slate-100',  border: 'border-slate-300',   dot: 'bg-slate-400',   icon: AlertTriangle },
};
const getStatus = (s) => STATUS_CONFIG[s] || STATUS_CONFIG.AVAILABLE;

// ─── Vista: Catálogo de productos serializados ─────────────────────────────────
const CatalogView = ({ catalog, onSelectProduct, isLoading }) => {
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL'); // ALL | WITH_STOCK | NO_STOCK

    const filtered = catalog.filter(p => {
        const q = search.toLowerCase();
        const matchSearch = !search ||
            p.name.toLowerCase().includes(q) ||
            (p.sku && p.sku.toLowerCase().includes(q));
        const matchStatus =
            filterStatus === 'ALL' ? true :
            filterStatus === 'WITH_STOCK' ? p.stock > 0 :
            p.stock === 0;
        return matchSearch && matchStatus;
    });

    const totalStock = catalog.reduce((s, p) => s + Number(p.stock || 0), 0);
    const withStock  = catalog.filter(p => p.stock > 0).length;

    return (
        <div className="flex flex-col gap-4 h-full">
            {/* Stats rápidas */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-lg border border-slate-200 p-3 text-center shadow-sm">
                    <div className="text-2xl font-black text-slate-800">{catalog.length}</div>
                    <div className="text-xs text-slate-400 font-semibold mt-0.5">Modelos</div>
                </div>
                <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-3 text-center shadow-sm">
                    <div className="text-2xl font-black text-emerald-600">{totalStock}</div>
                    <div className="text-xs text-emerald-500 font-semibold mt-0.5">Unidades</div>
                </div>
                <div className="bg-indigo-50 rounded-lg border border-indigo-200 p-3 text-center shadow-sm">
                    <div className="text-2xl font-black text-indigo-600">{withStock}</div>
                    <div className="text-xs text-indigo-500 font-semibold mt-0.5">Con stock</div>
                </div>
            </div>

            {/* Botón Recepción Multi-Producto */}
            <Link
                to="/inventory/serialized-reception"
                className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-lg shadow-md shadow-indigo-200 transition-colors "
            >
                <Zap size={16} />
                Recepción con IMEI.info — Identificación automática
            </Link>

            {/* Buscador + filtros */}
            <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                    <input
                        type="text"
                        autoFocus
                        placeholder="Buscar modelo, SKU..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                </div>
                <div className="flex gap-1.5">
                    {[
                        { v: 'ALL',        label: 'Todos' },
                        { v: 'WITH_STOCK', label: 'Con stock' },
                        { v: 'NO_STOCK',   label: 'Sin stock' },
                    ].map(f => (
                        <button
                            key={f.v}
                            onClick={() => setFilterStatus(f.v)}
                            className={clsx(
                                'px-3 py-2 rounded-md text-xs font-bold border transition-colors whitespace-nowrap',
                                filterStatus === f.v
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-400'
                            )}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid de productos */}
            {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="animate-spin text-indigo-500" size={36} />
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-16">
                    <Smartphone size={48} className="opacity-20 mb-3" />
                    <p className="font-semibold">No se encontraron equipos</p>
                    <p className="text-sm mt-1">Intenta con otro término de búsqueda</p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 pb-4">
                        {filtered.map(product => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                onSelect={onSelectProduct}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Card de producto en catálogo ─────────────────────────────────────────────

const normalizeSerial = (value = '') => String(value).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const SerialAuditPanel = ({ product, instances }) => {
    const [physicalText, setPhysicalText] = useState('');
    const available = instances.filter(i => i.status === 'AVAILABLE');
    const sold = instances.filter(i => i.status === 'SOLD');
    const transit = instances.filter(i => i.status === 'TRANSIT');
    const reserved = instances.filter(i => i.status === 'RESERVED');
    const damaged = instances.filter(i => i.status === 'DAMAGED');
    const systemStock = Number(product.stock || 0);
    const availableCount = available.length;
    const stockDiff = systemStock - availableCount;

    const systemSet = new Set(available.map(i => normalizeSerial(i.serial_number)).filter(Boolean));
    const physicalList = physicalText.split(/[^A-Za-z0-9]+/).map(normalizeSerial).filter(Boolean);
    const physicalSet = new Set(physicalList);
    const missingPhysical = available.filter(i => !physicalSet.has(normalizeSerial(i.serial_number)));
    const extraPhysical = physicalList.filter(code => !systemSet.has(code));
    const duplicates = physicalList.filter((code, idx) => physicalList.indexOf(code) !== idx);
    const hasPhysicalAudit = physicalList.length > 0;
    const statusOk = stockDiff === 0;

    const auditItems = [
        { label: 'Sistema', value: systemStock, cls: 'border-slate-200 bg-slate-900 text-white' },
        { label: 'Disponibles', value: availableCount, cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
        { label: 'Vendidos', value: sold.length, cls: 'border-rose-200 bg-rose-50 text-rose-700' },
        { label: 'Transito', value: transit.length, cls: 'border-violet-200 bg-violet-50 text-violet-700' },
        { label: 'Otros', value: reserved.length + damaged.length, cls: 'border-amber-200 bg-amber-50 text-amber-700' },
    ];

    return (
        <div className="border-t border-slate-100 bg-white p-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Auditoria IMEI</div>
                    <div className={clsx('inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-black uppercase', statusOk ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>
                        {statusOk ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                        {statusOk ? 'Cuadra' : `Dif. ${stockDiff > 0 ? '+' : ''}${stockDiff}`}
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {auditItems.map(item => (
                        <div key={item.label} className={clsx('flex min-w-0 items-center justify-between rounded-md border px-2.5 py-2', item.cls)}>
                            <span className="truncate text-[10px] font-black uppercase tracking-wide opacity-75">{item.label}</span>
                            <span className="ml-2 shrink-0 text-base font-black leading-none">{item.value}</span>
                        </div>
                    ))}
                </div>
                <p className="mt-2 text-[11px] font-semibold text-slate-500">
                    {statusOk ? 'El stock del producto coincide con los IMEIs disponibles.' : 'Hay diferencia entre el stock del producto y los IMEIs disponibles.'}
                </p>
            </div>

            <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Conteo fisico</div>
                        <p className="mt-0.5 text-xs font-medium leading-snug text-slate-400">Pega IMEIs separados por espacio, coma o salto de linea.</p>
                    </div>
                    {hasPhysicalAudit && (
                        <div className={clsx('shrink-0 rounded-md px-2 py-1 text-[10px] font-black', missingPhysical.length === 0 && extraPhysical.length === 0 && duplicates.length === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                            {physicalList.length} contados
                        </div>
                    )}
                </div>
                <textarea
                    value={physicalText}
                    onChange={e => setPhysicalText(e.target.value)}
                    rows={2}
                    placeholder="Ej: 353791682868853 353791682872913"
                    className="mt-2 w-full resize-y rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 outline-none focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                />
                {hasPhysicalAudit && (
                    <div className="mt-3 grid gap-2">
                        <div className={clsx('rounded-md border p-2', missingPhysical.length ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50')}>
                            <div className={clsx('text-[10px] font-black uppercase tracking-wide', missingPhysical.length ? 'text-rose-700' : 'text-emerald-700')}>Faltan fisicamente ({missingPhysical.length})</div>
                            <div className="mt-1 max-h-20 overflow-auto font-mono text-[11px] text-slate-700">{missingPhysical.length ? missingPhysical.map(i => <div key={i.id}>{i.serial_number}</div>) : <span className="font-sans text-xs font-bold text-emerald-700">Todo contado</span>}</div>
                        </div>
                        {(extraPhysical.length > 0 || duplicates.length > 0) && (
                            <div className="grid gap-2 sm:grid-cols-2">
                                <div className="rounded-md border border-amber-200 bg-amber-50 p-2">
                                    <div className="text-[10px] font-black uppercase tracking-wide text-amber-700">Sobrantes ({extraPhysical.length})</div>
                                    <div className="mt-1 max-h-20 overflow-auto font-mono text-[11px] text-slate-700">{[...new Set(extraPhysical)].map(code => <div key={code}>{code}</div>)}</div>
                                </div>
                                <div className="rounded-md border border-amber-200 bg-amber-50 p-2">
                                    <div className="text-[10px] font-black uppercase tracking-wide text-amber-700">Duplicados ({new Set(duplicates).size})</div>
                                    <div className="mt-1 max-h-20 overflow-auto font-mono text-[11px] text-slate-700">{[...new Set(duplicates)].map(code => <div key={code}>{code}</div>)}</div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const ProductCard = ({ product, onSelect }) => {
    const [instances, setInstances] = useState(null);
    const [loadingInst, setLoadingInst] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const loadInstances = async (e) => {
        e.stopPropagation();
        if (instances !== null) { setExpanded(e => !e); return; }
        setLoadingInst(true);
        try {
            const res = await apiClient.get(`/inventory/product/${product.id}/instances`);
            setInstances(res.data || []);
            setExpanded(true);
        } catch {
            toast.error('Error cargando seriales');
        } finally {
            setLoadingInst(false);
        }
    };

    const available = instances?.filter(i => i.status === 'AVAILABLE') || [];
    const sold      = instances?.filter(i => i.status === 'SOLD') || [];
    const transit   = instances?.filter(i => i.status === 'TRANSIT') || [];
    const [deletingId, setDeletingId]   = useState(null);
    const [editingId, setEditingId]     = useState(null);
    const [editSerial, setEditSerial]   = useState('');
    const [confirmDelete, setConfirmDelete] = useState(null);

    const handleDelete = async (inst) => {
        if (confirmDelete?.id !== inst.id) {
            setConfirmDelete(inst);
            return;
        }
        setDeletingId(inst.id);
        try {
            const r = await apiClient.delete(`/inventory/instance/${inst.id}`, {
                params: { reason: 'Corrección de error' }
            });
            toast.success(`IMEI ${inst.serial_number} eliminado${r.data.stock_adjusted ? ' — stock ajustado' : ''}`);
            setInstances(prev => prev.filter(i => i.id !== inst.id));
            setConfirmDelete(null);
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error al eliminar');
        } finally {
            setDeletingId(null);
        }
    };

    const handleEditSave = async (inst) => {
        if (!editSerial.trim()) return;
        try {
            await apiClient.patch(`/inventory/instance/${inst.id}/fix-serial`, {
                serial_number: editSerial.trim()
            });
            toast.success('Serial corregido correctamente');
            setInstances(prev => prev.map(i => i.id === inst.id ? { ...i, serial_number: editSerial.trim() } : i));
            setEditingId(null);
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error al corregir');
        }
    };

    return (
        <div className={clsx(
            'bg-white rounded-lg border transition-colors duration-200 overflow-hidden shadow-sm',
            expanded ? 'border-indigo-300 shadow-md' : 'border-slate-200 hover:border-indigo-300 hover:shadow-md'
        )}>
            {/* Cabecera clickeable → ingresa IMEIs */}
            <button
                onClick={() => onSelect(product)}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-indigo-50/40 transition-colors group"
            >
                <ProductThumbnail
                    imageUrl={product.image_url}
                    productName={product.name}
                    size="sm"
                    updatedAt={product.updated_at}
                />
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-800 text-sm leading-tight line-clamp-2 group-hover:text-indigo-700 transition-colors">
                        {product.name}
                    </div>
                    {product.sku && (
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">{product.sku}</div>
                    )}
                </div>
                {/* Stock badge */}
                <div className={clsx(
                    'shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-md font-black text-lg',
                    product.stock > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                )}>
                    {product.stock}
                    <span className="text-[8px] font-bold uppercase tracking-wide opacity-70">uds</span>
                </div>
                <Plus size={16} className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>

            {/* Footer: ver seriales */}
            <div className="border-t border-slate-100 px-3 py-2 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">IMEIs</span>
                    {instances !== null && (
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">{available.length} disp.</span>
                            {sold.length > 0 && <span className="text-[10px] font-bold text-rose-500 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md">{sold.length} vend.</span>}
                            {transit.length > 0 && <span className="text-[10px] font-bold text-violet-600 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-md">{transit.length} trans.</span>}
                        </div>
                    )}
                </div>
                <button
                    onClick={loadInstances}
                    className="flex items-center gap-1 text-[11px] font-bold text-indigo-500 hover:text-indigo-700 transition-colors"
                >
                    {loadingInst ? (
                        <Loader2 size={12} className="animate-spin" />
                    ) : (
                        <>
                            {expanded ? 'Ocultar' : 'Ver seriales'}
                            <ChevronDown size={12} className={clsx('transition-transform', expanded && 'rotate-180')} />
                        </>
                    )}
                </button>
            </div>

            {expanded && instances !== null && (
                <SerialAuditPanel product={product} instances={instances} />
            )}

            {/* Lista de seriales expandida */}
            {expanded && instances !== null && (
                <div className="border-t border-slate-100 max-h-52 overflow-y-auto">
                    {instances.length === 0 ? (
                        <div className="py-6 text-center text-slate-400 text-xs">Sin IMEIs registrados</div>
                    ) : (
                        <div className="divide-y divide-slate-50 group">
                            {instances.map(inst => {
                                const st = getStatus(inst.status);
                                return (
                                    <div key={inst.id} className={clsx(
                                        'flex items-center gap-2 px-3 py-2 transition-colors',
                                        confirmDelete?.id === inst.id ? 'bg-rose-50' : 'hover:bg-slate-50'
                                    )}>
                                        <div className={clsx('w-1.5 h-1.5 rounded-full shrink-0', st.dot)} />

                                        {/* Serial — editable */}
                                        {editingId === inst.id ? (
                                            <input
                                                autoFocus
                                                value={editSerial}
                                                onChange={e => setEditSerial(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') handleEditSave(inst); if (e.key === 'Escape') setEditingId(null); }}
                                                className="font-mono text-xs flex-1 border border-indigo-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                            />
                                        ) : (
                                            <span className="font-mono text-xs text-slate-700 flex-1 truncate">{inst.serial_number}</span>
                                        )}

                                        <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0', st.bg, st.color, st.border)}>
                                            {st.label}
                                        </span>

                                        {/* Acciones */}
                                        {editingId === inst.id ? (
                                            <div className="flex gap-1 shrink-0">
                                                <button onClick={() => handleEditSave(inst)}
                                                    className="p-1 bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-600 hover:text-white transition-colors">
                                                    <Check size={11} />
                                                </button>
                                                <button onClick={() => setEditingId(null)}
                                                    className="p-1 bg-slate-100 text-slate-500 rounded hover:bg-slate-200 transition-colors">
                                                    <X size={11} />
                                                </button>
                                            </div>
                                        ) : confirmDelete?.id === inst.id ? (
                                            <div className="flex items-center gap-1 shrink-0">
                                                <span className="text-[9px] text-rose-600 font-bold">¿Eliminar?</span>
                                                <button onClick={() => handleDelete(inst)} disabled={deletingId === inst.id}
                                                    className="px-1.5 py-0.5 bg-rose-600 text-white text-[9px] font-bold rounded hover:bg-rose-700 transition-colors disabled:opacity-50">
                                                    {deletingId === inst.id ? '...' : 'Sí'}
                                                </button>
                                                <button onClick={() => setConfirmDelete(null)}
                                                    className="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-[9px] font-bold rounded hover:bg-slate-300 transition-colors">
                                                    No
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {inst.status === 'AVAILABLE' && (
                                                    <button
                                                        onClick={() => { setEditingId(inst.id); setEditSerial(inst.serial_number); }}
                                                        title="Corregir serial"
                                                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors">
                                                        <Edit2 size={11} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDelete(inst)}
                                                    title="Eliminar IMEI"
                                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors">
                                                    <Trash2 size={11} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Vista: Escaneo de IMEIs ──────────────────────────────────────────────────

const getAgeDays = (dateValue) => {
    if (!dateValue) return null;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return null;
    return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
};

const TransitView = ({ instances = [], isLoading, onRefresh }) => {
    const [search, setSearch] = useState('');
    const [ageFilter, setAgeFilter] = useState('ALL');

    const transit = instances.filter(item => item.status === 'TRANSIT');
    const filtered = transit.filter(item => {
        const q = search.trim().toLowerCase();
        const productName = item.product?.name || item.product_name || '';
        const serial = item.serial_number || '';
        const warehouse = item.warehouse?.name || item.warehouse_name || '';
        const age = getAgeDays(item.updated_at || item.created_at) ?? 0;
        const matchesSearch = !q || productName.toLowerCase().includes(q) || serial.toLowerCase().includes(q) || warehouse.toLowerCase().includes(q);
        const matchesAge = ageFilter === 'ALL' ? true : age >= Number(ageFilter);
        return matchesSearch && matchesAge;
    });

    const grouped = filtered.reduce((acc, item) => {
        const key = item.product?.id || item.product_id || 'unknown';
        if (!acc[key]) {
            acc[key] = {
                product: item.product || { name: item.product_name || 'Producto sin nombre', sku: item.product_sku },
                items: [],
            };
        }
        acc[key].items.push(item);
        return acc;
    }, {});

    const groups = Object.values(grouped).sort((a, b) => b.items.length - a.items.length);
    const oldTransit = transit.filter(item => (getAgeDays(item.updated_at || item.created_at) ?? 0) >= 7).length;

    const copyImeis = async (items = filtered) => {
        const text = items.map(item => item.serial_number).filter(Boolean).join('\n');
        if (!text) return toast.error('No hay IMEIs para copiar');
        try {
            await navigator.clipboard.writeText(text);
            toast.success(`${items.length} IMEIs copiados`);
        } catch {
            toast.error('No se pudo copiar la lista');
        }
    };

    return (
        <div className="flex h-full flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-violet-700"><TimerReset size={16} /> En transito</div>
                    <div className="mt-2 text-3xl font-black text-violet-700">{transit.length}</div>
                    <div className="text-xs font-semibold text-violet-500">IMEIs descontados del origen</div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-amber-700"><AlertTriangle size={16} /> 7+ dias</div>
                    <div className="mt-2 text-3xl font-black text-amber-700">{oldTransit}</div>
                    <div className="text-xs font-semibold text-amber-600">Conviene conciliarlos o cerrar destino</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="text-xs font-black uppercase tracking-wide text-slate-500">Productos afectados</div>
                    <div className="mt-2 text-3xl font-black text-slate-900">{groups.length}</div>
                    <div className="text-xs font-semibold text-slate-400">Agrupados por modelo serializado</div>
                </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto, IMEI o almacen..." className="w-full rounded-md border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm font-semibold outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {[{ value: 'ALL', label: 'Todos' }, { value: '3', label: '3+ dias' }, { value: '7', label: '7+ dias' }, { value: '15', label: '15+ dias' }].map(option => (
                            <button key={option.value} onClick={() => setAgeFilter(option.value)} className={clsx('rounded-md border px-3 py-2 text-xs font-black transition-colors', ageFilter === option.value ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600')}>
                                {option.label}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => copyImeis(filtered)} className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600"><Copy size={15} /> Copiar IMEIs</button>
                    <button onClick={onRefresh} className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 transition-colors hover:border-indigo-300 hover:text-indigo-600" title="Actualizar"><RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} /></button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white"><Loader2 className="animate-spin text-indigo-500" size={36} /></div>
            ) : groups.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white py-16 text-slate-400">
                    <TimerReset size={46} className="mb-3 opacity-25" />
                    <p className="font-black text-slate-600">No hay IMEIs en transito con esos filtros</p>
                    <p className="mt-1 text-sm font-medium">Cuando un traslado externo queda pendiente, aparecera aqui.</p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="divide-y divide-slate-100">
                        {groups.map(group => (
                            <div key={group.product.id || group.product.name} className="p-4">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-black text-slate-900">{group.product.name}</div>
                                        <div className="mt-0.5 text-xs font-mono font-semibold text-slate-400">{group.product.sku || 'Sin SKU'}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="rounded-md bg-violet-50 px-2 py-1 text-xs font-black text-violet-700">{group.items.length} IMEIs</span>
                                        <button onClick={() => copyImeis(group.items)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-black text-slate-500 hover:border-indigo-300 hover:text-indigo-600"><Copy size={13} /> Copiar</button>
                                    </div>
                                </div>
                                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                    {group.items.map(item => {
                                        const age = getAgeDays(item.updated_at || item.created_at);
                                        const warehouse = item.warehouse?.name || item.warehouse_name || 'Sin almacen';
                                        return (
                                            <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="truncate font-mono text-xs font-black text-slate-800">{item.serial_number}</div>
                                                        <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-slate-400"><Warehouse size={12} /> {warehouse}</div>
                                                    </div>
                                                    <span className={clsx('shrink-0 rounded-md px-2 py-1 text-[10px] font-black', age >= 7 ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700')}>
                                                        {age === null ? 'Sin fecha' : `${age}d`}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const ScanView = ({ product, warehouses, onBack, onSuccess }) => {
    const [imeiInput, setImeiInput]     = useState('');
    const [scannedList, setScannedList] = useState([]);
    const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || '');
    const [unitCost, setUnitCost]       = useState(product.cost_price || '');
    const [submitting, setSubmitting]   = useState(false);
    const inputRef = useRef(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const addImei = async () => {
        const code = imeiInput.trim().toUpperCase();
        if (!code) return;

        if (scannedList.some(i => i.code === code)) {
            toast.error('IMEI duplicado en la lista actual');
            setImeiInput('');
            return;
        }

        // Validar en BD
        try {
            const res = await apiClient.get(`/inventory/validate-entry?imei=${code}`);
            if (res.data.exists) {
                toast.error(res.data.message || 'IMEI ya existe en BD');
                setImeiInput('');
                return;
            }
        } catch {
            toast.error('Error validando IMEI');
            return;
        }

        setScannedList(prev => [{ code, ts: new Date() }, ...prev]);
        setImeiInput('');
        toast.success(`✅ ${code}`, { id: 'scan', duration: 1200 });
        inputRef.current?.focus();
    };

    const handleKeyDown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addImei(); } };

    const removeImei = (code) => setScannedList(prev => prev.filter(i => i.code !== code));

    const handleSubmit = async () => {
        if (!warehouseId || scannedList.length === 0) {
            toast.error('Selecciona bodega y agrega al menos un IMEI');
            return;
        }
        setSubmitting(true);
        try {
            const res = await apiClient.post('/inventory/bulk-entry', {
                product_id: product.id,
                warehouse_id: parseInt(warehouseId),
                imeis: scannedList.map(i => i.code),
                cost: unitCost ? parseFloat(unitCost) : 0,
            });
            toast.success(`✅ ${scannedList.length} equipos ingresados. Stock: ${res.data.new_stock_level}`);
            onSuccess();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error procesando ingreso');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row gap-4 h-full">
            {/* Panel izquierdo: producto + input */}
            <div className="flex-1 flex flex-col gap-4">
                {/* Header producto */}
                <div className="bg-white rounded-lg border border-indigo-200 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-indigo-50 to-white">
                        <button
                            onClick={onBack}
                            className="p-2 hover:bg-white rounded-md text-indigo-400 hover:text-slate-700 transition-colors border border-transparent hover:border-slate-200"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <ProductThumbnail imageUrl={product.image_url} productName={product.name} size="md" updatedAt={product.updated_at} />
                        <div className="flex-1 min-w-0">
                            <div className="font-black text-slate-800 text-base leading-tight line-clamp-1">{product.name}</div>
                            <div className="flex items-center gap-2 mt-1">
                                {product.sku && <span className="text-[10px] font-mono text-slate-400">{product.sku}</span>}
                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                                    Stock actual: {product.stock}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Bodega + costo */}
                    <div className="flex gap-3 p-4 bg-slate-50 border-t border-slate-100">
                        <div className="flex-1">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                <Warehouse size={10} /> Bodega destino
                            </label>
                            <select
                                className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                value={warehouseId}
                                onChange={e => setWarehouseId(e.target.value)}
                            >
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>
                        <div className="w-36">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                Costo unitario ($)
                            </label>
                            <input
                                type="number"
                                className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                value={unitCost}
                                onChange={e => setUnitCost(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                </div>

                {/* Scanner principal */}
                <div className="flex-1 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col items-center justify-center p-6 gap-5">
                    <div className="flex flex-col items-center gap-1 text-slate-400">
                        <ScanLine size={36} className="text-indigo-400" />
                        <span className="text-xs font-bold uppercase tracking-widest">Escanear IMEI / Serial</span>
                    </div>

                    <div className="w-full max-w-sm relative">
                        <input
                            ref={inputRef}
                            type="text"
                            className="w-full text-center px-4 py-5 text-xl font-mono bg-white border-2 border-indigo-200 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-colors placeholder:text-slate-200 tracking-widest"
                            placeholder="· · · · · · · · · · · · · · ·"
                            value={imeiInput}
                            onChange={e => setImeiInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            autoComplete="off"
                            spellCheck={false}
                        />
                        {imeiInput && (
                            <button
                                onClick={addImei}
                                className="absolute right-3 top-1/2 -translate-y-1/2 bg-indigo-600 text-white p-2 rounded-md hover:bg-indigo-700 transition-colors"
                            >
                                <Plus size={16} />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Zap size={12} className="text-amber-400" />
                        <span>Presiona <kbd className="bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 font-mono text-slate-600 text-[10px]">ENTER</kbd> para agregar cada IMEI</span>
                    </div>
                </div>
            </div>

            {/* Panel derecho: lista capturada */}
            <div className="w-full lg:w-80 xl:w-96 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                {/* Header lista */}
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <div>
                        <div className="font-bold text-slate-700 text-sm">IMEIs capturados</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                            {scannedList.length === 0 ? 'Lista vacía' : `${scannedList.length} equipo${scannedList.length > 1 ? 's' : ''} listo${scannedList.length > 1 ? 's' : ''}`}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {scannedList.length > 0 && (
                            <span className="w-8 h-8 bg-indigo-600 text-white text-sm font-black rounded-full flex items-center justify-center">
                                {scannedList.length}
                            </span>
                        )}
                    </div>
                </div>

                {/* Lista */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                    {scannedList.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 py-16">
                            <Hash size={40} className="opacity-20 mb-3" />
                            <p className="text-sm font-medium">Empieza a escanear</p>
                            <p className="text-xs mt-1 opacity-70">Los IMEIs aparecerán aquí</p>
                        </div>
                    ) : (
                        scannedList.map((item, idx) => (
                            <div
                                key={item.code}
                                className="flex items-center gap-2.5 px-3 py-2.5 bg-white border border-slate-100 rounded-md shadow-sm group hover:border-rose-200 transition-colors"
                            >
                                <div className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[9px] font-black flex items-center justify-center shrink-0">
                                    {scannedList.length - idx}
                                </div>
                                <span className="font-mono text-xs font-semibold text-slate-700 flex-1 truncate tracking-wide">
                                    {item.code}
                                </span>
                                <button
                                    onClick={() => removeImei(item.code)}
                                    className="text-slate-200 group-hover:text-rose-400 transition-colors shrink-0"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer acciones */}
                <div className="p-3 border-t border-slate-100 bg-slate-50 space-y-2">
                    {scannedList.length > 0 && (
                        <button
                            onClick={() => { if (confirm(`¿Borrar los ${scannedList.length} IMEIs capturados?`)) setScannedList([]); }}
                            className="w-full py-2 text-xs font-bold text-slate-500 hover:text-rose-500 border border-slate-200 hover:border-rose-300 rounded-md transition-colors bg-white"
                        >
                            Limpiar lista
                        </button>
                    )}
                    <button
                        onClick={handleSubmit}
                        disabled={scannedList.length === 0 || submitting}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-md text-sm shadow-sm shadow-indigo-100  transition-colors flex items-center justify-center gap-2"
                    >
                        {submitting ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Save size={16} />
                        )}
                        {submitting ? 'Procesando...' : `Procesar ${scannedList.length > 0 ? `(${scannedList.length})` : ''}`}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Componente principal ─────────────────────────────────────────────────────
const SerialsTab = () => {
    const showPdfCatalogo  = useFeatureFlag('pdf_catalogo_seriales');
    const showPdfInversion = useFeatureFlag('pdf_inversion_seriales');
    const [catalog, setCatalog]               = useState([]);
    const [warehouses, setWarehouses]         = useState([]);
    const [allInstances, setAllInstances]     = useState([]);
    const [isLoading, setIsLoading]           = useState(true);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [viewMode, setViewMode]             = useState('catalog');

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [prodRes, whRes, instRes] = await Promise.all([
                apiClient.get('/products/', { params: { limit: 2000, has_imei: true } }),
                apiClient.get('/warehouses'),
                apiClient.get('/inventory/serialized-instances'),
            ]);
            const all = Array.isArray(prodRes.data) ? prodRes.data : (prodRes.data?.items || []);
            setCatalog(all.filter(p => p.has_imei));
            setWarehouses(Array.isArray(whRes.data) ? whRes.data : []);
            setAllInstances(Array.isArray(instRes.data) ? instRes.data : []);
        } catch {
            toast.error('Error cargando productos serializados');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleSuccess = () => {
        setSelectedProduct(null);
        loadData(); // refrescar stocks
    };

    const transitCount = allInstances.filter(item => item.status === 'TRANSIT').length;

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Header */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                            <Smartphone className="text-indigo-600" size={20} />
                            {selectedProduct ? 'Ingreso de IMEIs' : viewMode === 'transit' ? 'Auditoria de transitos' : 'Equipos serializados'}
                        </h2>
                        <p className="text-xs font-medium text-slate-400">
                            {selectedProduct
                                ? `Escaneando para: ${selectedProduct.name}`
                                : viewMode === 'transit'
                                    ? `${transitCount} IMEIs pendientes de cierre externo`
                                    : `${catalog.length} modelos con control IMEI - ${warehouses.length} almacenes`}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {!selectedProduct && (
                            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                                {[
                                    { value: 'catalog', label: 'Catalogo', count: catalog.length },
                                    { value: 'transit', label: 'En transito', count: transitCount },
                                ].map(option => (
                                    <button
                                        key={option.value}
                                        onClick={() => setViewMode(option.value)}
                                        className={clsx(
                                            'rounded-md px-3 py-1.5 text-xs font-black transition-colors',
                                            viewMode === option.value
                                                ? 'bg-white text-indigo-600 shadow-sm'
                                                : 'text-slate-500 hover:text-indigo-600'
                                        )}
                                    >
                                        {option.label}
                                        <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{option.count}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        <InversionReportPDF />
                        <SerializedReportPDF />
                        <button
                            onClick={loadData}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 transition-colors hover:border-indigo-300 hover:text-indigo-600"
                            title="Actualizar"
                        >
                            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Vista principal */}
            <div className="flex-1 min-h-0">
                {selectedProduct ? (
                    <ScanView
                        product={selectedProduct}
                        warehouses={warehouses}
                        onBack={() => setSelectedProduct(null)}
                        onSuccess={handleSuccess}
                    />
                ) : viewMode === 'transit' ? (
                    <TransitView
                        instances={allInstances}
                        isLoading={isLoading}
                        onRefresh={loadData}
                    />
                ) : (
                    <CatalogView
                        catalog={catalog}
                        onSelectProduct={setSelectedProduct}
                        isLoading={isLoading}
                    />
                )}
            </div>
        </div>
    );
};

export default SerialsTab;
