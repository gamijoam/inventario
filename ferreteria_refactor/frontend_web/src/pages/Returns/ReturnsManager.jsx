import { useState, useEffect } from 'react';
import { Search, Package, AlertCircle, CheckCircle, XCircle, DollarSign, ArrowLeft } from 'lucide-react';
import apiClient from '../../config/axios';
import { useConfig } from '../../context/ConfigContext';

const ReturnsManager = () => {
    const { currencies, getExchangeRate } = useConfig();  // ✅ Use ConfigContext
    const [step, setStep] = useState(1); // 1: Search, 2: Select Items
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedSale, setSelectedSale] = useState(null);
    const [saleDetails, setSaleDetails] = useState(null);
    const [returnItems, setReturnItems] = useState([]);
    const [refundCurrency, setRefundCurrency] = useState('USD');
    const [exchangeRate, setExchangeRate] = useState(1.0);
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [cashSessionOpen, setCashSessionOpen] = useState(true);

    useEffect(() => {
        checkCashSession();
        // Set default currency when currencies are loaded
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
            alert('Por favor ingrese un número de venta o nombre de cliente');
            return;
        }

        setLoading(true);
        try {
            const response = await apiClient.get(`/returns/sales/search?q=${searchQuery}`);
            setSearchResults(response.data);

            if (response.data.length === 0) {
                alert(`No se encontraron ventas con "${searchQuery}"`);
            }
        } catch (error) {
            console.error('Error searching sales:', error);
            alert('Error al buscar ventas. Verifique su conexión.');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectSale = async (sale) => {
        setLoading(true);
        try {
            const response = await apiClient.get(`/returns/sales/${sale.id}`);
            setSelectedSale(sale);
            setSaleDetails(response.data);

            // Initialize return items
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
            alert('Error al cargar detalles de la venta');
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
        if (refundCurrency === 'USD') {
            return total;
        }
        // For any other currency, use the exchange rate
        return total * exchangeRate;
    };

    const handleProcessReturn = async () => {
        const itemsToReturn = returnItems.filter(item => item.quantity_to_return > 0);

        if (itemsToReturn.length === 0) {
            alert('Debe seleccionar al menos un producto para devolver');
            return;
        }

        if (!cashSessionOpen) {
            alert('No hay una caja abierta. No se puede procesar la devolución.');
            return;
        }

        if (!window.confirm(`¿Confirmar devolución por ${refundCurrency} ${getRefundAmount().toFixed(2)}?`)) {
            return;
        }

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
            alert('✅ Devolución procesada exitosamente');

            // Reset
            setStep(1);
            setSelectedSale(null);
            setSaleDetails(null);
            setReturnItems([]);
            setSearchQuery('');
            setSearchResults([]);
            setReason('');
        } catch (error) {
            console.error('Error processing return:', error);
            alert(error.response?.data?.detail || 'Error al procesar devolución');
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        setStep(1);
        setSelectedSale(null);
        setSaleDetails(null);
        setReturnItems([]);
    };

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Gestión de Devoluciones</h1>
                <p className="text-gray-600">Procesar devoluciones y reembolsos</p>
            </div>

            {!cashSessionOpen && (
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6 flex items-center">
                    <AlertCircle className="text-red-600 mr-3" size={24} />
                    <div>
                        <p className="font-bold text-red-800">Caja Cerrada</p>
                        <p className="text-red-700 text-sm">No se pueden procesar devoluciones sin una caja abierta</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-3 gap-6">
                {/* Main Content Area */}
                <div className="col-span-2">
                    {step === 1 ? (
                        // STEP 1: Search Sales
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-xl font-bold text-gray-800 mb-4">Buscar Venta</h2>

                            <div className="flex gap-3 mb-6">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                    placeholder="Buscar por Nro de Factura o Cliente..."
                                    className="flex-1 p-4 border-2 border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <button
                                    onClick={handleSearch}
                                    disabled={loading}
                                    className="px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center transition-colors disabled:opacity-50"
                                >
                                    <Search className="mr-2" size={20} />
                                    Buscar
                                </button>
                            </div>

                            {/* Search Results */}
                            {searchResults.length > 0 && (
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="text-left p-4 font-semibold text-gray-700">Nro. Venta</th>
                                                <th className="text-left p-4 font-semibold text-gray-700">Fecha</th>
                                                <th className="text-left p-4 font-semibold text-gray-700">Cliente</th>
                                                <th className="text-right p-4 font-semibold text-gray-700">Total</th>
                                                <th className="text-right p-4 font-semibold text-gray-700">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {searchResults.map(sale => (
                                                <tr key={sale.id} className="hover:bg-gray-50">
                                                    <td className="p-4 font-medium">#{sale.id}</td>
                                                    <td className="p-4">{new Date(sale.date).toLocaleDateString()}</td>
                                                    <td className="p-4">{sale.customer?.name || 'Cliente General'}</td>
                                                    <td className="p-4 text-right font-bold">${Number(sale.total_amount).toFixed(2)}</td>
                                                    <td className="p-4 text-right">
                                                        <button
                                                            onClick={() => handleSelectSale(sale)}
                                                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                                                        >
                                                            Seleccionar
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {searchResults.length === 0 && searchQuery && !loading && (
                                <div className="text-center py-12 text-gray-500">
                                    <Package size={48} className="mx-auto mb-4 opacity-50" />
                                    <p>No se encontraron ventas</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        // STEP 2: Select Items
                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800">Seleccionar Items a Devolver</h2>
                                    <p className="text-gray-600">Venta #{selectedSale?.id} - {new Date(selectedSale?.date).toLocaleDateString()}</p>
                                </div>
                                <button
                                    onClick={handleBack}
                                    className="flex items-center text-blue-600 hover:text-blue-800 font-medium"
                                >
                                    <ArrowLeft size={20} className="mr-2" />
                                    Volver
                                </button>
                            </div>

                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="text-left p-4 font-semibold text-gray-700">Producto</th>
                                            <th className="text-center p-4 font-semibold text-gray-700">Comprado</th>
                                            <th className="text-center p-4 font-semibold text-gray-700">A Devolver</th>
                                            <th className="text-center p-4 font-semibold text-gray-700">Estado</th>
                                            <th className="text-right p-4 font-semibold text-gray-700">Reembolso</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {returnItems.map((item, index) => (
                                            <tr key={index} className="hover:bg-gray-50">
                                                <td className="p-4 font-medium">{item.product_name}</td>
                                                <td className="p-4 text-center">{item.quantity_sold}</td>
                                                <td className="p-4">
                                                    <input
                                                        type="number"
                                                        value={item.quantity_to_return || ''}
                                                        onChange={(e) => handleQuantityChange(index, e.target.value)}
                                                        min="0"
                                                        max={item.quantity_sold}
                                                        step="0.01"
                                                        className="w-24 p-2 border border-gray-300 rounded text-center focus:ring-2 focus:ring-blue-500 outline-none"
                                                    />
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex gap-2 justify-center">
                                                        <button
                                                            onClick={() => handleConditionChange(index, 'GOOD')}
                                                            className={`px-3 py-2 rounded-lg font-medium transition-colors flex items-center ${item.condition === 'GOOD'
                                                                ? 'bg-green-100 text-green-700 border-2 border-green-500'
                                                                : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:border-gray-300'
                                                                }`}
                                                        >
                                                            <CheckCircle size={16} className="mr-1" />
                                                            Bueno
                                                        </button>
                                                        <button
                                                            onClick={() => handleConditionChange(index, 'DAMAGED')}
                                                            className={`px-3 py-2 rounded-lg font-medium transition-colors flex items-center ${item.condition === 'DAMAGED'
                                                                ? 'bg-red-100 text-red-700 border-2 border-red-500'
                                                                : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:border-gray-300'
                                                                }`}
                                                        >
                                                            <XCircle size={16} className="mr-1" />
                                                            Dañado
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right font-bold text-green-600">
                                                    ${item.subtotal.toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Motivo de Devolución (Opcional)
                                </label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                    rows="2"
                                    placeholder="Ej: Producto defectuoso, cambio de opinión, etc."
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Summary Panel */}
                {step === 2 && (
                    <div className="col-span-1">
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-6 sticky top-6">
                            <h3 className="text-xl font-bold mb-6">Resumen de Devolución</h3>

                            <div className="bg-white/20 rounded-lg p-4 mb-6">
                                <p className="text-blue-100 text-sm mb-2">Total a Reembolsar</p>
                                <p className="text-4xl font-bold">${calculateTotal().toFixed(2)}</p>
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm font-medium mb-2">Moneda de Reembolso</label>
                                <select
                                    value={refundCurrency}
                                    onChange={(e) => {
                                        const selectedSymbol = e.target.value;
                                        setRefundCurrency(selectedSymbol);
                                        // Update exchange rate when currency changes
                                        const currency = currencies.find(c => c.symbol === selectedSymbol);
                                        if (currency) {
                                            setExchangeRate(currency.rate || 1.0);
                                        }
                                    }}
                                    className="w-full p-3 bg-white text-gray-800 rounded-lg font-medium focus:ring-2 focus:ring-blue-300 outline-none"
                                >
                                    {currencies.length === 0 ? (
                                        <option value="">Cargando monedas...</option>
                                    ) : (
                                        currencies.map(currency => (
                                            <option key={currency.id} value={currency.symbol}>
                                                {currency.symbol} - {currency.name}
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>

                            {refundCurrency !== 'USD' && (
                                <div className="bg-white/20 rounded-lg p-4 mb-6">
                                    <p className="text-blue-100 text-sm mb-1">Monto en {refundCurrency}</p>
                                    <p className="text-2xl font-bold">
                                        {refundCurrency} {getRefundAmount().toFixed(2)}
                                    </p>
                                    <p className="text-blue-100 text-xs mt-1">
                                        Tasa: 1 USD = {exchangeRate.toFixed(2)} Bs
                                    </p>
                                </div>
                            )}

                            <div className="bg-white/20 rounded-lg p-4 mb-6">
                                <p className="text-sm mb-2">Items a Devolver</p>
                                <p className="text-3xl font-bold">
                                    {returnItems.filter(i => i.quantity_to_return > 0).length}
                                </p>
                            </div>

                            <button
                                onClick={handleProcessReturn}
                                disabled={loading || !cashSessionOpen || calculateTotal() === 0}
                                className="w-full py-4 bg-white text-blue-600 rounded-lg font-bold text-lg hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                                <DollarSign className="mr-2" size={24} />
                                {loading ? 'Procesando...' : 'Procesar Devolución'}
                            </button>

                            {!cashSessionOpen && (
                                <p className="text-red-200 text-xs text-center mt-3">
                                    ⚠️ Caja cerrada
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReturnsManager;
