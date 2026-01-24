import React, { useState, useEffect } from 'react';
import { Package, DollarSign, Calculator, Check, AlertTriangle } from 'lucide-react';
import apiClient from '../../../config/axios';
import { formatCurrency } from '../../../utils/currency';
import { toast } from 'react-hot-toast';

const ServiceDeliveryModal = ({ order, onClose, onDeliver, onPaymentRequest }) => {
    const isLaundry = order.service_type === 'LAUNDRY';

    // State
    const [weight, setWeight] = useState(order.order_metadata?.weight || 0);
    const [pricePerKg, setPricePerKg] = useState(2.00); // Default, should load from config
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [products, setProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);

    // Initial load: Search for "Lavado" product to set default price
    useEffect(() => {
        const fetchDefaultProduct = async () => {
            try {
                // Try to find a default laundry service product
                const res = await apiClient.get('/products/?search=Lavado');
                if (res.data && res.data.length > 0) {
                    const defaultProd = res.data[0];
                    setSelectedProduct(defaultProd);
                    setPricePerKg(defaultProd.price);
                }
            } catch (error) {
                console.error("Error loading default product", error);
            }
        };
        if (isLaundry) fetchDefaultProduct();
    }, [isLaundry]);

    // Product Search for Override
    useEffect(() => {
        if (searchTerm.length > 2) {
            const timeoutId = setTimeout(async () => {
                const res = await apiClient.get(`/products/?search=${searchTerm}`);
                setProducts(res.data);
            }, 500);
            return () => clearTimeout(timeoutId);
        }
    }, [searchTerm]);

    const calculateTotal = () => {
        if (!isLaundry) return 0; // Standard repair handles total differently (via items list)
        return weight * pricePerKg;
    };

    const isPaid = order.order_metadata?.payment_status === 'PAID';

    // Logic: Treat as "Non-Laundry" (Standard Delivery) IF it is already paid
    // This allows the user to just confirm delivery without re-calc
    const showPaymentUI = isLaundry && !isPaid;

    const handleConfirm = () => {
        if (showPaymentUI) {
            if (!selectedProduct) {
                toast.error("Seleccione un producto de referencia (tarifa)");
                return;
            }
            // Trigger Payment Flow with calculated item
            onPaymentRequest({
                product_id: selectedProduct.id,
                description: `Servicio Lavado (${weight} Kg) - ${order.order_metadata?.washing_type}`,
                quantity: parseFloat(weight),
                unit_price: parseFloat(pricePerKg),
                is_manual: false
            });
        } else {
            // Standard Delivery (Change status)
            onDeliver();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
                <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2">
                        <Package size={20} /> Entregar Servicio
                    </h3>
                    <button onClick={onClose} className="hover:bg-blue-700 p-1 rounded-full">✕</button>
                </div>

                <div className="p-6 space-y-6">
                    {showPaymentUI ? (
                        <>
                            <div className="text-center">
                                <h4 className="text-gray-500 text-sm mb-1 uppercase tracking-wide"> Resumen de Lavandería</h4>
                                <div className="text-3xl font-bold text-gray-800">{order.ticket_number}</div>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Peso Final (Kg)</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={weight}
                                            onChange={(e) => setWeight(parseFloat(e.target.value))}
                                            className="w-full text-2xl font-mono text-center p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                        <span className="text-gray-400 font-bold">KG</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tarifa Aplicada</label>
                                    <div className="relative">
                                        <input
                                            value={selectedProduct ? selectedProduct.name : searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value);
                                                setSelectedProduct(null); // Reset selection on type
                                            }}
                                            placeholder="Buscar tarifa..."
                                            className="w-full p-2 border rounded-lg text-sm"
                                        />
                                        {products.length > 0 && !selectedProduct && (
                                            <div className="absolute top-full left-0 right-0 bg-white border shadow-lg rounded-lg mt-1 z-10 max-h-40 overflow-y-auto">
                                                {products.map(p => (
                                                    <div
                                                        key={p.id}
                                                        onClick={() => {
                                                            setSelectedProduct(p);
                                                            setPricePerKg(p.price);
                                                            setProducts([]);
                                                        }}
                                                        className="p-2 hover:bg-blue-50 cursor-pointer text-sm flex justify-between"
                                                    >
                                                        <span>{p.name}</span>
                                                        <span className="font-bold">${p.price}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex justify-end mt-1 text-xs text-blue-600 font-bold">
                                        Precio unitario: ${pricePerKg.toFixed(2)} / Kg
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between items-center border-t pt-4">
                                <span className="text-gray-500 font-medium">Total a Pagar</span>
                                <span className="text-3xl font-bold text-green-600">{formatCurrency(calculateTotal())}</span>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-6">
                            <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
                            <h3 className="text-xl font-bold text-gray-800 mb-2">Confirmar Entrega</h3>
                            <p className="text-gray-500">¿Desea marcar esta orden como ENTREGADA?</p>
                            {isPaid ? (
                                <p className="text-sm text-emerald-600 mt-4 bg-emerald-50 p-2 rounded-lg font-bold border border-emerald-100">
                                    <CheckCircle size={14} className="inline mr-1" />
                                    Esta orden ya ha sido PAGADA.
                                </p>
                            ) : (
                                <p className="text-sm text-yellow-600 mt-4 bg-yellow-50 p-2 rounded-lg">
                                    <AlertTriangle size={14} className="inline mr-1" />
                                    Asegúrese de haber recibido el pago correspondiente.
                                </p>
                            )}
                        </div>
                    )}

                    <button
                        onClick={handleConfirm}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl text-lg shadow-lg shadow-blue-200 transition-all active:scale-95 flex justify-center items-center gap-2"
                    >
                        {showPaymentUI ? (
                            <>
                                <DollarSign size={20} /> Proceder al Pago
                            </>
                        ) : 'Confirmar Entrega'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ServiceDeliveryModal;
