import { createContext, useState, useContext, useEffect } from 'react';
import configService from '../services/configService';
import apiClient from '../config/axios';
import { useWebSocket } from './WebSocketContext';

const ConfigContext = createContext();

export const ConfigProvider = ({ children }) => {
    const [business, setBusiness] = useState(null);
    const [currencies, setCurrencies] = useState([]);
    const [loading, setLoading] = useState(true);
    // Module Feature Flags
    const [modules, setModules] = useState({
        restaurant: false, // Default hidden
        retail: true
    });

    const { subscribe } = useWebSocket();

    // WebSocket Subscriptions for Real-Time Updates
    useEffect(() => {
        // Subscribe to Exchange Rate Updates
        const unsubUpdate = subscribe('exchange_rate:updated', (updatedRate) => {
            console.log('📡 Real-time Rate Update:', updatedRate);
            setCurrencies(prev => {
                // If it's default, we need to update others too (set them to false)
                // But simplified: just update the one or potentially reload all if complex
                // For now, let's just update the matching one

                // If updatedRate became default, others must be unset
                if (updatedRate.is_default) {
                    return prev.map(c => ({
                        ...c,
                        // Update the rate and default status
                        rate: c.id === updatedRate.id ? updatedRate.rate : c.rate,
                        is_default: c.id === updatedRate.id
                    }));
                }

                return prev.map(c =>
                    c.id === updatedRate.id ? { ...c, ...updatedRate } : c
                );
            });
        });

        // Subscribe to New Rates
        const unsubCreate = subscribe('exchange_rate:created', (newRate) => {
            console.log('📡 Real-time Rate Created:', newRate);
            setCurrencies(prev => {
                if (newRate.is_default) {
                    // Unset other defaults
                    const updated = prev.map(c => ({ ...c, is_default: false }));
                    return [...updated, newRate];
                }
                return [...prev, newRate];
            });
        });

        return () => {
            unsubUpdate();
            unsubCreate();
        };
    }, [subscribe]);

    const [paymentMethods, setPaymentMethods] = useState([]);

    const fetchPaymentMethods = async () => {
        try {
            const response = await apiClient.get('/payment-methods');
            setPaymentMethods(response.data);
        } catch (error) {
            console.error('Error fetching payment methods:', error);
            // Fallback for offline/initial load if API fails
            setPaymentMethods([
                { id: 1, name: 'Efectivo', is_active: true },
                { id: 2, name: 'Pago Movil', is_active: true }
            ]);
        }
    };

    const fetchConfig = async () => {
        try {
            // 1. Fetch Feature Flags (Public)
            try {
                const publicConfig = await apiClient.get('/config/public');
                if (publicConfig.data?.modules) {
                    setModules(prev => ({ ...prev, ...publicConfig.data.modules }));
                }
            } catch (error) {
                console.warn("Failed to load feature flags:", error);
            }

            // 2. Load Payment Methods
            fetchPaymentMethods();

            // ... (rest of existing fetchConfig logic) ...

            // Mock data loading if backend routes aren't ready yet or fail
            // In prod, you'd rely on the API success
            try {
                const bizData = await configService.getBusinessInfo();
                setBusiness(bizData);

                // NEW: Use exchange-rates endpoint instead of currencies
                let currData = [];
                try {
                    // ... (rest of existing fetchConfig logic)
                    const ratesRes = await apiClient.get('/config/exchange-rates', {
                        params: { is_active: true }
                    });
                    currData = ratesRes.data || [];
                } catch (e) {
                    console.warn("Exchange rates endpoint failed, trying legacy currencies:", e);
                    // Fallback to old currencies endpoint
                    currData = await configService.getCurrencies();
                }

                // Fallback to debug endpoint if empty (Safety Net)
                if (!Array.isArray(currData) || currData.length === 0) {
                    console.warn("Standard currencies endpoint empty. Trying debug endpoint...");
                    try {
                        const debugRes = await apiClient.get('/config/debug/seed');
                        if (debugRes.data && Array.isArray(debugRes.data.data)) {
                            currData = debugRes.data.data;
                        }
                    } catch (e) {
                        console.error("Debug endpoint failed too", e);
                    }
                }

                setCurrencies(Array.isArray(currData) ? currData.map(c => ({ ...c, rate: parseFloat(c.rate) })) : []);
            } catch (apiError) {
                console.warn("Using mock config data due to API error:", apiError);
                // Fallback Mock Data
                setBusiness({
                    name: 'Ferretería El Nuevo Progreso',
                    document_id: 'J-12345678-9',
                    address: 'Av. Principal, Local 1',
                    phone: '0412-1234567'
                });
                setCurrencies([
                    { id: 1, name: 'Dólar', symbol: '$', currency_code: 'USD', currency_symbol: '$', rate: 1.00, is_anchor: true, is_active: true, is_default: true },
                    { id: 2, name: 'Bolívar', symbol: 'Bs', currency_code: 'VES', currency_symbol: 'Bs', rate: 45.00, is_anchor: false, is_active: true, is_default: true }
                ]);
            }
        } catch (err) {
            console.error("Critical Config Error", err);
            // Emergency Fallback to prevent white screen
            setBusiness({ name: 'Modo Offline / Error' });
            setCurrencies([{ id: 1, name: 'USD', rate: 1, is_default: true, symbol: '$' }]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('token');
        fetchConfig();
    }, [localStorage.getItem('token')]);

    const refreshConfig = () => fetchConfig();

    // Helper to get Exchange Rate by Currency Code (Symbol or ID preferably)
    const getExchangeRate = (symbol) => {
        if (!symbol) return 1;
        const normalize = s => String(s).trim().toUpperCase();
        const target = normalize(symbol);

        const curr = currencies.find(c =>
            normalize(c.symbol) === target ||
            normalize(c.currency_symbol) === target ||
            normalize(c.currency_code) === target
        );
        return curr ? parseFloat(curr.rate) : 1;
    };

    const getActiveCurrencies = () => {
        if (!Array.isArray(currencies)) return [];

        // Filter active currencies (include anchor/USD)
        const activeCurrencies = currencies.filter(c => c.is_active);

        // Format all active currencies (don't deduplicate - allow multiple rates per currency)
        return activeCurrencies.map(curr => {
            const code = (curr.currency_code || curr.symbol || '').trim().toUpperCase();
            return {
                id: curr.id,
                name: curr.name || code,
                symbol: (curr.currency_symbol || curr.symbol || '').trim(),
                currency_code: code,
                currency_symbol: (curr.currency_symbol || curr.symbol || '').trim(),
                rate: curr.rate,
                is_active: curr.is_active,
                is_default: curr.is_default,
                is_anchor: curr.is_anchor
            };
        });
    };

    const convertPrice = (priceInAnchor, targetSymbol) => {
        const rate = getExchangeRate(targetSymbol);
        return priceInAnchor * rate;
    };

    const getProductExchangeRate = (product) => {
        // If product has specific exchange_rate_id, use that rate
        if (product?.exchange_rate_id && Array.isArray(currencies)) {
            const productRate = currencies.find(r => r.id === product.exchange_rate_id);
            if (productRate) {
                return productRate;
            }
        }
        // Otherwise, return default rate for the currency
        return currencies.find(c => c.is_default) || currencies[0];
    };

    const convertProductPrice = (product, targetCurrencyCode) => {
        // Get the rate assigned to this product (or default)
        const rate = getProductExchangeRate(product);

        // If target currency matches product's rate currency, use product's rate
        if (rate && rate.currency_code === targetCurrencyCode) {
            return product.price * rate.rate;
        }

        // Otherwise find the rate for target currency
        const targetRate = currencies.find(c => c.currency_code === targetCurrencyCode);
        return product.price * (targetRate?.rate || 1);
    };

    const formatCurrency = (amount, currency = 'USD') => {
        try {
            const numericAmount = Number(amount);
            const absAmount = Math.abs(numericAmount);
            
            // Smart Logic: If value is small (< 1) and not zero, show 4 decimals
            const isSmallValue = absAmount > 0 && absAmount < 1;
            const fractionDigits = isSmallValue ? 4 : 2;

            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currency,
                minimumFractionDigits: fractionDigits,
                maximumFractionDigits: fractionDigits
            }).format(numericAmount);
        } catch (error) {
            // Fallback
            return new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(amount);
        }
    };

    return (
        <ConfigContext.Provider value={{
            business,
            currencies,
            loading,
            refreshConfig,
            getExchangeRate,
            getActiveCurrencies,
            convertPrice,
            getProductExchangeRate,
            convertProductPrice,

            paymentMethods,
            formatCurrency,
            modules // Expose modules
        }}>
            {children}
        </ConfigContext.Provider>
    );
};

export const useConfig = () => useContext(ConfigContext);
