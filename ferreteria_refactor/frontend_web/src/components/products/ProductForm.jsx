import { useState, useEffect } from 'react';
import { X, Plus, Package, DollarSign, Barcode, Tag, Layers, AlertTriangle, ShieldCheck, Calculator, Image as ImageIcon, Check, Bell, Warehouse, AlertCircle, ScanBarcode, Zap, Search, ChevronDown, Scissors, Snowflake, Shield, UtensilsCrossed, ChefHat } from 'lucide-react';
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

const ProductForm = ({ isOpen, onClose, onSubmit, initialData = null, categories = [], warehouses = [], exchangeRates = [] }) => {
    const { getActiveCurrencies, currencies, modules } = useConfig();
    const useGrossMargin = useFeatureFlag('precio_margen_bruto');
    const anchorCurrency = currencies.find(c => c.is_anchor) || { symbol: '$' };

    // categories, warehouses, and exchangeRates are now props. No need for local state for them if we trust the parent.
    // However, if we want to ensure they are available even if parent didn't pass them (fallback), we could keep state, but for performance let's rely on props.
    // We still need local state for priceLists as parent doesn't have it.

    const [priceLists, setPriceLists] = useState([]);

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
            profit_margin: formData.profit_margin ? parseFloat(formData.profit_margin) : null,
            discount_percentage: parseFloat(formData.discount_percentage) || 0,
            tax_rate: parseFloat(formData.tax_rate) || 0,
            is_service: formData.is_service || false,
            is_barbershop_service: formData.is_barbershop_service || false,
            is_menu_item: formData.is_menu_item || false,
            ...(modules?.restaurant && formData.is_menu_item ? { needs_kitchen: formData.needs_kitchen !== false } : {}),
            commission_amount: formData.commission_amount ? parseFloat(formData.commission_amount) : null,
            commission_percentage: formData.commission_percentage ? parseFloat(formData.commission_percentage) : null,
            is_commissionable: formData.is_commissionable || false, // NEW: Commission flag
            units: formData.units.map(u => ({
                unit_name: u.unit_name,
                conversion_factor: u.type === 'fraction' ? (u.user_input !== 0 ? 1 / parseFloat(u.user_input) : 0) : parseFloat(u.user_input),
                barcode: u.barcode,
                price_usd: parseFloat(u.price_usd) || null,
                is_default: false,
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

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent side="right" className="w-full sm:w-[90vw] sm:max-w-[1200px] flex flex-col p-0 gap-0 bg-slate-50">

                {/* Header */}
                <SheetHeader className="p-6 border-b border-slate-200 bg-white sticky top-0 z-10">
                    <div className="flex items-center justify-between">
                        <div>
                            <SheetTitle className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                                {initialData ? 'Editar Producto' : 'Nuevo Producto'}
                            </SheetTitle>
                            <SheetDescription className="text-xs text-slate-500 mt-0.5">
                                {initialData ? `Editando: ${initialData.name}` : 'Detalles del nuevo item'}
                            </SheetDescription>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="ghost" onClick={onClose} className="text-slate-500 hover:text-slate-800">Cancelar</Button>
                            <Button onClick={handleSubmit} className="bg-slate-900 hover:bg-slate-800 text-white min-w-[120px]">
                                <Check className="mr-2" size={16} /> Guardar
                            </Button>
                        </div>
                    </div>
                </SheetHeader>

                <Tabs defaultValue="main" className="flex-1 overflow-hidden flex flex-col">
                    <div className="px-6 bg-white border-b border-slate-200 shadow-sm">
                        <TabsList className="w-full justify-start h-10 bg-transparent p-0 gap-8">
                            <TabsTrigger value="main" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 rounded-none bg-transparent h-full px-0 font-bold text-slate-500 shadow-none text-sm transition-all">GENERAL</TabsTrigger>
                            <TabsTrigger value="advanced" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 rounded-none bg-transparent h-full px-0 font-bold text-slate-500 shadow-none text-sm transition-all flex items-center gap-1.5">
                                AVANZADO
                                {formData.is_combo && (
                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 leading-none">COMBO</span>
                                )}
                            </TabsTrigger>
                            {initialData?.id && (
                                <TabsTrigger value="precios" className="data-[state=active]:border-b-2 data-[state=active]:border-amber-500 data-[state=active]:text-amber-600 rounded-none bg-transparent h-full px-0 font-bold text-slate-500 shadow-none text-sm transition-all flex items-center gap-1.5">
                                    <Zap size={12} />PRECIOS POR VOLUMEN
                                </TabsTrigger>
                            )}
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50">
                        <TabsContent value="main" className="mt-0 space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* IDENTITY SECTION: IMAGE + MAIN FIELDS */}
                            <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                                <CardContent className="p-6">
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                        {/* Left: Image Upload (Proportional) */}
                                        <div className="lg:col-span-4 flex flex-col gap-3">
                                            <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Imagen del Producto</Label>
                                            <ProductImageUploader
                                                productId={initialData?.id}
                                                currentImageUrl={formData.image_url}
                                                onImageUpdate={(newUrl) => setFormData(prev => ({ ...prev, image_url: newUrl }))}
                                            />
                                        </div>

                                        {/* Right: Primary Info */}
                                        <div className="lg:col-span-8 space-y-5">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="name" className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Nombre del Producto <span className="text-rose-500">*</span></Label>
                                                <Input
                                                    id="name"
                                                    name="name"
                                                    value={formData.name}
                                                    onChange={handleInputChange}
                                                    placeholder="Ej. Martillo de Carpintero 16oz"
                                                    className="h-11 text-lg font-bold border-slate-200 focus:ring-indigo-500 focus:border-indigo-500"
                                                    autoFocus
                                                />
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">SKU / Código</Label>
                                                    <div className="relative group">
                                                        <Barcode className="absolute left-3 top-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                                                        <Input
                                                            name="sku"
                                                            value={formData.sku}
                                                            onChange={handleInputChange}
                                                            className="h-11 pl-10 pr-10 text-sm font-mono border-slate-200 bg-slate-50/30 focus:bg-white"
                                                            placeholder="Escanea o escribe..."
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsScanning(true)}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                            title="Escanear código de barras"
                                                        >
                                                            <ScanBarcode size={18} />
                                                        </button>

                                                        {isScanning && (
                                                            <BarcodeScannerComponent
                                                                onScanned={handleScanResult}
                                                                onClose={() => setIsScanning(false)}
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5 relative">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Categoría</Label>
                                                        <button
                                                            type="button"
                                                            onClick={() => { setShowNewCategoryInput(v => !v); setIsCategoryOpen(false); }}
                                                            title="Crear nueva categoría"
                                                            className="flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 font-bold px-1.5 py-0.5 rounded-md hover:bg-indigo-50 transition-colors"
                                                        >
                                                            <Plus size={11} /> Nueva
                                                        </button>
                                                    </div>

                                                    {/* Input inline para crear nueva categoría */}
                                                    {showNewCategoryInput && (
                                                        <div className="flex gap-1.5 mb-1.5">
                                                            <Input
                                                                autoFocus
                                                                placeholder="Nombre de la categoría..."
                                                                className="h-9 text-sm flex-1"
                                                                value={newCategoryName}
                                                                onChange={e => setNewCategoryName(e.target.value)}
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') { e.preventDefault(); handleCreateCategory(); }
                                                                    if (e.key === 'Escape') { setShowNewCategoryInput(false); setNewCategoryName(''); }
                                                                }}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={handleCreateCategory}
                                                                disabled={savingCategory || !newCategoryName.trim()}
                                                                className="px-3 h-9 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
                                                            >
                                                                {savingCategory ? '...' : 'Guardar'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => { setShowNewCategoryInput(false); setNewCategoryName(''); }}
                                                                className="px-2 h-9 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Custom Searchable Dropdown Button */}
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                                                        className="w-full h-11 px-3 text-left border rounded-lg bg-slate-50/30 border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center justify-between"
                                                    >
                                                        <span className={formData.category_id ? "text-slate-900" : "text-slate-500"}>
                                                            {formData.category_id
                                                                ? categories.find(c => c.id.toString() === formData.category_id?.toString())?.name || 'Seleccionado'
                                                                : 'Seleccionar categoría...'}
                                                        </span>
                                                        <ChevronDown size={14} className="opacity-50" />
                                                    </button>

                                                    {/* Searchable Dropdown Menu */}
                                                    {isCategoryOpen && (
                                                        <>
                                                            <div
                                                                className="fixed inset-0 z-40"
                                                                onClick={() => setIsCategoryOpen(false)}
                                                            />
                                                            <div className="absolute top-16 left-0 w-full z-50 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                                                <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
                                                                    <div className="relative">
                                                                        <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                                                                        <Input
                                                                            autoFocus
                                                                            placeholder="Buscar categoría..."
                                                                            className="h-9 pl-8 text-sm bg-slate-50/50"
                                                                            value={categorySearchTerm}
                                                                            onChange={(e) => setCategorySearchTerm(e.target.value)}
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
                                                                    <div
                                                                        className="flex items-center px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                                                                        onClick={() => {
                                                                            setFormData({ ...formData, category_id: null });
                                                                            setIsCategoryOpen(false);
                                                                        }}
                                                                    >
                                                                        -- Sin Categoría --
                                                                    </div>
                                                                    {categories
                                                                        .filter(c => normalizeSearch(c.name).includes(normalizeSearch(categorySearchTerm)))
                                                                        .map(c => {
                                                                            const isSelected = formData.category_id?.toString() === c.id.toString();
                                                                            return (
                                                                                <div
                                                                                    key={c.id}
                                                                                    className={cn(
                                                                                        "flex items-center justify-between px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors font-medium",
                                                                                        isSelected ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-100"
                                                                                    )}
                                                                                    onClick={() => {
                                                                                        setFormData({ ...formData, category_id: c.id.toString() });
                                                                                        setIsCategoryOpen(false);
                                                                                    }}
                                                                                >
                                                                                    {c.name}
                                                                                    {isSelected && <Check size={14} className="text-indigo-600" />}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    {categories.filter(c => normalizeSearch(c.name).includes(normalizeSearch(categorySearchTerm))).length === 0 && (
                                                                        <div className="p-3 text-center text-sm text-slate-400 italic">No se encontraron resultados</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Combo Toggle */}
                                            <div className={cn(
                                                "hidden flex items-center gap-4 p-4 rounded-xl transition-all border",
                                                formData.is_combo
                                                    ? "bg-violet-50 border-violet-200 ring-1 ring-violet-500/10"
                                                    : "bg-slate-50 border-slate-100 hover:border-slate-200"
                                            )}>
                                                <div className={cn(
                                                    "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                                                    formData.is_combo ? "bg-violet-600 text-white" : "bg-slate-200 text-slate-400"
                                                )}>
                                                    <Layers size={20} />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <Label htmlFor="is_combo" className="text-sm font-bold text-slate-800 cursor-pointer">Es un combo</Label>
                                                        <input
                                                            type="checkbox"
                                                            id="is_combo"
                                                            checked={formData.is_combo || false}
                                                            onChange={(e) => setFormData(p => ({ ...p, is_combo: e.target.checked, combo_items: e.target.checked ? p.combo_items : [] }))}
                                                            className="sr-only peer"
                                                        />
                                                        <div
                                                            onClick={() => setFormData(p => ({ ...p, is_combo: !p.is_combo, combo_items: !p.is_combo ? p.combo_items : [] }))}
                                                            className="w-11 h-6 bg-slate-200 rounded-full cursor-pointer transition-colors relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600 peer-checked:after:translate-x-5"
                                                        ></div>
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 mt-0.5">Agrupa varios productos. El stock se calcula desde sus componentes en la pestaña Avanzado.</p>
                                                </div>
                                            </div>

                                            {/* Service Toggle - Integrated and clear */}
                                            <div className={cn(
                                                "flex items-center gap-4 p-4 rounded-xl transition-all border",
                                                formData.is_service
                                                    ? "bg-indigo-50 border-indigo-200 ring-1 ring-indigo-500/10"
                                                    : "bg-slate-50 border-slate-100 hover:border-slate-200"
                                            )}>
                                                <div className={cn(
                                                    "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                                                    formData.is_service ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-400"
                                                )}>
                                                    <Package size={20} />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <Label htmlFor="is_service" className="text-sm font-bold text-slate-800 cursor-pointer">Es un servicio</Label>
                                                        <input
                                                            type="checkbox"
                                                            id="is_service"
                                                            checked={formData.is_service || false}
                                                            onChange={(e) => setFormData({ ...formData, is_service: e.target.checked })}
                                                            className="sr-only peer"
                                                        />
                                                        <div
                                                            onClick={() => setFormData(p => ({ ...p, is_service: !p.is_service }))}
                                                            className="w-11 h-6 bg-slate-200 rounded-full cursor-pointer transition-colors relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:translate-x-5"
                                                        ></div>
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 mt-0.5">No descontará stock ni requiere gestión de almacenes.</p>
                                                </div>
                                            </div>

                                            {/* Restaurant Module Flag (Conditional) */}
                                            {modules?.restaurant && (
                                                <div className={cn(
                                                    "flex items-center gap-4 p-4 rounded-xl transition-all border",
                                                    formData.is_menu_item
                                                        ? "bg-orange-50 border-orange-200 ring-1 ring-orange-500/10"
                                                        : "bg-slate-50 border-slate-100 hover:border-slate-200"
                                                )}>
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                                                        formData.is_menu_item ? "bg-orange-600 text-white" : "bg-slate-200 text-slate-400"
                                                    )}>
                                                        <UtensilsCrossed size={20} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center justify-between">
                                                            <Label htmlFor="is_menu_item" className="text-sm font-bold text-slate-800 cursor-pointer">Item de Menú (Restaurante)</Label>
                                                            <input
                                                                type="checkbox"
                                                                id="is_menu_item"
                                                                checked={formData.is_menu_item || false}
                                                                onChange={(e) => setFormData({ ...formData, is_menu_item: e.target.checked })}
                                                                className="sr-only peer"
                                                            />
                                                            <div
                                                                onClick={() => setFormData(p => ({ ...p, is_menu_item: !p.is_menu_item }))}
                                                                className="w-11 h-6 bg-slate-200 rounded-full cursor-pointer transition-colors relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600 peer-checked:after:translate-x-5"
                                                            ></div>
                                                        </div>
                                                        <p className="text-[11px] text-slate-500 mt-0.5">Aparecerá en el Menú y Recetas del Restaurante.</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* needs_kitchen: Only if restaurant module active AND is_menu_item */}
                                            {modules?.restaurant && formData.is_menu_item && (
                                                <div className={cn(
                                                    "flex items-center gap-4 p-4 rounded-xl transition-all border",
                                                    formData.needs_kitchen === false
                                                        ? "bg-amber-50 border-amber-200 ring-1 ring-amber-500/10"
                                                        : "bg-slate-50 border-slate-100 hover:border-slate-200"
                                                )}>
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                                                        formData.needs_kitchen === false ? "bg-amber-600 text-white" : "bg-slate-200 text-slate-400"
                                                    )}>
                                                        <ChefHat size={20} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center justify-between">
                                                            <Label htmlFor="needs_kitchen" className="text-sm font-bold text-slate-800 cursor-pointer">No necesita cocina</Label>
                                                            <input
                                                                type="checkbox"
                                                                id="needs_kitchen"
                                                                checked={formData.needs_kitchen !== false}
                                                                onChange={(e) => setFormData({ ...formData, needs_kitchen: e.target.checked })}
                                                                className="sr-only peer"
                                                            />
                                                            <div
                                                                onClick={() => setFormData(p => ({ ...p, needs_kitchen: p.needs_kitchen === false ? true : false }))}
                                                                className="w-11 h-6 bg-slate-200 rounded-full cursor-pointer transition-colors relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-slate-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600 peer-checked:after:translate-x-5"
                                                            ></div>
                                                        </div>
                                                        <p className="text-[11px] text-slate-500 mt-0.5">Cerveza, jugo, dulces — Lo sirve el mesero directamente.</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Barbershop Service Options (Only if Service & Barbershop Module active) */}
                                            {(formData.is_service && modules?.barbershop) && (
                                                <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2 mt-4 inline-block w-full">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                                                                <Scissors size={18} />
                                                            </div>
                                                            <div>
                                                                <Label className="text-sm font-bold text-slate-800">Servicio de Barbería / Salón</Label>
                                                                <p className="text-[11px] text-slate-500 mt-0.5">Habilita asignar este servicio a un profesional en el POS.</p>
                                                            </div>
                                                        </div>
                                                        <div
                                                            onClick={() => setFormData(p => ({ ...p, is_barbershop_service: !p.is_barbershop_service }))}
                                                            className="w-11 h-6 bg-slate-200 rounded-full cursor-pointer transition-colors relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:translate-x-5"
                                                            style={{ backgroundColor: formData.is_barbershop_service ? '#10b981' : '' }}
                                                        ></div>
                                                    </div>

                                                    {formData.is_barbershop_service && (
                                                        <div className="grid grid-cols-2 gap-4 mt-2">
                                                            <div>
                                                                <Label className="text-xs text-slate-600 font-medium mb-1 inline-block">Comisión Fija ($)</Label>
                                                                <div className="relative">
                                                                    <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                                                    <Input
                                                                        type="number"
                                                                        className="pl-9 h-9 text-sm"
                                                                        placeholder="Ej. 10.00"
                                                                        value={formData.commission_amount}
                                                                        onChange={e => setFormData({ ...formData, commission_amount: e.target.value })}
                                                                    />
                                                                </div>
                                                                <p className="text-[10px] text-slate-400 mt-1">Opcional. Tiene prioridad sobre %.</p>
                                                            </div>
                                                            <div>
                                                                <Label className="text-xs text-slate-600 font-medium mb-1 inline-block">Comisión Porcentaje (%)</Label>
                                                                <div className="relative">
                                                                    <Input
                                                                        type="number"
                                                                        className="pr-8 h-9 text-sm"
                                                                        placeholder="Ej. 40"
                                                                        value={formData.commission_percentage}
                                                                        onChange={e => setFormData({ ...formData, commission_percentage: e.target.value })}
                                                                    />
                                                                    <span className="absolute right-3 top-2 text-slate-400 font-medium text-sm">%</span>
                                                                </div>
                                                                <p className="text-[10px] text-slate-400 mt-1">Opcional. Ignora % base del empleado.</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Serial/IMEI Toggle - Only if Services Module is Active */}
                                            {modules.services && (
                                                <div className={cn(
                                                    "flex items-center gap-4 p-4 rounded-xl transition-all border",
                                                    formData.has_imei
                                                        ? "bg-blue-50 border-blue-200 ring-1 ring-blue-500/10"
                                                        : "bg-slate-50 border-slate-100 hover:border-slate-200"
                                                )}>
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                                                        formData.has_imei ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-400"
                                                    )}>
                                                        <ScanBarcode size={20} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center justify-between">
                                                            <Label htmlFor="has_imei" className="text-sm font-bold text-slate-800 cursor-pointer">Maneja Seriales / IMEI</Label>
                                                            <input
                                                                type="checkbox"
                                                                id="has_imei"
                                                                checked={formData.has_imei || false}
                                                                onChange={(e) => setFormData({ ...formData, has_imei: e.target.checked })}
                                                                className="sr-only peer"
                                                            />
                                                            <div
                                                                onClick={() => setFormData(p => ({ ...p, has_imei: !p.has_imei }))}
                                                                className="w-11 h-6 bg-slate-200 rounded-full cursor-pointer transition-colors relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-checked:after:translate-x-5"
                                                            ></div>
                                                        </div>
                                                        <p className="text-[11px] text-slate-500 mt-0.5">Requiere registrar serial único al vender o comprar.</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Commission Toggle - Always visible */}
                                            <div className={cn(
                                                "flex items-center gap-4 p-4 rounded-xl transition-all border",
                                                formData.is_commissionable
                                                    ? "bg-green-50 border-green-200 ring-1 ring-green-500/10"
                                                    : "bg-slate-50 border-slate-100 hover:border-slate-200"
                                            )}>
                                                <div className={cn(
                                                    "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                                                    formData.is_commissionable ? "bg-green-600 text-white" : "bg-slate-200 text-slate-400"
                                                )}>
                                                    <DollarSign size={20} />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <Label htmlFor="is_commissionable" className="text-sm font-bold text-slate-800 cursor-pointer">Aplica Comisión</Label>
                                                        <input
                                                            type="checkbox"
                                                            id="is_commissionable"
                                                            checked={formData.is_commissionable || false}
                                                            onChange={(e) => setFormData({ ...formData, is_commissionable: e.target.checked })}
                                                            className="sr-only peer"
                                                        />
                                                        <div
                                                            onClick={() => setFormData(p => ({ ...p, is_commissionable: !p.is_commissionable }))}
                                                            className="w-11 h-6 bg-slate-200 rounded-full cursor-pointer transition-colors relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 peer-checked:after:translate-x-5"
                                                        ></div>
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 mt-0.5">Al venderse generará comisión automática para el cajero.</p>
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                </CardContent>
                            </Card>

                            {/* SECTION 2: PRICES & COSTS (Unified Row) */}
                            <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                                            <DollarSign size={18} />
                                        </div>
                                        <h4 className="text-sm font-bold text-slate-800">Precios y Márgenes</h4>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Moneda Base:</span>
                                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">{anchorCurrency.symbol} {anchorCurrency.name || 'USD'}</span>
                                    </div>
                                </div>
                                <CardContent className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                                        {/* Net Cost */}
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Costo Neto</Label>
                                            <div className="relative group">
                                                <span className="absolute left-3 top-3 text-slate-400 group-focus-within:text-blue-500 font-bold">$</span>
                                                <Input
                                                    type="number"
                                                    name="cost"
                                                    value={formData.cost || ''}
                                                    onChange={handleInputChange}
                                                    onFocus={(e) => e.target.select()}
                                                    step="0.01"
                                                    className="pl-8 h-11 text-lg font-bold text-slate-700 border-slate-200 bg-slate-50/30 focus:bg-white"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>

                                        {/* Margin - Colored state */}
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Margen (%)</Label>
                                            <div className="relative group">
                                                <Input
                                                    type="number"
                                                    name="profit_margin"
                                                    value={formData.profit_margin || ''}
                                                    onChange={handleInputChange}
                                                    onFocus={(e) => e.target.select()}
                                                    step="0.01"
                                                    className={cn(
                                                        "h-11 text-center text-lg font-extrabold pr-8 border-slate-200 transition-colors",
                                                        parseFloat(formData.profit_margin) < 0 ? "text-rose-600 bg-rose-50" : "text-indigo-600 bg-indigo-50/50"
                                                    )}
                                                    placeholder="0.00"
                                                />
                                                <span className="absolute right-3 top-3 text-slate-400 font-bold">%</span>
                                            </div>
                                        </div>

                                        {/* Computed Sales Price - The Hero */}
                                        <div className="md:col-span-2 space-y-1.5">
                                            <Label className="text-[10px] uppercase tracking-wider text-emerald-600 font-black flex items-center gap-1">
                                                Precio de Venta Sugerido
                                                <Calculator size={10} />
                                            </Label>
                                            <div className="relative group">
                                                <span className={cn(
                                                    "absolute left-4 top-3 text-2xl font-black transition-colors",
                                                    parseFloat(formData.price) > 0 ? "text-emerald-500" : "text-slate-300"
                                                )}>$</span>
                                                <Input
                                                    type="number"
                                                    name="price"
                                                    value={formData.price || ''}
                                                    onChange={handleInputChange}
                                                    onFocus={(e) => e.target.select()}
                                                    step="0.01"
                                                    className={cn(
                                                        "pl-10 h-14 text-3xl font-black transition-all text-right border-2",
                                                        parseFloat(formData.price) > 0
                                                            ? "text-emerald-600 border-emerald-500/20 bg-emerald-50/30"
                                                            : "text-slate-400 border-slate-200 bg-slate-50/50 grayscale opacity-70"
                                                    )}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8 pt-6 border-t border-slate-100">
                                        {/* <div className="flex items-center gap-4">
                                            <div className="space-y-1.5 flex-1">
                                                <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">IVA (%)</Label>
                                                <div className="flex items-center gap-2">
                                                    <Input type="number" name="tax_rate" value={formData.tax_rate} onChange={handleInputChange} className="h-9 w-24 text-center font-bold" />
                                                    <span className="text-xs text-slate-400">Impuesto aplicado por defecto</span>
                                                </div>
                                            </div>
                                        </div> */}
                                        <div className="space-y-1.5 flex flex-col items-end">
                                            <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Referencia Moneda</Label>
                                            <Select name="exchange_rate_id" value={formData.exchange_rate_id?.toString()} onValueChange={(val) => setFormData({ ...formData, exchange_rate_id: val })}>
                                                <SelectTrigger className="h-9 w-48 text-xs font-bold bg-slate-100 border-none shadow-none">
                                                    <SelectValue placeholder="Utilizar Tasa Global" />
                                                </SelectTrigger>
                                                <SelectContent align="end">
                                                    <SelectItem value="null">Tasa Global (Default)</SelectItem>
                                                    {exchangeRates.map(r => <SelectItem key={r.id} value={r.id.toString()}>{r.name} ({parseFloat(r.rate)})</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* COMBO NOTICE: stock managed by components, not by the combo itself */}
                            {formData.is_combo && (
                                <Card className="border-indigo-200 bg-indigo-50/40 shadow-sm overflow-hidden animate-in zoom-in-95 duration-200">
                                    <div className="px-5 py-4 flex items-start gap-3">
                                        <div className="w-9 h-9 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <Layers size={18} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-indigo-800 mb-0.5">Este producto es un Combo / Kit</p>
                                            <p className="text-xs text-indigo-600 leading-relaxed">
                                                El stock se calcula automáticamente en base a la disponibilidad de sus componentes.
                                                No es necesario ingresar existencias manualmente — ve a la tab{' '}
                                                <span className="font-bold">AVANZADO</span> para ver y editar los productos que lo conforman.
                                            </p>
                                        </div>
                                    </div>
                                </Card>
                            )}

                            {/* SECTION 3: INVENTORY & STOCK (Collapsible) - Hidden for Services, Serialized AND Combo Products */}
                            {!formData.is_service && !formData.has_imei && !formData.is_combo && (
                                <Card className="border-slate-200 shadow-sm bg-white overflow-hidden animate-in zoom-in-95 duration-200">
                                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center">
                                                <Warehouse size={18} />
                                            </div>
                                            <h4 className="text-sm font-bold text-slate-800">Ubicación e Inventario</h4>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Stock Total:</span>
                                            <span className="text-lg font-black text-amber-600 bg-amber-50 px-3 py-0.5 rounded-full border border-amber-200">{formData.stock}</span>
                                        </div>
                                    </div>
                                    <CardContent className="p-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-5">
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Unidad de Medida Base</Label>
                                                    <Select value={formData.unit_type} onValueChange={(val) => setFormData({ ...formData, unit_type: val })}>
                                                        <SelectTrigger className="h-11 border-slate-200">
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
                                                <div className="grid grid-cols-2 gap-4 pt-2">
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[10px] uppercase tracking-wider text-rose-500 font-bold">Stock Mínimo</Label>
                                                        <Input type="number" name="min_stock" value={formData.min_stock} onChange={handleInputChange} className="h-10 text-center font-bold border-rose-100 bg-rose-50/30" />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Ubicación Física</Label>
                                                        <Input name="location" value={formData.location} onChange={handleInputChange} placeholder="Pasillo A-12..." className="h-10" />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-black mb-3 block">Distribución de Existencias</Label>
                                                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                                                    {warehouses.length > 0 ? warehouses.map(wh => {
                                                        const qty = formData.warehouse_stocks.find(s => s.warehouse_id === wh.id)?.quantity || 0;
                                                        return (
                                                            <div key={wh.id} className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200/50 shadow-sm transition-all hover:bg-slate-50">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                                                    <span className="text-[11px] font-bold text-slate-700 truncate w-32">{wh.name}</span>
                                                                </div>
                                                                <Input
                                                                    type="number"
                                                                    className="w-20 h-8 text-right text-xs font-black bg-slate-50 border-slate-200 focus:bg-white focus:ring-1 focus:ring-indigo-500"
                                                                    value={Number(qty).toString()}
                                                                    onChange={(e) => {
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
                                                        )
                                                    }) : (
                                                        <div className="text-center py-4 bg-white rounded-lg border border-dashed border-slate-300">
                                                            <p className="text-[10px] text-slate-400 font-bold">No hay almacenes configurados</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                    {!initialData && (
                                        <div className="bg-amber-50 px-6 py-3 border-t border-amber-100 flex items-center gap-3">
                                            <AlertCircle size={14} className="text-amber-600" />
                                            <p className="text-[10px] text-amber-700 font-medium italic">Estas cantidades se registrarán como saldo inicial del inventario.</p>
                                        </div>
                                    )}
                                </Card>
                            )}

                            {/* ALERTA DE STOCK para productos con IMEI (stock gestionado por seriales, pero mínimo sigue siendo útil) */}
                            {!formData.is_service && formData.has_imei && (
                                <Card className="border-rose-100 shadow-sm bg-white overflow-hidden animate-in zoom-in-95 duration-200">
                                    <div className="px-6 py-4 border-b border-rose-100 flex items-center gap-2 bg-rose-50/40">
                                        <div className="w-8 h-8 bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center">
                                            <Bell size={18} />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-800">Alerta de Stock Mínimo</h4>
                                            <p className="text-[10px] text-slate-500">El dashboard te alertará cuando las unidades disponibles caigan por debajo del límite.</p>
                                        </div>
                                    </div>
                                    <CardContent className="p-6">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] uppercase tracking-wider text-rose-500 font-bold">Unidades mínimas</Label>
                                                <Input
                                                    type="number"
                                                    name="min_stock"
                                                    value={formData.min_stock}
                                                    onChange={handleInputChange}
                                                    min={0}
                                                    className="h-10 text-center font-bold border-rose-100 bg-rose-50/30"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Ubicación Física</Label>
                                                <Input
                                                    name="location"
                                                    value={formData.location}
                                                    onChange={handleInputChange}
                                                    placeholder="Vitrina A, Caja 3..."
                                                    className="h-10"
                                                />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* PHARMACY SECTION - Only when pharmacy module is active */}
                            {modules?.pharmacy && (
                                <Card className="border-indigo-200 shadow-sm bg-white overflow-hidden animate-in zoom-in-95 duration-200">
                                    <div className="px-6 py-4 border-b border-indigo-100 flex items-center gap-2 bg-indigo-50/40">
                                        <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                                            <Shield size={18} />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-800">Información Farmacéutica</h4>
                                            <p className="text-[10px] text-slate-500">Datos regulatorios del medicamento o producto farmacéutico.</p>
                                        </div>
                                    </div>
                                    <CardContent className="p-6 space-y-5">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                            {/* Drug Classification */}
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] uppercase tracking-wider text-indigo-600 font-bold">Clasificación</Label>
                                                <Select
                                                    value={formData.drug_classification || ''}
                                                    onValueChange={(val) => setFormData(p => ({ ...p, drug_classification: val === 'none' ? '' : val }))}
                                                >
                                                    <SelectTrigger className="h-11 border-indigo-200 bg-indigo-50/20 focus:ring-indigo-500">
                                                        <SelectValue placeholder="Seleccionar clasificación..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">-- Sin clasificación --</SelectItem>
                                                        <SelectItem value="OTC">OTC — Venta Libre</SelectItem>
                                                        <SelectItem value="PRESCRIPTION">PRESCRIPTION — Requiere Receta</SelectItem>
                                                        <SelectItem value="CONTROLLED">CONTROLLED — Sustancia Controlada</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Storage Condition */}
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] uppercase tracking-wider text-indigo-600 font-bold flex items-center gap-1">
                                                    <Snowflake size={10} /> Condición de Almacenamiento
                                                </Label>
                                                <Select
                                                    value={formData.storage_condition || ''}
                                                    onValueChange={(val) => setFormData(p => ({ ...p, storage_condition: val === 'none' ? '' : val }))}
                                                >
                                                    <SelectTrigger className="h-11 border-indigo-200 bg-indigo-50/20 focus:ring-indigo-500">
                                                        <SelectValue placeholder="Seleccionar condición..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">-- Sin especificar --</SelectItem>
                                                        <SelectItem value="AMBIENT">AMBIENT — Temperatura Ambiente</SelectItem>
                                                        <SelectItem value="REFRIGERATED">REFRIGERATED — Refrigerado 2-8°C</SelectItem>
                                                        <SelectItem value="FROZEN">FROZEN — Congelado</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        {/* Active Ingredient */}
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] uppercase tracking-wider text-indigo-600 font-bold">Principio Activo</Label>
                                            <Input
                                                name="active_ingredient"
                                                value={formData.active_ingredient || ''}
                                                onChange={handleInputChange}
                                                placeholder="Ej: Paracetamol, Ibuprofeno..."
                                                className="h-11 border-indigo-200 bg-indigo-50/20 focus:border-indigo-500 focus:ring-indigo-500"
                                            />
                                        </div>

                                        {/* Requires Prescription */}
                                        <div className={cn(
                                            "flex items-center gap-4 p-4 rounded-xl transition-all border",
                                            formData.requires_prescription
                                                ? "bg-indigo-50 border-indigo-200 ring-1 ring-indigo-500/10"
                                                : "bg-slate-50 border-slate-100 hover:border-indigo-100"
                                        )}>
                                            <div className={cn(
                                                "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                                                formData.requires_prescription ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-400"
                                            )}>
                                                <Shield size={20} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <Label htmlFor="requires_prescription" className="text-sm font-bold text-slate-800 cursor-pointer">Requiere receta médica</Label>
                                                    <input
                                                        type="checkbox"
                                                        id="requires_prescription"
                                                        checked={formData.requires_prescription || false}
                                                        onChange={(e) => setFormData(p => ({ ...p, requires_prescription: e.target.checked }))}
                                                        className="sr-only peer"
                                                    />
                                                    <div
                                                        onClick={() => setFormData(p => ({ ...p, requires_prescription: !p.requires_prescription }))}
                                                        className="w-11 h-6 bg-slate-200 rounded-full cursor-pointer transition-colors relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:translate-x-5"
                                                    ></div>
                                                </div>
                                                <p className="text-[11px] text-slate-500 mt-0.5">El POS solicitará confirmación antes de agregar al carrito.</p>
                                            </div>
                                        </div>

                                        {/* Destacar en catálogo público */}
                                        <div className="flex items-start gap-3 pt-3 border-t border-slate-100">
                                            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                                                <span className="text-base">⭐</span>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <Label htmlFor="featured" className="text-sm font-bold text-slate-800 cursor-pointer">Destacar en catálogo público</Label>
                                                    <input
                                                        type="checkbox"
                                                        id="featured"
                                                        checked={formData.featured || false}
                                                        onChange={(e) => setFormData(p => ({ ...p, featured: e.target.checked }))}
                                                        className="sr-only peer"
                                                    />
                                                    <div
                                                        onClick={() => setFormData(p => ({ ...p, featured: !p.featured }))}
                                                        className="w-11 h-6 bg-slate-200 rounded-full cursor-pointer transition-colors relative after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-400 peer-checked:after:translate-x-5"
                                                    ></div>
                                                </div>
                                                <p className="text-[11px] text-slate-500 mt-0.5">Aparece primero en el catálogo con una etiqueta dorada ⭐.</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </TabsContent>

                        {/* ADVANCED TAB: Combined Units & Combos */}
                        <TabsContent value="advanced" className="mt-0 space-y-6 pb-20 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="grid grid-cols-1 gap-6">
                                <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                                    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/30">
                                        <Layers size={18} className="text-indigo-500" />
                                        <h4 className="text-sm font-bold text-slate-800">Unidades de Venta y Precios Alternativos</h4>
                                    </div>
                                    <CardContent className="p-0">
                                        <ProductUnitManager
                                            units={formData.units}
                                            onUnitsChange={(u) => setFormData(p => ({ ...p, units: u }))}
                                            baseUnitType={formData.unit_type}
                                            basePrice={formData.price}
                                            baseCost={formData.cost}
                                            exchangeRates={exchangeRates}
                                        />
                                    </CardContent>

                                    {/* Price Lists Section */}
                                    <div className="border-t border-slate-100">
                                        <div className="px-6 py-4 flex items-center gap-2 bg-slate-50/30">
                                            <Tag size={18} className="text-emerald-500" />
                                            <h4 className="text-sm font-bold text-slate-800">Listas de Precios Especiales</h4>
                                        </div>
                                        <CardContent className="p-6 pt-2">
                                            <ProductPriceListManager
                                                prices={formData.prices || []}
                                                onPricesChange={(p) => setFormData(prev => ({ ...prev, prices: p }))}
                                                priceLists={priceLists}
                                                basePrice={formData.price}
                                                onRefresh={fetchPriceLists}
                                            />
                                        </CardContent>
                                    </div>
                                </Card>

                                <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                                    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/30">
                                        <Tag size={18} className="text-indigo-500" />
                                        <h4 className="text-sm font-bold text-slate-800">Configuración de Combo / Kit</h4>
                                    </div>
                                    <CardContent className="p-0">
                                        <ComboManager
                                            comboItems={formData.combo_items}
                                            onItemsChange={(i) => setFormData(p => ({ ...p, combo_items: i, is_combo: i.length > 0 }))}
                                        />
                                    </CardContent>
                                </Card>

                                <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                                    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/30">
                                        <ShieldCheck size={18} className="text-indigo-500" />
                                        <h4 className="text-sm font-bold text-slate-800">Política de Garantía</h4>
                                    </div>
                                    <CardContent className="p-6">
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>Vincular Política de Garantía</Label>
                                                <Select
                                                    value={formData.warranty_policy_id?.toString()}
                                                    onValueChange={(val) => setFormData({ ...formData, warranty_policy_id: val === 'null' ? null : val })}
                                                >
                                                    <SelectTrigger className="h-11 border-slate-200">
                                                        <SelectValue placeholder="Sin garantía (u omitida)" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="null">-- Ninguna / Según Factura --</SelectItem>
                                                        {policies.map(p => (
                                                            <SelectItem key={p.id} value={p.id.toString()}>
                                                                {p.name} ({p.type === 'LIFETIME' ? 'De por vida' : `${p.duration} ${p.type}`})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <p className="text-xs text-slate-500">
                                                Esta política se reflejará al momento de la venta y permitirá gestionar reclamos de forma automática.
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        {/* PRECIOS POR VOLUMEN TAB */}
                        {initialData?.id && (
                            <TabsContent value="precios" className="mt-0 space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="rounded-xl border border-amber-200 bg-white overflow-hidden shadow-sm">
                                    <div className="px-6 py-4 border-b border-amber-100 flex items-center gap-2 bg-amber-50/40">
                                        <Zap size={18} className="text-amber-500" />
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-800">Reglas de Descuento por Volumen</h4>
                                            <p className="text-xs text-slate-500">Se aplican automaticamente en el POS según la cantidad comprada</p>
                                        </div>
                                    </div>
                                    <div className="p-6">
                                        <DiscountRulesManager
                                            productId={initialData.id}
                                            initialRules={initialData.discount_rules || []}
                                        />
                                    </div>
                                </div>
                            </TabsContent>
                        )}
                    </div>
                </Tabs>
            </SheetContent>
        </Sheet>
    );
};

export default ProductForm;
