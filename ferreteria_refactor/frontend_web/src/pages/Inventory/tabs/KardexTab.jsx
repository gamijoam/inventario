import { useState, useEffect } from 'react';
import {
    Archive, ArrowDownCircle, ArrowUpCircle, Filter, Search,
    ChevronRight, ChevronDown, Smartphone, Package, ShoppingCart,
    RotateCcw, Wrench, AlertTriangle, TrendingDown, RefreshCw,
    X, Info, Hash, Calendar, BarChart2, Layers
} from 'lucide-react';
import InventoryMovementSheet from '../../../components/inventory/InventoryMovementSheet';
import apiClient from '../../../config/axios';
import clsx from 'clsx';
import { normalizeSearch } from '../../../utils/search';

// ─── Helpers ────────────────────────────────────────────────────────────────

const MOVEMENT_CONFIG = {
    SALE:           { label: 'Venta',          color: 'text-rose-600',    bg: 'bg-rose-50',    border: 'border-rose-200',    icon: ShoppingCart,    dir: 'out' },
    PURCHASE:       { label: 'Compra',         color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: Archive,         dir: 'in'  },
    ADJUSTMENT_IN:  { label: 'Ajuste Entrada', color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200',    icon: ArrowUpCircle,   dir: 'in'  },
    ADJUSTMENT_OUT: { label: 'Ajuste Salida',  color: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-200',  icon: ArrowDownCircle, dir: 'out' },
    DAMAGED:        { label: 'Dañado',         color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200',     icon: AlertTriangle,   dir: 'out' },
    INTERNAL_USE:   { label: 'Uso Interno',    color: 'text-purple-600',  bg: 'bg-purple-50',  border: 'border-purple-200',  icon: Wrench,          dir: 'out' },
    RETURN:         { label: 'Devolución',     color: 'text-teal-600',    bg: 'bg-teal-50',    border: 'border-teal-200',    icon: RotateCcw,       dir: 'in'  },
    OUT:            { label: 'Salida',         color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200',   icon: TrendingDown,    dir: 'out' },
    TRANSFER_IN:    { label: 'Transfer Entrada',color:'text-cyan-600',    bg: 'bg-cyan-50',    border: 'border-cyan-200',    icon: RefreshCw,       dir: 'in'  },
    TRANSFER_OUT:   { label: 'Transfer Salida',color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-200',  icon: RefreshCw,       dir: 'out' },
};

const getConfig = (type) =>
    MOVEMENT_CONFIG[type] || {
        label: type, color: 'text-slate-600', bg: 'bg-slate-50',
        border: 'border-slate-200', icon: Archive, dir: 'in'
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

    // Construir descripción enriquecida
    const buildRichDescription = () => {
        if (!item.description) return null;
        // Resaltar IMEI dentro del texto
        if (imei) {
            const parts = item.description.split(imei);
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
        return item.description;
    };

    return (
        <>
            <tr
                onClick={() => setExpanded(e => !e)}
                className={clsx(
                    "transition-all duration-150 cursor-pointer",
                    index % 2 === 0 ? "bg-white" : "bg-slate-50/40",
                    "hover:bg-indigo-50/40",
                    expanded && "bg-indigo-50/60"
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
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                        <Icon size={12} />
                        {cfg.label}
                    </span>
                </td>

                {/* Descripción resumida */}
                <td className="px-4 py-3 max-w-xs">
                    <div className="text-xs text-slate-500 italic line-clamp-1">
                        {item.description || <span className="text-slate-300">Sin descripción</span>}
                    </div>
                </td>

                {/* Cantidad */}
                <td className={`px-4 py-3 whitespace-nowrap text-right font-black text-sm ${cfg.color}`}>
                    {isOut ? '-' : '+'}{Math.abs(item.quantity)}
                </td>

                {/* Saldo */}
                <td className="px-4 py-3 whitespace-nowrap text-right">
                    <span className="font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg text-sm">
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
                <tr className="bg-indigo-50/30">
                    <td colSpan={7} className="px-6 py-4 border-b border-indigo-100">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {/* Producto completo */}
                            <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
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
                            <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <Calendar size={10} /> Fecha y Hora
                                </div>
                                <div className="text-sm font-bold text-slate-800">{date}</div>
                                <div className="text-xs text-slate-500">{time}</div>
                            </div>

                            {/* Movimiento */}
                            <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
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
                                <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-200 shadow-sm">
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
                                <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
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
                        {item.description && (
                            <div className="mt-3 bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
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
                        {item.description || <span className="text-slate-300">Sin descripción</span>}
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
                    {item.description && (
                        <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                                <Info size={10} /> Descripción
                            </div>
                            <div className="text-xs text-slate-700 leading-relaxed">{item.description}</div>
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
        const desc = normalizeSearch(item.description || '');
        return name.includes(q) || desc.includes(q);
    });

    // Stats rápidas
    const totalIn  = filtered.filter(i => getConfig(i.movement_type).dir === 'in').reduce((s, i) => s + Number(i.quantity), 0);
    const totalOut = filtered.filter(i => getConfig(i.movement_type).dir === 'out').reduce((s, i) => s + Math.abs(Number(i.quantity)), 0);
    const hasActiveFilters = filterType !== 'ALL' || searchQuery;

    return (
        <div className="space-y-5">
            {/* Barra superior */}
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-black text-slate-800 hidden md:block">Kardex de Inventario</h2>
                <div className="flex gap-2 ml-auto">
                    <button
                        onClick={() => setShowFilters(f => !f)}
                        className={clsx(
                            "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold border transition-all",
                            showFilters ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-400"
                        )}
                    >
                        <Filter size={15} />
                        <span className="hidden md:inline">Filtros</span>
                        {hasActiveFilters && <span className="w-2 h-2 bg-rose-500 rounded-full" />}
                    </button>
                    <button
                        onClick={() => setIsSheetOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl shadow-lg shadow-indigo-200 hover:-translate-y-0.5 transition-all font-bold text-sm flex items-center gap-2"
                    >
                        + <span className="md:hidden">Ajuste</span>
                        <span className="hidden md:inline">Nuevo Ajuste Manual</span>
                    </button>
                </div>
            </div>

            {/* Panel de filtros */}
            {showFilters && (
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                    {/* Búsqueda */}
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={17} />
                        <input
                            type="text"
                            placeholder="Buscar por producto, IMEI, descripción..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700 text-sm"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    {/* Fechas */}
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                        <Calendar size={14} className="text-slate-400 shrink-0" />
                        <input type="date" className="bg-transparent text-sm font-medium text-slate-600 outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        <ChevronRight size={14} className="text-slate-400" />
                        <input type="date" className="bg-transparent text-sm font-medium text-slate-600 outline-none" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>

                    {/* Tipo de movimiento */}
                    <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tipo de movimiento</div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setFilterType('ALL')}
                                className={clsx("px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                                    filterType === 'ALL' ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
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
                                        className={clsx("flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                                            filterType === value
                                                ? `${cfg.bg} ${cfg.color} ${cfg.border}`
                                                : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                                        )}
                                    >
                                        <Icon size={11} /> {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Stats rápidas */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm text-center">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Movimientos</div>
                    <div className="text-2xl font-black text-slate-800">{filtered.length}</div>
                </div>
                <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-200 shadow-sm text-center">
                    <div className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-0.5">Entradas</div>
                    <div className="text-2xl font-black text-emerald-600">+{totalIn.toFixed(0)}</div>
                </div>
                <div className="bg-rose-50 rounded-2xl p-3 border border-rose-200 shadow-sm text-center">
                    <div className="text-xs font-bold text-rose-500 uppercase tracking-wider mb-0.5">Salidas</div>
                    <div className="text-2xl font-black text-rose-600">-{totalOut.toFixed(0)}</div>
                </div>
            </div>

            {/* Tabla desktop */}
            <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/70">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha / Hora</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Producto / IMEI</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Descripción</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Cantidad</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Saldo</th>
                            <th className="px-4 py-3 w-8"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-50">
                        {isLoading ? (
                            <tr><td colSpan="7" className="text-center py-12 text-slate-400 animate-pulse">Cargando movimientos...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan="7" className="text-center py-12 text-slate-400">No hay movimientos para los filtros seleccionados.</td></tr>
                        ) : (
                            filtered.map((item, index) => (
                                <KardexRow key={item.id} item={item} index={index} />
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Cards móvil */}
            <div className="md:hidden space-y-3">
                {isLoading ? (
                    <div className="py-12 text-center text-slate-400 animate-pulse font-medium">Cargando movimientos...</div>
                ) : filtered.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 font-medium">No hay movimientos.</div>
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
