import { useState, useEffect } from 'react';
import { X, Plus, Package, DollarSign, Barcode, Tag, Layers, AlertTriangle, ShieldCheck, Calculator, Image as ImageIcon, Check } from 'lucide-react';
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
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';

const ProductForm = ({ isOpen, onClose, onSubmit, initialData = null }) => {
    const { getActiveCurrencies, currencies, modules } = useConfig();
    const anchorCurrency = currencies.find(c => c.is_anchor) || { symbol: '$' };

    const [categories, setCategories] = useState([]);
    const [exchangeRates, setExchangeRates] = useState([]);
    const [priceLists, setPriceLists] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
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
        prices: {} // { price_list_id: price_value }
    });

    // Initial Data Load
    useEffect(() => {
        if (isOpen) {
            fetchCategories();
            fetchExchangeRates();
            fetchDefaultTaxRate();
            fetchWarehouses();
            fetchPriceLists();

            if (initialData) {
                const mappedUnits = (initialData.units || []).map(u => {
                    const isPacking = u.conversion_factor >= 1;
                    const type = isPacking ? 'packing' : 'fraction';
                    const user_input = isPacking
                        ? u.conversion_factor
                        : (u.conversion_factor > 0 ? 1 / u.conversion_factor : 1000);

                    return {
                        id: u.id || Date.now() + Math.random(),
                        unit_name: u.unit_name,
                        user_input: user_input,
                        conversion_factor: u.conversion_factor,
                        type: type,
                        barcode: u.barcode || '',
                        price_usd: u.price_usd || 0,
                        exchange_rate_id: u.exchange_rate_id || null,
                        discount_percentage: u.discount_percentage || 0,
                        is_discount_active: u.is_discount_active || false
                    };
                });

                const initialPrices = {};
                if (initialData.prices && Array.isArray(initialData.prices)) {
                    initialData.prices.forEach(p => {
                        initialPrices[p.price_list_id] = p.price;
                    });
                }

                setFormData({
                    name: initialData.name || '',
                    sku: initialData.sku || '',
                    category_id: initialData.category_id || null,
                    cost: initialData.cost_price || 0,
                    price: initialData.price || 0,
                    stock: initialData.stock || 0,
                    min_stock: initialData.min_stock || 5,
                    location: initialData.location || '',
                    unit_type: initialData.unit_type || 'UNID',
                    margin: initialData.price > 0
                        ? ((initialData.price - initialData.cost_price) / initialData.price) * 100
                        : 0,
                    exchange_rate_id: initialData.exchange_rate_id || null,
                    is_combo: initialData.is_combo || false,
                    has_imei: initialData.has_imei || false,
                    warranty_duration: initialData.warranty_duration || 0,
                    warranty_unit: initialData.warranty_unit || 'DAYS',
                    warranty_notes: initialData.warranty_notes || '',
                    profit_margin: initialData.profit_margin || null,
                    discount_percentage: initialData.discount_percentage || 0,
                    is_discount_active: initialData.is_discount_active || false,
                    tax_rate: initialData.tax_rate !== undefined ? initialData.tax_rate : 0,
                    units: mappedUnits,
                    combo_items: initialData.combo_items || [],
                    warehouse_stocks: initialData.stocks || [],
                    prices: initialPrices,
                    image_url: initialData.image_url || ''
                });
            } else {
                setFormData({
                    name: '', sku: '', category_id: null,
                    cost: 0, price: 0, stock: 0, min_stock: 5, location: '',
                    margin: 0, unit_type: 'UNID', exchange_rate_id: null,
                    is_combo: false, has_imei: false, units: [], combo_items: [],
                    tax_rate: 0,
                    warehouse_stocks: [],
                    prices: {},
                    image_url: ''
                });
            }
        }
    }, [isOpen, initialData]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        let newValue = value;

        if (['cost', 'price', 'stock', 'min_stock', 'warranty_duration', 'profit_margin', 'discount_percentage', 'tax_rate'].includes(name)) {
            newValue = value === '' ? '' : parseFloat(value) || 0;
        }

        setFormData(prev => {
            const updated = { ...prev, [name]: newValue };

            // Logic: Cost + Margin (Markup) -> Price
            if (name === 'cost' || name === 'profit_margin') {
                const cost = name === 'cost' ? newValue : (parseFloat(prev.cost) || 0);
                const margin = name === 'profit_margin' ? newValue : (parseFloat(prev.profit_margin) || 0);

                if (cost > 0 && margin >= 0) {
                    const calculatedPrice = cost * (1 + (margin / 100));
                    updated.price = parseFloat(calculatedPrice.toFixed(2));
                }
            }

            // Reverse Logic: If Price is edited, update Margin (Markup)
            if (name === 'price') {
                const price = newValue;
                const cost = parseFloat(prev.cost) || 0;
                if (price > 0 && cost > 0) {
                    const margin = ((price - cost) / cost) * 100;
                    updated.profit_margin = parseFloat(margin.toFixed(2));
                }
            }

            return updated;
        });
    };

    const fetchCategories = async () => {
        try {
            const response = await apiClient.get('/categories');
            setCategories(response.data);
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    const fetchWarehouses = async () => {
        try {
            const { data } = await apiClient.get('/warehouses');
            setWarehouses(data);
        } catch (error) {
            console.error('Error fetching warehouses:', error);
        }
    };

    const fetchPriceLists = async () => {
        try {
            const { data } = await apiClient.get('/price-lists/');
            setPriceLists(data.filter(pl => pl.is_active));
        } catch (error) {
            console.error('Error fetching price lists:', error);
        }
    };

    const fetchExchangeRates = async () => {
        try {
            const response = await apiClient.get('/config/exchange-rates', {
                params: { is_active: true }
            });
            setExchangeRates(response.data);
        } catch (error) {
            console.error('Error fetching exchange rates:', error);
        }
    };

    const fetchDefaultTaxRate = async () => {
        if (initialData) return;
        try {
            // Only fetch if we don't have a value (avoid overwriting if editing with 0)
            const response = await apiClient.get('/config/tax-rate/default');
            setFormData(prev => ({ ...prev, tax_rate: response.data.rate || 0 }));
        } catch (error) {
            console.error('Error fetching default tax rate:', error);
        }
    };

    const handleSubmit = () => {
        if (!formData.name.trim()) {
            alert('El nombre del producto es obligatorio');
            return;
        }
        if (parseFloat(formData.price) <= 0 || isNaN(parseFloat(formData.price))) {
            alert('El precio debe ser mayor a 0');
            return;
        }

        // Construct Prices Array
        const pricesArray = Object.entries(formData.prices).map(([listId, priceValue]) => ({
            price_list_id: parseInt(listId),
            price: parseFloat(priceValue) || 0
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

            units: formData.units.map(u => {
                let factor = parseFloat(u.user_input);
                if (u.type === 'fraction') factor = factor !== 0 ? 1 / factor : 0;
                return {
                    unit_name: u.unit_name,
                    conversion_factor: factor,
                    barcode: u.barcode,
                    price_usd: parseFloat(u.price_usd) || null,
                    is_default: false,
                    exchange_rate_id: u.exchange_rate_id ? parseInt(u.exchange_rate_id) : null
                };
            }),
            combo_items: formData.is_combo ? formData.combo_items.map(ci => ({
                child_product_id: ci.child_product_id,
                quantity: parseFloat(ci.quantity)
            })) : [],
            prices: pricesArray
        };
        onSubmit(payload);
    };

    const handleDeleteList = async (listId) => {
        if (!confirm("¿Estás seguro de que deseas eliminar esta lista de precios del sistema? Esta acción no se puede deshacer.")) return;

        try {
            await apiClient.delete(`/price-lists/${listId}`);
            setPriceLists(prev => prev.filter(l => l.id !== listId));
            setFormData(prev => {
                const newPrices = { ...prev.prices };
                delete newPrices[listId];
                return { ...prev, prices: newPrices };
            });
        } catch (error) {
            console.error(error);
            alert("Error al eliminar la lista: " + (error.response?.data?.detail || error.message));
        }
    };

    const handleToggleListAuth = async (list) => {
        const newStatus = !list.requires_auth;
        const confirmMsg = newStatus
            ? `¿Activar protección por PIN para "${list.name}"?`
            : `¿Desactivar protección por PIN para "${list.name}"?`;

        if (!confirm(confirmMsg)) return;

        try {
            const updated = { ...list, requires_auth: newStatus };
            setPriceLists(prev => prev.map(l => l.id === list.id ? updated : l));

            await apiClient.put(`/price-lists/${list.id}`, {
                name: list.name,
                requires_auth: newStatus,
                is_active: list.is_active
            });
        } catch (error) {
            setPriceLists(prev => prev.map(l => l.id === list.id ? list : l));
            alert("Error al actualizar lista: " + (error.response?.data?.detail || error.message));
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent side="right" className="w-full sm:w-[85vw] sm:max-w-[1100px] flex flex-col p-0 gap-0">
                <SheetHeader className="p-6 border-b border-slate-100 bg-white">
                    <SheetTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        {initialData ? <Package className="text-indigo-600" /> : <Plus className="text-indigo-600" />}
                        {initialData ? 'Editar Producto' : 'Nuevo Producto'}
                    </SheetTitle>
                    <SheetDescription>
                        {initialData ? 'Modifica los detalles, precios e inventario del producto.' : 'Completa la información para registrar un nuevo producto en el catálogo.'}
                    </SheetDescription>
                </SheetHeader>

                <Tabs defaultValue="main" className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-6 pt-2 bg-slate-50/50 border-b border-slate-200">
                        <TabsList className="grid w-full grid-cols-3 max-w-md bg-white">
                            <TabsTrigger value="main">Detalles</TabsTrigger>
                            <TabsTrigger value="units">Presentaciones</TabsTrigger>
                            <TabsTrigger value="combos">Combos</TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-y-auto bg-slate-50/30 p-6">
                        <TabsContent value="main" className="mt-0 h-full">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pb-20">

                                {/* SECTION 1: HEADER IDENTITY (Full Width) */}
                                <div className="md:col-span-12 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                        <div className="md:col-span-6 space-y-2">
                                            <Label htmlFor="name">Nombre del Producto <span className="text-rose-500">*</span></Label>
                                            <Input
                                                id="name"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleInputChange}
                                                placeholder="Ej: Taladro Percutor 500W"
                                                className="font-bold text-lg"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="md:col-span-3 space-y-2">
                                            <Label htmlFor="sku">Código Barra / SKU</Label>
                                            <div className="relative">
                                                <Barcode className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                                <Input
                                                    id="sku"
                                                    name="sku"
                                                    value={formData.sku}
                                                    onChange={handleInputChange}
                                                    className="pl-9"
                                                    placeholder="SCAN-001"
                                                />
                                            </div>
                                        </div>
                                        <div className="md:col-span-3 space-y-2">
                                            <Label htmlFor="category_id">Categoría</Label>
                                            <select
                                                id="category_id"
                                                name="category_id"
                                                value={formData.category_id || ''}
                                                onChange={handleInputChange}
                                                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <option value="">-- Sin categoría --</option>
                                                {categories.map(cat => (
                                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* SECTION 2: FINANCES & PRICES (Left Column - 7/12) */}
                                <div className="md:col-span-12 lg:col-span-7 space-y-6">
                                    {/* Base Cost & Price */}
                                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none"><DollarSign size={100} /></div>
                                        <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center border-b border-slate-100 pb-2">
                                            <Calculator className="mr-2 text-indigo-500" size={16} /> Estructura de Costos
                                        </h4>

                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div className="space-y-2">
                                                <Label className="uppercase text-[10px] text-slate-500">Costo Neto ({anchorCurrency.symbol})</Label>
                                                <Input
                                                    type="number"
                                                    name="cost"
                                                    value={formData.cost}
                                                    onChange={handleInputChange}
                                                    step="0.01"
                                                    className="font-bold"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="uppercase text-[10px] text-slate-500">Margen %</Label>
                                                <Input
                                                    type="number"
                                                    name="profit_margin"
                                                    value={formData.profit_margin || ''}
                                                    onChange={handleInputChange}
                                                    className="font-bold"
                                                />
                                            </div>
                                        </div>

                                        <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100 flex items-center justify-between mb-4">
                                            <div>
                                                <Label className="uppercase text-[10px] text-emerald-600 font-bold">Precio Base Venta</Label>
                                                <p className="text-[10px] text-emerald-500">Incluye IVA si aplica</p>
                                            </div>
                                            <div className="relative w-1/2">
                                                <span className="absolute left-3 top-2 text-emerald-600 font-bold">{anchorCurrency.symbol}</span>
                                                <Input
                                                    type="number"
                                                    name="price"
                                                    value={formData.price}
                                                    onChange={handleInputChange}
                                                    className="pl-8 bg-white border-emerald-200 focus:border-emerald-500 text-xl font-black text-emerald-700 h-12"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="uppercase text-[10px] text-slate-500">IVA %</Label>
                                                <Input
                                                    type="number"
                                                    name="tax_rate"
                                                    value={formData.tax_rate}
                                                    onChange={handleInputChange}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="uppercase text-[10px] text-slate-500">Tasa Cambio (Opcional)</Label>
                                                <select
                                                    name="exchange_rate_id"
                                                    value={formData.exchange_rate_id || ''}
                                                    onChange={handleInputChange}
                                                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                                                >
                                                    <option value="">Usar Global</option>
                                                    {exchangeRates.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Additional Price Lists */}
                                    {modules?.retail && priceLists.length > 0 && (
                                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                                            <h4 className="text-sm font-bold text-slate-600 mb-4 flex items-center">
                                                <Tag className="mr-2 text-blue-500" size={16} /> Precios Especiales
                                            </h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {priceLists.filter(list => list.name !== 'Precio Base (Detal)').map(list => (
                                                    <div key={list.id} className="relative bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <label className="text-xs font-black text-slate-700 uppercase flex items-center gap-2">
                                                                <span>{list.name}</span>
                                                                <button
                                                                    onClick={() => handleToggleListAuth(list)}
                                                                    className="hover:scale-110 transition-transform focus:outline-none"
                                                                    title={list.requires_auth ? "Requiere Autorización" : "Sin protección"}
                                                                >
                                                                    <ShieldCheck
                                                                        size={14}
                                                                        className={list.requires_auth ? "text-rose-500" : "text-slate-300 hover:text-rose-400"}
                                                                    />
                                                                </button>
                                                            </label>
                                                            <button
                                                                onClick={() => handleDeleteList(list.id)}
                                                                className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">{anchorCurrency.symbol}</span>
                                                            <Input
                                                                type="number"
                                                                value={formData.prices[list.id] || ''}
                                                                onChange={(e) => setFormData(prev => ({ ...prev, prices: { ...prev.prices, [list.id]: e.target.value } }))}
                                                                className="pl-8 bg-slate-50 focus:bg-white font-bold text-slate-800"
                                                                placeholder="0.00"
                                                            />
                                                        </div>
                                                    </div>
                                                ))}

                                                <button
                                                    onClick={async () => {
                                                        const name = prompt("Nombre de la nueva lista de precios (ej: Empleados):");
                                                        if (name) {
                                                            const requiresAuth = confirm(`¿La lista "${name}" requiere autorización de supervisor para aplicarse?`);
                                                            try {
                                                                await apiClient.post('/price-lists/', { name, requires_auth: requiresAuth });
                                                                const { data } = await apiClient.get('/price-lists/');
                                                                setPriceLists(data);
                                                            } catch (e) {
                                                                alert("Error al crear lista: " + (e.response?.data?.detail || e.message));
                                                            }
                                                        }
                                                    }}
                                                    className="flex flex-col items-center justify-center p-3 rounded-lg border-2 border-dashed border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer min-h-[106px]"
                                                >
                                                    <Plus size={24} className="mb-1 opacity-50" />
                                                    <span className="text-xs font-bold">Nueva Lista</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* SECTION 3: INVENTORY LOGISTICS (Right Column - 5/12) */}
                                <div className="md:col-span-12 lg:col-span-5 space-y-6">
                                    {/* Stock Control */}
                                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
                                        <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
                                            <Package className="mr-2 text-purple-500" size={16} /> Control de Stock
                                        </h4>

                                        <div className="space-y-4 mb-6">
                                            <div className="space-y-2">
                                                <Label className="uppercase text-[10px] text-slate-500">Tipo de Unidad</Label>
                                                <select
                                                    name="unit_type"
                                                    value={formData.unit_type}
                                                    onChange={handleInputChange}
                                                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                                                >
                                                    <option value="UNID">Unidad (Físico)</option>
                                                    <option value="KILO">Kilo (Peso)</option>
                                                    <option value="METRO">Metro (Longitud)</option>
                                                    <option value="LITRO">Litro (Volumen)</option>
                                                    {modules?.laundry && (
                                                        <>
                                                            <option value="SERVICE_UNIT">Servicio (Por Pieza)</option>
                                                            <option value="SERVICE_KG">Servicio (Por Peso)</option>
                                                        </>
                                                    )}
                                                </select>
                                            </div>

                                            {/* Serial/IMEI Toggle */}
                                            {modules?.services && (
                                                <div className="flex items-center space-x-2 border p-3 rounded-lg bg-slate-50">
                                                    <input
                                                        type="checkbox"
                                                        id="has_imei"
                                                        checked={!!formData.has_imei}
                                                        onChange={(e) => setFormData({ ...formData, has_imei: e.target.checked })}
                                                        disabled={formData.unit_type === 'SERVICE'}
                                                        className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                                                    />
                                                    <Label htmlFor="has_imei" className="text-sm font-medium">¿Maneja Seriales / IMEI?</Label>
                                                </div>
                                            )}
                                        </div>

                                        {/* Warehouse Stock List */}
                                        {!['SERVICE', 'SERVICE_UNIT', 'SERVICE_KG'].includes(formData.unit_type) ? (
                                            <div className="flex-1">
                                                <Label className="uppercase text-[10px] text-slate-500 mb-2 block">Stock por Almacén</Label>
                                                <div className="border border-slate-100 rounded-lg overflow-hidden">
                                                    {warehouses.map(wh => {
                                                        const stockEntry = formData.warehouse_stocks.find(s => s.warehouse_id === wh.id);
                                                        const qty = stockEntry ? stockEntry.quantity : 0;
                                                        return (
                                                            <div key={wh.id} className="flex items-center justify-between p-2.5 border-b border-slate-50 hover:bg-slate-50 transition-colors bg-white">
                                                                <div>
                                                                    <div className="text-xs font-bold text-slate-700">{wh.name}</div>
                                                                    <div className="text-[9px] text-slate-400">{wh.is_main ? 'Principal' : 'Sucursal'}</div>
                                                                </div>
                                                                <Input
                                                                    type="number"
                                                                    className="w-24 text-right h-8 text-xs font-bold"
                                                                    value={qty}
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
                                                        );
                                                    })}
                                                </div>

                                                <div className="mt-4 pt-4 border-t border-slate-100">
                                                    <div className="flex justify-between items-center bg-slate-100 p-3 rounded-lg">
                                                        <span className="text-xs font-bold text-slate-500">TOTAL STOCK</span>
                                                        <span className="text-lg font-black text-slate-800">{formData.stock}</span>
                                                    </div>
                                                </div>

                                                <div className="mt-4 space-y-2">
                                                    <Label className="uppercase text-[10px] text-slate-500">Alerta Stock Min.</Label>
                                                    <div className="relative">
                                                        <AlertTriangle className="absolute left-3 top-2.5 text-amber-500" size={14} />
                                                        <Input
                                                            type="number"
                                                            name="min_stock"
                                                            value={formData.min_stock}
                                                            onChange={handleInputChange}
                                                            className="pl-8"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-center py-10">
                                                <Package className="mx-auto text-blue-400 mb-2" size={32} />
                                                <p className="text-sm font-bold text-blue-800">Producto de Servicio</p>
                                                <p className="text-xs text-blue-600 mt-1">No requiere control de inventario físico.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* SECTION 4: FOOTER EXTRAS (Full Width) */}
                                <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Warranty */}
                                    {modules?.services && (
                                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
                                            <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center">
                                                <ShieldCheck className="mr-2 text-slate-400" size={16} /> Garantía
                                            </h4>
                                            <div className="flex gap-3">
                                                <div className="w-1/3">
                                                    <Input
                                                        type="number"
                                                        name="warranty_duration"
                                                        value={formData.warranty_duration}
                                                        onChange={handleInputChange}
                                                        placeholder="Duración"
                                                    />
                                                </div>
                                                <div className="w-1/3">
                                                    <select
                                                        name="warranty_unit"
                                                        value={formData.warranty_unit}
                                                        onChange={handleInputChange}
                                                        className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                                                    >
                                                        <option value="DAYS">Días</option>
                                                        <option value="MONTHS">Meses</option>
                                                        <option value="YEARS">Años</option>
                                                    </select>
                                                </div>
                                                <div className="w-full">
                                                    <Input
                                                        type="text"
                                                        name="warranty_notes"
                                                        value={formData.warranty_notes}
                                                        onChange={handleInputChange}
                                                        placeholder="Notas (ej: Defectos fábrica)"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Images */}
                                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
                                        <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center">
                                            <ImageIcon className="mr-2 text-slate-400" size={16} /> Imagen
                                        </h4>
                                        {initialData?.id ? (
                                            <ProductImageUploader
                                                productId={initialData.id}
                                                currentImageUrl={formData.image_url}
                                                onImageUpdate={(newUrl) => setFormData({ ...formData, image_url: newUrl })}
                                            />
                                        ) : (
                                            <div className="text-xs text-slate-400 italic p-4 border border-dashed border-slate-200 rounded-lg text-center bg-slate-50">
                                                Guarda el producto primero para subir imágenes.
                                            </div>
                                        )}
                                    </div>
                                </div>

                            </div>
                        </TabsContent>

                        <TabsContent value="units" className="mt-0 h-full">
                            <ProductUnitManager
                                units={formData.units}
                                onUnitsChange={(newUnits) => setFormData(prev => ({ ...prev, units: newUnits }))}
                                baseUnitType={formData.unit_type}
                                basePrice={formData.price}
                                baseCost={formData.cost}
                                exchangeRates={exchangeRates}
                                productExchangeRateId={formData.exchange_rate_id}
                            />
                        </TabsContent>

                        <TabsContent value="combos" className="mt-0 h-full">
                            <ComboManager
                                comboItems={formData.combo_items}
                                onItemsChange={(newItems) => setFormData(prev => ({ ...prev, combo_items: newItems }))}
                            />
                        </TabsContent>
                    </div>
                </Tabs>

                <SheetFooter className="p-4 border-t border-slate-100 bg-white">
                    <Button variant="outline" onClick={onClose} className="mr-2">Cancelar</Button>
                    <Button onClick={handleSubmit}>
                        <Check className="mr-2" size={18} /> Guardar Producto
                    </Button>
                </SheetFooter>

            </SheetContent>
        </Sheet>
    );
};

export default ProductForm;
