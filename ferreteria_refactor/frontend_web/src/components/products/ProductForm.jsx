import { useState, useEffect } from 'react';
import { X, Plus, Package, DollarSign, Barcode, Tag, Layers, AlertTriangle, ShieldCheck, Calculator, Image as ImageIcon, Check, Bell, Warehouse, AlertCircle, ScanBarcode } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';
import apiClient from '../../config/axios';
import ProductUnitManager from './ProductUnitManager';
import ComboManager from './ComboManager';
import ProductImageUploader from './ProductImageUploader';
import { cn } from '../../lib/utils';
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

const ProductForm = ({ isOpen, onClose, onSubmit, initialData = null, categories = [], warehouses = [], exchangeRates = [] }) => {
    const { getActiveCurrencies, currencies, modules } = useConfig();
    const anchorCurrency = currencies.find(c => c.is_anchor) || { symbol: '$' };

    // categories, warehouses, and exchangeRates are now props. No need for local state for them if we trust the parent.
    // However, if we want to ensure they are available even if parent didn't pass them (fallback), we could keep state, but for performance let's rely on props.
    // We still need local state for priceLists as parent doesn't have it.

    const [priceLists, setPriceLists] = useState([]);
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
        warranty_duration: 0,
        warranty_unit: 'DAYS',
        warranty_notes: '',
        profit_margin: null,
        discount_percentage: 0,
        is_discount_active: false,
        tax_rate: 0,
        units: [],
        combo_items: [],
        warehouse_stocks: [],
        prices: {},
        image_url: ''
    });

    const [isScanning, setIsScanning] = useState(false);

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
                    is_service: initialData.is_service || false,  // NEW: Load service flag
                    warranty_duration: parseInt(initialData.warranty_duration) || 0,
                    warranty_unit: initialData.warranty_unit || 'DAYS',
                    warranty_notes: initialData.warranty_notes || '',
                    profit_margin: initialData.profit_margin ? parseFloat(initialData.profit_margin) : null,
                    discount_percentage: parseFloat(initialData.discount_percentage) || 0,
                    is_discount_active: initialData.is_discount_active || false,
                    tax_rate: initialData.tax_rate !== undefined ? parseFloat(initialData.tax_rate) : 0,
                    units: mappedUnits,
                    combo_items: initialData.combo_items || [],
                    warehouse_stocks: initialData.stocks || [],
                    prices: initialPrices,
                    image_url: initialData.image_url || ''
                });
            } else {
                setFormData({
                    name: '', sku: '', category_id: null, cost: 0, price: 0, stock: 0, min_stock: 5, location: '',
                    margin: 0, unit_type: 'UNID', exchange_rate_id: null, is_combo: false, has_imei: false, is_service: false, units: [],
                    combo_items: [], tax_rate: 0, warehouse_stocks: [], prices: {}, image_url: ''
                });
            }
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
                    const calculatedPrice = cost * (1 + (margin / 100));
                    updated.price = calculatedPrice.toFixed(2);
                }
            }

            // Reverse Logic: If Price is edited, update Margin
            if (name === 'price') {
                const price = parseFloat(value);
                const cost = parseFloat(prev.cost);
                if (!isNaN(price) && price > 0 && !isNaN(cost) && cost > 0) {
                    const margin = ((price - cost) / cost) * 100;
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
        if (!formData.name.trim()) return alert('El nombre es obligatorio');
        if (parseFloat(formData.price) <= 0) return alert('El precio debe ser mayor a 0');

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
            warranty_duration: parseInt(formData.warranty_duration) || 0,
            profit_margin: formData.profit_margin ? parseFloat(formData.profit_margin) : null,
            discount_percentage: parseFloat(formData.discount_percentage) || 0,
            tax_rate: parseFloat(formData.tax_rate) || 0,
            is_service: formData.is_service || false,  // NEW: Include service flag
            units: formData.units.map(u => ({
                unit_name: u.unit_name,
                conversion_factor: u.type === 'fraction' ? (u.user_input !== 0 ? 1 / parseFloat(u.user_input) : 0) : parseFloat(u.user_input),
                barcode: u.barcode,
                price_usd: parseFloat(u.price_usd) || null,
                is_default: false,
                exchange_rate_id: u.exchange_rate_id ? parseInt(u.exchange_rate_id) : null
            })),
            combo_items: formData.is_combo ? formData.combo_items.map(ci => ({ child_product_id: ci.child_product_id, quantity: parseFloat(ci.quantity) })) : [],
            prices: pricesArray,
            image_url: formData.image_url
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
                            <TabsTrigger value="advanced" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 rounded-none bg-transparent h-full px-0 font-bold text-slate-500 shadow-none text-sm transition-all">AVANZADO</TabsTrigger>
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
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Categoría</Label>
                                                    <Select
                                                        value={formData.category_id?.toString()}
                                                        onValueChange={(val) => setFormData({ ...formData, category_id: val })}
                                                    >
                                                        <SelectTrigger className="h-11 border-slate-200 bg-slate-50/30 focus:bg-white">
                                                            <SelectValue placeholder="Seleccionar categoría..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {categories.map(c => (
                                                                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
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
                                        <div className="flex items-center gap-4">
                                            <div className="space-y-1.5 flex-1">
                                                <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">IVA (%)</Label>
                                                <div className="flex items-center gap-2">
                                                    <Input type="number" name="tax_rate" value={formData.tax_rate} onChange={handleInputChange} className="h-9 w-24 text-center font-bold" />
                                                    <span className="text-xs text-slate-400">Impuesto aplicado por defecto</span>
                                                </div>
                                            </div>
                                        </div>
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

                            {/* SECTION 3: INVENTORY & STOCK (Collapsible) - Hidden for Services AND Serialized Products */}
                            {!formData.is_service && !formData.has_imei && (
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
                                </Card>

                                <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                                    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/30">
                                        <Tag size={18} className="text-indigo-500" />
                                        <h4 className="text-sm font-bold text-slate-800">Configuración de Combo / Kit</h4>
                                    </div>
                                    <CardContent className="p-0">
                                        <ComboManager
                                            comboItems={formData.combo_items}
                                            onItemsChange={(i) => setFormData(p => ({ ...p, combo_items: i }))}
                                        />
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </SheetContent>
        </Sheet>
    );
};

export default ProductForm;
