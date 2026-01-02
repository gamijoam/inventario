import { useState, useRef, useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, RotateCcw, Package, Receipt, AlertTriangle, Layers, ArrowLeft, MapPin } from 'lucide-react';
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

import apiClient from '../config/axios';
import { toast } from 'react-hot-toast';

// Helper to format stock: show as integer if whole number, otherwise show decimals
const formatStock = (stock) => {
    const num = Number(stock);
    return num % 1 === 0 ? num.toFixed(0) : num.toFixed(3).replace(/\.?0+$/, '');
};

const POS = () => {
    const { cart, addToCart, removeFromCart, updateQuantity, clearCart, totalUSD, totalBs, totalsByCurrency, exchangeRates } = useCart();
    const { isSessionOpen, openSession, loading } = useCash();
    const { getActiveCurrencies, convertPrice, currencies } = useConfig();
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

    // Data State
    const [catalog, setCatalog] = useState([]);
    const [categories, setCategories] = useState([]);
    const [warehouses, setWarehouses] = useState([]); // NEW
    const [selectedWarehouseId, setSelectedWarehouseId] = useState(''); // NEW
    const [isLoading, setIsLoading] = useState(true);

    // Refs
    const searchInputRef = useRef(null);

    // ========================================
    // KEYBOARD SHORTCUTS
    // ========================================

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
                clearCart();
                setQuoteCustomer(null); // Clear quote customer
                setActiveQuoteId(null); // Clear quote ID
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

    // ========================================
    // BARCODE SCANNER INTEGRATION
    // ========================================

    /**
     * Handler para cuando se escanea un código de barras
     * Busca el producto en el catálogo y lo agrega al carrito
     */
    const handleGlobalScan = (code) => {
        console.log('🔍 Buscando producto con código:', code);
        console.log('📦 Total productos en catálogo:', catalog.length);

        // Buscar producto por SKU, nombre, ID, o barcode en units
        const foundProduct = catalog.find(p => {
            // Check SKU (handle both string and numeric)
            const matchesSku = p.sku && (
                p.sku.toString().toLowerCase() === code.toLowerCase() ||
                p.sku.toString() === code
            );

            // Check name and ID
            const matchesName = p.name.toLowerCase().includes(code.toLowerCase());
            const matchesId = p.id.toString() === code;

            // Check barcodes in product units
            const matchesUnitBarcode = p.units && p.units.some(unit =>
                unit.barcode && (
                    unit.barcode.toString().toLowerCase() === code.toLowerCase() ||
                    unit.barcode.toString() === code
                )
            );

            const matches = matchesSku || matchesName || matchesId || matchesUnitBarcode;

            // Debug log for each product checked
            if (p.sku && p.sku.toString().includes(code)) {
                console.log('🔎 Producto candidato:', {
                    name: p.name,
                    sku: p.sku,
                    skuType: typeof p.sku,
                    code: code,
                    codeType: typeof code,
                    matchesSku,
                    matches
                });
            }

            return matches;
        });

        if (foundProduct) {
            console.log('✅ Producto encontrado:', foundProduct.name);
            handleProductClick(foundProduct);
        } else {
            console.error('❌ Producto no encontrado para código:', code);
            console.log('📋 Primeros 3 productos del catálogo:', catalog.slice(0, 3).map(p => ({
                name: p.name,
                sku: p.sku,
                skuType: typeof p.sku
            })));
            alert(`Producto no encontrado: ${code}`);
        }
    };

    // Activar el hook de escaneo
    useBarcodeScanner(handleGlobalScan, {
        minLength: 3,           // Códigos de al menos 3 caracteres
        maxTimeBetweenKeys: 50, // Scanners escriben <50ms entre teclas
        ignoreIfFocused: false  // Capturar incluso si hay un input enfocado
    });

    // Fetch Catalog and Categories on Mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [productsRes, categoriesRes, warehousesRes] = await Promise.all([
                    apiClient.get('/products/'),
                    apiClient.get('/categories'),
                    apiClient.get('/warehouses')
                ]);
                console.log('POS Catalog loaded:', productsRes.data);
                console.log('Warehouses loaded:', warehousesRes.data);

                setCatalog(Array.isArray(productsRes.data) ? productsRes.data : []);
                setCategories(Array.isArray(categoriesRes.data) ? categoriesRes.data : []);

                const validWarehouses = Array.isArray(warehousesRes.data) ? warehousesRes.data : [];
                setWarehouses(validWarehouses);

                // Set default warehouse (Main or first)
                // Use 'all' by default to show all stock
                setSelectedWarehouseId('all');
            } catch (error) {
                console.error("Error fetching data:", error);
                toast.error("Error cargando datos del POS");
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    // Load Quote from URL if present
    useEffect(() => {
        const loadQuoteToCart = async () => {
            const params = new URLSearchParams(window.location.search);
            const quoteId = params.get('quote_id');

            if (quoteId && catalog.length > 0 && !isLoading) {
                try {
                    // Clear URL to prevent re-runs
                    window.history.replaceState({}, document.title, window.location.pathname);

                    // Confirm overwrite if cart is not empty
                    if (cart.length > 0) {
                        if (!window.confirm('¿Desea reemplazar el carrito actual con los ítems de la cotización?')) {
                            return;
                        }
                    }

                    clearCart();
                    const loadingToast = toast.loading('Cargando cotización...');

                    const { data: quote } = await apiClient.get(`/quotes/${quoteId}`);
                    console.log("Loading quote:", quote);

                    setQuoteCustomer(quote.customer || null); // Set customer from quote
                    setActiveQuoteId(quote.id); // Set active quote ID

                    let itemsAdded = 0;

                    // Backend returns 'details', but we might expect 'items'
                    const quoteItems = quote.details || quote.items;

                    if (quote && Array.isArray(quoteItems)) {
                        quoteItems.forEach(item => {
                            const product = catalog.find(p => p.id === item.product_id);
                            if (product) {
                                // Find appropriate unit (default to base)
                                const baseUnit = product.units?.find(u => u.is_base) || product.units?.[0] || { name: 'Unidad', factor: 1 };

                                // Construct unit with price from quote
                                const unitToUse = {
                                    ...baseUnit,
                                    price_usd: item.unit_price, // Override price with quote price
                                };

                                // Add item
                                addToCart(product, unitToUse);

                                // Update quantity immediately after
                                // Calculate ID exactly as CartContext does
                                const itemId = `${product.id}_${unitToUse.name.replace(/\s+/g, '_')}`;
                                updateQuantity(itemId, item.quantity);
                                itemsAdded++;
                            }
                        });
                    } else {
                        console.error("Quote items missing or invalid format:", quote);
                        toast.error("La cotización no contiene items válidos.");
                    }

                    toast.dismiss(loadingToast);
                    if (itemsAdded > 0) {
                        toast.success(`Cotización #${quoteId} cargada con éxito`);
                    } else {
                        // only show error if we didn't show the "invalid format" error above?
                        // actually itemsAdded would be 0 if format invalid.
                        if (quote && Array.isArray(quoteItems)) {
                            toast.error("No se pudieron cargar los productos (¿IDs cambiaron?)");
                        }
                    }

                } catch (err) {
                    console.error(err);
                    toast.error("Error al cargar la cotización");
                }
            }
        };

        if (!isLoading && catalog.length > 0) {
            loadQuoteToCart();
        }
    }, [catalog, isLoading]);

    // WebSocket Subscriptions for Products
    useEffect(() => {
        const unsubUpdate = subscribe('product:updated', (updatedProduct) => {
            console.log('📦 Real-time Product Update:', updatedProduct);
            setCatalog(prev => prev.map(p => p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p));
        });

        const unsubCreate = subscribe('product:created', (newProduct) => {
            console.log('📦 Real-time Product Created:', newProduct);
            setCatalog(prev => [...prev, newProduct]);
        });

        const unsubDelete = subscribe('product:deleted', (deletedProduct) => {
            console.log('📦 Real-time Product Deleted:', deletedProduct);
            setCatalog(prev => prev.filter(p => p.id !== deletedProduct.id));
        });

        return () => {
            unsubUpdate();
            unsubCreate();
            unsubDelete();
        };
    }, [subscribe]);

    // Filter by search and category
    const filteredCatalog = catalog.filter(p => {
        // Search by name, SKU, or barcode in units
        const searchLower = searchTerm.toLowerCase();

        // Check product name and SKU
        const matchesName = p.name.toLowerCase().includes(searchLower);

        // SKU comparison - handle both string and numeric
        const matchesSku = p.sku && (
            p.sku.toString().toLowerCase().includes(searchLower) ||
            p.sku.toString() === searchTerm
        );

        const matchesNameOrSku = matchesName || matchesSku;

        // Check barcodes in product units (alternative presentations)
        const matchesUnitBarcode = p.units && p.units.some(unit =>
            unit.barcode && (
                unit.barcode.toString().toLowerCase().includes(searchLower) ||
                unit.barcode.toString() === searchTerm
            )
        );

        const matchesSearch = matchesNameOrSku || matchesUnitBarcode;

        if (!selectedCategory) return matchesSearch;

        // Check if product belongs to selected category or its children
        if (p.category_id === selectedCategory) return matchesSearch;

        // Check if product belongs to a subcategory of selected category
        const productCategory = categories.find(c => c.id === p.category_id);
        if (productCategory?.parent_id === selectedCategory) return matchesSearch;

        return false;
    });

    // Get root categories and subcategories
    const rootCategories = categories.filter(cat => !cat.parent_id);
    const getSubcategories = (parentId) => categories.filter(cat => cat.parent_id === parentId);

    const focusSearch = () => {
        // Small timeout to allow UI updates/modal closing
        setTimeout(() => {
            if (searchInputRef.current) {
                searchInputRef.current.focus();
                // Select all text if any (optional, but good for rapid scanning)
                searchInputRef.current.select();
            }
        }, 50);
    };

    const handleProductClick = (product) => {
        // Multi-Unit Logic
        if (product.units && product.units.length > 0) {
            setSelectedProductForUnits(product);
            return;
        }

        // Classic Logic (Base Unit)
        addBaseProductToCart(product);
        focusSearch(); // FOCUS TRAP ADDED
    };

    const addBaseProductToCart = (product) => {
        // Determine exchange rate for base product
        let selectedExchangeRateId = null;
        let selectedExchangeRateName = 'Sistema Default';
        let isSpecialRate = false;

        if (product.exchange_rate_id) {
            selectedExchangeRateId = product.exchange_rate_id;
            isSpecialRate = true;

            // Get rate name
            if (Array.isArray(exchangeRates)) {
                const rateInfo = exchangeRates.find(r => r.id === product.exchange_rate_id);
                if (rateInfo) {
                    selectedExchangeRateName = rateInfo.name;
                }
            }
        }

        // Calculate Discount
        const basePrice = parseFloat(product.price);
        let finalPrice = basePrice;
        let discountPercentage = 0;
        let isDiscountActive = false;

        if (product.is_discount_active && product.discount_percentage > 0) {
            discountPercentage = parseFloat(product.discount_percentage);
            const discountAmount = basePrice * (discountPercentage / 100);
            finalPrice = basePrice - discountAmount;
            isDiscountActive = true;
        }

        const baseUnit = {
            name: product.unit_type || 'Unidad',
            price_usd: finalPrice, // Discounted price for cart totals
            original_price_usd: basePrice, // Original price for backend
            discount_percentage: discountPercentage,
            is_discount_active: isDiscountActive,

            factor: 1,
            is_base: true,
            exchange_rate_id: selectedExchangeRateId,
            exchange_rate_name: selectedExchangeRateName,
            is_special_rate: isSpecialRate
        };

        console.log('🔍 DEBUG addBaseProductToCart:', baseUnit);
        addToCart(product, baseUnit);
    };

    const handleUnitSelect = (unitOption) => {
        if (!selectedProductForUnits) return;
        const product = selectedProductForUnits;

        // ========================================
        // ALGORITMO DE PRECIO (USD) - CASCADA ESTRICTA
        // ========================================
        let calculatedPriceUSD;

        // PASO 1: ¿La ProductUnit tiene precio específico?
        if (unitOption.price_usd && unitOption.price_usd > 0) {
            calculatedPriceUSD = parseFloat(unitOption.price_usd);
        }
        // PASO 2: Calcular desde precio base del producto
        else {
            const basePriceUSD = parseFloat(product.price || 0);
            const conversionFactor = parseFloat(unitOption.conversion_factor || unitOption.factor || 1);
            calculatedPriceUSD = basePriceUSD * conversionFactor;
        }

        // Apply Discount Logic for Units
        let finalPriceUSD = calculatedPriceUSD;
        let discountPercentage = 0;
        let isDiscountActive = false;

        if (unitOption.is_discount_active && unitOption.discount_percentage > 0) {
            discountPercentage = parseFloat(unitOption.discount_percentage);
            const discountAmount = calculatedPriceUSD * (discountPercentage / 100);
            finalPriceUSD = calculatedPriceUSD - discountAmount;
            isDiscountActive = true;
        }


        // ========================================
        // ALGORITMO DE TASA DE CAMBIO - CASCADA ESTRICTA
        // ========================================
        let selectedExchangeRateId = null;
        let selectedExchangeRateName = 'Sistema Default';
        let isSpecialRate = false;

        // PASO 1: ¿La ProductUnit tiene tasa específica?
        if (unitOption.exchange_rate_id) {
            selectedExchangeRateId = unitOption.exchange_rate_id;
            isSpecialRate = true;
            console.log(`💱 Tasa de Unit: ID ${selectedExchangeRateId}`);
        }
        // PASO 2: ¿El Product padre tiene tasa específica?
        else if (product.exchange_rate_id) {
            selectedExchangeRateId = product.exchange_rate_id;
            isSpecialRate = true;
            console.log(`💱 Tasa del Producto: ID ${selectedExchangeRateId}`);
        }
        // PASO 3: Usar tasa global por defecto (null = sistema decide)
        else {
            selectedExchangeRateId = null;
            isSpecialRate = false;
            console.log(`💱 Usando tasa predeterminada del sistema`);
        }

        // Obtener nombre de la tasa para mostrar en UI
        if (selectedExchangeRateId && Array.isArray(exchangeRates)) {
            const rateInfo = exchangeRates.find(r => r.id === selectedExchangeRateId);
            if (rateInfo) {
                selectedExchangeRateName = rateInfo.name;
            }
        }

        // ========================================
        // CONSTRUIR OBJETO UNIT PARA EL CARRITO
        // ========================================
        const unit = {
            name: unitOption.unit_name || unitOption.name,
            price_usd: finalPriceUSD,  // Precio YA DESCONTADO
            original_price_usd: calculatedPriceUSD, // Precio BASE
            discount_percentage: discountPercentage,
            is_discount_active: isDiscountActive,

            factor: unitOption.conversion_factor || unitOption.factor || 1,
            is_base: unitOption.is_base || false,
            unit_id: unitOption.id || null,

            // NUEVO: Información de tasa de cambio
            exchange_rate_id: selectedExchangeRateId,
            exchange_rate_name: selectedExchangeRateName,
            is_special_rate: isSpecialRate
        };

        console.log('📦 Unit final para carrito:', unit);

        // Agregar al carrito
        addToCart(product, unit);
        setSelectedProductForUnits(null);
        focusSearch(); // FOCUS TRAP ADDED
    };

    const handleCheckout = (paymentData) => {
        // Save data for receipt printing
        setLastSaleData({
            cart: [...cart], // Copy cart
            totalUSD,
            totalBs,
            paymentData,
            saleId: paymentData.saleId // NEW: Capture sale ID for printing
        });

        // Don't clear cart immediately, wait for user to close success modal
        setIsPaymentOpen(false);
        // Success modal triggers based on !!lastSaleData
    };

    const handleSuccessClose = () => {
        setLastSaleData(null);
        clearCart();
    };

    // Mobile View State
    const [mobileTab, setMobileTab] = useState('catalog'); // 'catalog' | 'ticket'

    return (
        <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] overflow-hidden bg-slate-50 relative p-4 gap-4">

            {/* =====================================================================================
                LEFT COLUMN: CATALOG & TOOLS (65% Width)
               ===================================================================================== */}
            <div className={`
                flex-col min-w-0 transition-all z-0 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden
                ${mobileTab === 'catalog' ? 'flex w-full' : 'hidden md:flex flex-1'}
            `}>
                {/* Header Bar */}
                <div className="bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="flex items-center gap-2 p-2 -ml-2 hover:bg-slate-50 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors group" title="Volver al Menú">
                            <ArrowLeft className="group-hover:-translate-x-1 transition-transform" size={20} />
                            <span className="font-semibold text-sm hidden sm:block">Salir</span>
                        </Link>
                    </div>
                    {/* Search Bar - Centered & Elegant */}
                    <div className="flex-1 max-w-xl mx-4 relative group">
                        <div className="absolute inset-y-0 left-0 pl-16 flex items-center pointer-events-none z-10">
                            <Search className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                        </div>
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <span className="text-[10px] font-bold text-slate-300 border border-slate-200 rounded px-1">F3</span>
                        </div>
                        <input
                            ref={searchInputRef}
                            type="text"
                            className="
                                w-full pl-10 pr-4 py-2.5
                                bg-slate-50 border border-slate-200 rounded-xl text-base text-slate-700 placeholder-slate-400
                                focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all focus:bg-white
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
                    <div className="flex items-center gap-2 mx-2 bg-indigo-50 rounded-xl px-3 py-1.5 border border-indigo-100 hover:border-indigo-300 transition-all group/wh cursor-pointer">
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
                <div className="px-6 py-3 flex items-center gap-2 overflow-x-auto scrollbar-hide border-b border-slate-50">
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className={`
                            px-4 py-1.5 rounded-lg text-sm font-medium transition-all
                            ${!selectedCategory
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
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
                                px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all border
                                ${selectedCategory === category.id
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
                                    : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
                                }
                            `}
                        >
                            {category.name}
                        </button>
                    ))}
                </div>

                {/* Catalog Grid */}
                <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4 bg-slate-50/50">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                        {filteredCatalog.map((product, index) => {
                            // Calculate stock based on selection
                            let currentStock = 0;
                            let stockDetails = [];

                            if (product.stocks && product.stocks.length > 0) {
                                if (selectedWarehouseId === 'all') {
                                    // Sum all warehouses
                                    currentStock = product.stocks.reduce((sum, s) => sum + Number(s.quantity), 0);
                                    stockDetails = product.stocks.filter(s => s.quantity > 0);
                                } else {
                                    const stockEntry = product.stocks.find(s => s.warehouse_id === selectedWarehouseId);
                                    currentStock = stockEntry ? stockEntry.quantity : 0;
                                }
                            } else {
                                // Fallback for products without Multi-Warehouse data
                                currentStock = product.stock || 0;
                            }

                            return (
                                <div
                                    key={product.id}
                                    onClick={() => handleProductClick(product)}
                                    className={`
                                    group relative flex flex-col justify-between bg-white rounded-xl cursor-pointer transition-all duration-300
                                    border h-full min-h-[180px]
                                    ${index === selectedProductIndex
                                            ? 'ring-2 ring-indigo-500 shadow-lg border-transparent'
                                            : 'border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100'
                                        }
                                `}
                                >
                                    {/* Product Image */}
                                    <div className="p-3 border-b border-slate-50">
                                        <ProductThumbnail
                                            imageUrl={product.image_url}
                                            productName={product.name}
                                            updatedAt={product.updated_at}
                                            size="lg"
                                        />
                                    </div>

                                    <div className="p-3 flex-1 flex flex-col">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 rounded tracking-tighter">
                                                {product.sku || '---'}
                                            </span>
                                            {currentStock <= (product.min_stock || 5) && (
                                                <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 rounded-full">
                                                    <AlertTriangle size={10} /> Stock
                                                </span>
                                            )}
                                        </div>

                                        <h3 className="font-semibold text-slate-700 text-sm leading-snug line-clamp-2 mb-3 group-hover:text-indigo-600 transition-colors">
                                            {product.name}
                                        </h3>

                                        <div className="mt-auto flex justify-between items-end pt-2 border-t border-slate-50">
                                            <div className="flex flex-col">
                                                <span className="text-lg font-bold text-slate-900 leading-none">
                                                    ${Number(product.price).toFixed(2)}
                                                </span>
                                                <span className={`text-[10px] font-medium mt-1 ${currentStock <= 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                                                    Stock: {Number(currentStock).toFixed(0)}
                                                </span>
                                            </div>
                                            {/* Presentations Indicator */}
                                            {product.units?.length > 0 && (
                                                <div className="flex items-center justify-center w-6 h-6 bg-orange-50 rounded-lg text-orange-500" title="Varias presentaciones">
                                                    <Layers size={14} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* =====================================================================================
                RIGHT COLUMN: TICKET (35% Width)
               ===================================================================================== */}
            <div className={`
                bg-white flex-col rounded-2xl shadow-sm border border-slate-200 overflow-hidden
                ${mobileTab === 'ticket' ? 'flex w-full absolute inset-0 z-50' : 'hidden md:flex w-[35%] lg:w-[30%]'}
            `}>
                {/* Ticket Header */}
                <div className="bg-white p-5 border-b border-slate-100 flex justify-between items-center">
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
                <div className="flex-1 overflow-y-auto bg-white p-2 space-y-2">
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
                                        <div className="min-w-0 pr-2">
                                            <div className="font-medium text-slate-700 text-sm line-clamp-2 leading-tight">
                                                {item.name}
                                            </div>
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
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="font-bold text-slate-800">${Number(item.subtotal_usd || 0).toFixed(2)}</div>
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
                                                onUpdate={(newQty) => updateQuantity(item.id, newQty)} // FIX: Use item.id
                                                unitName={item.unit_name}
                                                min={0} // Allow 0 to remove
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
                                {anchorCurrency.symbol}{Number(totalUSD).toFixed(2)}
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
                                ${Number(totalUSD).toFixed(2)}
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
                totalBs={totalBs} // PASSING TOTAL BS FOR MULTI-CURRENCY FIX
                totalsByCurrency={totalsByCurrency}
                cart={cart}
                onConfirm={handleCheckout}
                warehouseId={selectedWarehouseId}
                initialCustomer={quoteCustomer}
                quoteId={activeQuoteId}
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
