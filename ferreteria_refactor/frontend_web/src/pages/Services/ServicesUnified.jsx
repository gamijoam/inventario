import React, { useState, useEffect, useCallback } from 'react';
import {
    Wrench, Plus, Search, Save, CheckCircle, Clock, AlertTriangle,
    User, Package, Trash2, DollarSign, CreditCard, FileText, Printer,
    ChevronRight, X, Smartphone, ChevronLeft, ArrowLeft, Zap
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '../../utils/currency';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import printerService from '../../services/printerService';
import NewOrderModal from './components/NewOrderModal';
import ServiceDeliveryModal from './components/ServiceDeliveryModal';
import ServiceTemplatesManager from './components/ServiceTemplatesManager';
import PaymentModal from '../../components/pos/PaymentModal';

const STATUS_FLOW = ['RECEIVED', 'DIAGNOSING', 'IN_PROGRESS', 'READY', 'DELIVERED'];

const STATUS_LABELS = {
    RECEIVED: 'Recibido',
    DIAGNOSING: 'Diagnóstico',
    APPROVED: 'Aprobado',
    IN_PROGRESS: 'Reparación',
    READY: 'Listo',
    DELIVERED: 'Entregado',
    CANCELLED: 'Anulado',
};

const STATUS_COLORS = {
    RECEIVED: 'bg-slate-100 text-slate-700',
    DIAGNOSING: 'bg-yellow-100 text-yellow-800',
    IN_PROGRESS: 'bg-purple-100 text-purple-800',
    READY: 'bg-emerald-100 text-emerald-800',
    DELIVERED: 'bg-teal-100 text-teal-800',
    CANCELLED: 'bg-red-100 text-red-800',
};

const FILTER_STATUSES = [
    { value: '', label: 'Todos' },
    { value: 'RECEIVED', label: 'Recibido' },
    { value: 'DIAGNOSING', label: 'Diagnóstico' },
    { value: 'IN_PROGRESS', label: 'Reparando' },
    { value: 'READY', label: 'Listo' },
    { value: 'DELIVERED', label: 'Entregado' },
];

const ServicesUnified = () => {
    const { user } = useAuth();
    const { business } = useConfig();
    const paperWidth = business?.paper_width || '80';

    // Order list
    const [orders, setOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [selectedOrderId, setSelectedOrderId] = useState(null);
    const [filterStatus, setFilterStatus] = useState('');
    const [loadingList, setLoadingList] = useState(true);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Modals
    const [showNewOrderModal, setShowNewOrderModal] = useState(false);
    const [showTemplatesManager, setShowTemplatesManager] = useState(false);
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentData, setPaymentData] = useState(null);

    // Diagnosis
    const [diagnosisNotes, setDiagnosisNotes] = useState('');

    // Abono/Payment form
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Efectivo');
    const [paymentRef, setPaymentRef] = useState('');

    // Item form
    const [showItemForm, setShowItemForm] = useState(false);
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [products, setProducts] = useState([]);
    const [technicians, setTechnicians] = useState([]);
    const [newItem, setNewItem] = useState({
        product: null,
        description: '',
        quantity: 1,
        price: 0,
        technician_id: '',
        is_manual: false,
    });

    // Problem description expand
    const [expandProblem, setExpandProblem] = useState(false);

    // Mobile
    const [mobileView, setMobileView] = useState('list');

    // --- Data Fetching ---

    const fetchOrders = useCallback(async () => {
        setLoadingList(true);
        try {
            const params = { service_type: 'REPAIR' };
            if (filterStatus) params.status = filterStatus;
            const res = await apiClient.get('/services/orders', { params });
            setOrders(res.data);
        } catch {
            toast.error('Error al cargar órdenes');
        } finally {
            setLoadingList(false);
        }
    }, [filterStatus]);

    const fetchOrderDetail = useCallback(async (orderId) => {
        setLoadingDetail(true);
        try {
            const res = await apiClient.get(`/services/orders/${orderId}`);
            setSelectedOrder(res.data);
            setDiagnosisNotes(res.data.diagnosis_notes || '');
        } catch {
            toast.error('Error al cargar detalle de orden');
            setSelectedOrder(null);
        } finally {
            setLoadingDetail(false);
        }
    }, []);

    const fetchTechnicians = useCallback(async () => {
        try {
            const res = await apiClient.get('/users');
            setTechnicians(res.data);
        } catch {
            // silent
        }
    }, []);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    useEffect(() => {
        fetchTechnicians();
    }, [fetchTechnicians]);

    // Product search debounce
    useEffect(() => {
        if (productSearchTerm.length > 2) {
            const timeoutId = setTimeout(async () => {
                try {
                    const res = await apiClient.get(`/products/?search=${productSearchTerm}`);
                    setProducts(Array.isArray(res.data) ? res.data : (res.data?.items || []));
                } catch {
                    // silent
                }
            }, 500);
            return () => clearTimeout(timeoutId);
        } else {
            setProducts([]);
        }
    }, [productSearchTerm]);

    // --- Actions ---

    const selectOrder = (orderId) => {
        setSelectedOrderId(orderId);
        fetchOrderDetail(orderId);
        setMobileView('detail');
        setShowItemForm(false);
        setExpandProblem(false);
    };

    const handleUpdateStatus = async (newStatus, pin = null) => {
        if (!selectedOrder) return;
        try {
            await apiClient.patch(`/services/orders/${selectedOrder.id}/status`, {
                status: newStatus,
                diagnosis_notes: diagnosisNotes,
                admin_pin: pin,
            });
            toast.success(`Estado actualizado a ${STATUS_LABELS[newStatus]}`);
            fetchOrderDetail(selectedOrder.id);
            fetchOrders();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Error al actualizar estado');
        }
    };

    const interceptStatusChange = (newStatus) => {
        if (!selectedOrder) return;

        if (selectedOrder.status === 'DELIVERED' && newStatus !== 'DELIVERED') {
            const pin = window.prompt('Esta orden ya fue ENTREGADA. Ingrese PIN de Administrador para revertir:');
            if (pin === null) return;
            handleUpdateStatus(newStatus, pin);
            return;
        }

        if (newStatus === 'DELIVERED' && selectedOrder.status !== 'DELIVERED') {
            setShowDeliveryModal(true);
        } else {
            handleUpdateStatus(newStatus);
        }
    };

    const handleSaveNotes = async () => {
        if (!selectedOrder) return;
        try {
            await apiClient.patch(`/services/orders/${selectedOrder.id}/status`, {
                status: selectedOrder.status,
                diagnosis_notes: diagnosisNotes,
            });
            toast.success('Notas guardadas');
        } catch {
            toast.error('Error al guardar notas');
        }
    };

    const handleAddItem = async () => {
        if (!selectedOrder) return;
        const isValid = newItem.product ? true : (newItem.description && newItem.technician_id);
        if (!isValid) {
            toast.error('Complete los campos requeridos (Producto/Descripción y Técnico)');
            return;
        }
        try {
            const payload = {
                product_id: newItem.product?.id,
                description: newItem.description,
                quantity: newItem.quantity || 1,
                unit_price: isNaN(newItem.price) ? 0 : newItem.price,
                technician_id: newItem.technician_id ? parseInt(newItem.technician_id) : null,
            };
            await apiClient.post(`/services/orders/${selectedOrder.id}/items`, payload);
            toast.success('Ítem agregado');
            setNewItem({ product: null, description: '', quantity: 1, price: 0, technician_id: '', is_manual: false });
            setShowItemForm(false);
            setProductSearchTerm('');
            setProducts([]);
            fetchOrderDetail(selectedOrder.id);
            fetchOrders();
        } catch {
            toast.error('Error al agregar ítem');
        }
    };

    const handleDeleteItem = async (itemId) => {
        if (!selectedOrder) return;
        if (!confirm('¿Eliminar este ítem?')) return;
        try {
            await apiClient.delete(`/services/orders/${selectedOrder.id}/items/${itemId}`);
            toast.success('Ítem eliminado');
            fetchOrderDetail(selectedOrder.id);
            fetchOrders();
        } catch {
            toast.error('Error al eliminar ítem');
        }
    };

    const handlePrintTicket = async () => {
        if (!selectedOrder) return;
        try {
            const res = await apiClient.get(`/services/orders/${selectedOrder.id}/print/thermal?width=${paperWidth}`);
            await printerService.printRaw(res.data);
            toast.success('Ticket enviado a impresora');
        } catch {
            toast.error('Error al imprimir -- verifique la impresora');
        }
    };

    // Payment & Delivery
    const handlePaymentRequest = (data) => {
        setPaymentData(data);
        setShowDeliveryModal(false);
        setShowPaymentModal(true);
    };

    const handlePaymentSuccess = async (result) => {
        if (!selectedOrder) return;
        try {
            const currentMeta = selectedOrder.order_metadata || {};
            await apiClient.patch(`/services/orders/${selectedOrder.id}/status`, {
                order_metadata: {
                    ...currentMeta,
                    sale_id: result.saleId,
                    payment_status: 'PAID',
                    payment_date: new Date().toISOString(),
                },
            });
            toast.success('Pago registrado y vinculado exitosamente');
            setShowPaymentModal(false);
            fetchOrderDetail(selectedOrder.id);
            fetchOrders();
        } catch {
            toast.error('Pago registrado pero falló la vinculación con la orden');
        }
    };

    const handleAddPayment = async () => {
        if (!selectedOrder || !paymentAmount || parseFloat(paymentAmount) <= 0) return;
        try {
            await apiClient.post(`/services/orders/${selectedOrder.id}/payments`, {
                amount: parseFloat(paymentAmount),
                currency: 'USD',
                payment_method: paymentMethod,
                reference: paymentRef || null,
            });
            toast.success(`Abono de ${formatCurrency(parseFloat(paymentAmount))} registrado`);
            setShowPaymentForm(false);
            setPaymentAmount('');
            setPaymentRef('');
            fetchOrderDetail(selectedOrder.id);
            fetchOrders();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error registrando el pago');
        }
    };

    // --- Computed Values ---

    const orderTotal = selectedOrder
        ? selectedOrder.details?.reduce((acc, d) => acc + Number(d.quantity) * Number(d.unit_price), 0) || 0
        : 0;

    const orderPaid = selectedOrder
        ? selectedOrder.payments?.reduce((acc, p) => acc + parseFloat(p.amount), 0) || 0
        : 0;

    const orderPending = Math.max(0, orderTotal - orderPaid);

    const getPaymentStatus = () => {
        if (selectedOrder?.order_metadata?.payment_status === 'PAID') return 'paid';
        if (orderPending <= 0 && orderTotal > 0) return 'paid';
        if (orderPaid > 0 && orderPending > 0) return 'partial';
        return 'unpaid';
    };

    const getOrderPaymentIndicator = (order) => {
        if (order.order_metadata?.payment_status === 'PAID') return 'paid';
        const total = order.details?.reduce((a, d) => a + Number(d.quantity) * Number(d.unit_price), 0) || 0;
        const paid = order.payments?.reduce((a, p) => a + parseFloat(p.amount), 0) || 0;
        if (paid >= total && total > 0) return 'paid';
        if (paid > 0) return 'partial';
        return 'unpaid';
    };

    // --- Render Helpers ---

    const renderStatusStepper = () => {
        if (!selectedOrder) return null;
        const currentIndex = STATUS_FLOW.indexOf(selectedOrder.status);

        return (
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {STATUS_FLOW.map((step, i) => {
                    const isPast = i < currentIndex;
                    const isCurrent = i === currentIndex;
                    const isFuture = i > currentIndex;

                    return (
                        <React.Fragment key={step}>
                            <button
                                onClick={() => interceptStatusChange(step)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all
                                    ${isCurrent
                                        ? 'bg-slate-900 text-white shadow-md'
                                        : isPast
                                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                            : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                                    }`}
                            >
                                {isPast && <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />}
                                {isCurrent && <div className="w-2 h-2 rounded-full bg-white flex-shrink-0" />}
                                {isFuture && <div className="w-2 h-2 rounded-full bg-slate-300 flex-shrink-0" />}
                                {STATUS_LABELS[step]}
                            </button>
                            {i < STATUS_FLOW.length - 1 && (
                                <ChevronRight size={14} className={`flex-shrink-0 ${isPast ? 'text-emerald-400' : 'text-slate-300'}`} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        );
    };

    const renderPaymentBadge = () => {
        const status = getPaymentStatus();
        if (status === 'paid') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle size={10} /> PAGADO
                </span>
            );
        }
        if (status === 'partial') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    <Clock size={10} /> ABONO PARCIAL
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                SIN PAGOS
            </span>
        );
    };

    // ============================================================
    // LEFT PANEL — Order List
    // ============================================================
    const renderOrderList = () => (
        <div id="tour-services-list" className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                    <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Wrench size={20} className="text-blue-600" />
                        Servicios
                    </h1>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowTemplatesManager(true)}
                            id="tour-services-templates"
                            className="flex items-center gap-1.5 px-3 py-2 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 text-sm font-semibold rounded-lg shadow-sm border border-yellow-200 transition-colors"
                            title="Gestionar plantillas de servicio"
                        >
                            <Zap size={16} /> Plantillas
                        </button>
                        <button
                            onClick={() => setShowNewOrderModal(true)}
                            id="tour-services-new-order"
                            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
                        >
                            <Plus size={16} /> Nueva
                        </button>
                    </div>
                </div>

                {/* Status filter pills */}
                <div id="tour-services-filters" className="flex flex-wrap gap-1.5 pb-1">
                    {FILTER_STATUSES.map((f) => (
                        <button
                            key={f.value}
                            onClick={() => setFilterStatus(f.value)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors
                                ${filterStatus === f.value
                                    ? 'bg-slate-800 text-white'
                                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                                }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Order list scrollable */}
            <div className="flex-1 overflow-y-auto">
                {loadingList ? (
                    <div className="p-8 text-center text-slate-400 text-sm">Cargando...</div>
                ) : orders.length === 0 ? (
                    <div className="p-8 text-center">
                        <Wrench className="mx-auto text-slate-300 mb-3" size={36} />
                        <p className="text-sm text-slate-500">No hay órdenes</p>
                        <p className="text-xs text-slate-400 mt-1">Cambie el filtro o cree una nueva orden</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {orders.map((order) => {
                            const isSelected = selectedOrderId === order.id;
                            const payInd = getOrderPaymentIndicator(order);

                            return (
                                <div
                                    key={order.id}
                                    onClick={() => selectOrder(order.id)}
                                    className={`p-3 cursor-pointer transition-colors group relative
                                        ${isSelected
                                            ? 'bg-blue-50 border-l-[3px] border-l-blue-600'
                                            : 'hover:bg-slate-50 border-l-[3px] border-l-transparent'
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-slate-800 text-sm">{order.ticket_number}</span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${STATUS_COLORS[order.status]}`}>
                                                    {STATUS_LABELS[order.status]}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-700 font-medium truncate">
                                                {order.customer?.name || 'Sin cliente'}
                                            </p>
                                            <p className="text-xs text-slate-400 truncate mt-0.5">
                                                {order.brand} {order.model}
                                                {' '}&middot;{' '}
                                                {new Date(order.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {/* Payment dot */}
                                            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0
                                                ${payInd === 'paid' ? 'bg-emerald-500' : payInd === 'partial' ? 'bg-amber-400' : 'bg-slate-300'}`}
                                                title={payInd === 'paid' ? 'Pagado' : payInd === 'partial' ? 'Abono parcial' : 'Sin pagos'}
                                            />
                                            <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );

    // ============================================================
    // RIGHT PANEL — Order Detail
    // ============================================================
    const renderOrderDetail = () => {
        if (!selectedOrder) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <Wrench size={32} className="text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-600 mb-1">Selecciona una orden</h3>
                    <p className="text-sm text-slate-400">o crea una nueva para comenzar</p>
                </div>
            );
        }

        if (loadingDetail) {
            return (
                <div className="flex items-center justify-center h-full">
                    <div className="text-slate-400 text-sm">Cargando detalle...</div>
                </div>
            );
        }

        const paymentStatus = getPaymentStatus();

        return (
            <div id="tour-services-detail" className="flex flex-col h-full overflow-y-auto">
                {/* Section 1: Header */}
                <div className="p-4 border-b border-slate-200 flex-shrink-0 bg-white">
                    {/* Mobile back button */}
                    <div className="md:hidden mb-3">
                        <button
                            onClick={() => { setMobileView('list'); setSelectedOrderId(null); setSelectedOrder(null); }}
                            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800"
                        >
                            <ArrowLeft size={16} /> Volver a la lista
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h2 className="text-xl font-bold text-slate-800">#{selectedOrder.ticket_number}</h2>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${STATUS_COLORS[selectedOrder.status]}`}>
                            {STATUS_LABELS[selectedOrder.status]}
                        </span>
                        {renderPaymentBadge()}
                        <div className="ml-auto flex gap-2">
                            <button
                                onClick={handlePrintTicket}
                                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Imprimir ticket"
                            >
                                <Printer size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                        <div className="flex items-center gap-2">
                            <User size={14} className="text-slate-400 flex-shrink-0" />
                            <span className="font-medium text-slate-700">{selectedOrder.customer?.name}</span>
                            {selectedOrder.customer?.phone && (
                                <span className="text-slate-400">&middot; {selectedOrder.customer.phone}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Smartphone size={14} className="text-slate-400 flex-shrink-0" />
                            <span className="text-slate-600">
                                {selectedOrder.brand} {selectedOrder.model}
                                {selectedOrder.serial_imei && (
                                    <span className="text-slate-400 ml-1 font-mono text-xs">({selectedOrder.serial_imei})</span>
                                )}
                            </span>
                        </div>
                    </div>

                    {/* Problem description */}
                    {selectedOrder.problem_description && (
                        <div className="mt-2">
                            <p className={`text-sm text-slate-500 ${!expandProblem ? 'line-clamp-2' : ''}`}>
                                <span className="font-medium text-orange-600">Falla:</span>{' '}
                                {selectedOrder.problem_description}
                            </p>
                            {selectedOrder.problem_description.length > 120 && (
                                <button
                                    onClick={() => setExpandProblem(!expandProblem)}
                                    className="text-xs text-blue-500 hover:text-blue-700 mt-0.5"
                                >
                                    {expandProblem ? 'Ver menos' : 'Ver más'}
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Section 2: Status Stepper */}
                <div id="tour-services-status" className="px-4 py-3 border-b border-slate-200 flex-shrink-0 bg-slate-50">
                    {renderStatusStepper()}
                </div>

                {/* Section 3: Items / Parts */}
                <div id="tour-services-items" className="px-4 pt-4 pb-2 flex-shrink-0">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between p-3 border-b border-slate-100">
                            <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                                <Package size={16} className="text-blue-600" />
                                Repuestos y Mano de Obra
                            </h3>
                            <button
                                onClick={() => {
                                    setShowItemForm(true);
                                    setNewItem({ product: null, description: '', quantity: 1, price: 0, technician_id: '', is_manual: false });
                                    setProductSearchTerm('');
                                    setProducts([]);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors"
                            >
                                <Plus size={14} /> Agregar
                            </button>
                        </div>

                        {/* Add Item Form */}
                        {showItemForm && (
                            <div className="p-3 bg-slate-50 border-b border-slate-200">
                                {/* Tabs */}
                                <div className="flex gap-3 border-b border-slate-200 mb-3">
                                    <button
                                        className={`pb-2 text-xs font-semibold ${!newItem.is_manual ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}
                                        onClick={() => setNewItem({ ...newItem, is_manual: false, description: '' })}
                                    >
                                        Inventario / Repuesto
                                    </button>
                                    <button
                                        className={`pb-2 text-xs font-semibold ${newItem.is_manual ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}
                                        onClick={() => setNewItem({ ...newItem, is_manual: true, product: null })}
                                    >
                                        Servicio Manual
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {!newItem.is_manual ? (
                                        !newItem.product ? (
                                            <div className="relative">
                                                <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                                                <input
                                                    autoFocus
                                                    placeholder="Buscar repuesto..."
                                                    className="w-full pl-8 p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                    value={productSearchTerm}
                                                    onChange={(e) => setProductSearchTerm(e.target.value)}
                                                />
                                                {products.length > 0 && (
                                                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                                                        {products.map((p) => (
                                                            <div
                                                                key={p.id}
                                                                onClick={() => setNewItem({ ...newItem, product: p, price: p.price })}
                                                                className="p-2 hover:bg-blue-50 cursor-pointer text-sm"
                                                            >
                                                                <div className="font-medium text-slate-800">{p.name}</div>
                                                                <div className="text-xs text-slate-400 flex justify-between">
                                                                    <span>{formatCurrency(p.price)}</span>
                                                                    <span>Stock: {p.stock}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between bg-white p-2 border border-slate-200 rounded-lg">
                                                <span className="font-medium text-sm truncate flex-1 text-slate-800">{newItem.product.name}</span>
                                                <button onClick={() => setNewItem({ ...newItem, product: null })} className="text-red-500 text-xs hover:underline ml-2">
                                                    Cambiar
                                                </button>
                                            </div>
                                        )
                                    ) : (
                                        <div>
                                            <input
                                                autoFocus
                                                placeholder="Descripción del servicio..."
                                                className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={newItem.description}
                                                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                                            />
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <div className="w-20">
                                            <label className="text-[10px] text-slate-500 font-semibold">Cant.</label>
                                            <input
                                                type="number"
                                                min="1"
                                                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                                value={newItem.quantity}
                                                onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) })}
                                            />
                                        </div>
                                        <div className="w-24">
                                            <label className="text-[10px] text-slate-500 font-semibold">Precio ($)</label>
                                            <input
                                                type="number"
                                                className={`w-full p-2 border border-slate-200 rounded-lg text-sm ${newItem.product ? 'bg-slate-100 text-slate-400' : ''}`}
                                                value={newItem.price}
                                                onChange={(e) => setNewItem({ ...newItem, price: parseFloat(e.target.value) })}
                                                readOnly={!!newItem.product}
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <label className="text-[10px] text-slate-500 font-semibold">Técnico</label>
                                            {!newItem.product ? (
                                                <select
                                                    className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                                    value={newItem.technician_id}
                                                    onChange={(e) => setNewItem({ ...newItem, technician_id: e.target.value })}
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {technicians.map((t) => (
                                                        <option key={t.id} value={t.id}>{t.username}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <div className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-100 text-slate-400 italic truncate">
                                                    N/A (Repuesto)
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-2 pt-1">
                                        <button
                                            onClick={() => setShowItemForm(false)}
                                            className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleAddItem}
                                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-blue-700 transition-colors"
                                        >
                                            Agregar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Items table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-500">
                                    <tr>
                                        <th className="text-left p-2.5 font-medium text-xs">Descripción</th>
                                        <th className="text-right p-2.5 font-medium text-xs w-14">Cant</th>
                                        <th className="text-right p-2.5 font-medium text-xs w-20">Precio</th>
                                        <th className="text-right p-2.5 font-medium text-xs w-20">Total</th>
                                        <th className="text-right p-2.5 font-medium text-xs w-24 hidden sm:table-cell">Técnico</th>
                                        <th className="w-8"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {selectedOrder.details?.map((detail) => (
                                        <tr key={detail.id} className="hover:bg-slate-50">
                                            <td className="p-2.5">
                                                <div className="flex items-center gap-1.5">
                                                    {detail.is_manual && (
                                                        <span className="bg-purple-100 text-purple-700 text-[9px] px-1 rounded border border-purple-200 flex-shrink-0">MO</span>
                                                    )}
                                                    <span className="font-medium text-slate-800 truncate">
                                                        {detail.description || detail.product?.name || 'Item'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="text-right p-2.5 text-slate-600">{Number(detail.quantity)}</td>
                                            <td className="text-right p-2.5 text-slate-600">{formatCurrency(detail.unit_price)}</td>
                                            <td className="text-right p-2.5 font-semibold text-slate-800">
                                                {formatCurrency(Number(detail.quantity) * Number(detail.unit_price))}
                                            </td>
                                            <td className="text-right p-2.5 text-xs text-slate-400 hidden sm:table-cell truncate">
                                                {detail.technician?.username || '-'}
                                            </td>
                                            <td className="text-right p-2">
                                                {user?.role === 'ADMIN' && (
                                                    <button
                                                        onClick={() => handleDeleteItem(detail.id)}
                                                        className="text-slate-300 hover:text-red-500 p-1 transition-colors"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {(!selectedOrder.details || selectedOrder.details.length === 0) && (
                                        <tr>
                                            <td colSpan="6" className="text-center p-6 text-slate-400 italic text-xs">
                                                No hay repuestos o servicios cargados
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                {selectedOrder.details?.length > 0 && (
                                    <tfoot>
                                        <tr className="border-t-2 border-slate-200">
                                            <td colSpan="3" className="text-right p-2.5 font-semibold text-slate-600 text-xs">TOTAL</td>
                                            <td className="text-right p-2.5 font-bold text-lg text-slate-800">
                                                {formatCurrency(orderTotal)}
                                            </td>
                                            <td colSpan="2"></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                </div>

                {/* Section 4: Payment Section */}
                <div id="tour-services-payments" className="px-4 py-2 flex-shrink-0">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                        <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2 mb-3">
                            <DollarSign size={16} className="text-emerald-600" />
                            Pagos
                        </h3>

                        {/* Summary */}
                        <div className="space-y-2 mb-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Total Orden</span>
                                <span className="font-semibold text-slate-800">{formatCurrency(orderTotal)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 flex items-center gap-1">
                                    Abonado
                                    {paymentStatus === 'paid' && <CheckCircle size={12} className="text-emerald-500" />}
                                </span>
                                <span className={`font-semibold ${orderPaid > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                    {formatCurrency(orderPaid)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-sm pt-1 border-t border-dashed border-slate-200">
                                <span className="text-slate-600 font-medium flex items-center gap-1">
                                    Pendiente
                                    {orderPending > 0 && <AlertTriangle size={12} className="text-amber-500" />}
                                </span>
                                <span className={`font-bold text-lg ${orderPending > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {formatCurrency(orderPending)}
                                </span>
                            </div>

                            {/* Progress bar for partial */}
                            {paymentStatus === 'partial' && orderTotal > 0 && (
                                <div className="w-full bg-slate-100 rounded-full h-2 mt-1">
                                    <div
                                        className="bg-amber-400 h-2 rounded-full transition-all"
                                        style={{ width: `${Math.min(100, (orderPaid / orderTotal) * 100)}%` }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Payment history */}
                        {selectedOrder.payments?.length > 0 && (
                            <div className="mb-3">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Historial</p>
                                <div className="space-y-1">
                                    {selectedOrder.payments.map((p, i) => (
                                        <div key={i} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-2.5 py-1.5">
                                            <div className="flex items-center gap-2">
                                                <CreditCard size={12} className="text-slate-400" />
                                                <span className="text-slate-500">
                                                    {p.payment_date
                                                        ? new Date(p.payment_date).toLocaleDateString()
                                                        : new Date(p.created_at || selectedOrder.created_at).toLocaleDateString()}
                                                </span>
                                                <span className="text-slate-600 font-medium">{p.payment_method}</span>
                                                {p.reference && (
                                                    <span className="text-slate-400 font-mono text-[10px]">#{p.reference}</span>
                                                )}
                                            </div>
                                            <span className="font-semibold text-slate-800">{formatCurrency(parseFloat(p.amount))}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Payment badge */}
                        {paymentStatus === 'paid' && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-center">
                                <span className="text-emerald-700 text-xs font-bold flex items-center justify-center gap-1.5">
                                    <CheckCircle size={14} /> Orden completamente pagada
                                </span>
                            </div>
                        )}

                        {paymentStatus === 'unpaid' && orderTotal === 0 && (
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-center">
                                <span className="text-slate-400 text-xs">Agregue items para generar el total</span>
                            </div>
                        )}

                        {/* Abono / Cobrar */}
                        {paymentStatus !== 'paid' && orderTotal > 0 && (
                            <div className="space-y-2">
                                {!showPaymentForm ? (
                                    <button
                                        onClick={() => {
                                            setPaymentAmount(orderPending);
                                            setPaymentMethod('Efectivo');
                                            setPaymentRef('');
                                            setShowPaymentForm(true);
                                        }}
                                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm shadow-sm transition-colors flex items-center justify-center gap-2"
                                    >
                                        <DollarSign size={16} />
                                        Registrar Pago ({formatCurrency(orderPending)} pendiente)
                                    </button>
                                ) : (
                                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-blue-700 uppercase">Registrar Abono</span>
                                            <button onClick={() => setShowPaymentForm(false)} className="text-slate-400 hover:text-slate-600">
                                                <X size={14} />
                                            </button>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-semibold text-slate-500 uppercase">Monto ($)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0.01"
                                                max={orderPending}
                                                value={paymentAmount}
                                                onChange={(e) => setPaymentAmount(e.target.value)}
                                                className="w-full mt-0.5 px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-semibold text-slate-500 uppercase">Método de Pago</label>
                                            <select
                                                value={paymentMethod}
                                                onChange={(e) => setPaymentMethod(e.target.value)}
                                                className="w-full mt-0.5 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="Efectivo">Efectivo</option>
                                                <option value="Transferencia">Transferencia</option>
                                                <option value="Pago Móvil">Pago Móvil</option>
                                                <option value="Punto de Venta">Punto de Venta</option>
                                                <option value="Zelle">Zelle</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-semibold text-slate-500 uppercase">Referencia (opcional)</label>
                                            <input
                                                type="text"
                                                value={paymentRef}
                                                onChange={(e) => setPaymentRef(e.target.value)}
                                                placeholder="Nro. referencia"
                                                className="w-full mt-0.5 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setShowPaymentForm(false)}
                                                className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={handleAddPayment}
                                                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
                                                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                                            >
                                                <CheckCircle size={14} />
                                                Confirmar {parseFloat(paymentAmount) >= orderPending ? '' : 'Abono'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Section 5: Diagnosis Notes */}
                <div id="tour-services-diagnosis" className="px-4 py-2 pb-4 flex-shrink-0">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                                <FileText size={16} className="text-yellow-600" />
                                Diagnóstico y Notas
                            </h3>
                            <button
                                onClick={handleSaveNotes}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-semibold transition-colors"
                            >
                                <Save size={12} /> Guardar
                            </button>
                        </div>
                        <textarea
                            className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none text-sm font-mono bg-yellow-50 resize-none"
                            rows={4}
                            value={diagnosisNotes}
                            onChange={(e) => setDiagnosisNotes(e.target.value)}
                            placeholder="Escriba aquí los hallazgos técnicos..."
                        />
                    </div>
                </div>

                {/* Bottom spacing for mobile */}
                <div className="h-4 md:h-0 flex-shrink-0" />
            </div>
        );
    };

    // ============================================================
    // Main Layout
    // ============================================================
    return (
        <div id="tour-services-container" className="h-[calc(100vh-64px)] flex flex-col md:flex-row bg-slate-100">
            {/* LEFT PANEL — Order List */}
            <div className={`md:w-[420px] lg:w-[460px] md:flex-shrink-0 md:border-r border-slate-200 bg-white md:flex md:flex-col h-full
                ${mobileView === 'list' ? 'flex flex-col' : 'hidden md:flex md:flex-col'}`}
            >
                {renderOrderList()}
            </div>

            {/* RIGHT PANEL — Order Detail */}
            <div className={`flex-1 md:flex md:flex-col h-full overflow-hidden
                ${mobileView === 'detail' ? 'flex flex-col' : 'hidden md:flex md:flex-col'}`}
            >
                {renderOrderDetail()}
            </div>

            {/* Modals */}
            {showTemplatesManager && (
                <ServiceTemplatesManager onClose={() => setShowTemplatesManager(false)} />
            )}

            {showNewOrderModal && (
                <NewOrderModal
                    isOpen={showNewOrderModal}
                    onClose={() => setShowNewOrderModal(false)}
                    onCreated={(order) => {
                        fetchOrders();
                        selectOrder(order.id);
                        setShowNewOrderModal(false);
                    }}
                />
            )}

            {showDeliveryModal && selectedOrder && (
                <ServiceDeliveryModal
                    order={selectedOrder}
                    onClose={() => setShowDeliveryModal(false)}
                    onDeliver={() => {
                        setShowDeliveryModal(false);
                        handleUpdateStatus('DELIVERED');
                    }}
                    onPaymentRequest={handlePaymentRequest}
                />
            )}

            {showPaymentModal && selectedOrder && (
                <PaymentModal
                    isOpen={showPaymentModal}
                    onClose={() => setShowPaymentModal(false)}
                    totalUSD={paymentData?.quantity * paymentData?.unit_price}
                    cart={[{
                        product_id: paymentData?.product_id,
                        quantity: paymentData?.quantity,
                        unit_price: paymentData?.unit_price,
                        description: paymentData?.description,
                        is_manual: paymentData?.is_manual,
                        unit_price_usd: paymentData?.unit_price,
                        price_usd: paymentData?.unit_price,
                        original_price_usd: paymentData?.unit_price,
                        conversion_factor: 1,
                    }]}
                    onConfirm={handlePaymentSuccess}
                    initialCustomer={selectedOrder.customer}
                />
            )}
        </div>
    );
};

export default ServicesUnified;
