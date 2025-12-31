import React, { useState, useEffect } from 'react';
import { Search, Package, AlertCircle, CheckCircle, XCircle, DollarSign, ArrowLeft, RefreshCw, X } from 'lucide-react';
import apiClient from '../../config/axios';
import { useConfig } from '../../context/ConfigContext';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';

const ReturnsManager = () => {
    const { currencies } = useConfig();
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
            const response = await apiClient.get(`/returns/sales/search?q=${searchQuery}`);
            setSearchResults(response.data);
            if (response.data.length === 0) {
                toast.error(`No se encontraron ventas con "${searchQuery}"`);
            }
        } catch (error) {
            console.error('Error searching sales:', error);
            toast.error('Error al buscar ventas');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectSale = async (sale) => {
        setLoading(true);
        try {
            const response = await apiClient.get(`/returns/sales/${sale.id}`);
            setSelectedSale(sale);
            // setSaleDetails(response.data); // Removed unused state

            const items = response.data.details.map(detail => ({
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
            toast.error('Error al cargar detalles');
        } finally {
            setLoading(false);
        }
    };

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
        if (refundCurrency === 'USD') return total;
        return total * exchangeRate;
    };

    const handleProcessReturn = async () => {
        const itemsToReturn = returnItems.filter(item => item.quantity_to_return > 0);

        if (itemsToReturn.length === 0) return toast.error('Seleccione al menos un producto');
        if (!cashSessionOpen) return toast.error('Caja cerrada: No se puede procesar');

        if (!window.confirm(`¿Confirmar devolución por ${refundCurrency} ${getRefundAmount().toFixed(2)}?`)) return;

        setLoading(true);
        try {
            const payload = {
                sale_id: selectedSale.id,
                items: itemsToReturn.map(item => ({
                    product_id: item.product_id,
                    quantity: item.quantity_to_return,
                    condition: item.condition
                })),
                reason: reason || 'Devolución de cliente',
                refund_currency: refundCurrency,
                exchange_rate: exchangeRate
            };

            await apiClient.post('/returns', payload);
            toast.success('Devolución procesada exitosamente');

            // Reset
            setStep(1);
            setSelectedSale(null);
            setReturnItems([]);
            setSearchQuery('');
            setSearchResults([]);
            setReason('');
        } catch (error) {
            console.error('Error processing return:', error);
            toast.error(error.response?.data?.detail || 'Error al procesar devolución');
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
        <div className="h-[calc(100vh-64px)] flex flex-col bg-slate-50 p-6 overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Gestión de Devoluciones</h1>
                    <p className="text-slate-500 font-medium">Procesar devoluciones y reembolsos</p>
                </div>
                {!cashSessionOpen && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-2 flex items-center gap-3">
                        <AlertCircle className="text-rose-600" size={20} />
                        <div>
                            <p className="font-bold text-rose-800 text-sm">Caja Cerrada</p>
                            <p className="text-rose-600 text-xs">No se pueden procesar reembolsos</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-1 flex overflow-hidden gap-6">
                {step === 1 ? (
                    // STEP 1: Search Sales
                    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col items-center justify-center min-h-[200px]">
                            <h2 className="text-xl font-bold text-slate-800 mb-6">Buscar Venta Original</h2>
                            <div className="flex w-full max-w-2xl gap-3 relative">
                                <Search className="absolute left-4 top-4 text-slate-400" size={20} />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                    placeholder="Buscar por Nro de Factura, Cédula o Nombre del Cliente..."
                                    className="flex-1 pl-12 pr-4 py-3.5 border border-slate-200 rounded-xl text-lg focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none shadow-sm transition-all"
                                    autoFocus
                                />
                                <button
                                    onClick={handleSearch}
                                    disabled={loading}
                                    className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                                >
                                    {loading ? <RefreshCw className="animate-spin" /> : <Search />}
                                    Buscar
                                </button>
                            </div>
                        </div>

                        {/* Search Results */}
                        <div className="flex-1 overflow-y-auto bg-white rounded-2xl shadow-sm border border-slate-200 relative">
                            {searchResults.length > 0 ? (
                                <table className="w-full">
                                    <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                                        <tr>
                                            <th className="text-left p-4 font-bold text-slate-600">Nro. Venta</th>
                                            <th className="text-left p-4 font-bold text-slate-600">Fecha</th>
                                            <th className="text-left p-4 font-bold text-slate-600">Cliente</th>
                                            <th className="text-right p-4 font-bold text-slate-600">Total</th>
                                            <th className="text-right p-4 font-bold text-slate-600">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {searchResults.map(sale => (
                                            <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="p-4 font-bold text-slate-800">#{sale.id}</td>
                                                <td className="p-4 text-slate-600">{new Date(sale.date).toLocaleDateString()}</td>
                                                <td className="p-4 text-slate-600 font-medium">{sale.customer?.name || 'Cliente General'}</td>
                                                <td className="p-4 text-right font-black text-slate-800">${Number(sale.total_amount).toFixed(2)}</td>
                                                <td className="p-4 text-right">
                                                    <button
                                                        onClick={() => handleSelectSale(sale)}
                                                        className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg font-bold transition-colors text-sm"
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
                                    <Package size={64} className="mb-4 opacity-50 text-indigo-200" />
                                    <p className="font-medium text-lg">
                                        {searchQuery && !loading ? 'No se encontraron ventas' : 'Ingrese un término de búsqueda para comenzar'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    // STEP 2: Select Items
                    <>
                        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">Seleccionar Items a Devolver</h2>
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

                            <div className="flex-1 overflow-y-auto p-0">
                                <table className="w-full">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="text-left p-4 font-bold text-slate-600 text-sm uppercase">Producto</th>
                                            <th className="text-center p-4 font-bold text-slate-600 text-sm uppercase">Comprado</th>
                                            <th className="text-center p-4 font-bold text-slate-600 text-sm uppercase w-32">Cant. Devolver</th>
                                            <th className="text-center p-4 font-bold text-slate-600 text-sm uppercase">Condición</th>
                                            <th className="text-right p-4 font-bold text-slate-600 text-sm uppercase">Reembolso</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {returnItems.map((item, index) => (
                                            <tr key={index} className={clsx("hover:bg-slate-50 transition-colors", item.quantity_to_return > 0 && "bg-blue-50/30")}>
                                                <td className="p-4 font-bold text-slate-700">{item.product_name}</td>
                                                <td className="p-4 text-center font-mono text-slate-500">{item.quantity_sold}</td>
                                                <td className="p-4">
                                                    <input
                                                        type="number"
                                                        value={item.quantity_to_return || ''}
                                                        onChange={(e) => handleQuantityChange(index, e.target.value)}
                                                        min="0"
                                                        max={item.quantity_sold}
                                                        step="0.01"
                                                        className="w-full p-2 border border-slate-200 rounded-lg text-center font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                    />
                                                </td>
                                                <td className="p-4 flex justify-center">
                                                    <div className="flex bg-slate-100 p-1 rounded-lg">
                                                        <button
                                                            onClick={() => handleConditionChange(index, 'GOOD')}
                                                            title="Buen Estado"
                                                            className={clsx(
                                                                "p-1.5 rounded-md transition-all",
                                                                item.condition === 'GOOD' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                                            )}
                                                        >
                                                            <CheckCircle size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleConditionChange(index, 'DAMAGED')}
                                                            title="Dañado"
                                                            className={clsx(
                                                                "p-1.5 rounded-md transition-all",
                                                                item.condition === 'DAMAGED' ? "bg-white text-rose-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                                            )}
                                                        >
                                                            <XCircle size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right font-black text-slate-800">
                                                    ${item.subtotal.toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="p-4 border-t border-slate-200 bg-slate-50/50">
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

                        {/* RIGHT Sidebar Summary */}
                        <div className="w-[360px] flex flex-col gap-4">
                            <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 p-6 flex flex-col h-full">
                                <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                                    <RefreshCw className="text-indigo-600" /> Resumen
                                </h3>

                                <div className="space-y-6 flex-1">
                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                        <p className="text-slate-500 text-xs font-bold uppercase mb-1">Total USD</p>
                                        <p className="text-3xl font-black text-slate-800">${calculateTotal().toFixed(2)}</p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Moneda de Reembolso</label>
                                        <select
                                            value={refundCurrency}
                                            onChange={(e) => {
                                                const selectedSymbol = e.target.value;
                                                setRefundCurrency(selectedSymbol);
                                                const currency = currencies.find(c => c.symbol === selectedSymbol);
                                                if (currency) setExchangeRate(currency.rate || 1.0);
                                            }}
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-indigo-500"
                                        >
                                            {currencies.map(currency => (
                                                <option key={currency.id} value={currency.symbol}>{currency.symbol} - {currency.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {refundCurrency !== 'USD' && (
                                        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                                            <p className="text-indigo-600 text-xs font-bold uppercase mb-1">A Reembolsar</p>
                                            <p className="text-2xl font-black text-indigo-700">
                                                {refundCurrency} {getRefundAmount().toFixed(2)}
                                            </p>
                                            <p className="text-indigo-400 text-xs font-medium mt-1">
                                                Tasa: {exchangeRate.toFixed(2)}
                                            </p>
                                        </div>
                                    )}

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
                                    className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none mt-6 flex justify-center items-center gap-2"
                                >
                                    {loading ? <RefreshCw className="animate-spin" /> : <DollarSign />}
                                    {loading ? 'Procesando...' : 'Reembolsar'}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ReturnsManager;
