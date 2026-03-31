import React from 'react';
import { ChevronRight, Printer, MoreVertical } from 'lucide-react';
import { formatCurrency } from '../../../utils/currency';

const STATUS_COLORS = {
    RECEIVED: 'bg-slate-100 text-slate-700',
    DIAGNOSING: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-blue-100 text-blue-800',
    IN_PROGRESS: 'bg-purple-100 text-purple-800',
    READY: 'bg-emerald-100 text-emerald-800',
    DELIVERED: 'bg-teal-100 text-teal-800',
    CANCELLED: 'bg-red-100 text-red-800',
};

const STATUS_LABELS = {
    RECEIVED: 'Recibido',
    DIAGNOSING: 'Diagnóstico',
    APPROVED: 'Aprobado',
    IN_PROGRESS: 'Reparando',
    READY: 'Listo',
    DELIVERED: 'Entregado',
    CANCELLED: 'Anulado',
};

const ServiceCard = ({ order, onOpen, onPrint, onMenuClick }) => {
    // Calcular totales
    const orderTotal = order.details?.reduce((acc, d) => acc + Number(d.quantity) * Number(d.unit_price), 0) || 0;
    const orderPaid = order.payments?.reduce((acc, p) => acc + parseFloat(p.amount), 0) || 0;
    const orderPending = Math.max(0, orderTotal - orderPaid);
    
    // Determinar estado de pago
    let paymentStatus = 'unpaid';
    if (order.order_metadata?.payment_status === 'PAID' || (orderPaid >= orderTotal && orderTotal > 0)) {
        paymentStatus = 'paid';
    } else if (orderPaid > 0) {
        paymentStatus = 'partial';
    }

    const paymentPercentage = orderTotal > 0 ? (orderPaid / orderTotal) * 100 : 0;

    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all overflow-hidden group">
            {/* Header con ticket */}
            <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-slate-800 font-mono">{order.ticket_number}</h3>
                        <p className="text-sm text-slate-600 mt-1">
                            {order.brand} {order.model}
                        </p>
                    </div>
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${STATUS_COLORS[order.status]}`}>
                        {STATUS_LABELS[order.status]}
                    </span>
                </div>
            </div>

            {/* Main content */}
            <div className="p-4 space-y-3">
                {/* Cliente */}
                <div className="flex items-center gap-2">
                    <span className="text-lg">👤</span>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{order.customer?.name || 'Sin cliente'}</p>
                        <p className="text-xs text-slate-500 truncate">{order.customer?.phone || 'Sin teléfono'}</p>
                    </div>
                </div>

                {/* Falla reportada */}
                {order.problem_description && (
                    <div className="flex items-start gap-2">
                        <span className="text-lg flex-shrink-0">⚠️</span>
                        <p className="text-sm text-slate-700 line-clamp-2">{order.problem_description}</p>
                    </div>
                )}

                {/* Estado de trabajo - Mini stepper */}
                <div className="flex items-center gap-1 text-xs font-semibold text-slate-600 flex-wrap">
                    <span className="text-slate-400">●</span>
                    <span>Recibido</span>
                    {['DIAGNOSING', 'APPROVED', 'IN_PROGRESS', 'READY', 'DELIVERED'].includes(order.status) && (
                        <>
                            <span className="text-slate-400">›</span>
                            <span className={order.status === 'DIAGNOSING' ? 'text-amber-600 font-bold' : 'text-slate-600'}>
                                {order.status === 'DIAGNOSING' ? '◆' : '○'} Diagnóstico
                            </span>
                        </>
                    )}
                    {['APPROVED', 'IN_PROGRESS', 'READY', 'DELIVERED'].includes(order.status) && (
                        <>
                            <span className="text-slate-400">›</span>
                            <span className={order.status === 'IN_PROGRESS' ? 'text-purple-600 font-bold' : 'text-slate-600'}>
                                {order.status === 'IN_PROGRESS' ? '◆' : '○'} Reparando
                            </span>
                        </>
                    )}
                    {['READY', 'DELIVERED'].includes(order.status) && (
                        <>
                            <span className="text-slate-400">›</span>
                            <span className={order.status === 'READY' ? 'text-emerald-600 font-bold' : 'text-slate-600'}>
                                {order.status === 'READY' ? '◆' : '○'} Listo
                            </span>
                        </>
                    )}
                </div>

                {/* Pago - Barra de progreso */}
                {orderTotal > 0 && (
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-700">
                                💰 {paymentStatus === 'paid' ? '✓ Pagado' : `$${orderPaid.toFixed(2)} de $${orderTotal.toFixed(2)}`}
                            </span>
                            <span className="text-slate-500">{Math.round(paymentPercentage)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                            <div
                                className={`h-2 rounded-full transition-all ${
                                    paymentStatus === 'paid'
                                        ? 'bg-emerald-500'
                                        : paymentStatus === 'partial'
                                            ? 'bg-amber-400'
                                            : 'bg-slate-300'
                                }`}
                                style={{ width: `${Math.min(100, paymentPercentage)}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Meta info */}
                <p className="text-xs text-slate-400">
                    {order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}
                </p>
            </div>

            {/* Footer con botones */}
            <div className="p-3 border-t border-slate-100 bg-slate-50 flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                {onPrint && (
                    <button
                        onClick={() => onPrint(order.id)}
                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Imprimir"
                    >
                        <Printer size={16} />
                    </button>
                )}

                {onMenuClick && (
                    <button
                        onClick={() => onMenuClick(order.id)}
                        className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                        title="Más opciones"
                    >
                        <MoreVertical size={16} />
                    </button>
                )}

                {onOpen && (
                    <button
                        onClick={() => onOpen(order.id)}
                        className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                    >
                        Ver <ChevronRight size={14} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default ServiceCard;
