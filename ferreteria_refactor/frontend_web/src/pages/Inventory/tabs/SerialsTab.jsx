import React, { useState, useRef, useEffect, useCallback } from 'react';
import apiClient from '../../../config/axios';
import { toast } from 'react-hot-toast';
import {
    Search, Loader2, Smartphone, Save, X, Trash2, Layers,
    ChevronDown, ChevronRight, Package, CheckCircle2, Clock,
    AlertTriangle, Warehouse, Hash, Plus, RefreshCw, Filter,
    ScanLine, ArrowLeft, Zap, Info
} from 'lucide-react';
import ProductThumbnail from '../../../components/products/ProductThumbnail';
import clsx from 'clsx';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
    AVAILABLE: { label: 'Disponible', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', icon: CheckCircle2 },
    SOLD:      { label: 'Vendido',    color: 'text-rose-700',    bg: 'bg-rose-50',    border: 'border-rose-200',    dot: 'bg-rose-500',    icon: AlertTriangle },
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
                <div className="bg-white rounded-2xl border border-slate-200 p-3 text-center shadow-sm">
                    <div className="text-2xl font-black text-slate-800">{catalog.length}</div>
                    <div className="text-xs text-slate-400 font-semibold mt-0.5">Modelos</div>
                </div>
                <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-3 text-center shadow-sm">
                    <div className="text-2xl font-black text-emerald-600">{totalStock}</div>
                    <div className="text-xs text-emerald-500 font-semibold mt-0.5">Unidades</div>
                </div>
                <div className="bg-indigo-50 rounded-2xl border border-indigo-200 p-3 text-center shadow-sm">
                    <div className="text-2xl font-black text-indigo-600">{withStock}</div>
                    <div className="text-xs text-indigo-500 font-semibold mt-0.5">Con stock</div>
                </div>
            </div>

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
                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
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
                                'px-3 py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap',
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

    return (
        <div className={clsx(
            'bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm',
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
                    'shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-xl font-black text-lg',
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

            {/* Lista de seriales expandida */}
            {expanded && instances !== null && (
                <div className="border-t border-slate-100 max-h-52 overflow-y-auto">
                    {instances.length === 0 ? (
                        <div className="py-6 text-center text-slate-400 text-xs">Sin IMEIs registrados</div>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {instances.map(inst => {
                                const st = getStatus(inst.status);
                                const Icon = st.icon;
                                return (
                                    <div key={inst.id} className="flex items-center gap-2 px-3 py-2">
                                        <div className={clsx('w-1.5 h-1.5 rounded-full shrink-0', st.dot)} />
                                        <span className="font-mono text-xs text-slate-700 flex-1 truncate">{inst.serial_number}</span>
                                        <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded border', st.bg, st.color, st.border)}>
                                            {st.label}
                                        </span>
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
                <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-indigo-50 to-white">
                        <button
                            onClick={onBack}
                            className="p-2 hover:bg-white rounded-xl text-indigo-400 hover:text-slate-700 transition-all border border-transparent hover:border-slate-200"
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
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                value={unitCost}
                                onChange={e => setUnitCost(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                </div>

                {/* Scanner principal */}
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center p-6 gap-5">
                    <div className="flex flex-col items-center gap-1 text-slate-400">
                        <ScanLine size={36} className="text-indigo-400" />
                        <span className="text-xs font-bold uppercase tracking-widest">Escanear IMEI / Serial</span>
                    </div>

                    <div className="w-full max-w-sm relative">
                        <input
                            ref={inputRef}
                            type="text"
                            className="w-full text-center px-4 py-5 text-xl font-mono bg-white border-2 border-indigo-200 rounded-2xl shadow-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all placeholder:text-slate-200 tracking-widest"
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
                                className="absolute right-3 top-1/2 -translate-y-1/2 bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 transition-colors"
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
            <div className="w-full lg:w-80 xl:w-96 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
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
                                className="flex items-center gap-2.5 px-3 py-2.5 bg-white border border-slate-100 rounded-xl shadow-sm group hover:border-rose-200 transition-colors"
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
                            className="w-full py-2 text-xs font-bold text-slate-500 hover:text-rose-500 border border-slate-200 hover:border-rose-300 rounded-xl transition-all bg-white"
                        >
                            Limpiar lista
                        </button>
                    )}
                    <button
                        onClick={handleSubmit}
                        disabled={scannedList.length === 0 || submitting}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-lg shadow-indigo-200 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
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
    const [catalog, setCatalog]               = useState([]);
    const [warehouses, setWarehouses]         = useState([]);
    const [isLoading, setIsLoading]           = useState(true);
    const [selectedProduct, setSelectedProduct] = useState(null);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [prodRes, whRes] = await Promise.all([
                apiClient.get('/products/', { params: { limit: 2000, has_imei: true } }),
                apiClient.get('/warehouses'),
            ]);
            const all = Array.isArray(prodRes.data) ? prodRes.data : [];
            setCatalog(all.filter(p => p.has_imei));
            setWarehouses(Array.isArray(whRes.data) ? whRes.data : []);
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

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-black text-slate-800">
                        {selectedProduct ? 'Ingreso de IMEIs' : 'Equipos Serializados'}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {selectedProduct
                            ? `Escaneando para: ${selectedProduct.name}`
                            : 'Gestión de equipos con número de serie / IMEI'}
                    </p>
                </div>
                <button
                    onClick={loadData}
                    className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-all bg-white"
                    title="Actualizar"
                >
                    <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                </button>
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
