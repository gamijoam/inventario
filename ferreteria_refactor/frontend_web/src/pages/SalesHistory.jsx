import { useState, useEffect } from 'react';
import { Search, Calendar, Trash2, Eye, Printer, AlertTriangle, X, FileText } from 'lucide-react';
import apiClient from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { pdf } from '@react-pdf/renderer';
import InvoicePDF from '../components/pdf/InvoicePDF';

const SalesHistory = () => {
    const { user } = useAuth();
    const { business, paymentMethods } = useConfig();
    const [sales, setSales] = useState([]);
    const [filteredSales, setFilteredSales] = useState([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('COMPLETED'); // Default to completed? Or '' for all? Let's say '' for all.

    // Modals
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showPinModal, setShowPinModal] = useState(false);
    const [selectedSale, setSelectedSale] = useState(null);
    const [saleToVoid, setSaleToVoid] = useState(null);

    // PIN Auth
    const [adminPin, setAdminPin] = useState('');
    const [pinError, setPinError] = useState('');

    useEffect(() => {
        fetchSales();
    }, [dateFrom, dateTo, selectedPaymentMethod, selectedStatus]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchSales();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const fetchSales = async () => {
        setLoading(true);
        try {
            const params = {
                limit: 100,
                start_date: dateFrom,
                end_date: dateTo
            };

            if (searchQuery) params.q = searchQuery;
            if (selectedPaymentMethod) params.payment_method = selectedPaymentMethod;
            if (selectedStatus) params.status = selectedStatus;

            const response = await apiClient.get('/returns/sales/search', { params });
            setSales(response.data);
            setFilteredSales(response.data); // No more client-side filtering needed for main list
        } catch (error) {
            console.error('Error fetching sales:', error);
        } finally {
            setLoading(false);
        }
    };

    // Removed client-side applyFilters as backend handles it now

    const handleViewDetails = async (sale) => {
        try {
            const response = await apiClient.get(`/returns/sales/${sale.id}`);
            setSelectedSale(response.data);
            setShowDetailModal(true);
        } catch (error) {
            console.error('Error fetching sale details:', error);
            alert('Error al cargar detalles de la venta');
        }
    };

    const handleVoidClick = (sale) => {
        if (sale.status === 'VOIDED') {
            alert('Esta venta ya está anulada');
            return;
        }

        setSaleToVoid(sale);
        setShowPinModal(true);
        setAdminPin('');
        setPinError('');
    };

    const handleVoidConfirm = async () => {
        if (!adminPin) {
            setPinError('Ingrese el PIN de administrador');
            return;
        }

        try {
            // Validate PIN
            const pinResponse = await apiClient.post('/auth/validate-pin', {
                user_id: user?.id,
                pin: adminPin
            });

            if (!pinResponse.data.valid) {
                setPinError('PIN incorrecto');
                return;
            }

            // Process void as a return
            const items = saleToVoid.details?.map(detail => ({
                product_id: detail.product_id,
                quantity: detail.quantity,
                condition: 'GOOD'
            })) || [];

            await apiClient.post('/returns', {
                sale_id: saleToVoid.id,
                items: items,
                reason: 'ANULACIÓN DE VENTA - ERROR OPERATIVO',
                refund_currency: 'USD',
                exchange_rate: 1.0
            });

            // Update sale status locally
            const updatedSales = sales.map(s =>
                s.id === saleToVoid.id ? { ...s, status: 'VOIDED' } : s
            );
            setSales(updatedSales);

            alert('✅ Venta anulada correctamente');
            setShowPinModal(false);
            setSaleToVoid(null);
            setAdminPin('');
        } catch (error) {
            console.error('Error voiding sale:', error);
            if (error.response?.status === 401) {
                setPinError('PIN incorrecto');
            } else {
                setPinError(error.response?.data?.detail || 'Error al anular venta');
            }
        }
    };

    const handlePrintPDF = async (sale) => {
        try {
            const blob = await pdf(<InvoicePDF sale={sale} business={business} />).toBlob();
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error al generar el PDF');
        }
    };

    const handleReprint = async (sale) => {
        try {
            // Call print endpoint (assuming it exists)
            await apiClient.post(`/sales/${sale.id}/print`);
            alert('Ticket enviado a impresora');
        } catch (error) {
            console.error('Error reprinting:', error);
            alert('Error al reimprimir ticket');
        }
    };

    const getStatusBadge = (status) => {
        if (status === 'VOIDED') {
            return <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">Anulada</span>;
        }
        return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">Completada</span>;
    };

    const getCurrencySymbol = (currency) => {
        const symbols = { 'USD': '$', 'Bs': 'Bs', 'VES': 'Bs', 'COP': '$', 'EUR': '€' };
        return symbols[currency] || currency;
    };

    const renderPaymentInfo = (sale) => {
        if (!sale.payments || sale.payments.length === 0) {
            // Fallback to old display
            return (
                <div>
                    <div className="font-bold">${Number(sale.total_amount).toFixed(2)}</div>
                    <div className="text-xs text-gray-500">USD</div>
                </div>
            );
        }

        // Case 1: Single Payment
        if (sale.payments.length === 1) {
            const payment = sale.payments[0];
            const symbol = getCurrencySymbol(payment.currency);
            return (
                <div>
                    <div className="font-bold">
                        {symbol} {payment.amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-gray-500">{payment.currency}</div>
                    {payment.currency !== 'USD' && (
                        <div className="text-xs text-gray-400">Ref: ${Number(sale.total_amount).toFixed(2)}</div>
                    )}
                </div>
            );
        }

        // Case 2: Mixed Payments
        return (
            <div className="group relative">
                <div className="font-bold text-purple-600">MIXTO</div>
                <div className="text-xs text-gray-500">{sale.payments.length} pagos</div>
                {/* Tooltip on hover */}
                <div className="hidden group-hover:block absolute z-10 bg-gray-900 text-white text-xs rounded-lg p-3 -left-20 top-full mt-2 w-48 shadow-xl">
                    <div className="font-semibold mb-2">Desglose de Pagos:</div>
                    {sale.payments.map((payment, idx) => (
                        <div key={idx} className="flex justify-between py-1 border-b border-gray-700 last:border-0">
                            <span>{payment.currency}</span>
                            <span>{getCurrencySymbol(payment.currency)} {Number(payment.amount).toFixed(2)}</span>
                        </div>
                    ))}
                    <div className="mt-2 pt-2 border-t border-gray-700 font-semibold">
                        <div className="flex justify-between">
                            <span>Total USD:</span>
                            <span>${Number(sale.total_amount).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Historial de Ventas</h1>
                <p className="text-gray-600">Consulta y gestiona ventas pasadas</p>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-4 md:p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Fecha Desde
                        </label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Fecha Hasta
                        </label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Buscar
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Nro Ticket o Cliente..."
                                className="w-full pl-10 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Estado
                        </label>
                        <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="">Todos</option>
                            <option value="COMPLETED">Completada</option>
                            <option value="VOIDED">Anulada</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Método Pago
                        </label>
                        <select
                            value={selectedPaymentMethod}
                            onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="">Todos</option>
                            {paymentMethods.map(method => (
                                <option key={method.id} value={method.name}>{method.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Sales Table */}
            {/* Desktop Sales Table */}
            <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="text-left p-4 font-semibold text-gray-700">ID</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Hora</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Cliente</th>
                            <th className="text-right p-4 font-semibold text-gray-700">Pagado En</th>
                            <th className="text-center p-4 font-semibold text-gray-700">Método</th>
                            <th className="text-center p-4 font-semibold text-gray-700">Estado</th>
                            <th className="text-center p-4 font-semibold text-gray-700">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            <tr>
                                <td colSpan="7" className="text-center p-8 text-gray-500">
                                    Cargando...
                                </td>
                            </tr>
                        ) : filteredSales.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="text-center p-8 text-gray-500">
                                    No se encontraron ventas
                                </td>
                            </tr>
                        ) : (
                            filteredSales.map(sale => (
                                <tr
                                    key={sale.id}
                                    className={`hover:bg-gray-50 cursor-pointer ${sale.status === 'VOIDED' ? 'bg-red-50 opacity-60' : ''
                                        }`}
                                    onClick={() => handleViewDetails(sale)}
                                >
                                    <td className="p-4 font-medium">#{sale.id}</td>
                                    <td className="p-4">
                                        {new Date(sale.date).toLocaleTimeString('es-ES', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </td>
                                    <td className="p-4">{sale.customer?.name || 'Cliente General'}</td>
                                    <td className={`p-4 text-right ${sale.status === 'VOIDED' ? 'line-through opacity-60' : ''}`}>
                                        {renderPaymentInfo(sale)}
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                            {sale.payment_method || 'Mixto'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        {getStatusBadge(sale.status)}
                                    </td>
                                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex gap-2 justify-center">
                                            <button
                                                onClick={() => handleViewDetails(sale)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                title="Ver Detalles"
                                            >
                                                <Eye size={18} />
                                            </button>
                                            <button
                                                onClick={() => handlePrintPDF(sale)}
                                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                title="PDF Nota de Entrega"
                                            >
                                                <FileText size={18} />
                                            </button>
                                            {sale.status !== 'VOIDED' && (
                                                <button
                                                    onClick={() => handleVoidClick(sale)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    title="Anular Venta"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile Sales Cards */}
            <div className="md:hidden space-y-4">
                {loading ? (
                    <div className="text-center p-8 text-gray-500">Cargando...</div>
                ) : filteredSales.length === 0 ? (
                    <div className="text-center p-8 text-gray-500">No se encontraron ventas</div>
                ) : (
                    filteredSales.map(sale => (
                        <div
                            key={sale.id}
                            className={`bg-white p-4 rounded-lg shadow-sm border border-gray-100 ${sale.status === 'VOIDED' ? 'bg-red-50 opacity-75' : ''}`}
                            onClick={() => handleViewDetails(sale)}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-lg text-gray-800">#{sale.id}</span>
                                        {getStatusBadge(sale.status)}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {new Date(sale.date).toLocaleString('es-ES')}
                                    </div>
                                    <div className="text-sm font-medium text-gray-700 mt-1">
                                        {sale.customer?.name || 'Cliente General'}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`text-lg font-bold text-blue-600 ${sale.status === 'VOIDED' ? 'line-through text-gray-500' : ''}`}>
                                        ${Number(sale.total_amount).toFixed(2)}
                                    </div>
                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                        {sale.payment_method || 'Mixto'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                                <button
                                    onClick={() => handlePrintPDF(sale)}
                                    className="flex items-center gap-1 text-sm text-indigo-600 font-medium px-2 py-1 bg-indigo-50 rounded"
                                >
                                    <FileText size={16} /> PDF
                                </button>
                                {sale.status !== 'VOIDED' && (
                                    <button
                                        onClick={() => handleVoidClick(sale)}
                                        className="flex items-center gap-1 text-sm text-red-600 font-medium px-2 py-1 bg-red-50 rounded"
                                    >
                                        <Trash2 size={16} /> Anular
                                    </button>
                                )}
                                <button
                                    onClick={() => handleViewDetails(sale)}
                                    className="flex items-center gap-1 text-sm text-blue-600 font-medium px-2 py-1 bg-blue-50 rounded"
                                >
                                    <Eye size={16} /> Ver
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Sale Detail Modal */}
            {showDetailModal && selectedSale && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
                        <div className="p-6 border-b flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">
                                    Detalle de Venta #{selectedSale.id}
                                </h3>
                                <p className="text-sm text-gray-600">
                                    {new Date(selectedSale.date).toLocaleString()}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto max-h-[60vh]">
                            {/* Customer Info */}
                            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                                <p className="text-sm text-gray-600">Cliente</p>
                                <p className="font-bold text-lg">{selectedSale.customer?.name || 'Cliente General'}</p>
                            </div>

                            {/* Items Table */}
                            <table className="w-full mb-6">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="text-left p-3 font-semibold text-gray-700">Producto</th>
                                        <th className="text-center p-3 font-semibold text-gray-700">Cant.</th>
                                        <th className="text-right p-3 font-semibold text-gray-700">Precio</th>
                                        <th className="text-right p-3 font-semibold text-gray-700">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {selectedSale.details?.map((detail, index) => (
                                        <tr key={index}>
                                            <td className="p-3">{detail.product?.name || 'N/A'}</td>
                                            <td className="p-3 text-center">{detail.quantity}</td>
                                            <td className="p-3 text-right">${Number(detail.unit_price).toFixed(2)}</td>
                                            <td className="p-3 text-right font-bold">${Number(detail.subtotal).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-50">
                                    <tr>
                                        <td colSpan="3" className="p-3 text-right font-bold">Total:</td>
                                        <td className="p-3 text-right font-bold text-lg text-green-600">
                                            ${Number(selectedSale.total_amount).toFixed(2)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <div className="p-6 border-t flex gap-3">
                            <button
                                onClick={() => handlePrintPDF(selectedSale)}
                                className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center justify-center transition-colors"
                            >
                                <FileText className="mr-2" size={20} />
                                Generar PDF
                            </button>
                            <button
                                onClick={() => handleReprint(selectedSale)}
                                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center transition-colors"
                            >
                                <Printer className="mr-2" size={20} />
                                Reimprimir Ticket
                            </button>
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PIN Auth Modal */}
            {showPinModal && saleToVoid && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                        <div className="p-6 border-b">
                            <div className="flex items-center text-red-600 mb-2">
                                <AlertTriangle className="mr-2" size={24} />
                                <h3 className="text-xl font-bold">Anular Venta</h3>
                            </div>
                            <p className="text-gray-600">
                                Está a punto de anular la venta #{saleToVoid.id}
                            </p>
                        </div>

                        <div className="p-6">
                            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 mb-6">
                                <p className="text-sm text-yellow-800 font-medium">
                                    ⚠️ Esta acción devolverá los productos al inventario y reembolsará el dinero.
                                </p>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    PIN de Administrador *
                                </label>
                                <input
                                    type="password"
                                    value={adminPin}
                                    onChange={(e) => {
                                        setAdminPin(e.target.value);
                                        setPinError('');
                                    }}
                                    onKeyPress={(e) => e.key === 'Enter' && handleVoidConfirm()}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-center text-2xl tracking-widest"
                                    placeholder="••••"
                                    maxLength="6"
                                    autoFocus
                                />
                                {pinError && (
                                    <p className="text-red-600 text-sm mt-2">{pinError}</p>
                                )}
                            </div>
                        </div>

                        <div className="p-6 border-t flex gap-3">
                            <button
                                onClick={() => {
                                    setShowPinModal(false);
                                    setSaleToVoid(null);
                                    setAdminPin('');
                                    setPinError('');
                                }}
                                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleVoidConfirm}
                                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                            >
                                Confirmar Anulación
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesHistory;
