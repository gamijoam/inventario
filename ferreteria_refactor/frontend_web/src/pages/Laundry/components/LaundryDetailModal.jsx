import React, { useState, useEffect } from 'react';
import {
    X, Package, User, Clock, CheckCircle,
    ArrowRight, DollarSign, AlertTriangle, Activity
} from 'lucide-react';
import apiClient from '../../../config/axios';
import { toast } from 'react-hot-toast';
import PaymentModal from '../../../components/pos/PaymentModal';

const STATUS_STEPS = [
    { id: 'RECEIVED', label: 'Recibido' },
    { id: 'IN_PROGRESS', label: 'Procesando' }, // Maps directly or logic
    { id: 'READY', label: 'Listo' },
    { id: 'DELIVERED', label: 'Entregado' }
];

const LaundryDetailModal = ({ orderId, onClose }) => {
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);

    // Delivery & Payment
    const [weight, setWeight] = useState(0);
    const [pieces, setPieces] = useState(0); // Added pieces state
    const [pricePerKg, setPricePerKg] = useState(0);
    const [selectedUnit, setSelectedUnit] = useState('KG'); // KG or PIECES
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentData, setPaymentData] = useState(null);

    const [serviceProducts, setServiceProducts] = useState([]);

    // Fetch Order & Services
    useEffect(() => {
        const fetchOrder = async () => {
            try {
                const res = await apiClient.get(`/services/orders/${orderId}`);
                setOrder(res.data);
                const metaWeight = res.data.order_metadata?.weight_kg || 0;
                const metaPieces = res.data.order_metadata?.pieces || 0;
                setWeight(metaWeight);
                setPieces(metaPieces);

                // Fetch available services (Simple logic: search 'Lavado', 'Planchado', 'Servicio')
                // Realistically, you'd fetch by Category 'Lavanderia' or Unit Type 'SERVICE'
                // For now, fetching broad search to populate dropdown
                // Fetch available services with multiple keywords to ensure variety
                const keywords = ['Lavado', 'Planchado', 'Edredon', 'Secado', 'Servicio'];
                let allProducts = [];

                // Parallel fetch for better coverage
                try {
                    const responses = await Promise.all(
                        keywords.map(k => apiClient.get('/products/', { params: { search: k } }))
                    );

                    // Deduplicate by ID
                    const prodMap = new Map();
                    responses.forEach(r => {
                        if (r.data) {
                            r.data.forEach(p => prodMap.set(p.id, p));
                        }
                    });
                    allProducts = Array.from(prodMap.values());
                } catch (e) {
                    console.error("Error fetching service products", e);
                }

                // Fallback to empty if failed
                let products = allProducts;

                setServiceProducts(products);

                // Determine Preferred Unit based on Metadata
                const preferPieces = metaPieces > 0 && metaWeight <= 0;

                // Smart Product Selection
                let defaultProd = null;

                if (preferPieces) {
                    // Try to find a Piece-based product first
                    defaultProd = products.find(p =>
                        p.unit_type === 'SERVICE_UNIT' ||
                        p.unit_type === 'UNIDAD' ||
                        p.unit_type === 'PIEZA'
                    );
                }

                // Fallback to first product if no specific match found
                if (!defaultProd) {
                    defaultProd = products[0];
                }

                if (defaultProd) {
                    // Re-evaluate unit based on the selected product
                    const isPiece = defaultProd.unit_type === 'SERVICE_UNIT' || defaultProd.unit_type === 'UNIDAD' || defaultProd.unit_type === 'PIEZA';

                    // Force unit if we clearly preferred pieces but product is ambiguous, or trust product
                    const unit = (preferPieces && isPiece) ? 'PIECES' : (isPiece ? 'PIECES' : 'KG');

                    const finalUnit = preferPieces ? 'PIECES' : unit;
                    const finalQty = preferPieces ? metaPieces : (finalUnit === 'KG' ? metaWeight : metaPieces);

                    setSelectedUnit(finalUnit);
                    setPricePerKg(parseFloat(defaultProd.price));
                    setPaymentData({
                        ...paymentData,
                        product_id: defaultProd.id,
                        description: `${defaultProd.name} (${finalQty} ${finalUnit === 'KG' ? 'Kg' : 'Pza'})`,
                        quantity: finalQty,
                        price_usd: parseFloat(defaultProd.price),
                        unit_price: parseFloat(defaultProd.price),
                        is_manual: false
                    });
                } else {
                    setPricePerKg(2.50); // Hard fallback
                }

            } catch (error) {
                console.error(error);
                toast.error("Error cargando detalles");
                onClose();
            } finally {
                setLoading(false);
            }
        };
        fetchOrder();
    }, [orderId]);

    const handleUpdateStatus = async (status) => {
        if (status === 'DELIVERED') {
            // Check if paid or prompt payment
            // For now, simpler flow: open payment preparation
            return;
        }

        try {
            await apiClient.patch(`/services/orders/${orderId}/status`, {
                status: status
            });
            toast.success("Estado Actualizado");
            // Refresh local state
            const res = await apiClient.get(`/services/orders/${orderId}`);
            setOrder(res.data);
        } catch (error) {
            console.error(error);
            toast.error(`Error: ${error.response?.data?.detail || "No se pudo actualizar"}`);
        }
    };

    const handlePreparePayment = async () => {
        // Prepare data for PaymentModal
        // Check quantity based on unit
        const qty = selectedUnit === 'KG' ? weight : pieces;

        if (qty <= 0) {
            toast.error(`La cantidad (${selectedUnit === 'KG' ? 'Peso' : 'Piezas'}) debe ser mayor a 0`);
            return;
        }

        // ... logic for finding prodId ...

        setPaymentData({
            product_id: paymentData?.product_id || prodId,
            description: paymentData?.description || `Servicio (${qty} ${selectedUnit === 'KG' ? 'Kg' : 'Pza'})`,
            quantity: qty,
            price_usd: pricePerKg,
            is_manual: false
        });

        setShowPaymentModal(true);
    };

    const handlePaymentSuccess = async (result) => {
        // Updated to use Metadata Linkage instead of auto-deliver
        try {
            const currentMeta = order.order_metadata || {};
            await apiClient.patch(`/services/orders/${orderId}/status`, {
                order_metadata: {
                    ...currentMeta,
                    sale_id: result.saleId || result.id, // Handle different response shapes
                    payment_status: 'PAID',
                    payment_date: new Date().toISOString()
                }
            });

            toast.success("Pago registrado correctamente");
            setShowPaymentModal(false);

            // Refresh local state to update UI
            const res = await apiClient.get(`/services/orders/${orderId}`);
            setOrder(res.data);

        } catch (error) {
            console.error(error);
            toast.error("Error vinculando el pago a la orden");
        }
    };

    const handleConfirmDelivery = async () => {
        if (!confirm("¿Confirmar que la orden ha sido entregada al cliente?")) return;
        try {
            await apiClient.patch(`/services/orders/${orderId}/status`, {
                status: 'DELIVERED'
            });
            toast.success("Orden Entregada");
            onClose(); // Close modal or refresh
        } catch (error) {
            toast.error("Error al actualizar estado");
        }
    };

    if (loading || !order) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex overflow-hidden animate-in fade-in zoom-in-95">

                {/* LEFT: STATUS & DETAILS */}
                <div className="w-7/12 p-8 bg-slate-50 flex flex-col overflow-y-auto custom-scrollbar">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="bg-indigo-600 text-white p-2 rounded-lg shadow-indigo-200">
                                    <Package size={24} />
                                </div>
                                <h2 className="font-bold text-2xl text-slate-800">Orden #{order.ticket_number}</h2>
                            </div>
                            <p className="text-slate-500 text-sm ml-12">Creado: {new Date(order.created_at).toLocaleString()}</p>
                        </div>
                        <div className={`px-4 py-1.5 rounded-full text-xs font-bold border ${order.status === 'DELIVERED' ? 'bg-teal-100 text-teal-700 border-teal-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                            {order.status === 'DELIVERED' ? 'ENTREGADO' : 'EN PROCESO'}
                        </div>
                    </div>

                    {/* Customer Card */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 mb-6 flex items-center gap-4">
                        <div className="bg-slate-100 p-3 rounded-full">
                            <User className="text-slate-500" size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">{order.customer?.name}</h3>
                            <p className="text-xs text-slate-500 font-mono">{order.customer?.id_number || 'N/A'} • {order.customer?.phone || 'Sin télefono'}</p>
                        </div>
                    </div>

                    {/* Specs Grid */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                            <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Peso Total</span>
                            <span className="text-2xl font-black text-slate-800">{order.order_metadata?.weight_kg} <span className="text-sm text-slate-400">Kg</span></span>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                            <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Piezas</span>
                            <span className="text-2xl font-black text-slate-800">{order.order_metadata?.pieces}</span>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center relative overflow-hidden">
                            <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Tipo</span>
                            <span className="text-lg font-bold text-indigo-600 truncate px-1" title={order.order_metadata?.wash_type || 'General'}>
                                {order.order_metadata?.wash_type || 'General'}
                            </span>
                        </div>
                    </div>

                    {/* Timeline / Status Pipeline */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h4 className="font-bold text-slate-700 mb-6 flex items-center gap-2">
                            <Activity size={18} className="text-indigo-500" /> Línea de Tiempo
                        </h4>
                        <div className="space-y-4 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                            {STATUS_STEPS.slice(0, 3).map((step, idx) => {
                                // Logic mapping
                                let current = order.status;
                                if (current === 'DIAGNOSING') current = 'RECEIVED';
                                if (current === 'APPROVED') current = 'IN_PROGRESS';

                                const isCurrent = current === step.id;
                                const isPast = STATUS_STEPS.findIndex(s => s.id === current) > idx;
                                const isDone = isCurrent || isPast || order.status === 'DELIVERED';

                                return (
                                    <div key={step.id} className="relative pl-10 flex items-center justify-between group">
                                        <div className={`absolute left-2 w-4 h-4 rounded-full border-2 transition-all ${isDone ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}></div>
                                        <span className={`font-medium text-sm transition-colors ${isDone ? 'text-slate-800' : 'text-slate-400'}`}>{step.label}</span>

                                        {!isCurrent && !isPast && order.status !== 'DELIVERED' && (
                                            <button
                                                onClick={() => handleUpdateStatus(step.id)}
                                                className="opacity-0 group-hover:opacity-100 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 px-3 py-1 rounded-md text-xs font-bold transition-all"
                                            >
                                                Marcar
                                            </button>
                                        )}
                                        {isCurrent && order.status !== 'DELIVERED' && <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">ACTUAL</span>}
                                        {(isPast || order.status === 'DELIVERED') && <CheckCircle size={14} className="text-emerald-500" />}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-8 bg-yellow-50 p-4 rounded-xl border border-yellow-100 text-sm text-slate-700 flex gap-3">
                        <AlertTriangle className="text-yellow-600 shrink-0" size={20} />
                        <div>
                            <p className="font-bold text-yellow-800 mb-1">Observaciones:</p>
                            <p>{order.problem_description || "Sin observaciones."}</p>
                        </div>
                    </div>
                </div>

                {/* RIGHT: BILLING & ACTIONS */}
                <div className="w-5/12 bg-white border-l border-slate-100 flex flex-col relative">
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full transition-colors z-10 text-slate-400 hover:text-rose-500">
                        <X size={24} />
                    </button>

                    <div className="flex-1 flex flex-col p-8 justify-center">
                        {order.status === 'DELIVERED' ? (
                            <div className="text-center space-y-4 animate-in zoom-in">
                                <div className="w-24 h-24 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle size={48} className="text-teal-600" />
                                </div>
                                <h2 className="text-3xl font-black text-slate-800">¡Orden Entregada!</h2>
                                <p className="text-slate-500">El proceso ha finalizado correctamente.</p>
                                <button className="mt-8 text-indigo-600 font-bold hover:underline" onClick={onClose}>Cerrar Ventana</button>
                            </div>
                        ) : (
                            <div className="max-w-sm mx-auto w-full">
                                {/* Bill Card */}
                                <div className="bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden mb-6 relative group transform hover:-translate-y-1 transition-all duration-300">
                                    {/* Receipt Top Pattern */}
                                    <div className={`h-2 w-full mb-4 ${order.order_metadata?.payment_status === 'PAID' ? 'bg-emerald-500' : 'bg-indigo-600'}`}></div>

                                    <div className="px-6 pb-6">
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest text-center mb-6">
                                            {order.order_metadata?.payment_status === 'PAID' ? 'Estado de Cuenta: PAGADO' : 'Detalle de Cobro'}
                                        </h3>

                                        {/* Show simple summary if PAID, else show calculator */}
                                        {order.order_metadata?.payment_status === 'PAID' ? (
                                            <div className="text-center py-4">
                                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                    <CheckCircle size={32} className="text-emerald-600" />
                                                </div>
                                                <p className="text-emerald-700 font-bold text-lg">Orden Pagada</p>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    Fecha: {new Date(order.order_metadata.payment_date).toLocaleDateString()}
                                                </p>
                                                <div className="mt-6 pt-6 border-t border-slate-100">
                                                    <button
                                                        onClick={handleConfirmDelivery}
                                                        className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
                                                    >
                                                        <Package size={18} /> CONFIRMAR ENTREGA
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Service Selector */}
                                                <div className="mb-6">
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Servicio Aplicado</label>
                                                    <select
                                                        className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                                        value={paymentData?.product_id || ''}
                                                        onChange={(e) => {
                                                            const pid = parseInt(e.target.value);
                                                            const prod = serviceProducts.find(p => p.id === pid);
                                                            if (prod) {
                                                                const isPiece = prod.unit_type === 'UNIDAD' || prod.unit_type === 'PIEZA' || prod.name.includes('Planchado') || prod.name.includes('Edredon');
                                                                const unit = isPiece ? 'PIECES' : 'KG';
                                                                const qty = isPiece ? pieces : weight;

                                                                setSelectedUnit(unit);

                                                                setPaymentData(prev => ({
                                                                    ...prev,
                                                                    product_id: prod.id,
                                                                    price_usd: parseFloat(prod.price),
                                                                    description: `${prod.name} (${qty} ${unit === 'KG' ? 'Kg' : 'Pza'})`
                                                                }));
                                                                setPricePerKg(parseFloat(prod.price));
                                                            }
                                                        }}
                                                    >
                                                        <option value="" disabled>Seleccionar Servicio...</option>
                                                        {serviceProducts.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Calc Rows */}
                                                <div className="space-y-3 mb-6 font-mono text-sm">
                                                    <div className="flex justify-between items-center text-slate-500">
                                                        <span>Tarifa Base</span>
                                                        <div className="flex items-center gap-1">
                                                            <span>$</span>
                                                            <input
                                                                type="number"
                                                                className="w-16 text-right bg-transparent border-b border-dashed border-slate-300 focus:border-indigo-500 outline-none"
                                                                value={pricePerKg}
                                                                onChange={e => {
                                                                    setPricePerKg(e.target.value);
                                                                    setPaymentData(prev => ({ ...prev, price_usd: e.target.value }));
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between items-center text-slate-500">
                                                        <span>{selectedUnit === 'KG' ? 'Peso Calculado' : 'Cantidad Piezas'}</span>
                                                        <span className="font-bold">{selectedUnit === 'KG' ? weight : pieces} {selectedUnit === 'KG' ? 'Kg' : 'Pza'}</span>
                                                    </div>
                                                    <div className="h-px bg-slate-100 my-2"></div>
                                                    <div className="flex justify-between items-center text-lg font-black text-slate-800">
                                                        <span>Total a Pagar</span>
                                                        <span className="text-indigo-600">${((selectedUnit === 'KG' ? weight : pieces) * pricePerKg).toFixed(2)}</span>
                                                    </div>
                                                </div>

                                                {/* Action Button */}
                                                <button
                                                    onClick={handlePreparePayment}
                                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 flex items-center justify-center gap-2 transition-all active:bg-indigo-800"
                                                >
                                                    <DollarSign size={20} />
                                                    PROCESAR PAGO
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {order.order_metadata?.payment_status !== 'PAID' && (
                                    <p className="text-center text-xs text-slate-300">
                                        Verifique el peso antes de cobrar.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* MODAL OVERLAYS */}
                {showPaymentModal && (
                    <PaymentModal
                        isOpen={showPaymentModal}
                        totalUSD={Number(paymentData?.quantity) * Number(paymentData?.price_usd)}
                        cart={[{
                            ...paymentData,
                            unit_price: paymentData.price_usd,
                            unit_price_usd: paymentData.price_usd,
                            original_price_usd: paymentData.price_usd,
                            conversion_factor: 1
                        }]}
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
