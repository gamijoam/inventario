import React, { useState, useEffect } from 'react';
import {
    X, Package, User, Clock, CheckCircle,
    ArrowRight, DollarSign, AlertTriangle,
    Printer, Plus, Trash2, ArrowLeft, Search, Shirt, Pencil, Zap
} from 'lucide-react';
import apiClient from '../../../config/axios';
import { toast } from 'react-hot-toast';
import PaymentModal from '../../../components/pos/PaymentModal';
import printerService from '../../../services/printerService';

const STATUS_STEPS = [
    { id: 'RECEIVED', label: 'Recibido' },
    { id: 'IN_PROGRESS', label: 'Procesando' },
    { id: 'READY', label: 'Listo' },
    { id: 'DELIVERED', label: 'Entregado' }
];

const LaundryDetailModal = ({ orderId, onClose }) => {
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [thermalMenuOpen, setThermalMenuOpen] = useState(false);

    // Payment State
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    // Add/Edit Item State
    const [isAddingItem, setIsAddingItem] = useState(false);
    const [editingItemId, setEditingItemId] = useState(null);

    // Product Search for Add Item
    const [productSearch, setProductSearch] = useState('');
    const [products, setProducts] = useState([]);
    const [showProductResults, setShowProductResults] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);

    const [newItem, setNewItem] = useState({
        description: '',
        observations: '',
        quantity: 1,
        unit_price: 0,
        product_id: null
    });

    // Fetch Order & Services
    const fetchOrder = async () => {
        try {
            const res = await apiClient.get(`/services/orders/${orderId}`);
            setOrder(res.data);
        } catch (error) {
            console.error(error);
            toast.error("Error cargando detalles");
            onClose();
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrder();
    }, [orderId]);

    // Product Search Effect
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (productSearch.length > 1 && (!selectedProduct || productSearch !== selectedProduct.name)) {
                try {
                    const res = await apiClient.get(`/products?search=${productSearch}`);
                    setProducts(Array.isArray(res.data) ? res.data : (res.data?.items || []));
                    setShowProductResults(true);
                } catch (error) {
                    console.error("Error searching products:", error);
                }
            } else {
                setProducts([]);
                setShowProductResults(false);
            }
        }, 400);
        return () => clearTimeout(delayDebounceFn);
    }, [productSearch, selectedProduct]);

    const handleProductSelect = (product) => {
        setSelectedProduct(product);
        setProductSearch(product.name);
        setShowProductResults(false);
        setProducts([]);

        setNewItem({
            ...newItem,
            description: product.name,
            unit_price: product.price || 0,
            product_id: product.id
        });
    };

    const handleUpdateStatus = async (status) => {
        try {
            await apiClient.patch(`/services/orders/${orderId}/status`, {
                status: status
            });
            toast.success("Estado Actualizado");
            fetchOrder();
        } catch (error) {
            console.error(error);
            toast.error(`Error: ${error.response?.data?.detail || "No se pudo actualizar"}`);
        }
    };

    const handleEditItem = (item) => {
        setEditingItemId(item.id);
        setNewItem({
            description: item.description,
            observations: item.observations || '',
            quantity: item.quantity,
            unit_price: item.unit_price,
            product_id: item.product_id
        });
        setIsAddingItem(false); // Hide standard add, show edit (controlled by OR in render)
    };

    const cancelEdit = () => {
        setEditingItemId(null);
        setNewItem({ description: '', observations: '', quantity: 1, unit_price: 0, product_id: null });
    };

    const handleAddItem = async () => {
        if (!newItem.description || newItem.quantity <= 0) {
            toast.error("Datos inválidos");
            return;
        }
        try {
            if (editingItemId) {
                // EDIT MODE: Delete Old -> Add New
                await apiClient.delete(`/services/orders/${orderId}/items/${editingItemId}`);
            }

            // Create New
            await apiClient.post(`/services/orders/${orderId}/items`, newItem);

            toast.success(editingItemId ? "Ítem actualizado" : "Ítem agregado");
            setIsAddingItem(false);
            setEditingItemId(null);
            setNewItem({ description: '', observations: '', quantity: 1, unit_price: 0, product_id: null });
            setSelectedProduct(null);
            setProductSearch('');
            fetchOrder();
        } catch (error) {
            console.error(error);
            toast.error("Error guardando ítem");
        }
    };

    const handleDeleteItem = async (itemId) => {
        if (!confirm("¿Eliminar este ítem?")) return;
        try {
            await apiClient.delete(`/services/orders/${orderId}/items/${itemId}`);
            toast.success("Ítem eliminado");
            fetchOrder();
        } catch (error) {
            console.error(error);
            toast.error("Error eliminando ítem");
        }
    };

    const handlePreparePayment = () => {
        // Collect all items for the cart
        const cartItems = order.details.map(d => ({
            product_id: d.product_id || 9999, // Fallback ID if none
            description: d.description,
            quantity: Number(d.quantity),
            unit_price: Number(d.unit_price),
            unit_price_usd: Number(d.unit_price), // Assuming price is USD base ref
            original_price_usd: Number(d.unit_price),
            subtotal: Number(d.quantity) * Number(d.unit_price),
            is_manual: d.is_manual
        }));

        if (cartItems.length === 0) {
            toast.error("No hay ítems para cobrar");
            return;
        }

        setShowPaymentModal(true);
    };

    const handlePaymentSuccess = async (result) => {
        try {
            const currentMeta = order.order_metadata || {};
            await apiClient.patch(`/services/orders/${orderId}/status`, {
                // status: 'DELIVERED', // REMOVED: Payment does not equal Delivery
                order_metadata: {
                    ...currentMeta,
                    sale_id: result.saleId || result.id,
                    payment_status: 'PAID',
                    payment_date: new Date().toISOString(),
                    // Store payment details including references
                    payment_details: result.payments || []
                }
            });

            toast.success("Pago completado y registrado");
            setShowPaymentModal(false);
            fetchOrder();

        } catch (error) {
            console.error(error);
            toast.error("Error vinculando el pago");
        }
    };

    const handlePrintTicket = () => {
        window.open(`#/laundry/ticket/${orderId}`, '_blank', 'width=400,height=600');
    };

    const handleThermalPrint = async (width) => {
        setThermalMenuOpen(false);
        const loadingToast = toast.loading(`Enviando a impresora térmica (${width}mm)...`);
        try {
            const { data: payload } = await apiClient.get(`/services/orders/${orderId}/print/thermal?width=${width}`);
            await printerService.printRaw(payload);
            toast.dismiss(loadingToast);
            toast.success(`Orden enviada a térmica (${width}mm)`);
        } catch (error) {
            toast.dismiss(loadingToast);
            console.error("Thermal Print Error:", error);
            toast.error(error.message || "Error: Bridge no conectado o impresora no disponible");
        }
    };

    if (loading || !order) return null;

    const totalAmount = order.details?.reduce((acc, item) => acc + (Number(item.quantity) * Number(item.unit_price)), 0) || 0;
    const isPaid = order.order_metadata?.payment_status === 'PAID';

    return (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-auto max-h-[85vh] flex overflow-hidden animate-in fade-in zoom-in-95">

                {/* LEFT: STATUS & DETAILS */}
                <div className="w-8/12 p-8 bg-slate-50 flex flex-col overflow-y-auto custom-scrollbar">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="bg-indigo-600 text-white p-2 rounded-lg shadow-indigo-200">
                                    <Package size={24} />
                                </div>
                                <h2 className="font-bold text-2xl text-slate-800">Orden #{order.ticket_number}</h2>
                            </div>
                            <p className="text-slate-500 text-sm ml-12">
                                {new Date(order.created_at).toLocaleString()}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handlePrintTicket} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Imprimir Ticket (hoja normal)">
                                <Printer size={20} />
                            </button>
                            {/* Botón de impresión térmica con selector 58mm/80mm */}
                            <div className="relative">
                                <button
                                    onClick={() => setThermalMenuOpen(prev => !prev)}
                                    className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                    title="Imprimir en térmica (Bridge)"
                                >
                                    <Zap size={20} />
                                </button>
                                {thermalMenuOpen && (
                                    <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden w-28">
                                        <button
                                            onClick={() => handleThermalPrint('58')}
                                            className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors flex items-center gap-2"
                                        >
                                            <Zap size={12} /> 58mm
                                        </button>
                                        <button
                                            onClick={() => handleThermalPrint('80')}
                                            className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors flex items-center gap-2 border-t border-slate-100"
                                        >
                                            <Zap size={12} /> 80mm
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center border ${order.status === 'DELIVERED' ? 'bg-teal-100 text-teal-700 border-teal-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                                {order.status === 'DELIVERED' ? 'ENTREGADO' : STATUS_STEPS.find(s => s.id === order.status)?.label || order.status}
                            </div>
                        </div>
                    </div>

                    {/* Customer Info Card */}
                    {order.customer && (
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6">
                            <div className="flex items-center gap-2 mb-3">
                                <User size={18} className="text-indigo-500" />
                                <h3 className="font-bold text-slate-700">Información del Cliente</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <span className="text-slate-500 text-xs">Nombre:</span>
                                    <p className="font-semibold text-slate-800">{order.customer.name}</p>
                                </div>
                                {order.customer.phone && (
                                    <div>
                                        <span className="text-slate-500 text-xs">Teléfono:</span>
                                        <p className="font-semibold text-slate-800">{order.customer.phone}</p>
                                    </div>
                                )}
                                {order.customer.email && (
                                    <div>
                                        <span className="text-slate-500 text-xs">Email:</span>
                                        <p className="font-semibold text-slate-800 text-xs">{order.customer.email}</p>
                                    </div>
                                )}
                                {order.customer.address && (
                                    <div className="col-span-2">
                                        <span className="text-slate-500 text-xs">Dirección:</span>
                                        <p className="font-semibold text-slate-800">{order.customer.address}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Timeline */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 mb-6">
                        <div className="flex items-center justify-between relative">
                            {/* Line */}
                            <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-slate-100 -z-10"></div>

                            {STATUS_STEPS.map((step, idx) => {
                                const currentIndex = STATUS_STEPS.findIndex(s => s.id === order.status);
                                const stepIndex = idx;
                                const isPassed = stepIndex <= currentIndex;
                                const isCurrent = stepIndex === currentIndex;

                                return (
                                    <button
                                        key={step.id}
                                        onClick={() => handleUpdateStatus(step.id)}
                                        className="flex flex-col items-center gap-2 bg-white px-2 group cursor-pointer"
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${isPassed ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 text-slate-300'} ${!isPassed && 'group-hover:border-indigo-400'}`}>
                                            {isPassed ? <CheckCircle size={14} /> : <div className="w-2 h-2 rounded-full bg-slate-300" />}
                                        </div>
                                        <span className={`text-xs font-bold ${isCurrent ? 'text-indigo-700' : isPassed ? 'text-slate-700' : 'text-slate-400'}`}>
                                            {step.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Items List */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex-1 flex flex-col">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-gray-50/50 rounded-t-xl">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <Package size={18} className="text-indigo-500" /> Detalle de Servicios
                            </h3>
                            {!isPaid && (
                                <button
                                    onClick={() => setIsAddingItem(!isAddingItem)}
                                    className="text-xs text-indigo-600 font-bold hover:bg-indigo-50 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                                >
                                    <Plus size={14} /> {isAddingItem ? 'Cancelar' : 'Agregar Ítem'}
                                </button>
                            )}
                        </div>

                        {/* Internal Add/Edit Form */}
                        {(isAddingItem || editingItemId) && (
                            <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex flex-col gap-3 animate-in fade-in">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-bold text-indigo-700">{editingItemId ? 'Editar Ítem' : 'Nuevo Ítem'}</span>
                                    {editingItemId && <button onClick={cancelEdit} className="text-[10px] text-slate-400 underline">Cancelar Edición</button>}
                                </div>
                                <div className="flex gap-2 items-end">
                                    <div className="flex-1 relative">
                                        <label className="text-[10px] font-bold text-indigo-800 uppercase">Buscar Producto / Servicio</label>
                                        <div className="relative">
                                            <Search className="absolute left-2 top-2 text-indigo-300" size={14} />
                                            <input
                                                className="w-full pl-8 p-2 rounded border border-indigo-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                placeholder="Ej: Lavado..."
                                                value={productSearch}
                                                onChange={e => setProductSearch(e.target.value)}
                                            />
                                            {showProductResults && (
                                                <div className="absolute z-20 w-full mt-1 bg-white border rounded shadow-lg max-h-40 overflow-y-auto">
                                                    {products.map(p => (
                                                        <div key={p.id} onClick={() => handleProductSelect(p)} className="p-2 hover:bg-indigo-50 cursor-pointer text-xs border-b flex justify-between">
                                                            <span>{p.name}</span>
                                                            <span className="font-bold text-indigo-600">${p.price}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="w-1/3">
                                        <label className="text-[10px] font-bold text-indigo-800 uppercase">Descripción</label>
                                        <input
                                            className="w-full p-2 rounded border border-indigo-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={newItem.description}
                                            onChange={e => setNewItem({ ...newItem, description: e.target.value })}
                                            placeholder="Descripción..."
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <div className="flex-1">
                                        <label className="text-[10px] font-bold text-indigo-800 uppercase">Observaciones</label>
                                        <textarea
                                            className="w-full p-2 rounded border border-indigo-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                            placeholder="Notas especiales sobre este servicio..."
                                            rows="2"
                                            value={newItem.observations}
                                            onChange={e => setNewItem({ ...newItem, observations: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-2 items-end justify-end">
                                    <div className="w-20">
                                        <label className="text-[10px] font-bold text-indigo-800 uppercase">Cant.</label>
                                        <input
                                            type="number"
                                            className="w-full p-2 rounded border border-indigo-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={newItem.quantity}
                                            onChange={e => setNewItem({ ...newItem, quantity: e.target.value })}
                                        />
                                    </div>
                                    <div className="w-24">
                                        <label className="text-[10px] font-bold text-indigo-800 uppercase">Precio Unit.</label>
                                        <input
                                            type="number"
                                            className="w-full p-2 rounded border border-indigo-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={newItem.unit_price}
                                            onChange={e => setNewItem({ ...newItem, unit_price: e.target.value })}
                                        />
                                    </div>
                                    <button onClick={handleAddItem} className="bg-indigo-600 text-white p-2 rounded hover:bg-indigo-700 mb-[1px]">
                                        {editingItemId ? 'Guardar Cambios' : <><Plus size={18} /> Agregar</>}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto p-2">
                            <table className="w-full text-sm">
                                <thead className="text-slate-400 font-medium text-xs uppercase border-b border-slate-100">
                                    <tr>
                                        <th className="text-left py-2 px-3">Descripción</th>
                                        <th className="text-center py-2 px-3">Cant.</th>
                                        <th className="text-right py-2 px-3">Precio</th>
                                        <th className="text-right py-2 px-3">Total</th>
                                        <th className="w-16"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {order.details?.map(item => (
                                        <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 group">
                                            <td className="py-3 px-3">
                                                <div className="font-bold text-slate-700">{item.description}</div>
                                                {item.is_manual && <span className="text-[10px] bg-amber-50 text-amber-600 px-1 rounded">Manual</span>}
                                                {item.observations && (
                                                    <div className="mt-1 text-xs text-gray-600 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">
                                                        <span className="font-bold text-amber-700">Nota:</span> {item.observations}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-3 px-3 text-center text-slate-600">{item.quantity}</td>
                                            <td className="py-3 px-3 text-right text-slate-500">${Number(item.unit_price).toFixed(2)}</td>
                                            <td className="py-3 px-3 text-right font-bold text-slate-700">${(Number(item.quantity) * Number(item.unit_price)).toFixed(2)}</td>
                                            <td className="py-3 px-3 text-right">
                                                {!isPaid && (
                                                    <div className="flex gap-1 justify-end">
                                                        <button
                                                            onClick={() => handleEditItem(item)}
                                                            className="text-indigo-400 hover:text-indigo-600 p-1 hover:bg-indigo-50 rounded"
                                                            title="Editar"
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteItem(item.id)}
                                                            className="text-slate-300 hover:text-rose-500 p-1 hover:bg-rose-50 rounded"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {(!order.details || order.details.length === 0) && (
                                        <tr>
                                            <td colSpan="5" className="text-center py-8 text-slate-400 italic">No hay servicios registrados</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* RIGHT: BILLING & ACTIONS */}
                <div className="w-4/12 bg-white border-l border-slate-100 flex flex-col relative z-20 shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.1)]">
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full transition-colors z-10 text-slate-400 hover:text-rose-500">
                        <X size={24} />
                    </button>

                    <div className="flex-1 flex flex-col p-8 bg-slate-50/50">
                        {/* Metadata Box */}
                        <div className="bg-white p-4 rounded-xl border border-dotted border-slate-300 mb-6 space-y-2 text-sm text-slate-600">
                            <div className="flex justify-between">
                                <span className="font-bold">Identificador/Bolsa:</span>
                                <span>{order.order_metadata?.bag_color || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-bold">Total Piezas:</span>
                                <span>{order.order_metadata?.pieces || 0}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-bold">Prioridad:</span>
                                <span className={order.priority === 'URGENT' ? 'text-rose-600 font-bold' : ''}>{order.priority}</span>
                            </div>
                        </div>

                        {/* Bill Summary */}
                        <div className="flex-1 flex flex-col justify-end">
                            <div className="space-y-4 mb-8">
                                <div className="flex justify-between items-center text-slate-500">
                                    <span>Subtotal</span>
                                    <span>${totalAmount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-2xl font-black text-slate-800 border-t border-slate-200 pt-4">
                                    <span>Total</span>
                                    <span className="text-indigo-600">${totalAmount.toFixed(2)}</span>
                                </div>
                            </div>

                            {isPaid ? (
                                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-6 text-center">
                                    <CheckCircle size={40} className="text-emerald-500 mx-auto mb-3" />
                                    <h3 className="text-emerald-800 font-bold text-lg mb-1">Orden Pagada</h3>
                                    <div className="text-emerald-600 text-sm mb-4 space-y-2">
                                        <p className="text-xs">
                                            Venta: #{order.order_metadata?.sale_id}<br />
                                            {new Date(order.order_metadata?.payment_date).toLocaleDateString()}
                                        </p>

                                        {/* Payment Details */}
                                        {order.order_metadata?.payment_details && order.order_metadata.payment_details.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-emerald-200">
                                                <p className="text-xs font-bold text-emerald-700 mb-2">Métodos de Pago:</p>
                                                {order.order_metadata.payment_details.map((payment, idx) => (
                                                    <div key={idx} className="text-xs bg-white rounded p-2 mb-1 text-left">
                                                        <div className="flex justify-between">
                                                            <span className="font-semibold text-emerald-800">{payment.method}</span>
                                                            <span className="font-bold text-emerald-700">
                                                                {payment.currency === 'USD' || payment.currency === '$' ? '$' : 'Bs'} {Number(payment.amount).toFixed(2)}
                                                            </span>
                                                        </div>
                                                        {payment.reference && (
                                                            <div className="mt-1 text-emerald-600">
                                                                <span className="font-semibold">Ref:</span> {payment.reference}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {order.status !== 'DELIVERED' && (
                                        <button
                                            onClick={() => handleUpdateStatus('DELIVERED')}
                                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg shadow-lg shadow-emerald-200 transition-all"
                                        >
                                            Marcar como Entregado
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <button
                                    onClick={handlePreparePayment}
                                    disabled={totalAmount <= 0}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-xl shadow-indigo-200 flex items-center justify-center gap-3 transition-all active:scale-95"
                                >
                                    <DollarSign size={24} />
                                    COBRAR (${totalAmount.toFixed(2)})
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* MODAL OVERLAYS */}
                {showPaymentModal && (
                    <PaymentModal
                        isOpen={showPaymentModal}
                        totalUSD={totalAmount}
                        cart={order.details.map(d => ({
                            product_id: d.product_id || 9999,
                            description: d.description,
                            quantity: Number(d.quantity),
                            unit_price: Number(d.unit_price),
                            unit_price_usd: Number(d.unit_price),
                            subtotal: Number(d.quantity) * Number(d.unit_price),
                            conversion_factor: 1
                        }))}
                        initialCustomer={order.customer}
                        onClose={() => setShowPaymentModal(false)}
                        onConfirm={handlePaymentSuccess}
                    />
                )}
            </div>
        </div>
    );
};

export default LaundryDetailModal;
