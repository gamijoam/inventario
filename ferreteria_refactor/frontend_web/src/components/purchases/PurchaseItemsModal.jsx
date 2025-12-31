import { useState, useEffect } from 'react';
import { X, Package, DollarSign } from 'lucide-react';
import apiClient from '../../config/axios';

const PurchaseItemsModal = ({ isOpen, onClose, purchaseId }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen && purchaseId) {
            fetchItems();
        } else {
            setItems([]); // Clear on close
        }
    }, [isOpen, purchaseId]);

    const fetchItems = async () => {
        setLoading(true);
        setError(null);
        try {
            // Assuming endpoint exists or purchase object has items. 
            // Usually detail endpoint has items. Let's try getting purchase details which naturally should have items.
            // If backend follows standard REST, GET /purchases/{id} returns full object.
            const response = await apiClient.get(`/purchases/${purchaseId}`);
            if (response.data && response.data.items) {
                setItems(response.data.items);
            } else {
                // Fallback attempt if items are in a separate sub-resource (unlikely but safe)
                // Or maybe the main object doesn't have it.
                // Let's assume response.data.items based on standard practices.
                // If empty, set empty.
                setItems([]);
                if (!response.data.items) {
                    console.warn("Purchase response did not contain 'items' array:", response.data);
                }
            }
        } catch (err) {
            console.error("Error fetching purchase items:", err);
            setError("No se pudieron cargar los productos de esta compra.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b bg-gray-50 rounded-t-xl">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Package className="text-blue-600" size={24} />
                            Detalle de Productos
                        </h3>
                        <p className="text-sm text-gray-500">
                            Compra #{purchaseId}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-0 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-48">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                            <p className="text-gray-500 mt-3">Cargando productos...</p>
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center h-48 text-red-500">
                            <p>{error}</p>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="flex items-center justify-center h-48 text-gray-500">
                            <p>No hay productos registrados en esta compra.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 sticky top-0 shadow-sm z-10">
                                <tr>
                                    <th className="p-4 font-semibold text-gray-600 border-b">Producto</th>
                                    <th className="p-4 font-semibold text-gray-600 border-b text-center">Cant.</th>
                                    <th className="p-4 font-semibold text-gray-600 border-b text-right">Costo Unit.</th>
                                    <th className="p-4 font-semibold text-gray-600 border-b text-right">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {items.map((item, index) => (
                                    <tr key={item.id || index} className="hover:bg-blue-50/50 transition-colors">
                                        <td className="p-4">
                                            <div className="font-medium text-gray-800">
                                                {item.product?.name || `Producto #${item.product_id}`}
                                            </div>
                                            {item.product?.sku && (
                                                <div className="text-xs text-gray-500">SKU: {item.product.sku}</div>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="bg-gray-100 text-gray-700 py-1 px-3 rounded-full text-sm font-bold">
                                                {item.quantity}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right font-mono text-gray-600">
                                            ${Number(item.unit_cost).toFixed(2)}
                                        </td>
                                        <td className="p-4 text-right font-bold text-gray-800 font-mono">
                                            ${(Number(item.quantity) * Number(item.unit_cost)).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-50 border-t">
                                <tr>
                                    <td colSpan="3" className="p-4 text-right font-bold text-gray-600">Total Productos:</td>
                                    <td className="p-4 text-right font-bold text-blue-600 text-lg">
                                        ${items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_cost)), 0).toFixed(2)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition font-medium"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PurchaseItemsModal;
