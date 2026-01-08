import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Package, DollarSign, Barcode, Tag, Layers, AlertTriangle, AlertCircle, Coins, Receipt, ArrowRight, Calculator, SlidersHorizontal, Check } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';
import apiClient from '../../config/axios';
import ProductUnitManager from './ProductUnitManager';
import ComboManager from './ComboManager';
import ProductImageUploader from './ProductImageUploader';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

const ProductForm = ({ isOpen, onClose, onSubmit, initialData = null }) => {
    const { getActiveCurrencies, convertPrice, currencies } = useConfig();
    const anchorCurrency = currencies.find(c => c.is_anchor) || { symbol: '$' };

    const [activeTab, setActiveTab] = useState('general');
    const [categories, setCategories] = useState([]);
    const [exchangeRates, setExchangeRates] = useState([]);
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
        has_imei: false, // NEW: Serialized
        profit_margin: null,
        discount_percentage: 0,
        is_discount_active: false,
        tax_rate: 0,
        units: [],
        combo_items: [],
        warehouse_stocks: []
    });

    // Calculated values for display
    const [calculatedPrice, setCalculatedPrice] = useState(null);
    const [calculatedMargin, setCalculatedMargin] = useState(null);
    const [finalPriceWithDiscount, setFinalPriceWithDiscount] = useState(null);

    // Reset or Populate
    useEffect(() => {
        if (isOpen) {
            fetchCategories();
            fetchExchangeRates();
            fetchDefaultTaxRate();
            fetchWarehouses();

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
                    has_imei: initialData.has_imei || false, // NEW
                    profit_margin: initialData.profit_margin || null,
                    discount_percentage: initialData.discount_percentage || 0,
                    is_discount_active: initialData.is_discount_active || false,
                    tax_rate: initialData.tax_rate !== undefined ? initialData.tax_rate : 0,
                    units: mappedUnits,
                    combo_items: initialData.combo_items || [],
                    warehouse_stocks: initialData.stocks || []
                });
            } else {
                setFormData({
                    name: '', sku: '', category_id: null,
                    cost: 0, price: 0, stock: 0, min_stock: 5, location: '',
                    margin: 0, unit_type: 'UNID', exchange_rate_id: null,
                    is_combo: false, units: [], combo_items: [],
                    tax_rate: 0,
                    warehouse_stocks: []
                });
            }
            setActiveTab('general');
        }
    }, [isOpen, initialData]);

    // PRICING CALCULATIONS
    useEffect(() => {
        if (formData.cost) {
            const cost = parseFloat(formData.cost);
            const margin = parseFloat(formData.profit_margin) || 0;
            const tax = parseFloat(formData.tax_rate) || 0;

            if (cost > 0) {
                const priceBeforeTax = cost * (1 + margin / 100);
                const finalPrice = priceBeforeTax * (1 + tax / 100);
                // Use 4 decimals for precision, especially for low cost items (grams)
                setCalculatedPrice(finalPrice.toFixed(4));
                setFormData(prev => ({ ...prev, price: finalPrice.toFixed(4) }));
            }
        } else {
            setCalculatedPrice(null);
        }
    }, [formData.cost, formData.profit_margin, formData.tax_rate]);

    useEffect(() => {
        if (formData.cost && formData.price && !formData.profit_margin) {
            const cost = parseFloat(formData.cost);
            const price = parseFloat(formData.price);
            if (cost > 0) {
                const margin = ((price - cost) / cost) * 100;
                setCalculatedMargin(margin.toFixed(2)); // Margin % is fine with 2 decimals
            } else {
                setCalculatedMargin(null);
            }
        } else {
            setCalculatedMargin(null);
        }
    }, [formData.cost, formData.price, formData.profit_margin]);

    useEffect(() => {
        if (formData.price && formData.is_discount_active && formData.discount_percentage) {
            const price = parseFloat(formData.price);
            const discount = parseFloat(formData.discount_percentage);
            if (price > 0 && discount > 0) {
                const final = price * (1 - discount / 100);
                setFinalPriceWithDiscount(final.toFixed(2));
            } else {
                setFinalPriceWithDiscount(null);
            }
        } else {
            setFinalPriceWithDiscount(null);
        }
    }, [formData.price, formData.discount_percentage, formData.is_discount_active]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        let newValue = value;

        if (['cost', 'price', 'stock', 'min_stock'].includes(name)) {
            newValue = value === '' ? '' : parseFloat(value) || 0;
        }

        setFormData(prev => {
            const updated = { ...prev, [name]: newValue };
            if (name === 'cost' || name === 'price') {
                const cost = typeof updated.cost === 'number' ? updated.cost : parseFloat(updated.cost) || 0;
                const price = typeof updated.price === 'number' ? updated.price : parseFloat(updated.price) || 0;
                if (price > 0) {
                    updated.margin = ((price - cost) / price) * 100;
                } else {
                    updated.margin = 0;
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
        if (isNaN(parseFloat(formData.stock))) {
            alert('El stock debe ser un número válido');
            return;
        }

        const payload = {
            name: formData.name,
            sku: formData.sku,
            category_id: parseInt(formData.category_id) || null,
            cost_price: parseFloat(formData.cost) || 0,
            price: parseFloat(formData.price),
            stock: parseFloat(formData.stock) || 0,
            min_stock: parseFloat(formData.min_stock) || 0,
            unit_type: formData.unit_type,
            location: formData.location,
            exchange_rate_id: formData.exchange_rate_id ? parseInt(formData.exchange_rate_id) : null,
            is_combo: formData.is_combo,
            has_imei: formData.has_imei, // NEW
            profit_margin: formData.profit_margin ? parseFloat(formData.profit_margin) : null,
            discount_percentage: parseFloat(formData.discount_percentage) || 0,
            is_discount_active: formData.is_discount_active,
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
            warehouse_stocks: formData.warehouse_stocks
        };
        onSubmit(payload);
    };

    if (!isOpen) return null;

    const TabButton = ({ id, label, icon: Icon }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={clsx(
                "flex items-center px-6 py-4 font-bold text-sm transition-all border-b-2",
                activeTab === id
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            )}
        >
            <Icon size={18} className={clsx("mr-2", activeTab === id ? "text-indigo-600" : "text-slate-400")} />
            {label}
        </button>
    );

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            {initialData ? <Package className="text-indigo-600" /> : <Plus className="text-indigo-600" />}
                            {initialData ? 'Editar Producto' : 'Nuevo Producto'}
                        </h3>
                        <p className="text-slate-500 text-sm mt-1 font-medium">
                            Complete la información del inventario
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600">
                        <X size={24} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 bg-white sticky top-0 z-10 overflow-x-auto scrollbar-hide">
                    <TabButton id="general" label="General" icon={Barcode} />
                    <TabButton id="pricing" label="Precios y Stock" icon={DollarSign} />
                    <TabButton id="units" label="Presentaciones" icon={Layers} />
                    <TabButton id="combos" label="Combos" icon={Package} />
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto flex-1 bg-slate-50/50">
                    {activeTab === 'general' && (
                        <div className="space-y-6 max-w-3xl mx-auto">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nombre del Producto <span className="text-rose-500">*</span></label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        className="w-full border-slate-200 rounded-xl shadow-sm focus:border-indigo-500 focus:ring-indigo-500/20 py-3 px-4 text-lg font-semibold text-slate-800 placeholder-slate-300 transition-all"
                                        placeholder="Ej: Cemento Gris Portland Tipo I"
                                        autoFocus
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">SKU / Código <span className="text-slate-300 font-normal normal-case">(Opcional)</span></label>
                                    <div className="relative">
                                        <Barcode className="absolute left-3 top-3 text-slate-400" size={18} />
                                        <input
                                            type="text"
                                            name="sku"
                                            value={formData.sku}
                                            onChange={handleInputChange}
                                            className="w-full pl-10 border-slate-200 rounded-xl shadow-sm focus:border-indigo-500 focus:ring-indigo-500/20 py-2.5 font-medium text-slate-700 transition-all"
                                            placeholder="SCAN-001"
                                        />
                                    </div>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Categoría</label>
                                    <div className="relative">
                                        <Tag className="absolute left-3 top-3 text-slate-400" size={18} />
                                        <select
                                            name="category_id"
                                            value={formData.category_id || ''}
                                            onChange={handleInputChange}
                                            className="w-full pl-10 border-slate-200 rounded-xl shadow-sm focus:border-indigo-500 focus:ring-indigo-500/20 py-2.5 font-medium text-slate-700 appearance-none bg-white transition-all"
                                        >
                                            <option value="">-- Sin categoría --</option>
                                            {categories.filter(cat => !cat.parent_id).map(parent => (
                                                <optgroup key={parent.id} label={parent.name}>
                                                    <option value={parent.id}>{parent.name}</option>
                                                    {categories.filter(child => child.parent_id === parent.id).map(child => (
                                                        <option key={child.id} value={child.id}>
                                                            └─ {child.name}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                            {categories.filter(cat => !cat.parent_id && !categories.some(c => c.parent_id === cat.id)).length === 0 && categories.filter(cat => !cat.parent_id).map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Ubicación en Almacén</label>
                                    <input
                                        type="text"
                                        name="location"
                                        value={formData.location}
                                        onChange={handleInputChange}
                                        className="w-full border-slate-200 rounded-xl shadow-sm focus:border-indigo-500 focus:ring-indigo-500/20 py-2.5 font-medium text-slate-700 transition-all"
                                        placeholder="Ej: Pasillo 4, Estante B"
                                    />
                                </div>

                                {/* Product Image Upload */}
                                {initialData && initialData.id && (
                                    <div className="col-span-2 mt-2">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Imagen del Producto</label>
                                        <ProductImageUploader
                                            productId={initialData.id}
                                            currentImageUrl={formData.image_url}
                                            onImageUpdate={(newUrl) => setFormData({
                                                ...formData,
                                                image_url: newUrl,
                                                updated_at: new Date().toISOString()
                                            })}
                                        />
                                    </div>
                                )}

                                {/* Combo Checkbox */}
                                <div className="col-span-2 mt-2">
                                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4">
                                        <label className="flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.is_combo}
                                                onChange={(e) => setFormData({ ...formData, is_combo: e.target.checked })}
                                                className="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                            />
                                            <span className="ml-3 text-sm font-bold text-slate-800">
                                                🎁 Este producto es un Combo/Bundle
                                            </span>
                                        </label>
                                        <p className="text-xs text-slate-500 mt-2 ml-8 font-medium">
                                            Los combos son productos virtuales compuestos por otros productos.
                                            El stock se descuenta de los componentes.
                                        </p>
                                    </div>
                                </div>

                                {/* Serialized Checkbox */}
                                <div className="col-span-2 mt-2">
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                        <label className="flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.has_imei}
                                                onChange={(e) => setFormData({ ...formData, has_imei: e.target.checked })}
                                                className="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                            />
                                            <span className="ml-3 text-sm font-bold text-slate-800">
                                                🔢 Requiere Seriales (IMEI)
                                            </span>
                                        </label>
                                        <p className="text-xs text-slate-500 mt-2 ml-8 font-medium">
                                            Habilita el control de inventario serializado. Se exigirá escanear el IMEI en recepción y venta.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'pricing' && (
                        <div className="space-y-6 max-w-4xl mx-auto">

                            {/* SECTION 1: PRICING ENGINE */}
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                                <h4 className="text-sm font-bold text-slate-800 mb-6 flex items-center border-b border-slate-100 pb-4 uppercase tracking-wide">
                                    <Calculator className="mr-2 text-emerald-500" size={18} /> Estructura de Precios
                                </h4>

                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                                    {/* Cost */}
                                    <div className="md:col-span-3">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Costo Neto</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">{anchorCurrency.symbol}</span>
                                            <input
                                                type="number"
                                                name="cost"
                                                value={formData.cost}
                                                onChange={handleInputChange}
                                                step="0.0001"
                                                className="w-full pl-8 border-slate-200 rounded-xl shadow-sm focus:border-emerald-500 focus:ring-emerald-500/20 py-2.5 font-bold text-slate-700 transition-all text-sm"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>

                                    {/* Visual Flow + */}
                                    <div className="hidden md:flex md:col-span-1 justify-center text-slate-300">
                                        <Plus size={18} />
                                    </div>

                                    {/* Margin & Tax */}
                                    <div className="md:col-span-3 space-y-3">
                                        <div className="relative">
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Margen %</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={formData.profit_margin || ''}
                                                    onChange={(e) => setFormData({ ...formData, profit_margin: e.target.value })}
                                                    className="w-full pr-8 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-indigo-500/20 py-2 text-sm font-medium transition-all"
                                                    placeholder="0"
                                                />
                                                <span className="absolute right-3 top-2 text-slate-400 text-xs font-bold">%</span>
                                            </div>
                                        </div>
                                        <div className="relative">
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">IVA %</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    name="tax_rate"
                                                    value={formData.tax_rate}
                                                    onChange={handleInputChange}
                                                    className="w-full pr-8 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-indigo-500/20 py-2 text-sm font-medium transition-all"
                                                    placeholder="0"
                                                />
                                                <span className="absolute right-3 top-2 text-slate-400 text-xs font-bold">%</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Profit Amount Display (New) */}
                                    <div className="md:col-span-12 flex justify-center -mt-2 mb-2">
                                        {formData.cost > 0 && formData.profit_margin > 0 && (
                                            <div className="bg-slate-100 text-slate-500 text-xs px-3 py-1 rounded-full font-mono">
                                                Ganancia: <span className="font-bold text-emerald-600">
                                                    ${(parseFloat(formData.cost) * (parseFloat(formData.profit_margin) / 100)).toFixed(4)}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Visual Flow = */}
                                    <div className="hidden md:flex md:col-span-1 justify-center text-slate-300">
                                        <ArrowRight size={18} />
                                    </div>

                                    {/* Final Price */}
                                    <div className="md:col-span-4 bg-emerald-50/50 rounded-xl border border-emerald-100 p-4">
                                        <label className="block text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">Precio Venta Final</label>
                                        <div className="relative">
                                            <span className="absolute left-0 top-3 text-emerald-600 font-bold text-xl">{anchorCurrency.symbol}</span>
                                            <input
                                                type="number"
                                                name="price"
                                                value={formData.price}
                                                onChange={handleInputChange}
                                                step="0.0001"
                                                className="w-full pl-6 text-3xl font-black text-emerald-700 bg-transparent border-none focus:ring-0 p-0 placeholder-emerald-300/50"
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <p className="text-[10px] text-emerald-600/80 mt-1 font-bold">Autocalculado tras impuestos o manual</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* SECTION 2: INVENTORY */}
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-full flex flex-col">
                                    <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center uppercase tracking-wide">
                                        <Package className="mr-2 text-indigo-600" size={18} /> Inventario por Almacén
                                    </h4>
                                    <div className="space-y-4 flex-1">
                                        {/* Total Stock */}
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Stock Total (Suma Automática)</label>
                                            <input
                                                type="number"
                                                name="stock"
                                                value={formData.stock}
                                                readOnly
                                                className="w-full border-slate-100 rounded-xl shadow-inner bg-slate-50 text-slate-500 py-3 px-4 text-lg font-bold cursor-not-allowed"
                                                placeholder="0"
                                            />
                                        </div>

                                        {/* Warehouses Table */}
                                        <div className="border border-slate-100 rounded-xl overflow-hidden">
                                            <table className="min-w-full divide-y divide-slate-100">
                                                <thead className="bg-slate-50/50">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Almacén</th>
                                                        <th className="px-3 py-2 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cant.</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-slate-100">
                                                    {warehouses.map(wh => {
                                                        const stockEntry = formData.warehouse_stocks.find(s => s.warehouse_id === wh.id);
                                                        const qty = stockEntry ? stockEntry.quantity : 0;
                                                        return (
                                                            <tr key={wh.id} className="hover:bg-slate-50/30 transition-colors">
                                                                <td className="px-3 py-2.5 text-sm text-slate-800">
                                                                    <div className="font-bold text-xs">{wh.name}</div>
                                                                    <div className="text-[10px] text-slate-400 font-medium">{wh.is_main ? 'Principal' : 'Sucursal'}</div>
                                                                </td>
                                                                <td className="px-3 py-2.5 text-right">
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        className="w-20 text-right border-slate-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-xs font-bold py-1 px-2"
                                                                        value={qty}
                                                                        onChange={(e) => {
                                                                            const val = parseFloat(e.target.value) || 0;
                                                                            const newStocks = [...formData.warehouse_stocks];
                                                                            const idx = newStocks.findIndex(s => s.warehouse_id === wh.id);
                                                                            if (idx >= 0) {
                                                                                newStocks[idx].quantity = val;
                                                                            } else {
                                                                                newStocks.push({ warehouse_id: wh.id, quantity: val });
                                                                            }
                                                                            setFormData(prev => {
                                                                                const total = newStocks.reduce((sum, s) => sum + s.quantity, 0);
                                                                                return {
                                                                                    ...prev,
                                                                                    warehouse_stocks: newStocks,
                                                                                    stock: total
                                                                                };
                                                                            });
                                                                        }}
                                                                    />
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {warehouses.length === 0 && (
                                                        <tr>
                                                            <td colSpan="2" className="px-3 py-4 text-center text-xs text-slate-400 italic">
                                                                No hay almacenes.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Stock Mínimo (Alerta)</label>
                                            <div className="relative">
                                                <AlertTriangle size={14} className="absolute left-3 top-3 text-amber-400" />
                                                <input
                                                    type="number"
                                                    name="min_stock"
                                                    value={formData.min_stock}
                                                    onChange={handleInputChange}
                                                    className="w-full pl-9 border-slate-200 rounded-xl shadow-sm focus:border-amber-500 focus:ring-amber-500/20 py-2.5 text-sm font-medium"
                                                    placeholder="5.0"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* SECTION 3: ADVANCED OPTIONS */}
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-full">
                                    <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center uppercase tracking-wide">
                                        <SlidersHorizontal className="mr-2 text-purple-600" size={18} /> Opciones Avanzadas
                                    </h4>

                                    {/* Discount Toggle */}
                                    <div className="mb-6 p-4 bg-rose-50/50 rounded-xl border border-rose-100">
                                        <label className="flex items-center cursor-pointer mb-3">
                                            <input
                                                type="checkbox"
                                                checked={formData.is_discount_active}
                                                onChange={(e) => setFormData({ ...formData, is_discount_active: e.target.checked })}
                                                className="w-4 h-4 text-rose-600 border-slate-300 rounded focus:ring-rose-500"
                                            />
                                            <span className="ml-2 text-sm font-bold text-rose-700">Activar Descuento Promocional</span>
                                        </label>

                                        {formData.is_discount_active && (
                                            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        value={formData.discount_percentage}
                                                        onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })}
                                                        className="w-24 border-rose-200 rounded-lg py-2 pl-3 pr-8 text-sm font-bold focus:border-rose-500 focus:ring-rose-500"
                                                        placeholder="0"
                                                    />
                                                    <span className="absolute right-3 top-2 text-rose-400 text-xs font-bold">%</span>
                                                </div>
                                                <div className="text-xs text-rose-600 font-medium bg-rose-100 px-2 py-1 rounded-md">
                                                    Nuevo Precio: <span className="font-bold">{anchorCurrency.symbol}{finalPriceWithDiscount}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Exchange Rate */}
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Tasa de Cambio Específica</label>
                                        <select
                                            name="exchange_rate_id"
                                            value={formData.exchange_rate_id || ''}
                                            onChange={handleInputChange}
                                            className="w-full border-slate-200 rounded-xl shadow-sm focus:border-purple-500 focus:ring-purple-500/20 py-2.5 text-sm font-medium bg-white"
                                        >
                                            <option value="">Automática (Global)</option>
                                            {exchangeRates.map(rate => (
                                                <option key={rate.id} value={rate.id}>
                                                    {rate.name} - {rate.currency_code} ({Number(rate.rate).toFixed(2)})
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-[10px] text-slate-400 mt-1.5">Solo cambiar si este producto mana una tasa diferente a la global.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'units' && (
                        <ProductUnitManager
                            units={formData.units}
                            onUnitsChange={(newUnits) => setFormData(prev => ({ ...prev, units: newUnits }))}
                            baseUnitType={formData.unit_type}
                            basePrice={formData.price}
                            baseCost={formData.cost}
                            exchangeRates={exchangeRates}
                            productExchangeRateId={formData.exchange_rate_id}
                        />
                    )}

                    {activeTab === 'combos' && (
                        <div className="space-y-6 max-w-4xl mx-auto">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-indigo-50 to-white rounded-xl p-6 border border-indigo-100">
                                <h4 className="text-lg font-bold text-indigo-900 mb-1 flex items-center">
                                    <Package className="mr-2" size={20} />
                                    Gestión de Combos
                                </h4>
                                <p className="text-sm text-indigo-700 font-medium">
                                    Define los productos componentes y sus cantidades.
                                </p>
                            </div>

                            {/* Combo Toggle */}
                            {!formData.is_combo && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
                                    <AlertCircle className="mx-auto mb-3 text-amber-500" size={40} />
                                    <h5 className="text-amber-900 font-bold mb-1">Producto Estándar</h5>
                                    <p className="text-amber-700/80 mb-6 text-sm font-medium">
                                        Actualmente este es un producto simple con su propio stock.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, is_combo: true })}
                                        className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5 transition-all text-sm"
                                    >
                                        Convertir en Combo
                                    </button>
                                </div>
                            )}

                            {/* Combo Manager */}
                            {formData.is_combo && (
                                <ComboManager
                                    productId={initialData?.id}
                                    initialComboItems={formData.combo_items || []}
                                    onChange={(items) => setFormData({ ...formData, combo_items: items })}
                                />
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-white flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 text-slate-600 hover:bg-slate-50 font-bold rounded-xl transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                    >
                        <Check size={18} />
                        Guardar Producto
                    </button>
                </div>
            </div>
        </div >
    );
};

export default ProductForm;
