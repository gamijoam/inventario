import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
    Archive,
    Barcode,
    Boxes,
    Calendar,
    Check,
    ChevronRight,
    Database,
    Download,
    Eye,
    FileSpreadsheet,
    FileText,
    Filter,
    Layers,
    Package,
    Search,
    Save,
    Tag,
    Trash2,
    X,
} from 'lucide-react';
import apiClient from '../../config/axios';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { cn } from '../../utils/cn';

const TODAY = new Date().toISOString().split('T')[0];
const MONTH_START = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

const PRODUCT_COLUMNS = [
    { key: 'name', label: 'Producto', hint: 'Nombre visible del producto' },
    { key: 'sku', label: 'SKU / Codigo', hint: 'Codigo interno o barra' },
    { key: 'category', label: 'Categoria', hint: 'Agrupacion del catalogo' },
    { key: 'stock', label: 'Stock total', hint: 'Existencia consolidada' },
    { key: 'warehouse', label: 'Almacen', hint: 'Ubicacion de stock' },
    { key: 'warehouse_stock', label: 'Stock almacen', hint: 'Existencia por almacen' },
    { key: 'min_stock', label: 'Stock minimo', hint: 'Nivel de alerta' },
    { key: 'status', label: 'Estado stock', hint: 'Disponible, bajo o agotado' },
    { key: 'price', label: 'Precio venta', hint: 'Precio base del POS', sensitive: true },
    { key: 'cost_price', label: 'Costo', hint: 'Costo interno', sensitive: true },
    { key: 'profit_margin', label: 'Margen %', hint: 'Margen configurado', sensitive: true },
    { key: 'tax_rate', label: 'IVA %', hint: 'Impuesto del producto' },
    { key: 'supplier', label: 'Proveedor', hint: 'Proveedor asignado' },
    { key: 'location', label: 'Ubicacion', hint: 'Pasillo, vitrina o repisa' },
    { key: 'type', label: 'Tipo', hint: 'Producto, serial, servicio o combo' },
    { key: 'description', label: 'Descripcion', hint: 'Notas del catalogo' },
];

const KARDEX_COLUMNS = [
    { key: 'date', label: 'Fecha', hint: 'Fecha y hora del movimiento' },
    { key: 'product', label: 'Producto', hint: 'Producto afectado' },
    { key: 'sku', label: 'SKU / Codigo', hint: 'Codigo del producto' },
    { key: 'movement_type', label: 'Movimiento', hint: 'Venta, compra, ajuste...' },
    { key: 'quantity', label: 'Cantidad', hint: 'Entrada o salida' },
    { key: 'balance_after', label: 'Saldo despues', hint: 'Stock luego del movimiento' },
    { key: 'warehouse', label: 'Almacen', hint: 'Almacen afectado' },
    { key: 'description', label: 'Descripcion', hint: 'Detalle del movimiento' },
];

const SERIAL_COLUMNS = [
    { key: 'product', label: 'Producto', hint: 'Equipo asociado' },
    { key: 'sku', label: 'SKU / Codigo', hint: 'Codigo del producto' },
    { key: 'serial_number', label: 'Serial / IMEI', hint: 'Identificador unico' },
    { key: 'status', label: 'Estado', hint: 'Disponible, vendido, etc.' },
    { key: 'color_name', label: 'Color', hint: 'Color registrado' },
    { key: 'color_hex', label: 'Color HEX', hint: 'Codigo de color' },
    { key: 'warehouse', label: 'Almacen', hint: 'Almacen actual' },
    { key: 'cost', label: 'Costo', hint: 'Costo del equipo', sensitive: true },
    { key: 'created_at', label: 'Fecha recepcion', hint: 'Cuando entro al inventario' },
];

const EXPORT_TYPES = [
    {
        key: 'catalog_basic',
        title: 'Catalogo simple',
        subtitle: 'Lista ligera para conteos o revision rapida.',
        icon: Package,
        tone: 'indigo',
        columns: PRODUCT_COLUMNS,
        defaults: ['name', 'sku', 'category', 'stock', 'status'],
    },
    {
        key: 'catalog_prices',
        title: 'Catalogo con precios',
        subtitle: 'Productos con precio base, costo y listas activas.',
        icon: Tag,
        tone: 'emerald',
        columns: PRODUCT_COLUMNS,
        defaults: ['name', 'sku', 'category', 'price', 'cost_price', 'stock'],
        priceLists: true,
    },
    {
        key: 'stock',
        title: 'Stock por almacen',
        subtitle: 'Existencias por ubicacion y estado de inventario.',
        icon: Boxes,
        tone: 'blue',
        columns: PRODUCT_COLUMNS,
        defaults: ['name', 'sku', 'category', 'warehouse', 'warehouse_stock', 'stock', 'min_stock', 'status'],
    },
    {
        key: 'kardex',
        title: 'Historial / Kardex',
        subtitle: 'Todo lo que paso con un producto por fecha.',
        icon: Archive,
        tone: 'violet',
        columns: KARDEX_COLUMNS,
        defaults: ['date', 'product', 'sku', 'movement_type', 'quantity', 'balance_after', 'warehouse', 'description'],
        dateRange: true,
    },
    {
        key: 'serials',
        title: 'Seriales e IMEI',
        subtitle: 'Equipos individuales, colores, estado y almacen.',
        icon: Barcode,
        tone: 'cyan',
        columns: SERIAL_COLUMNS,
        defaults: ['product', 'sku', 'serial_number', 'status', 'color_name', 'warehouse', 'created_at'],
    },
];

const STOCK_FILTERS = [
    { value: '', label: 'Todos' },
    { value: 'in_stock', label: 'Con stock' },
    { value: 'low_stock', label: 'Stock bajo' },
    { value: 'out_of_stock', label: 'Agotados' },
];

const MOVEMENT_TYPES = [
    { value: 'ALL', label: 'Todos' },
    { value: 'SALE', label: 'Ventas' },
    { value: 'PURCHASE', label: 'Compras' },
    { value: 'RETURN', label: 'Devoluciones' },
    { value: 'ADJUSTMENT', label: 'Ajustes' },
    { value: 'TRANSFER_IN', label: 'Traslados entrada' },
    { value: 'TRANSFER_OUT', label: 'Traslados salida' },
    { value: 'EXTERNAL_TRANSFER_IN', label: 'Externos entrada' },
    { value: 'EXTERNAL_TRANSFER_OUT', label: 'Externos salida' },
];

const FORMAT_OPTIONS = [
    { value: 'xlsx', label: 'Excel', icon: FileSpreadsheet, hint: 'Con resumen, filtros y columnas ajustadas.' },
    { value: 'csv', label: 'CSV', icon: FileText, hint: 'Ligero para importar en otros sistemas.' },
];

const STORAGE_KEY = 'inventory_export_templates_v2';

const toneClass = {
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-700',
};

const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
};

const getFilenameFromDisposition = (disposition, fallback) => {
    if (!disposition) return fallback;
    const match = disposition.match(/filename\*?=(?:UTF-8''|\")?([^\";]+)/i);
    return match ? decodeURIComponent(match[1].replace(/\"/g, '')) : fallback;
};

const InventoryExportCenter = ({ isOpen, onClose }) => {
    const [selectedType, setSelectedType] = useState('catalog_basic');
    const [columns, setColumns] = useState(EXPORT_TYPES[0].defaults);
    const [categories, setCategories] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [loadingMeta, setLoadingMeta] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [preview, setPreview] = useState(null);
    const [format, setFormat] = useState('xlsx');
    const [templates, setTemplates] = useState([]);
    const [templateName, setTemplateName] = useState('');
    const [productSuggestions, setProductSuggestions] = useState([]);
    const [productSearchLoading, setProductSearchLoading] = useState(false);
    const [showProductSuggestions, setShowProductSuggestions] = useState(false);
    const [filters, setFilters] = useState({
        search: '',
        category_id: '',
        warehouse_id: '',
        stock_filter: '',
        movement_type: 'ALL',
        start_date: MONTH_START,
        end_date: TODAY,
        include_inactive: false,
        include_price_lists: false,
        limit: 5000,
    });

    const activeType = useMemo(
        () => EXPORT_TYPES.find(item => item.key === selectedType) || EXPORT_TYPES[0],
        [selectedType]
    );

    useEffect(() => {
        if (!isOpen) return;
        setLoadingMeta(true);
        Promise.allSettled([
            apiClient.get('/categories'),
            apiClient.get('/warehouses'),
        ]).then(([cat, wh]) => {
            if (cat.status === 'fulfilled') setCategories(cat.value.data || []);
            if (wh.status === 'fulfilled') setWarehouses(wh.value.data || []);
        }).finally(() => setLoadingMeta(false));

        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            setTemplates(Array.isArray(saved) ? saved : []);
        } catch {
            setTemplates([]);
        }
    }, [isOpen]);

    useEffect(() => {
        const nextType = EXPORT_TYPES.find(item => item.key === selectedType) || EXPORT_TYPES[0];
        setColumns(nextType.defaults);
        setFilters(prev => ({ ...prev, include_price_lists: Boolean(nextType.priceLists) }));
        setPreview(null);
    }, [selectedType]);

    useEffect(() => {
        setPreview(null);
    }, [columns, filters, format, selectedType]);

    useEffect(() => {
        if (!isOpen) return undefined;

        const term = String(filters.search || '').trim();
        if (term.length < 2) {
            setProductSuggestions([]);
            setProductSearchLoading(false);
            return undefined;
        }

        let cancelled = false;
        setProductSearchLoading(true);
        const timer = window.setTimeout(async () => {
            try {
                const { data } = await apiClient.get('/products', {
                    params: { search: term, limit: 8 },
                });
                if (cancelled) return;
                const results = Array.isArray(data) ? data : (data?.items || []);
                setProductSuggestions(results.slice(0, 8));
            } catch {
                if (!cancelled) setProductSuggestions([]);
            } finally {
                if (!cancelled) setProductSearchLoading(false);
            }
        }, 250);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [filters.search, isOpen]);

    if (!isOpen) return null;

    const toggleColumn = (key) => {
        setColumns(prev => prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key]);
    };

    const selectAllColumns = () => setColumns(activeType.columns.map(item => item.key));
    const resetColumns = () => setColumns(activeType.defaults);

    const updateFilter = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const selectProductSuggestion = (product) => {
        const nextSearch = product?.name || product?.sku || '';
        updateFilter('search', nextSearch);
        setShowProductSuggestions(false);
    };

    const buildPayload = () => ({
        export_type: selectedType,
        columns,
        format,
        search: filters.search || undefined,
        category_id: filters.category_id ? Number(filters.category_id) : undefined,
        warehouse_id: filters.warehouse_id ? Number(filters.warehouse_id) : undefined,
        stock_filter: filters.stock_filter || undefined,
        movement_type: filters.movement_type || undefined,
        start_date: activeType.dateRange ? filters.start_date : undefined,
        end_date: activeType.dateRange ? filters.end_date : undefined,
        include_inactive: filters.include_inactive,
        include_price_lists: filters.include_price_lists,
        limit: Number(filters.limit || 5000),
    });

    const handlePreview = async () => {
        if (!columns.length) {
            toast.error('Selecciona al menos una columna para previsualizar.');
            return;
        }
        setPreviewLoading(true);
        try {
            const response = await apiClient.post('/inventory/export/preview', buildPayload());
            setPreview(response.data || null);
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'No se pudo preparar la vista previa.'));
        } finally {
            setPreviewLoading(false);
        }
    };

    const persistTemplates = (nextTemplates) => {
        setTemplates(nextTemplates);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextTemplates));
    };

    const saveTemplate = () => {
        const name = templateName.trim();
        if (!name) {
            toast.error('Coloca un nombre para la plantilla.');
            return;
        }
        const template = {
            id: `${Date.now()}`,
            name,
            export_type: selectedType,
            columns,
            filters,
            format,
            created_at: new Date().toISOString(),
        };
        persistTemplates([template, ...templates.filter(item => item.name.toLowerCase() !== name.toLowerCase())].slice(0, 8));
        setTemplateName('');
        toast.success('Plantilla guardada.');
    };

    const loadTemplate = (template) => {
        const nextColumns = Array.isArray(template.columns) && template.columns.length ? template.columns : columns;
        const nextFilters = template.filters || {};
        setSelectedType(template.export_type || 'catalog_basic');
        setFormat(template.format || 'xlsx');
        setPreview(null);
        setTimeout(() => {
            setFilters(prev => ({ ...prev, ...nextFilters }));
            setColumns(nextColumns);
        }, 0);
        toast.success('Plantilla aplicada.');
    };

    const deleteTemplate = (templateId) => {
        persistTemplates(templates.filter(item => item.id !== templateId));
    };

    const handleDownload = async () => {
        if (!columns.length) {
            toast.error('Selecciona al menos una columna para descargar.');
            return;
        }
        setDownloading(true);
        try {
            const response = await apiClient.post('/inventory/export/modular', buildPayload(), { responseType: 'blob' });
            const extension = format === 'csv' ? 'csv' : 'xlsx';
            const filename = getFilenameFromDisposition(
                response.headers?.['content-disposition'],
                `inventario_${selectedType}.${extension}`
            );
            downloadBlob(response.data, filename);
            toast.success('Descarga generada correctamente.');
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'No se pudo generar la descarga.'));
        } finally {
            setDownloading(false);
        }
    };

    const activeFilters = [
        filters.search && 'Busqueda',
        filters.category_id && 'Categoria',
        filters.warehouse_id && 'Almacen',
        filters.stock_filter && 'Stock',
        activeType.dateRange && 'Fechas',
        filters.include_inactive && 'Incluye inactivos',
        filters.include_price_lists && 'Listas de precio',
        format === 'csv' && 'CSV',
    ].filter(Boolean);

    return (
        <div className="fixed inset-0 z-[90] bg-slate-950/50 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true">
            <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-white shadow-sm shadow-indigo-200">
                            <Database size={21} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-wide text-slate-400">Inventario</p>
                            <h2 className="truncate text-xl font-black text-slate-900">Centro de exportaciones</h2>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Cerrar exportaciones">
                        <X size={20} />
                    </button>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[330px_1fr]">
                    <aside className="min-h-0 overflow-y-auto border-b border-slate-200 bg-slate-50 p-3 lg:border-b-0 lg:border-r">
                        <div className="mb-2 flex items-center justify-between px-1">
                            <span className="text-xs font-black uppercase tracking-wide text-slate-400">Que quieres descargar</span>
                            <span className="rounded-md bg-white px-2 py-1 text-[10px] font-black text-slate-500 shadow-sm">Excel / CSV</span>
                        </div>
                        <div className="space-y-2">
                            {EXPORT_TYPES.map(item => {
                                const Icon = item.icon;
                                const selected = selectedType === item.key;
                                return (
                                    <button
                                        key={item.key}
                                        type="button"
                                        onClick={() => setSelectedType(item.key)}
                                        className={cn(
                                            'w-full rounded-lg border p-3 text-left transition-all',
                                            selected ? 'border-indigo-300 bg-white shadow-sm ring-2 ring-indigo-100' : 'border-slate-200 bg-white/70 hover:bg-white hover:shadow-sm'
                                        )}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-md border', toneClass[item.tone])}>
                                                <Icon size={18} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-2">
                                                    <h3 className="text-sm font-black text-slate-900">{item.title}</h3>
                                                    {selected && <Check size={16} className="text-indigo-600" />}
                                                </div>
                                                <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">{item.subtitle}</p>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </aside>

                    <main className="min-h-0 overflow-y-auto bg-white">
                        <div className="border-b border-slate-100 p-4 sm:p-5">
                            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-md border', toneClass[activeType.tone])}>
                                            {(() => { const Icon = activeType.icon; return <Icon size={17} />; })()}
                                        </span>
                                        <div>
                                            <h3 className="text-lg font-black text-slate-900">{activeType.title}</h3>
                                            <p className="text-sm font-medium text-slate-500">{activeType.subtitle}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-black text-slate-600">
                                        {columns.length} columnas
                                    </span>
                                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-black text-slate-600">
                                        {activeFilters.length || 0} filtros
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[1fr_310px]">
                            <section className="space-y-4">
                                <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <Filter size={16} className="text-indigo-500" />
                                            <h4 className="text-sm font-black text-slate-900">Filtros</h4>
                                        </div>
                                        {loadingMeta && <span className="text-xs font-bold text-slate-400">Cargando opciones...</span>}
                                    </div>
                                    <div className="grid gap-3 p-4 md:grid-cols-2">
                                        <label className="md:col-span-2">
                                            <span className="text-xs font-black uppercase tracking-wide text-slate-400">Buscar producto, SKU, IMEI o descripcion</span>
                                            <div className="relative mt-1">
                                                <div className="flex h-11 items-center gap-2 rounded-md border border-slate-200 px-3 focus-within:border-indigo-300">
                                                    <Search size={17} className="text-slate-400" />
                                                    <input
                                                        value={filters.search}
                                                        onChange={e => {
                                                            updateFilter('search', e.target.value);
                                                            setShowProductSuggestions(true);
                                                        }}
                                                        onFocus={() => setShowProductSuggestions(true)}
                                                        onBlur={() => window.setTimeout(() => setShowProductSuggestions(false), 120)}
                                                        placeholder="Ej: itel a100, bateria, 357..."
                                                        className="h-full flex-1 bg-transparent text-sm font-medium text-slate-700 outline-none"
                                                    />
                                                </div>
                                                {showProductSuggestions && String(filters.search || '').trim().length >= 2 && (
                                                    <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                                                        {productSearchLoading ? (
                                                            <div className="flex items-center gap-2 px-3 py-3 text-sm font-bold text-slate-500">
                                                                <Search size={15} className="animate-pulse text-indigo-500" />
                                                                Buscando productos...
                                                            </div>
                                                        ) : productSuggestions.length > 0 ? (
                                                            productSuggestions.map(product => (
                                                                <button
                                                                    key={product.id || product.sku || product.name}
                                                                    type="button"
                                                                    onMouseDown={event => event.preventDefault()}
                                                                    onClick={() => selectProductSuggestion(product)}
                                                                    className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-indigo-50"
                                                                >
                                                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                                                                        <Package size={16} />
                                                                    </span>
                                                                    <span className="min-w-0 flex-1">
                                                                        <span className="block truncate text-sm font-black text-slate-800">{product.name || 'Producto sin nombre'}</span>
                                                                        <span className="block truncate text-xs font-bold text-slate-400">{product.sku || 'Sin SKU'}</span>
                                                                    </span>
                                                                    <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">
                                                                        {Number(product.stock ?? product.total_stock ?? 0)} un.
                                                                    </span>
                                                                </button>
                                                            ))
                                                        ) : (
                                                            <div className="px-3 py-3 text-sm font-bold text-slate-500">
                                                                Sin sugerencias. Puedes buscar igual por texto, SKU, IMEI o descripcion.
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </label>

                                        <label>
                                            <span className="text-xs font-black uppercase tracking-wide text-slate-400">Categoria</span>
                                            <select value={filters.category_id} onChange={e => updateFilter('category_id', e.target.value)} className="mt-1 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-300">
                                                <option value="">Todas</option>
                                                {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                                            </select>
                                        </label>

                                        <label>
                                            <span className="text-xs font-black uppercase tracking-wide text-slate-400">Almacen</span>
                                            <select value={filters.warehouse_id} onChange={e => updateFilter('warehouse_id', e.target.value)} className="mt-1 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-300">
                                                <option value="">Todos</option>
                                                {warehouses.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                                            </select>
                                        </label>

                                        {selectedType !== 'kardex' && selectedType !== 'serials' && (
                                            <label>
                                                <span className="text-xs font-black uppercase tracking-wide text-slate-400">Estado de stock</span>
                                                <select value={filters.stock_filter} onChange={e => updateFilter('stock_filter', e.target.value)} className="mt-1 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-300">
                                                    {STOCK_FILTERS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                                                </select>
                                            </label>
                                        )}

                                        {selectedType === 'kardex' && (
                                            <>
                                                <label>
                                                    <span className="text-xs font-black uppercase tracking-wide text-slate-400">Desde</span>
                                                    <div className="mt-1 flex h-11 items-center gap-2 rounded-md border border-slate-200 px-3 focus-within:border-indigo-300">
                                                        <Calendar size={16} className="text-slate-400" />
                                                        <input type="date" value={filters.start_date} onChange={e => updateFilter('start_date', e.target.value)} className="h-full flex-1 bg-transparent text-sm font-bold text-slate-700 outline-none" />
                                                    </div>
                                                </label>
                                                <label>
                                                    <span className="text-xs font-black uppercase tracking-wide text-slate-400">Hasta</span>
                                                    <div className="mt-1 flex h-11 items-center gap-2 rounded-md border border-slate-200 px-3 focus-within:border-indigo-300">
                                                        <Calendar size={16} className="text-slate-400" />
                                                        <input type="date" value={filters.end_date} onChange={e => updateFilter('end_date', e.target.value)} className="h-full flex-1 bg-transparent text-sm font-bold text-slate-700 outline-none" />
                                                    </div>
                                                </label>
                                                <label className="md:col-span-2">
                                                    <span className="text-xs font-black uppercase tracking-wide text-slate-400">Tipo de movimiento</span>
                                                    <select value={filters.movement_type} onChange={e => updateFilter('movement_type', e.target.value)} className="mt-1 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-300">
                                                        {MOVEMENT_TYPES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                                                    </select>
                                                </label>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <Layers size={16} className="text-indigo-500" />
                                            <h4 className="text-sm font-black text-slate-900">Columnas del Excel</h4>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={resetColumns} className="rounded-md px-2 py-1 text-xs font-black text-slate-500 hover:bg-slate-50">Base</button>
                                            <button onClick={selectAllColumns} className="rounded-md px-2 py-1 text-xs font-black text-indigo-600 hover:bg-indigo-50">Todas</button>
                                        </div>
                                    </div>
                                    <div className="grid gap-2 p-4 md:grid-cols-2">
                                        {activeType.columns.map(column => {
                                            const checked = columns.includes(column.key);
                                            return (
                                                <button
                                                    key={column.key}
                                                    type="button"
                                                    onClick={() => toggleColumn(column.key)}
                                                    className={cn(
                                                        'min-h-[68px] rounded-md border p-3 text-left transition-colors',
                                                        checked ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                                                    )}
                                                >
                                                    <div className="flex items-start gap-2">
                                                        <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border', checked ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white')}>
                                                            {checked && <Check size={13} />}
                                                        </span>
                                                        <span className="min-w-0">
                                                            <span className="flex flex-wrap items-center gap-1 text-sm font-black text-slate-800">
                                                                {column.label}
                                                                {column.sensitive && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-700">Sensible</span>}
                                                            </span>
                                                            <span className="mt-0.5 block text-xs font-medium leading-relaxed text-slate-500">{column.hint}</span>
                                                        </span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </section>

                            <aside className="space-y-4">
                                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                                    <div className="flex items-center gap-2 text-indigo-700">
                                        <FileSpreadsheet size={18} />
                                        <h4 className="text-sm font-black">Resumen</h4>
                                    </div>
                                    <div className="mt-4 space-y-3">
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-bold text-indigo-500">Descarga</span>
                                            <span className="text-right font-black text-indigo-950">{activeType.title}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-bold text-indigo-500">Columnas</span>
                                            <span className="font-black text-indigo-950">{columns.length}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-bold text-indigo-500">Registros</span>
                                            <span className="font-black text-indigo-950">{preview ? preview.total_rows : 'Sin calcular'}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-bold text-indigo-500">Limite</span>
                                            <input
                                                type="number"
                                                min="100"
                                                max="20000"
                                                value={filters.limit}
                                                onChange={e => updateFilter('limit', e.target.value)}
                                                className="h-9 w-28 rounded-md border border-indigo-200 bg-white px-2 text-right text-sm font-black text-indigo-950 outline-none focus:border-indigo-400"
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-1.5">
                                        {activeFilters.length ? activeFilters.map(item => (
                                            <span key={item} className="rounded-md bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wide text-indigo-600">{item}</span>
                                        )) : <span className="text-xs font-bold text-indigo-400">Sin filtros adicionales</span>}
                                    </div>
                                    {preview?.sample?.length > 0 && (
                                        <div className="mt-4 rounded-md border border-indigo-100 bg-white p-3">
                                            <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-indigo-400">Muestra</div>
                                            <div className="space-y-1.5">
                                                {preview.sample.slice(0, 3).map((row, idx) => (
                                                    <div key={idx} className="truncate rounded bg-slate-50 px-2 py-1 text-xs font-bold text-slate-600">
                                                        {Object.values(row).slice(0, 3).join(' / ') || 'Fila sin datos'}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                                    <h4 className="text-sm font-black text-slate-900">Formato</h4>
                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        {FORMAT_OPTIONS.map(option => {
                                            const Icon = option.icon;
                                            const selected = format === option.value;
                                            return (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => setFormat(option.value)}
                                                    className={cn('rounded-md border p-3 text-left transition-colors', selected ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}
                                                >
                                                    <Icon size={17} />
                                                    <span className="mt-2 block text-sm font-black">{option.label}</span>
                                                    <span className="mt-1 block text-[11px] font-medium leading-relaxed text-slate-500">{option.hint}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="flex items-center justify-between gap-2">
                                        <h4 className="text-sm font-black text-slate-900">Plantillas</h4>
                                        <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">{templates.length}/8</span>
                                    </div>
                                    <div className="mt-3 flex gap-2">
                                        <input
                                            value={templateName}
                                            onChange={e => setTemplateName(e.target.value)}
                                            placeholder="Ej: Stock semanal"
                                            className="h-10 min-w-0 flex-1 rounded-md border border-slate-200 px-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-300"
                                        />
                                        <button onClick={saveTemplate} className="inline-flex h-10 items-center gap-1 rounded-md bg-slate-900 px-3 text-xs font-black text-white hover:bg-slate-800">
                                            <Save size={14} /> Guardar
                                        </button>
                                    </div>
                                    <div className="mt-3 space-y-2">
                                        {templates.length === 0 ? (
                                            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-400">Sin plantillas guardadas.</div>
                                        ) : templates.map(template => (
                                            <div key={template.id} className="flex items-center gap-2 rounded-md border border-slate-200 p-2">
                                                <button onClick={() => loadTemplate(template)} className="min-w-0 flex-1 text-left">
                                                    <span className="block truncate text-sm font-black text-slate-800">{template.name}</span>
                                                    <span className="block truncate text-[11px] font-bold text-slate-400">{EXPORT_TYPES.find(item => item.key === template.export_type)?.title || template.export_type} · {(template.format || 'xlsx').toUpperCase()}</span>
                                                </button>
                                                <button onClick={() => deleteTemplate(template.id)} className="rounded p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Eliminar plantilla">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                                    <h4 className="text-sm font-black text-slate-900">Opciones</h4>
                                    <div className="mt-3 space-y-2">
                                        <label className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
                                            <span>
                                                <span className="block text-sm font-black text-slate-800">Incluir inactivos</span>
                                                <span className="text-xs font-medium text-slate-500">Productos ocultos o eliminados logicamente.</span>
                                            </span>
                                            <input type="checkbox" checked={filters.include_inactive} onChange={e => updateFilter('include_inactive', e.target.checked)} className="h-4 w-4 accent-indigo-600" />
                                        </label>
                                        {(selectedType === 'catalog_basic' || selectedType === 'catalog_prices' || selectedType === 'prices') && (
                                            <label className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
                                                <span>
                                                    <span className="block text-sm font-black text-slate-800">Listas de precio</span>
                                                    <span className="text-xs font-medium text-slate-500">Agrega una columna por cada lista activa.</span>
                                                </span>
                                                <input type="checkbox" checked={filters.include_price_lists} onChange={e => updateFilter('include_price_lists', e.target.checked)} className="h-4 w-4 accent-indigo-600" />
                                            </label>
                                        )}
                                    </div>
                                </div>
                            </aside>
                        </div>
                    </main>
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                        <FileSpreadsheet size={15} className="text-emerald-600" />
                        {format === 'csv' ? 'Se generara un CSV con los datos filtrados.' : 'Se generara un Excel con hoja de resumen y datos filtrados.'}
                    </div>
                    <div className="flex items-center justify-end gap-2">
                        <button onClick={onClose} className="h-11 rounded-md px-4 text-sm font-black text-slate-600 hover:bg-white">Cancelar</button>
                        <button
                            onClick={handlePreview}
                            disabled={previewLoading || !columns.length}
                            className="inline-flex h-11 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <Eye className={previewLoading ? 'animate-pulse' : ''} size={17} />
                            {previewLoading ? 'Calculando...' : 'Vista previa'}
                        </button>
                        <button
                            onClick={handleDownload}
                            disabled={downloading || !columns.length}
                            className="inline-flex h-11 items-center gap-2 rounded-md bg-indigo-600 px-5 text-sm font-black text-white shadow-sm shadow-indigo-200 transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {downloading ? <Download className="animate-pulse" size={17} /> : <Download size={17} />}
                            {downloading ? 'Generando...' : `Descargar ${format.toUpperCase()}`}
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InventoryExportCenter;
