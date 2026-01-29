import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from '../../../config/axios';
import { Shirt } from 'lucide-react';

const LaundryTicket = () => {
    const { orderId } = useParams();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOrder = async () => {
            try {
                const res = await apiClient.get(`/services/orders/${orderId}`);
                setOrder(res.data);
                // Auto-print after loading
                setTimeout(() => window.print(), 500);
            } catch (error) {
                console.error("Error loading order for print:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchOrder();
    }, [orderId]);

    if (loading) return <div className="p-4 text-center font-mono text-sm">Cargando ticket...</div>;
    if (!order) return <div className="p-4 text-center font-mono text-sm text-red-600">Orden no encontrada</div>;

    const totalAmount = order.details?.reduce((acc, item) => acc + (Number(item.quantity) * Number(item.unit_price)), 0) || 0;
    const remaining = totalAmount; // Assuming no partial payments yet for simplicity, or fetch payments

    return (
        <div className="w-[80mm] p-2 font-mono text-[12px] leading-tight text-black bg-white mx-auto print:mx-0 print:w-full">
            {/* Header */}
            <div className="text-center mb-4 border-b border-black pb-2">
                <h1 className="font-bold text-lg uppercase mb-1">Ferretería & Lavandería</h1>
                <p className="text-[10px]">J-12345678-9</p>
                <p className="text-[10px]">Calle Principal #123, Ciudad</p>
                <p className="text-[10px]">Tel: (0414) 123-4567</p>
            </div>

            {/* Ticket Info */}
            <div className="mb-4">
                <div className="flex justify-between font-bold text-sm mb-1">
                    <span>TICKET:</span>
                    <span>#{order.ticket_number}</span>
                </div>
                <div className="flex justify-between">
                    <span>Fecha:</span>
                    <span>{new Date(order.created_at).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                    <span>Cliente:</span>
                    <span className="truncate max-w-[150px]">{order.customer?.name}</span>
                </div>
                {order.customer?.phone && (
                    <div className="flex justify-between">
                        <span>Tel:</span>
                        <span>{order.customer.phone}</span>
                    </div>
                )}
            </div>

            {/* Order Details */}
            <div className="mb-4 border-y border-black border-dashed py-2">
                <div className="flex font-bold border-b border-black border-dashed pb-1 mb-1">
                    <span className="w-8 text-center">Cant</span>
                    <span className="flex-1">Desc</span>
                    <span className="w-12 text-right">Total</span>
                </div>
                {order.details?.map((item, idx) => (
                    <div key={idx} className="flex mb-1">
                        <span className="w-8 text-center align-top">{item.quantity}</span>
                        <span className="flex-1 align-top leading-none">
                            {item.description}
                            {item.is_manual && '*'}
                        </span>
                        <span className="w-12 text-right align-top">
                            {Number(Number(item.quantity) * Number(item.unit_price)).toFixed(2)}
                        </span>
                    </div>
                ))}
            </div>

            {/* Totals */}
            <div className="mb-6 flex flex-col items-end">
                <div className="text-base font-bold flex gap-4">
                    <span>TOTAL:</span>
                    <span>${totalAmount.toFixed(2)}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                    (Monto estimado)
                </div>
            </div>

            {/* Metadata / Instructions */}
            <div className="mb-6 border border-black p-2 rounded">
                <div className="flex justify-between text-xs font-bold mb-1">
                    <span>PIEZAS: {order.order_metadata?.pieces || 0}</span>
                    <span>BOLSA: {order.order_metadata?.bag_color || '---'}</span>
                </div>
                {order.priority === 'URGENT' && (
                    <div className="text-center font-bold text-sm uppercase my-1">
                        *** URGENTE ***
                    </div>
                )}
                {order.diagnosis_notes && (
                    <p className="text-[10px] mt-2 italic">
                        Nota: {order.diagnosis_notes}
                    </p>
                )}
            </div>

            {/* Footer */}
            <div className="text-center text-[10px] mb-8">
                <p>¡Gracias por su preferencia!</p>
                <p>Conserve este ticket para retirar.</p>
                <p className="mt-2 text-[8px] text-gray-400">Sistema Lavendería v1.0</p>
            </div>

            {/* Cut Line */}
            <div className="border-b border-dashed border-gray-400 w-full mb-4 print:hidden text-center text-[10px] text-gray-400 pt-2">
                --- Corte Aquí ---
            </div>
        </div>
    );
};

export default LaundryTicket;
