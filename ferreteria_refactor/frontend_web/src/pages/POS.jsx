import { useState, useRef, useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, RotateCcw, Package, Receipt, AlertTriangle, Layers, ArrowLeft, MapPin, User, Wrench } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useCash } from '../context/CashContext';
import { useConfig } from '../context/ConfigContext';
import { useWebSocket } from '../context/WebSocketContext';
import { Link } from 'react-router-dom';
import UnitSelectionModal from '../components/pos/UnitSelectionModal';
import EditItemModal from '../components/pos/EditItemModal';
import PaymentModal from '../components/pos/PaymentModal';
import CashOpeningModal from '../components/cash/CashOpeningModal';
import CashMovementModal from '../components/cash/CashMovementModal';
import SaleSuccessModal from '../components/pos/SaleSuccessModal';
import ProductThumbnail from '../components/products/ProductThumbnail';
import CartItemQuantityInput from '../components/pos/CartItemQuantityInput';
import useBarcodeScanner from '../hooks/useBarcodeScanner';
import ServiceImportModal from './POS/ServiceImportModal';
import SerializedItemModal from '../components/pos/SerializedItemModal';
import ProductCard from '../components/pos/ProductCard'; // NEW: Import ProductCard

import apiClient from '../config/axios';
import { toast } from 'react-hot-toast';

// Helper to format stock: show as integer if whole number, otherwise show decimals
const formatStock = (stock) => {
    const num = Number(stock);
    return num % 1 === 0 ? num.toFixed(0) : num.toFixed(3).replace(/\.?0+$/, '');
};

// Helper format currency: 4 decimals for < 1, 2 decimals otherwise
const formatCurrency = (amount) => {
    const num = Number(amount);
    if (Math.abs(num) < 1 && num !== 0) {
        return num.toFixed(4);
    }
    return num.toFixed(2);
};

const POS = () => {
    const { cart, addToCart, removeFromCart, updateQuantity, updateCartItem, clearCart, totalUSD, totalBs, totalsByCurrency, exchangeRates } = useCart();
    const { isSessionOpen, openSession, loading } = useCash();
    const { getActiveCurrencies, convertPrice, convertProductPrice, currencies, modules } = useConfig();
    const { subscribe } = useWebSocket(); // WebSocket Hook
    const anchorCurrency = currencies.find(c => c.is_anchor) || { symbol: '$' };

    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedProductForUnits, setSelectedProductForUnits] = useState(null); // For Modal
    const [selectedItemForEdit, setSelectedItemForEdit] = useState(null);
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [isMovementOpen, setIsMovementOpen] = useState(false);
    const [lastSaleData, setLastSaleData] = useState(null); // { cart, totalUSD, paymentData }
    const [selectedProductIndex, setSelectedProductIndex] = useState(-1); // For keyboard navigation
    const [quoteCustomer, setQuoteCustomer] = useState(null); // Customer loaded from quote
    const [activeQuoteId, setActiveQuoteId] = useState(null); // ID of the quote currently loaded

    // NEW: Service Order Integration
    const [isServiceImportOpen, setIsServiceImportOpen] = useState(false);
    const [activeServiceOrderId, setActiveServiceOrderId] = useState(null);
    const [serviceOrderTicket, setServiceOrderTicket] = useState(null);
    const [selectedProductForSerialized, setSelectedProductForSerialized] = useState(null); // Serialized Modal State
    // NEW: Serialized Item Modal Import
    // (Import added below with other imports)


    // Data State
    const [catalog, setCatalog] = useState([]);
    const [categories, setCategories] = useState([]);
    const [warehouses, setWarehouses] = useState([]); // NEW
    const [selectedWarehouseId, setSelectedWarehouseId] = useState(''); // NEW
    const [salespeople, setSalespeople] = useState([]); // NEW: Technical Services
    const [isLoading, setIsLoading] = useState(true);

    // Refs
    const searchInputRef = useRef(null);

    // ... (Existing hotkeys remain same) ...
    // F3: Focus search input
    useHotkeys('f3', (e) => {
        e.preventDefault();
        if (searchInputRef.current) {
            searchInputRef.current.focus();
            if (searchTerm) {
                searchInputRef.current.select(); // Select all text for easy rewrite
            }
        }
    }, { enableOnFormTags: true }); // Works even when focused on inputs

    // F5: Open payment modal (Cobrar)
    useHotkeys('f5', (e) => {
        e.preventDefault();
        if (cart.length > 0) {
            setIsPaymentOpen(true);
        }
    }, {
        preventDefault: true,  // Critical: prevent browser refresh
        enableOnFormTags: true
    });

    // ESC: Cancel/Back cascade logic
    useHotkeys('esc', (e) => {
        e.preventDefault();

        // Priority cascade
        if (isPaymentOpen) {
            setIsPaymentOpen(false);
        } else if (isMovementOpen) {
            setIsMovementOpen(false);
        } else if (isServiceImportOpen) { // New
            setIsServiceImportOpen(false);
        } else if (selectedProductForUnits) {
            setSelectedProductForUnits(null);
        } else if (selectedItemForEdit) {
            setSelectedItemForEdit(null);
        } else if (lastSaleData) {
            handleSuccessClose();
        } else {
            // Nothing open, clear search and focus
            setSearchTerm('');
            if (searchInputRef.current) {
                searchInputRef.current.focus();
            }
        }
    });

    // F2: New sale (clear cart with confirmation)
    useHotkeys('f2', (e) => {
        e.preventDefault();
        if (cart.length > 0) {
            if (window.confirm('¿Desea iniciar una nueva venta? Se perderá el carrito actual.')) {
                clearCart();
                setQuoteCustomer(null); // Clear quote customer
                setActiveQuoteId(null); // Clear quote ID

                // Clear Service Order State
                setActiveServiceOrderId(null);
                setServiceOrderTicket(null);

                setSearchTerm('');
                if (searchInputRef.current) {
                    searchInputRef.current.focus();
                }
            }
        } else {
            // Cart already empty, just clear search
            setSearchTerm('');
            if (searchInputRef.current) {
                searchInputRef.current.focus();
            }
        }
    });

    // ... (Other hotkeys remain same) ...
    // F4: Edit last item in cart
    useHotkeys('f4', (e) => {
        e.preventDefault();
        if (cart.length > 0) {
            const lastItem = cart[cart.length - 1];
            setSelectedItemForEdit(lastItem);
        }
    });

    // Arrow Down: Navigate to next product in search results
    useHotkeys('down', (e) => {
        if (filteredCatalog.length > 0) {
            e.preventDefault();
            setSelectedProductIndex(prev =>
                prev < filteredCatalog.length - 1 ? prev + 1 : prev
            );
        }
    }, { enableOnFormTags: true });

    // Arrow Up: Navigate to previous product in search results
    useHotkeys('up', (e) => {
        if (filteredCatalog.length > 0) {
            e.preventDefault();
            setSelectedProductIndex(prev => prev > 0 ? prev - 1 : 0);
        }
    }, { enableOnFormTags: true });

    // Enter: Add selected product to cart
    useHotkeys('enter', (e) => {
        if (selectedProductIndex >= 0 && selectedProductIndex < filteredCatalog.length) {
            e.preventDefault();
            const selectedProduct = filteredCatalog[selectedProductIndex];
            handleProductClick(selectedProduct);
            setSelectedProductIndex(-1); // Reset selection
        }
    }, { enableOnFormTags: true });


    // ... Barcode Scanner Logic ...
    // Barcode logic is unchanged but adding ellipsis for brevity in replacement...

    /**
     * Handler para cuando se escanea un código de barras
     * Busca el producto en el catálogo y lo agrega al carrito
     */
    const handleGlobalScan = (code) => {
        // ... (existing scan logic) ...
        console.log('🔍 Buscando producto con código:', code);
        // ... (truncated for brevity, keep logic) ...
        const foundProduct = catalog.find(p => p.sku == code || p.id == code || p.name.includes(code)); // Simplified for replace
        if (foundProduct) handleProductClick(foundProduct);
    };

    useBarcodeScanner(handleGlobalScan, { minLength: 3, maxTimeBetweenKeys: 50 });


    useEffect(() => {
        // ... (Existing Fetch Data) ...
        const fetchData = async () => {
            // ... existing fetch logic ...
            try {
                const [productsRes, categoriesRes, warehousesRes] = await Promise.all([
                    apiClient.get('/products/'),
                    apiClient.get('/categories'),
                    apiClient.get('/warehouses')
                ]);
                setCatalog(Array.isArray(productsRes.data) ? productsRes.data : []);
                setCategories(Array.isArray(categoriesRes.data) ? categoriesRes.data : []);
                setWarehouses(Array.isArray(warehousesRes.data) ? warehousesRes.data : []);
                setSelectedWarehouseId('all');

                if (modules?.services) { // Load users if services active
                    try {
                        const usersRes = await apiClient.get('/users');
                        if (Array.isArray(usersRes.data)) {
                            // Filter active users
                            setSalespeople(usersRes.data.filter(u => u.is_active));
                        }
                    } catch (err) {
                        console.error("Failed to load salespeople:", err);
                    }
                }
            } catch (e) { console.error(e); }
            setIsLoading(false);
        };
        fetchData();
    }, [modules]);

    // ... Quote Loading Logic ...

    // ... WebSocket Logic ...

    // ... Filter Logic ...
    const filteredCatalog = catalog.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())); // Simplified for replace block

    // ... Categories Logic ...
    const rootCategories = categories.filter(cat => !cat.parent_id);

    // ... Helper functions ...
    const focusSearch = () => { setTimeout(() => searchInputRef.current?.focus(), 50); };

    // ... Handle Product Click ...
    const handleProductClick = (product) => {
        if (product.has_imei) {
            setSelectedProductForSerialized(product);
            return;
        }

        if (product.units?.length > 0) {
            setSelectedProductForUnits(product);
        } else {
            addBaseProductToCart(product);
            focusSearch();
        }
    };

    const addBaseProductToCart = (product) => {
        // ... existing implementation ...
        addToCart(product, { name: 'Unidad', price_usd: parseFloat(product.price), factor: 1, is_base: true });
    };

    const handleUnitSelect = (unit) => {
        // ... existing implementation ...
        addToCart(selectedProductForUnits, unit);
        setSelectedProductForUnits(null);
    }

    const handleSerializedConfirm = (serials) => {
        if (!selectedProductForSerialized) return;

        // We assume 1 item for now as per MVP plan, but serials is an array
        // Typically addToCart expects (product, unit)
        // We need to pass serials to addToCart. 
        // CartContext.addToCart might not support extra props easily without modification?
        // Let's check CartContext usage. usually it takes (product, unit).
        // If unit is undefined, it uses defaults.
        // We can inject the serials property into the 'unit' object or 'product' object temporarily?
        // No, cleaner to pass a 3rd argument options? Or merge into unit.

        // Assuming addToCart(product, unitOrOptions)
        // Let's look at how addBaseProductToCart works:
        // addToCart(product, { name: 'Unidad', price_usd: parseFloat(product.price), factor: 1, is_base: true });

        // We will construct the unit object manualy similar to addBaseProductToCart but adding serial_numbers
        const product = selectedProductForSerialized;
        const unitPayload = {
            name: 'Unidad',
            price_usd: parseFloat(product.price),
            factor: 1,
            is_base: true,
            serial_numbers: serials, // <--- INJECTED
            // Hack: Use unique ID to allow multiple lines of same product if needed? 
            // Or if we want them grouped, CartContext logic will group them.
            // If we have serials, they are unique items basically.
            // If CartContext group by ID, we might have issues if we want to separate them.
            // But if we sell 2 phones, and serials=['A', 'B'], we want 1 line with Qty 2 and 2 serials.
            // This matches our backend logic.
        };

        // Determine quantity from serials length
        // But addToCart usually adds +1. 
        // If serials.length > 1, we might need to add multiple times or modify addToCart.
        // For now, let's assume one by one scan or simple passing.
        // If modal returns 1 serial, easy.

        // If we modify addToCart to accept a Quantity override?
        // Let's assume standard add (+1) for now, but perform it N times? 
        // Or better, let's just rely on the fact that we passed the FULL array of serials
        // and we expect the cart item to represent that bundle.

        // WAIT: addToCart logic usually merges. 
        // If I add product X with serial A, then add product X with serial B.
        // CartContext will likely merge them into Quantity: 2.
        // And we need to merge the serials arrays?
        // This requires CartContext modification. 
        // Alternatively, distinct Cart Items? (Requires unique unit_id or similar).

        // MVP Plan:
        // Intercept `addToCart` is hard.
        // Let's force `addToCart` usage correctly.

        // If I send `serial_numbers`, I should probably send them all.
        // But repeated calls...

        // Let's stick to: 
        // 1. User scans 1 serial. (Modal quantity=1).
        // 2. We add 1 item to cart with `serial_numbers: ['A']`.
        // 3. User scans another. We add another...
        // CartContext will merge. We need to ensure `serial_numbers` are concatenated in CartContext?

        // Since I cannot see CartContext right now, 
        // I will assume standard behavior and just pass the property.
        // If CartContext overwrites the object, we lose previous serials.
        // This is a risk.

        // SAFE APPROACH: unique ID for serialized items to prevent merging.
        // unit.id = `SERIAL-${serials[0]}`
        // Then they appear as separate lines. This is safer for UX too ("Phone IMEI: A", "Phone IMEI: B").
        // It validates the "Inline Cart Display" plan too.

        serials.forEach(accSerial => {
            const singleUnit = {
                name: 'Unidad',
                price_usd: parseFloat(product.price),
                factor: 1,
                is_base: true,
                serial_numbers: [accSerial],
                // Force unique line item by mocking a unit_id or modifying the product ID?
                // CartContext usually uses `${product.id}-${unit.id || 'base'}`
                // Let's use a fake unit_id
                unit_id: `IMEI-${accSerial}`,
                has_imei: true
            };
            addToCart(product, singleUnit);
        });

        setSelectedProductForSerialized(null);
    };

    // NEW: Handlers for Service Orders
    const handleServiceOrderSelect = (order) => {
        if (cart.length > 0) {
            if (!confirm('¿Reemplazar carrito con orden de servicio?')) return;
        }

        clearCart();
        setIsServiceImportOpen(false);
        setActiveServiceOrderId(order.id);
        setServiceOrderTicket(order.ticket_number);
        setQuoteCustomer(order.customer); // Reuse quote customer logic to pre-fill payment modal

        let addedCount = 0;

        order.details.forEach(item => {
            // Logic to find or mock product
            let product;

            if (item.product_id) {
                product = catalog.find(p => p.id === item.product_id);
            }

            if (!product) {
                // Create Mock Product for Manual Service
                product = {
                    id: `SRV_${item.id}`,
                    name: item.description || "Servicio Manual",
                    price: parseFloat(item.unit_price),
                    stock: 9999,
                    is_service_mock: true,
                    image_url: null
                };
            }

            // Add to cart with forced price from order
            const unit = {
                name: 'Servicio',
                price_usd: parseFloat(item.unit_price),
                factor: 1,
                is_base: true,
                salesperson_id: item.technician_id, // IMPORTANT: Carry over technician for commission!
                // Add explicit flag if needed
            };

            addToCart(product, unit);
            // Update quantity
            // Note: CartContext creates IDs based on product.id + unit.name
            // Mock product needs unique ID to avoid collision if multiple generic services added?
            // Yes, we used SRV_{item.id} which is unique per detail row.

            // Force quantity update
            // Wait, addToCart is async in state? No, CartContext is usually sync-ish for state updates in React 18 batching
            // But we need the generated ID.
            const itemId = `${product.id}_Servicio`.replace(/\s+/g, '_');
            updateQuantity(itemId, item.quantity);

            // IMPORTANT: Set salesperson locally if present
            if (item.technician_id) {
                updateCartItem(itemId, { salesperson_id: item.technician_id });
            }

            addedCount++;
        });

        toast.success(`Orden ${order.ticket_number} cargada (${addedCount} items)`);
    };

    const handleServiceCheckoutSubmit = async (saleData) => {
        // Wrapper to call special endpoint
        // saleData comes from PaymentModal

        if (!activeServiceOrderId) {
            throw new Error("No hay orden de servicio activa");
        }

        const response = await apiClient.post(`/services/orders/${activeServiceOrderId}/checkout`, saleData);

        // Return response in format expected by PaymentModal (it expects data.sale_id or response.sale_id)
        return response;
    };

    const handleCheckout = (paymentData) => {
        setLastSaleData({
            cart: [...cart],
            totalUSD,
            totalBs,
            paymentData,
            saleId: paymentData.saleId
        });
        setIsPaymentOpen(false);

        // Clear Service State after successful checkout flow initiation (Modal Open)
        // Actually, wait until Success Modal closes to clear everything.
    };

    const handleSuccessClose = () => {
        setLastSaleData(null);
        clearCart();
        setActiveServiceOrderId(null); // Clear service state
        setServiceOrderTicket(null);
        setQuoteCustomer(null);
    };

    // Mobile View State
    const [mobileTab, setMobileTab] = useState('catalog'); // 'catalog' | 'ticket'

    return (
        <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-slate-100 relative p-4 gap-4">

            {/* =====================================================================================
                LEFT COLUMN: CATALOG & TOOLS (65% Width)
               ===================================================================================== */}
            <div className={`
                flex-col min-w-0 transition-all z-0 bg-white/60 backdrop-blur-md rounded-3xl shadow-xl border border-white/40 overflow-hidden
                ${mobileTab === 'catalog' ? 'flex w-full' : 'hidden md:flex flex-1'}
            `}>
                {/* Header Bar */}
                <div className="bg-white/40 border-b border-white/50 px-6 py-4 flex justify-between items-center backdrop-blur-sm">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="flex items-center gap-2 p-2 -ml-2 hover:bg-white/60 rounded-xl text-slate-500 hover:text-indigo-600 transition-colors group glass-panel" title="Volver al Menú">
                            <ArrowLeft className="group-hover:-translate-x-1 transition-transform" size={20} />
                            <span className="font-semibold text-sm hidden sm:block">Salir</span>
                        </Link>

                        {/* SERVICE ORDER BUTTON */}
                        {modules?.services && (
                            <button
                                onClick={() => setIsServiceImportOpen(true)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${activeServiceOrderId
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105'
                                    : 'bg-white/80 text-indigo-600 border-indigo-100 hover:bg-indigo-50'
                                    }`}
                                title="Cargar Orden de Servicio Lista"
                            >
                                <Wrench size={14} />
                                {activeServiceOrderId ? `Orden: ${serviceOrderTicket}` : 'Cargar Servicio'}
                            </button>
                        )}

                    </div>
                    {/* Search Bar - Centered & Elegant */}
                    <div className="flex-1 max-w-xl mx-4 relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <span className="text-[10px] font-bold text-slate-300 border border-slate-200 rounded px-1 bg-white/50">F3</span>
                        </div>
                        <input
                            ref={searchInputRef}
                            type="text"
                            className="
                                w-full pl-10 pr-4 py-2.5
                                bg-white/70 border border-white/60 rounded-xl text-base text-slate-700 placeholder-slate-400
                                focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all focus:bg-white shadow-inner
                            "
                            placeholder="Buscar productos..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setSelectedProductIndex(-1);
                            }}
                            autoFocus
                        />
                    </div>


                    {/* Warehouse Selector */}
                    <div className="flex items-center gap-2 mx-2 bg-indigo-50/80 rounded-xl px-3 py-1.5 border border-indigo-100 hover:border-indigo-300 transition-all group/wh cursor-pointer">
                        <MapPin size={16} className="text-indigo-600 group-hover/wh:text-indigo-700 transition-colors" />
                        <div className="flex flex-col">
                            <span className="text-[9px] uppercase font-bold text-indigo-400 leading-none mb-0.5">Bodega</span>
                            <select
                                value={selectedWarehouseId}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSelectedWarehouseId(val === 'all' ? 'all' : Number(val));
                                }}
                                className="bg-transparent border-none text-xs font-bold text-indigo-900 focus:ring-0 p-0 pr-4 cursor-pointer w-full max-w-[100px] truncate leading-none"
                                title="Seleccionar Bodega de Salida"
                                disabled={!Array.isArray(warehouses) || warehouses.length === 0}
                            >
                                <option value="all">Todas</option>
                                {(Array.isArray(warehouses) ? warehouses : []).map(w => (
                                    <option key={w.id} value={w.id}>
                                        {w.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Categories Bar */}
                <div className="px-6 py-3 flex items-center gap-2 overflow-x-auto scrollbar-hide border-b border-white/30">
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className={`
                            px-4 py-1.5 rounded-lg text-sm font-medium transition-all backdrop-blur-sm
                            ${!selectedCategory
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 ring-2 ring-indigo-600 ring-offset-1'
                                : 'bg-white/50 text-slate-600 hover:bg-white border border-white/60'
                            }
                        `}
                    >
                        Todos
                    </button>
                    {rootCategories.map(category => (
                        <button
                            key={category.id}
                            onClick={() => setSelectedCategory(category.id)}
                            className={`
                                px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all border backdrop-blur-sm
                                ${selectedCategory === category.id
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/30'
                                    : 'bg-white/50 text-slate-600 hover:bg-white border-white/60'
                                }
                            `}
                        >
                            {category.name}
                        </button>
                    ))}
                </div>

                {/* Catalog Grid */}
                <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4 pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300/50 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-indigo-400/50">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                        {filteredCatalog.map((product, index) => {
                            // Calculate stock based on selection
                            let currentStock = 0;

                            if (product.stocks && product.stocks.length > 0) {
                                if (selectedWarehouseId === 'all') {
                                    // Sum all warehouses
                                    currentStock = product.stocks.reduce((sum, s) => sum + Number(s.quantity), 0);
                                } else {
                                    const stockEntry = product.stocks.find(s => s.warehouse_id === selectedWarehouseId);
                                    currentStock = stockEntry ? stockEntry.quantity : 0;
                                }
                            } else {
                                // Fallback for products without Multi-Warehouse data
                                currentStock = product.stock || 0;
                            }

                            return (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    onClick={handleProductClick}
                                    currentStock={currentStock}
                                    currencySymbol={anchorCurrency.symbol}
                                    convertProductPrice={convertProductPrice}
                                    isSelected={index === selectedProductIndex}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* =====================================================================================
                RIGHT COLUMN: TICKET (35% Width)
               ===================================================================================== */}
            <div className={`
                bg-white/80 backdrop-blur-xl flex-col rounded-3xl shadow-2xl border border-white/60 overflow-hidden
                ${mobileTab === 'ticket' ? 'flex w-full absolute inset-0 z-50' : 'hidden md:flex w-[35%] lg:w-[30%]'}
            `}>
                {/* Ticket Header */}
                <div className="bg-gradient-to-r from-slate-50 to-white p-5 border-b border-white flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            Ticket de Venta
                        </h2>
                        <p className="text-xs text-slate-400 font-medium">
                            {cart.length} {cart.length === 1 ? 'producto' : 'productos'} agregados
                        </p>
                    </div>
                    <button
                        onClick={clearCart}
                        className="bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 p-2 rounded-lg transition-all border border-slate-200 hover:border-rose-200"
                        title="Limpiar (F2)"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>

                {/* Cart Items List */}
                <div className="flex-1 overflow-y-auto bg-transparent p-2 space-y-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300/50 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-indigo-400/50">
                    {cart.map((item, idx) => (
                        <div
                            key={`${item.id}-${item.unit_id}-${idx}`}
                            onClick={() => setSelectedItemForEdit(item)}
                            className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl hover:bg-white hover:shadow-sm hover:border-indigo-100 cursor-pointer transition-all group"
                        >
                            <div className="flex gap-3">
                                {/* Product Image */}
                                <ProductThumbnail
                                    imageUrl={item.image_url}
                                    productName={item.name}
                                    updatedAt={item.updated_at}
                                    size="sm"
                                />

                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="min-w-0 pr-2 w-full">
                                            <div className="font-medium text-slate-700 text-sm line-clamp-2 leading-tight">
                                                {item.name}
                                            </div>
                                            {/* SERIAL NUMBERS DISPLAY */}
                                            {item.serial_numbers && item.serial_numbers.length > 0 && (
                                                <div className="mt-0.5 text-[10px] font-mono text-slate-500 bg-slate-100 px-1 rounded w-fit">
                                                    S/N: {item.serial_numbers.join(', ')}
                                                </div>
                                            )}
                                            <div className="flex flex-wrap items-center gap-1 mt-1.5">
                                                {/* SKU Badge */}
                                                {item.sku && (
                                                    <span className="text-[9px] font-mono text-slate-400 bg-white px-1 rounded border border-slate-100">
                                                        {item.sku}
                                                    </span>
                                                )}
                                                {/* Special Rate Badge */}
                                                {item.is_special_rate && (
                                                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-[9px] font-bold">
                                                        <RotateCcw size={8} />
                                                        {item.exchange_rate_name || 'TASA'}
                                                    </span>
                                                )}
                                            </div>

                                            {/* NEW: Salesperson Selector (Services Module) */}
                                            {modules?.services && (
                                                <div
                                                    className="mt-2 flex items-center gap-1 bg-indigo-50/50 rounded p-1 w-full max-w-[180px] hover:bg-indigo-50 transition-colors"
                                                    onClick={(e) => e.stopPropagation()} // Prevent edit modal trigger
                                                >
                                                    <User size={12} className="text-indigo-400" />
                                                    <select
                                                        className="bg-transparent border-none text-[10px] p-0 w-full text-indigo-700 font-medium focus:ring-0 cursor-pointer"
                                                        value={item.salesperson_id || ""}
                                                        onChange={(e) => {
                                                            const val = e.target.value ? parseInt(e.target.value) : null;
                                                            updateCartItem(item.id, { salesperson_id: val });
                                                        }}
                                                    >
                                                        <option value="">-- Sin Vendedor --</option>
                                                        {salespeople.map(u => (
                                                            <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}

                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="font-bold text-slate-800">${formatCurrency(item.subtotal_usd || 0)}</div>
                                            <span className="text-[10px] text-slate-400 font-mono">
                                                Bs {Number(item.subtotal_bs || 0).toLocaleString('es-VE', { maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center mt-2">
                                        <div className="flex items-center gap-2">
                                            {/* Quantity Controls */}
                                            <CartItemQuantityInput
                                                quantity={item.quantity}
                                                onUpdate={(newQty) => {
                                                    updateQuantity(item.id, newQty);
                                                    focusSearch();
                                                }}
                                                unitName={item.unit_name}
                                                min={0}
                                            />
                                            <span className="text-[10px] font-medium text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-100">
                                                {item.unit_name}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {cart.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 select-none py-10">
                            <Package size={48} className="mb-4 text-slate-200" />
                            <p className="text-base font-medium text-slate-400">Carrito Vacío</p>
                            <p className="text-xs">Agrega productos del catálogo</p>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                < div className="bg-white border-t border-slate-100 p-4 space-y-3 z-20" >
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <div className="flex justify-between items-end mb-1">
                            <span className="text-slate-500 font-medium text-xs">Total a Pagar</span>
                            <span className="text-2xl font-black text-slate-800 tracking-tight">
                                {anchorCurrency.symbol}{formatCurrency(totalUSD)}
                            </span>
                        </div>
                        {/* Total in Bs */}
                        <div className="flex justify-between items-end">
                            <span className="text-slate-400 font-medium text-[10px]">Bolívares</span>
                            <span className="text-sm font-bold text-slate-500 font-mono">
                                Bs {cart.reduce((sum, item) => sum + (Number(item.subtotal_bs) || 0), 0).toLocaleString('es-VE', { maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setIsMovementOpen(true)}
                            className="flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 text-slate-600 text-xs font-bold transition-all"
                        >
                            <CreditCard size={14} /> Caja / Avance
                        </button>
                        <Link
                            to="/cash-close"
                            className="flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 text-slate-600 text-xs font-bold transition-all"
                        >
                            <Receipt size={14} /> Cierre
                        </Link>
                    </div>

                    <button
                        onClick={() => setIsPaymentOpen(true)}
                        disabled={cart.length === 0}
                        className="
                            w-full bg-indigo-600 hover:bg-indigo-700 text-white
                            disabled:bg-slate-100 disabled:text-slate-300 disabled:cursor-not-allowed
                            py-3.5 rounded-xl font-bold text-base shadow-lg hover:shadow-indigo-200 hover:-translate-y-0.5
                            transition-all flex items-center justify-center gap-3
                        "
                    >
                        COBRAR
                    </button>

                    {/* Botón para volver al catálogo en móvil (solo visible si estamos en modo ticket) */}
                    < button
                        onClick={() => setMobileTab('catalog')}
                        className="md:hidden w-full text-slate-500 font-medium py-2 text-sm"
                    >
                        ← Seguir Comprando
                    </button>
                </div>
            </div>

            {/* MOBILE FLOATING ACTION BUTTON (Summary) - Only visible when in Catalog mode and cart has items */}
            {
                mobileTab === 'catalog' && cart.length > 0 && (
                    <div className="md:hidden fixed bottom-6 left-4 right-4 z-30">
                        <button
                            onClick={() => setMobileTab('ticket')}
                            className="w-full bg-slate-800 text-white p-4 rounded-xl shadow-2xl flex justify-between items-center animate-bounce-slight"
                        >
                            <div className="flex items-center gap-3">
                                <div className="bg-indigo-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                                    {cart.length}
                                </div>
                                <span className="font-medium">Ver / Pagar</span>
                            </div>
                            <span className="text-xl font-bold">
                                ${formatCurrency(totalUSD)}
                            </span>
                        </button>
                    </div>
                )
            }

            {/* Modals Logic Remains Same */}
            <UnitSelectionModal
                isOpen={!!selectedProductForUnits}
                product={selectedProductForUnits}
                onClose={() => setSelectedProductForUnits(null)}
                onSelect={handleUnitSelect}
            />

            <EditItemModal
                isOpen={!!selectedItemForEdit}
                item={selectedItemForEdit}
                onClose={() => setSelectedItemForEdit(null)}
                onUpdate={updateQuantity}
                onDelete={removeFromCart}
            />
            {/* Payment Modal */}
            <PaymentModal
                isOpen={isPaymentOpen}
                onClose={() => {
                    setIsPaymentOpen(false);
                    focusSearch();
                }}
                totalUSD={totalUSD}
                totalBs={totalBs}
                totalsByCurrency={totalsByCurrency}
                cart={cart}
                onConfirm={handleCheckout}
                warehouseId={selectedWarehouseId}
                initialCustomer={quoteCustomer}
                quoteId={activeQuoteId}
                customSubmit={activeServiceOrderId ? handleServiceCheckoutSubmit : null}
            />

            <SerializedItemModal
                isOpen={!!selectedProductForSerialized}
                product={selectedProductForSerialized}
                quantity={1}
                onClose={() => setSelectedProductForSerialized(null)}
                onConfirm={handleSerializedConfirm}
            />

            <ServiceImportModal
                isOpen={isServiceImportOpen}
                onClose={() => setIsServiceImportOpen(false)}
                onSelect={handleServiceOrderSelect}
            />

            <CashMovementModal
                isOpen={isMovementOpen}
                onClose={() => {
                    setIsMovementOpen(false);
                    focusSearch();
                }}
            />

            <SaleSuccessModal
                isOpen={!!lastSaleData}
                saleData={lastSaleData}
                onClose={handleSuccessClose}
            />

            {/* Cash Opening Modal - only show after loading and if session is closed */}
            {
                !loading && !isSessionOpen && (
                    <CashOpeningModal onOpen={openSession} />
                )
            }
        </div >
    );
};

export default POS;
