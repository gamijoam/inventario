import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Plus, Minus, ChefHat, Settings, ArrowRight, Split, Send, Clock, CheckCircle, Flame, UtensilsCrossed, ShoppingBag, Trash2 } from 'lucide-react';
import restaurantService from '../../../services/restaurantService';
import axiosInstance from '../../../config/axios';
import PaymentModal from '../../../components/pos/PaymentModal';
import MoveTableModal from './MoveTableModal';
import SplitCheckModal from './SplitCheckModal';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
    PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock },
    SENT: { label: 'Enviado', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Send },
    PREPARING: { label: 'Cocinando', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Flame },
    READY: { label: '¡Listo!', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
    SERVED: { label: 'Servido', color: 'bg-slate-100 text-slate-500 border-slate-200', icon: UtensilsCrossed },
};

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
    const [customerName, setCustomerName] = useState(table.customer_name || '');

    // Menu State
    const [menuSections, setMenuSections] = useState([]);
    const [activeSectionId, setActiveSectionId] = useState(null);
    const [menuLoading, setMenuLoading] = useState(false);

    // Quick notes
    const QUICK_NOTES = ['Sin cebolla', 'Extra queso', 'Bien cocido', 'Término medio', 'Sin sal', 'Sin picante', 'Para compartir'];

    // Load order if occupied, or auto-open if available/reserved
    useEffect(() => {
        if (table.status === 'OCCUPIED') {
            loadCurrentOrder();
        } else if (table.status === 'AVAILABLE' || table.status === 'RESERVED') {
            // Auto-open the table so the user sees the menu immediately
            handleOpenTable();
        }
    }, []);

    const loadCurrentOrder = async () => {
        setLoadingOrder(true);
        try {
            if (table.id) {
                const data = await restaurantService.getCurrentOrder(table.id);
                setOrder(data);
                if (data.customer_name) setCustomerName(data.customer_name);
            }
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
            let data;
            if (table.is_takeout) {
                data = await restaurantService.openTakeout(customerName);
            } else {
                await restaurantService.openTable(table.id);
                data = await restaurantService.getCurrentOrder(table.id);
            }
            onUpdate();
            setOrder(data);
            if (!table.is_takeout) table.status = 'OCCUPIED';
        } catch (error) {
            toast.error("Error al abrir el pedido: " + error.message);
        }
    };

    // Search Products
    useEffect(() => {
        if (searchTerm.length < 2) {
            setSearchResults([]);
            return;
        }
        const delayDebounce = setTimeout(async () => {
            setSearching(true);
            try {
                const response = await axiosInstance.get('/products/', { params: { search: searchTerm, limit: 10 } });
                setSearchResults(response.data.data || response.data);
            } catch (err) {
                console.error(err);
            } finally {
                setSearching(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounce);
    }, [searchTerm]);

    const handleAddItem = async (product = null) => {
        const prod = product || selectedProduct;
        if (!prod || !order) return;

        try {
            await restaurantService.addItemsToOrder(order.id, [{
                product_id: prod.id,
                quantity: product ? 1 : quantity,
                notes: product ? '' : notes
            }]);

            setSelectedProduct(null);
            setQuantity(1);
            setNotes('');
            setSearchTerm('');
            loadCurrentOrder();
            onUpdate();
            toast.success(`${prod.name} agregado`);
        } catch (error) {
            toast.error("Error agregando producto: " + error.message);
        }
    };

    const handleSendToKitchen = async () => {
        if (!order) return;
        const pendingItems = order.items?.filter(i => i.status === 'PENDING') || [];
        if (pendingItems.length === 0) {
            toast('No hay items pendientes para enviar', { icon: 'ℹ️' });
            return;
        }

        try {
            // Update all pending items to SENT
            await Promise.all(pendingItems.map(item =>
                axiosInstance.put(`/restaurant/orders/items/${item.id}/status`, null, {
                    params: { status: 'SENT' }
                })
            ));
            toast.success(`${pendingItems.length} item(s) enviados a cocina 🍳`);
            loadCurrentOrder();
        } catch (error) {
            toast.error("Error enviando a cocina");
        }
    };

    const handleCheckout = async (paymentPayload) => {
        try {
            const checkoutData = {
                payment_method: paymentPayload.payment_method || "Efectivo",
                currency: paymentPayload.currency || "USD",
                client_id: paymentPayload.client_id || paymentPayload.customer_id || null,
                exchange_rate: parseFloat(paymentPayload.exchange_rate || 1),
                total_amount_bs: parseFloat(paymentPayload.total_amount_bs || 0),
                change_amount: parseFloat(paymentPayload.change_amount || 0),
                change_currency: paymentPayload.change_currency || "VES",
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
            onClose();
            onUpdate();
            return response;
        } catch (error) {
            console.error("Checkout error:", error);
            toast.error(error.response?.data?.detail || "Error al procesar el cobro");
            throw error;
        }
    };

    const handleSplitSuccess = async (newOrderId) => {
        try {
            const newOrder = await restaurantService.getOrder(newOrderId);
            setOrder(newOrder);
            setShowSplitModal(false);
            setShowPaymentModal(true);
            toast("Sub-cuenta lista para cobrar");
        } catch (error) {
            toast.error("Error cargando la nueva cuenta");
        }
    };

    // Computed values
    const pendingCount = order?.items?.filter(i => i.status === 'PENDING').length || 0;
    const activeSection = menuSections.find(s => s.id === activeSectionId);

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-2 md:p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden">

                {/* Header */}
                <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${table.is_takeout
                            ? 'bg-gradient-to-br from-orange-500 to-amber-600 text-white'
                            : 'bg-gradient-to-br from-indigo-500 to-blue-600 text-white'
                            }`}>
                            {table.is_takeout ? <ShoppingBag size={20} /> : <UtensilsCrossed size={20} />}
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-800">{table.name}</h2>
                            <p className="text-xs text-slate-400 font-medium">{table.zone}{order ? ` • Orden #${order.id}` : ''}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Options Menu */}
                        {table.status === 'OCCUPIED' && order && (
                            <div className="relative">
                                <button
                                    onClick={() => setShowOptions(!showOptions)}
                                    className={`p-2 rounded-lg transition ${showOptions ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 text-slate-400'}`}
                                >
                                    <Settings size={18} />
                                </button>

                                {showOptions && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setShowOptions(false)}></div>
                                        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
                                            <button
                                                onClick={() => { setShowOptions(false); setShowMoveModal(true); }}
                                                className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-2 text-sm font-bold text-slate-700"
                                            >
                                                <ArrowRight size={16} /> Mover Mesa
                                            </button>
                                            <button
                                                onClick={() => { setShowOptions(false); setShowSplitModal(true); }}
                                                className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-2 text-sm font-bold text-slate-700"
                                            >
                                                <Split size={16} /> Dividir Cuenta
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition text-slate-400">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">

                    {/* STATE: LOADING -> table is being opened automatically */}
                    {!order && loadingOrder && (
                        <div className="flex flex-col items-center justify-center h-60 space-y-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-indigo-500"></div>
                            <p className="text-slate-400 font-bold">Abriendo mesa...</p>
                        </div>
                    )}

                    {/* STATE: TAKEOUT -> ask for customer name before opening */}
                    {table.is_takeout && !order && !loadingOrder && (
                        <div className="flex flex-col items-center justify-center h-80 space-y-5 p-6">
                            <div className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg bg-gradient-to-br from-orange-400 to-amber-500">
                                <ShoppingBag size={36} className="text-white" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700">Nuevo Pedido Para Llevar</h3>
                            <div className="w-full max-w-xs">
                                <label className="text-xs font-bold text-slate-500 mb-1.5 block">Nombre del Cliente (Opcional)</label>
                                <input
                                    type="text"
                                    value={customerName}
                                    onChange={e => setCustomerName(e.target.value)}
                                    placeholder="Ej: Juan Perez"
                                    className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
                                />
                            </div>
                            <button
                                onClick={handleOpenTable}
                                className="px-10 py-3.5 text-white rounded-xl font-black shadow-lg transition transform hover:scale-105 active:scale-95 bg-gradient-to-r from-orange-500 to-amber-600 shadow-orange-200"
                            >
                                🥡 Iniciar Pedido
                            </button>
                        </div>
                    )}

                    {/* STATE: OCCUPIED -> MANAGE ORDER */}
                    {(table.status === 'OCCUPIED' || order) && (
                        <div className="flex flex-col h-full">
                            {/* Menu & Search Area */}
                            <div className="p-4 space-y-3 border-b border-slate-100 bg-slate-50/50">
                                {/* Search Bar */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Buscar producto por nombre o SKU..."
                                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white text-sm transition"
                                        value={searchTerm}
                                        onChange={e => { setSearchTerm(e.target.value); if (e.target.value) setActiveSectionId(null); }}
                                    />
                                    {searching && <div className="absolute right-3 top-3 animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500"></div>}
                                </div>

                                {/* SEARCH RESULTS vs MENU GRID */}
                                {searchTerm.length > 0 ? (
                                    <div className="border border-slate-200 rounded-xl shadow-sm bg-white overflow-hidden divide-y divide-slate-100 max-h-52 overflow-y-auto">
                                        {searchResults.map(prod => (
                                            <button
                                                key={prod.id}
                                                onClick={() => { setSelectedProduct(prod); setSearchTerm(''); setSearchResults([]); }}
                                                className="w-full px-4 py-3 text-left hover:bg-indigo-50 flex justify-between items-center group transition"
                                            >
                                                <div>
                                                    <span className="font-bold text-slate-700 group-hover:text-indigo-700 text-sm">{prod.name}</span>
                                                    {prod.sku && <span className="text-xs text-slate-400 ml-2">SKU: {prod.sku}</span>}
                                                </div>
                                                <span className="font-black text-emerald-600">${prod.price}</span>
                                            </button>
                                        ))}
                                        {searchResults.length === 0 && !searching && searchTerm.length >= 2 && (
                                            <div className="p-4 text-center text-slate-400 italic text-sm">No se encontraron productos</div>
                                        )}
                                    </div>
                                ) : (
                                    /* VISUAL MENU */
                                    <div className="flex flex-col" style={{ maxHeight: selectedProduct ? '200px' : '300px' }}>
                                        {/* Categories Tabs */}
                                        <div className="flex gap-1.5 overflow-x-auto pb-2 custom-scrollbar">
                                            {menuSections.map(section => (
                                                <button
                                                    key={section.id}
                                                    onClick={() => setActiveSectionId(section.id)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${activeSectionId === section.id
                                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                                        : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                                                        }`}
                                                >
                                                    {section.name}
                                                    {section.items?.length > 0 && (
                                                        <span className="ml-1 opacity-60">({section.items.length})</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Items Grid */}
                                        <div className="flex-1 overflow-y-auto bg-white rounded-xl p-2 border border-slate-200">
                                            {activeSection ? (
                                                <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                                                    {(activeSection.items || []).map(item => (
                                                        <button
                                                            key={item.id}
                                                            onClick={() => handleAddItem({
                                                                id: item.product_id,
                                                                name: item.alias || item.product_name,
                                                                price: item.price
                                                            })}
                                                            className="flex flex-col justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100 hover:border-indigo-400 hover:bg-indigo-50 hover:shadow-md transition text-left h-20 group"
                                                        >
                                                            <span className="font-bold text-xs text-slate-700 line-clamp-2 group-hover:text-indigo-700 leading-tight">
                                                                {item.alias || item.product_name}
                                                            </span>
                                                            <span className="text-emerald-600 font-black text-sm self-end">${item.price}</span>
                                                        </button>
                                                    ))}
                                                    {(activeSection.items || []).length === 0 && (
                                                        <div className="col-span-full text-center py-6 text-slate-400 italic text-sm">Sección vacía</div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="h-full flex items-center justify-center text-slate-400 italic text-sm py-8">
                                                    {menuSections.length > 0 ? "Selecciona una categoría" : "No hay menú configurado"}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Selected Item Config */}
                            {selectedProduct && (
                                <div className="p-4 bg-indigo-50 border-b border-indigo-100">
                                    <div className="flex justify-between items-start mb-3">
                                        <h4 className="font-black text-indigo-900">{selectedProduct.name}</h4>
                                        <button onClick={() => setSelectedProduct(null)} className="text-indigo-300 hover:text-indigo-600 transition">
                                            <X size={16} />
                                        </button>
                                    </div>
                                    <div className="flex gap-3 items-end">
                                        {/* Quantity with +/- buttons */}
                                        <div>
                                            <label className="text-[10px] font-black text-indigo-600 uppercase tracking-wider mb-1 block">Cantidad</label>
                                            <div className="flex items-center bg-white rounded-lg border border-indigo-200 overflow-hidden">
                                                <button
                                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                                    className="w-10 h-10 flex items-center justify-center hover:bg-indigo-100 transition text-indigo-600 font-black"
                                                >
                                                    <Minus size={16} />
                                                </button>
                                                <span className="w-10 h-10 flex items-center justify-center font-black text-lg text-indigo-900 border-x border-indigo-200">
                                                    {quantity}
                                                </span>
                                                <button
                                                    onClick={() => setQuantity(quantity + 1)}
                                                    className="w-10 h-10 flex items-center justify-center hover:bg-indigo-100 transition text-indigo-600 font-black"
                                                >
                                                    <Plus size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Notes */}
                                        <div className="flex-1">
                                            <label className="text-[10px] font-black text-indigo-600 uppercase tracking-wider mb-1 block">Notas</label>
                                            <input
                                                type="text" placeholder="Sin cebolla, extra queso..."
                                                value={notes} onChange={e => setNotes(e.target.value)}
                                                className="w-full h-10 px-3 rounded-lg border border-indigo-200 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                                            />
                                        </div>

                                        {/* Add Button */}
                                        <button
                                            onClick={() => handleAddItem()}
                                            className="h-10 px-5 bg-indigo-600 text-white rounded-lg font-black hover:bg-indigo-700 shadow-sm flex items-center gap-1.5 transition active:scale-95 shrink-0 text-sm"
                                        >
                                            <Plus size={16} /> Agregar
                                        </button>
                                    </div>

                                    {/* Quick Notes */}
                                    <div className="flex gap-1.5 mt-2 flex-wrap">
                                        {QUICK_NOTES.map(note => (
                                            <button
                                                key={note}
                                                onClick={() => setNotes(prev => prev ? `${prev}, ${note}` : note)}
                                                className="px-2 py-0.5 bg-white border border-indigo-200 rounded-md text-[11px] font-bold text-indigo-600 hover:bg-indigo-100 transition"
                                            >
                                                {note}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Current Order List */}
                            <div className="flex-1 p-4 overflow-y-auto">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Orden Actual</h3>
                                    {order?.total_amount != null && (
                                        <span className="text-emerald-600 font-black text-xl">${parseFloat(order.total_amount).toFixed(2)}</span>
                                    )}
                                </div>

                                {loadingOrder ? (
                                    <div className="text-center py-8 text-slate-400">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-2"></div>
                                        Cargando orden...
                                    </div>
                                ) : (order?.items?.length === 0) ? (
                                    <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 bg-slate-50/50">
                                        <UtensilsCrossed size={32} className="mx-auto mb-2 opacity-30" />
                                        <p className="font-bold">Mesa abierta sin pedidos</p>
                                        <p className="text-xs mt-1">Selecciona items del menú arriba</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                        {order?.items?.map(item => {
                                            const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;
                                            const StatusIcon = statusCfg.icon;
                                            return (
                                                <div key={item.id} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition">
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <span className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-lg font-black text-slate-600 text-sm shrink-0">
                                                            {item.quantity}
                                                        </span>
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-slate-800 text-sm truncate">{item.product_name}</p>
                                                            {item.notes && <p className="text-[11px] text-orange-500 font-semibold truncate">📝 {item.notes}</p>}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border flex items-center gap-1 ${statusCfg.color}`}>
                                                            <StatusIcon size={10} />
                                                            {statusCfg.label}
                                                        </span>
                                                        <span className="font-black text-slate-900 text-sm">${parseFloat(item.subtotal).toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center gap-2">
                    <div className="flex gap-2">
                        {/* Print Pre-check */}
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
                                className="px-3 py-2.5 border border-slate-200 text-slate-600 font-bold hover:bg-white rounded-xl transition text-sm flex items-center gap-1.5"
                                title="Imprimir Pre-Cuenta"
                            >
                                🖨️ Pre-Cuenta
                            </button>
                        )}

                        {/* Send to Kitchen */}
                        {table.status === 'OCCUPIED' && order && pendingCount > 0 && (
                            <button
                                onClick={handleSendToKitchen}
                                className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-black rounded-xl shadow-md shadow-orange-200 hover:shadow-lg transition text-sm flex items-center gap-2 active:scale-95"
                            >
                                <Send size={16} />
                                Enviar a Cocina
                                <span className="bg-white/20 px-1.5 py-0.5 rounded-md text-xs">{pendingCount}</span>
                            </button>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2.5 text-slate-500 font-bold hover:bg-slate-200 rounded-xl transition text-sm">
                            Cerrar
                        </button>

                        {table.status === 'OCCUPIED' && order && order.items && order.items.length > 0 && (
                            <button
                                onClick={() => setShowPaymentModal(true)}
                                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-black rounded-xl shadow-lg shadow-indigo-200 hover:shadow-xl transition flex items-center gap-2 text-sm active:scale-95"
                            >
                                💰 Cobrar
                                <span className="bg-white/20 px-2 py-0.5 rounded-md">${parseFloat(order.total_amount).toFixed(2)}</span>
                            </button>
                        )}
                    </div>
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
                        onClose();
                        onUpdate();
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
