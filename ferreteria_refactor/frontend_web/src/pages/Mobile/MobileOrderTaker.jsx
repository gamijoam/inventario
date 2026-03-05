import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import restaurantService from '../../services/restaurantService';
import { ChevronLeft, ShoppingCart, Minus, Plus, Send, X, Clock, CheckCircle, Flame, Search, MessageSquare, ChefHat } from 'lucide-react';
import toast from 'react-hot-toast';

const QUICK_NOTES = ['Sin cebolla', 'Extra queso', 'Bien cocido', 'Término medio', 'Sin sal', 'Sin picante', 'Sin gluten', 'Doble porción'];

const ITEM_STATUS = {
    PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    SENT: { label: 'Enviado', color: 'bg-blue-100 text-blue-700', icon: Send },
    PREPARING: { label: 'Cocinando', color: 'bg-orange-100 text-orange-700', icon: Flame },
    READY: { label: '¡Listo!', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
};

const MobileOrderTaker = () => {
    const { tableId } = useParams();
    const navigate = useNavigate();
    const isTakeout = tableId === 'takeout';

    // Data State
    const [table, setTable] = useState(null);
    const [order, setOrder] = useState(null);
    const [menu, setMenu] = useState([]);

    // UI State
    const [activeSection, setActiveSection] = useState(null);
    const [loading, setLoading] = useState(true);
    const [viewCart, setViewCart] = useState(false);
    const [showExistingOrder, setShowExistingOrder] = useState(true); // Expanded by default
    const [notesFor, setNotesFor] = useState(null); // product_id of item receiving notes
    const [sending, setSending] = useState(false);
    const [customerName, setCustomerName] = useState('');

    // Local Cart State (New Items)
    const [cart, setCart] = useState([]);

    useEffect(() => {
        loadData();
    }, [tableId]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (!isTakeout) {
                const tables = await restaurantService.getTables();
                const foundTable = tables.find(t => t.id === parseInt(tableId));
                if (!foundTable) {
                    toast.error("Mesa no encontrada");
                    navigate('/mobile/tables');
                    return;
                }
                setTable(foundTable);

                if (foundTable.status === 'OCCUPIED') {
                    try {
                        const orderData = await restaurantService.getCurrentOrder(foundTable.id);
                        setOrder(orderData);
                    } catch (e) {
                        // No active order
                    }
                }
            } else {
                setTable({ name: 'Para Llevar', zone: 'Takeout', status: 'AVAILABLE', is_takeout: true });
            }

            const menuData = await restaurantService.getMenuFull();
            if (menuData.sections) {
                setMenu(menuData.sections);
                if (menuData.sections.length > 0) setActiveSection(menuData.sections[0].id);
            }
        } catch (error) {
            console.error(error);
            toast.error("Error cargando datos");
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(i => i.product_id === product.product_id);
            if (existing) {
                return prev.map(i => i.product_id === product.product_id
                    ? { ...i, quantity: i.quantity + 1 }
                    : i
                );
            }
            return [...prev, { ...product, quantity: 1, notes: '' }];
        });
        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate(30);
        toast.success(`+1 ${product.alias || product.product_name}`, {
            duration: 800,
            position: 'bottom-center',
            style: { fontSize: '13px', fontWeight: 'bold', padding: '8px 16px' }
        });
    };

    const updateCartQty = (productId, delta) => {
        setCart(prev => prev.map(i => {
            if (i.product_id === productId) {
                return { ...i, quantity: Math.max(0, i.quantity + delta) };
            }
            return i;
        }).filter(i => i.quantity > 0));
    };

    const updateCartNotes = (productId, notes) => {
        setCart(prev => prev.map(i =>
            i.product_id === productId ? { ...i, notes } : i
        ));
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    const handleSendOrder = async () => {
        if (cart.length === 0) return;
        setSending(true);

        try {
            let currentOrderId = order?.id;

            // Open table/takeout if needed
            if (!currentOrderId) {
                if (isTakeout) {
                    const newOrder = await restaurantService.openTakeout(customerName || null);
                    currentOrderId = newOrder.id;
                } else if (table.status === 'AVAILABLE') {
                    await restaurantService.openTable(table.id);
                    const newOrder = await restaurantService.getCurrentOrder(table.id);
                    currentOrderId = newOrder.id;
                }
            }

            // Add Items
            const itemsPayload = cart.map(i => ({
                product_id: i.product_id,
                quantity: i.quantity,
                notes: i.notes || ''
            }));

            await restaurantService.addItemsToOrder(currentOrderId, itemsPayload);

            if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
            toast.success(`✅ ${cartCount} item(s) enviados a cocina`, { duration: 2000 });
            setCart([]);
            setViewCart(false);
            navigate('/mobile/tables');
        } catch (error) {
            console.error(error);
            toast.error("Error enviando pedido: " + (error.response?.data?.detail || error.message));
        } finally {
            setSending(false);
        }
    };

    const currentSection = useMemo(() =>
        menu.find(s => s.id === activeSection),
        [menu, activeSection]
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-indigo-500 mx-auto mb-4"></div>
                    <p className="text-slate-400 font-bold">Cargando menú...</p>
                </div>
            </div>
        );
    }

    // ─── CART VIEW ─────────────────────────────
    if (viewCart) {
        return (
            <div className="bg-slate-50 min-h-screen flex flex-col">
                <header className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                    <h2 className="text-lg font-black text-slate-800">Confirmar Pedido</h2>
                    <button onClick={() => setViewCart(false)} className="p-2 rounded-xl bg-slate-100 active:scale-95">
                        <X size={20} className="text-slate-500" />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {/* Takeout customer name */}
                    {isTakeout && (
                        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1.5 block">Nombre del Cliente</label>
                            <input
                                type="text"
                                value={customerName}
                                onChange={e => setCustomerName(e.target.value)}
                                placeholder="Opcional"
                                className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    )}

                    {cart.map(item => (
                        <div key={item.product_id} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex-1 min-w-0">
                                    <p className="font-black text-slate-800 text-sm">{item.alias || item.product_name}</p>
                                    <p className="text-emerald-600 font-bold text-sm">${item.price} c/u</p>
                                </div>
                                <span className="font-black text-slate-900 text-base">${(item.price * item.quantity).toFixed(2)}</span>
                            </div>

                            {/* Quantity Controls */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center bg-slate-100 rounded-xl overflow-hidden">
                                    <button
                                        onClick={() => updateCartQty(item.product_id, -1)}
                                        className="w-10 h-10 flex items-center justify-center text-red-500 active:bg-red-100 transition"
                                    >
                                        <Minus size={18} strokeWidth={3} />
                                    </button>
                                    <span className="w-10 h-10 flex items-center justify-center font-black text-lg text-slate-800">
                                        {item.quantity}
                                    </span>
                                    <button
                                        onClick={() => updateCartQty(item.product_id, 1)}
                                        className="w-10 h-10 flex items-center justify-center text-emerald-500 active:bg-emerald-100 transition"
                                    >
                                        <Plus size={18} strokeWidth={3} />
                                    </button>
                                </div>

                                <button
                                    onClick={() => setNotesFor(notesFor === item.product_id ? null : item.product_id)}
                                    className={`p-2.5 rounded-xl transition active:scale-95 ${item.notes
                                        ? 'bg-orange-100 text-orange-600'
                                        : 'bg-slate-100 text-slate-400'
                                        }`}
                                >
                                    <MessageSquare size={18} />
                                </button>
                            </div>

                            {/* Notes Section */}
                            {notesFor === item.product_id && (
                                <div className="mt-3 space-y-2 animate-in slide-in-from-top-2">
                                    <input
                                        type="text"
                                        value={item.notes}
                                        onChange={e => updateCartNotes(item.product_id, e.target.value)}
                                        placeholder="Ej: Sin cebolla, extra queso..."
                                        className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400"
                                        autoFocus
                                    />
                                    <div className="flex gap-1.5 flex-wrap">
                                        {QUICK_NOTES.map(note => (
                                            <button
                                                key={note}
                                                onClick={() => {
                                                    const current = item.notes;
                                                    updateCartNotes(item.product_id, current ? `${current}, ${note}` : note);
                                                }}
                                                className="px-2.5 py-1 bg-orange-50 border border-orange-200 rounded-lg text-[11px] font-bold text-orange-600 active:scale-95 transition"
                                            >
                                                {note}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {item.notes && notesFor !== item.product_id && (
                                <p className="mt-2 text-xs text-orange-500 font-semibold">📝 {item.notes}</p>
                            )}
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 bg-white border-t border-slate-200 shadow-lg sticky bottom-0">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-slate-400 font-bold text-sm">{cartCount} items</span>
                        <span className="text-2xl font-black text-slate-900">${cartTotal.toFixed(2)}</span>
                    </div>
                    <button
                        onClick={handleSendOrder}
                        disabled={sending}
                        className="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-50 text-base"
                    >
                        {sending ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : (
                            <>
                                <Send size={20} /> Enviar a Cocina
                            </>
                        )}
                    </button>
                </div>
            </div>
        );
    }

    // ─── MAIN VIEW (Menu) ─────────────────────────────
    return (
        <div className="flex flex-col h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/mobile/tables')}
                        className="p-2 -ml-2 rounded-xl active:bg-slate-100 transition"
                    >
                        <ChevronLeft size={22} className="text-slate-600" />
                    </button>
                    <div className="flex-1">
                        <h1 className="font-black text-base text-slate-800">{table?.name}</h1>
                        <p className="text-[11px] text-slate-400 font-bold">
                            {order ? `Orden #${order.id}` : 'Nueva Orden'}
                            {table?.zone && ` • ${table.zone}`}
                        </p>
                    </div>

                    {/* Existing order toggle */}
                    {order && order.items && order.items.length > 0 && (
                        <button
                            onClick={() => setShowExistingOrder(!showExistingOrder)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 active:scale-95 transition ${showExistingOrder
                                ? 'bg-indigo-100 text-indigo-600'
                                : 'bg-slate-100 text-slate-500'
                                }`}
                        >
                            <ChefHat size={14} />
                            {order.items.length}
                        </button>
                    )}
                </div>
            </header>

            {/* Existing Order Panel (Collapsible) */}
            {showExistingOrder && order && order.items && (
                <div className="bg-white border-b border-slate-200 p-3 max-h-48 overflow-y-auto animate-in slide-in-from-top-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Orden Actual — ${parseFloat(order.total_amount).toFixed(2)}</p>
                    <div className="space-y-1.5">
                        {order.items.map(item => {
                            const status = ITEM_STATUS[item.status] || ITEM_STATUS.PENDING;
                            const StatusIcon = status.icon;
                            return (
                                <div key={item.id} className="flex items-center justify-between py-1.5 px-2 bg-slate-50 rounded-lg">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-black text-slate-600 text-xs w-5 text-center">{item.quantity}</span>
                                        <span className="text-xs font-bold text-slate-700 truncate">{item.product_name}</span>
                                    </div>
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black flex items-center gap-0.5 shrink-0 ${status.color}`}>
                                        <StatusIcon size={8} />
                                        {status.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Categories */}
            <div className="bg-white border-b border-slate-200 px-3 py-2 flex gap-2 overflow-x-auto custom-scrollbar sticky top-[52px] z-10">
                {menu.map(section => (
                    <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-black transition active:scale-95 ${activeSection === section.id
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                            : 'bg-slate-100 text-slate-500'
                            }`}
                    >
                        {section.name}
                    </button>
                ))}
            </div>

            {/* Products Grid */}
            <main className="flex-1 p-3 overflow-y-auto">
                <div className="grid grid-cols-2 gap-2.5 pb-24">
                    {currentSection?.items?.map(item => {
                        const inCart = cart.find(c => c.product_id === item.product_id);
                        return (
                            <button
                                key={item.id}
                                onClick={() => addToCart(item)}
                                className={`relative bg-white p-3 rounded-2xl shadow-sm text-left h-24 flex flex-col justify-between active:scale-95 transition border-2 ${inCart
                                    ? 'border-indigo-300 bg-indigo-50/30'
                                    : 'border-slate-100'
                                    }`}
                            >
                                <span className="font-bold text-slate-700 line-clamp-2 text-[13px] leading-tight">
                                    {item.alias || item.product_name}
                                </span>
                                <div className="flex justify-between items-end">
                                    <span className="text-emerald-600 font-black text-sm">${item.price}</span>
                                    {inCart && (
                                        <span className="bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shadow-md">
                                            {inCart.quantity}
                                        </span>
                                    )}
                                </div>
                            </button>
                        );
                    })}

                    {(!currentSection?.items || currentSection.items.length === 0) && (
                        <div className="col-span-2 text-center py-12 text-slate-400">
                            <ChefHat size={40} className="mx-auto mb-2 opacity-30" />
                            <p className="font-bold text-sm">
                                {menu.length === 0
                                    ? 'No hay menú configurado'
                                    : 'Sección vacía'
                                }
                            </p>
                            {menu.length === 0 && (
                                <p className="text-xs mt-1 text-slate-300">
                                    El administrador debe configurar el Menú Digital primero.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {/* Bottom Cart Bar */}
            {cart.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 shadow-xl z-20 animate-in slide-in-from-bottom-4">
                    <div className="flex items-center gap-3">
                        <div className="flex-1">
                            <p className="text-slate-400 text-xs font-bold">{cartCount} items nuevos</p>
                            <p className="text-slate-900 font-black text-lg">${cartTotal.toFixed(2)}</p>
                        </div>
                        <button
                            onClick={() => setViewCart(true)}
                            className="px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-black rounded-2xl shadow-lg shadow-indigo-200 flex items-center gap-2 active:scale-95 transition"
                        >
                            <ShoppingCart size={18} />
                            Ver Pedido
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MobileOrderTaker;
