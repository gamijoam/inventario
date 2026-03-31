import React, { useState, useEffect } from 'react';
import { ChevronLeft, Plus, Download, MoreVertical, Check, AlertCircle } from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import DiagnosisPanel from './components/DiagnosisPanel';
import PaymentTimeline from './components/PaymentTimeline';
import QuickItemForm from './components/QuickItemForm';
import { useServiceOrder, useServiceCalculations } from './hooks/useServiceOrder';
import printerService from '../../services/printerService';
import { useConfig } from '../../context/ConfigContext';

const SERVICE_STATUSES = [
    { id: 'RECEIVED', label: '📥 Recibido', color: 'slate' },
    { id: 'DIAGNOSING', label: '🔍 Diagnóstico', color: 'yellow' },
    { id: 'APPROVED', label: '✓ Aprobado', color: 'blue' },
    { id: 'IN_PROGRESS', label: '🔧 Reparando', color: 'purple' },
    { id: 'READY', label: '✨ Listo', color: 'emerald' },
    { id: 'DELIVERED', label: '📦 Entregado', color: 'teal' },
];

const ServiceOrderDetail = ({ orderId, onClose }) => {
    const { business } = useConfig();
    const paperWidth = business?.paper_width || '80';
    const { order, loading, error, fetchOrder, updateStatus, deleteItem } = useServiceOrder(orderId);
    const calculations = useServiceCalculations(order);
    
    const [showItemForm, setShowItemForm] = useState(false);
    const [actionMenuOpen, setActionMenuOpen] = useState(null);

    useEffect(() => {
        if (orderId) {
            fetchOrder();
        }
    }, [orderId, fetchOrder]);

    const handleStatusChange = async (newStatus) => {
        try {
            await updateStatus(newStatus);
            toast.success(`Estado cambiado a ${SERVICE_STATUSES.find(s => s.id === newStatus)?.label}`);
        } catch (err) {
            toast.error('Error al actualizar estado');
        }
    };

    const handleDeleteItem = async (itemId) => {
        if (window.confirm('¿Eliminar este ítem?')) {
            try {
                await deleteItem(itemId);
                toast.success('Ítem eliminado');
            } catch (err) {
                toast.error('Error al eliminar ítem');
            }
        }
    };

    const handlePrint = async () => {
        try {
            const res = await apiClient.get(`/services/orders/${orderId}/print/thermal?width=${paperWidth}`);
            await printerService.printRaw(res.data);
            toast.success('Ticket enviado a impresora');
        } catch (err) {
            toast.error('Error al imprimir');
        }
    };

    if (loading) {
        return (
            <>
                <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-600">Cargando orden...</p>
                    </div>
                </div>
            </>
        );
    }

    if (error || !order) {
        return (
            <>
                <div className="min-h-screen bg-slate-50 p-6">
                    <div className="max-w-2xl mx-auto">
                        <button
                            onClick={onClose}
                            className="mb-6 flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900"
                        >
                            <ChevronLeft size={20} /> Atrás
                        </button>
                        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-8 text-center">
                            <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
                            <h2 className="text-xl font-bold text-red-900 mb-2">Error</h2>
                            <p className="text-red-700">{error || 'Orden no encontrada'}</p>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <button
                        onClick={onClose}
                        className="mb-6 flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        <ChevronLeft size={20} /> Atrás
                    </button>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        {/* Header de orden */}
                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-8">
                            <div className="flex items-start justify-between mb-6">
                                <div>
                                    <h1 className="text-3xl font-bold font-mono mb-2">{order.ticket_number}</h1>
                                    <p className="text-blue-100">{order.customer?.name}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handlePrint}
                                        className="p-3 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                                        title="Imprimir"
                                    >
                                        <Download size={20} />
                                    </button>
                                    <button
                                        onClick={() => setActionMenuOpen(!actionMenuOpen)}
                                        className="p-3 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                                    >
                                        <MoreVertical size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Quick info */}
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                    <p className="text-blue-100 text-xs">Equipo</p>
                                    <p className="font-semibold">{order.brand} {order.model}</p>
                                </div>
                                <div>
                                    <p className="text-blue-100 text-xs">Recibido</p>
                                    <p className="font-semibold">{new Date(order.created_at).toLocaleDateString()}</p>
                                </div>
                                <div>
                                    <p className="text-blue-100 text-xs">Total</p>
                                    <p className="font-semibold">${calculations.orderTotal.toFixed(2)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Main Content */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-8">
                            {/* LEFT: Detalles Orden */}
                            <div className="lg:col-span-2 space-y-8">
                                {/* Status Stepper */}
                                <div>
                                    <h3 className="font-bold text-slate-900 mb-4">Estado del Servicio</h3>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {SERVICE_STATUSES.map((status, idx) => (
                                            <div key={status.id} className="flex items-center">
                                                <button
                                                    onClick={() => handleStatusChange(status.id)}
                                                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                                                        order.status === status.id
                                                            ? `bg-${status.color}-600 text-white shadow-lg`
                                                            : `bg-${status.color}-100 text-${status.color}-700 hover:bg-${status.color}-200`
                                                    }`}
                                                >
                                                    {status.label}
                                                </button>
                                                {idx < SERVICE_STATUSES.length - 1 && (
                                                    <div className={`w-6 h-0.5 mx-1 ${order.status !== SERVICE_STATUSES[idx + 1].id ? 'bg-slate-300' : 'bg-emerald-500'}`} />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Items */}
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold text-slate-900">Repuestos y Servicios</h3>
                                        <button
                                            onClick={() => setShowItemForm(true)}
                                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                                        >
                                            <Plus size={18} /> Agregar
                                        </button>
                                    </div>

                                    {order.details && order.details.length > 0 ? (
                                        <div className="space-y-2">
                                            {order.details.map((item, idx) => (
                                                <div key={item.id || idx} className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between hover:bg-slate-100 transition-colors">
                                                    <div className="flex-1">
                                                        <p className="font-semibold text-slate-900">{item.description || item.product_id}</p>
                                                        <p className="text-sm text-slate-600">Cantidad: {item.quantity}</p>
                                                    </div>
                                                    <div className="text-right mr-4">
                                                        <p className="font-bold text-slate-900">${(Number(item.unit_price) * Number(item.quantity)).toFixed(2)}</p>
                                                        <p className="text-xs text-slate-600">${Number(item.unit_price).toFixed(2)} c/u</p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDeleteItem(item.id)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                                            <p className="text-slate-500">Sin items. Haz click en "+ Agregar"</p>
                                        </div>
                                    )}

                                    {/* Totales */}
                                    <div className="mt-6 bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-lg p-6">
                                        <div className="grid grid-cols-3 gap-4 text-center">
                                            <div>
                                                <p className="text-slate-600 text-sm">Subtotal</p>
                                                <p className="text-2xl font-bold text-slate-900">${calculations.orderTotal.toFixed(2)}</p>
                                            </div>
                                            <div className="border-l border-r border-slate-300">
                                                <p className="text-slate-600 text-sm">Pagado</p>
                                                <p className="text-2xl font-bold text-emerald-600">${calculations.orderPaid.toFixed(2)}</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-600 text-sm">Pendiente</p>
                                                <p className="text-2xl font-bold text-amber-600">${calculations.orderPending.toFixed(2)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT: Sidebar */}
                            <div className="space-y-8">
                                {/* Diagnosis Panel */}
                                <DiagnosisPanel
                                    orderId={orderId}
                                    initialDiagnosis={order.problem_description}
                                    onSave={(diagnosis) => {
                                        toast.success('Diagnóstico guardado');
                                    }}
                                />

                                {/* Payment Timeline */}
                                <PaymentTimeline
                                    order={order}
                                    calculations={calculations}
                                    onAddPayment={() => {
                                        toast.info('Abrir formulario de pago');
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modales */}
            {showItemForm && (
                <QuickItemForm
                    orderId={orderId}
                    onClose={() => setShowItemForm(false)}
                    onSuccess={() => {
                        setShowItemForm(false);
                        fetchOrder();
                        toast.success('Ítem agregado');
                    }}
                />
            )}
        </>
    );
};

export default ServiceOrderDetail;
