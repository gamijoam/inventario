import { useAuth } from '../context/AuthContext';
import { useFeatureFlag } from '../hooks/useFeatureFlag';
import HelpDrawer, { HelpButton } from '../help/HelpDrawer';
import { useHelp } from '../help/useHelp';
import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, ArrowRightLeft, Banknote, Lock, ShoppingCart, PauseCircle, PlayCircle, Zap, Layers, Settings as SettingsIcon, Users, Building2, LayoutGrid, Image, Search, ChevronDown, CheckCircle2, Printer, ReceiptText, AlertTriangle, Calculator, X } from 'lucide-react';
import CashClosingModal from '../components/cash/CashClosingModal';

import { useHotkeys } from 'react-hotkeys-hook';
import { Button } from '../components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { useCart } from '../context/CartContext';
import { useCash } from '../context/CashContext';
import { useConfig } from '../context/ConfigContext';
import { useWebSocket } from '../context/WebSocketContext';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
import usePOSCatalog from '../hooks/usePOSCatalog';
import ServiceImportModal from './POS/ServiceImportModal';
import SerializedItemModal from '../components/pos/SerializedItemModal';
import POSSettingsModal from '../components/pos/POSSettingsModal';
import ReprintSalesSheet from '../components/pos/ReprintSalesSheet';
import LayawayCheckoutModal from '../components/pos/LayawayCheckoutModal';
import PinAuthModal from '../components/common/PinAuthModal';
import EmployeeSelectionModal from '../components/pos/EmployeeSelectionModal';
import { DEFAULT_THEME, POS_THEMES } from '../constants/posThemes';
import { PERMISSIONS } from '../config/permissions';

import apiClient from '../config/axios';
import { toast } from 'react-hot-toast';
import { getApiErrorMessage } from '../utils/apiErrors';
import printerService from '../services/printerService';

// Helper to format stock: show as integer if whole number, otherwise show decimals
const formatStock = (stock) => {
    const num = Number(stock);
    return num % 1 === 0 ? num.toFixed(0) : num.toFixed(3).replace(/\.?0+$/, '');
};

const POS = () => {
    const { user, updateUserPreferences, hasPermission } = useAuth();
    const { cart, addToCart, canAddToCart, removeFromCart, updateQuantity, updateCartItem, clearCart, totalUSD, totalBs, totalsByCurrency, exchangeRates, discountUSD, cartDiscount, heldCart, holdCart, resumeHeldCart, discardHeldCart, overwriteCart } = useCart();
    const { isSessionOpen, openSession, loading: isCashLoading, session, activeRegister, registers, selectStationRegister, fetchRegisters } = useCash();
    const { getActiveCurrencies, getPrimaryLocalCurrency, convertPrice, convertProductPrice, currencies, modules, formatCurrency, posSettings, priceLists, posCategories, posWarehouses, refreshConfig } = useConfig();
    const { subscribe } = useWebSocket();
    const {
        products: displayProducts, isLoading: catalogLoading, isLoadingMore,
        hasMore, total: totalProducts, loadMore, setSearch: setServerSearch,
        setCategoryId: setServerCategory, lookupProduct, getFromCache, refreshProduct,
        mergeProductUpdate, applyStockUpdate, removeProductFromCatalog
    } = usePOSCatalog();
    const anchorCurrency = currencies.find(c => c.is_anchor) || { symbol: '$' };
    const baseRegister = session?.register || activeRegister || null;
    const registerStatus = baseRegister
        ? registers.find(reg => Number(reg.id) === Number(baseRegister.id))
        : null;
    const currentRegister = registerStatus
        ? { ...baseRegister, ...registerStatus }
        : baseRegister;

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
        const selectedList = listId ? priceLists.find(l => String(l.id) === String(listId)) : null;
        localStorage.setItem('pos_base_currency_code', posSettings?.pos_base_currency_code || 'FLEX');
        localStorage.setItem('pos_base_payment_policy', posSettings?.pos_base_payment_policy || 'flexible');
        if (listId) {
            localStorage.setItem('pos_default_price_list_id', listId);
            if (selectedList) {
                localStorage.setItem('pos_default_price_list_name', selectedList.name || '');
                localStorage.setItem('pos_default_price_list_currency_code', selectedList.currency_code || 'FLEX');
                localStorage.setItem('pos_default_price_list_payment_policy', selectedList.payment_policy || 'flexible');
            }
        } else {
            localStorage.removeItem('pos_default_price_list_id');
            localStorage.removeItem('pos_default_price_list_name');
            localStorage.removeItem('pos_default_price_list_currency_code');
            localStorage.removeItem('pos_default_price_list_payment_policy');
        }
    }, [posSettings?.pos_default_price_list_id, posSettings?.pos_base_currency_code, posSettings?.pos_base_payment_policy, priceLists]);
    useEffect(() => {
        refreshConfig?.();
        const handleFocus = () => refreshConfig?.();
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, []);


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
    const [isReprintOpen, setIsReprintOpen] = useState(false);
    const [newReprintCount, setNewReprintCount] = useState(0);
    const [isRateCalculatorOpen, setIsRateCalculatorOpen] = useState(false);
    const [calculatorAmount, setCalculatorAmount] = useState('');
    const [calculatorMode, setCalculatorMode] = useState('USD_TO_LOCAL');

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
    const canApplyDiscount = hasPermission(PERMISSIONS.POS_DISCOUNT_APPLY);
    const canOverridePrice = hasPermission(PERMISSIONS.POS_PRICE_OVERRIDE);
    const canReprintTicket = hasPermission(PERMISSIONS.POS_REPRINT_TICKET);
    const canReprintWarranty = hasPermission(PERMISSIONS.POS_REPRINT_WARRANTY);
    const canCreateCashMovement = hasPermission(PERMISSIONS.CASH_MOVEMENTS_CREATE);
    const canCloseCash = hasPermission(PERMISSIONS.CASH_CLOSE_BLIND);
    const canCreateLayaway = hasPermission(PERMISSIONS.LAYAWAYS_CREATE);
    const handleToggleExpressMode = () => {
        updateUserPreferences({ pos_mode: isExpressMode ? 'full' : 'express' });
    };

    const calculatorCurrency = secondaryCurrency || secondaryCurrencies[0] || null;
    const calculatorRate = Number(calculatorCurrency?.rate || 0);
    const calculatorNumericAmount = Number(String(calculatorAmount || '').replace(',', '.')) || 0;
    const calculatorSymbol = calculatorCurrency?.currency_symbol || calculatorCurrency?.symbol || calculatorCurrency?.currency_code || 'Bs';
    const isCalculatorLocalToUsd = calculatorMode === 'LOCAL_TO_USD';
    const calculatorResult = calculatorRate > 0
        ? (isCalculatorLocalToUsd ? calculatorNumericAmount / calculatorRate : calculatorNumericAmount * calculatorRate)
        : 0;
    const calculatorInputSymbol = isCalculatorLocalToUsd ? calculatorSymbol : '$';
    const calculatorOutputSymbol = isCalculatorLocalToUsd ? '$' : calculatorSymbol;
    const calculatorInputLabel = isCalculatorLocalToUsd ? `Monto en ${calculatorSymbol}` : 'Monto en dolares';
    const calculatorPlaceholder = isCalculatorLocalToUsd ? '3000' : '80';
    const calculatorQuickAmounts = isCalculatorLocalToUsd ? [100, 500, 1000, 3000] : [10, 20, 50, 80];
    const formatCalculatorNumber = (value) => new Intl.NumberFormat('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number.isFinite(Number(value)) ? Number(value) : 0);
    const calculatorRateName = calculatorCurrency?.name || calculatorCurrency?.currency_code || 'Tasa activa';
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const quoteIdParam = searchParams.get('quote_id');

    useEffect(() => {
    }, [isSettingsOpen]);

    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedProductForUnits, setSelectedProductForUnits] = useState(null);
    const [selectedItemForEdit, setSelectedItemForEdit] = useState(null);
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [isLayawayOpen, setIsLayawayOpen] = useState(false);
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
        } else if (isLayawayOpen) {
            setIsLayawayOpen(false);
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
                    let unit = product.units?.filter(u => u.is_active !== false).find(u => u.unit_name === unitName);

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

    const getDefaultPriceListPatch = (product, unit = {}) => {
        const baseCurrencyCode = posSettings?.pos_base_currency_code || 'FLEX';
        const basePaymentPolicy = posSettings?.pos_base_payment_policy || 'flexible';
        const patch = {
            price_list_id: null,
            price_list_name: basePaymentPolicy === 'strict' && baseCurrencyCode !== 'FLEX' ? `Base ${baseCurrencyCode}` : null,
            price_list_currency_code: baseCurrencyCode,
            price_list_payment_policy: basePaymentPolicy,
        };

        const listId = posSettings?.pos_default_price_list_id || '';
        const selectedList = listId ? priceLists.find(l => String(l.id) === String(listId)) : null;
        if (!listId || !selectedList || !unit?.is_base || !Array.isArray(product?.prices)) {
            return patch;
        }

        const entry = product.prices.find(p => String(p.price_list_id) === String(listId));
        if (!entry || entry.price == null) return patch;

        return {
            ...patch,
            price_usd: parseFloat(entry.price),
            price_list_id: Number(listId),
            price_list_name: selectedList.name || entry.price_list?.name || null,
            price_list_currency_code: selectedList.currency_code || entry.price_list?.currency_code || 'FLEX',
            price_list_payment_policy: selectedList.payment_policy || entry.price_list?.payment_policy || 'flexible',
        };
    };

    const withDefaultPricePolicy = (product, unit = {}) => ({
        ...unit,
        ...getDefaultPriceListPatch(product, unit),
    });

    const baseSaleUnit = (product, extra = {}) => withDefaultPricePolicy(product, {
        name: 'Unidad',
        price_usd: parseFloat(product?.price || 0),
        factor: 1,
        is_base: true,
        ...extra,
    });

    const showStockBlockedToast = (product, unit = null) => {
        const suffix = unit?.name && unit.name !== 'Unidad' ? ` (${unit.name})` : '';
        toast.error(`${product?.name || 'Producto'}${suffix} no tiene stock disponible`, { duration: 2600 });
    };

    const ensureCanAddProduct = (product, unit = null) => {
        const unitForCheck = unit || baseSaleUnit(product);
        if (canAddToCart(product, unitForCheck)) return true;
        showStockBlockedToast(product, unit);
        return false;
    };

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

        if (!ensureCanAddProduct(productForSale)) {
            return false;
        }

        // NEW: Barbershop Service check
        if (productForSale.is_barbershop_service) {
            setSelectedProductForEmployee(productForSale);
            setIsEmployeeModalOpen(true);
            loadEmployees();
            return true;
        }

        if (productForSale.has_imei) {
            setSelectedProductForSerialized(productForSale);
            return true;
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
            return true;
        }

        const activeUnits = (productForSale.units || []).filter(unit => unit.is_active !== false);
        if (activeUnits.length > 0) {
            setSelectedProductForUnits({ ...productForSale, units: activeUnits });
            return true;
        } else {
            return addBaseProductToCart(productForSale);
        }
    };

    const handleEmployeeSelect = (employee) => {
        if (!selectedProductForEmployee) return;

        const product = selectedProductForEmployee;

        // Add to cart with the selected employee
        addToCart(product, withDefaultPricePolicy(product, {
            name: 'Servicio',
            price_usd: parseFloat(product.price),
            factor: 1,
            is_base: true,
            employee_id: employee.id,
            salesperson_id: selectedSalespersonId || null
        }));

        setSelectedProductForEmployee(null);
        setIsEmployeeModalOpen(false);

        toast.success(`Asignado a: ${employee.name}`);
    };

    const addBaseProductToCart = (product) => {
        const unit = baseSaleUnit(product, { salesperson_id: selectedSalespersonId || null });
        if (!ensureCanAddProduct(product, unit)) return false;
        return addToCart(product, unit);
    };

    const handleUnitSelect = (unit) => {
        const selectedUnit = withDefaultPricePolicy(selectedProductForUnits, { ...unit, salesperson_id: selectedSalespersonId || null });
        if (!ensureCanAddProduct(selectedProductForUnits, selectedUnit)) return;
        addToCart(selectedProductForUnits, selectedUnit);
        setSelectedProductForUnits(null);
        focusSearch();
    }

    // ── Combo IMEI: confirmar serial de un componente y avanzar al siguiente ──
    const handleComboComponentSerialConfirm = (serials, serialDetails = []) => {
        if (comboImeiQueue.length === 0) return;
        const current = comboImeiQueue[0];
        const newCollected = {
            ...comboImeiCollected,
            [String(current.product.id)]: serials
        };
        const comboSerialDetails = {
            ...(pendingComboProduct?.combo_serial_details || {}),
            [String(current.product.id)]: serialDetails,
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
                addToCart(pendingComboProduct, withDefaultPricePolicy(pendingComboProduct, {
                    name: 'Unidad',
                    price_usd: parseFloat(pendingComboProduct.price),
                    factor: 1,
                    is_base: true,
                    combo_serials: newCollected,
                    combo_serial_details: comboSerialDetails,
                    salesperson_id: selectedSalespersonId || null
                }));
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

    const handleSerializedConfirm = (serials, serialDetails = []) => {
        if (!selectedProductForSerialized) return;

        serials.forEach(accSerial => {
            const detail = serialDetails.find(item => item.serial_number === accSerial) || {};
            const singleUnit = withDefaultPricePolicy(selectedProductForSerialized, {
                name: 'Unidad',
                price_usd: parseFloat(selectedProductForSerialized.price),
                factor: 1,
                is_base: true,
                serial_numbers: [accSerial],
                serial_details: detail.serial_number ? [detail] : [],
                unit_id: `IMEI-${accSerial}`,
                has_imei: true,
                color_name: detail.color_name || null,
                color_hex: detail.color_hex || null,
                salesperson_id: selectedSalespersonId || null
            });
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

    const handleTestPrinter = async () => {
        if (!currentRegister?.hardware_client_id) {
            toast.error('Esta caja no tiene un ID de impresora configurado.');
            return;
        }

        const now = new Date().toLocaleString('es-VE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        const payload = {
            template: [
                '================================',
                '      PRUEBA DE IMPRESORA',
                '================================',
                'Empresa: {{ business.name }}',
                'Caja: {{ register.code }} - {{ register.name }}',
                'Bridge: {{ register.hardware_client_id }}',
                'Usuario: {{ user.name }}',
                'Fecha: {{ test.date }}',
                '--------------------------------',
                'Si puedes leer esto, la impresora',
                'esta conectada correctamente.',
                '================================'
            ].join('\n'),
            context: {
                business: { name: user?.tenant_name || 'Mi Inventario' },
                register: {
                    code: currentRegister.code || 'Caja',
                    name: currentRegister.name || '',
                    hardware_client_id: currentRegister.hardware_client_id
                },
                user: { name: user?.full_name || user?.username || user?.email || 'Usuario' },
                test: { date: now }
            }
        };

        const loadingToast = toast.loading(`Probando ${currentRegister.hardware_client_id}...`);
        try {
            await printerService.printRaw(payload);
            toast.success('Prueba enviada a la impresora.', { id: loadingToast });
            fetchRegisters?.();
        } catch (error) {
            toast.error(error.message || 'No se pudo probar la impresora.', { id: loadingToast, duration: 7000 });
            fetchRegisters?.();
        }
    };

    
    const handleCheckoutClick = () => {
        if (!cart.length) {
            toast.error('Agrega al menos un producto para cobrar');
            return;
        }
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

    const handleLayawayCreated = (layaway) => {
        const reservedProductIds = [...new Set(cart.map(item => item.product_id).filter(Boolean))];
        reservedProductIds.forEach(productId => refreshProduct(productId));
        clearCart();
        setIsLayawayOpen(false);
        setIsMobileCartOpen(false);
        focusSearch();
        navigate('/sales-center?tab=apartados');
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
        setActiveServiceOrderId(null);
        setServiceOrderTicket(null);
        setQuoteCustomer(null);
    };

    const buildCartItemPricePatch = (cartItem, unitPrice, policyPatch, authUserId = null) => {
        const price = Number(unitPrice) || 0;
        const quantity = Number(cartItem.quantity) || 0;
        const exchangeRate = Number(cartItem.exchange_rate) || 1;
        const subtotalUsd = price * quantity;
        return {
            ...cartItem,
            ...policyPatch,
            unit_price_usd: price,
            subtotal_usd: subtotalUsd,
            subtotal_bs: subtotalUsd * exchangeRate,
            auth_user_id: authUserId,
        };
    };

    const resolveCartProduct = async (productId) => {
        let product = getFromCache(productId);
        if (!product || !Array.isArray(product.prices)) {
            product = await refreshProduct(productId);
        }
        return product;
    };

    const buildCartForPriceList = async (list) => {
        const baseCurrencyCode = posSettings?.pos_base_currency_code || 'FLEX';
        const basePaymentPolicy = posSettings?.pos_base_payment_policy || 'flexible';
        const unsupportedItems = [];
        const missingItems = [];
        const productCache = new Map();
        const nextCart = [];

        for (const cartItem of cart) {
            if (!cartItem.product_id || cartItem.is_service_mock) {
                unsupportedItems.push(cartItem.name || 'Item manual');
                continue;
            }

            if (cartItem.unit_id) {
                unsupportedItems.push(`${cartItem.name} (${cartItem.unit_name || 'presentacion'})`);
                continue;
            }

            let product = productCache.get(cartItem.product_id);
            if (!product) {
                product = await resolveCartProduct(cartItem.product_id);
                productCache.set(cartItem.product_id, product);
            }

            if (!product) {
                missingItems.push(cartItem.name || `Producto ${cartItem.product_id}`);
                continue;
            }

            if (!list) {
                const policyPatch = {
                    price_list_id: null,
                    price_list_name: basePaymentPolicy === 'strict' && baseCurrencyCode !== 'FLEX' ? `Base ${baseCurrencyCode}` : null,
                    price_list_currency_code: baseCurrencyCode,
                    price_list_payment_policy: basePaymentPolicy,
                };
                nextCart.push(buildCartItemPricePatch(cartItem, product.price ?? cartItem.unit_price_usd, policyPatch, null));
                continue;
            }

            const priceEntry = Array.isArray(product.prices)
                ? product.prices.find(p => String(p.price_list_id) === String(list.id))
                : null;

            if (!priceEntry || priceEntry.price == null) {
                missingItems.push(cartItem.name || product.name || `Producto ${cartItem.product_id}`);
                continue;
            }

            const policyPatch = {
                price_list_id: list.id,
                price_list_name: list.name,
                price_list_currency_code: list.currency_code || 'FLEX',
                price_list_payment_policy: list.payment_policy || 'flexible',
            };
            nextCart.push(buildCartItemPricePatch(cartItem, priceEntry.price, policyPatch, null));
        }

        if (unsupportedItems.length) {
            toast.error(`No se puede aplicar una lista global con items manuales o presentaciones: ${unsupportedItems.slice(0, 3).join(', ')}`);
            return null;
        }
        if (missingItems.length) {
            toast.error(`No se cambio la lista: faltan precios para ${missingItems.slice(0, 4).join(', ')}`);
            return null;
        }

        return nextCart;
    };

    // Price List Logic: la lista se aplica al carrito completo para no mezclar monedas.
    const handlePriceListSelect = async (list, item) => {
        if (!cart.length) return;

        const nextCart = await buildCartForPriceList(list);
        if (!nextCart) return;

        if (list?.requires_auth) {
            setPendingPriceUpdate({
                isBulk: true,
                cart: nextCart,
                listId: list.id,
                listName: list.name,
                currencyCode: list.currency_code || 'FLEX',
                paymentPolicy: list.payment_policy || 'flexible'
            });
            setPinModalOpen(true);
            return;
        }

        overwriteCart(nextCart);
        setSelectedItemForEdit(null);
        setActivePricePopover(null);
        toast.success(list ? `Lista aplicada a todo el carrito: ${list.name}` : 'Todo el carrito volvio al precio base');
    };

    const handlePinSuccess = (userId) => {
        if (pendingPriceUpdate) {
            if (pendingPriceUpdate.isBulk) {
                overwriteCart((pendingPriceUpdate.cart || []).map(item => ({ ...item, auth_user_id: userId })));
            } else {
                updateCartItem(pendingPriceUpdate.itemId, {
                    unit_price_usd: pendingPriceUpdate.price,
                    price_list_id: pendingPriceUpdate.listId,
                    price_list_name: pendingPriceUpdate.listName,
                    price_list_currency_code: pendingPriceUpdate.currencyCode || 'FLEX',
                    price_list_payment_policy: pendingPriceUpdate.paymentPolicy || 'flexible',
                    auth_user_id: userId
                });
            }
            setPendingPriceUpdate(null);
            setSelectedItemForEdit(null);
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
                            <span className="text-sm font-bold text-slate-500 mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                                {user.full_name || user.username || user.email}
                                {currentRegister && (
                                    <span className="ml-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-indigo-700">
                                        {currentRegister.code || currentRegister.name} / {currentRegister.hardware_client_id || 'sin impresora'}
                                    </span>
                                )}
                            </span>
                        )}
                    </div>
                        <HelpButton contextKey={helpKey} onClick={help.open} />
                </div>

                <div className="flex items-center gap-2 md:gap-3">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                id="tour-pos-cash-menu"
                                variant="outline"
                                size="sm"
                                className="hidden md:flex h-9 gap-2 rounded-xl border-slate-200 bg-white px-3 font-black text-slate-700 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200"
                            >
                                <Banknote size={16} />
                                {currentRegister?.code || 'Caja'}
                                {currentRegister?.hardware_client_id && (
                                    <span className={`h-2 w-2 rounded-full ${currentRegister?.print_connected ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                                )}
                                <ChevronDown size={14} className="text-slate-400" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-xl border-slate-200 p-1.5 shadow-xl">
                            <DropdownMenuLabel className="px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Acciones de caja
                            </DropdownMenuLabel>
                            {registers?.length > 0 && (
                                <>
                                    <DropdownMenuLabel className="px-2 pt-2 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Caja de esta terminal
                                    </DropdownMenuLabel>
                                    {registers.map((reg) => {
                                        const selected = Number(currentRegister?.id || activeRegister?.id) === Number(reg.id);
                                        const hasPrinter = Boolean(reg.hardware_client_id);
                                        const isPrinterConnected = Boolean(reg.print_connected);
                                        return (
                                            <DropdownMenuItem
                                                key={reg.id}
                                                onClick={async () => {
                                                    await selectStationRegister(reg);
                                                    toast.success(`Esta terminal usara ${reg.code || reg.name}${reg.hardware_client_id ? ' / ' + reg.hardware_client_id : ''}`);
                                                }}
                                                className="cursor-pointer rounded-lg py-2 font-bold text-slate-700 focus:bg-indigo-50 focus:text-indigo-700"
                                            >
                                                {selected ? (
                                                    <CheckCircle2 size={15} className="mr-2 text-emerald-500" />
                                                ) : (
                                                    <Printer size={15} className={hasPrinter ? 'mr-2 text-indigo-500' : 'mr-2 text-slate-300'} />
                                                )}
                                                <span className="min-w-0 flex-1 truncate">{reg.code || reg.name}</span>
                                                <span className={`ml-2 rounded-md px-1.5 py-0.5 text-[10px] font-black ${
                                                    !hasPrinter
                                                        ? 'bg-amber-50 text-amber-600'
                                                        : isPrinterConnected
                                                            ? 'bg-emerald-50 text-emerald-700'
                                                            : 'bg-rose-50 text-rose-600'
                                                }`}>
                                                    {reg.hardware_client_id || 'sin impresora'}
                                                </span>
                                            </DropdownMenuItem>
                                        );
                                    })}
                                    <DropdownMenuSeparator />
                                </>
                            )}
                            {currentRegister?.hardware_client_id && (
                                <>
                                    <DropdownMenuItem
                                        onClick={handleTestPrinter}
                                        className="cursor-pointer rounded-lg py-2 font-bold text-slate-700 focus:bg-indigo-50 focus:text-indigo-700"
                                    >
                                        <Printer size={15} className="mr-2 text-indigo-500" />
                                        Probar impresora
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                </>
                            )}
                            {canCreateCashMovement && (
                                <>
                                    <DropdownMenuItem
                                        id="tour-pos-cash-movement"
                                        onClick={() => setIsMovementOpen(true)}
                                        className="cursor-pointer rounded-lg py-2 font-bold text-slate-700 focus:bg-indigo-50 focus:text-indigo-700"
                                    >
                                        <ArrowRightLeft size={15} className="mr-2 text-indigo-500" />
                                        Movimientos
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        id="tour-pos-cash-advance"
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
                            {canCloseCash && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        id="tour-pos-cash-close"
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

                    {(canReprintTicket || canReprintWarranty) && (
                    <Button
                        id="tour-pos-reprint"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setIsReprintOpen(true);
                            setNewReprintCount(0);
                        }}
                        className="relative hidden md:flex h-9 gap-2 rounded-xl border-slate-200 bg-white px-3 font-black text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                        title="Reimprimir tickets y garantias"
                    >
                        <ReceiptText size={16} />
                        Tickets
                        {newReprintCount > 0 && (
                            <span className="ml-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] leading-none text-white">
                                {newReprintCount > 9 ? '9+' : newReprintCount}
                            </span>
                        )}
                    </Button>

                    )}

                    <button
                        onClick={() => setIsRateCalculatorOpen(true)}
                        className="hidden sm:flex h-9 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700 transition-all hover:border-emerald-300 hover:bg-emerald-100"
                        title="Calcular USD a moneda local"
                    >
                        <Calculator size={15} />
                        <span className="hidden lg:block">Calculadora</span>
                    </button>

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

            <ReprintSalesSheet
                open={isReprintOpen}
                onOpenChange={(nextOpen) => {
                    setIsReprintOpen(nextOpen);
                    if (nextOpen) setNewReprintCount(0);
                }}
                currentRegister={currentRegister}
                onRemoteSale={() => setNewReprintCount((count) => Math.min(count + 1, 99))}
                canReprintTicket={canReprintTicket}
                canReprintWarranty={canReprintWarranty}
            />

            {isRateCalculatorOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm" onClick={() => setIsRateCalculatorOpen(false)}>
                    <div
                        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                                    <Calculator size={22} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-slate-900">Calculadora</h2>
                                    <p className="text-xs font-bold text-slate-500">Convierte USD y {calculatorSymbol} con la tasa activa</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsRateCalculatorOpen(false)}
                                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                aria-label="Cerrar calculadora"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4 p-5">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-black uppercase tracking-wide text-slate-400">
                                    <span>Tasa usada</span>
                                    <span className="rounded-full bg-white px-2 py-1 text-slate-600 shadow-sm">{calculatorRateName}</span>
                                </div>
                                <div className="flex items-baseline justify-between">
                                    <span className="text-sm font-bold text-slate-500">1 USD</span>
                                    <span className="text-xl font-black text-slate-950">{calculatorSymbol} {formatCalculatorNumber(calculatorRate)}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
                                <button
                                    type="button"
                                    onClick={() => { setCalculatorMode('USD_TO_LOCAL'); setCalculatorAmount(''); }}
                                    className={cn(
                                        "rounded-xl px-3 py-2 text-sm font-black transition",
                                        !isCalculatorLocalToUsd ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                                    )}
                                >
                                    USD a {calculatorSymbol}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setCalculatorMode('LOCAL_TO_USD'); setCalculatorAmount(''); }}
                                    className={cn(
                                        "rounded-xl px-3 py-2 text-sm font-black transition",
                                        isCalculatorLocalToUsd ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                                    )}
                                >
                                    {calculatorSymbol} a USD
                                </button>
                            </div>

                            <label className="block">
                                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">{calculatorInputLabel}</span>
                                <div className="flex h-14 items-center rounded-2xl border border-indigo-200 bg-white px-4 shadow-sm focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100">
                                    <span className="mr-3 text-2xl font-black text-indigo-600">{calculatorInputSymbol}</span>
                                    <input
                                        value={calculatorAmount}
                                        onChange={(event) => setCalculatorAmount(event.target.value.replace(/[^0-9.,]/g, ''))}
                                        autoFocus
                                        inputMode="decimal"
                                        placeholder={calculatorPlaceholder}
                                        className="h-full min-w-0 flex-1 bg-transparent text-2xl font-black text-slate-950 outline-none placeholder:text-slate-300"
                                    />
                                </div>
                            </label>

                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                                <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700">Resultado</p>
                                <p className="mt-1 break-words text-3xl font-black text-emerald-700">
                                    {calculatorOutputSymbol} {formatCalculatorNumber(calculatorResult)}
                                </p>
                                <p className="mt-2 text-xs font-bold text-emerald-700/75">
                                    {isCalculatorLocalToUsd
                                        ? `${calculatorSymbol} ${formatCalculatorNumber(calculatorNumericAmount)} / ${formatCalculatorNumber(calculatorRate)}`
                                        : `${formatCalculatorNumber(calculatorNumericAmount)} USD x ${formatCalculatorNumber(calculatorRate)}`}
                                </p>
                            </div>

                            <div className="grid grid-cols-4 gap-2">
                                {calculatorQuickAmounts.map((amount) => (
                                    <button
                                        key={amount}
                                        type="button"
                                        onClick={() => setCalculatorAmount(String(amount))}
                                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                                    >
                                        {calculatorInputSymbol}{amount}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isSessionOpen && currentRegister?.hardware_client_id && currentRegister?.print_connected === false && (
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 shrink-0 z-10 text-sm font-bold text-amber-800">
                    <AlertTriangle size={16} className="shrink-0" />
                    <span className="truncate">
                        La caja {currentRegister.code || currentRegister.name} usa {currentRegister.hardware_client_id}, pero el bridge aparece desconectado. Puedes vender, pero la impresion podria fallar.
                    </span>
                    <button onClick={handleTestPrinter} className="ml-auto rounded-lg bg-white px-3 py-1 text-xs font-black text-amber-700 shadow-sm hover:bg-amber-100">
                        Probar
                    </button>
                </div>
            )}

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
                                onCreateLayaway={() => setIsLayawayOpen(true)}
                                canCreateLayaway={canCreateLayaway}
                                onItemClick={(item) => setSelectedItemForEdit(item)}
                                secondaryCurrency={secondaryCurrency}
                                convertPrice={convertPrice}
                                priceLists={priceLists}
                                getFromCache={getFromCache}
                                canApplyDiscount={canApplyDiscount}
                                canOverridePrice={canOverridePrice}
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
                                onCreateLayaway={() => setIsLayawayOpen(true)}
                                canCreateLayaway={canCreateLayaway}
                                onItemClick={(item) => setSelectedItemForEdit(item)}
                                secondaryCurrency={secondaryCurrency}
                                convertPrice={convertPrice}
                                priceLists={priceLists}
                                getFromCache={getFromCache}
                                canApplyDiscount={canApplyDiscount}
                                canOverridePrice={canOverridePrice}
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
                                onCreateLayaway={() => { setIsMobileCartOpen(false); setIsLayawayOpen(true); }}
                                canCreateLayaway={canCreateLayaway}
                                onItemClick={(item) => { setIsMobileCartOpen(false); setSelectedItemForEdit(item); }}
                                secondaryCurrency={secondaryCurrency}
                                convertPrice={convertPrice}
                                priceLists={priceLists}
                                getFromCache={getFromCache}
                                canApplyDiscount={canApplyDiscount}
                                canOverridePrice={canOverridePrice}
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
                    canOverridePrice={canOverridePrice}
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

                <LayawayCheckoutModal
                    isOpen={isLayawayOpen}
                    onClose={() => { setIsLayawayOpen(false); focusSearch(); }}
                    cart={cart}
                    totalUSD={totalUSD}
                    warehouseId={selectedWarehouseId}
                    warehouses={warehouses}
                    cartDiscount={cartDiscount}
                    onCreated={handleLayawayCreated}
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
                <SaleSuccessModal isOpen={!!lastSaleData} saleData={lastSaleData} onClose={handleSuccessClose} canReprintWarranty={canReprintWarranty} />
                <ProductLookupModal isOpen={isLookupOpen} onClose={() => setIsLookupOpen(false)} />
                {!isLoading && !isCashLoading && !isSessionOpen && (<CashOpeningModal onOpen={openSession} />)}
                <CashClosingModal isOpen={isClosingOpen} onClose={() => setIsClosingOpen(false)} />
            </div>
        {help.isOpen && <HelpDrawer contextKey={helpKey} onClose={help.close} />}
        </div >
    );
};

export default POS;
