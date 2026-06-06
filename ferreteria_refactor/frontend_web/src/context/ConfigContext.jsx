import { createContext, useState, useContext, useEffect } from 'react';
import configService from '../services/configService';
import apiClient from '../config/axios';
import { useWebSocket } from './WebSocketContext';

const ConfigContext = createContext();

export const ConfigProvider = ({ children }) => {
    const [business, setBusiness] = useState({ name: 'Cargando...' }); // Default neutral state
    const [currencies, setCurrencies] = useState([]);
    const [loading, setLoading] = useState(true);

    // Helper for boolean env vars
    const parseBool = (val) => {
        if (typeof val === 'boolean') return val;
        if (!val) return false;
        return ['true', '1', 'yes', 'on'].includes(String(val).toLowerCase().trim());
    };

    // Feature flags a la carta (activados por tenant desde panel admin)
    const [featureFlags, setFeatureFlags] = useState({});
    const [autoPrintTicket, setAutoPrintTicket] = useState(false);
    const [posSettings, setPosSettings] = useState({
        pos_default_price_list_id: '',
        pos_show_bs: true,
    });

    // Module Feature Flags
    const [modules, setModules] = useState({
        restaurant: parseBool(import.meta.env.VITE_MODULE_RESTAURANT_ENABLED),
        retail: import.meta.env.VITE_MODULE_RETAIL_ENABLED === undefined
            ? true
            : parseBool(import.meta.env.VITE_MODULE_RETAIL_ENABLED),
        laundry: parseBool(import.meta.env.VITE_MODULE_LAUNDRY_ENABLED),
        services: import.meta.env.VITE_MODULE_SERVICES_ENABLED === undefined
            ? true
            : parseBool(import.meta.env.VITE_MODULE_SERVICES_ENABLED),
        pharmacy: parseBool(import.meta.env.VITE_MODULE_PHARMACY_ENABLED)
    });

    useEffect(() => {
        console.log('🔧 [ConfigContext] Feature Flags:', modules);
        console.log('📄 [ConfigContext] Raw Env:', {
            laundry: import.meta.env.VITE_MODULE_LAUNDRY_ENABLED,
            services: import.meta.env.VITE_MODULE_SERVICES_ENABLED
        });
    }, []);

    const { subscribe } = useWebSocket();

    // WebSocket Subscriptions for Real-Time Updates
    useEffect(() => {
        // Subscribe to Exchange Rate Updates
        const unsubUpdate = subscribe('exchange_rate:updated', (updatedRate) => {
            console.log('📡 Real-time Rate Update:', updatedRate);
            setCurrencies(prev => {
                // Determine if we need to handle default switching
                // Broadly, just map through and apply logic based on ID and Currency Code
                return prev.map(c => {
                    // 1. If this is the rate being updated
                    if (c.id === updatedRate.id) {
                        return { ...c, ...updatedRate, rate: parseFloat(updatedRate.rate) };
                    }

                    // 2. If the updated rate is the new default for this currency, unset others of same currency
                    if (updatedRate.is_default && c.currency_code === updatedRate.currency_code) {
                        return { ...c, is_default: false };
                    }

                    // 3. Otherwise leave unchanged
                    return c;
                });
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
            const response = await apiClient.get('/payment-methods', { _silentNetworkError: true });
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
            // 0. OPTIMIZACION: Cargar lo necesario del POS en 1 request cacheado en Redis.
            // Si responde, evitamos repetir business/exchange-rates/payment-methods/settings.
            let loadedFromPosInit = {
                business: false,
                exchangeRates: false,
                paymentMethods: false,
                autoPrint: false,
            };

            try {
                const posInit = await apiClient.get('/config/pos-init', { _silentNetworkError: true });
                if (posInit.data) {
                    const { business, exchange_rates, payment_methods, settings } = posInit.data;
                    if (business?.name) {
                        setBusiness(prev => ({ ...prev, ...business }));
                        loadedFromPosInit.business = true;
                    }
                    if (exchange_rates?.length) {
                        setCurrencies(exchange_rates);
                        loadedFromPosInit.exchangeRates = true;
                    }
                    if (payment_methods?.length) {
                        setPaymentMethods(payment_methods);
                        loadedFromPosInit.paymentMethods = true;
                    }
                    if (settings) {
                        setAutoPrintTicket(!!settings.auto_print_ticket);
                        setPosSettings(prev => ({ ...prev, ...settings }));
                        loadedFromPosInit.autoPrint = true;
                    }
                }
            } catch { /* silencioso: los requests individuales quedan como fallback */ }

            // 1. Fetch Feature Flags (Public) & Tenant Info
            // This runs FIRST to set the correct branding on Login
            try {
                const publicConfig = await apiClient.get('/config/public', { _silentNetworkError: true });
                if (publicConfig.data) {
                    // Update Modules
                    if (publicConfig.data.modules) {
                        const backendModules = publicConfig.data.modules;
                        // Map backend snake_case flags to frontend module keys
                        if (backendModules.has_pharmacy_module !== undefined) {
                            backendModules.pharmacy = parseBool(backendModules.has_pharmacy_module);
                        }
                        if (backendModules.has_restaurant_module !== undefined) {
                            backendModules.restaurant = parseBool(backendModules.has_restaurant_module);
                        }
                        if (backendModules.has_services_module !== undefined) {
                            backendModules.services = parseBool(backendModules.has_services_module);
                        }
                        setModules(prev => ({ ...prev, ...backendModules }));
                    }
                    // Feature flags a la carta
                    if (publicConfig.data.feature_flags) {
                        setFeatureFlags(publicConfig.data.feature_flags);
                    }

                    // tenant_name es el nombre del tenant en SaaS admin
                    // NO sobreescribir; el business_name lo carga el paso 3
                    // Solo guardarlo como fallback si no hay business_name
                    if (publicConfig.data.tenant_name) {
                        setBusiness(prev => ({
                            ...prev,
                            tenant_name_fallback: publicConfig.data.tenant_name,
                            // Solo usar si name esta vacio o es el default
                            name: prev.name && prev.name !== 'Cargando...' ? prev.name : publicConfig.data.tenant_name
                        }));
                    }
                }
            } catch (error) {
                console.warn("Failed to load feature flags/public config:", error);
            }

            // 2. Load Payment Methods only if pos-init did not provide them
            if (!loadedFromPosInit.paymentMethods) fetchPaymentMethods();

            // 3. Authenticated Business Info only if pos-init did not provide it
            const token = localStorage.getItem('token');
            if (token && !loadedFromPosInit.business) {
                try {
                    const bizData = await configService.getBusinessInfo();
                    setBusiness(bizData);
                } catch (e) {
                    console.warn("Could not load full business info (likely unauthenticated):", e);
                }
            }

            // 4. Fetch Exchange Rates only if pos-init did not provide them
            if (!loadedFromPosInit.exchangeRates) {
                try {
                    const ratesResponse = await apiClient.get('/config/exchange-rates?is_active=true', { _silentNetworkError: true });
                    console.log('Exchange Rates Loaded:', ratesResponse.data);
                    setCurrencies(ratesResponse.data);
                } catch (e) {
                    console.warn("Could not load exchange rates:", e);
                }
            }

            // 5. Fetch Auto Print Ticket only if pos-init did not provide it
            if (!loadedFromPosInit.autoPrint) {
                try {
                    const apRes = await apiClient.get('/config/pos/auto-print-ticket', { _silentNetworkError: true });
                    setAutoPrintTicket(!!apRes.data.auto_print_ticket);
                } catch (e) { /* silencioso */ }
            }

        } catch (err) {
            console.error("Critical Config Error", err);
            // Emergency Fallback
            setBusiness(prev => ({ ...prev, name: prev.name || 'Mi Inventario (Offline)' }));
        } finally {
            setLoading(false);
        }
    };

    // Run on Mount (Public Access) AND when Token Changes
    useEffect(() => {
        fetchConfig();
    }, []); // Solo al montar — fetchConfig ya maneja el token internamente

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

    // Get the primary non-USD active currency (e.g., first active local currency)
    // Priority: is_default local currency > first non-USD active currency
    const getPrimaryLocalCurrency = () => {
        const active = getActiveCurrencies();
        return active.find(c => c.currency_code !== 'USD' && c.currency_symbol !== '$' && c.is_default)
            || active.find(c => c.currency_code !== 'USD' && c.currency_symbol !== '$')
            || null;
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
            autoPrintTicket,
            posSettings,
            loading,
            refreshConfig,
            getExchangeRate,
            getActiveCurrencies,
            getPrimaryLocalCurrency,
            convertPrice,
            getProductExchangeRate,
            convertProductPrice,

            paymentMethods,
            formatCurrency,
            modules,
            featureFlags,
        }}>
            {children}
        </ConfigContext.Provider>
    );
};

export const useConfig = () => useContext(ConfigContext);
