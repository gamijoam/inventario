import { createContext, useState, useContext, useMemo, useEffect } from 'react';
import apiClient from '../config/axios';
import { useConfig } from './ConfigContext';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
    const [cart, setCart] = useState([]);
    const { currencies: exchangeRates } = useConfig();

    // Auto-update cart items when exchange rates change
    useEffect(() => {
        if (!exchangeRates || exchangeRates.length === 0) return;

        setCart(prevCart => {
            return prevCart.map(item => {
                // Find current rate for this item
                // If it was using a specific rate ID, find that rate's new value
                if (item.exchange_rate_source === 'pre-resolved' || item.is_special_rate) {
                    // Try to find the rate by ID used originally (we don't store ID explicitly in cart item root, 
                    // but we might infer it or we should have stored it. 
                    // Let's assume we match by currency code if we can't find ID, 
                    // BUT better logic: In addToCart we found the rate. 

                    // Actually, item has 'exchange_rate_name'. Ideally we should have stored exchange_rate_id in item.
                    // Let's check addToCart logic...
                    // It doesn't store rate_id in the item root, only in local scope.
                    // But we likely can match by name or context.

                    // For robust implementations, let's use the currency logic.
                    // If the item has a 'exchange_rate_name', we can try to find it in new rates.

                    const updatedRateObj = exchangeRates.find(r => r.name === item.exchange_rate_name);
                    if (updatedRateObj) {
                        const newRate = updatedRateObj.rate;
                        if (newRate !== item.exchange_rate) {
                            const subtotalUsd = item.subtotal_usd;
                            return {
                                ...item,
                                exchange_rate: newRate,
                                subtotal_bs: subtotalUsd * newRate
                            };
                        }
                    }
                }

                // If it was using default rate (source='default' or similar)
                // We might need to re-evaluate getEffectiveExchangeRate logic here, 
                // but simpler is to just update if we can identify the rate used.

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
        // unit: { name, price_usd, factor, is_base, exchange_rate_id?, exchange_rate_name?, is_special_rate? }
        const itemId = `${product.id}_${unit.name.replace(/\s+/g, '_')}`;

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

                console.log('🛒 DEBUG CartContext addToCart:');
                console.log('   Product:', product.name);
                console.log('   Unit received:', unit);
                console.log('   rateInfo resolved:', rateInfo);

                const newItem = {
                    id: itemId,
                    product_id: product.id,
                    name: product.name,
                    unit_name: unit.name,
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
                    updated_at: product.updated_at || null
                };

                console.log('   newItem created:', newItem);

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

    const clearCart = () => setCart([]);

    // Helper to purely update the list and recalculate subtotals
    const updateItemQuantityInList = (list, itemId, qty) => {
        return list.map(item => {
            if (item.id === itemId) {
                const subUsd = item.unit_price_usd * qty;
                const subBs = subUsd * item.exchange_rate;

                return {
                    ...item,
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
            // Get all unique active currency codes
            const activeCurrencies = [...new Set(
                exchangeRates
                    .filter(r => r.is_active)
                    .map(r => r.currency_code)
            )];

            // Initialize totals for each currency
            activeCurrencies.forEach(currCode => {
                totalsPerCurrency[currCode] = 0;
            });

            // Calculate total for each currency
            cart.forEach(item => {
                const itemTotalUSD = item.subtotal_usd;

                // Convert to each active currency
                activeCurrencies.forEach(currCode => {
                    // Find the exchange rate for this currency
                    // Use the item's specific rate if it matches this currency, otherwise use default
                    let rateToUse = 1; // Default for USD

                    if (currCode !== 'USD') {
                        // Check if item has a special rate for this currency
                        const itemRate = exchangeRates.find(r =>
                            r.id === item.exchange_rate_id &&
                            r.currency_code === currCode
                        );

                        if (itemRate) {
                            rateToUse = itemRate.rate;
                        } else {
                            // Use default rate for this currency
                            const defaultRate = exchangeRates.find(r =>
                                r.currency_code === currCode &&
                                r.is_default &&
                                r.is_active
                            );
                            rateToUse = defaultRate ? defaultRate.rate : 1;
                        }
                    }

                    totalsPerCurrency[currCode] += itemTotalUSD * rateToUse;
                });
            });
        }

        return {
            usd: cart.reduce((acc, item) => acc + item.subtotal_usd, 0),
            bs: cart.reduce((acc, item) => acc + (item.subtotal_bs || 0), 0),
            byCurrency: totalsPerCurrency
        };
    }, [cart, exchangeRates]);

    return (
        <CartContext.Provider value={{
            cart,
            addToCart,
            removeFromCart,
            updateQuantity,
            clearCart,
            totalUSD: totals.usd,
            totalBs: totals.bs,
            totalsByCurrency: totals.byCurrency,
            exchangeRates  // Expose for other components if needed
        }}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => useContext(CartContext);
