import { useState, useEffect } from 'react';
import { X, Plus, Package, DollarSign, Barcode, Tag, Layers, AlertTriangle, ShieldCheck, Calculator, Image as ImageIcon, Check, Warehouse, AlertCircle, ScanBarcode, Zap, Search, ChevronDown, Scissors, Snowflake, Shield, UtensilsCrossed, ChefHat } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import apiClient from '../../config/axios';
import ProductPriceListManager from './ProductPriceListManager';
import ProductUnitManager from './ProductUnitManager';
import ComboManager from './ComboManager';
import ProductImageUploader from './ProductImageUploader';
import DiscountRulesManager from './DiscountRulesManager';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import BarcodeScannerComponent from '../common/BarcodeScanner';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
} from '../../components/ui/sheet';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '../../components/ui/tabs';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '../../components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Separator } from '../../components/ui/separator';
import { Textarea } from '../../components/ui/textarea';
import { normalizeSearch } from '../../utils/search';
import { getApiErrorMessage } from '../../utils/apiErrors';

const ProductForm = ({ isOpen, onClose, onSubmit, initialData = null, categories = [], warehouses = [], exchangeRates = [] }) => {
    const { getActiveCurrencies, currencies, modules } = useConfig();
    const useGrossMargin = useFeatureFlag('precio_margen_bruto');
    const anchorCurrency = currencies.find(c => c.is_anchor) || { symbol: '$' };

    // categories, warehouses, and exchangeRates are now props. No need for local state for them if we trust the parent.
    // However, if we want to ensure they are available even if parent didn't pass them (fallback), we could keep state, but for performance let's rely on props.
    // We still need local state for priceLists as parent doesn't have it.

    const [priceLists, setPriceLists] = useState([]);
    const [listPct, setListPct] = useState(45);

    // Margen por defecto para "Calcular" — fetched desde /config (config-center).
    // Si el setting existe y es válido, sobreescribe el 45 hardcoded.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data } = await apiClient.get('/config/default_price_list_margin');
                const v = parseFloat(data?.value);
                if (!cancelled && Number.isFinite(v)) setListPct(v);
            } catch (_) { /* fallback: mantener 45 si falla */ }
        })();
        return () => { cancelled = true; };
    }, []);

    // ── Crear categoría inline ────────────────────────────────────────────────
    const handleCreateCategory = async () => {
        const name = newCategoryName.trim();
        if (!name) return;
        setSavingCategory(true);
        try {
            const res = await apiClient.post('/categories', { name, description: '' });
            const created = res.data;
            // Notificar al padre para que refresque las categorías
            if (typeof window.__refreshCategories === 'function') {
                await window.__refreshCategories();
            }
            // Seleccionar la nueva categoría automáticamente
            setFormData(prev => ({ ...prev, category_id: created.id.toString() }));
            setNewCategoryName('');
            setShowNewCategoryInput(false);
            setIsCategoryOpen(false);
            toast.success(`Categoría "${name}" creada y seleccionada`);
        } catch (e) {
            const msg = e.response?.data?.detail || 'Error al crear la categoría';
            toast.error(typeof msg === 'string' ? msg : 'Error al crear la categoría');
        } finally {
            setSavingCategory(false);
        }
    };
    const [policies, setPolicies] = useState([]); // NEW: Warranty Policies
    const [formData, setFormData] = useState({
        name: '',
        sku: '',
        category_id: null,
        cost: 0,
        price: 0,
        stock: 0,
        min_stock: 5,
        location: '',
        margin: 0,
        unit_type: 'UNID',
        exchange_rate_id: null,
        is_combo: false,
        has_imei: false,
        is_service: false,  // NEW: Service/Non-stock product flag
        is_menu_item: false,
        is_barbershop_service: false,
        commission_amount: '',
        commission_percentage: '',
        is_commissionable: false, // NEW: Commission flag
        warranty_policy_id: null, // NEW: Linked Policy
        profit_margin: null,
        discount_percentage: 0,
        is_discount_active: false,
        tax_rate: 0,
        units: [],
        combo_items: [],
        warehouse_stocks: [],
        prices: {},
        image_url: '',
        // Pharmacy fields
        drug_classification: '',
        active_ingredient: '',
        storage_condition: '',
        requires_prescription: false
    });

    const [isScanning, setIsScanning] = useState(false);
    const [openSections, setOpenSections] = useState({
        priceLists: false,
        inventory: true,
        imei: false,
        units: false,
        combo: true,
        warranty: false,
        discounts: false,
        pharmacy: false,
    });

    const toggleSection = (section) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // Category dropdown specific state
    const [isCategoryOpen, setIsCategoryOpen] = useState(false);
    const [categorySearchTerm, setCategorySearchTerm] = useState('');
    const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
    const [newCategoryName, setNewCategoryName]           = useState('');
    const [savingCategory, setSavingCategory]             = useState(false);

    const handleScanResult = (code) => {
        setFormData(prev => ({ ...prev, sku: code }));
        setIsScanning(false);
    };

    // --- DATA FETCHING & INIT LOGIC ---
    useEffect(() => {
        if (isOpen) {
            // Only fetch what we don't have
            const loadMissingData = async () => {
                try {
                    await Promise.all([
                        fetchPriceLists(),
                        fetchPolicies(), // NEW
                        fetchDefaultTaxRate()
                    ]);
                } catch (error) {
                    console.error("Error loading form dependencies", error);
                }
            };
            loadMissingData();

            if (initialData) {
                const mappedUnits = (initialData.units || []).map(u => {
                    const isPacking = u.conversion_factor >= 1;
                    return {
                        id: u.id || Date.now() + Math.random(),
                        unit_name: u.unit_name,
                        user_input: isPacking ? u.conversion_factor : (u.conversion_factor > 0 ? 1 / u.conversion_factor : 1000),
                        conversion_factor: u.conversion_factor,
                        type: isPacking ? 'packing' : 'fraction',
                        barcode: u.barcode || '',
                        price_usd: u.price_usd || 0,
                        exchange_rate_id: u.exchange_rate_id || null,
                        discount_percentage: u.discount_percentage || 0,
                        is_discount_active: u.is_discount_active || false
                    };
                });

                const initialPrices = {};
                if (initialData.prices && Array.isArray(initialData.prices)) {
                    initialData.prices.forEach(p => initialPrices[p.price_list_id] = p.price);
                }

                setFormData({
                    name: initialData.name || '',
                    sku: initialData.sku || '',
                    category_id: initialData.category_id || null,
                    cost: parseFloat(initialData.cost_price) || 0,
                    price: parseFloat(initialData.price) || 0,
                    stock: parseFloat(initialData.stock) || 0,
                    min_stock: parseFloat(initialData.min_stock) || 5,
                    location: initialData.location || '',
                    unit_type: initialData.unit_type || 'UNID',
                    margin: initialData.price > 0 ? ((initialData.price - initialData.cost_price) / initialData.price) * 100 : 0,
                    exchange_rate_id: initialData.exchange_rate_id || null,
                    is_combo: initialData.is_combo || false,
                    has_imei: initialData.has_imei || false,
                    is_service: initialData.is_service || false,
                    is_menu_item: initialData.is_menu_item || false,
                    needs_kitchen: initialData.needs_kitchen !== undefined ? initialData.needs_kitchen : true,
                    is_barbershop_service: initialData.is_barbershop_service || false,
                    commission_amount: initialData.commission_amount || '',
                    commission_percentage: initialData.commission_percentage || '',
                    is_commissionable: initialData.is_commissionable || false, // NEW
                    warranty_policy_id: initialData.warranty_policy_id || null, // NEW
                    profit_margin: initialData.profit_margin ? parseFloat(initialData.profit_margin) : null,
                    discount_percentage: parseFloat(initialData.discount_percentage) || 0,
                    is_discount_active: initialData.is_discount_active || false,
                    tax_rate: initialData.tax_rate !== undefined ? parseFloat(initialData.tax_rate) : 0,
                    units: mappedUnits,
                    combo_items: initialData.combo_items || [],
                    warehouse_stocks: initialData.stocks || [],
                    prices: initialPrices,
                    image_url: initialData.image_url || '',
                    // Pharmacy fields
                    drug_classification: initialData.drug_classification || '',
                    active_ingredient: initialData.active_ingredient || '',
                    storage_condition: initialData.storage_condition || '',
                    requires_prescription: initialData.requires_prescription || false
                });
            } else {
                setFormData({
                    name: '', sku: '', category_id: null, cost: 0, price: 0, stock: 0, min_stock: 5, location: '',
                    margin: 0, unit_type: 'UNID', exchange_rate_id: null, is_combo: false, has_imei: false, is_service: false, is_barbershop_service: false, is_menu_item: false, needs_kitchen: true, commission_amount: '', commission_percentage: '', is_commissionable: false, units: [],
                    combo_items: [], tax_rate: 0, warehouse_stocks: [], prices: {}, image_url: '',
                    drug_classification: '', active_ingredient: '', storage_condition: '', requires_prescription: false
                });
            }
            // Reset dropdown searches when opened
            setCategorySearchTerm('');
            setIsCategoryOpen(false);
        }
    }, [isOpen, initialData]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;

        setFormData(prev => {
            const updated = { ...prev, [name]: value };

            // Logic: Cost + Margin (Profit) -> Price
            if (name === 'cost' || name === 'profit_margin') {
                const cost = name === 'cost' ? parseFloat(value) : parseFloat(prev.cost);
                const margin = name === 'profit_margin' ? parseFloat(value) : parseFloat(prev.profit_margin);

                if (!isNaN(cost) && !isNaN(margin)) {
                    const calculatedPrice = useGrossMargin ? cost / (1 - (margin / 100)) : cost * (1 + (margin / 100));
                    updated.price = calculatedPrice.toFixed(2);
                }
            }

            // Reverse Logic: If Price is edited, update Margin
            if (name === 'price') {
                const price = parseFloat(value);
                const cost = parseFloat(prev.cost);
                if (!isNaN(price) && price > 0 && !isNaN(cost) && cost > 0) {
                    const margin = useGrossMargin ? ((1 - cost / price) * 100) : ((price - cost) / cost) * 100;
                    updated.profit_margin = margin.toFixed(2);
                }
            }

            return updated;
        });
    };

    const fetchPriceLists = async () => {
        try {
            const { data } = await apiClient.get('/price-lists/');
            setPriceLists(data.filter(pl => pl.is_active));
        } catch (e) {
            console.error(e);
        }
    };

    const fetchPolicies = async () => {
        try {
            const { data } = await apiClient.get('/warranties/policies');
            setPolicies(data.filter(p => p.is_active));
        } catch (e) {
            console.error(e);
        }
    };

    const fetchDefaultTaxRate = async () => {
        if (!initialData) {
            try {
                const { data } = await apiClient.get('/config/tax-rate/default');
                setFormData(prev => ({ ...prev, tax_rate: data.rate || 0 }));
            } catch (e) {
                console.error(e);
            }
        }
    };

    const handleSubmit = () => {
        if (!formData.name.trim()) return toast.error('El nombre es obligatorio');
        if (parseFloat(formData.price) <= 0) return toast.error('El precio debe ser mayor a 0');

        const pricesArray = Object.entries(formData.prices).map(([listId, priceValue]) => ({
            price_list_id: parseInt(listId), price: parseFloat(priceValue) || 0
        })).filter(p => p.price > 0);

        const payload = {
            ...formData,
            category_id: parseInt(formData.category_id) || null,
            cost_price: parseFloat(formData.cost) || 0,
            price: parseFloat(formData.price),
            stock: parseFloat(formData.stock) || 0,
            min_stock: parseFloat(formData.min_stock) || 0,
            exchange_rate_id: formData.exchange_rate_id ? parseInt(formData.exchange_rate_id) : null,
            warranty_policy_id: formData.warranty_policy_id ? parseInt(formData.warranty_policy_id) : null,
            profit_margin: formData.profit_margin ? Math.min(parseFloat(formData.profit_margin) || 0, 999.99) : null,
            discount_percentage: parseFloat(formData.discount_percentage) || 0,
            tax_rate: parseFloat(formData.tax_rate) || 0,
            is_service: formData.is_service || false,
            is_barbershop_service: formData.is_barbershop_service || false,
            is_menu_item: formData.is_menu_item || false,
            ...(modules?.restaurant && formData.is_menu_item ? { needs_kitchen: !!formData.needs_kitchen } : {}),
            commission_amount: formData.commission_amount ? parseFloat(formData.commission_amount) : null,
            commission_percentage: formData.commission_percentage ? parseFloat(formData.commission_percentage) : null,
            is_commissionable: formData.is_commissionable || false, // NEW: Commission flag
            units: formData.units.map(u => ({
                // Incluir id solo si es un ID real del backend (no temporal)
                ...(u.id && typeof u.id === 'number' && u.id <= 10_000_000 ? { id: u.id } : {}),
                unit_name: u.unit_name,
                conversion_factor: u.type === 'fraction' ? (u.user_input !== 0 ? 1 / parseFloat(u.user_input) : 0) : parseFloat(u.user_input),
                barcode: u.barcode,
                price_usd: parseFloat(u.price_usd) || null,
                cost_price: parseFloat(u.cost_price) || null,
                profit_margin: u.profit_margin ? parseFloat(u.profit_margin) : null,
                is_default: u.is_default || false,
                exchange_rate_id: u.exchange_rate_id ? parseInt(u.exchange_rate_id) : null
            })),
            combo_items: formData.is_combo ? formData.combo_items.map(ci => ({ child_product_id: ci.child_product_id, quantity: parseFloat(ci.quantity), unit_id: ci.unit_id || null })) : [],
            prices: pricesArray,
            image_url: formData.image_url,
            // Pharmacy fields
            drug_classification: formData.drug_classification || null,
            active_ingredient: formData.active_ingredient || null,
            storage_condition: formData.storage_condition || null,
            requires_prescription: formData.requires_prescription || false
        };
        onSubmit(payload);
    };


    // ── Redondeo inteligente ──────────────────────────────────────────────────
    // Si precio base ≤ 20 → redondear al entero más cercano
    // Si precio base > 20 → redondear al múltiplo de 5 superior
    const roundPrice = (value, basePrice = null) => {
        const n = parseFloat(value);
        if (isNaN(n) || n <= 0) return String(value);
        const base = basePrice !== null ? parseFloat(basePrice) : n;
        if (base <= 20) {
            return Math.round(n).toFixed(2);
        }
        if (n % 5 === 0) return n.toFixed(2);
        return (Math.ceil(n / 5) * 5).toFixed(2);
    };
    const needsRound = (value) => {
        const n = parseFloat(value);
        if (isNaN(n) || n <= 0) return false;
        // Usar Math.round para evitar errores de punto flotante
        return Math.round(n * 100) % (5 * 100) !== 0;
    };


    const productType = formData.is_service ? 'service' : formData.is_combo ? 'combo' : formData.has_imei ? 'serial' : 'physical';
    const productTypeOptions = [
        { key: 'physical', label: 'Fisico', desc: 'Stock normal', icon: Package },
        { key: 'service', label: 'Servicio', desc: 'No descuenta stock', icon: Scissors },
        { key: 'serial', label: 'Serial / IMEI', desc: 'Una unidad por serial', icon: ScanBarcode, show: modules.services },
        { key: 'combo', label: 'Combo / kit', desc: 'Agrupa productos', icon: Layers },
    ].filter(option => option.show !== false);

    const setProductType = (type) => {
        setFormData(prev => ({
            ...prev,
            is_service: type === 'service',
            has_imei: type === 'serial',
            is_combo: type === 'combo',
            combo_items: type === 'combo' ? prev.combo_items : [],
        }));
    };

    const costValue = parseFloat(formData.cost || 0) || 0;
    const priceValue = parseFloat(formData.price || 0) || 0;
    const marginValue = parseFloat(formData.profit_margin || 0) || 0;
    const marginLabel = Number.isFinite(marginValue) ? `${marginValue.toFixed(2)}%` : '0.00%';
    const profitValue = priceValue - costValue;
    const priceWarnings = [
        priceValue <= 0 ? 'El precio de venta esta en cero.' : null,
        costValue > 0 && priceValue > 0 && costValue > priceValue ? 'El costo es mayor que el precio de venta.' : null,
        marginValue < 0 ? 'El margen calculado es negativo.' : null,
        formData.is_combo ? 'En combos, revisa que los componentes sostengan el costo real.' : null,
        formData.is_service && costValue === 0 ? 'En servicios puedes dejar costo en cero si no aplica.' : null,
    ].filter(Boolean);

    const SwitchVisual = ({ checked }) => (
        <span className={cn(
            'relative h-5 w-9 shrink-0 rounded-full transition-colors',
            checked ? 'bg-indigo-600' : 'bg-slate-200'
        )}>
            <span className={cn(
                'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                checked && 'translate-x-4'
            )} />
        </span>
    );

    const SectionHeader = ({ icon: Icon, label, color = 'text-slate-600', bg = 'bg-slate-100', children }) => (
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
                <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', bg)}>
                    <Icon size={16} className={color} />
                </div>
                <h3 className="text-sm font-black text-slate-800 tracking-tight">{label}</h3>
            </div>
            {children}
        </div>
    );

    const CollapsibleSection = ({ id, icon: Icon, label, summary, children, iconColor = 'text-indigo-600', iconBg = 'bg-indigo-100', subtle = false }) => {
        const open = openSections[id];
        return (
            <div className={cn('overflow-hidden rounded-lg border bg-white shadow-sm', subtle ? 'border-slate-200' : 'border-slate-200')}>
                <button
                    type="button"
                    onClick={() => toggleSection(id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 sm:px-5"
                >
                    <div className="flex min-w-0 items-center gap-3">
                        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', iconBg)}>
                            <Icon size={16} className={iconColor} />
                        </div>
                        <div className="min-w-0">
                            <h3 className="truncate text-sm font-black text-slate-800">{label}</h3>
                            {summary && <p className="mt-0.5 truncate text-xs font-medium text-slate-500">{summary}</p>}
                        </div>
                    </div>
                    <ChevronDown size={18} className={cn('shrink-0 text-slate-400 transition-transform', open && 'rotate-180 text-indigo-500')} />
                </button>
                {open && <div className="border-t border-slate-100">{children}</div>}
            </div>
        );
    };

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent side="right" className="w-full sm:w-[94vw] sm:max-w-[1180px] flex flex-col p-0 gap-0 border-l border-slate-200 bg-slate-50 shadow-2xl [&>button.absolute]:hidden">

                {/* ── Header fijo ─────────────────────────────────────────────── */}
                <div className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600 shadow-sm shadow-indigo-200">
                            <Package size={18} className="text-white" />
                        </div>
                        <div>
                            <h2 className="truncate text-lg font-black text-slate-900 leading-none">
                                {initialData ? 'Editar Producto' : 'Nuevo Producto'}
                            </h2>
                            {initialData && (
                                <p className="mt-1 max-w-[48vw] truncate text-xs font-bold text-slate-500">
                                    Editando: {initialData.name}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <Button variant="ghost" onClick={onClose} className="h-9 text-slate-500 hover:text-slate-700">
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            className="h-9 rounded-md bg-indigo-600 px-5 font-bold text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700"
                        >
                            <Check size={15} className="mr-1.5" /> Guardar
                        </Button>
                    </div>
                </div>

                {/* ── Body scrollable ─────────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto overscroll-contain">
                    <div className="mx-auto max-w-6xl space-y-4 px-4 py-5 pb-24 sm:px-6">

                        {/* ══ SECCIÓN 1: Imagen + Identidad ════════════════════ */}
                        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                            <div className="grid grid-cols-1 gap-5 p-4 sm:p-5 lg:grid-cols-[250px_minmax(0,1fr)]">

                                {/* Imagen */}
                                <div className="flex flex-col items-center justify-center">
                                    <ProductImageUploader
                                        currentImageUrl={formData.image_url}
                                        currentImageOriginalUrl={formData.image_url_original}
                                        productId={initialData?.id}
                                        onImageUpdate={(url) => setFormData(p => ({ ...p, image_url: url }))}
                                        onOriginalUpdate={(url) => setFormData(p => ({ ...p, image_url_original: url }))}
                                    />
                                </div>

                                {/* Campos identidad */}
                                <div className="space-y-4">
                                    {/* Nombre */}
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                            Nombre del Producto <span className="text-rose-500">*</span>
                                        </label>
                                        <Input
                                            name="name"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            placeholder="Ej: iPhone 15 Pro Max 256GB"
                                            className="h-11 font-bold text-slate-800 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20 text-base"
                                        />
                                    </div>

                                    {/* SKU + Categoría */}
                                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                                SKU / Código
                                            </label>
                                            <div className="relative">
                                                <Input
                                                    name="sku"
                                                    value={formData.sku}
                                                    onChange={handleInputChange}
                                                    placeholder="AGU-001"
                                                    className="h-10 font-mono text-sm pr-9 border-slate-200"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setIsScanning(true)}
                                                    className="absolute right-2 top-2 text-slate-400 hover:text-indigo-600 transition-colors"
                                                >
                                                    <Barcode size={18} />
                                                </button>
                                            </div>
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Categoría</label>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowNewCategoryInput(v => !v)}
                                                    className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 transition-colors"
                                                >
                                                    + Nueva
                                                </button>
                                            </div>
                                            {showNewCategoryInput ? (
                                                <div className="flex gap-1">
                                                    <Input
                                                        value={newCategoryName}
                                                        onChange={e => setNewCategoryName(e.target.value)}
                                                        placeholder="Nombre categoría"
                                                        className="h-10 text-sm flex-1"
                                                        onKeyDown={e => e.key === 'Enter' && handleCreateCategory()}
                                                    />
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        onClick={handleCreateCategory}
                                                        disabled={savingCategory}
                                                        className="h-10 bg-indigo-600 hover:bg-indigo-700 text-white px-3"
                                                    >
                                                        {savingCategory ? '...' : <Check size={14} />}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="relative">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsCategoryOpen(v => !v)}
                                                        className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm text-left flex items-center justify-between bg-white hover:border-indigo-400 transition-colors"
                                                    >
                                                        <span className={cn('font-medium truncate', !formData.category_id && 'text-slate-400')}>
                                                            {categories.find(c => c.id?.toString() === formData.category_id?.toString())?.name || 'Sin categoría'}
                                                        </span>
                                                        <ChevronDown size={14} className="text-slate-400 flex-shrink-0 ml-2" />
                                                    </button>
                                                    {isCategoryOpen && (
                                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                                                            <div className="p-2 border-b border-slate-100">
                                                                <Input
                                                                    placeholder="Buscar..."
                                                                    value={categorySearchTerm}
                                                                    onChange={e => setCategorySearchTerm(e.target.value)}
                                                                    className="h-8 text-xs"
                                                                    autoFocus
                                                                />
                                                            </div>
                                                            <div className="max-h-40 overflow-y-auto">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => { setFormData(p => ({ ...p, category_id: null })); setIsCategoryOpen(false); }}
                                                                    className="w-full px-3 py-2 text-xs text-left hover:bg-slate-50 text-slate-400 italic"
                                                                >
                                                                    Sin categoría
                                                                </button>
                                                                {categories
                                                                    .filter(c => !categorySearchTerm || normalizeSearch(c.name).includes(normalizeSearch(categorySearchTerm)))
                                                                    .map(c => (
                                                                        <button
                                                                            key={c.id}
                                                                            type="button"
                                                                            onClick={() => { setFormData(p => ({ ...p, category_id: c.id?.toString() })); setIsCategoryOpen(false); setCategorySearchTerm(''); }}
                                                                            className={cn(
                                                                                'w-full px-3 py-2 text-xs text-left hover:bg-indigo-50 hover:text-indigo-700 font-medium transition-colors',
                                                                                formData.category_id?.toString() === c.id?.toString() && 'bg-indigo-50 text-indigo-700 font-bold'
                                                                            )}
                                                                        >
                                                                            {c.name}
                                                                        </button>
                                                                    ))
                                                                }
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                                        <div className="mb-3 flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tipo de producto</p>
                                                <p className="mt-0.5 text-xs font-medium text-slate-500">Define stock, seriales y opciones visibles.</p>
                                            </div>
                                            <span className="shrink-0 rounded-md border border-indigo-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-600">
                                                {productTypeOptions.find(option => option.key === productType)?.label || 'Fisico'}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                                            {productTypeOptions.map(option => {
                                                const Icon = option.icon;
                                                const active = productType === option.key;
                                                return (
                                                    <button
                                                        key={option.key}
                                                        type="button"
                                                        onClick={() => setProductType(option.key)}
                                                        className={cn(
                                                            'min-h-[76px] rounded-lg border p-3 text-left transition-all',
                                                            active
                                                                ? 'border-indigo-500 bg-white shadow-sm ring-2 ring-indigo-500/15'
                                                                : 'border-slate-200 bg-white/80 hover:border-indigo-200 hover:bg-white'
                                                        )}
                                                    >
                                                        <div className="mb-2 flex items-center justify-between gap-2">
                                                            <span className={cn(
                                                                'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                                                                active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
                                                            )}>
                                                                <Icon size={15} />
                                                            </span>
                                                            <span className={cn(
                                                                'h-2.5 w-2.5 rounded-full',
                                                                active ? 'bg-indigo-600' : 'bg-slate-200'
                                                            )} />
                                                        </div>
                                                        <p className={cn('truncate text-[12px] font-black', active ? 'text-slate-900' : 'text-slate-600')}>{option.label}</p>
                                                        <p className="mt-0.5 truncate text-[10px] font-bold text-slate-400">{option.desc}</p>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2">
                                            <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Comportamiento adicional</p>
                                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                                {[
                                                    { key: 'is_menu_item', label: 'Item de menu', desc: 'Disponible para restaurante', icon: UtensilsCrossed, show: modules?.restaurant },
                                                    { key: 'is_commissionable', label: 'Aplica comision', desc: 'Calcula pago al cajero', icon: DollarSign },
                                                ].filter(option => option.show !== false).map(option => {
                                                    const Icon = option.icon;
                                                    const active = !!formData[option.key];
                                                    return (
                                                        <button
                                                            key={option.key}
                                                            type="button"
                                                            onClick={() => setFormData(prev => ({ ...prev, [option.key]: !prev[option.key] }))}
                                                            className={cn(
                                                                'flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-all',
                                                                active ? 'border-indigo-200 bg-indigo-50/70' : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                                                            )}
                                                        >
                                                            <span className="flex min-w-0 items-center gap-2.5">
                                                                <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', active ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400')}>
                                                                    <Icon size={14} />
                                                                </span>
                                                                <span className="min-w-0">
                                                                    <span className="block truncate text-[12px] font-black text-slate-700">{option.label}</span>
                                                                    <span className="block truncate text-[10px] font-bold text-slate-400">{option.desc}</span>
                                                                </span>
                                                            </span>
                                                            <SwitchVisual checked={active} />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ══ SECCIÓN 2: PRECIOS — Unificado ═══════════════════ */}
                        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                                <SectionHeader icon={DollarSign} label="Precios" color="text-emerald-600" bg="bg-emerald-100" />
                                <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    <span className={cn('rounded-md border px-2 py-1', priceValue > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-amber-200 bg-amber-50 text-amber-600')}>
                                        Precio {priceValue > 0 ? 'listo' : 'pendiente'}
                                    </span>
                                    <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-indigo-600">
                                        {anchorCurrency.symbol} {anchorCurrency.name || 'USD'}
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-4 p-4 sm:p-5">
                                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.15fr_0.85fr]">
                                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
                                        <div className="mb-3 flex items-center justify-between gap-3">
                                            <div>
                                                <label className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                                                    <Calculator size={10} /> Precio de venta
                                                </label>
                                                <p className="mt-0.5 text-xs font-medium text-emerald-700/70">Valor principal que vera el POS y el catalogo.</p>
                                            </div>
                                            {needsRound(formData.price) && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const rounded = roundPrice(formData.price);
                                                        const price = parseFloat(rounded);
                                                        const cost = parseFloat(formData.cost) || 0;
                                                        const margin = cost > 0
                                                            ? (useGrossMargin ? ((1 - cost/price)*100) : ((price-cost)/cost*100))
                                                            : 0;
                                                        setFormData(p => ({ ...p, price: rounded, profit_margin: margin.toFixed(2) }));
                                                    }}
                                                    className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-600 transition-all hover:bg-amber-100"
                                                >
                                                    Redondear
                                                </button>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <span className={cn('absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black', priceValue > 0 ? 'text-emerald-500' : 'text-slate-300')}>$</span>
                                            <Input
                                                type="number"
                                                name="price"
                                                value={formData.price || ''}
                                                onChange={handleInputChange}
                                                onFocus={e => e.target.select()}
                                                step="0.01"
                                                className={cn(
                                                    'h-14 border-2 pl-10 text-right text-3xl font-black transition-all',
                                                    priceValue > 0
                                                        ? 'border-emerald-400/40 bg-white text-emerald-600'
                                                        : 'border-slate-200 bg-white text-slate-400'
                                                )}
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
                                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Costo neto</label>
                                            <div className="relative mt-1.5">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">$</span>
                                                <Input
                                                    type="number"
                                                    name="cost"
                                                    value={formData.cost || ''}
                                                    onChange={handleInputChange}
                                                    onFocus={e => e.target.select()}
                                                    step="0.01"
                                                    className={cn('h-10 border-slate-200 pl-7 font-bold', costValue > priceValue && priceValue > 0 ? 'bg-rose-50 text-rose-600' : 'text-slate-700')}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Margen</label>
                                            <div className="relative mt-1.5">
                                                <Input
                                                    type="number"
                                                    name="profit_margin"
                                                    value={formData.profit_margin || ''}
                                                    onChange={handleInputChange}
                                                    onFocus={e => e.target.select()}
                                                    step="0.01"
                                                    className={cn('h-10 pr-7 text-center font-black border-slate-200', marginValue < 0 ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50/60 text-indigo-600')}
                                                    placeholder="0"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">%</span>
                                            </div>
                                        </div>
                                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Utilidad estimada</p>
                                            <p className={cn('mt-1 text-lg font-black', profitValue < 0 ? 'text-rose-600' : 'text-slate-800')}>${profitValue.toFixed(2)}</p>
                                            <p className="text-[10px] font-bold text-slate-400">Margen: {marginLabel}</p>
                                        </div>
                                    </div>
                                </div>

                                {priceWarnings.length > 0 && (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
                                        <div className="flex items-start gap-2">
                                            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
                                            <div className="space-y-1">
                                                {priceWarnings.map((warning, idx) => (
                                                    <p key={idx} className="text-xs font-bold text-amber-700">{warning}</p>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-wrap items-center justify-end gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Referencia moneda:</span>
                                    <Select
                                        name="exchange_rate_id"
                                        value={formData.exchange_rate_id?.toString()}
                                        onValueChange={(val) => setFormData({ ...formData, exchange_rate_id: val })}
                                    >
                                        <SelectTrigger className="h-8 w-44 border-none bg-slate-100 text-xs font-bold shadow-none">
                                            <SelectValue placeholder="Tasa Global" />
                                        </SelectTrigger>
                                        <SelectContent align="end">
                                            <SelectItem value="null">Tasa Global (Default)</SelectItem>
                                            {exchangeRates.map(r => (
                                                <SelectItem key={r.id} value={r.id.toString()}>
                                                    {r.name} ({parseFloat(r.rate)})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Listas de precios — directamente aquí */}
                                <div className="rounded-lg border border-slate-200 bg-slate-50/60">
                                    <button
                                        type="button"
                                        onClick={() => toggleSection('priceLists')}
                                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/70"
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100">
                                                <Tag size={15} className="text-violet-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-black text-slate-800">Precios avanzados</p>
                                                <p className="truncate text-xs font-medium text-slate-500">{priceLists.length} listas configuradas - precio base ${parseFloat(formData.price || 0).toFixed(2)}</p>
                                            </div>
                                        </div>
                                        <ChevronDown size={17} className={cn('shrink-0 text-slate-400 transition-transform', openSections.priceLists && 'rotate-180 text-indigo-500')} />
                                    </button>
                                    <div className={cn('border-t border-slate-200 bg-white p-4', !openSections.priceLists && 'hidden')}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-violet-100 rounded-lg flex items-center justify-center">
                                                <Tag size={12} className="text-violet-600" />
                                            </div>
                                            <span className="text-xs font-black text-slate-700">Listas de Precios Especiales</span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 italic">Precio base: <span className="font-bold text-slate-600">${parseFloat(formData.price || 0).toFixed(2)}</span></p>
                                    </div>

                                    {/* Cards de listas existentes + agregar nueva */}
                                    <div className="flex flex-wrap gap-3">
                                        {/* Precio base como card referencia */}
                                        <div className="flex flex-col items-center bg-emerald-50 border-2 border-emerald-200 rounded-2xl px-4 py-3 min-w-[120px]">
                                            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">P. Mayor</span>
                                            <span className="text-xl font-black text-emerald-700">${parseFloat(formData.price || 0).toFixed(2)}</span>
                                            <span className="text-[9px] text-emerald-400 mt-0.5">Precio Mayor</span>
                                        </div>

                                        {/* Listas configuradas */}
                                        {priceLists.map(pl => {
                                            const currentPrice = parseFloat(formData.prices?.[pl.id] || 0);
                                            const basePrice = parseFloat(formData.price || 0);
                                            const diff = basePrice > 0 ? ((currentPrice - basePrice) / basePrice * 100).toFixed(1) : 0;
                                            const isPositive = currentPrice >= basePrice;
                                            return (
                                                <div key={pl.id} className="flex flex-col bg-white border-2 border-indigo-100 rounded-2xl px-3 py-3 min-w-[130px] hover:border-indigo-300 transition-all">
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest truncate max-w-[80px]">{pl.name}</span>
                                                        {currentPrice > 0 && (
                                                            <span className={cn('text-[8px] font-black px-1 py-0.5 rounded', isPositive ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600')}>
                                                                {isPositive ? '+' : ''}{diff}%
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="relative">
                                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={(() => { const v = parseFloat(formData.prices?.[pl.id]); return (!v || v === 0) ? ''  : v; })()}
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    prices: { ...prev.prices, [pl.id]: val }
                                                                }));
                                                            }}
                                                            className="w-full pl-6 pr-2 py-1.5 text-base font-black text-indigo-700 bg-indigo-50/50 border border-indigo-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                    {/* Campo porcentaje + botón calcular */}
                                                    <div className="mt-1.5 flex items-center gap-1">
                                                        <div className="relative flex-1">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="999"
                                                                step="1"
                                                                value={listPct}
                                                                onChange={e => setListPct(parseFloat(e.target.value) || 0)}
                                                                className="w-full pl-2 pr-5 py-1 text-[11px] font-black text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 text-center"
                                                                onClick={e => e.target.select()}
                                                            />
                                                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400">%</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const base = parseFloat(formData.price || 0);
                                                                if (!base) return;
                                                                const calculated = roundPrice(base * (1 + listPct / 100), base);
                                                                // Limpiar primero para forzar re-render del input
                                                                setFormData(prev => ({ ...prev, prices: { ...prev.prices, [pl.id]: null } }));
                                                                requestAnimationFrame(() => setFormData(prev => ({
                                                                    ...prev,
                                                                    prices: { ...prev.prices, [pl.id]: calculated }
                                                                })));
                                                            }}
                                                            className="text-[9px] font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg py-1 px-2 transition-all whitespace-nowrap"
                                                        >
                                                            Calcular
                                                        </button>
                                                    </div>
                                                    {/* Resultado exacto sin redondear */}
                                                    {(() => {
                                                        const base = parseFloat(formData.price || 0);
                                                        if (!base || !listPct) return null;
                                                        const exact = (base * (1 + listPct / 100)).toFixed(2);
                                                        const rounded = roundPrice(base * (1 + listPct / 100), base);
                                                        if (exact === rounded) return null;
                                                        return (
                                                            <p className="text-[9px] text-slate-400 text-center mt-0.5">
                                                                Exacto: <span className="font-bold text-slate-500">${exact}</span>
                                                            </p>
                                                        );
                                                    })()}
                                                </div>
                                            );
                                        })}

                                        {/* Botón agregar nueva lista */}
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const name = window.prompt('Nombre de la nueva lista de precios:');
                                                if (!name?.trim()) return;
                                                try {
                                                    await apiClient.post('/price-lists/', { name: name.trim(), is_active: true });
                                                    await fetchPriceLists();
                                                    toast.success(`Lista "${name}" creada`);
                                                } catch {
                                                    toast.error('Error al crear la lista');
                                                }
                                            }}
                                            className="flex flex-col items-center justify-center bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl px-4 py-3 min-w-[110px] hover:border-indigo-400 hover:bg-indigo-50/30 transition-all text-slate-400 hover:text-indigo-500 group"
                                        >
                                            <Plus size={20} className="mb-1 group-hover:scale-110 transition-transform" />
                                            <span className="text-[9px] font-black uppercase tracking-widest">Nueva Lista</span>
                                        </button>
                                    </div>

                                    <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1">
                                        <AlertTriangle size={10} className="text-amber-400" />
                                        Activa el PIN en una lista para que el POS solicite autorización antes de aplicar ese precio.
                                    </p>
                                </div>
                            </div>
                        </div>
                        </div>

                        {/* ══ SECCIÓN 3: INVENTARIO ═════════════════════════════ */}
                        {!formData.is_service && !formData.is_combo && !formData.has_imei && (
                            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                                    <SectionHeader icon={Warehouse} label="Inventario" color="text-amber-600" bg="bg-amber-100" />
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Stock Total:</span>
                                        <span className="text-lg font-black text-amber-600 bg-amber-50 border border-amber-200 px-3 py-0.5 rounded-full">{formData.stock}</span>
                                    </div>
                                </div>
                                <div className="p-5">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {/* Configuración base */}
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Unidad de Medida Base</label>
                                                <Select value={formData.unit_type} onValueChange={val => setFormData({ ...formData, unit_type: val })}>
                                                    <SelectTrigger className="h-10 border-slate-200">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="UNID">Unidad (Pza/Uds)</SelectItem>
                                                        <SelectItem value="KILO">Kilo (Kg)</SelectItem>
                                                        <SelectItem value="METRO">Metro (m)</SelectItem>
                                                        <SelectItem value="CAJA">Caja</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1.5">Stock Mínimo</label>
                                                    <Input
                                                        type="number"
                                                        name="min_stock"
                                                        value={formData.min_stock}
                                                        onChange={handleInputChange}
                                                        className="h-10 text-center font-bold border-rose-100 bg-rose-50/30"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Ubicación Física</label>
                                                    <Input
                                                        name="location"
                                                        value={formData.location}
                                                        onChange={handleInputChange}
                                                        placeholder="Pasillo A-12..."
                                                        className="h-10 border-slate-200"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Distribución por bodega */}
                                        <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Distribución de Existencias</label>
                                            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                                {warehouses.length > 0 ? warehouses.map(wh => {
                                                    const qty = formData.warehouse_stocks.find(s => s.warehouse_id === wh.id)?.quantity || 0;
                                                    return (
                                                        <div key={wh.id} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                                <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{wh.name}</span>
                                                            </div>
                                                            <Input
                                                                type="number"
                                                                className="w-20 h-8 text-right text-xs font-black bg-slate-50 border-slate-200"
                                                                value={Number(qty).toString()}
                                                                onChange={e => {
                                                                    const val = parseFloat(e.target.value) || 0;
                                                                    const newStocks = [...formData.warehouse_stocks];
                                                                    const idx = newStocks.findIndex(s => s.warehouse_id === wh.id);
                                                                    if (idx >= 0) newStocks[idx].quantity = val;
                                                                    else newStocks.push({ warehouse_id: wh.id, quantity: val });
                                                                    const total = newStocks.reduce((sum, s) => sum + s.quantity, 0);
                                                                    setFormData(prev => ({ ...prev, warehouse_stocks: newStocks, stock: total }));
                                                                }}
                                                            />
                                                        </div>
                                                    );
                                                }) : (
                                                    <div className="text-center py-4 border border-dashed border-slate-200 rounded-lg">
                                                        <p className="truncate text-xs font-medium text-slate-500">No hay almacenes configurados</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {!initialData && (
                                        <div className="mt-4 flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5">
                                            <AlertCircle size={13} className="text-amber-500 flex-shrink-0" />
                                            <p className="text-[10px] text-amber-700 font-medium italic">Estas cantidades se registrarán como saldo inicial del inventario.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {formData.is_service && (
                            <div className="rounded-lg border border-indigo-100 bg-white shadow-sm overflow-hidden">
                                <div className="flex items-start gap-3 p-5">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                                        <Scissors size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-black text-slate-800">Servicio sin inventario</h3>
                                        <p className="mt-1 text-xs font-medium text-slate-500">Este tipo no necesita stock, almacen ni recepcion de unidades. Solo conserva precio, garantia y datos comerciales.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {formData.is_combo && (
                            <div className="rounded-lg border border-violet-100 bg-white shadow-sm overflow-hidden">
                                <div className="flex items-start gap-3 p-5">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                                        <Layers size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-black text-slate-800">Inventario calculado por componentes</h3>
                                        <p className="mt-1 text-xs font-medium text-slate-500">El combo no usa stock manual aqui. La disponibilidad depende de los productos agregados al kit.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Control para productos con IMEI */}
                        {!formData.is_service && !formData.is_combo && formData.has_imei && (
                            <div className="bg-white rounded-lg border border-blue-100 shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between gap-3 border-b border-blue-50 px-5 py-4">
                                    <SectionHeader icon={ScanBarcode} label="Control serializado" color="text-blue-600" bg="bg-blue-100" />
                                    <span className="rounded-md border border-blue-100 bg-blue-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-blue-600">IMEI / Serial</span>
                                </div>
                                <div className="space-y-4 p-5">
                                    <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3">
                                        <p className="text-xs font-bold text-blue-700">Las existencias se controlan por serial individual.</p>
                                        <p className="mt-1 text-[11px] font-medium text-blue-600/80">Para cargar unidades usa Recepcion IMEI; aqui solo se define alerta minima y ubicacion sugerida.</p>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div>
                                            <label className="block text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1.5">Alerta minima</label>
                                            <Input type="number" name="min_stock" value={formData.min_stock} onChange={handleInputChange} className="h-10 text-center font-bold border-rose-100 bg-rose-50/30" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Ubicacion sugerida</label>
                                            <Input name="location" value={formData.location} onChange={handleInputChange} placeholder="Vitrina A, Caja 3..." className="h-10 border-slate-200" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Seccion 4: presentaciones / unidades */}
                        {!formData.is_service && !formData.is_combo && (
                            <CollapsibleSection
                                id="units"
                                icon={Layers}
                                label="Presentaciones y unidades"
                                summary={formData.units.length > 0 ? `${formData.units.length} presentaciones configuradas` : "Opcional"}
                                iconColor="text-indigo-600"
                                iconBg="bg-indigo-100"
                            >
                                <ProductUnitManager
                                    units={formData.units}
                                    onUnitsChange={u => setFormData(p => ({ ...p, units: u }))}
                                    baseUnitType={formData.unit_type}
                                    basePrice={formData.price}
                                    baseCost={formData.cost}
                                    exchangeRates={exchangeRates}
                                />
                            </CollapsibleSection>
                        )}

                        {/* ══ SECCIÓN 5: COMBO ══════════════════════════════════ */}
                        {formData.is_combo && (
                            <CollapsibleSection
                                id="combo"
                                icon={Layers}
                                label="Combo / kit"
                                summary={formData.combo_items.length > 0 ? `${formData.combo_items.length} componentes` : "Agrega los productos del kit"}
                                iconColor="text-violet-600"
                                iconBg="bg-violet-100"
                            >
                                <ComboManager
                                    comboItems={formData.combo_items}
                                    onItemsChange={i => setFormData(p => ({ ...p, combo_items: i, is_combo: i.length > 0 }))}
                                />
                            </CollapsibleSection>
                        )}

                        {/* ══ SECCIÓN 6: GARANTÍA ══════════════════════════════ */}
                        <CollapsibleSection
                            id="warranty"
                            icon={ShieldCheck}
                            label="Garantia"
                            summary={formData.warranty_policy_id ? "Politica seleccionada" : "Opcional"}
                            iconColor="text-teal-600"
                            iconBg="bg-teal-100"
                        >
                            <div className="p-5">
                                <Select
                                    value={formData.warranty_policy_id?.toString()}
                                    onValueChange={val => setFormData({ ...formData, warranty_policy_id: val === 'null' ? null : val })}
                                >
                                    <SelectTrigger className="h-11 border-slate-200">
                                        <SelectValue placeholder="Sin garantia (u omitida)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="null">-- Ninguna / Segun Factura --</SelectItem>
                                        {policies.map(p => (
                                            <SelectItem key={p.id} value={p.id.toString()}>
                                                {p.name} ({p.type === 'LIFETIME' ? 'De por vida' : `${p.duration} ${p.type}`})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CollapsibleSection>

                        {/* ══ SECCIÓN 7: DESCUENTOS POR VOLUMEN (si existe) ═══ */}
                        {initialData?.id && (
                            <CollapsibleSection
                                id="discounts"
                                icon={Zap}
                                label="Descuentos por volumen"
                                summary="Reglas avanzadas del producto"
                                iconColor="text-amber-600"
                                iconBg="bg-amber-100"
                            >
                                <div className="p-5">
                                    <DiscountRulesManager
                                        productId={initialData.id}
                                        initialRules={initialData.discount_rules || []}
                                    />
                                </div>
                            </CollapsibleSection>
                        )}

                        {/* ══ MÓDULO FARMACIA ═══════════════════════════════════ */}
                        {modules?.pharmacy && (
                            <CollapsibleSection
                                id="pharmacy"
                                icon={Shield}
                                label="Informacion farmaceutica"
                                summary={formData.drug_classification || formData.active_ingredient ? "Datos configurados" : "Opcional"}
                                iconColor="text-indigo-600"
                                iconBg="bg-indigo-100"
                            >
                                <div className="p-5 space-y-4">
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div>
                                            <label className="block text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1.5">Clasificacion</label>
                                            <Select
                                                value={formData.drug_classification || ''}
                                                onValueChange={val => setFormData(p => ({ ...p, drug_classification: val === 'none' ? '' : val }))}
                                            >
                                                <SelectTrigger className="h-10 border-indigo-200 bg-indigo-50/20">
                                                    <SelectValue placeholder="Sin clasificacion" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">-- Sin clasificacion --</SelectItem>
                                                    <SelectItem value="OTC">OTC - Venta Libre</SelectItem>
                                                    <SelectItem value="PRESCRIPTION">PRESCRIPTION - Requiere Receta</SelectItem>
                                                    <SelectItem value="CONTROLLED">CONTROLLED - Controlada</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1.5 flex items-center gap-1"><Snowflake size={10} /> Almacenamiento</label>
                                            <Select
                                                value={formData.storage_condition || ''}
                                                onValueChange={val => setFormData(p => ({ ...p, storage_condition: val === 'none' ? '' : val }))}
                                            >
                                                <SelectTrigger className="h-10 border-indigo-200 bg-indigo-50/20">
                                                    <SelectValue placeholder="Sin especificar" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">-- Sin especificar --</SelectItem>
                                                    <SelectItem value="AMBIENT">Temperatura Ambiente</SelectItem>
                                                    <SelectItem value="REFRIGERATED">Refrigerado 2-8 C</SelectItem>
                                                    <SelectItem value="FROZEN">Congelado</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1.5">Principio Activo</label>
                                        <Input
                                            name="active_ingredient"
                                            value={formData.active_ingredient || ''}
                                            onChange={handleInputChange}
                                            placeholder="Ej: Paracetamol, Ibuprofeno..."
                                            className="h-10 border-indigo-200 bg-indigo-50/20"
                                        />
                                    </div>
                                </div>
                            </CollapsibleSection>
                        )}

                    </div>
                </div>

                {/* ── Footer fijo con guardar ─────────────────────────────── */}
                <div className="sticky bottom-0 z-30 flex flex-col gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <p className="truncate text-xs font-medium text-slate-500">
                        {initialData ? `Modificando: ${initialData.name}` : 'Nuevo producto'}
                    </p>
                    <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" onClick={onClose} className="h-10 text-slate-500">
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            className="h-10 rounded-md bg-indigo-600 px-6 font-bold text-white shadow-md shadow-indigo-200 transition-all hover:-translate-y-0.5 hover:bg-indigo-700"
                        >
                            <Check size={15} className="mr-2" /> Guardar Producto
                        </Button>
                    </div>
                </div>

                {/* Scanner modal */}
                {isScanning && (
                    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 p-4">
                        <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-slate-800">Escanear código</h3>
                                <button onClick={() => setIsScanning(false)} className="text-slate-400 hover:text-slate-600">
                                    <X size={20} />
                                </button>
                            </div>
                            <BarcodeScannerComponent onResult={handleScanResult} onError={() => setIsScanning(false)} />
                        </div>
                    </div>
                )}

            </SheetContent>
        </Sheet>
    );
};

export default ProductForm;

