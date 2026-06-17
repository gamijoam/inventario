import { createContext, useState, useContext, useMemo, useEffect, useRef } from 'react';
import apiClient from '../config/axios';
import { useConfig } from './ConfigContext';
import { useAuth } from './AuthContext';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
    const [cart, setCart] = useState([]);
    const [cartDiscount, setCartDiscount] = useState({ type: 'percent', value: 0, active: false }); // Feature 1
    const [heldCart, setHeldCart] = useState(null); // Venta pausada: { items, cartDiscount, pausedAt }
    const { currencies: exchangeRates } = useConfig();
    const { user } = useAuth();
    const identityKey = user ? `${user.tenant_id || 'tenant'}:${user.id}` : 'anonymous';
    const lastIdentityKeyRef = useRef(identityKey);

    // Evita que un carrito de una sesión quede visible al cambiar de usuario/tenant
    // en la misma pestaña o computadora de caja.
    useEffect(() => {
        if (lastIdentityKeyRef.current === identityKey) return;

        lastIdentityKeyRef.current = identityKey;
        setCart([]);
        setCartDiscount({ type: 'percent', value: 0, active: false });
        setHeldCart(null);
    }, [identityKey]);

    // Auto-update cart items when exchange rates change
    useEffect(() => {
        if (!exchangeRates || exchangeRates.length === 0) return;

        setCart(prevCart => {
            return prevCart.map(item => {
                let newRate = item.exchange_rate;
                let rateFound = false;

                // 1. Try to match by Specific Rate ID (Most Robust)
                if (item.exchange_rate_id) {
                    const matchedRate = exchangeRates.find(r => r.id === item.exchange_rate_id);
                    if (matchedRate && matchedRate.is_active) {
                        newRate = matchedRate.rate;
                        rateFound = true;
                    }
                }

                // 2. Fallback: Match by Name (Legacy/Special)
                if (!rateFound && item.exchange_rate_name) {
                    const matchedRate = exchangeRates.find(r => r.name === item.exchange_rate_name);
                    if (matchedRate && matchedRate.is_active) {
                        newRate = matchedRate.rate;
                        rateFound = true;
                    }
                }

                // 3. Fallback: If it was using Default Rate (and no specific constraints)
                // If it wasn't a special rate, it implies it should follow the Default Rate for VES
                if (!rateFound && !item.is_special_rate) {
                    const defaultRate = exchangeRates.find(r => r.is_default && r.currency_code === 'VES' && r.is_active);
                    if (defaultRate) {
                        newRate = defaultRate.rate;
                        rateFound = true;
                    }
                }

                // Only update if rate changed
                if (rateFound && newRate !== item.exchange_rate) {
                    const subtotalUsd = item.subtotal_usd;
                    return {
                        ...item,
                        exchange_rate: newRate,
                        subtotal_bs: subtotalUsd * newRate
                    };
                }

                return item;
            });
        });
    }, [exchangeRates]);

    /**
     * Get effective exchange rate for a product/unit combination
     * Hierarchy: Unit.exchange_rate_id → Product.exchange_rate_id → Default rate for currency
     */
    const getEffectiveExchangeRate = (product, unit, targetCurrencyCode = 'VES') => {
        // 1. Check if unit has specific rate
        if (unit.exchange_rate_id) {
            const rate = exchangeRates.find(r => r.id === unit.exchange_rate_id);
            if (rate && rate.is_active) {
                return {
                    rate: rate.rate,
                    rateName: rate.name,
                    rateId: rate.id,
                    source: 'unit',
                    isSpecial: !rate.is_default
                };
            }
        }

        // 2. Check if product has specific rate
        if (product.exchange_rate_id) {
            const rate = exchangeRates.find(r => r.id === product.exchange_rate_id);
            if (rate && rate.is_active) {
                return {
                    rate: rate.rate,
                    rateName: rate.name,
                    rateId: rate.id,
                    source: 'product',
                    isSpecial: !rate.is_default
                };
            }
        }

        // 3. Fallback to default rate for target currency
        const defaultRate = exchangeRates.find(r =>
            r.currency_code === targetCurrencyCode &&
            r.is_default &&
            r.is_active
        );

        if (defaultRate) {
            return {
                rate: defaultRate.rate,
                rateName: defaultRate.name,
                rateId: defaultRate.id,
                source: 'default',
                isSpecial: false
            };
        }

        // Ultimate fallback (should not happen if DB is seeded properly)
        console.warn('No exchange rate found, using hardcoded fallback');
        return {
            rate: 45.00,
            rateName: 'Fallback',
            rateId: null,
            source: 'fallback',
            isSpecial: false
        };
    };

    // Add Item Logic with multi-unit support and exchange rate hierarchy
    const addToCart = (product, unit) => {
        // unit: { name, price_usd, factor, is_base, exchange_rate_id?, exchange_rate_name?, is_special_rate?, unit_id? }

        // ── Lista de precio predeterminada del POS (por tenant) ──
        // Si hay una lista configurada y el producto tiene precio en ella, se aplica
        // automáticamente (solo a la unidad base; las unidades especiales mantienen su precio).
        let _defaultListId = null, _defaultListName = null;
        try {
            const cfgListId = localStorage.getItem('pos_default_price_list_id');
            if (cfgListId && unit?.is_base && Array.isArray(product?.prices) && product.prices.length) {
                const entry = product.prices.find(p => String(p.price_list_id) === String(cfgListId));
                if (entry && entry.price != null) {
                    unit = { ...unit, price_usd: parseFloat(entry.price) };
                    _defaultListId = parseInt(cfgListId);
                    _defaultListName = entry.price_list?.name || null;
                }
            }
        } catch {}

        // CRITICAL FIX: Use unit.unit_id if available (e.g. for IMEI specific items)
        const unitSuffix = unit.unit_id || unit.name;
        const itemId = `${product.id}_${unitSuffix.replace(/\s+/g, '_')}`;

        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === itemId);

            if (existingItem) {
                // Update quantity if exists
                return updateItemQuantityInList(prevCart, itemId, existingItem.quantity + 1);
            } else {
                // Get effective exchange rate using hierarchy
                let rateInfo;

                // If unit has exchange_rate_id, try to resolve it
                if (unit.exchange_rate_id) {
                    const foundRate = exchangeRates.find(r => r.id === unit.exchange_rate_id);

                    if (foundRate && foundRate.is_active) {
                        // Successfully found the rate
                        rateInfo = {
                            rate: foundRate.rate,
                            rateName: unit.exchange_rate_name || foundRate.name,
                            rateId: foundRate.id,
                            source: 'pre-resolved',
                            isSpecial: unit.is_special_rate ?? !foundRate.is_default
                        };
                    } else {
                        // Rate ID provided but not found or inactive - fallback to hierarchy
                        console.warn(`⚠️ Exchange rate ID ${unit.exchange_rate_id} not found or inactive, using fallback`);
                        rateInfo = getEffectiveExchangeRate(product, unit);
                    }
                } else {
                    // No rate ID provided, use hierarchy
                    rateInfo = getEffectiveExchangeRate(product, unit);
                }

                const subtotalUsd = unit.price_usd * 1;

                const newItem = {
                    id: itemId,
                    product_id: product.id,
                    name: product.name,
                    unit_name: unit.name,
                    unit_id: unit.id || null,        // ID de product_units (null = unidad base)
                    quantity: 1,
                    unit_price_usd: unit.price_usd,
                    conversion_factor: unit.factor,
                    exchange_rate: rateInfo.rate,
                    exchange_rate_name: rateInfo.rateName,
                    exchange_rate_source: rateInfo.source,
                    exchange_rate_id: rateInfo.rateId, // Store rate ID for updates
                    is_special_rate: rateInfo.isSpecial,
                    subtotal_usd: subtotalUsd,
                    subtotal_bs: subtotalUsd * rateInfo.rate,
                    // Fix: Preserve discount fields
                    original_price_usd: unit.original_price_usd,
                    discount_percentage: unit.discount_percentage || 0,
                    is_discount_active: unit.is_discount_active || false,
                    // Redesign Data
                    sku: product.sku || '',
                    stock: product.stock || 0,
                    // Image fields for thumbnails
                    image_url: product.image_url || null,
                    updated_at: product.updated_at || null,
                    // NEW: Serialized Inventory Support
                    serial_numbers: unit.serial_numbers || [],
                    serial_details: unit.serial_details || [],
                    has_imei: unit.has_imei || product.has_imei || false,
                    combo_serials: unit.combo_serials || null,
                    combo_serial_details: unit.combo_serial_details || null,
                    color_name: unit.color_name || null,
                    color_hex: unit.color_hex || null,
                    // Garantía — copiar del producto para detectarla en SaleSuccessModal
                    warranty_policy_id: product.warranty_policy_id || null,
                    // NEW: Product Location
                    location: product.location || null,
                    // Feature 2: Store discount rules on cart item for auto-apply
                    discount_rules: product.discount_rules || [],
                    // NEW: Barbershop Service properties
                    is_barbershop_service: product.is_barbershop_service || false,
                    employee_id: unit.employee_id || null, // Can be pre-assigned
                    // Lista de precio predeterminada aplicada (si la hay)
                    price_list_id: _defaultListId,
                    price_list_name: _defaultListName,
                };

                return [...prevCart, newItem];
            }
        });
    };

    const removeFromCart = (itemId) => {
        setCart(prev => prev.filter(item => item.id !== itemId));
    };

    const updateQuantity = (itemId, newQuantity) => {
        if (newQuantity <= 0) {
            removeFromCart(itemId);
            return;
        }
        setCart(prev => updateItemQuantityInList(prev, itemId, newQuantity));
    };

    // NEW: Update arbitrary item fields (e.g. salesperson_id, price)
    const updateCartItem = (itemId, updates) => {
        setCart(prev => prev.map(item => {
            if (item.id === itemId) {
                const newItem = { ...item, ...updates };

                // Recalculate Subtotals if price or rate changed
                if ('unit_price_usd' in updates || 'exchange_rate' in updates) {
                    newItem.subtotal_usd = newItem.unit_price_usd * newItem.quantity;
                    newItem.subtotal_bs = newItem.subtotal_usd * newItem.exchange_rate;
                }
                return newItem;
            }
            return item;
        }));
    };

    const clearCart = () => {
        setCart([]);
        setCartDiscount({ type: 'percent', value: 0, active: false }); // Reset discount on clear
    };

    // Helper: find best applicable discount rule (highest min_qty ≤ current qty)
    const applyQuantityDiscountRule = (item, qty) => {
        const rules = item.discount_rules;
        if (!rules || rules.length === 0) return {};

        const activeRules = rules.filter(r => r.is_active && parseFloat(r.min_quantity) <= qty);
        if (activeRules.length === 0) {
            // No rule applies — restore original price if a rule was applied before
            if (item._qty_rule_applied) {
                return {
                    unit_price_usd: item.original_price_usd || item.unit_price_usd,
                    is_discount_active: false,
                    discount_percentage: 0,
                    _qty_rule_applied: false,
                };
            }
            return {};
        }

        // Get the rule with the highest min_quantity that is still ≤ qty
        const bestRule = activeRules.reduce((best, r) =>
            parseFloat(r.min_quantity) > parseFloat(best.min_quantity) ? r : best
        );

        const basePrice = item.original_price_usd || item.unit_price_usd;
        const discountedPrice = basePrice * (1 - parseFloat(bestRule.discount_percentage) / 100);

        return {
            original_price_usd: basePrice,
            unit_price_usd: discountedPrice,
            is_discount_active: true,
            discount_percentage: parseFloat(bestRule.discount_percentage),
            _qty_rule_applied: true,
            _qty_rule_id: bestRule.id,
        };
    };

    // Helper to purely update the list and recalculate subtotals
    const updateItemQuantityInList = (list, itemId, qty) => {
        return list.map(item => {
            if (item.id === itemId) {
                const ruleUpdates = applyQuantityDiscountRule(item, qty);
                const effectivePrice = ruleUpdates.unit_price_usd ?? item.unit_price_usd;
                const subUsd = effectivePrice * qty;
                const subBs = subUsd * item.exchange_rate;

                return {
                    ...item,
                    ...ruleUpdates,
                    quantity: qty,
                    subtotal_usd: subUsd,
                    subtotal_bs: subBs
                };
            }
            return item;
        });
    };

    // Totals Calculation (Sum of subtotals per currency)
    const totals = useMemo(() => {
        const totalsPerCurrency = {};

        // Calculate totals for ALL active currencies
        if (exchangeRates && exchangeRates.length > 0) {
            const activeCurrencies = [...new Set(
                exchangeRates
                    .filter(r => r.is_active)
                    .map(r => r.currency_code)
            )];

            activeCurrencies.forEach(currCode => {
                totalsPerCurrency[currCode] = 0;
            });

            cart.forEach(item => {
                const itemTotalUSD = item.subtotal_usd;

                activeCurrencies.forEach(currCode => {
                    let rateToUse = 1;

                    if (currCode !== 'USD') {
                        const itemRate = exchangeRates.find(r =>
                            r.id === item.exchange_rate_id &&
                            r.currency_code === currCode
                        );

                        if (itemRate) {
                            rateToUse = itemRate.rate;
                        } else {
                            // Prefer default rate; fallback to any active rate for the currency
                            // (matches convertProductPrice behavior — avoids rateToUse=1 when
                            //  the currency exists but is_default is not set, e.g. COP)
                            const defaultRate = exchangeRates.find(r =>
                                r.currency_code === currCode &&
                                r.is_default &&
                                r.is_active
                            ) || exchangeRates.find(r =>
                                r.currency_code === currCode &&
                                r.is_active
                            );
                            rateToUse = defaultRate ? defaultRate.rate : 1;
                        }
                    }

                    totalsPerCurrency[currCode] += itemTotalUSD * rateToUse;
                });
            });
        }

        const rawUSD = cart.reduce((acc, item) => acc + item.subtotal_usd, 0);
        const rawBs = cart.reduce((acc, item) => acc + (item.subtotal_bs || 0), 0);

        // --- Apply global cart discount ---
        let discountUSD = 0;
        if (cartDiscount?.active && cartDiscount.value > 0) {
            if (cartDiscount.type === 'percent') {
                discountUSD = rawUSD * (cartDiscount.value / 100);
            } else if (cartDiscount.type === 'fixed' || cartDiscount.type === 'fixed_usd') { // 'fixed' is backward compat
                discountUSD = Math.min(cartDiscount.value, rawUSD);
            } else if (cartDiscount.type === 'fixed_bs') {
                // Find default VES rate
                const defaultRate = exchangeRates.find(r => r.currency_code === 'VES' && r.is_default && r.is_active)?.rate || 1;
                const valueInUSD = cartDiscount.value / defaultRate;
                discountUSD = Math.min(valueInUSD, rawUSD);
            } else if (cartDiscount.type === 'target') {
                // Discount is the difference between original Total and the target
                discountUSD = Math.max(0, rawUSD - cartDiscount.value);
            } else if (cartDiscount.type === 'target_bs') {
                const defaultRate = exchangeRates.find(r => r.currency_code === 'VES' && r.is_default && r.is_active)?.rate || 1;
                const targetInUSD = cartDiscount.value / defaultRate;
                discountUSD = Math.max(0, rawUSD - targetInUSD);
            }
        }

        // Calculate the Bs equivalent of the discount using item-weighted average rate
        const avgRate = rawUSD > 0 ? rawBs / rawUSD : 1;
        const discountBs = discountUSD * avgRate;

        // Apply discount to each currency using that currency's own rate
        const discountedByCurrency = {};
        Object.keys(totalsPerCurrency).forEach(curr => {
            if (curr === 'USD') {
                discountedByCurrency[curr] = Math.max(0, totalsPerCurrency[curr] - discountUSD);
            } else {
                // Use the actual rate for this currency (not VES avgRate)
                const currRate = exchangeRates.find(r =>
                    r.currency_code === curr && r.is_default && r.is_active
                ) || exchangeRates.find(r =>
                    r.currency_code === curr && r.is_active
                );
                const rate = currRate ? parseFloat(currRate.rate) : avgRate;
                discountedByCurrency[curr] = Math.max(0, totalsPerCurrency[curr] - discountUSD * rate);
            }
        });

        return {
            usd: Math.max(0, rawUSD - discountUSD),
            bs: Math.max(0, rawBs - discountBs),
            byCurrency: discountedByCurrency,
            rawUSD,
            rawBs,
            discountUSD,
            discountBs,
        };
    }, [cart, exchangeRates, cartDiscount]);

    // ── Hold Sale (Venta en pausa) ───────────────────────────────────────────
    const holdCart = () => {
        if (cart.length === 0) return;
        setHeldCart({ items: [...cart], cartDiscount: { ...cartDiscount }, pausedAt: new Date().toISOString() });
        setCart([]);
        setCartDiscount({ type: 'percent', value: 0, active: false });
    };

    const resumeHeldCart = () => {
        if (!heldCart) return;
        setCart(heldCart.items);
        setCartDiscount(heldCart.cartDiscount);
        setHeldCart(null);
    };

    const discardHeldCart = () => setHeldCart(null);

    const value = useMemo(() => ({
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        updateCartItem,
        clearCart,
        overwriteCart: setCart,
        totalUSD: totals.usd,
        totalBs: totals.bs,
        totalsByCurrency: totals.byCurrency,
        rawTotalUSD: totals.rawUSD,
        rawTotalBs: totals.rawBs,
        discountUSD: totals.discountUSD,
        discountBs: totals.discountBs,
        cartDiscount,
        setCartDiscount,
        exchangeRates,
        heldCart,
        holdCart,
        resumeHeldCart,
        discardHeldCart,
    }), [
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        updateCartItem,
        clearCart,
        setCart,
        totals,
        cartDiscount,
        setCartDiscount,
        exchangeRates,
        heldCart,
        holdCart,
        resumeHeldCart,
        discardHeldCart,
    ]);

    return (
        <CartContext.Provider value={value}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => useContext(CartContext);
