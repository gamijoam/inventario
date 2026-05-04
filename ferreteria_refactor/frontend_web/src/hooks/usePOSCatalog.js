import { useState, useRef, useCallback, useEffect } from 'react';
import apiClient from '../config/axios';

const PAGE_SIZE = 40;

const usePOSCatalog = () => {
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [total, setTotal] = useState(0);

    const [search, setSearch] = useState('');
    const [categoryId, setCategoryId] = useState(null);
    const [warehouseId, setWarehouseId] = useState(null);

    const skipRef = useRef(0);
    const productCache = useRef(new Map());
    const abortRef = useRef(null);

    const fetchPage = useCallback(async (reset = false) => {
        // Cancel any in-flight request
        if (abortRef.current) {
            abortRef.current.abort();
        }
        const controller = new AbortController();
        abortRef.current = controller;

        if (reset) {
            skipRef.current = 0;
            setIsLoading(true);
        } else {
            setIsLoadingMore(true);
        }

        try {
            const params = {
                skip: skipRef.current,
                limit: PAGE_SIZE,
            };
            if (search) params.search = search;
            if (categoryId) params.category_id = categoryId;
            if (warehouseId) params.warehouse_id = warehouseId;

            const { data } = await apiClient.get('/products/catalog', {
                params,
                signal: controller.signal,
            });

            const items = data.items || [];

            // Update cache
            items.forEach(p => {
                productCache.current.set(p.id, p);
                if (p.sku) productCache.current.set(`sku:${p.sku}`, p);
            });

            if (reset) {
                setProducts(items);
            } else {
                setProducts(prev => [...prev, ...items]);
            }

            setHasMore(data.has_more ?? false);
            setTotal(data.total ?? 0);
            skipRef.current += items.length;
        } catch (err) {
            if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
                // Request was aborted, ignore
                return;
            }
            console.error('usePOSCatalog fetchPage error:', err);
        } finally {
            if (!controller.signal.aborted) {
                setIsLoading(false);
                setIsLoadingMore(false);
            }
        }
    }, [search, categoryId, warehouseId]);

    // Load more for infinite scroll
    const loadMore = useCallback(() => {
        if (hasMore && !isLoadingMore) {
            fetchPage(false);
        }
    }, [hasMore, isLoadingMore, fetchPage]);

    // Re-fetch on filter changes
    useEffect(() => {
        fetchPage(true);
    }, [search, categoryId, warehouseId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Cleanup abort controller on unmount
    useEffect(() => {
        return () => {
            if (abortRef.current) abortRef.current.abort();
        };
    }, []);

    // Lookup a product by SKU or ID — checks cache first, then calls server
    const lookupProduct = useCallback(async (skuOrId) => {
        if (!skuOrId) return null;

        // Check cache by SKU
        const bySku = productCache.current.get(`sku:${skuOrId}`);
        if (bySku) return bySku;

        // Check cache by ID
        const byId = productCache.current.get(Number(skuOrId)) || productCache.current.get(skuOrId);
        if (byId) return byId;

        // Detectar si es un IMEI (14-16 dígitos numéricos)
        const isImei = typeof skuOrId === 'string' && /^\d{14,16}$/.test(skuOrId.trim());

        // Cache miss — call server
        try {
            if (isImei) {
                // Buscar por IMEI en inventario serializado
                const { data } = await apiClient.get('/inventory/lookup-imei', { params: { imei: skuOrId.trim() } });
                if (data?.product) {
                    const product = { ...data.product, _imei_status: data.status, _imei: data.imei };
                    productCache.current.set(product.id, product);
                    return product;
                }
            } else {
                // Si es un número JS (llamada interna por product_id) usar product_id.
                // Si es string —incluso numérico— tratarlo como SKU/barcode.
                const params = typeof skuOrId === 'number'
                    ? { product_id: skuOrId }
                    : { sku: skuOrId };
                const { data } = await apiClient.get('/products/lookup', { params });

                if (data) {
                    productCache.current.set(data.id, data);
                    if (data.sku) productCache.current.set(`sku:${data.sku}`, data);
                    return data;
                }
            }
        } catch (err) {
            if (err.response?.status !== 404) {
                console.error('lookupProduct error:', err);
            }
        }
        return null;
    }, []);

    // Synchronous cache get by product ID
    const getFromCache = useCallback((productId) => {
        return productCache.current.get(productId) || null;
    }, []);

    // Refresh a single product from server and update cache + products array
    const refreshProduct = useCallback(async (productId) => {
        if (!productId) return;
        try {
            const { data } = await apiClient.get('/products/lookup', {
                params: { product_id: productId },
            });
            if (data) {
                productCache.current.set(data.id, data);
                if (data.sku) productCache.current.set(`sku:${data.sku}`, data);

                setProducts(prev =>
                    prev.map(p => (p.id === data.id ? data : p))
                );
            }
        } catch (err) {
            console.error('refreshProduct error:', err);
        }
    }, []);

    return {
        products,
        isLoading,
        isLoadingMore,
        hasMore,
        total,
        loadMore,
        setSearch,
        setCategoryId,
        setWarehouseId,
        lookupProduct,
        getFromCache,
        refreshProduct,
        search,
        categoryId,
    };
};

export default usePOSCatalog;
