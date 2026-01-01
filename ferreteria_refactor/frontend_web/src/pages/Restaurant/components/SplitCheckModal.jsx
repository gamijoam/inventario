import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Split, DollarSign } from 'lucide-react';
import restaurantService from '../../../services/restaurantService';
import toast from 'react-hot-toast';

const SplitCheckModal = ({ isOpen, onClose, order, onSplitSuccess }) => {
    // Map item_id -> quantity_to_split
    const [splitQuantities, setSplitQuantities] = useState({});

    // Derived state for preview
    const [newTotal, setNewTotal] = useState(0);

    useEffect(() => {
        if (isOpen) {
            setSplitQuantities({});
            setNewTotal(0);
        }
    }, [isOpen]);

    const handleQuantityChange = (item, delta) => {
        const currentSplit = splitQuantities[item.id] || 0;
        const max = parseFloat(item.quantity);

        let next = currentSplit + delta;
        if (next < 0) next = 0;
        if (next > max) next = max;

        const newMap = { ...splitQuantities, [item.id]: next };
        if (next === 0) delete newMap[item.id];

        setSplitQuantities(newMap);
        calculateTotal(newMap);
    };

    const calculateTotal = (map) => {
        let total = 0;
        order.items.forEach(item => {
            const qty = map[item.id] || 0;
            total += qty * parseFloat(item.unit_price);
        });
        setNewTotal(total);
    };

    const handleExecuteSplit = async () => {
        const itemsToSplit = Object.entries(splitQuantities).map(([itemId, qty]) => ({
            item_id: parseInt(itemId),
            quantity: qty
        }));

        if (itemsToSplit.length === 0) {
            toast.error("Selecciona al menos un artículo para separar");
            return;
        }

        if (!confirm(`¿Crear una nueva cuenta por $${newTotal.toFixed(2)}?`)) return;

        try {
            const res = await restaurantService.splitOrder(order.id, itemsToSplit);
            toast.success("Cuenta dividida correctamente");
            onSplitSuccess(res.new_order_id);
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Error al dividir cuenta");
        }
    };

    if (!isOpen || !order) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Split className="text-orange-600" /> Dividir Cuenta - Mesa {order.table_id}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full"><X size={20} /></button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x">

                    {/* Left: Original Items */}
                    <div className="flex-1 p-4 overflow-y-auto bg-white">
                        <h4 className="font-bold text-gray-500 uppercase text-xs mb-3">Cuenta Original</h4>
                        <div className="space-y-2">
                            {order.items.map(item => {
                                const splitQty = splitQuantities[item.id] || 0;
                                const originalQty = parseFloat(item.quantity);
                                const isFullyMoved = splitQty === originalQty;

                                return (
                                    <div key={item.id} className={`flex justify-between items-center p-3 border rounded-lg ${isFullyMoved ? 'bg-gray-50 opacity-60' : 'bg-white'}`}>
                                        <div className="flex-1">
                                            <div className="font-bold text-gray-800">{item.product_name}</div>
                                            <div className="text-xs text-gray-500">${item.unit_price} c/u</div>
                                        </div>

                                        <div className="flex items-center gap-3 bg-gray-100 rounded-lg p-1">
                                            <button
                                                onClick={() => handleQuantityChange(item, -1)}
                                                className="w-8 h-8 flex items-center justify-center bg-white rounded shadow text-gray-600 hover:text-blue-600 font-bold"
                                                disabled={splitQty === 0}
                                            > - </button>

                                            <div className="flex flex-col items-center w-12">
                                                <span className="text-xs text-gray-400">Separar</span>
                                                <span className="font-bold text-blue-600 text-lg">{splitQty}</span>
                                                <span className="text-[10px] text-gray-400">de {originalQty}</span>
                                            </div>

                                            <button
                                                onClick={() => handleQuantityChange(item, +1)}
                                                className="w-8 h-8 flex items-center justify-center bg-white rounded shadow text-gray-600 hover:text-blue-600 font-bold"
                                                disabled={splitQty >= originalQty}
                                            > + </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right: New Check Preview */}
                    <div className="w-full md:w-1/3 bg-gray-50 p-4 flex flex-col">
                        <h4 className="font-bold text-gray-500 uppercase text-xs mb-3">Nueva Cuenta (Vista Previa)</h4>

                        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                            {Object.keys(splitQuantities).length === 0 ? (
                                <div className="text-center py-10 text-gray-400 italic">
                                    Selecciona items de la izquierda para separar
                                </div>
                            ) : (
                                order.items.map(item => {
                                    const qty = splitQuantities[item.id];
                                    if (!qty) return null;
                                    return (
                                        <div key={item.id} className="flex justify-between text-sm">
                                            <span className="text-gray-700">{qty} x {item.product_name}</span>
                                            <span className="font-bold text-gray-900">${(qty * parseFloat(item.unit_price)).toFixed(2)}</span>
                                        </div>
                                    )
                                })
                            )}
                        </div>

                        <div className="border-t pt-4 mt-auto">
                            <div className="flex justify-between text-lg font-bold mb-4">
                                <span>Total a Pagar:</span>
                                <span className="text-green-600">${newTotal.toFixed(2)}</span>
                            </div>

                            <button
                                onClick={handleExecuteSplit}
                                disabled={newTotal === 0}
                                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                            >
                                <DollarSign size={20} /> Cobrar Nueva Cuenta
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SplitCheckModal;
