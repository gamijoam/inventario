import { useAuth } from '../context/AuthContext';
import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, ArrowRightLeft, Banknote, Lock, ShoppingCart, PauseCircle, PlayCircle, Zap } from 'lucide-react';
import CashClosingModal from '../components/cash/CashClosingModal';

import { useHotkeys } from 'react-hotkeys-hook';
import { Layers, Settings as SettingsIcon, Users } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { useCart } from '../context/CartContext';
import { useCash } from '../context/CashContext';
import { useConfig } from '../context/ConfigContext';
import { useWebSocket } from '../context/WebSocketContext';
import { Link, useSearchParams } from 'react-router-dom';

// New Components
import POSCatalog from '../components/pos/POSCatalog';
import POSCart from '../components/pos/POSCart';
import ExpressSearch from '../components/pos/ExpressSearch';

// Modals
import UnitSelectionModal from '../components/pos/UnitSelectionModal';
import EditItemModal from '../components/pos/EditItemModal';
import PaymentModal from '../components/pos/PaymentModal';
import CashOpeningModal from '../components/cash/CashOpeningModal';
import CashMovementModal from '../components/cash/CashMovementModal';
import CashAdvanceModal from '../components/cash/CashAdvanceModal';
import SaleSuccessModal from '../components/pos/SaleSuccessModal';
import useBarcodeScanner from '../hooks/useBarcodeScanner';
import usePOSCatalog from '../hooks/usePOSCatalog';
import ServiceImportModal from './POS/ServiceImportModal';
import SerializedItemModal from '../components/pos/SerializedItemModal';
import POSSettingsModal from '../components/pos/POSSettingsModal';
import PinAuthModal from '../components/common/PinAuthModal';
import EmployeeSelectionModal from '../components/pos/EmployeeSelectionModal';
import { DEFAULT_THEME, POS_THEMES } from '../constants/posThemes';

import apiClient from '../config/axios';
import { toast } from 'react-hot-toast';

// Helper to format stock: show as integer if whole number, otherwise show decimals
const formatStock = (stock) => {
    const num = Number(stock);
    return num % 1 === 0 ? num.toFixed(0) : num.toFixed(3).replace(/\.?0+$/, '');
};

const POS = () => {
    const { user, updateUserPreferences } = useAuth();
    const { cart, addToCart, removeFromCart, updateQuantity, updateCartItem, clearCart, totalUSD, totalBs, totalsByCurrency, exchangeRates, discountUSD, cartDiscount, heldCart, holdCart, resumeHeldCart, discardHeldCart } = useCart();
    const { isSessionOpen, openSession, loading: isCashLoading } = useCash();
    const { getActiveCurrencies, getPrimaryLocalCurrency, convertPrice, convertProductPrice, currencies, modules, formatCurrency } = useConfig();
    const { subscribe } = useWebSocket();
    const {
        products: displayProducts, isLoading: catalogLoading, isLoadingMore,
        hasMore, total: totalProducts, loadMore, setSearch: setServerSearch,
        setCategoryId: setServerCategory, lookupProduct, getFromCache, refreshProduct
    } = usePOSCatalog();
    const anchorCurrency = currencies.find(c => c.is_anchor) || { symbol: '$' };

    // Toggle: mostrar precio en moneda secundaria en las tarjetas (default ON)
    const [showSecondaryPrice, setShowSecondaryPrice] = useState(
        () => localStorage.getItem('pos_show_secondary_price') !== 'false'
    );
    const toggleSecondaryPrice = () => {
        setShowSecondaryPrice(prev => {
            const next = !prev;
            localStorage.setItem('pos_show_secondary_price', next);
            return next;
        });
    };
    const secondaryCurrency = getPrimaryLocalCurrency() || null;
    const secondaryCurrencies = getActiveCurrencies().filter(c => !c.is_anchor && c.currency_code !== 'USD');

    // Theme State - Resolve by ID to ensure latest styles
    const themeId = user?.preferences?.pos_theme?.id || 'default';
    const currentTheme = POS_THEMES.find(t => t.id === themeId) || DEFAULT_THEME;
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Express Mode State
    const isExpressMode = user?.preferences?.pos_mode === 'express';
    const handleToggleExpressMode = () => {
        updateUserPreferences({ pos_mode: isExpressMode ? 'full' : 'express' });
    };
    const [searchParams] = useSearchParams();
    const quoteIdParam = searchParams.get('quote_id');

    useEffect(() => {
    }, [isSettingsOpen]);

    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedProductForUnits, setSelectedProductForUnits] = useState(null);
    const [selectedItemForEdit, setSelectedItemForEdit] = useState(null);
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
    const [isMovementOpen, setIsMovementOpen] = useState(false);
    const [isAdvanceOpen, setIsAdvanceOpen] = useState(false);
    const [isClosingOpen, setIsClosingOpen] = useState(false);
    const [lastSaleData, setLastSaleData] = useState(null);
    const [selectedProductIndex, setSelectedProductIndex] = useState(-1);
    const [quoteCustomer, setQuoteCustomer] = useState(null);
    const [activeQuoteId, setActiveQuoteId] = useState(null);

    // NEW: Price Lists & Security State
    const [priceLists, setPriceLists] = useState([]);
    const [pinModalOpen, setPinModalOpen] = useState(false);
    const [pendingPriceUpdate, setPendingPriceUpdate] = useState(null); // { itemId, price, listId }
    const [activePricePopover, setActivePricePopover] = useState(null); // itemId

    // NEW: Service Order Integration
    const [isServiceImportOpen, setIsServiceImportOpen] = useState(false);
    const [activeServiceOrderId, setActiveServiceOrderId] = useState(null);
    const [serviceOrderTicket, setServiceOrderTicket] = useState(null);
    const [selectedProductForSerialized, setSelectedProductForSerialized] = useState(null);
    const [selectedProductForEmployee, setSelectedProductForEmployee] = useState(null);
    const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);

    // Data State
    const [categories, setCategories] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
    const [salespeople, setSalespeople] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [selectedSalespersonId, setSelectedSalespersonId] = useState(''); // NEW: Global Salesperson

    const [isLoading, setIsLoading] = useState(true);

    const handleSearchChange = useCallback((value) => {
        setSearchTerm(value); // Update input immediately for responsiveness
    }, []);


    // Refs
    const catalogRef = useRef(null);

    // ... (Existing hotkeys remain same) ...
    // F3: Focus search input
    useHotkeys('f3', (e) => {
        e.preventDefault();
        if (catalogRef.current) {
            catalogRef.current.focusSearch();
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
        } else if (isAdvanceOpen) {
            setIsAdvanceOpen(false);
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
            handleSearchChange('');
            if (catalogRef.current) {
                catalogRef.current.clearAndFocusSearch();
            }
        }
    });

    // F6: Pausar venta
    useHotkeys('f6', (e) => {
        e.preventDefault();
        if (cart.length > 0 && !heldCart) holdCart();
        else if (heldCart) {
            if (cart.length === 0 || confirm('¿Reemplazar el carrito actual con la venta pausada?')) resumeHeldCart();
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

                handleSearchChange('');
                if (catalogRef.current) {
                    catalogRef.current.clearAndFocusSearch();
                }
            }
        } else {
            // Cart already empty, just clear search
            handleSearchChange('');
            if (catalogRef.current) {
                catalogRef.current.clearAndFocusSearch();
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
        if (displayProducts.length > 0) {
            e.preventDefault();
            setSelectedProductIndex(prev =>
                prev < displayProducts.length - 1 ? prev + 1 : prev
            );
        }
    }, { enableOnFormTags: true });

    // Arrow Up: Navigate to previous product in search results
    useHotkeys('up', (e) => {
        if (displayProducts.length > 0) {
            e.preventDefault();
            setSelectedProductIndex(prev => prev > 0 ? prev - 1 : 0);
        }
    }, { enableOnFormTags: true });

    // Enter: Add selected product to cart
    useHotkeys('enter', (e) => {
        if (selectedProductIndex >= 0 && selectedProductIndex < displayProducts.length) {
            // Producto seleccionado con flechas → agregar ese
            e.preventDefault();
            handleProductClick(displayProducts[selectedProductIndex]);
            setSelectedProductIndex(-1);
        } else if (displayProducts.length === 1 && searchTerm.trim().length > 0) {
            // SKU exacto o código de barras → único resultado → agregar automáticamente
            e.preventDefault();
            handleProductClick(displayProducts[0]);
            setSelectedProductIndex(-1);
        }
    }, { enableOnFormTags: true });


    // ... Barcode Scanner Logic ...
    // Barcode logic is unchanged but adding ellipsis for brevity in replacement...

    /**
     * Handler para cuando se escanea un código de barras
     * Busca el producto en el catálogo y lo agrega al carrito
     */
    const handleGlobalScan = async (code) => {
        const foundProduct = await lookupProduct(code);
        if (foundProduct) {
            handleProductClick(foundProduct);
        } else {
            toast.error(`Producto no encontrado: ${code}`);
        }
    };

    useBarcodeScanner(handleGlobalScan, {
        minLength: 3,
        maxTimeBetweenKeys: 50,
        enabled: !pinModalOpen && !selectedProductForSerialized && !isPaymentOpen && !isSettingsOpen
    });


    useEffect(() => {
        // ... (Existing Fetch Data) ...
        const fetchData = async () => {
            // Check session status first
            // ... (keep implies simple update, but replacing block)
            // Assuming session check is handled by context/other logic or implicit here

            try {
                const [categoriesRes, warehousesRes, priceListsRes] = await Promise.all([
                    apiClient.get('/categories'),
                    apiClient.get('/warehouses'),
                    apiClient.get('/price-lists/') // NEW
                ]);
                setCategories(Array.isArray(categoriesRes.data) ? categoriesRes.data : []);
                setWarehouses(Array.isArray(warehousesRes.data) ? warehousesRes.data : []);

                if (priceListsRes && Array.isArray(priceListsRes.data)) {
                    setPriceLists(priceListsRes.data.filter(pl => pl.is_active));
                }
                setSelectedWarehouseId('all');

                try {
                    // _silent403 + _silentNetworkError: these are optional background calls
                    // (salesperson dropdown / barbershop employees). POS works without them.
                    // The catch block already handles errors silently, so no toast needed.
                    const [usersRes, employeesRes] = await Promise.all([
                        apiClient.get('/users', { _silent403: true, _silentNetworkError: true }),
                        apiClient.get('/employees/', { _silent403: true, _silentNetworkError: true })
                    ]);

                    if (Array.isArray(usersRes.data)) {
                        setSalespeople(usersRes.data.filter(u => u.is_active));
                    }
                    if (Array.isArray(employeesRes.data)) {
                        setEmployees(employeesRes.data.filter(e => e.status === 'ACTIVE'));
                    }
                } catch (err) {
                    console.error("Failed to load staff/employees:", err);
                }

                if (modules?.services) {
                    // Other service-specific logic if any
                }
            } catch (e) { console.error(e); }
            setIsLoading(false);
        };
        fetchData();
    }, [modules]);

    // WebSocket: real-time product updates
    useEffect(() => {
        const unsub1 = subscribe('product:updated', (data) => {
            refreshProduct(data.id || data.product_id);
        });
        const unsub2 = subscribe('product:deleted', (data) => {
            refreshProduct(data.id || data.product_id);
        });
        return () => {
            if (unsub1) unsub1();
            if (unsub2) unsub2();
        };
    }, [subscribe, refreshProduct]);

    // ... Quote Loading Logic ...
    useEffect(() => {
        if (!isLoading && quoteIdParam) {
            loadQuoteIntoCart(quoteIdParam);
        }
    }, [isLoading, quoteIdParam]);

    const loadQuoteIntoCart = async (id) => {
        try {
            const loadingToast = toast.loading(`Cargando cotización #${id}...`);
            const { data: quote } = await apiClient.get(`/quotes/${id}`);
            toast.dismiss(loadingToast);

            if (quote.status === 'CONVERTED') {
                toast.error("Esta cotización ya fue facturada");
                return;
            }

            // Set Quote context
            setActiveQuoteId(quote.id);
            if (quote.customer) setQuoteCustomer(quote.customer);

            // Add items to cart
            let addedCount = 0;
            const items = quote.details || quote.items || [];

            for (const item of items) {
                const product = getFromCache(item.product_id) || await lookupProduct(item.product_id);
                if (product) {
                    // Try to match unit or use base
                    const unitName = item.is_box ? 'Caja' : 'Unidad';
                    let unit = product.units?.find(u => u.unit_name === unitName);

                    if (!unit) {
                        unit = {
                            name: unitName,
                            price_usd: parseFloat(item.unit_price),
                            factor: 1,
                            is_base: !item.is_box,
                            exchange_rate_id: product.exchange_rate_id // Inherit product's anchored rate if present
                        };
                    }

                    // Add to cart with specific price from quote
                    addToCart(product, { ...unit, price_usd: parseFloat(item.unit_price) });


                    // Update quantity
                    const itemId = `${product.id}_${unit.name.replace(/\s+/g, '_')}`;
                    updateQuantity(itemId, Number(item.quantity));
                    addedCount++;
                }
            }

            toast.success(`Cotización #${id} cargada (${addedCount} productos)`);
        } catch (error) {
            console.error("Error loading quote into POS:", error);
            toast.error("No se pudo cargar la cotización");
        }
    };

    // ... WebSocket Logic ...

    const rootCategories = categories.filter(cat => !cat.parent_id);

    // ... Helper functions ...
    const focusAndSelectSearch = () => {
        if (catalogRef.current) {
            catalogRef.current.focusSearch();
        }
    };

    const focusSearch = focusAndSelectSearch;

    const handleProductClick = (product) => {
        // Bug [006] fix: clear search text and keep focus on search bar
        setSearchTerm('');
        if (catalogRef.current) {
            catalogRef.current.clearAndFocusSearch();
        }

        // NEW: Barbershop Service check
        if (product.is_barbershop_service) {
            setSelectedProductForEmployee(product);
            setIsEmployeeModalOpen(true);
            return;
        }

        if (product.has_imei) {
            setSelectedProductForSerialized(product);
            return;
        }

        if (product.units?.length > 0) {
            setSelectedProductForUnits(product);
        } else {
            addBaseProductToCart(product);
        }
    };

    const handleEmployeeSelect = (employee) => {
        if (!selectedProductForEmployee) return;

        const product = selectedProductForEmployee;

        // Add to cart with the selected employee
        addToCart(product, {
            name: 'Servicio',
            price_usd: parseFloat(product.price),
            factor: 1,
            is_base: true,
            employee_id: employee.id,
            salesperson_id: selectedSalespersonId || null
        });

        setSelectedProductForEmployee(null);
        setIsEmployeeModalOpen(false);

        toast.success(`Asignado a: ${employee.name}`);
    };

    const addBaseProductToCart = (product) => {
        addToCart(product, {
            name: 'Unidad',
            price_usd: parseFloat(product.price),
            factor: 1,
            is_base: true,
            salesperson_id: selectedSalespersonId || null // Apply Global Salesperson
        });
    };

    const handleUnitSelect = (unit) => {
        addToCart(selectedProductForUnits, { ...unit, salesperson_id: selectedSalespersonId || null });
        setSelectedProductForUnits(null);
        focusSearch();
    }

    const handleSerializedConfirm = (serials) => {
        if (!selectedProductForSerialized) return;

        serials.forEach(accSerial => {
            const singleUnit = {
                name: 'Unidad',
                price_usd: parseFloat(selectedProductForSerialized.price),
                factor: 1,
                is_base: true,
                serial_numbers: [accSerial],
                unit_id: `IMEI-${accSerial}`,
                has_imei: true,
                salesperson_id: selectedSalespersonId || null
            };
            addToCart(selectedProductForSerialized, singleUnit);
        });

        setSelectedProductForSerialized(null);
        focusSearch();
    };

    // NEW: Handlers for Service Orders
    const handleServiceOrderSelect = async (order) => {
        if (cart.length > 0) {
            if (!confirm('¿Reemplazar carrito con orden de servicio?')) return;
        }

        clearCart();
        setIsServiceImportOpen(false);
        setActiveServiceOrderId(order.id);
        setServiceOrderTicket(order.ticket_number);
        setQuoteCustomer(order.customer); // Reuse quote customer logic to pre-fill payment modal

        let addedCount = 0;

        for (const item of order.details) {
            // Logic to find or mock product
            let product;
            if (item.product_id) product = getFromCache(item.product_id) || await lookupProduct(item.product_id);
            if (!product) {
                product = {
                    id: `SRV_${item.id}`,
                    name: item.description || "Servicio Manual",
                    price: parseFloat(item.unit_price),
                    stock: 9999,
                    is_service_mock: true,
                    image_url: null
                };
            }

            const unit = {
                name: 'Servicio',
                price_usd: parseFloat(item.unit_price),
                factor: 1,
                is_base: true,
                salesperson_id: item.technician_id,
            };

            addToCart(product, unit);
            const itemId = `${product.id}_Servicio`.replace(/\s+/g, '_');
            updateQuantity(itemId, item.quantity);

            if (item.technician_id) updateCartItem(itemId, { salesperson_id: item.technician_id });
            addedCount++;
        }

        // 🆕 DEDUCT PAYMENTS (ABONOS)
        if (order.payments && order.payments.length > 0) {
            const totalPaid = order.payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

            if (totalPaid > 0) {
                const creditProduct = {
                    id: `CREDIT_${order.id}`,
                    name: "Abono / Anticipo",
                    price: -Math.abs(totalPaid), // Negative Price
                    stock: 9999,
                    is_service_mock: true,
                    image_url: null
                };

                const creditUnit = {
                    name: 'Nota Crédito',
                    price_usd: -Math.abs(totalPaid),
                    factor: 1,
                    is_base: true
                };

                addToCart(creditProduct, creditUnit);
                addedCount++;
            }
        }

        toast.success(`Orden ${order.ticket_number} cargada (${addedCount} items)`);
    };

    const handleServiceCheckoutSubmit = async (saleData) => {
        if (!activeServiceOrderId) throw new Error("No hay orden de servicio activa");
        const response = await apiClient.post(`/services/orders/${activeServiceOrderId}/checkout`, saleData);
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
    };

    const handleSuccessClose = () => {
        // Refrescar stock de los productos vendidos antes de limpiar el carrito
        if (lastSaleData?.cart?.length > 0) {
            lastSaleData.cart.forEach(item => {
                if (item.product_id) refreshProduct(item.product_id);
            });
        }
        setLastSaleData(null);
        clearCart();
        setActiveServiceOrderId(null);
        setServiceOrderTicket(null);
        setQuoteCustomer(null);
    };

    // NEW: Price List Logic
    const handlePriceListSelect = (list, item) => {
        // null list = revert to base price
        if (!list) {
            const itemProduct = getFromCache(item.product_id);
            const basePrice = itemProduct ? parseFloat(itemProduct.price) : item.unit_price_usd;
            updateCartItem(item.id, { unit_price_usd: basePrice, price_list_id: null, auth_user_id: null });
            toast.success('Precio revertido al precio base');
            return;
        }

        const itemProduct = getFromCache(item.product_id);
        let newPrice = null;
        if (itemProduct && itemProduct.prices) {
            const priceEntry = itemProduct.prices.find(p => p.price_list_id === list.id);
            if (priceEntry) newPrice = parseFloat(priceEntry.price);
        }

        if (newPrice === null) {
            toast.error("Este producto no tiene precio asignado en esta lista");
            return;
        }

        if (list.requires_auth) {
            setPendingPriceUpdate({ itemId: item.id, price: newPrice, listId: list.id });
            setPinModalOpen(true);
        } else {
            updateCartItem(item.id, { unit_price_usd: newPrice, price_list_id: list.id, auth_user_id: null });
            setActivePricePopover(null);
            toast.success(`Precio actualizado a lista: ${list.name}`);
        }
    };

    const handlePinSuccess = (userId) => {
        if (pendingPriceUpdate) {
            updateCartItem(pendingPriceUpdate.itemId, {
                unit_price_usd: pendingPriceUpdate.price,
                price_list_id: pendingPriceUpdate.listId,
                auth_user_id: userId
            });
            setPendingPriceUpdate(null);
            setActivePricePopover(null);
        }
    };

    const handleUpdateItem = (itemId, quantity, extra = {}) => {
        if (quantity !== undefined && quantity !== null) updateQuantity(itemId, quantity);
        if (Object.keys(extra).length > 0) updateCartItem(itemId, extra);
    };

    return (
        <div id="tour-pos-container" className="flex flex-col h-screen bg-slate-100 overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>

            {/* GLOBAL POS HEADER */}
            <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <Link to="/" className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-800 transition-colors" title="Volver al Dashboard">
                        <ArrowLeft size={20} />
                    </Link>
                    <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>
                    <h1 className="text-lg font-black text-slate-800 tracking-tight hidden md:block">Punto de Venta</h1>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsMovementOpen(true)}
                        className="hidden md:flex gap-2 font-bold text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200"
                    >
                        <ArrowRightLeft size={16} /> Movimientos
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAdvanceOpen(true)}
                        className="hidden md:flex gap-2 font-bold text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200"
                    >
                        <Banknote size={16} /> Avance
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsServiceImportOpen(true)}
                        className="hidden md:flex gap-2 font-bold text-slate-600 border-slate-200 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200"
                    >
                        <Layers size={16} /> Órdenes
                    </Button>

                    {/* Pausar venta — siempre visible, desactivado sin items o con pausa activa */}
                    {!heldCart && (
                        <Button
                            id="tour-pos-hold-btn"
                            variant="outline"
                            size="sm"
                            onClick={holdCart}
                            disabled={cart.length === 0}
                            className="hidden md:flex gap-2 font-bold text-amber-600 border-amber-300 hover:bg-amber-50 hover:border-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
                            title={cart.length === 0 ? 'Agrega productos para pausar la venta' : 'Pausar venta y atender otro cliente (F6)'}
                        >
                            <PauseCircle size={16} /> Pausar
                        </Button>
                    )}

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            if (window.confirm('¿Desea cerrar la caja actual? Se generará un resumen de ventas.')) {
                                setIsClosingOpen(true);
                            }
                        }}
                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 font-bold gap-2"
                    >
                        <Lock size={16} /> Cerrar Caja
                    </Button>

                    {/* Botón Modo Express — temporalmente oculto
                    <Button
                        variant={isExpressMode ? 'default' : 'outline'}
                        size="sm"
                        onClick={handleToggleExpressMode}
                        className={isExpressMode
                            ? 'hidden md:flex gap-2 font-bold bg-indigo-600 hover:bg-indigo-700 text-white border-0'
                            : 'hidden md:flex gap-2 font-bold text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200'
                        }
                        title={isExpressMode ? 'Cambiar a POS Completo' : 'Activar Modo Express (caja rápida)'}
                    >
                        <Zap size={16} /> {isExpressMode ? 'Modo Express' : 'Express'}
                    </Button>
                    */}

                    <div className="h-8 w-[1px] bg-slate-200 mx-1 hidden md:block"></div>

                    {/* Toggle precio moneda secundaria en tarjetas */}
                    {secondaryCurrencies.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={toggleSecondaryPrice}
                            title={showSecondaryPrice ? 'Ocultar precios secundarios en tarjetas' : 'Mostrar precios secundarios en tarjetas'}
                            className={`hidden md:flex items-center gap-1.5 rounded-full text-xs font-bold px-3 ${showSecondaryPrice ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                        >
                            <span>{secondaryCurrencies.map(c => c.symbol).join('/')}</span>
                            <span>{showSecondaryPrice ? 'ON' : 'OFF'}</span>
                        </Button>
                    )}

                    <Button
                        id="tour-pos-settings"
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsSettingsOpen(true)}
                        className="text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-full"
                        title="Configuración de Estación"
                    >
                        <SettingsIcon size={20} />
                    </Button>
                </div>
            </div>

            {/* BANNER VENTA PAUSADA */}
            {heldCart && (
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between shrink-0 z-10">
                    <div className="flex items-center gap-2 text-amber-700 text-sm font-semibold">
                        <PauseCircle size={16} className="shrink-0" />
                        <span>
                            Venta pausada a las {new Date(heldCart.pausedAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                            {' · '}{heldCart.items.length} {heldCart.items.length === 1 ? 'ítem' : 'ítems'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                if (cart.length > 0 && !confirm('¿Reemplazar el carrito actual con la venta pausada?')) return;
                                resumeHeldCart();
                            }}
                            className="text-amber-700 border-amber-300 hover:bg-amber-100 font-bold gap-1 h-7 text-xs"
                        >
                            <PlayCircle size={13} /> Retomar
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { if (confirm('¿Descartar la venta pausada?')) discardHeldCart(); }}
                            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 h-7 text-xs"
                        >
                            Descartar
                        </Button>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row flex-1 overflow-hidden gap-4 p-4">
                {isExpressMode ? (
                    /* ===== MODO EXPRESS ===== */
                    <>
                        {/* Centro: búsqueda grande + historial de última búsqueda */}
                        <div className="flex-1 min-w-0 h-full flex flex-col gap-4">
                            <ExpressSearch
                                onAddToCart={handleProductClick}
                                lookupProduct={lookupProduct}
                            />
                            {/* Hint visual */}
                            <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 rounded-2xl text-indigo-500 text-sm font-semibold">
                                <Zap size={16} className="shrink-0" />
                                Modo Express activo — escanea o escribe para agregar productos al instante.
                                <button onClick={handleToggleExpressMode} className="ml-auto text-xs underline text-indigo-400 hover:text-indigo-600">
                                    Volver al POS completo
                                </button>
                            </div>
                        </div>
                        {/* Derecha: carrito normal (igual que modo completo) */}
                        <div className="md:w-[400px] lg:w-[450px] flex-none h-full z-10 w-full hidden md:block">
                            <POSCart
                                cartItems={cart}
                                onRemoveItem={removeFromCart}
                                onUpdateQuantity={updateQuantity}
                                onClearCart={() => { if (confirm('¿Vaciar carrito?')) clearCart(); }}
                                totals={{ totalUSD, totalBs }}
                                totalsByCurrency={totalsByCurrency}
                                anchorCurrency={anchorCurrency}
                                onCheckout={() => setIsPaymentOpen(true)}
                                onItemClick={(item) => setSelectedItemForEdit(item)}
                                secondaryCurrency={secondaryCurrency}
                                convertPrice={convertPrice}
                            />
                        </div>
                    </>
                ) : (
                    /* ===== MODO COMPLETO (original) ===== */
                    <>
                        {/* SECCIÓN IZQUIERDA: CATÁLOGO */}
                        <div className="flex-1 min-w-0 h-full">
                            <POSCatalog
                                ref={catalogRef}
                                products={displayProducts}
                                categories={rootCategories}
                                loading={isLoading || catalogLoading}
                                onAddToCart={handleProductClick}
                                onSearch={handleSearchChange}
                                onFilterCategory={setSelectedCategory}
                                selectedCategoryId={selectedCategory}
                                searchTerm={searchTerm}
                                currencySymbol={anchorCurrency.symbol}
                                // Secondary Currency Props
                                secondaryCurrency={secondaryCurrency}
                                secondaryCurrencies={secondaryCurrencies}
                                convertProductPrice={convertProductPrice}
                                showSecondaryPrice={showSecondaryPrice}
                                // Server-side pagination props
                                onLoadMore={loadMore}
                                hasMore={hasMore}
                                isLoadingMore={isLoadingMore}
                                totalCount={totalProducts}
                                onSearchChange={setServerSearch}
                                onCategoryChange={setServerCategory}
                            />
                        </div>

                        {/* SECCIÓN DERECHA: CARRITO (Fixed Width on Desktop) */}
                        <div className="md:w-[400px] lg:w-[450px] flex-none h-full z-10 w-full hidden md:block">
                            <POSCart
                                cartItems={cart}
                                onRemoveItem={removeFromCart}
                                onUpdateQuantity={updateQuantity}
                                onClearCart={() => {
                                    if (confirm('¿Vaciar carrito?')) clearCart();
                                }}
                                totals={{ totalUSD, totalBs }}
                                totalsByCurrency={totalsByCurrency}
                                anchorCurrency={anchorCurrency}
                                onCheckout={() => setIsPaymentOpen(true)}
                                onItemClick={(item) => setSelectedItemForEdit(item)}
                                secondaryCurrency={secondaryCurrency}
                                convertPrice={convertPrice}
                            />
                        </div>
                    </>
                )}

                {/* MOBILE CART: Floating Button + Sheet */}
                <div className="fixed bottom-20 right-4 md:hidden z-50">
                    {cart.length > 0 && (
                        <Button
                            size="icon"
                            className="rounded-full h-14 w-14 shadow-xl bg-indigo-600 text-white hover:bg-indigo-700 relative"
                            onClick={() => setIsMobileCartOpen(true)}
                        >
                            <ShoppingCart size={22} />
                            <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-xs font-black rounded-full h-6 w-6 flex items-center justify-center shadow-md">
                                {cart.reduce((sum, item) => sum + item.quantity, 0)}
                            </span>
                        </Button>
                    )}
                </div>

                {/* Mobile Cart Sheet */}
                <Sheet open={isMobileCartOpen} onOpenChange={setIsMobileCartOpen}>
                    <SheetContent side="bottom" className="h-[85vh] p-0 rounded-t-2xl">
                        <SheetHeader className="px-4 pt-4 pb-2 border-b border-slate-100">
                            <SheetTitle className="text-lg font-black text-slate-800">Carrito ({cart.length})</SheetTitle>
                        </SheetHeader>
                        <div className="flex-1 overflow-y-auto h-[calc(85vh-60px)]">
                            <POSCart
                                cartItems={cart}
                                onRemoveItem={removeFromCart}
                                onUpdateQuantity={updateQuantity}
                                onClearCart={() => {
                                    if (confirm('¿Vaciar carrito?')) clearCart();
                                }}
                                totals={{ totalUSD, totalBs }}
                                totalsByCurrency={totalsByCurrency}
                                anchorCurrency={anchorCurrency}
                                onCheckout={() => { setIsMobileCartOpen(false); setIsPaymentOpen(true); }}
                                onItemClick={(item) => { setIsMobileCartOpen(false); setSelectedItemForEdit(item); }}
                                secondaryCurrency={secondaryCurrency}
                                convertPrice={convertPrice}
                            />
                        </div>
                    </SheetContent>
                </Sheet>

                {/* --- MODALS --- */}
                <POSSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
                <UnitSelectionModal isOpen={!!selectedProductForUnits} product={selectedProductForUnits} onClose={() => setSelectedProductForUnits(null)} onSelect={handleUnitSelect} />
                <EditItemModal
                    isOpen={!!selectedItemForEdit}
                    item={selectedItemForEdit}
                    onClose={() => setSelectedItemForEdit(null)}
                    onUpdate={handleUpdateItem}
                    onDelete={removeFromCart}
                    priceLists={priceLists}
                    onPriceListSelect={handlePriceListSelect}
                />

                <EmployeeSelectionModal
                    isOpen={isEmployeeModalOpen}
                    onClose={() => setIsEmployeeModalOpen(false)}
                    employees={employees}
                    onSelect={handleEmployeeSelect}
                />

                <PaymentModal
                    isOpen={isPaymentOpen}
                    onClose={() => { setIsPaymentOpen(false); focusSearch(); }}
                    totalUSD={totalUSD}
                    totalBs={totalBs}
                    totalsByCurrency={totalsByCurrency}
                    cart={cart}
                    onConfirm={handleCheckout}
                    warehouseId={selectedWarehouseId}
                    initialCustomer={quoteCustomer}
                    quoteId={activeQuoteId}
                    customSubmit={activeServiceOrderId ? handleServiceCheckoutSubmit : null}
                    discountUSD={discountUSD || 0}
                    cartDiscount={cartDiscount}
                />

                <PinAuthModal isOpen={pinModalOpen} onClose={() => { setPinModalOpen(false); setPendingPriceUpdate(null); setActivePricePopover(null); }} onSuccess={handlePinSuccess} title="Autorización Requerida" message="Ingrese PIN de supervisor." />
                <SerializedItemModal isOpen={!!selectedProductForSerialized} product={selectedProductForSerialized} quantity={0} onClose={() => setSelectedProductForSerialized(null)} onConfirm={handleSerializedConfirm} />
                <ServiceImportModal isOpen={isServiceImportOpen} onClose={() => setIsServiceImportOpen(false)} onSelect={handleServiceOrderSelect} />
                <CashMovementModal isOpen={isMovementOpen} onClose={() => { setIsMovementOpen(false); focusSearch(); }} />
                <CashAdvanceModal isOpen={isAdvanceOpen} onClose={() => setIsAdvanceOpen(false)} />
                <SaleSuccessModal isOpen={!!lastSaleData} saleData={lastSaleData} onClose={handleSuccessClose} />
                {!isLoading && !isCashLoading && !isSessionOpen && (<CashOpeningModal onOpen={openSession} />)}
                <CashClosingModal isOpen={isClosingOpen} onClose={() => setIsClosingOpen(false)} />
            </div>
        </div >
    );
};

export default POS;
