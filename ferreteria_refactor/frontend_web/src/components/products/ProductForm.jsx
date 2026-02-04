import { useState, useEffect } from 'react';
import { X, Plus, Package, DollarSign, Barcode, Tag, Layers, AlertTriangle, ShieldCheck, Calculator, Image as ImageIcon, Check, Bell, Warehouse, AlertCircle } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';
import apiClient from '../../config/axios';
import ProductUnitManager from './ProductUnitManager';
import ComboManager from './ComboManager';
import ProductImageUploader from './ProductImageUploader';
import clsx from 'clsx';
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
                    margin: 0, unit_type: 'UNID', exchange_rate_id: null, is_combo: false, has_imei: false, units: [],
                    combo_items: [], tax_rate: 0, warehouse_stocks: [], prices: {}, image_url: ''
                });
            }
        }
    }, [isOpen, initialData]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;

        // Update state with the raw string value to allow typing decimals (e.g. "10.")
        setFormData(prev => {
            const updated = { ...prev, [name]: value };

            // Logic: Cost + Margin (Markup) -> Price
            // Parse values only for calculation
            if (name === 'cost' || name === 'profit_margin') {
                const cost = name === 'cost' ? parseFloat(value) : parseFloat(prev.cost);
                const margin = name === 'profit_margin' ? parseFloat(value) : parseFloat(prev.profit_margin);

                if (!isNaN(cost) && cost >= 0 && !isNaN(margin) && margin >= 0) {
                    const calculatedPrice = cost * (1 + (margin / 100));
                    updated.price = calculatedPrice.toFixed(2); // Keep 2 decimals string
                }
            }

            // Reverse Logic: If Price is edited, update Margin (Markup)
            if (name === 'price') {
                const price = parseFloat(value);
                const cost = parseFloat(prev.cost);
                if (!isNaN(price) && price > 0 && !isNaN(cost) && cost > 0) {
                    const margin = ((price - cost) / cost) * 100;
                    updated.profit_margin = margin.toFixed(2); // Keep 2 decimals string
                }
            }

            return updated;
        });
    };

    // --- API CALLS ---
    // fetchCategories, fetchWarehouses, fetchExchangeRates removed as they are now props

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
            units: formData.units.map(u => ({
                unit_name: u.unit_name,
                conversion_factor: u.type === 'fraction' ? (u.user_input !== 0 ? 1 / parseFloat(u.user_input) : 0) : parseFloat(u.user_input),
                barcode: u.barcode,
                price_usd: parseFloat(u.price_usd) || null,
                is_default: false,
                exchange_rate_id: u.exchange_rate_id ? parseInt(u.exchange_rate_id) : null
            })),
            combo_items: formData.is_combo ? formData.combo_items.map(ci => ({ child_product_id: ci.child_product_id, quantity: parseFloat(ci.quantity) })) : [],
            prices: pricesArray
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
                        <TabsList className="w-full justify-start h-10 bg-transparent p-0 gap-6">
                            <TabsTrigger value="main" className="data-[state=active]:border-b-2 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 rounded-none bg-transparent h-full px-0 font-medium text-slate-500 shadow-none text-sm">General</TabsTrigger>
                            <TabsTrigger value="units" className="data-[state=active]:border-b-2 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 rounded-none bg-transparent h-full px-0 font-medium text-slate-500 shadow-none text-sm">Medidas y Precios</TabsTrigger>
                            <TabsTrigger value="combos" className="data-[state=active]:border-b-2 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 rounded-none bg-transparent h-full px-0 font-medium text-slate-500 shadow-none text-sm">Combos</TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50">
                        <TabsContent value="main" className="mt-0 space-y-6 pb-20">

                            {/* --- MINIMALIST BENTO GRID --- */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

                                {/* SECTION 1: IDENTITY (Compact & Clean) */}
                                <Card className="md:col-span-12 border-slate-200 shadow-none bg-white">
                                    <CardContent className="p-4">
                                        <div className="flex flex-col sm:flex-row gap-5">
                                            {/* Image Upload - Fixed Square */}
                                            <div className="w-32 h-32 flex-shrink-0">
                                                <div className="w-full h-full bg-slate-50 rounded-lg border border-dashed border-slate-200 hover:border-indigo-400 transition-all cursor-pointer flex flex-col items-center justify-center relative overflow-hidden group">
                                                    {initialData?.id ? (
                                                        <ProductImageUploader
                                                            productId={initialData.id}
                                                            currentImageUrl={formData.image_url}
                                                            onImageUpdate={(newUrl) => setFormData({ ...formData, image_url: newUrl })}
                                                        />
                                                    ) : (
                                                        <div className="text-center p-2">
                                                            <ImageIcon className="mx-auto text-slate-300 mb-1" size={24} />
                                                            <span className="text-[10px] text-slate-400 font-medium block leading-tight">Guardar para subir</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Info Fields - Stacked & Dense */}
                                            <div className="flex-1 flex flex-col justify-between py-1">
                                                <div className="space-y-1">
                                                    <Label htmlFor="name" className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Nombre del Producto <span className="text-rose-500">*</span></Label>
                                                    <Input
                                                        id="name"
                                                        name="name"
                                                        value={formData.name}
                                                        onChange={handleInputChange}
                                                        placeholder="Nombre descriptivo..."
                                                        className="h-9 text-base font-semibold border-slate-200 focus:border-indigo-500"
                                                        autoFocus
                                                    />
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">SKU / Código</Label>
                                                        <div className="relative">
                                                            <Barcode className="absolute left-2.5 top-2.5 text-slate-400" size={14} />
                                                            <Input
                                                                name="sku"
                                                                value={formData.sku}
                                                                onChange={handleInputChange}
                                                                className="h-9 pl-8 text-sm font-mono"
                                                                placeholder="---"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Categoría</Label>
                                                        <Select
                                                            value={formData.category_id?.toString()}
                                                            onValueChange={(val) => setFormData({ ...formData, category_id: val })}
                                                        >
                                                            <SelectTrigger className="h-9 w-full border-slate-200">
                                                                <SelectValue placeholder="Seleccionar..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {categories.map(c => (
                                                                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* SECTION 2: PRICING (Financial Style) */}
                                <Card className="md:col-span-12 lg:col-span-8 border-slate-200 shadow-none bg-white">
                                    <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                                        <h4 className="text-sm font-semibold text-slate-800">Precios y Costos</h4>
                                        <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 uppercase font-medium">{anchorCurrency.name}</span>
                                    </div>
                                    <CardContent className="p-5">
                                        <div className="flex flex-col sm:flex-row items-end gap-4">
                                            {/* Cost */}
                                            <div className="flex-1 space-y-1">
                                                <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Costo Neto</Label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-2.5 text-slate-400 text-xs">$</span>
                                                    <Input
                                                        type="number"
                                                        name="cost"
                                                        value={formData.cost}
                                                        onChange={handleInputChange}
                                                        step="0.01"
                                                        className="pl-6 h-10 font-medium text-slate-700 border-slate-200"
                                                    />
                                                </div>
                                            </div>

                                            {/* Margin */}
                                            <div className="w-32 space-y-1">
                                                <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold text-center block">Margen</Label>
                                                <div className="relative">
                                                    <Input
                                                        type="number"
                                                        name="profit_margin"
                                                        value={formData.profit_margin || ''}
                                                        onChange={handleInputChange}
                                                        step="0.01"
                                                        className="pr-6 h-10 text-center font-medium text-blue-600 border-slate-200"
                                                    />
                                                    <span className="absolute right-2 top-3 text-slate-400 text-[10px] font-bold">%</span>
                                                </div>
                                            </div>

                                            {/* Price - Highlighted Text Only */}
                                            <div className="flex-1 space-y-1">
                                                <Label className="text-[10px] uppercase tracking-wider text-emerald-600 font-bold block text-right">Precio Venta</Label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-2.5 text-emerald-600/70 text-lg font-bold">$</span>
                                                    <Input
                                                        type="number"
                                                        name="price"
                                                        value={formData.price}
                                                        onChange={handleInputChange}
                                                        step="0.01"
                                                        className="pl-8 h-12 text-2xl font-bold text-emerald-600 border-emerald-100 focus-visible:ring-emerald-500 bg-emerald-50/30 text-right"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <Separator className="my-4" />

                                        {/* Taxes and Exchange */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] flex items-center gap-1 text-slate-500 font-semibold">
                                                    Impuesto (IVA %)
                                                </Label>
                                                <Input type="number" name="tax_rate" value={formData.tax_rate} onChange={handleInputChange} className="h-8 w-24 text-sm" />
                                            </div>
                                            <div className="space-y-1 flex flex-col items-end">
                                                <Label className="text-[10px] text-slate-500 font-semibold">Tasa de Cambio</Label>
                                                <Select name="exchange_rate_id" value={formData.exchange_rate_id?.toString()} onValueChange={(val) => setFormData({ ...formData, exchange_rate_id: val })}>
                                                    <SelectTrigger className="h-8 w-40 text-xs">
                                                        <SelectValue placeholder="Global" />
                                                    </SelectTrigger>
                                                    <SelectContent align="end">
                                                        <SelectItem value="null">Usar Global</SelectItem>
                                                        {exchangeRates.map(r => <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* SECTION 3: INVENTORY (Compact) */}
                                <Card className="md:col-span-12 lg:col-span-4 border-slate-200 shadow-none bg-white">
                                    <div className="px-5 py-3 border-b border-slate-100">
                                        <h4 className="text-sm font-semibold text-slate-800">Inventario</h4>
                                    </div>
                                    <CardContent className="p-5 space-y-4">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Unidad Base</Label>
                                            <Select value={formData.unit_type} onValueChange={(val) => setFormData({ ...formData, unit_type: val })}>
                                                <SelectTrigger className="h-9 w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="UNID">Unidad (Pza)</SelectItem>
                                                    <SelectItem value="KILO">Kilo (Kg)</SelectItem>
                                                    <SelectItem value="METRO">Metro (m)</SelectItem>
                                                    {modules?.services && <SelectItem value="SERVICE_UNIT">Servicio</SelectItem>}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {!['SERVICE', 'SERVICE_UNIT'].includes(formData.unit_type) && (
                                            <>
                                                <div className="pt-2">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <Label className="text-[10px] text-slate-500 font-bold uppercase">Stock por Almacén</Label>
                                                        <span className="text-[10px] text-slate-400 font-medium">Cantidad Inicial</span>
                                                    </div>
                                                    <div className="space-y-1 max-h-[120px] overflow-y-auto">
                                                        {warehouses.map(wh => {
                                                            const qty = formData.warehouse_stocks.find(s => s.warehouse_id === wh.id)?.quantity || 0;
                                                            return (
                                                                <div key={wh.id} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                                                                    <span className="text-xs text-slate-600 font-medium truncate w-24" title={wh.name}>{wh.name}</span>
                                                                    <Input
                                                                        type="number"
                                                                        className="w-24 h-8 text-right text-xs bg-slate-50 focus:bg-white border-slate-200"
                                                                        value={qty}
                                                                        placeholder="0"
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
                                                        })}
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
                                                    <span className="text-xs font-bold text-slate-500">TOTAL</span>
                                                    <span className="text-2xl font-bold text-slate-900">{formData.stock}</span>
                                                </div>
                                            </>
                                        )}
                                    </CardContent>
                                </Card>

                            </div>
                        </TabsContent>

                        {/* Other Tabs content wrappers - kept simple but contained */}
                        <TabsContent value="units" className="h-full mt-0">
                            <Card className="h-full border-slate-200 shadow-none"><CardContent className="p-6"><ProductUnitManager units={formData.units} onUnitsChange={(u) => setFormData(p => ({ ...p, units: u }))} baseUnitType={formData.unit_type} basePrice={formData.price} baseCost={formData.cost} exchangeRates={exchangeRates} /></CardContent></Card>
                        </TabsContent>
                        <TabsContent value="combos" className="h-full mt-0">
                            <Card className="h-full border-slate-200 shadow-none"><CardContent className="p-6"><ComboManager comboItems={formData.combo_items} onItemsChange={(i) => setFormData(p => ({ ...p, combo_items: i }))} /></CardContent></Card>
                        </TabsContent>
                    </div>
                </Tabs>
            </SheetContent>
        </Sheet>
    );
};

export default ProductForm;
