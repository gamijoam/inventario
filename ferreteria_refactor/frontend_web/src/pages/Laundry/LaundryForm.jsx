import React, { useState, useEffect } from 'react';
import {
    Users, Shirt, Save,
    Search, Plus, CheckCircle, Trash2, ShoppingBag, Package
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import { useConfig } from '../../context/ConfigContext';

const LaundryForm = () => {
    const { convertPrice, formatCurrency } = useConfig();
    const [loading, setLoading] = useState(false);
    const [ticketNumber, setTicketNumber] = useState(null);

    // Customer Search
    const [customers, setCustomers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [showResults, setShowResults] = useState(false);

    // Product Search (Services)
    const [products, setProducts] = useState([]);
    const [productSearch, setProductSearch] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [showProductResults, setShowProductResults] = useState(false);

    // Cart State
    const [cart, setCart] = useState([]);

    // Current Item Form
    const [currentItem, setCurrentItem] = useState({
        quantity: 1, // Default generic quantity
        weight_kg: '', // For KG items
        pieces: '',    // For Piece items
        observations: '',
        is_manual_price: false,
        manual_price: ''
    });

    // Metadata for the whole order
    const [orderMetadata, setOrderMetadata] = useState({
        bag_color: '',
        priority: 'NORMAL'
    });

    // Quick Customer Create
    const [showQuickCreate, setShowQuickCreate] = useState(false);
    const [quickCustomer, setQuickCustomer] = useState({ name: '', id_number: '', phone: '' });

    // Unit Mode (Added Fix)
    const [unitMode, setUnitMode] = useState('PIECES'); // 'KG' or 'PIECES'

    // --- CUSTOMER SEARCH ---
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.length > 2 && (!selectedCustomer || searchTerm !== `${selectedCustomer.name} (${selectedCustomer.id_number || 'N/A'})`)) {
                try {
                    const res = await apiClient.get(`/customers/?search=${searchTerm}`);
                    setCustomers(res.data);
                    setShowResults(true);
                } catch (error) {
                    console.error("Error searching customers:", error);
                }
            } else {
                setCustomers([]);
                setShowResults(false);
            }
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, selectedCustomer]);

    const handleCustomerSelect = (customer) => {
        setSelectedCustomer(customer);
        setSearchTerm(`${customer.name} (${customer.id_number || 'N/A'})`);
        setShowResults(false);
        setCustomers([]);
    };

    // --- PRODUCT SEARCH ---
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            // Only search if term length > 1 AND it's not the currently selected product name
            if (productSearch.length > 1 && (!selectedProduct || productSearch !== selectedProduct.name)) {
                try {
                    const res = await apiClient.get(`/products?search=${productSearch}`);
                    setProducts(res.data);
                    setShowProductResults(true);
                } catch (error) {
                    console.error("Error searching products:", error);
                }
            } else {
                setProducts([]);
                setShowProductResults(false);
            }
        }, 400);
        return () => clearTimeout(delayDebounceFn);
    }, [productSearch, selectedProduct]);

    const handleProductSelect = (product) => {
        setSelectedProduct(product);
        setProductSearch(product.name);
        setShowProductResults(false);
        setProducts([]);

        // Auto-detect unit logic BUT allow override
        const isKg = product.unit_type?.toLowerCase().includes('kilo') || product.name.toLowerCase().includes('kg');
        setUnitMode(isKg ? 'KG' : 'PIECES'); // Set mode based on product default

        setCurrentItem({
            ...currentItem,
            weight_kg: '',
            pieces: isKg ? '' : '1',
            quantity: 1,
            manual_price: product.price || 0,
            is_manual_price: false
        });
    };

    const handleQuickCreate = async () => {
        if (!quickCustomer.name) { toast.error("Nombre es requerido"); return; }
        if (!quickCustomer.phone) { toast.error("Teléfono es requerido"); return; }
        try {
            const payload = {
                ...quickCustomer,
                id_number: quickCustomer.id_number || null,
                credit_limit: 100,
                address: 'Dirección Pendiente',
                email: `temp_${Date.now()}@system.local`,
                type: 'INDIVIDUAL'
            };
            const res = await apiClient.post('/customers/', payload);
            toast.success("Cliente rápido creado");
            handleCustomerSelect(res.data);
            setShowQuickCreate(false);
            setQuickCustomer({ name: '', id_number: '', phone: '' });
        } catch (error) {
            console.error(error);
            toast.error("Error al crear cliente rápido");
        }
    };

    const handleItemChange = (e) => {
        const { name, value, type, checked } = e.target;
        setCurrentItem(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const addToCart = () => {
        if (!selectedProduct) {
            toast.error("Seleccione un servicio/producto");
            return;
        }

        const isKgMode = unitMode === 'KG';

        // Validation
        if (isKgMode && !currentItem.weight_kg) {
            toast.error("Ingrese el peso (Kg)");
            return;
        }
        if (!isKgMode && !currentItem.pieces) {
            toast.error("Ingrese la cantidad (Piezas/Unidades)");
            return;
        }

        let finalQty = isKgMode ? parseFloat(currentItem.weight_kg) : parseFloat(currentItem.pieces);
        let finalPrice = currentItem.is_manual_price
            ? parseFloat(currentItem.manual_price)
            : parseFloat(selectedProduct.price || 0);

        if (finalPrice <= 0) {
            // Warn if needed
        }

        const newItem = {
            id: Date.now(),
            product_id: selectedProduct.id,
            description: selectedProduct.name,
            observations: currentItem.observations || '', // Save observations separately
            quantity: finalQty,
            unit_price: finalPrice,

            // Helpful metadata
            weight_kg: isKgMode ? finalQty : 0,
            pieces: isKgMode ? (parseInt(currentItem.pieces) || 0) : finalQty,
            service_type: 'LAUNDRY',
            unit_mode: unitMode
        };

        setCart([...cart, newItem]);

        // Reset Item Section (Keep ID/Bag metadata)
        setSelectedProduct(null);
        setProductSearch('');
        setCurrentItem({
            quantity: 1,
            weight_kg: '',
            pieces: '',
            observations: '',
            is_manual_price: false,
            manual_price: ''
        });
        toast.success("Servicio agregado");
    };

    const removeFromCart = (id) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedCustomer) {
            toast.error('Debe seleccionar un cliente.');
            return;
        }
        if (cart.length === 0) {
            toast.error('Agregue al menos un servicio a la orden.');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                customer_id: selectedCustomer.id,
                service_type: 'LAUNDRY',
                priority: orderMetadata.priority,

                // Header Metadata
                order_metadata: {
                    bag_color: orderMetadata.bag_color || `LAV-${Date.now().toString().slice(-4)}`,
                    total_items: cart.length,
                    pieces: cart.reduce((acc, i) => acc + (i.pieces || 0), 0) // Sum pieces for tracking
                },

                // Mapped Items
                items: cart.map(item => ({
                    product_id: item.product_id, // Now linking to Product
                    description: item.description,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                })),

                problem_description: `Orden de Lavandería (${cart.length} servicios).`,
                device_type: 'ROPA'
            };

            const res = await apiClient.post('/services/orders', payload);
            setTicketNumber(res.data.ticket_number);
            toast.success(`Orden ${res.data.ticket_number} creada!`);

            // Reset All
            setCart([]);
            setSelectedCustomer(null);
            setSearchTerm('');
            resetOrderMetadata();

        } catch (error) {
            console.error("Error creating order:", error);
            const msg = error.response?.data?.detail || 'Error al crear la orden.';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const resetOrderMetadata = () => {
        setOrderMetadata({ bag_color: '', priority: 'NORMAL' });
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Nueva Orden de Lavandería</h1>
                    <p className="text-gray-500">Agrega múltiples servicios a una sola orden</p>
                </div>
                {ticketNumber && (
                    <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg font-mono font-bold flex items-center gap-2 animate-bounce">
                        <CheckCircle size={20} />
                        Ticket: {ticketNumber}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* COLUMNA 1: CLIENTE Y METADATA */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Cliente */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 justify-between">
                            <span className="flex items-center gap-2"><Users className="text-teal-600" size={20} /> Cliente</span>
                            <button
                                type="button"
                                onClick={() => setShowQuickCreate(!showQuickCreate)}
                                className="px-3 py-1.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all hover:-translate-y-0.5 active:scale-95"
                            >
                                <Plus size={16} strokeWidth={2.5} /> Nuevo Cliente
                            </button>
                        </h2>

                        {showQuickCreate ? (
                            <div className="bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 p-5 rounded-xl border-2 border-teal-200 space-y-4 shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="bg-teal-500 p-1.5 rounded-lg">
                                        <Users size={16} className="text-white" />
                                    </div>
                                    <h3 className="font-black text-teal-800 text-sm">Crear Cliente Rápido</h3>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold text-teal-700 uppercase tracking-wider mb-1.5">
                                            Nombre Completo <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            placeholder="Ej: Juan Pérez"
                                            className="w-full px-3 py-2.5 text-sm border-2 border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all bg-white font-medium text-gray-800 placeholder:text-gray-400"
                                            value={quickCustomer.name}
                                            onChange={e => setQuickCustomer({ ...quickCustomer, name: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-teal-700 uppercase tracking-wider mb-1.5">
                                            Cédula <span className="text-gray-400 text-[10px] normal-case">(Opcional)</span>
                                        </label>
                                        <input
                                            placeholder="Ej: V-12345678"
                                            className="w-full px-3 py-2.5 text-sm border-2 border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all bg-white font-medium text-gray-800 placeholder:text-gray-400"
                                            value={quickCustomer.id_number}
                                            onChange={e => setQuickCustomer({ ...quickCustomer, id_number: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-teal-700 uppercase tracking-wider mb-1.5">
                                            Teléfono <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            placeholder="Ej: 0414-1234567"
                                            className="w-full px-3 py-2.5 text-sm border-2 border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all bg-white font-medium text-gray-800 placeholder:text-gray-400"
                                            value={quickCustomer.phone}
                                            onChange={e => setQuickCustomer({ ...quickCustomer, phone: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-3 border-t border-teal-200">
                                    <button
                                        onClick={() => {
                                            setShowQuickCreate(false);
                                            setQuickCustomer({ name: '', id_number: '', phone: '' });
                                        }}
                                        className="flex-1 px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-lg font-bold text-sm border-2 border-gray-200 transition-all active:scale-95"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleQuickCreate}
                                        className="flex-1 px-4 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white rounded-lg font-black text-sm shadow-lg shadow-teal-200 transition-all hover:-translate-y-0.5 active:scale-95"
                                    >
                                        Crear Cliente
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                <input
                                    placeholder="Buscar Cliente..."
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                {showResults && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                        {customers.map(c => (
                                            <div key={c.id} onClick={() => handleCustomerSelect(c)} className="p-3 hover:bg-teal-50 cursor-pointer border-b">
                                                <div className="font-medium">{c.name}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        {selectedCustomer && !showQuickCreate && (
                            <div className="mt-4 p-3 bg-teal-50 rounded-lg text-sm text-teal-800 border border-teal-100 flex justify-between items-center">
                                <span className="font-bold">{selectedCustomer.name}</span>
                                <button onClick={() => setSelectedCustomer(null)} className="text-teal-500"><Users size={16} /></button>
                            </div>
                        )}
                    </div>

                    {/* Metadata Global */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h2 className="text-lg font-semibold mb-4 text-gray-700">Datos Generales</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                                <select
                                    className="w-full p-2 border rounded-lg bg-gray-50"
                                    value={orderMetadata.priority}
                                    onChange={e => setOrderMetadata({ ...orderMetadata, priority: e.target.value })}
                                >
                                    <option value="NORMAL">Normal</option>
                                    <option value="HIGH">Alta</option>
                                    <option value="URGENT">Urgente</option>
                                </select>
                                <p className="text-[10px] text-gray-400 mt-1">El identificador se generará automáticamente (LAV-xxxx)</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* COLUMNA 2: CONSTRUCTOR DE SERVICIOS */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Add Item Form */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Package className="text-indigo-600" size={20} />
                            Agregar Servicio (Producto)
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Product Search */}
                            <div className="md:col-span-2 relative">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Servicio / Producto</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                    <input
                                        placeholder="Ej: Lavado de Edredón, Planchado..."
                                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                                        value={productSearch}
                                        onChange={e => setProductSearch(e.target.value)}
                                    />
                                </div>
                                {showProductResults && (
                                    <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                        {products.map(p => (
                                            <div
                                                key={p.id}
                                                onClick={() => handleProductSelect(p)}
                                                className="p-3 hover:bg-indigo-50 cursor-pointer border-b flex justify-between items-center group"
                                            >
                                                <div>
                                                    <div className="font-bold text-gray-700">{p.name}</div>
                                                    <div className="text-xs text-gray-400">SKU: {p.sku || 'N/A'} • {p.unit_type}</div>
                                                </div>
                                                <div className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded group-hover:bg-white transition-colors">
                                                    ${p.price}
                                                </div>
                                            </div>
                                        ))}
                                        {products.length === 0 && (
                                            <div className="p-3 text-gray-400 text-sm italic text-center">No se encontraron servicios</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {selectedProduct && (
                                <>
                                    <div className="md:col-span-2 bg-indigo-50 p-3 rounded-lg border border-indigo-100 flex flex-col gap-3 animate-in fade-in">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <Shirt size={18} className="text-indigo-600" />
                                                <span className="font-bold text-indigo-900">{selectedProduct.name}</span>
                                            </div>
                                            <button onClick={() => setSelectedProduct(null)} className="text-xs text-indigo-500 underline hover:text-indigo-700">Cambiar</button>
                                        </div>

                                        {/* Unit Type Toggle */}
                                        <div className="flex p-1 bg-white rounded-lg border border-indigo-200">
                                            <button
                                                onClick={() => setUnitMode('PIECES')}
                                                className={`flex-1 py-1 text-xs font-bold rounded ${unitMode === 'PIECES' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                                            >
                                                Por Pieza (Unidades)
                                            </button>
                                            <button
                                                onClick={() => setUnitMode('KG')}
                                                className={`flex-1 py-1 text-xs font-bold rounded ${unitMode === 'KG' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                                            >
                                                Por Peso (Kilos)
                                            </button>
                                        </div>
                                    </div>

                                    {/* Dynamic Inputs based on UNIT MODE */}
                                    {unitMode === 'KG' ? (
                                        <div className="flex gap-4">
                                            <div className="flex-1">
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Peso (Kg) *</label>
                                                <input
                                                    type="number" step="0.01"
                                                    name="weight_kg"
                                                    value={currentItem.weight_kg}
                                                    onChange={handleItemChange}
                                                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-gray-800"
                                                    autoFocus
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <div className="w-1/3">
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Pzas (Opc.)</label>
                                                <input
                                                    type="number"
                                                    name="pieces"
                                                    value={currentItem.pieces}
                                                    onChange={handleItemChange}
                                                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-600"
                                                    placeholder="#"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad (Pzas) *</label>
                                            <input
                                                type="number"
                                                name="pieces"
                                                value={currentItem.pieces}
                                                onChange={handleItemChange}
                                                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-gray-800"
                                                placeholder="1"
                                                autoFocus
                                            />
                                        </div>
                                    )}

                                    {/* Price Override */}
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-sm font-medium text-gray-700">Precio Unit. ($)</label>
                                            <label className="flex items-center gap-1 text-[10px] text-gray-400 cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    name="is_manual_price"
                                                    checked={currentItem.is_manual_price}
                                                    onChange={handleItemChange}
                                                />
                                                Editar
                                            </label>
                                        </div>
                                        <input
                                            type="number" step="0.01"
                                            name="manual_price"
                                            value={currentItem.is_manual_price ? currentItem.manual_price : selectedProduct.price}
                                            onChange={handleItemChange}
                                            disabled={!currentItem.is_manual_price}
                                            className={`w-full p-2 border rounded-lg outline-none font-mono ${currentItem.is_manual_price ? 'bg-white border-yellow-300 focus:ring-2 focus:ring-yellow-400' : 'bg-gray-50 text-gray-500'}`}
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                                        <input
                                            name="observations"
                                            value={currentItem.observations}
                                            onChange={handleItemChange}
                                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="Detalles sobre la prenda..."
                                        />
                                    </div>

                                    <div className="md:col-span-2 flex justify-end pt-2">
                                        <button
                                            type="button"
                                            onClick={addToCart}
                                            className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                                        >
                                            <Plus size={18} /> Agregar al Carrito
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Cart List */}
                    <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 min-h-[300px] flex flex-col">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-700">
                            <ShoppingBag className="text-teal-600" size={20} />
                            Servicios en la Orden
                        </h2>

                        <div className="flex-1 space-y-3">
                            {cart.length === 0 ? (
                                <div className="text-center text-gray-400 py-10">Ningún servicio agregado aún</div>
                            ) : cart.map((item, idx) => (
                                <div key={item.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center animate-in slide-in-from-bottom-2">
                                    <div className="flex-1">
                                        <div className="font-bold text-gray-800">{item.description}</div>
                                        <div className="text-xs text-gray-500 flex gap-2">
                                            {item.weight_kg > 0 && <span>Peso: {item.weight_kg}kg</span>}
                                            {item.pieces > 0 && <span>Cant: {item.pieces}</span>}
                                            <span className="text-green-600 font-bold ml-2">${item.unit_price} / ud</span>
                                        </div>
                                        {item.observations && (
                                            <div className="mt-1.5 text-xs text-gray-600 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">
                                                <span className="font-bold text-amber-700">Nota:</span> {item.observations}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-bold text-gray-800 text-lg">
                                            ${(item.quantity * item.unit_price).toFixed(2)}
                                        </span>
                                        <button onClick={() => removeFromCart(item.id)} className="text-rose-500 hover:bg-rose-50 p-2 rounded-full transition-colors">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="pt-6 border-t mt-4 flex justify-between items-center">
                            <div className="text-right">
                                <span className="text-gray-500 text-sm">Total Estimado</span>
                                <div className="text-2xl font-black text-gray-800">
                                    ${cart.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0).toFixed(2)}
                                </div>
                            </div>
                            <button
                                onClick={handleSubmit}
                                disabled={loading || cart.length === 0}
                                className="bg-gray-900 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
                            >
                                {loading ? 'Guardando...' : <><Save size={20} /> Crear Orden Completa</>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LaundryForm;
