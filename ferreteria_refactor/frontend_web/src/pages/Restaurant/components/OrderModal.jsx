import React, { useState, useEffect } from 'react';
import { X, Search, Plus, ChefHat, Settings, ArrowRight, Split } from 'lucide-react';
import restaurantService from '../../../services/restaurantService';
import axiosInstance from '../../../config/axios';
import PaymentModal from '../../../components/pos/PaymentModal';
import MoveTableModal from './MoveTableModal';
import SplitCheckModal from './SplitCheckModal';
import toast from 'react-hot-toast';

const OrderModal = ({ table, onClose, onUpdate }) => {
    const [order, setOrder] = useState(null);
    const [loadingOrder, setLoadingOrder] = useState(false);

    // Product Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

    // Payment State
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    // Modals State
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [showSplitModal, setShowSplitModal] = useState(false);
    const [showOptions, setShowOptions] = useState(false);

    // Selection State
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [quantity, setQuantity] = useState(1);
    const [notes, setNotes] = useState('');

    // Menu State
    const [menuSections, setMenuSections] = useState([]);
    const [activeSectionId, setActiveSectionId] = useState(null);
    const [menuLoading, setMenuLoading] = useState(false);

    // Load order if occupied
    useEffect(() => {
        if (table.status === 'OCCUPIED') {
            loadCurrentOrder();
        }
    }, [table]);

    const loadCurrentOrder = async () => {
        setLoadingOrder(true);
        try {
            const data = await restaurantService.getCurrentOrder(table.id);
            setOrder(data);
        } catch (error) {
            console.error("Error loading order:", error);
        } finally {
            setLoadingOrder(false);
        }
    };

    const loadMenu = async () => {
        setMenuLoading(true);
        try {
            const data = await restaurantService.getMenuFull();
            if (data.sections && data.sections.length > 0) {
                setMenuSections(data.sections);
                setActiveSectionId(data.sections[0].id);
            }
        } catch (error) {
            console.error("Error loading menu:", error);
        } finally {
            setMenuLoading(false);
        }
    };

    useEffect(() => {
        loadMenu();
    }, []);

    const handleOpenTable = async () => {
        try {
            await restaurantService.openTable(table.id);
            onUpdate(); // Refresh parent map
            // Reload local state to show search interface immediately
            const data = await restaurantService.getCurrentOrder(table.id);
            setOrder(data);
            // Manually update local table prop for UI consistency if parent takes time
            table.status = 'OCCUPIED';
        } catch (error) {
            alert("Error al abrir la mesa: " + error.message);
        }
    };

    // Search Products
    useEffect(() => {
        if (searchTerm.length < 3) {
            setSearchResults([]);
            return;
        }
        const delayDebounce = setTimeout(async () => {
            setSearching(true);
            try {
                const response = await axiosInstance.get('/products/', { params: { search: searchTerm, limit: 5 } });
                setSearchResults(response.data.data || response.data); // Adjust based on API structure
            } catch (err) {
                console.error(err);
            } finally {
                setSearching(false);
            }
        }, 500);

        return () => clearTimeout(delayDebounce);
    }, [searchTerm]);

    const handleAddItem = async () => {
        if (!selectedProduct || !order) return;

        try {
            await restaurantService.addItemsToOrder(order.id, [{
                product_id: selectedProduct.id,
                quantity: quantity,
                notes: notes
            }]);

            // Reset selection and reload order
            setSelectedProduct(null);
            setQuantity(1);
            setNotes('');
            setSearchTerm('');
            loadCurrentOrder();
            onUpdate(); // Optional: to update total in map if displayed
        } catch (error) {
            alert("Error agregando producto: " + error.message);
        }
    };

    const handleCheckout = async (paymentPayload) => {
        try {
            // Transform payload if necessary to match what backend expects for "RestaurantCheckout" schema
            // frontend PaymentModal sends { payments: [...], total_amount: ..., client_id: ... }
            const checkoutData = {
                payment_method: paymentPayload.payment_method || "Efectivo", // Main method or fallback
                currency: paymentPayload.currency || "USD",
                client_id: paymentPayload.client_id || paymentPayload.customer_id || null, // Handle key variations
                payments: paymentPayload.payments.map(p => ({
                    amount: parseFloat(p.amount),
                    currency: p.currency === "$" ? "USD" : p.currency,
                    payment_method: p.payment_method,
                    exchange_rate: parseFloat(p.exchange_rate || 1)
                }))
            };

            const response = await restaurantService.checkoutOrder(order.id, checkoutData);

            toast.success("Mesa cobrada y cerrada exitosamente");
            setShowPaymentModal(false);
            onClose(); // Close Order Modal
            onUpdate(); // Refresh Table Map
            return response;
        } catch (error) {
            console.error("Checkout error:", error);
            toast.error(error.response?.data?.detail || "Error al procesar el cobro");
            throw error; // Re-throw to let PaymentModal know it failed
        }
    };

    const handleSplitSuccess = async (newOrderId) => {
        try {
            const newOrder = await restaurantService.getOrder(newOrderId);
            setOrder(newOrder); // Switch context to new order
            setShowSplitModal(false);
            setShowPaymentModal(true); // Open payment immediately
            toast("Sub-cuenta lista para cobrar");
        } catch (error) {
            toast.error("Error cargando la nueva cuenta");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">{table.name}</h2>
                        <p className="text-sm text-gray-500">{table.zone}</p>
                    </div>

                    <div className="flex gap-2">
                        {/* Toggle Options */}
                        {table.status === 'OCCUPIED' && order && (
                            <div className="relative">
                                <button
                                    onClick={() => setShowOptions(!showOptions)}
                                    className={`p-2 rounded-full transition ${showOptions ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-200 text-gray-600'}`}
                                >
                                    <Settings size={20} />
                                </button>

                                {showOptions && (
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                        <button
                                            onClick={() => { setShowOptions(false); setShowMoveModal(true); }}
                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-2 text-sm font-medium text-gray-700"
                                        >
                                            <ArrowRight size={16} /> Mover Mesa
                                        </button>
                                        <button
                                            onClick={() => { setShowOptions(false); setShowSplitModal(true); }}
                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-2 text-sm font-medium text-gray-700"
                                        >
                                            <Split size={16} /> Dividir Cuenta
                                        </button>
                                    </div>
                                )}
                                {/* Backdrop for menu */}
                                {showOptions && <div className="fixed inset-0 z-40" onClick={() => setShowOptions(false)}></div>}
                            </div>
                        )}

                        <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">

                    {/* STATE: FREE -> OPEN TABLE */}
                    {table.status === 'AVAILABLE' && (
                        <div className="flex flex-col items-center justify-center h-64 space-y-4">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center shadow-inner">
                                <ChefHat size={40} className="text-green-600" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-700">La mesa está disponible</h3>
                            <button
                                onClick={handleOpenTable}
                                className="px-8 py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 transition transform hover:scale-105"
                            >
                                Abrir Mesa
                            </button>
                        </div>
                    )}

                    {/* STATE: OCCUPIED -> MANAGE ORDER */}
                    {(table.status === 'OCCUPIED' || order) && (
                        <>
                            {/* Menu & Search Area */}
                            <div className="space-y-4">
                                {/* Search Bar */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Buscar producto por nombre..."
                                        className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
                                        value={searchTerm}
                                        onChange={e => { setSearchTerm(e.target.value); if (e.target.value) setActiveSectionId(null); }}
                                    />
                                    {searching && <div className="absolute right-3 top-3 animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>}
                                </div>

                                {/* SEARCH RESULTS vs MENU GRID */}
                                {searchTerm.length > 0 ? (
                                    /* Search Results */
                                    <div className="border rounded-xl shadow-sm bg-white overflow-hidden divide-y max-h-60 overflow-y-auto">
                                        {searchResults.map(prod => (
                                            <button
                                                key={prod.id}
                                                onClick={() => { setSelectedProduct(prod); setSearchTerm(''); setSearchResults([]); }}
                                                className="w-full px-4 py-3 text-left hover:bg-blue-50 flex justify-between items-center group"
                                            >
                                                <span className="font-medium text-gray-700 group-hover:text-blue-700">{prod.name}</span>
                                                <span className="font-bold text-gray-900">${prod.price}</span>
                                            </button>
                                        ))}
                                        {searchResults.length === 0 && !searching && (
                                            <div className="p-4 text-center text-gray-500 italic">No se encontraron productos</div>
                                        )}
                                    </div>
                                ) : (
                                    /* VISUAL MENU */
                                    <div className="flex flex-col h-[400px]">
                                        {/* Categories (Tabs) */}
                                        <div className="flex gap-2 overflow-x-auto pb-2 mb-2 custom-scrollbar">
                                            {menuSections.map(section => (
                                                <button
                                                    key={section.id}
                                                    onClick={() => setActiveSectionId(section.id)}
                                                    className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeSectionId === section.id
                                                        ? 'bg-blue-600 text-white shadow-md'
                                                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                                                        }`}
                                                >
                                                    {section.name}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Items Grid */}
                                        <div className="flex-1 overflow-y-auto bg-gray-50 rounded-xl p-3 border border-gray-200">
                                            {activeSectionId ? (
                                                <div className="grid grid-cols-3 gap-3">
                                                    {menuSections.find(s => s.id === activeSectionId)?.items.map(item => (
                                                        <button
                                                            key={item.id}
                                                            onClick={() => setSelectedProduct({
                                                                id: item.product_id,
                                                                name: item.alias || item.product_name,
                                                                price: item.price // Use override or product price
                                                            })}
                                                            className="flex flex-col justify-between p-3 bg-white rounded-lg border shadow-sm hover:border-blue-500 hover:shadow-md transition text-left h-24"
                                                        >
                                                            <span className="font-bold text-sm text-gray-800 line-clamp-2">{item.alias || item.product_name}</span>
                                                            <span className="text-green-600 font-bold self-end">${item.price}</span>
                                                        </button>
                                                    ))}
                                                    {menuSections.find(s => s.id === activeSectionId)?.items.length === 0 && (
                                                        <div className="col-span-3 text-center py-8 text-gray-400 italic">Sección vacía</div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="h-full flex items-center justify-center text-gray-400 italic">
                                                    {menuSections.length > 0 ? "Selecciona una categoría" : "No hay menú configurado"}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Selected Item Config */}
                            {selectedProduct && (
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 animate-in fade-in slide-in-from-top-4">
                                    <div className="flex justify-between items-start mb-3">
                                        <h4 className="font-bold text-blue-900">{selectedProduct.name}</h4>
                                        <button onClick={() => setSelectedProduct(null)} className="text-blue-400 hover:text-blue-600"><X size={16} /></button>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-1/3">
                                            <label className="text-xs font-bold text-blue-700 mb-1 block">Cantidad</label>
                                            <input
                                                type="number" min="1"
                                                value={quantity} onChange={e => setQuantity(Number(e.target.value))}
                                                className="w-full p-2 rounded border border-blue-200"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-xs font-bold text-blue-700 mb-1 block">Notas (Opcional)</label>
                                            <input
                                                type="text" placeholder="Sin cebolla, término medio..."
                                                value={notes} onChange={e => setNotes(e.target.value)}
                                                className="w-full p-2 rounded border border-blue-200"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleAddItem}
                                        className="mt-3 w-full py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-sm flex items-center justify-center gap-2"
                                    >
                                        <Plus size={18} /> Agregar a la Orden
                                    </button>
                                </div>
                            )}

                            {/* Current Order List */}
                            <div className="mt-4">
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2 flex justify-between">
                                    <span>Orden Actual</span>
                                    {order?.total_amount && <span className="text-green-600 font-black text-lg">${order.total_amount}</span>}
                                </h3>

                                {loadingOrder ? (
                                    <div className="text-center py-8 text-gray-400">Cargando orden...</div>
                                ) : (order?.items?.length === 0 ? (
                                    <div className="text-center py-8 border-2 border-dashed rounded-xl text-gray-400 bg-gray-50">
                                        Mesa abierta sin pedidos aún.
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                        {order?.items?.map(item => (
                                            <div key={item.id} className="flex justify-between items-center p-3 bg-white border rounded-lg shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <span className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg font-bold text-gray-600">
                                                        {item.quantity}
                                                    </span>
                                                    <div>
                                                        <p className="font-bold text-gray-800">{item.product_name}</p>
                                                        {item.notes && <p className="text-xs text-orange-600 italic">📝 {item.notes}</p>}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-gray-900">${item.subtotal}</p>
                                                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{item.status}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                    <div className="flex gap-2">
                        {table.status === 'OCCUPIED' && order && order.items && order.items.length > 0 && (
                            <button
                                onClick={async () => {
                                    try {
                                        await restaurantService.printPreCheck(order.id);
                                        toast.success("Pre-cuenta enviada a imprimir");
                                    } catch (e) {
                                        toast.error("Error imprimiendo pre-cuenta");
                                    }
                                }}
                                className="px-4 py-2 border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 rounded-lg transition"
                                title="Imprimir Pre-Cuenta"
                            >
                                🖨️
                            </button>
                        )}
                        <button onClick={onClose} className="px-5 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded-lg transition">
                            Cerrar
                        </button>
                    </div>

                    {table.status === 'OCCUPIED' && order && order.items && order.items.length > 0 && (
                        <button
                            onClick={() => setShowPaymentModal(true)}
                            className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg shadow hover:bg-indigo-700 transition flex items-center gap-2"
                        >
                            <span>Cobrar / Cerrar Mesa</span>
                            <span className="bg-indigo-800 px-2 py-0.5 rounded text-sm">${order.total_amount}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Payment Modal Integration */}
            {showPaymentModal && order && (
                <PaymentModal
                    isOpen={showPaymentModal}
                    onClose={() => setShowPaymentModal(false)}
                    totalUSD={parseFloat(order.total_amount)}
                    totalsByCurrency={{ USD: parseFloat(order.total_amount) }}
                    cart={order.items.map(i => ({
                        product_id: i.product_id,
                        quantity: parseFloat(i.quantity),
                        unit_price: parseFloat(i.unit_price),
                        unit_price_usd: parseFloat(i.unit_price),
                        price_usd: parseFloat(i.unit_price),
                        original_price_usd: parseFloat(i.unit_price),
                        subtotal: parseFloat(i.subtotal),
                        is_discount_active: false
                    }))}
                    onConfirm={() => { }}
                    customSubmit={handleCheckout}
                    warehouseId={null}
                />
            )}

            {showMoveModal && order && (
                <MoveTableModal
                    isOpen={showMoveModal}
                    onClose={() => setShowMoveModal(false)}
                    orderId={order.id}
                    currentTableName={table.name}
                    onMoveSuccess={() => {
                        onClose(); // Close OrderModal to invalidate everything
                        onUpdate(); // Reload Map
                    }}
                />
            )}

            {showSplitModal && order && (
                <SplitCheckModal
                    isOpen={showSplitModal}
                    onClose={() => setShowSplitModal(false)}
                    order={order}
                    onSplitSuccess={handleSplitSuccess}
                />
            )}
        </div>
    );
};

export default OrderModal;
