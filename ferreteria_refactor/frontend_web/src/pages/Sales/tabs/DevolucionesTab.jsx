import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Package, AlertCircle, CheckCircle, XCircle, DollarSign, ArrowLeft, RefreshCw, Plus, Trash2, Repeat2 } from 'lucide-react';
import apiClient from '../../../config/axios';
import { useConfig } from '../../../context/ConfigContext';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'react-hot-toast';
import { getApiErrorMessage } from '../../../utils/apiErrors';
import clsx from 'clsx';
import SerializedItemModal from '../../../components/pos/SerializedItemModal';

const DevolucionesTab = () => {
    const { user } = useAuth();
    const { currencies, paymentMethods = [] } = useConfig();
    const [searchParams] = useSearchParams();
    const autoLoadedSaleRef = useRef(null);
    const [step, setStep] = useState(1); // 1: Search, 2: Select Items
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedSale, setSelectedSale] = useState(null);
    const [returnItems, setReturnItems] = useState([]);
    const [refundCurrency, setRefundCurrency] = useState('USD');
    const [exchangeRate, setExchangeRate] = useState(1.0);
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [cashSessionOpen, setCashSessionOpen] = useState(true);
    const [resolutionType, setResolutionType] = useState('REFUND');
    const [productSearch, setProductSearch] = useState('');
    const [productResults, setProductResults] = useState([]);
    const [searchingProducts, setSearchingProducts] = useState(false);
    const [replacementItems, setReplacementItems] = useState([]);
    const [serializedReplacement, setSerializedReplacement] = useState(null);
    const [differenceCurrency, setDifferenceCurrency] = useState('USD');
    const [differenceReference, setDifferenceReference] = useState('');

    useEffect(() => {
        checkCashSession();
        if (currencies.length > 0) {
            const defaultCurr = currencies.find(c => c.symbol === 'Bs' || c.symbol === 'VES') || currencies[0];
            if (defaultCurr) {
                setRefundCurrency(defaultCurr.symbol);
                setExchangeRate(defaultCurr.rate || 1);
            }
        }
    }, [currencies]);

    const checkCashSession = async () => {
        try {
            const response = await apiClient.get('/cash/sessions/current');
            setCashSessionOpen(response.data.status === 'OPEN');
        } catch (error) {
            setCashSessionOpen(false);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            toast.error('Ingrese un número de venta o nombre');
            return;
        }

        setLoading(true);
        try {
            const response = await apiClient.get('/returns/sales/search', { params: { q: searchQuery, limit: 200 } });
            const items = response.data?.items || [];
            setSearchResults(items);
            if (items.length === 0) {
                toast.error(`No se encontraron ventas con "${searchQuery}"`);
            }
        } catch (error) {
            console.error('Error searching sales:', error);
            toast.error(getApiErrorMessage(error, 'Error al buscar ventas'));
        } finally {
            setLoading(false);
        }
    };

    const handleSelectSale = async (sale) => {
        setLoading(true);
        try {
            const response = await apiClient.get(`/returns/sales/${sale.id}`);
            const fullSale = response.data;
            setSelectedSale(fullSale);

            const saleCurrency = String(fullSale.currency || '').toUpperCase();
            const paidInVes = saleCurrency === 'BS' || saleCurrency === 'VES' || /VES|BS|BOLIVAR/i.test(fullSale.payment_method || '');
            if (paidInVes) {
                const ves = currencies.find(c => c.currency_code === 'VES' || c.symbol === 'Bs' || c.symbol === 'VES');
                setRefundCurrency(ves?.symbol || 'Bs');
                setExchangeRate(Number(fullSale.exchange_rate_used || ves?.rate || 1));
            } else {
                setRefundCurrency('USD');
                setExchangeRate(1);
            }

            const items = fullSale.details.map(detail => ({
                product_id: detail.product_id,
                product_name: detail.product?.name || 'N/A',
                quantity_sold: detail.quantity,
                quantity_to_return: 0,
                condition: 'GOOD',
                unit_price: detail.unit_price,
                subtotal: 0
            }));
            setReturnItems(items);
            setStep(2);
        } catch (error) {
            console.error('Error fetching sale details:', error);
            toast.error(getApiErrorMessage(error, 'Error al cargar detalles'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const saleId = searchParams.get('sale');
        if (!saleId || autoLoadedSaleRef.current === saleId) return;
        autoLoadedSaleRef.current = saleId;
        setSearchQuery(saleId);
        handleSelectSale({ id: saleId });
    }, [searchParams]);

    const handleQuantityChange = (index, value) => {
        const newItems = [...returnItems];
        const qty = parseFloat(value) || 0;
        const maxQty = newItems[index].quantity_sold;

        newItems[index].quantity_to_return = Math.min(qty, maxQty);
        newItems[index].subtotal = newItems[index].quantity_to_return * newItems[index].unit_price;
        setReturnItems(newItems);
    };

    const handleConditionChange = (index, condition) => {
        const newItems = [...returnItems];
        newItems[index].condition = condition;
        setReturnItems(newItems);
    };

    const calculateTotal = () => {
        return returnItems.reduce((sum, item) => sum + item.subtotal, 0);
    };

    const getRefundAmount = () => {
        const total = calculateTotal();
        if (refundCurrency === 'USD') return Number(total);
        return Number(total) * Number(exchangeRate);
    };

    const formatUsd = (value) => `$${Number(value || 0).toFixed(2)}`;

    const calculateReplacementTotal = () => {
        return replacementItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    };

    const calculateExchange = () => {
        const returnTotal = Number(calculateTotal() || 0);
        const replacementTotal = Number(calculateReplacementTotal() || 0);
        const creditApplied = Math.min(returnTotal, replacementTotal);
        return {
            returnTotal,
            replacementTotal,
            creditApplied,
            differenceDue: Math.max(0, replacementTotal - creditApplied),
            cashRefund: Math.max(0, returnTotal - creditApplied),
        };
    };

    const searchReplacementProducts = async () => {
        const q = productSearch.trim();
        if (q.length < 2) return;
        setSearchingProducts(true);
        try {
            const { data } = await apiClient.get('/products/', { params: { search: q, limit: 12 } });
            setProductResults(data.items || data || []);
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'No se pudieron buscar productos'));
        } finally {
            setSearchingProducts(false);
        }
    };

    const addReplacementProduct = (product, serials = []) => {
        const price = Number(product.price || product.price_usd || 0);
        const qty = serials.length > 0 ? serials.length : 1;
        const key = serials.length > 0 ? `${product.id}-${serials.join('-')}` : String(product.id);
        setReplacementItems(prev => {
            const existingIndex = prev.findIndex(i => i.key === key && !product.has_imei);
            if (existingIndex >= 0) {
                const next = [...prev];
                const item = next[existingIndex];
                item.quantity += 1;
                item.subtotal = item.quantity * item.unit_price;
                return next;
            }
            return [...prev, {
                key,
                product_id: product.id,
                name: product.name,
                sku: product.sku,
                has_imei: !!product.has_imei,
                serial_numbers: serials,
                quantity: qty,
                unit_price: price,
                subtotal: price * qty,
            }];
        });
        setProductSearch('');
        setProductResults([]);
    };

    const handleReplacementProductClick = (product) => {
        if (product.has_imei) {
            setSerializedReplacement(product);
            return;
        }
        addReplacementProduct(product);
    };

    const updateReplacementQty = (key, value) => {
        const qty = Math.max(0, Number(value) || 0);
        setReplacementItems(prev => prev.map(item => item.key === key
            ? { ...item, quantity: qty, subtotal: qty * Number(item.unit_price || 0) }
            : item
        ).filter(item => item.quantity > 0));
    };

    const removeReplacementItem = (key) => {
        setReplacementItems(prev => prev.filter(item => item.key !== key));
    };

    const getDifferencePaymentMethod = () => {
        const active = paymentMethods.filter(m => m.is_active !== false);
        if (differenceCurrency === 'USD') {
            return active.find(m => /usd|dolar/i.test(m.name))?.name || active[0]?.name || 'Efectivo USD';
        }
        return active.find(m => /ves|bs|bolivar|efectivo/i.test(m.name) && !/usd/i.test(m.name))?.name || active[0]?.name || 'Efectivo VES';
    };

    const handleProcessReturn = async () => {
        const itemsToReturn = returnItems.filter(item => item.quantity_to_return > 0);

        if (itemsToReturn.length === 0) return toast.error('Seleccione al menos un producto');
        if (!cashSessionOpen) return toast.error('Caja cerrada: No se puede procesar');

        const exchange = calculateExchange();
        if (resolutionType === 'EXCHANGE' && replacementItems.length === 0) {
            return toast.error('Agrega al menos un producto de reemplazo para el canje');
        }

        const confirmMessage = resolutionType === 'EXCHANGE'
            ? `Confirmar canje: credito ${formatUsd(exchange.creditApplied)}, diferencia ${formatUsd(exchange.differenceDue)}, efectivo a devolver ${formatUsd(exchange.cashRefund)}.`
            : `Confirmar devolucion por ${refundCurrency} ${Number(getRefundAmount()).toFixed(2)}?`;

        if (!window.confirm(confirmMessage)) return;

        setLoading(true);
        try {
            const basePayload = {
                sale_id: selectedSale.id,
                items: itemsToReturn.map(item => ({
                    product_id: item.product_id,
                    quantity: item.quantity_to_return,
                    condition: item.condition
                })),
                reason: reason || 'Devolucion de cliente',
                refund_currency: refundCurrency,
                exchange_rate: exchangeRate
            };

            if (resolutionType === 'EXCHANGE') {
                const differenceAmount = differenceCurrency === 'USD'
                    ? exchange.differenceDue
                    : exchange.differenceDue * Number(exchangeRate || 1);
                const diffPayments = exchange.differenceDue > 0.005 ? [{
                    amount: Number(differenceAmount.toFixed(2)),
                    currency: differenceCurrency === 'USD' ? 'USD' : 'VES',
                    payment_method: getDifferencePaymentMethod(),
                    exchange_rate: differenceCurrency === 'USD' ? 1 : Number(exchangeRate || 1),
                    reference: differenceReference || null,
                }] : [];
                const replacementSale = {
                    customer_id: selectedSale?.customer?.id || selectedSale?.customer_id || null,
                    payment_method: exchange.differenceDue > 0.005 ? getDifferencePaymentMethod() : 'Canje',
                    payments: diffPayments,
                    items: replacementItems.map(item => ({
                        product_id: item.product_id,
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        subtotal: item.subtotal,
                        serial_numbers: item.serial_numbers || [],
                        conversion_factor: 1,
                    })),
                    total_amount: Number(exchange.replacementTotal.toFixed(2)),
                    total_amount_bs: Number((exchange.replacementTotal * Number(exchangeRate || 1)).toFixed(2)),
                    change_amount: 0,
                    change_currency: 'USD',
                    currency: 'USD',
                    exchange_rate: Number(exchangeRate || 1),
                    notes: `Canje desde devolucion de venta #${selectedSale.id}`,
                    is_credit: false,
                    warehouse_id: selectedSale?.warehouse_id || null,
                };

                const { data } = await apiClient.post('/returns/exchange', {
                    ...basePayload,
                    resolution_type: 'EXCHANGE',
                    replacement_sale: replacementSale,
                });
                toast.success(`Canje procesado. Venta reemplazo #${data.replacement_sale_id}`);
            } else {
                await apiClient.post('/returns', basePayload);
                toast.success('Devolucion procesada exitosamente');
            }

            // Reset
            setStep(1);
            setSelectedSale(null);
            setReturnItems([]);
            setSearchQuery('');
            setSearchResults([]);
            setReason('');
            setResolutionType('REFUND');
            setReplacementItems([]);
            setProductSearch('');
            setProductResults([]);
            setDifferenceReference('');
        } catch (error) {
            console.error('Error processing return:', error);
            toast.error(getApiErrorMessage(error, 'Error al procesar devolucion'));
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        setStep(1);
        setSelectedSale(null);
        setReturnItems([]);
    };

    return (
        <>
        <div id="tour-returns-container" className="flex flex-col bg-slate-50 p-3 overflow-hidden flex-1">
            {/* Header */}
            <div className="flex justify-between items-center mb-2 flex-shrink-0">
                <div>
                    <p className="text-slate-500 font-medium">Procesar devoluciones y reembolsos</p>
                </div>
                {!cashSessionOpen && (
                    <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-center gap-2">
                        <AlertCircle className="text-rose-600" size={20} />
                        <div>
                            <p className="font-bold text-rose-800 text-sm">Caja Cerrada</p>
                            <p className="text-rose-600 text-xs">No se pueden procesar reembolsos</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-1 flex overflow-hidden gap-2">
                {step === 1 ? (
                    // STEP 1: Search Sales
                    <div className="w-full max-w-6xl mx-auto flex flex-col gap-2">
                        <div id="tour-returns-search-panel" className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 flex flex-col items-center justify-center">
                            <h2 className="text-lg font-black text-slate-800 mb-3">Buscar Venta Original</h2>
                            <div className="flex w-full max-w-3xl gap-2 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    id="tour-returns-search-input"
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                    placeholder="Buscar por Nro de Factura, Cédula o Nombre del Cliente..."
                                    className="flex-1 h-10 pl-10 pr-3 border border-slate-200 rounded-md text-sm font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none shadow-sm transition-all"
                                    autoFocus
                                />
                                <button
                                    id="tour-returns-search-btn"
                                    onClick={handleSearch}
                                    disabled={loading}
                                    className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-bold flex items-center gap-2 shadow-sm shadow-indigo-100 transition-all active:scale-95"
                                >
                                    {loading ? <RefreshCw className="animate-spin" /> : <Search />}
                                    Buscar
                                </button>
                            </div>
                        </div>

                        {/* Search Results */}
                        <div id="tour-returns-results" className="flex-1 min-h-[420px] overflow-y-auto bg-white rounded-lg shadow-sm border border-slate-200 relative">
                            {searchResults.length > 0 ? (
                                <table className="w-full">
                                    <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                                        <tr>
                                            <th className="text-left p-3 font-bold text-slate-600">Nro. Venta</th>
                                            <th className="text-left p-3 font-bold text-slate-600">Fecha</th>
                                            <th className="text-left p-3 font-bold text-slate-600">Cliente</th>
                                            <th className="text-right p-3 font-bold text-slate-600">Total</th>
                                            <th className="text-right p-3 font-bold text-slate-600">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {searchResults.map(sale => (
                                            <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="p-3 font-bold text-slate-800">#{sale.id}</td>
                                                <td className="p-3 text-slate-600">{new Date(sale.date).toLocaleDateString()}</td>
                                                <td className="p-3 text-slate-600 font-medium">{sale.customer?.name || 'Cliente General'}</td>
                                                <td className="p-3 text-right font-black text-slate-800">${Number(sale.total_amount || 0).toFixed(2)}</td>
                                                <td className="p-3 text-right">
                                                    <button
                                                        onClick={() => handleSelectSale(sale)}
                                                        className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-md font-bold transition-colors text-sm"
                                                    >
                                                        Seleccionar
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-10">
                                    <Package size={42} className="mb-3 opacity-50 text-indigo-200" />
                                    <p className="text-sm font-bold">
                                        {searchQuery && !loading ? 'No se encontraron ventas' : 'Ingrese un término de búsqueda para comenzar'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    // STEP 2: Select Items
                    <>
                        <div id="tour-returns-items" className="flex-1 bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                            <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div>
                                    <h2 className="text-base font-black text-slate-800">Seleccionar Items a Devolver</h2>
                                    <p className="text-sm text-slate-500 font-medium">Venta #{selectedSale?.id} - {new Date(selectedSale?.date).toLocaleDateString()}</p>
                                </div>
                                <button
                                    onClick={handleBack}
                                    className="flex items-center text-slate-500 hover:text-slate-800 font-bold bg-white border border-slate-200 px-3 py-1.5 rounded-lg transition-colors text-sm hover:shadow-sm"
                                >
                                    <ArrowLeft size={16} className="mr-2" />
                                    Volver
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-50/40">
                                {returnItems.map((item, index) => (
                                    <div
                                        key={index}
                                        className={clsx(
                                            "rounded-lg border bg-white p-3 shadow-sm transition-all",
                                            item.quantity_to_return > 0 ? "border-indigo-200 ring-2 ring-indigo-500/10" : "border-slate-200 hover:border-indigo-100"
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-base font-black leading-snug text-slate-800 break-words">{item.product_name}</p>
                                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                                                    <span className="rounded-md bg-slate-100 px-2 py-1">Comprado: {Number(item.quantity_sold || 0).toLocaleString()}</span>
                                                    <span className="rounded-md bg-indigo-50 px-2 py-1 text-indigo-700">Reembolso: ${Number(item.subtotal || 0).toFixed(2)}</span>
                                                </div>
                                            </div>
                                            <input
                                                type="number"
                                                value={item.quantity_to_return || ''}
                                                onChange={(e) => handleQuantityChange(index, e.target.value)}
                                                min="0"
                                                max={item.quantity_sold}
                                                step="0.01"
                                                className="h-11 w-20 shrink-0 rounded-lg border border-slate-200 bg-white text-center text-base font-black text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                            />
                                        </div>

                                        <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-2">
                                            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Condicion</span>
                                            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleConditionChange(index, 'GOOD')}
                                                    title="Buen Estado"
                                                    className={clsx(
                                                        "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black transition-all",
                                                        item.condition === 'GOOD' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                                    )}
                                                >
                                                    <CheckCircle size={16} /> Bueno
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleConditionChange(index, 'DAMAGED')}
                                                    title="Danado"
                                                    className={clsx(
                                                        "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black transition-all",
                                                        item.condition === 'DAMAGED' ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                                    )}
                                                >
                                                    <XCircle size={16} /> Danado
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-3 border-t border-slate-200 bg-slate-50/50">
                                <label className="block text-sm font-bold text-slate-500 mb-2 px-1">
                                    Motivo de Devolución
                                </label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none resize-none bg-white text-sm"
                                    rows="1"
                                    placeholder="Ej: Producto defectuoso..."
                                />
                            </div>
                        </div>

                        {resolutionType === 'EXCHANGE' && (
                            <div className="w-[380px] flex flex-col gap-2">
                                <div id="tour-returns-replacement" className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 flex flex-col gap-2 max-h-full overflow-hidden">
                                    <div className="flex items-center justify-between gap-3">
                                        <h3 className="text-base font-black text-slate-800 flex items-center gap-2"><Repeat2 className="text-indigo-600" size={18} /> Producto de reemplazo</h3>
                                        <span className="rounded-md bg-indigo-50 px-2 py-1 text-xs font-black text-indigo-700">${calculateReplacementTotal().toFixed(2)}</span>
                                    </div>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-3 text-slate-400" size={16} />
                                        <input
                                            value={productSearch}
                                            onChange={e => setProductSearch(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && searchReplacementProducts()}
                                            placeholder="Buscar producto para canje..."
                                            className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={searchReplacementProducts}
                                        disabled={searchingProducts || productSearch.trim().length < 2}
                                        className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                                    >
                                        {searchingProducts ? 'Buscando...' : 'Buscar reemplazo'}
                                    </button>
                                    {productResults.length > 0 && (
                                        <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200">
                                            {productResults.map(product => (
                                                <button key={product.id} type="button" onClick={() => handleReplacementProductClick(product)} className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-indigo-50">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-black text-slate-800">{product.name}</p>
                                                        <p className="text-xs text-slate-400">{product.sku || 'Sin SKU'} {product.has_imei ? 'IMEI' : ''}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-black text-indigo-700">${Number(product.price || 0).toFixed(2)}</span>
                                                        <Plus size={15} className="text-indigo-500" />
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/60">
                                        {replacementItems.length === 0 ? (
                                            <div className="p-5 text-center text-sm font-medium text-slate-400">Agrega productos para completar el canje.</div>
                                        ) : replacementItems.map(item => (
                                            <div key={item.key} className="flex items-center gap-3 border-b border-slate-100 bg-white px-3 py-2 last:border-b-0">
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-black text-slate-800">{item.name}</p>
                                                    <p className="text-xs text-slate-400">${Number(item.unit_price).toFixed(2)} {item.serial_numbers?.length ? `IMEI ${item.serial_numbers.join(', ')}` : ''}</p>
                                                </div>
                                                {item.has_imei ? (
                                                    <span className="w-12 text-center text-sm font-black text-indigo-700">{item.quantity}</span>
                                                ) : (
                                                    <input type="number" min="1" value={item.quantity} onChange={e => updateReplacementQty(item.key, e.target.value)} className="h-8 w-14 rounded-md border border-slate-200 text-center text-sm font-bold" />
                                                )}
                                                <span className="w-16 text-right text-sm font-black text-slate-800">${Number(item.subtotal).toFixed(2)}</span>
                                                <button type="button" onClick={() => removeReplacementItem(item.key)} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
                                            </div>
                                        ))}
                                    </div>
                                    {calculateExchange().differenceDue > 0.005 && (
                                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                                            <p className="text-xs font-black uppercase tracking-wider text-amber-700">Diferencia a cobrar</p>
                                            <p className="mt-1 text-2xl font-black text-amber-800">${calculateExchange().differenceDue.toFixed(2)}</p>
                                            <div className="mt-2 grid grid-cols-2 gap-2">
                                                <button type="button" onClick={() => setDifferenceCurrency('USD')} className={clsx('rounded-md border px-2 py-1.5 text-xs font-black', differenceCurrency === 'USD' ? 'border-amber-600 bg-amber-600 text-white' : 'border-amber-200 bg-white text-amber-700')}>USD</button>
                                                <button type="button" onClick={() => setDifferenceCurrency('Bs')} className={clsx('rounded-md border px-2 py-1.5 text-xs font-black', differenceCurrency !== 'USD' ? 'border-amber-600 bg-amber-600 text-white' : 'border-amber-200 bg-white text-amber-700')}>Bs</button>
                                            </div>
                                            <input value={differenceReference} onChange={e => setDifferenceReference(e.target.value)} placeholder="Referencia si aplica" className="mt-2 w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-xs font-bold outline-none" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* RIGHT Sidebar Summary */}
                        <div className="w-[320px] flex flex-col gap-2">
                            <div id="tour-returns-summary" className="bg-white rounded-lg shadow-sm border border-indigo-100 p-3 flex flex-col h-full">
                                <h3 className="text-lg font-black text-slate-800 mb-3 flex items-center gap-2">
                                    <RefreshCw className="text-indigo-600" /> Resumen
                                </h3>

                                <div className="space-y-2 flex-1">
                                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                        <p className="text-slate-500 text-xs font-bold uppercase mb-1">Total USD</p>
                                        <p className="text-2xl font-black text-slate-800">${Number(calculateTotal() || 0).toFixed(2)}</p>
                                    </div>

                                    <div id="tour-returns-resolution" className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                                        <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">Resolucion</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setResolutionType('REFUND')}
                                                className={clsx('rounded-lg border px-3 py-2 text-xs font-black transition-all', resolutionType === 'REFUND' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200')}
                                            >
                                                Reembolso
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setResolutionType('EXCHANGE')}
                                                className={clsx('rounded-lg border px-3 py-2 text-xs font-black transition-all', resolutionType === 'EXCHANGE' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200')}
                                            >
                                                Canje
                                            </button>
                                        </div>
                                    </div>

                                    {resolutionType === 'EXCHANGE' && (
                                        <div className="rounded-lg border border-indigo-100 bg-white p-3 space-y-2">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="font-bold text-slate-500">Reemplazo</span>
                                                <span className="font-black text-slate-800">{formatUsd(calculateExchange().replacementTotal)}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="font-bold text-slate-500">Credito aplicado</span>
                                                <span className="font-black text-emerald-700">{formatUsd(calculateExchange().creditApplied)}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="font-bold text-slate-500">Diferencia</span>
                                                <span className="font-black text-amber-700">{formatUsd(calculateExchange().differenceDue)}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm border-t border-slate-100 pt-3">
                                                <span className="font-bold text-slate-500">Efectivo a devolver</span>
                                                <span className="font-black text-indigo-700">{formatUsd(calculateExchange().cashRefund)}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Refund Info Component */}
                                    <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-lg flex flex-col gap-2">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm font-bold text-indigo-500 uppercase">Moneda de Reembolso</span>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        setRefundCurrency('USD');
                                                        setExchangeRate(1.0);
                                                    }}
                                                    className={clsx(
                                                        "text-xs px-4 py-1.5 rounded-lg font-black border-2 transition-all",
                                                        refundCurrency === 'USD' ? "bg-indigo-600 text-white border-indigo-600 shadow-md scale-105" : "bg-white text-indigo-400 border-indigo-100 hover:bg-slate-50"
                                                    )}
                                                >
                                                    💵 USD
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const ves = currencies.find(c => c.currency_code === 'VES' || c.symbol === 'Bs' || c.symbol === 'VES');
                                                        setRefundCurrency(ves ? ves.symbol : 'Bs');
                                                        setExchangeRate(ves ? ves.rate : 1.0);
                                                    }}
                                                    className={clsx(
                                                        "text-xs px-4 py-1.5 rounded-lg font-black border-2 transition-all",
                                                        (refundCurrency === 'Bs' || refundCurrency === 'VES') ? "bg-indigo-600 text-white border-indigo-600 shadow-md scale-105" : "bg-white text-indigo-400 border-indigo-100 hover:bg-slate-50"
                                                    )}
                                                >
                                                    🇻🇪 BS
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex items-baseline gap-2">
                                            <p className="text-2xl font-black text-indigo-800">
                                                {refundCurrency === 'USD' ? '$' : 'Bs. '}
                                                {Number(getRefundAmount() || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </p>
                                        </div>

                                        {(refundCurrency === 'Bs' || refundCurrency === 'VES') && (
                                            <p className="text-indigo-400 text-xs font-medium mt-1">
                                                Tasa Usada: {Number(exchangeRate || 1).toFixed(2)}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex justify-between items-center px-2 py-3 border-t border-slate-100 mt-4">
                                        <span className="text-slate-500 font-medium">Items</span>
                                        <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full font-bold text-sm">
                                            {returnItems.filter(i => i.quantity_to_return > 0).length}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleProcessReturn}
                                    disabled={loading || !cashSessionOpen || calculateTotal() === 0}
                                    className="w-full py-3 bg-indigo-600 text-white rounded-md font-bold text-sm hover:bg-indigo-700 shadow-sm shadow-indigo-100 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none mt-3 flex justify-center items-center gap-2"
                                >
                                    {loading ? <RefreshCw className="animate-spin" /> : <DollarSign />}
                                    {loading ? 'Procesando...' : (resolutionType === 'EXCHANGE' ? 'Procesar Canje' : 'Reembolsar')}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>

            <SerializedItemModal
                isOpen={!!serializedReplacement}
                product={serializedReplacement}
                quantity={1}
                title="Escanear IMEI del reemplazo"
                subtitle="Canje de devolucion"
                onClose={() => setSerializedReplacement(null)}
                onConfirm={(serials) => {
                    if (serializedReplacement) addReplacementProduct(serializedReplacement, serials);
                    setSerializedReplacement(null);
                }}
            />
        </>
    );
};

export default DevolucionesTab;
