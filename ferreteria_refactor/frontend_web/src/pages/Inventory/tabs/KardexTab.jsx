import { useState, useEffect } from 'react';
import {
    Archive, ArrowDownCircle, ArrowUpCircle, Filter, Search,
    ChevronRight, ChevronDown, Smartphone, Package, ShoppingCart,
    RotateCcw, Wrench, AlertTriangle, TrendingDown, RefreshCw,
    X, Info, Hash, Calendar, BarChart2, Layers
} from 'lucide-react';
import InventoryMovementSheet from '../../../components/inventory/InventoryMovementSheet';
import { useFeatureFlag } from '../../../hooks/useFeatureFlag';
import apiClient from '../../../config/axios';
import clsx from 'clsx';
import { normalizeSearch } from '../../../utils/search';

// ─── Helpers ────────────────────────────────────────────────────────────────

const MOVEMENT_CONFIG = {
    SALE:           { label: 'Venta',                    color: 'text-rose-600',    bg: 'bg-rose-50',    border: 'border-rose-200',    icon: ShoppingCart,    dir: 'out' },
    SALE_MODIFIER:  { label: 'Extra de venta',           color: 'text-rose-600',    bg: 'bg-rose-50',    border: 'border-rose-200',    icon: ShoppingCart,    dir: 'out' },
    SALE_REVERSED:  { label: 'Venta anulada',            color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: RotateCcw,       dir: 'in'  },
    PURCHASE:       { label: 'Compra',                   color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: Archive,         dir: 'in'  },
    ADJUSTMENT:     { label: 'Ajuste',                   color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200',    icon: ArrowUpCircle,   dir: 'in'  },
    ADJUSTMENT_IN:  { label: 'Ajuste de entrada',        color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200',    icon: ArrowUpCircle,   dir: 'in'  },
    ADJUSTMENT_OUT: { label: 'Ajuste de salida',         color: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-200',  icon: ArrowDownCircle, dir: 'out' },
    DAMAGED:        { label: 'Da\u00f1ado',                   color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200',     icon: AlertTriangle,   dir: 'out' },
    INTERNAL_USE:   { label: 'Uso interno',              color: 'text-purple-600',  bg: 'bg-purple-50',  border: 'border-purple-200',  icon: Wrench,          dir: 'out' },
    RETURN:         { label: 'Devoluci\u00f3n',               color: 'text-teal-600',    bg: 'bg-teal-50',    border: 'border-teal-200',    icon: RotateCcw,       dir: 'in'  },
    OUT:            { label: 'Salida',                   color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200',   icon: TrendingDown,    dir: 'out' },
    TRANSFER_IN:    { label: 'Traslado recibido',        color: 'text-cyan-600',    bg: 'bg-cyan-50',    border: 'border-cyan-200',    icon: RefreshCw,       dir: 'in'  },
    TRANSFER_OUT:   { label: 'Traslado enviado',         color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-200',  icon: RefreshCw,       dir: 'out' },
    EXTERNAL_TRANSFER_IN:  { label: 'Traslado externo recibido', color: 'text-cyan-600',   bg: 'bg-cyan-50',   border: 'border-cyan-200',   icon: RefreshCw, dir: 'in'  },
    EXTERNAL_TRANSFER_OUT: { label: 'Traslado externo enviado',  color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', icon: RefreshCw, dir: 'out' },
};

const humanizeMovementType = (type = '') =>
    String(type || '').toLowerCase().split('_').filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');

const getConfig = (type) =>
    MOVEMENT_CONFIG[type] || {
        label: humanizeMovementType(type), color: 'text-slate-600', bg: 'bg-slate-50',
        border: 'border-slate-200', icon: Archive, dir: 'in'
    };

const extractTransferRef = (desc = '') => {
    const text = String(desc || '');
    const hashRef = text.match(/#(\d+)/);
    const packageRef = text.match(/trf-[a-z0-9-]+/i);
    if (packageRef) return packageRef[0];
    if (hashRef) return `#${hashRef[1]}`;
    return null;
};

const friendlyDescription = (item = {}) => {
    const desc = String(item.description || '').trim();
    const type = String(item.movement_type || '');
    const ref = extractTransferRef(desc);
    const suffix = ref ? ` (${ref})` : '';

    if (!desc) return '';
    if (type === 'EXTERNAL_TRANSFER_OUT') return `Salida por traslado externo${suffix}`;
    if (type === 'EXTERNAL_TRANSFER_IN') return `Entrada por traslado externo${suffix}`;
    if (type === 'TRANSFER_OUT') return `Salida por traslado interno${suffix}`;
    if (type === 'TRANSFER_IN') return `Entrada por traslado interno${suffix}`;
    if (type === 'SALE_REVERSED') return 'Entrada por anulaci\u00f3n de venta';
    if (type === 'SALE_MODIFIER') return 'Salida por extra o modificador de venta';
    if (/^Transfer OUT/i.test(desc)) return `Salida por traslado externo${suffix}`;
    if (/^Transfer IN/i.test(desc)) return `Entrada por traslado externo${suffix}`;
    if (/Generated package/i.test(desc)) return `Paquete de traslado generado${suffix}`;

    return desc
        .replace(/Transfer OUT to External \(Generated package\)/gi, 'Salida por traslado externo')
        .replace(/Transfer IN \(v2 - new product\) from/gi, 'Entrada por traslado externo desde')
        .replace(/Transfer IN \(v2\) from/gi, 'Entrada por traslado externo desde')
        .replace(/Transfer IN from/gi, 'Entrada por traslado externo desde')
        .replace(/Transfer OUT/gi, 'Salida por traslado')
        .replace(/Transfer IN/gi, 'Entrada por traslado')
        .replace(/Bulk Import/gi, 'Importaci\u00f3n masiva')
        .replace(/Units/gi, 'unidades')
        .replace(/Sale reversed/gi, 'Venta anulada');
};

// Detecta si la descripción contiene un IMEI (15 dígitos consecutivos)
const extractIMEI = (desc = '') => {
    const m = desc.match(/\b(\d{15})\b/);
    return m ? m[1] : null;
};

// Detecta si parece nombre de teléfono (contiene palabras clave)
const looksLikePhone = (name = '') =>
    /samsung|iphone|xiaomi|redmi|motorola|tecno|infinix|huawei|oppo|realme|lg|nokia/i.test(name);

const formatDateTime = (dateStr) => {
    const d = new Date(dateStr);
    return {
        date: d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
    };
};

// ─── Sub-componente: fila expandible (desktop) ───────────────────────────────

const KardexRow = ({ item, index }) => {
    const [expanded, setExpanded] = useState(false);
    const cfg = getConfig(item.movement_type);
    const Icon = cfg.icon;
    const isOut = cfg.dir === 'out';
    const imei = extractIMEI(item.description || '');
    const isPhone = looksLikePhone(item.product?.name || '');
    const { date, time } = formatDateTime(item.date);
    const displayDescription = friendlyDescription(item);

    // Construir descripción enriquecida
    const buildRichDescription = () => {
        if (!displayDescription) return null;
        // Resaltar IMEI dentro del texto
        if (imei) {
            const parts = displayDescription.split(imei);
            return (
                <span>
                    {parts[0]}
                    <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded text-xs">
                        IMEI: {imei}
                    </span>
                    {parts[1]}
                </span>
            );
        }
        return displayDescription;
    };

    return (
        <>
            <tr
                onClick={() => setExpanded(e => !e)}
                className={clsx(
                    "cursor-pointer transition-colors duration-150",
                    index % 2 === 0 ? "bg-white" : "bg-slate-50/30",
                    "hover:bg-slate-50",
                    expanded && "bg-slate-100/70"
                )}
            >
                {/* Fecha */}
                <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-semibold text-slate-700">{date}</div>
                    <div className="text-xs text-slate-400 font-medium">{time}</div>
                </td>

                {/* Producto */}
                <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                        {isPhone
                            ? <Smartphone size={14} className="text-indigo-400 shrink-0" />
                            : <Package size={14} className="text-slate-400 shrink-0" />
                        }
                        <div>
                            <div className="font-bold text-slate-800 text-sm leading-tight">
                                {item.product?.name || <span className="text-slate-400 italic">ID: {item.product_id}</span>}
                            </div>
                            {imei && (
                                <div className="flex items-center gap-1 mt-0.5">
                                    <Hash size={10} className="text-indigo-400" />
                                    <span className="text-[10px] font-mono text-indigo-600 font-bold">
                                        {imei}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </td>

                {/* Tipo */}
                <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-bold ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                        <Icon size={12} />
                        {cfg.label}
                    </span>
                </td>

                {/* Descripción resumida */}
                <td className="px-4 py-3 max-w-xs">
                    <div className="text-xs text-slate-500 italic line-clamp-1">
                        {displayDescription || <span className="text-slate-300">Sin descripci\u00f3n</span>}
                    </div>
                </td>

                {/* Cantidad */}
                <td className={`px-4 py-3 whitespace-nowrap text-right font-black text-sm ${cfg.color}`}>
                    {isOut ? '-' : '+'}{Math.abs(item.quantity)}
                </td>

                {/* Saldo */}
                <td className="px-4 py-3 whitespace-nowrap text-right">
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-sm font-bold text-slate-700">
                        {item.balance_after}
                    </span>
                </td>

                {/* Expand */}
                <td className="px-3 py-3 text-center">
                    <ChevronDown
                        size={15}
                        className={clsx("text-slate-400 transition-transform duration-200 mx-auto", expanded && "rotate-180")}
                    />
                </td>
            </tr>

            {/* Fila expandida — detalle completo */}
            {expanded && (
                <tr className="bg-slate-50/80">
                    <td colSpan={7} className="border-b border-slate-100 px-6 py-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {/* Producto completo */}
                            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <Package size={10} /> Producto
                                </div>
                                <div className="text-sm font-bold text-slate-800">
                                    {item.product?.name || `ID: ${item.product_id}`}
                                </div>
                                {item.product?.sku && (
                                    <div className="text-xs text-slate-400 mt-0.5">SKU: {item.product.sku}</div>
                                )}
                            </div>

                            {/* Fecha y hora exacta */}
                            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <Calendar size={10} /> Fecha y Hora
                                </div>
                                <div className="text-sm font-bold text-slate-800">{date}</div>
                                <div className="text-xs text-slate-500">{time}</div>
                            </div>

                            {/* Movimiento */}
                            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <BarChart2 size={10} /> Movimiento
                                </div>
                                <div className={`text-sm font-black ${cfg.color}`}>
                                    {isOut ? '-' : '+'}{Math.abs(item.quantity)} unidades
                                </div>
                                <div className="text-xs text-slate-500">
                                    Saldo resultante: <span className="font-bold text-slate-700">{item.balance_after}</span>
                                </div>
                            </div>

                            {/* IMEI / Info extra */}
                            {imei ? (
                                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 shadow-sm">
                                    <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                        <Smartphone size={10} /> IMEI
                                    </div>
                                    <div className="text-sm font-mono font-black text-indigo-700 break-all">
                                        {imei}
                                    </div>
                                    <div className="text-[10px] text-indigo-400 mt-0.5">
                                        Equipo serializado
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                        <Layers size={10} /> Tipo
                                    </div>
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                                        <Icon size={11} /> {cfg.label}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Descripción completa */}
                        {displayDescription && (
                            <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                    <Info size={10} /> Descripción completa
                                </div>
                                <div className="text-sm text-slate-700 leading-relaxed">
                                    {buildRichDescription()}
                                </div>
                            </div>
                        )}
                    </td>
                </tr>
            )}
        </>
    );
};

// ─── Sub-componente: card móvil ──────────────────────────────────────────────

const KardexCard = ({ item }) => {
    const [expanded, setExpanded] = useState(false);
    const cfg = getConfig(item.movement_type);
    const Icon = cfg.icon;
    const isOut = cfg.dir === 'out';
    const imei = extractIMEI(item.description || '');
    const isPhone = looksLikePhone(item.product?.name || '');
    const { date, time } = formatDateTime(item.date);
    const displayDescription = friendlyDescription(item);

    return (
        <div
            className={clsx(
                "bg-white rounded-2xl shadow-sm border transition-all duration-200",
                expanded ? "border-indigo-300 shadow-md" : "border-slate-200"
            )}
        >
            <div
                className="p-4 flex flex-col gap-3 cursor-pointer"
                onClick={() => setExpanded(e => !e)}
            >
                {/* Header */}
                <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                            {isPhone
                                ? <Smartphone size={13} className="text-indigo-400 shrink-0" />
                                : <Package size={13} className="text-slate-400 shrink-0" />
                            }
                            <span className="font-bold text-slate-800 text-sm truncate">
                                {item.product?.name || `ID: ${item.product_id}`}
                            </span>
                        </div>
                        <div className="text-xs text-slate-400 font-medium">{date} · {time}</div>
                        {imei && (
                            <div className="flex items-center gap-1 mt-1 bg-indigo-50 px-2 py-0.5 rounded-lg w-fit">
                                <Hash size={10} className="text-indigo-500" />
                                <span className="text-[10px] font-mono font-bold text-indigo-600">{imei}</span>
                            </div>
                        )}
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase border shrink-0 ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                        <Icon size={10} /> {cfg.label}
                    </span>
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                    <div className="text-xs text-slate-500 italic max-w-[55%] line-clamp-1">
                        {displayDescription || <span className="text-slate-300">Sin descripci\u00f3n</span>}
                    </div>
                    <div className="text-right flex items-center gap-3">
                        <div>
                            <div className={`text-lg font-black ${cfg.color}`}>
                                {isOut ? '-' : '+'}{Math.abs(item.quantity)}
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded-full inline-block">
                                Saldo: {item.balance_after}
                            </div>
                        </div>
                        <ChevronDown
                            size={16}
                            className={clsx("text-slate-400 transition-transform duration-200 shrink-0", expanded && "rotate-180")}
                        />
                    </div>
                </div>
            </div>

            {/* Detalle expandido móvil */}
            {expanded && (
                <div className="px-4 pb-4 border-t border-indigo-100 pt-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200">
                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Fecha exacta</div>
                            <div className="text-xs font-bold text-slate-700">{date}</div>
                            <div className="text-xs text-slate-500">{time}</div>
                        </div>
                        <div className={`rounded-xl p-2.5 border ${cfg.bg} ${cfg.border}`}>
                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Cantidad</div>
                            <div className={`text-sm font-black ${cfg.color}`}>{isOut ? '-' : '+'}{Math.abs(item.quantity)}</div>
                            <div className="text-[10px] text-slate-500">Saldo final: {item.balance_after}</div>
                        </div>
                    </div>
                    {imei && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-2.5">
                            <div className="text-[10px] font-bold text-indigo-400 uppercase mb-1 flex items-center gap-1">
                                <Smartphone size={10} /> IMEI del equipo
                            </div>
                            <div className="text-xs font-mono font-black text-indigo-700">{imei}</div>
                        </div>
                    )}
                    {displayDescription && (
                        <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                                <Info size={10} /> Descripción
                            </div>
                            <div className="text-xs text-slate-700 leading-relaxed">{displayDescription}</div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Componente principal ────────────────────────────────────────────────────

const ALL_TYPES = Object.entries(MOVEMENT_CONFIG).map(([k, v]) => ({ value: k, label: v.label }));

const KardexTab = () => {
    const kardexMejorado = useFeatureFlag('kardex_imei_mejorado');
    const [kardex, setKardex] = useState([]);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [filterType, setFilterType] = useState('ALL');
    const [showFilters, setShowFilters] = useState(false);

    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
    });

    const fetchKardex = async () => {
        setIsLoading(true);
        try {
            const response = await apiClient.get('/inventory/kardex', {
                params: { start_date: startDate, end_date: endDate, limit: 500 }
            });
            setKardex(response.data);
        } catch (error) {
            console.error("Error fetching kardex:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchKardex(); }, [startDate, endDate]);

    // Filtrado: búsqueda por nombre, IMEI o descripción + tipo
    const filtered = kardex.filter(item => {
        if (filterType !== 'ALL' && item.movement_type !== filterType) return false;
        if (!searchQuery) return true;
        const q = normalizeSearch(searchQuery);
        const name = normalizeSearch(item.product?.name || '');
        const desc = kardexMejorado ? normalizeSearch(`${item.description || ''} ${friendlyDescription(item)}`) : '';
        return name.includes(q) || (kardexMejorado && desc.includes(q));
    });

    // Stats rápidas
    const totalIn  = filtered.filter(i => getConfig(i.movement_type).dir === 'in').reduce((s, i) => s + Number(i.quantity), 0);
    const totalOut = filtered.filter(i => getConfig(i.movement_type).dir === 'out').reduce((s, i) => s + Math.abs(Number(i.quantity)), 0);
    const activeTypeLabel = filterType === 'ALL' ? 'Todos los movimientos' : getConfig(filterType).label;
    const hasActiveFilters = filterType !== 'ALL' || searchQuery;
    const clearFilters = () => {
        setSearchQuery('');
        setFilterType('ALL');
    };

    return (
        <div id="tour-inventory-add-btn" className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                        <h2 className="text-lg font-black text-slate-900">Kardex de Inventario</h2>
                        <p className="text-xs font-medium text-slate-400">
                            {filtered.length} movimientos en el rango seleccionado
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => setShowFilters(f => !f)}
                            className={clsx(
                                "inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-bold transition-colors",
                                showFilters || filterType !== 'ALL'
                                    ? "border-indigo-600 bg-indigo-600 text-white"
                                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            )}
                        >
                            <Filter size={15} />
                            Tipos
                            {filterType !== 'ALL' && <span className="h-2 w-2 rounded-full bg-amber-400" />}
                        </button>
                        <button
                            onClick={() => setIsSheetOpen(true)}
                            className="inline-flex h-10 items-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-bold text-white shadow-sm shadow-indigo-100 transition-colors hover:bg-indigo-700"
                        >
                            <ArrowUpCircle size={16} />
                            <span className="md:hidden">Ajuste</span>
                            <span className="hidden md:inline">Nuevo ajuste manual</span>
                        </button>
                    </div>
                </div>

                <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(260px,1fr)_auto] lg:items-center">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                        <input
                            type="text"
                            placeholder="Buscar por producto, IMEI o descripción..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-9 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-slate-400"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-2">
                        <Calendar size={14} className="text-slate-400" />
                        <input
                            type="date"
                            className="h-8 rounded border border-slate-200 bg-white px-2 text-sm font-medium text-slate-600 outline-none focus:border-slate-400"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                        />
                        <ChevronRight size={14} className="text-slate-400" />
                        <input
                            type="date"
                            className="h-8 rounded border border-slate-200 bg-white px-2 text-sm font-medium text-slate-600 outline-none focus:border-slate-400"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                        />
                    </div>
                </div>

                {(hasActiveFilters || showFilters) && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Vista</span>
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{activeTypeLabel}</span>
                        {searchQuery && (
                            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                                Búsqueda: {searchQuery}
                            </span>
                        )}
                        {hasActiveFilters && (
                            <button onClick={clearFilters} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50">
                                <X size={13} /> Limpiar
                            </button>
                        )}
                    </div>
                )}
            </div>

            {showFilters && (
                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Tipo de movimiento</div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setFilterType('ALL')}
                            className={clsx("rounded-md border px-3 py-1.5 text-xs font-bold transition-colors",
                                filterType === 'ALL' ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            )}
                        >
                            Todos
                        </button>
                        {ALL_TYPES.map(({ value, label }) => {
                            const cfg = getConfig(value);
                            const Icon = cfg.icon;
                            return (
                                <button
                                    key={value}
                                    onClick={() => setFilterType(value)}
                                    className={clsx("inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-bold transition-colors",
                                        filterType === value
                                            ? `${cfg.bg} ${cfg.color} ${cfg.border}`
                                            : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                                    )}
                                >
                                    <Icon size={11} /> {label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Movimientos</div>
                    <div className="mt-1 text-2xl font-black text-slate-800">{filtered.length}</div>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 shadow-sm">
                    <div className="text-xs font-bold uppercase tracking-wide text-emerald-600">Entradas</div>
                    <div className="mt-1 text-2xl font-black text-emerald-700">+{totalIn.toFixed(0)}</div>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 shadow-sm">
                    <div className="text-xs font-bold uppercase tracking-wide text-rose-600">Salidas</div>
                    <div className="mt-1 text-2xl font-black text-rose-700">-{totalOut.toFixed(0)}</div>
                </div>
            </div>

            <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:block">
                <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Fecha</th>
                            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Producto / IMEI</th>
                            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Tipo</th>
                            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Descripción</th>
                            <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">Cantidad</th>
                            <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">Saldo</th>
                            <th className="w-8 px-4 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 bg-white">
                        {isLoading ? (
                            <tr><td colSpan="7" className="py-12 text-center text-slate-400 animate-pulse">Cargando movimientos...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan="7" className="py-12 text-center text-slate-400">No hay movimientos para los filtros seleccionados.</td></tr>
                        ) : (
                            filtered.map((item, index) => (
                                <KardexRow key={item.id} item={item} index={index} />
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="space-y-3 md:hidden">
                {isLoading ? (
                    <div className="py-12 text-center text-slate-400 animate-pulse font-medium">Cargando movimientos...</div>
                ) : filtered.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-white py-12 text-center text-slate-400 font-medium">No hay movimientos.</div>
                ) : (
                    filtered.map(item => <KardexCard key={item.id} item={item} />)
                )}
            </div>

            <InventoryMovementSheet
                isOpen={isSheetOpen}
                onClose={() => setIsSheetOpen(false)}
                onSuccess={() => { fetchKardex(); }}
            />
        </div>
    );
};

export default KardexTab;
