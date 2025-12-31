import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Package, DollarSign, Barcode, Tag, Layers, AlertTriangle, AlertCircle, Coins, Receipt, ArrowRight, Calculator, SlidersHorizontal } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';
import apiClient from '../../config/axios';
import ProductUnitManager from './ProductUnitManager';
import ComboManager from './ComboManager';
import ProductImageUploader from './ProductImageUploader';

const ProductForm = ({ isOpen, onClose, onSubmit, initialData = null }) => {
    const { getActiveCurrencies, convertPrice, currencies } = useConfig();
    const anchorCurrency = currencies.find(c => c.is_anchor) || { symbol: '$' };

    const [activeTab, setActiveTab] = useState('general');
    const [categories, setCategories] = useState([]);
    const [exchangeRates, setExchangeRates] = useState([]);
    const [warehouses, setWarehouses] = useState([]); // NEW: Warehouses state
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
        // Pricing System Fields
        profit_margin: null,

        discount_percentage: 0,
        is_discount_active: false,
        tax_rate: 0, // NEW: Tax Rate
        units: [],
        combo_items: [],
        warehouse_stocks: [] // NEW: Stocks per warehouse
    });

    // Calculated values for display
    const [calculatedPrice, setCalculatedPrice] = useState(null);
    const [calculatedMargin, setCalculatedMargin] = useState(null);
    const [finalPriceWithDiscount, setFinalPriceWithDiscount] = useState(null);

    // Reset or Populate on simple change
    useEffect(() => {
        if (isOpen) {
            // Fetch categories
            fetchCategories();
            // Fetch exchange rates
            // Fetch exchange rates
            fetchExchangeRates();
            // Fetch default tax rate
            fetchDefaultTaxRate();
            // Fetch warehouses for stock management
            fetchWarehouses();

            if (initialData) {
                // Map backend units to frontend format
                const mappedUnits = (initialData.units || []).map(u => {
                    // Determine type based on conversion_factor
                    const isPacking = u.conversion_factor >= 1;
                    const type = isPacking ? 'packing' : 'fraction';

                    // Calculate user_input from conversion_factor
                    // For packing: factor is the number (e.g., 12 units)
                    // For fraction: factor is 1/n, so user_input is 1/factor (e.g., 1/0.001 = 1000)
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
                        // Fix: Map Discount Fields
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
                    is_combo: initialData.is_combo || false,  // NEW
                    // Pricing System Fields - Fix Uncontrolled Input
                    profit_margin: initialData.profit_margin || null,

                    discount_percentage: initialData.discount_percentage || 0,
                    is_discount_active: initialData.is_discount_active || false,
                    tax_rate: initialData.tax_rate !== undefined ? initialData.tax_rate : 0, // Load tax rate
                    units: mappedUnits,
                    combo_items: initialData.combo_items || [], // NEW
                    warehouse_stocks: initialData.stocks || [] // NEW: Load existing stocks
                });
            } else {
                // Reset for new product
                setFormData({
                    name: '', sku: '', category_id: null,
                    cost: 0, price: 0, stock: 0, min_stock: 5, location: '',
                    margin: 0, unit_type: 'UNID', exchange_rate_id: null,
                    is_combo: false, units: [], combo_items: [],
                    tax_rate: 0, // Reset tax
                    warehouse_stocks: [] // NEW: Empty stocks
                });
            }
            setActiveTab('general');
        }
    }, [isOpen, initialData]);

    // ========================================
    // PRICING CALCULATIONS
    // ========================================

    // Auto-calculate price from cost + profit margin + tax
    // Auto-calculate price from cost + profit margin + tax
    useEffect(() => {
        // Calculate if we have at least a cost
        if (formData.cost) {
            const cost = parseFloat(formData.cost);
            const margin = parseFloat(formData.profit_margin) || 0; // Default to 0 if empty
            const tax = parseFloat(formData.tax_rate) || 0; // Default to 0 if empty

            if (cost > 0) {
                // Price = Cost * (1 + Margin) * (1 + Tax)
                const priceBeforeTax = cost * (1 + margin / 100);
                const finalPrice = priceBeforeTax * (1 + tax / 100);

                setCalculatedPrice(finalPrice.toFixed(2));
                // Auto-update price field
                setFormData(prev => ({ ...prev, price: finalPrice.toFixed(2) }));
            }
        } else {
            setCalculatedPrice(null);
        }
    }, [formData.cost, formData.profit_margin, formData.tax_rate]);

    // Reverse-calculate margin from cost + price (when margin is not set)
    useEffect(() => {
        if (formData.cost && formData.price && !formData.profit_margin) {
            const cost = parseFloat(formData.cost);
            const price = parseFloat(formData.price);
            if (cost > 0) {
                const margin = ((price - cost) / cost) * 100;
                setCalculatedMargin(margin.toFixed(2));
            } else {
                setCalculatedMargin(null);
            }
        } else {
            setCalculatedMargin(null);
        }
    }, [formData.cost, formData.price, formData.profit_margin]);

    // Calculate final price with discount
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

        // For numeric fields, allow empty string (for better UX while typing)
        // Convert to number only if value is not empty
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
        if (initialData) return; // Don't override if editing
        try {
            const response = await apiClient.get('/config/tax-rate/default');
            setFormData(prev => ({ ...prev, tax_rate: response.data.rate || 0 }));
        } catch (error) {
            console.error('Error fetching default tax rate:', error);
        }
    };

    // ... Unit Management (keep existing helper functions)
    const handleAddUnit = (type) => {
        const newUnit = {
            id: Date.now(),
            unit_name: '',
            user_input: type === 'packing' ? 12 : 1000,
            conversion_factor: 1,
            type: type,
            barcode: '',
            price_usd: 0
        };
        setFormData(prev => ({ ...prev, units: [...prev.units, newUnit] }));
    };

    const handleUnitChange = (id, field, value) => {
        setFormData(prev => ({
            ...prev,
            units: prev.units.map(u => (u.id === id ? { ...u, [field]: value } : u))
        }));
    };

    const removeUnit = (id) => {
        setFormData(prev => ({ ...prev, units: prev.units.filter(u => u.id !== id) }));
    };

    const handleSubmit = () => {
        // Validation
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
            // Pricing System Fields
            profit_margin: formData.profit_margin ? parseFloat(formData.profit_margin) : null,

            discount_percentage: parseFloat(formData.discount_percentage) || 0,
            is_discount_active: formData.is_discount_active,
            tax_rate: parseFloat(formData.tax_rate) || 0, // Send Tax Rate
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
            warehouse_stocks: formData.warehouse_stocks // NEW: Send stocks
        };
        onSubmit(payload);
    };

    if (!isOpen) return null;

    const TabButton = ({ id, label, icon: Icon }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center px-6 py-4 font-medium transition-colors border-b-2 ${activeTab === id
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
        >
            <Icon size={18} className="mr-2" />
            {label}
        </button>
    );

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b bg-gray-50">
                    <div>
                        <h3 className="text-2xl font-bold text-gray-800">
                            {initialData ? 'Editar Producto' : 'Nuevo Producto'}
                        </h3>
                        <p className="text-gray-500 text-sm mt-1">
                            Complete la información del inventario
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                        <X size={24} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b bg-white sticky top-0 z-10">
                    <TabButton id="general" label="General" icon={Barcode} />
                    <TabButton id="pricing" label="Precios & Stock" icon={DollarSign} />
                    <TabButton id="units" label="Presentaciones" icon={Layers} />
                    <TabButton id="combos" label="Combos" icon={Package} />
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto flex-1 bg-gray-50/30">
                    {activeTab === 'general' && (
                        <div className="space-y-6 max-w-3xl mx-auto anime-fade-in">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="col-span-2">
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre del Producto <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-3 px-4 text-lg"
                                        placeholder="Ej: Cemento Gris Portland Tipo I"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">SKU / Código <span className="text-gray-400 font-normal">(Opcional)</span></label>
                                    <div className="relative">
                                        <Barcode className="absolute left-3 top-3 text-gray-400" size={18} />
                                        <input
                                            type="text"
                                            name="sku"
                                            value={formData.sku}
                                            onChange={handleInputChange}
                                            className="w-full pl-10 border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5"
                                            placeholder="SCAN-001"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Categoría</label>
                                    <div className="relative">
                                        <Tag className="absolute left-3 top-3 text-gray-400" size={18} />
                                        <select
                                            name="category_id"
                                            value={formData.category_id || ''}
                                            onChange={handleInputChange}
                                            className="w-full pl-10 border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5"
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
                                            {/* Standalone categories without children */}
                                            {categories.filter(cat => !cat.parent_id && !categories.some(c => c.parent_id === cat.id)).length === 0 && categories.filter(cat => !cat.parent_id).map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Ubicación en Almacén</label>
                                    <input
                                        type="text"
                                        name="location"
                                        value={formData.location}
                                        onChange={handleInputChange}
                                        className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5"
                                        placeholder="Pasillo 4, Estante B"
                                    />
                                </div>

                                {/* Product Image Upload */}
                                {initialData && initialData.id && (
                                    <div className="col-span-2 mt-4">
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Imagen del Producto</label>
                                        <ProductImageUploader
                                            productId={initialData.id}
                                            currentImageUrl={formData.image_url}
                                            onImageUpdate={(newUrl) => setFormData({
                                                ...formData,
                                                image_url: newUrl,
                                                updated_at: new Date().toISOString() // Force cache bust
                                            })}
                                        />
                                    </div>
                                )}

                                {/* Combo Checkbox */}
                                <div className="col-span-2 mt-4">
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <label className="flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.is_combo}
                                                onChange={(e) => setFormData({ ...formData, is_combo: e.target.checked })}
                                                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                            />
                                            <span className="ml-3 text-sm font-medium text-gray-900">
                                                🎁 Este producto es un Combo/Bundle
                                            </span>
                                        </label>
                                        <p className="text-xs text-gray-600 mt-2 ml-8">
                                            Los combos son productos virtuales compuestos por otros productos.
                                            El stock se descuenta de los componentes, no del combo.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'pricing' && (
                        <div className="space-y-6 max-w-4xl mx-auto anime-fade-in p-1">

                            {/* SECTION 1: PRICING ENGINE */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                <h4 className="text-lg font-bold text-gray-800 mb-6 flex items-center border-b pb-4">
                                    <Calculator className="mr-2 text-green-600" size={20} /> Estructura de Precios
                                </h4>

                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                                    {/* Cost */}
                                    <div className="md:col-span-3">
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Costo Neto</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-3 text-gray-400 font-bold">{anchorCurrency.symbol}</span>
                                            <input
                                                type="number"
                                                name="cost"
                                                value={formData.cost}
                                                onChange={handleInputChange}
                                                className="w-full pl-8 border-gray-300 rounded-lg shadow-sm focus:border-green-500 focus:ring-green-500 py-2.5 font-bold text-gray-700"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>

                                    {/* Visual Flow + */}
                                    <div className="hidden md:flex md:col-span-1 justify-center text-gray-300">
                                        <Plus size={20} />
                                    </div>

                                    {/* Margin & Tax */}
                                    <div className="md:col-span-3 space-y-3">
                                        <div className="relative">
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Margen %</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={formData.profit_margin || ''}
                                                    onChange={(e) => setFormData({ ...formData, profit_margin: e.target.value })}
                                                    className="w-full pr-8 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-blue-500 py-2 text-sm"
                                                    placeholder="0"
                                                />
                                                <span className="absolute right-3 top-2 text-gray-400 text-xs">%</span>
                                            </div>
                                        </div>
                                        <div className="relative">
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Impuesto (IVA) %</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    name="tax_rate"
                                                    value={formData.tax_rate}
                                                    onChange={handleInputChange}
                                                    className="w-full pr-8 border-gray-200 rounded-lg focus:border-orange-500 focus:ring-orange-500 py-2 text-sm"
                                                    placeholder="0"
                                                />
                                                <span className="absolute right-3 top-2 text-gray-400 text-xs">%</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Visual Flow = */}
                                    <div className="hidden md:flex md:col-span-1 justify-center text-gray-300">
                                        <ArrowRight size={20} />
                                    </div>

                                    {/* Final Price */}
                                    <div className="md:col-span-4 bg-green-50 rounded-xl border border-green-100 p-4">
                                        <label className="block text-xs font-bold text-green-700 uppercase tracking-wider mb-1">Precio Venta Final</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-4 text-green-600 font-bold text-xl">{anchorCurrency.symbol}</span>
                                            <input
                                                type="number"
                                                name="price"
                                                value={formData.price}
                                                onChange={handleInputChange}
                                                className="w-full pl-8 text-3xl font-black text-green-700 bg-transparent border-none focus:ring-0 p-0 placeholder-green-300"
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <p className="text-xs text-green-600 mt-1 font-medium">Autocalculado según costo y tasas.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* SECTION 2: INVENTORY */}
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-full">
                                    <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                        <Package className="mr-2 text-blue-600" size={20} /> Inventario por Almacén
                                    </h4>
                                    <div className="space-y-4">
                                        {/* Total Stock (Auto-calculated) */}
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">Stock Total (Suma Automática)</label>
                                            <input
                                                type="number"
                                                name="stock"
                                                value={formData.stock}
                                                readOnly
                                                className="w-full border-gray-200 rounded-lg shadow-sm bg-gray-100 text-gray-500 py-3 text-lg font-bold cursor-not-allowed"
                                                placeholder="0"
                                            />
                                        </div>

                                        {/* Warehouses Table */}
                                        <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50 sticky top-0">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Almacén</th>
                                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {warehouses.map(wh => {
                                                        const stockEntry = formData.warehouse_stocks.find(s => s.warehouse_id === wh.id);
                                                        const qty = stockEntry ? stockEntry.quantity : 0;
                                                        return (
                                                            <tr key={wh.id}>
                                                                <td className="px-3 py-2 text-sm text-gray-900">
                                                                    <div className="font-medium">{wh.name}</div>
                                                                    <div className="text-xs text-gray-500">{wh.is_main ? 'Principal' : 'Sucursal'}</div>
                                                                </td>
                                                                <td className="px-3 py-2">
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        className="w-24 text-right border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 text-sm"
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
                                                                            // Update stocks array
                                                                            setFormData(prev => {
                                                                                const total = newStocks.reduce((sum, s) => sum + s.quantity, 0);
                                                                                return {
                                                                                    ...prev,
                                                                                    warehouse_stocks: newStocks,
                                                                                    stock: total // Auto-update total stock
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
                                                            <td colSpan="2" className="px-3 py-4 text-center text-sm text-gray-500">
                                                                No hay almacenes registrados.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">Stock Mínimo Global (Alerta)</label>
                                            <input
                                                type="number"
                                                name="min_stock"
                                                value={formData.min_stock}
                                                onChange={handleInputChange}
                                                className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5"
                                                placeholder="5.0"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* SECTION 3: ADVANCED OPTIONS */}
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-full">
                                    <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                        <SlidersHorizontal className="mr-2 text-purple-600" size={20} /> Opciones
                                    </h4>

                                    {/* Discount Toggle */}
                                    <div className="mb-6">
                                        <label className="flex items-center cursor-pointer mb-2">
                                            <input
                                                type="checkbox"
                                                checked={formData.is_discount_active}
                                                onChange={(e) => setFormData({ ...formData, is_discount_active: e.target.checked })}
                                                className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                            />
                                            <span className="ml-2 text-sm font-semibold text-gray-700">Activar Descuento</span>
                                        </label>

                                        {formData.is_discount_active && (
                                            <div className="flex items-center gap-3 animate-fade-in-down">
                                                <input
                                                    type="number"
                                                    value={formData.discount_percentage}
                                                    onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })}
                                                    className="w-24 border-red-200 rounded-lg py-2 px-3 text-sm focus:border-red-500 focus:ring-red-500"
                                                    placeholder="%"
                                                />
                                                <div className="text-sm text-gray-500">
                                                    Precio final: <span className="font-bold text-red-600">{anchorCurrency.symbol}{finalPriceWithDiscount}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Exchange Rate */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Tasa de Cambio</label>
                                        <select
                                            name="exchange_rate_id"
                                            value={formData.exchange_rate_id || ''}
                                            onChange={handleInputChange}
                                            className="w-full border-gray-200 rounded-lg shadow-sm focus:border-purple-500 focus:ring-purple-500 py-2 text-sm bg-gray-50 mb-2"
                                        >
                                            <option value="">Automática (Según configuración)</option>
                                            {exchangeRates.map(rate => (
                                                <option key={rate.id} value={rate.id}>
                                                    {rate.name} - {rate.currency_code} ({Number(rate.rate).toFixed(2)})
                                                </option>
                                            ))}
                                        </select>
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
                        <div className="space-y-6 max-w-4xl mx-auto anime-fade-in">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-200">
                                <h4 className="text-xl font-bold text-purple-900 mb-2 flex items-center">
                                    <Package className="mr-2" size={24} />
                                    Gestión de Combos/Bundles
                                </h4>
                                <p className="text-sm text-purple-700">
                                    Define los productos que componen este combo y sus cantidades.
                                </p>
                            </div>

                            {/* Combo Toggle */}
                            {!formData.is_combo && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                                    <AlertCircle className="mx-auto mb-3 text-yellow-600" size={48} />
                                    <p className="text-gray-700 mb-4">
                                        Este producto no está marcado como combo.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, is_combo: true })}
                                        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
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
                <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium">Cancelar</button>
                    <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium">Guardar Producto</button>
                </div>
            </div>
        </div>
    );
};

export default ProductForm;
