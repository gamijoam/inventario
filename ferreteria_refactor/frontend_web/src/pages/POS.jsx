import { useAuth } from '../context/AuthContext';
import { useFeatureFlag } from '../hooks/useFeatureFlag';
import HelpDrawer, { HelpButton } from '../help/HelpDrawer';
import { useHelp } from '../help/useHelp';
import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, ArrowRightLeft, Banknote, Lock, ShoppingCart, PauseCircle, PlayCircle, Zap, Layers, Settings as SettingsIcon, Users, Building2, LayoutGrid, Image, Search, ChevronDown } from 'lucide-react';
import CashClosingModal from '../components/cash/CashClosingModal';

import { useHotkeys } from 'react-hotkeys-hook';
import { Button } from '../components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { useCart } from '../context/CartContext';
import { useCash } from '../context/CashContext';
import { useConfig } from '../context/ConfigContext';
import { useWebSocket } from '../context/WebSocketContext';
import { Link, useSearchParams } from 'react-router-dom';
import { cn } from '../lib/utils';

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
import ProductLookupModal from '../components/pos/ProductLookupModal';
import useBarcodeScanner from '../hooks/useBarcodeScanner';
import SplitCartModal from '../components/pos/SplitCartModal';
import usePOSCatalog from '../hooks/usePOSCatalog';
import ServiceImportModal from './POS/ServiceImportModal';
import SerializedItemModal from '../components/pos/SerializedItemModal';
import POSSettingsModal from '../components/pos/POSSettingsModal';
import PinAuthModal from '../components/common/PinAuthModal';
import EmployeeSelectionModal from '../components/pos/EmployeeSelectionModal';
import { DEFAULT_THEME, POS_THEMES } from '../constants/posThemes';

import apiClient from '../config/axios';
import { toast } from 'react-hot-toast';
import { getApiErrorMessage } from '../utils/apiErrors';

// Helper to format stock: show as integer if whole number, otherwise show decimals
const formatStock = (stock) => {
    const num = Number(stock);
    return num % 1 === 0 ? num.toFixed(0) : num.toFixed(3).replace(/\.?0+$/, '');
};

const POS = () => {
    const { user, updateUserPreferences } = useAuth();
    const { cart, addToCart, removeFromCart, updateQuantity, updateCartItem, clearCart, totalUSD, totalBs, totalsByCurrency, exchangeRates, discountUSD, cartDiscount, heldCart, holdCart, resumeHeldCart, discardHeldCart, overwriteCart } = useCart();
    const { isSessionOpen, openSession, loading: isCashLoading } = useCash();
    const { getActiveCurrencies, getPrimaryLocalCurrency, convertPrice, convertProductPrice, currencies, modules, formatCurrency, posSettings, priceLists, posCategories, posWarehouses } = useConfig();
    const { subscribe } = useWebSocket();
    const {
        products: displayProducts, isLoading: catalogLoading, isLoadingMore,
        hasMore, total: totalProducts, loadMore, setSearch: setServerSearch,
        setCategoryId: setServerCategory, lookupProduct, getFromCache, refreshProduct,
        mergeProductUpdate, applyStockUpdate, removeProductFromCatalog
    } = usePOSCatalog();
    const anchorCurrency = currencies.find(c => c.is_anchor) || { symbol: '$' };

    // Toggle por moneda: { VES: true, COP: false } — default ON para todas
    const help = useHelp();
    const helpKey = 'pos';
    const [showCurrencies, setShowCurrencies] = useState(() => {
        try {
            const s = localStorage.getItem('pos_show_currencies');
            return s ? JSON.parse(s) : {};
        } catch { return {}; }
    });
    
    // Config por tenant: viene de ConfigContext (/config/pos-init cacheado en Redis).
    const posShowBs = posSettings?.pos_show_bs !== false;
    useEffect(() => {
        const listId = posSettings?.pos_default_price_list_id || '';
        if (listId) localStorage.setItem('pos_default_price_list_id', listId);
        else localStorage.removeItem('pos_default_price_list_id');
    }, [posSettings?.pos_default_price_list_id]);

    const isCurrencyVisible = (code) => showCurrencies[code] !== false;
    const toggleCurrency = (code) => {
        setShowCurrencies(prev => {
            const next = { ...prev, [code]: !isCurrencyVisible(code) };
            localStorage.setItem('pos_show_currencies', JSON.stringify(next));
            return next;
        });
    };
    const secondaryCurrency = getPrimaryLocalCurrency() || null;
    // Deduplicar por currency_code (evita duplicados si hay 2 entradas VES en BD)
    const secondaryCurrencies = [...new Map(
        getActiveCurrencies()
            .filter(c => !c.is_anchor && c.currency_code !== 'USD')
            .map(c => [c.currency_code, c])
    ).values()];
    // Solo las monedas que el usuario habilitó
    const visibleSecondaryCurrencies = posShowBs
        ? secondaryCurrencies.filter(c => isCurrencyVisible(c.currency_code))
        : [];  // Si la config del tenant oculta Bs, no mostrar monedas secundarias
    const showSecondaryPrice = visibleSecondaryCurrencies.length > 0;

    // Theme State - Resolve by ID to ensure latest styles
    const themeId = user?.preferences?.pos_theme?.id || 'default';
    const currentTheme = POS_THEMES.find(t => t.id === themeId) || DEFAULT_THEME;
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Express Mode State
    const isExpressMode = user?.preferences?.pos_mode === 'express';
    const isCashier = user?.role === 'CASHIER';
    const [simpleMode, setSimpleMode] = useState(() => user?.preferences?.pos_simple_mode === true);
    const showCreditosExternos  = useFeatureFlag('creditos_externos');

    const handleToggleSimpleMode = async () => {
        const next = !simpleMode;
        try {
            await updateUserPreferences({ pos_simple_mode: next });
        } catch {}
        toast(
            next ? '✅ Modo Sencillo activado — recarga para aplicar' : '🖼️ Modo Normal activado — recarga para aplicar',
            { icon: null, duration: 4000,
              style: { fontWeight: 700, borderRadius: '12px', padding: '12px 16px' } }
        );
        setTimeout(() => window.location.reload(), 1500);
    };
    const showCajeroRestringido = useFeatureFlag('cajero_restringido_pos');
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
    const [isSplitCartModalOpen, setIsSplitCartModalOpen] = useState(false);
    const [pendingCreditItems, setPendingCreditItems] = useState(null);
    const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
    const [isMovementOpen, setIsMovementOpen] = useState(false);
    const [isAdvanceOpen, setIsAdvanceOpen] = useState(false);
    const [isClosingOpen, setIsClosingOpen] = useState(false);
    const [lastSaleData, setLastSaleData] = useState(null);
    const [isLookupOpen, setIsLookupOpen] = useState(false);
    const [selectedProductIndex, setSelectedProductIndex] = useState(-1);
    const [quoteCustomer, setQuoteCustomer] = useState(null);
    const [activeQuoteId, setActiveQuoteId] = useState(null);

    // NEW: Price Lists & Security State
    const [pinModalOpen, setPinModalOpen] = useState(false);
    const [pendingPriceUpdate, setPendingPriceUpdate] = useState(null); // { itemId, price, listId }
    const [activePricePopover, setActivePricePopover] = useState(null); // itemId

    // NEW: Service Order Integration
    const [isServiceImportOpen, setIsServiceImportOpen] = useState(false);
    const [activeServiceOrderId, setActiveServiceOrderId] = useState(null);
    const [serviceOrderTicket, setServiceOrderTicket] = useState(null);
    const [selectedProductForSerialized, setSelectedProductForSerialized] = useState(null);
    // Combo con componentes serializados
    const [comboImeiQueue, setComboImeiQueue] = useState([]); // [{product, qty, index}]
    const [comboImeiCollected, setComboImeiCollected] = useState({}); // {product_id: [serials]}
    const [pendingComboProduct, setPendingComboProduct] = useState(null); // combo padre
    const [selectedProductForEmployee, setSelectedProductForEmployee] = useState(null);
    const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);

    // Data State
    const categories = posCategories || [];
    const warehouses = posWarehouses || [];
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
    const [employees, setEmployees] = useState([]);
    const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
    const [selectedSalespersonId, setSelectedSalespersonId] = useState(''); // NEW: Global Salesperson

    const [isLoading, setIsLoading] = useState(true);

    const handleSearchChange = useCallback((value) => {
        setSearchTerm(value); // Update input immediately for responsiveness
    }, []);


    // Refs
    const catalogRef = useRef(null);
    const employeesLoadedRef = useRef(false);

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
            handleCheckoutClick();
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

    // Alt+B: Product Lookup Modal (estándar de buscadores)
    useHotkeys('alt+b', (e) => {
        e.preventDefault();
        setIsLookupOpen(prev => !prev);
    }, { enableOnFormTags: true, preventDefault: true });

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
            // Si viene de búsqueda por IMEI, validar que no esté vendido
            if (foundProduct._imei_status === 'SOLD') {
                toast.error(`❌ IMEI ${foundProduct._imei} ya fue vendido`, { duration: 3000 });
                return;
            }
            handleProductClick(foundProduct);
            // Si tiene IMEI, pre-llenar el serial en el carrito
            if (foundProduct._imei) {
                toast.success(`📱 ${foundProduct.name} — IMEI: ${foundProduct._imei}`, { duration: 2000 });
            }
        } else {
            toast.error(`Producto no encontrado: ${code}`, { duration: 2000 });
        }
    };

    useBarcodeScanner(handleGlobalScan, {
        minLength: 3,
        maxTimeBetweenKeys: 50,
        enabled: !pinModalOpen && !selectedProductForSerialized && !isPaymentOpen && !isSettingsOpen && !isLookupOpen
    });


    useEffect(() => {
        // ... (Existing Fetch Data) ...
        const fetchData = async () => {
            // Check session status first
            // ... (keep implies simple update, but replacing block)
            // Assuming session check is handled by context/other logic or implicit here

            try {
                setSelectedWarehouseId('all');


                if (modules?.services) {
                    // Other service-specific logic if any
                }
            } catch (e) { console.error(e); }
            setIsLoading(false);
        };
        fetchData();
    }, [modules]);

    // WebSocket: real-time product updates without refetching each changed item
    useEffect(() => {
        const unsubUpdate = subscribe('product:updated', mergeProductUpdate);
        const unsubStock = subscribe('product:stock_updated', applyStockUpdate);
        const unsubDelete = subscribe('product:deleted', removeProductFromCatalog);
        return () => {
            if (unsubUpdate) unsubUpdate();
            if (unsubStock) unsubStock();
            if (unsubDelete) unsubDelete();
        };
    }, [subscribe, mergeProductUpdate, applyStockUpdate, removeProductFromCatalog]);

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
                const product = item.product || getFromCache(item.product_id) || await lookupProduct(item.product_id);
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
            toast.error(getApiErrorMessage(error, "No se pudo cargar la cotizacion"));
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

    const loadEmployees = useCallback(async () => {
        if (employeesLoadedRef.current || isLoadingEmployees) return;
        setIsLoadingEmployees(true);
        try {
            const { data } = await apiClient.get('/employees', { _silent403: true, _silentNetworkError: true });
            setEmployees(Array.isArray(data) ? data.filter(e => e.status === 'ACTIVE' || e.is_active) : []);
            employeesLoadedRef.current = true;
        } catch {
            setEmployees([]);
        } finally {
            setIsLoadingEmployees(false);
        }
    }, [isLoadingEmployees]);

    const handleProductClick = async (product) => {
        // Bug [006] fix: clear search text and keep focus on search bar
        setSearchTerm('');
        if (catalogRef.current) {
            catalogRef.current.clearAndFocusSearch();
        }

        const productForSale = product.is_combo
            ? (await refreshProduct(product.id)) || product
            : product;

        // NEW: Barbershop Service check
        if (productForSale.is_barbershop_service) {
            setSelectedProductForEmployee(productForSale);
            setIsEmployeeModalOpen(true);
            loadEmployees();
            return;
        }

        if (productForSale.has_imei) {
            setSelectedProductForSerialized(productForSale);
            return;
        }

        // Combo con componentes serializados
        if (productForSale.is_combo && productForSale.combo_items?.some(ci => ci.child_product?.has_imei)) {
            const serializedComponents = productForSale.combo_items
                .filter(ci => ci.child_product?.has_imei)
                .map(ci => ({
                    product: ci.child_product,
                    qty: Math.ceil(ci.quantity),
                    combo_item_id: ci.id
                }));
            setPendingComboProduct(productForSale);
            setComboImeiCollected({});
            setComboImeiQueue(serializedComponents);
            return;
        }

        if (productForSale.units?.length > 0) {
            setSelectedProductForUnits(productForSale);
        } else {
            addBaseProductToCart(productForSale);
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

    // ── Combo IMEI: confirmar serial de un componente y avanzar al siguiente ──
    const handleComboComponentSerialConfirm = (serials) => {
        if (comboImeiQueue.length === 0) return;
        const current = comboImeiQueue[0];
        const newCollected = {
            ...comboImeiCollected,
            [String(current.product.id)]: serials
        };
        const remaining = comboImeiQueue.slice(1);

        if (remaining.length > 0) {
            // Hay más componentes serializados -- pedir el siguiente
            setComboImeiCollected(newCollected);
            setComboImeiQueue(remaining);
        } else {
            // Todos los seriales recolectados -- agregar el combo al carrito
            setComboImeiQueue([]);
            setComboImeiCollected({});
            if (pendingComboProduct) {
                addToCart(pendingComboProduct, {
                    name: 'Unidad',
                    price_usd: parseFloat(pendingComboProduct.price),
                    factor: 1,
                    is_base: true,
                    combo_serials: newCollected,
                    salesperson_id: selectedSalespersonId || null
                });
                setPendingComboProduct(null);
                focusSearch();
            }
        }
    };

    const handleCancelComboImei = () => {
        setComboImeiQueue([]);
        setComboImeiCollected({});
        setPendingComboProduct(null);
    };

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
            if (item.product_id) product = item.product || getFromCache(item.product_id) || await lookupProduct(item.product_id);
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

    
    const handleCheckoutClick = () => {
        const imeiItems = cart.filter(item => item.has_imei === true || item.product?.requires_imei === true || item.requires_imei === true);
        const hasNonIMEI = cart.some(item => !item.has_imei && !item.product?.requires_imei && !item.requires_imei);
        
        const hasMultipleIMEI = imeiItems.length > 1;

        if (hasNonIMEI && imeiItems.length > 0) {
            // Caso 1: Mixto (Accesorios + Celulares)
            setIsSplitCartModalOpen(true);
        } else if (hasMultipleIMEI) {
            // Caso 2: Múltiples Celulares (Deben ir uno por uno)
            import("react-hot-toast").then(m => m.toast.loading("Procesando dispositivos uno por uno...", { duration: 3000 }));
            handleSplitCart(); // Reutilizamos la lógica de split
        } else {
            setIsPaymentOpen(true);
        }
    };

    const handleSplitCart = () => {
        const imeiItems = cart.filter(item => item.product?.requires_imei || item.requires_imei || item.has_imei);
        const nonImeiItems = cart.filter(item => !(item.product?.requires_imei || item.requires_imei || item.has_imei));

        if (nonImeiItems.length > 0 && imeiItems.length > 0) {
            // Prioridad: Sacar accesorios primero (contado)
            setPendingCreditItems(imeiItems);
            overwriteCart(nonImeiItems);
        } else if (imeiItems.length > 1) {
            // Si solo hay teléfonos, dejamos el primero y mandamos el resto a la cola
            const firstPhone = imeiItems[0];
            const restOfPhones = imeiItems.slice(1);
            setPendingCreditItems(restOfPhones);
            overwriteCart([firstPhone]);
        }
        
        setIsSplitCartModalOpen(false);
        setIsPaymentOpen(true);
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
            const soldProductIds = [...new Set(lastSaleData.cart
                .map(item => item.product_id)
                .filter(Boolean))];
            soldProductIds.forEach(productId => refreshProduct(productId));
        }
        setLastSaleData(null);
        clearCart();
        const toRestore = pendingCreditItems;
        if (toRestore && toRestore.length > 0) {
            setPendingCreditItems(null);
            setTimeout(() => {
                overwriteCart(toRestore);
                import("react-hot-toast").then(m => m.toast.success("Teléfono restaurado para facturar a crédito"));
            }, 600);
        }
        setActiveServiceOrderId(null);
        setServiceOrderTicket(null);
        setQuoteCustomer(null);
    };

    // NEW: Price List Logic
    const handlePriceListSelect = async (list, item) => {
        // null list = revert to base price
        if (!list) {
            const itemProduct = getFromCache(item.product_id);
            const basePrice = itemProduct ? parseFloat(itemProduct.price) : item.unit_price_usd;
            updateCartItem(item.id, { unit_price_usd: basePrice, price_list_id: null, price_list_name: null, auth_user_id: null });
            toast.success('Precio revertido al precio base');
            return;
        }

        let itemProduct = getFromCache(item.product_id);
        let priceEntry = itemProduct?.prices?.find(p => p.price_list_id === list.id);

        // Si el cache no tiene precio para esta lista, refrescar del servidor
        // (evita falsos "no tiene lista" por cache desactualizado)
        if (!priceEntry) {
            const fresh = await refreshProduct(item.product_id);
            if (fresh) {
                itemProduct = fresh;
                priceEntry = fresh?.prices?.find(p => p.price_list_id === list.id);
            }
        }

        let newPrice = priceEntry ? parseFloat(priceEntry.price) : null;

        if (newPrice === null) {
            toast.error("Este producto no tiene precio asignado en esta lista");
            return;
        }

        if (list.requires_auth) {
            setPendingPriceUpdate({ itemId: item.id, price: newPrice, listId: list.id, listName: list.name });
            setPinModalOpen(true);
        } else {
            updateCartItem(item.id, { unit_price_usd: newPrice, price_list_id: list.id, price_list_name: list.name, auth_user_id: null });
            setActivePricePopover(null);
            toast.success(`Precio actualizado a lista: ${list.name}`);
        }
    };

    const handlePinSuccess = (userId) => {
        if (pendingPriceUpdate) {
            updateCartItem(pendingPriceUpdate.itemId, {
                unit_price_usd: pendingPriceUpdate.price,
                price_list_id: pendingPriceUpdate.listId,
                price_list_name: pendingPriceUpdate.listName,
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
                    <div className="hidden md:flex flex-col">
                        <h1 className="text-base font-black text-slate-800 tracking-tight leading-none">Punto de Venta</h1>
                        {user && (
                            <span className="text-sm font-bold text-slate-500 mt-1 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                                {user.full_name || user.username || user.email}
                            </span>
                        )}
                    </div>
                        <HelpButton contextKey={helpKey} onClick={help.open} />
                </div>

                <div className="flex items-center gap-2 md:gap-3">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="hidden md:flex h-9 gap-2 rounded-xl border-slate-200 bg-white px-3 font-black text-slate-700 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200"
                            >
                                <Banknote size={16} />
                                Caja
                                <ChevronDown size={14} className="text-slate-400" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-xl border-slate-200 p-1.5 shadow-xl">
                            <DropdownMenuLabel className="px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Acciones de caja
                            </DropdownMenuLabel>
                            {!(isCashier && showCajeroRestringido) && (
                                <>
                                    <DropdownMenuItem
                                        onClick={() => setIsMovementOpen(true)}
                                        className="cursor-pointer rounded-lg py-2 font-bold text-slate-700 focus:bg-indigo-50 focus:text-indigo-700"
                                    >
                                        <ArrowRightLeft size={15} className="mr-2 text-indigo-500" />
                                        Movimientos
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => setIsAdvanceOpen(true)}
                                        className="cursor-pointer rounded-lg py-2 font-bold text-slate-700 focus:bg-emerald-50 focus:text-emerald-700"
                                    >
                                        <Banknote size={15} className="mr-2 text-emerald-500" />
                                        Avance
                                    </DropdownMenuItem>
                                </>
                            )}
                            {!heldCart && (
                                <DropdownMenuItem
                                    id="tour-pos-hold-btn"
                                    onClick={holdCart}
                                    disabled={cart.length === 0}
                                    className="cursor-pointer rounded-lg py-2 font-bold text-amber-700 focus:bg-amber-50 focus:text-amber-700"
                                    title={cart.length === 0 ? 'Agrega productos para pausar la venta' : 'Pausar venta y atender otro cliente (F6)'}
                                >
                                    <PauseCircle size={15} className="mr-2 text-amber-500" />
                                    Pausar venta
                                    <span className="ml-auto text-[10px] text-amber-400">F6</span>
                                </DropdownMenuItem>
                            )}
                            {!(isCashier && showCajeroRestringido) && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={() => {
                                            if (window.confirm('Desea cerrar la caja actual? Se generara un resumen de ventas.')) {
                                                setIsClosingOpen(true);
                                            }
                                        }}
                                        className="cursor-pointer rounded-lg py-2 font-bold text-rose-600 focus:bg-rose-50 focus:text-rose-700"
                                    >
                                        <Lock size={15} className="mr-2" />
                                        Cerrar caja
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Buscador rapido F1 - siempre visible */}
                    <button
                        onClick={() => setIsLookupOpen(true)}
                        className="flex h-9 items-center gap-1.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold text-xs transition-all border border-indigo-200"
                        title="Buscador de productos (Alt+B)"
                    >
                        <Search size={15} />
                        <span className="hidden sm:block">Buscar</span>
                        <kbd className="text-[9px] font-mono text-indigo-300 bg-indigo-100 px-1 rounded hidden lg:block">Alt+B</kbd>
                    </button>

                    {/* Ordenes - oculto temporalmente para todos */}

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

                    {/* Pills por moneda — activa/desactiva cada una en tarjetas */}
                    {secondaryCurrencies.length > 0 && (
                        <div className="hidden md:flex items-center gap-1">
                            {secondaryCurrencies.map(c => (
                                <button
                                    key={c.currency_code}
                                    onClick={() => toggleCurrency(c.currency_code)}
                                    title={isCurrencyVisible(c.currency_code) ? `Ocultar precios en ${c.currency_symbol}` : `Mostrar precios en ${c.currency_symbol}`}
                                    className={`text-xs font-black px-2.5 py-1 rounded-full transition-all ${
                                        isCurrencyVisible(c.currency_code)
                                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                            : 'text-slate-400 bg-slate-100 hover:bg-slate-200 line-through'
                                    }`}
                                >
                                    {c.currency_symbol}
                                </button>
                            ))}
                        </div>
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

            <div className="flex flex-col md:flex-row flex-1 overflow-hidden gap-2 p-2 lg:gap-3 lg:p-3">
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
                        <div className="md:w-[300px] lg:w-[330px] xl:w-[360px] 2xl:w-[390px] flex-none h-full z-10 w-full hidden md:block">
                            <POSCart
                                cartItems={cart}
                                onRemoveItem={removeFromCart}
                                onUpdateQuantity={updateQuantity}
                                onClearCart={() => { if (confirm('¿Vaciar carrito?')) clearCart(); }}
                                totals={{ totalUSD, totalBs }}
                                totalsByCurrency={totalsByCurrency}
                                anchorCurrency={anchorCurrency}
                                onCheckout={() => handleCheckoutClick()}
                                onItemClick={(item) => setSelectedItemForEdit(item)}
                                secondaryCurrency={secondaryCurrency}
                                convertPrice={convertPrice}
                                priceLists={priceLists}
                                getFromCache={getFromCache}
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
                                secondaryCurrencies={visibleSecondaryCurrencies}
                                convertProductPrice={convertProductPrice}
                                showSecondaryPrice={showSecondaryPrice}
                                // Server-side pagination props
                                onLoadMore={loadMore}
                                hasMore={hasMore}
                                isLoadingMore={isLoadingMore}
                                totalCount={totalProducts}
                                onSearchChange={setServerSearch}
                                onCategoryChange={setServerCategory}
                                simpleMode={simpleMode}
                            />
                        </div>

                        {/* SECCIÓN DERECHA: CARRITO (Fixed Width on Desktop) */}
                        <div className="md:w-[300px] lg:w-[330px] xl:w-[360px] 2xl:w-[390px] flex-none h-full z-10 w-full hidden md:block">
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
                                onCheckout={() => handleCheckoutClick()}
                                onItemClick={(item) => setSelectedItemForEdit(item)}
                                secondaryCurrency={secondaryCurrency}
                                convertPrice={convertPrice}
                                priceLists={priceLists}
                                getFromCache={getFromCache}
                            />
                        </div>
                    </>
                )}

                {/* MOBILE CART: Floating Button + Sheet */}
                <div className="fixed bottom-20 right-4 md:hidden z-50">
                    {cart.length > 0 && (
                        <Button
                            size="icon"
                            className="h-12 min-h-12 w-auto rounded-full px-4 shadow-xl bg-indigo-600 text-white hover:bg-indigo-700 relative gap-2"
                            onClick={() => setIsMobileCartOpen(true)}
                        >
                            <ShoppingCart size={20} />
                            <span className="text-sm font-black tabular-nums">{anchorCurrency.symbol}{totalUSD.toFixed(2)}</span>
                            <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-xs font-black rounded-full h-6 w-6 flex items-center justify-center shadow-md">
                                {cart.reduce((sum, item) => sum + item.quantity, 0)}
                            </span>
                        </Button>
                    )}
                </div>

                {/* Mobile Cart Sheet */}
                <Sheet open={isMobileCartOpen} onOpenChange={setIsMobileCartOpen}>
                    <SheetContent side="bottom" className="h-[88vh] p-0 rounded-t-2xl">
                        <SheetHeader className="px-4 pt-3 pb-2 border-b border-slate-100">
                            <SheetTitle className="text-base font-black text-slate-800">Carrito ({cart.length})</SheetTitle>
                        </SheetHeader>
                        <div className="flex-1 overflow-y-auto h-[calc(88vh-54px)]">
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
                                onCheckout={() => { setIsMobileCartOpen(false); handleCheckoutClick(); }}
                                onItemClick={(item) => { setIsMobileCartOpen(false); setSelectedItemForEdit(item); }}
                                secondaryCurrency={secondaryCurrency}
                                convertPrice={convertPrice}
                                priceLists={priceLists}
                                getFromCache={getFromCache}
                            />
                        </div>
                    </SheetContent>
                </Sheet>

                {/* --- MODALS --- */}
                <POSSettingsModal
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    secondaryCurrencies={secondaryCurrencies}
                    isCurrencyVisible={isCurrencyVisible}
                    onToggleCurrency={toggleCurrency}
                />
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
                    loading={isLoadingEmployees}
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

                {/* Modal seriales para componentes de combo */}
                <SerializedItemModal
                    isOpen={comboImeiQueue.length > 0}
                    product={comboImeiQueue[0]?.product || null}
                    quantity={comboImeiQueue[0]?.qty || 1}
                    onClose={handleCancelComboImei}
                    onConfirm={handleComboComponentSerialConfirm}
                    title={`Componente del combo: ${pendingComboProduct?.name || ''}`}
                    subtitle={`Paso ${Object.keys(comboImeiCollected).length + 1} de ${(Object.keys(comboImeiCollected).length) + comboImeiQueue.length}`}
                />
                <ServiceImportModal isOpen={isServiceImportOpen} onClose={() => setIsServiceImportOpen(false)} onSelect={handleServiceOrderSelect} />
                <CashMovementModal isOpen={isMovementOpen} onClose={() => { setIsMovementOpen(false); focusSearch(); }} />
                <CashAdvanceModal isOpen={isAdvanceOpen} onClose={() => setIsAdvanceOpen(false)} />
                <SaleSuccessModal isOpen={!!lastSaleData} saleData={lastSaleData} onClose={handleSuccessClose} />
                <ProductLookupModal isOpen={isLookupOpen} onClose={() => setIsLookupOpen(false)} />
                {!isLoading && !isCashLoading && !isSessionOpen && (<CashOpeningModal onOpen={openSession} />)}
                <SplitCartModal 
                    isOpen={isSplitCartModalOpen} 
                    onClose={() => setIsSplitCartModalOpen(false)} 
                    onSplit={handleSplitCart} 
                />
                <CashClosingModal isOpen={isClosingOpen} onClose={() => setIsClosingOpen(false)} />
            </div>
        {help.isOpen && <HelpDrawer contextKey={helpKey} onClose={help.close} />}
        </div >
    );
};

export default POS;
