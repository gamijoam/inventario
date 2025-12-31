import { useState, useEffect } from 'react';
import { Search, Calendar, Trash2, Eye, Printer, AlertTriangle, X, FileText, ArrowRight, Filter } from 'lucide-react';
import apiClient from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { pdf } from '@react-pdf/renderer';
import InvoicePDF from '../components/pdf/InvoicePDF';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

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
    const [selectedStatus, setSelectedStatus] = useState('COMPLETED'); // Default to completed

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
            setFilteredSales(response.data);
        } catch (error) {
            console.error('Error fetching sales:', error);
        } finally {
            setLoading(false);
        }
    };

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
            setFilteredSales(updatedSales); // Also update filtered list to reflect change immediately

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
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100 uppercase tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Anulada
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Completada
            </span>
        );
    };

    const getCurrencySymbol = (currency) => {
        const symbols = { 'USD': '$', 'Bs': 'Bs', 'VES': 'Bs', 'COP': '$', 'EUR': '€' };
        return symbols[currency] || currency;
    };

    const renderPaymentInfo = (sale) => {
        if (!sale.payments || sale.payments.length === 0) {
            // Fallback to old display
            return (
                <div className="flex flex-col items-end">
                    <div className="font-bold text-slate-800 text-sm">${Number(sale.total_amount).toFixed(2)}</div>
                    <div className="text-[10px] text-slate-400 font-bold tracking-wide">USD</div>
                </div>
            );
        }

        // Case 1: Single Payment
        if (sale.payments.length === 1) {
            const payment = sale.payments[0];
            const symbol = getCurrencySymbol(payment.currency);
            return (
                <div className="flex flex-col items-end">
                    <div className="font-bold text-slate-800 text-sm">
                        {symbol} {payment.amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] text-slate-400 font-bold tracking-wide flex items-center gap-1">
                        {payment.currency}
                        {payment.currency !== 'USD' && (
                            <span className="text-slate-300">| ${Number(sale.total_amount).toFixed(2)}</span>
                        )}
                    </div>
                </div>
            );
        }

        // Case 2: Mixed Payments
        return (
            <div className="group relative flex flex-col items-end">
                <div className="px-2 py-0.5 rounded bg-purple-50 text-purple-600 font-bold text-xs border border-purple-100">
                    MIXTO
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{sale.payments.length} pagos</div>

                {/* Tooltip on hover */}
                <div className="hidden group-hover:block absolute z-50 right-0 top-full mt-2 w-48 bg-slate-800 text-white text-xs rounded-xl p-3 shadow-2xl animate-in fade-in zoom-in duration-200">
                    <div className="font-bold mb-2 text-slate-300 border-b border-slate-700 pb-1">Desglose</div>
                    {sale.payments.map((payment, idx) => (
                        <div key={idx} className="flex justify-between py-1 border-b border-slate-700/50 last:border-0 text-slate-200">
                            <span className="font-medium">{payment.currency}</span>
                            <span className="font-mono">{getCurrencySymbol(payment.currency)} {Number(payment.amount).toFixed(2)}</span>
                        </div>
                    ))}
                    <div className="mt-2 pt-2 border-t border-slate-600 font-bold text-white flex justify-between">
                        <span>Total USD:</span>
                        <span>${Number(sale.total_amount).toFixed(2)}</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Historial de Ventas</h1>
                <p className="text-slate-500 text-sm mt-1">Consulta, reimprime o anula transacciones pasadas.</p>
            </div>

            {/* Filters Card */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-2 mb-4 text-slate-700 text-sm font-bold uppercase tracking-wide">
                    <Filter size={16} className="text-indigo-500" />
                    Filtros de Búsqueda
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Desde</label>
                        <div className="relative">
                            <Calendar size={16} className="absolute left-3 top-2.5 text-slate-400" />
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-medium text-slate-700"
                            />
                        </div>
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Hasta</label>
                        <div className="relative">
                            <Calendar size={16} className="absolute left-3 top-2.5 text-slate-400" />
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-medium text-slate-700"
                            />
                        </div>
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Búsqueda</label>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Ticket, Cliente..."
                                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-medium text-slate-700 placeholder:text-slate-400"
                            />
                        </div>
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Estado</label>
                        <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-medium text-slate-700 bg-white"
                        >
                            <option value="">Todas</option>
                            <option value="COMPLETED">Completadas</option>
                            <option value="VOIDED">Anuladas</option>
                        </select>
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Método</label>
                        <select
                            value={selectedPaymentMethod}
                            onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-medium text-slate-700 bg-white"
                        >
                            <option value="">Todos</option>
                            {paymentMethods.map(method => (
                                <option key={method.id} value={method.name}>{method.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Desktop Sales Table (Zebra Style) */}
            <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 font-bold tracking-wider">Ticket</th>
                                <th className="px-6 py-4 font-bold tracking-wider">Hora</th>
                                <th className="px-6 py-4 font-bold tracking-wider">Cliente</th>
                                <th className="px-6 py-4 font-bold tracking-wider text-right">Monto</th>
                                <th className="px-6 py-4 font-bold tracking-wider text-center">Método</th>
                                <th className="px-6 py-4 font-bold tracking-wider text-center">Estado</th>
                                <th className="px-6 py-4 font-bold tracking-wider text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="text-center py-12 text-slate-400 font-medium">
                                        Cargando datos...
                                    </td>
                                </tr>
                            ) : filteredSales.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="text-center py-12 text-slate-400 font-medium">
                                        No se encontraron ventas para los filtros seleccionados
                                    </td>
                                </tr>
                            ) : (
                                filteredSales.map((sale, index) => (
                                    <tr
                                        key={sale.id}
                                        onClick={() => handleViewDetails(sale)}
                                        className={clsx(
                                            "transition-colors duration-200 cursor-pointer group",
                                            index % 2 === 0 ? "bg-white" : "bg-slate-50/50",
                                            "hover:bg-indigo-50/60"
                                        )}
                                    >
                                        <td className="px-6 py-4 font-medium text-slate-700">
                                            #{sale.id}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {new Date(sale.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-6 py-4 text-slate-700 font-medium">
                                            {sale.customer?.name || 'Cliente General'}
                                        </td>
                                        <td className={clsx("px-6 py-4 text-right", sale.status === 'VOIDED' && "opacity-50 line-through")}>
                                            {renderPaymentInfo(sale)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                {sale.payment_method || 'Mixto'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {getStatusBadge(sale.status)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={() => handleViewDetails(sale)}
                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    title="Ver Detalles"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handlePrintPDF(sale)}
                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    title="PDF Nota de Entrega"
                                                >
                                                    <FileText size={18} />
                                                </button>
                                                {sale.status !== 'VOIDED' && (
                                                    <button
                                                        onClick={() => handleVoidClick(sale)}
                                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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
            </div>

            {/* Mobile Sales Cards */}
            <div className="md:hidden space-y-4">
                {loading ? (
                    <div className="text-center py-8 text-slate-400">Cargando...</div>
                ) : filteredSales.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">No se encontraron ventas</div>
                ) : (
                    filteredSales.map(sale => (
                        <div
                            key={sale.id}
                            className={clsx(
                                "bg-white p-4 rounded-xl border shadow-sm active:scale-[0.98] transition-all",
                                sale.status === 'VOIDED' ? "border-rose-100 bg-rose-50/30" : "border-slate-200"
                            )}
                            onClick={() => handleViewDetails(sale)}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-lg text-slate-800">#{sale.id}</span>
                                        {getStatusBadge(sale.status)}
                                    </div>
                                    <p className="text-xs text-slate-400">
                                        {new Date(sale.date).toLocaleDateString()} • {new Date(sale.date).toLocaleTimeString()}
                                    </p>
                                    <p className="text-sm font-bold text-slate-700 mt-1">
                                        {sale.customer?.name || 'Cliente General'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <div className={clsx("text-lg font-black", sale.status === 'VOIDED' ? "text-slate-400 line-through" : "text-indigo-600")}>
                                        ${Number(sale.total_amount).toFixed(2)}
                                    </div>
                                    <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full border border-slate-200 mt-1 inline-block">
                                        {sale.payment_method || 'Mixto'}
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-2 pt-3 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                                <button
                                    onClick={() => handlePrintPDF(sale)}
                                    className="flex-1 py-2 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center justify-center gap-1"
                                >
                                    <FileText size={14} /> PDF
                                </button>
                                {sale.status !== 'VOIDED' && (
                                    <button
                                        onClick={() => handleVoidClick(sale)}
                                        className="flex-1 py-2 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold flex items-center justify-center gap-1"
                                    >
                                        <Trash2 size={14} /> Anular
                                    </button>
                                )}
                                <button
                                    onClick={() => handleViewDetails(sale)}
                                    className="flex-1 py-2 rounded-lg bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-1 hover:bg-slate-100"
                                >
                                    <Eye size={14} /> Ver
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Sale Detail Modal (Bento Styled) */}
            {showDetailModal && selectedSale && (
                <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <span className="bg-indigo-100 text-indigo-600 p-1.5 rounded-lg"><FileText size={20} /></span>
                                    Venta #{selectedSale.id}
                                </h3>
                                <p className="text-sm text-slate-500 mt-1 ml-1">
                                    {new Date(selectedSale.date).toLocaleString()}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Cliente</p>
                                    <p className="font-bold text-slate-800 text-lg">{selectedSale.customer?.name || 'Cliente General'}</p>
                                    {selectedSale.customer?.id_number && (
                                        <p className="text-sm text-slate-500 font-medium">{selectedSale.customer.id_number}</p>
                                    )}
                                </div>
                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Estado</p>
                                    <div className="mt-1">{getStatusBadge(selectedSale.status)}</div>
                                </div>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-6">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="text-left p-3 font-semibold text-slate-600 pl-4">Producto</th>
                                            <th className="text-center p-3 font-semibold text-slate-600">Cant.</th>
                                            <th className="text-right p-3 font-semibold text-slate-600">Precio</th>
                                            <th className="text-right p-3 font-semibold text-slate-600 pr-4">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {selectedSale.details?.map((detail, index) => (
                                            <tr key={index}>
                                                <td className="p-3 pl-4 text-slate-700 font-medium">{detail.product?.name || 'N/A'}</td>
                                                <td className="p-3 text-center text-slate-600">{detail.quantity}</td>
                                                <td className="p-3 text-right text-slate-600">${Number(detail.unit_price).toFixed(2)}</td>
                                                <td className="p-3 text-right font-bold text-slate-800 pr-4">${Number(detail.subtotal).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50 border-t border-slate-200">
                                        <tr>
                                            <td colSpan="3" className="p-4 text-right font-bold text-slate-600 uppercase tracking-wide">Total Venta:</td>
                                            <td className="p-4 text-right font-black text-xl text-indigo-600 pr-4">
                                                ${Number(selectedSale.total_amount).toFixed(2)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3">
                            <button
                                onClick={() => handlePrintPDF(selectedSale)}
                                className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                            >
                                <FileText size={18} />
                                Generar PDF
                            </button>
                            <button
                                onClick={() => handleReprint(selectedSale)}
                                className="flex-1 px-4 py-3 bg-white text-indigo-600 border-2 border-indigo-100 hover:border-indigo-300 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                            >
                                <Printer size={18} />
                                Reimprimir
                            </button>
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="px-6 py-3 bg-slate-200 text-slate-600 hover:bg-slate-300 rounded-xl font-bold text-sm transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PIN Auth Modal (Bento Styled) */}
            {showPinModal && saleToVoid && (
                <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in duration-200 border border-slate-200">
                        <div className="p-6 border-b border-slate-100 text-center">
                            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle className="text-rose-500" size={32} />
                            </div>
                            <h3 className="text-xl font-black text-rose-600 mb-1">Confirmar Anulación</h3>
                            <p className="text-slate-500 text-sm">
                                ¿Estás seguro de anular la venta <span className="font-bold text-slate-800">#{saleToVoid.id}</span>?
                            </p>
                        </div>

                        <div className="p-6">
                            <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 mb-6">
                                <p className="text-xs text-rose-700 font-bold leading-relaxed text-center">
                                    ⚠️ Esta acción devolverá los productos al inventario y reembolsará el dinero.
                                </p>
                            </div>

                            <div className="mb-2">
                                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide text-center">
                                    PIN de Administrador Requerido
                                </label>
                                <input
                                    type="password"
                                    value={adminPin}
                                    onChange={(e) => {
                                        setAdminPin(e.target.value);
                                        setPinError('');
                                    }}
                                    onKeyPress={(e) => e.key === 'Enter' && handleVoidConfirm()}
                                    className="w-full p-4 border-2 border-slate-200 rounded-xl focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 outline-none text-center text-3xl tracking-[1em] font-black text-slate-800 placeholder-slate-300"
                                    placeholder="••••"
                                    maxLength="6"
                                    autoFocus
                                />
                                {pinError && (
                                    <p className="text-rose-600 text-xs font-bold mt-2 text-center animate-pulse">{pinError}</p>
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-100 grid grid-cols-2 gap-3 bg-slate-50 rounded-b-2xl">
                            <button
                                onClick={() => {
                                    setShowPinModal(false);
                                    setSaleToVoid(null);
                                    setAdminPin('');
                                    setPinError('');
                                }}
                                className="px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleVoidConfirm}
                                className="px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-lg shadow-rose-200 transition-colors"
                            >
                                ANULAR
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesHistory;
