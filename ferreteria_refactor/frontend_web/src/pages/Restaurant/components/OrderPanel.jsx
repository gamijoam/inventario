import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Plus, Minus, ChefHat, Settings, ArrowRight, Split, Send, Clock, CheckCircle, Flame, UtensilsCrossed, ShoppingBag, Trash2, Check, Info } from 'lucide-react';
import restaurantService from '../../../services/restaurantService';
import axiosInstance from '../../../config/axios';
import PaymentModal from '../../../components/pos/PaymentModal';
import toast from 'react-hot-toast';
import { cn } from '../../../lib/utils';

const STATUS_CONFIG = {
    PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock },
    SENT: { label: 'En Cocina', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Send },
    PREPARING: { label: 'Preparando', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Flame },
    READY: { label: '¡Listo!', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
    SERVED: { label: 'Servido', color: 'bg-slate-100 text-slate-500 border-slate-200', icon: UtensilsCrossed },
};

const OrderPanel = ({ table, onClose, onUpdate }) => {
    const [order, setOrder] = useState(null);
    const [loadingOrder, setLoadingOrder] = useState(false);
    const [cart, setCart] = useState([]); // Items not yet sent to kitchen

    // UI States
    const [searchTerm, setSearchTerm] = useState('');
    const [menuSections, setMenuSections] = useState([]);
    const [activeSectionId, setActiveSectionId] = useState(null);
    const [menuLoading, setMenuLoading] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    // Initial Load
    useEffect(() => {
        if (table?.status === 'OCCUPIED' || table?.status === 'RESERVED') {
            loadCurrentOrder();
        }
        loadMenu();
    }, [table?.id, table?.status]);

    const loadCurrentOrder = async () => {
        if (!table?.id) return;
        setLoadingOrder(true);
        try {
            const data = await restaurantService.getCurrentOrder(table.id);
            setOrder(data);
        } catch (err) {
            console.error("Error loading order:", err);
            if (err.response?.status !== 404) {
                toast.error("No se pudo cargar la orden activa");
            }
        } finally {
            setLoadingOrder(false);
        }
    };

    const loadMenu = async () => {
        setMenuLoading(true);
        try {
            const data = await restaurantService.getMenuFull();
            if (data.sections?.length > 0) {
                setMenuSections(data.sections);
                setActiveSectionId(data.sections[0].id);
            }
        } catch (err) {
            console.error("Error loading menu:", err);
        } finally {
            setMenuLoading(false);
        }
    };

    const handleAddToCart = (product) => {
        const existing = cart.find(item => item.id === product.id);
        if (existing) {
            setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
        } else {
            setCart([...cart, { ...product, quantity: 1 }]);
        }
        toast.success(`${product.name} añadido al carrito`, { duration: 1500, icon: '🛒' });
    };

    const handleUpdateCartQty = (productId, delta) => {
        setCart(cart.map(item => {
            if (item.id === productId) {
                const newQty = Math.max(1, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const handleRemoveFromCart = (productId) => {
        setCart(cart.filter(item => item.id !== productId));
    };

    const handleSendToKitchen = async () => {
        if (cart.length === 0) return;
        
        setLoadingOrder(true);
        try {
            let currentOrderId = order?.id;
            
            // 1. If no order exists, open the table first
            if (!currentOrderId) {
                try {
                    await restaurantService.openTable(table.id);
                    const newOrder = await restaurantService.getCurrentOrder(table.id);
                    currentOrderId = newOrder.id;
                } catch (err) {
                    if (err.response?.status === 400) {
                        const existing = await restaurantService.getCurrentOrder(table.id);
                        currentOrderId = existing.id;
                    } else throw err;
                }
            }

            // 2. Add items to the order
            const itemsToAdd = cart.map(item => ({
                product_id: item.id,
                quantity: item.quantity,
                notes: ''
            }));

            await restaurantService.addItemsToOrder(currentOrderId, itemsToAdd);
            
            setCart([]);
            await loadCurrentOrder();
            onUpdate();
            toast.success("¡Orden enviada a cocina!", { icon: '👨‍🍳', style: { borderRadius: '12px', background: '#333', color: '#fff' } });
        } catch (err) {
            console.error("Error sending to kitchen:", err);
            toast.error("Error al procesar: " + (err.response?.data?.detail || err.message));
        } finally {
            setLoadingOrder(false);
        }
    };

    // Filtered Menu
    const filteredProducts = useMemo(() => {
        if (searchTerm) {
            // Global search across all categories
            const allItems = menuSections.flatMap(s => s.items || []);
            return allItems
                .filter(item => 
                    item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.alias?.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map(item => ({
                    id: item.product_id,
                    name: item.alias || item.product_name,
                    price: item.price,
                    image_url: item.image_url
                }));
        }

        // Category based view
        const activeSection = menuSections.find(s => s.id === activeSectionId);
        return (activeSection?.items || []).map(item => ({
            id: item.product_id,
            name: item.alias || item.product_name,
            price: item.price,
            image_url: item.image_url
        }));
    }, [menuSections, activeSectionId, searchTerm]);

    if (!table) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-[95%] sm:max-w-[85%] md:max-w-[700px] lg:max-w-[900px] h-full bg-slate-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                
                {/* Header Premium */}
                <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={cn(
                            "w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl transform rotate-3",
                            table.status === 'AVAILABLE' ? 'bg-gradient-to-br from-emerald-400 to-teal-600' : 'bg-gradient-to-br from-blue-500 to-indigo-700'
                        )}>
                            {table.name}
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">Mesa {table.name}</h2>
                            <p className="text-sm text-slate-400 font-medium flex items-center gap-2">
                                <span className={cn("w-2 h-2 rounded-full", table.status === 'AVAILABLE' ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500')} />
                                {table.status === 'AVAILABLE' ? 'Mesa Libre' : 'Servicio en curso'}
                                {order && <span className="text-slate-300 ml-1">• Orden #{order.id}</span>}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-2xl transition-all active:scale-90 text-slate-400 hover:text-slate-600">
                        <X className="w-6 h-6" />
                    </button>
                </header>

                <main className="flex-1 flex overflow-hidden">
                    {/* LEFT: Menu Catalog (60%) */}
                    <div className="flex-[3] flex flex-col bg-white border-r">
                        {/* Search & Categories */}
                        <div className="p-6 space-y-4 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.05)] z-10">
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                                <input 
                                    type="text" 
                                    placeholder="¿Qué desea el cliente?"
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-50 rounded-2xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            
                            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                                {menuSections.map(section => (
                                    <button
                                        key={section.id}
                                        onClick={() => setActiveSectionId(section.id)}
                                        className={cn(
                                            "px-5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border-2",
                                            activeSectionId === section.id 
                                                ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200 -translate-y-0.5" 
                                                : "bg-white border-slate-100 text-slate-500 hover:border-slate-200 hover:text-slate-700"
                                        )}
                                    >
                                        {section.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Product Grid */}
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                            {menuLoading ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                                    <p className="font-bold">Cargando delicias...</p>
                                </div>
                            ) : filteredProducts.length > 0 ? (
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredProducts.map(product => (
                                        <button
                                            key={product.id}
                                            onClick={() => handleAddToCart(product)}
                                            className="group relative flex flex-col bg-white border border-slate-200 rounded-3xl overflow-hidden hover:border-blue-500 hover:shadow-2xl transition-all duration-300 text-left"
                                        >
                                            <div className="aspect-[4/3] w-full bg-slate-100 relative overflow-hidden">
                                                {product.image_url ? (
                                                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-slate-200 group-hover:text-blue-200 transition-colors">
                                                        <UtensilsCrossed className="w-12 h-12" />
                                                    </div>
                                                )}
                                                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-black text-blue-600 shadow-sm">
                                                    ${product.price}
                                                </div>
                                            </div>
                                            <div className="p-4 bg-white">
                                                <h4 className="font-bold text-slate-800 text-sm line-clamp-2 leading-tight mb-1 group-hover:text-blue-600 transition-colors">
                                                    {product.name}
                                                </h4>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Click para añadir</p>
                                            </div>
                                            <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300 py-20">
                                    <Search className="w-16 h-16 mb-4 opacity-10" />
                                    <p className="font-bold">No encontramos productos con ese nombre</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: Active Order & Checkout (40%) */}
                    <div className="flex-[2] flex flex-col bg-slate-100 shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.05)]">
                        <div className="p-6 bg-white border-b">
                            <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-tighter text-sm">
                                <ShoppingBag className="w-4 h-4 text-blue-600" />
                                Detalle del Servicio
                            </h3>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* LOCAL CART (POR ENVIAR) */}
                            {cart.length > 0 && (
                                <div className="space-y-2 animate-in slide-in-from-top duration-300">
                                    <div className="flex items-center justify-between px-1">
                                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Nuevos Pedidos</p>
                                        <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-bold">Por enviar</span>
                                    </div>
                                    <div className="bg-blue-600 rounded-[2rem] p-4 shadow-xl shadow-blue-200">
                                        <div className="space-y-3 mb-4">
                                            {cart.map(item => (
                                                <div key={item.id} className="flex items-center justify-between gap-3 group">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-white text-sm truncate">{item.name}</p>
                                                        <div className="flex items-center gap-2">
                                                            <button onClick={() => handleUpdateCartQty(item.id, -1)} className="text-white/60 hover:text-white transition-colors p-1"><Minus className="w-3 h-3"/></button>
                                                            <span className="text-white font-black text-xs">x{item.quantity}</span>
                                                            <button onClick={() => handleUpdateCartQty(item.id, 1)} className="text-white/60 hover:text-white transition-colors p-1"><Plus className="w-3 h-3"/></button>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white/80 font-bold text-xs">${(item.price * item.quantity).toFixed(2)}</span>
                                                        <button 
                                                            onClick={() => handleRemoveFromCart(item.id)}
                                                            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <button 
                                            onClick={handleSendToKitchen}
                                            disabled={loadingOrder}
                                            className="w-full py-4 bg-white text-blue-600 rounded-2xl font-black text-sm shadow-lg hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center gap-2 group"
                                        >
                                            {loadingOrder ? (
                                                <div className="w-5 h-5 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                                            ) : (
                                                <>
                                                    <ChefHat className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                                                    MANDAR A COCINA
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* SAVED ITEMS (YA EN COCINA O SERVIDOS) */}
                            {order?.items?.length > 0 ? (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between px-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">En preparación / Servidos</p>
                                        <span className="text-[10px] font-bold text-slate-400">{order.items.length} items</span>
                                    </div>
                                    <div className="space-y-2">
                                        {order.items.map(item => {
                                            const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;
                                            const StatusIcon = config.icon;
                                            return (
                                                <div key={item.id} className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center justify-between group hover:border-slate-300 transition-colors shadow-sm">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-slate-700 text-sm truncate">{item.product_name}</p>
                                                        <div className="flex items-center gap-2 mt-2">
                                                            <span className="text-xs font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">x{item.quantity}</span>
                                                            <div className={cn("px-2 py-0.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 border", config.color)}>
                                                                <StatusIcon className="w-3 h-3" />
                                                                {config.label}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-black text-slate-800">${parseFloat(item.subtotal).toFixed(2)}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : cart.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center py-20 text-slate-300 text-center opacity-40">
                                    <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                                        <ShoppingBag className="w-10 h-10" />
                                    </div>
                                    <p className="font-bold text-sm">Mesa abierta sin consumos</p>
                                    <p className="text-xs">Usa el menú para añadir platos</p>
                                </div>
                            )}
                        </div>

                        {/* FINAL SUMMARY & ACTIONS */}
                        <footer className="p-6 bg-white border-t space-y-4">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-slate-400">
                                    <span className="text-xs font-bold uppercase">Subtotal</span>
                                    <span className="text-sm font-bold">${(Number(order?.total_amount || 0) + cart.reduce((acc, i) => acc + (Number(i.price || 0) * i.quantity), 0)).toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between border-t pt-3">
                                    <span className="text-sm font-black text-slate-800 uppercase tracking-tighter">Total a Cobrar</span>
                                    <span className="text-3xl font-black text-slate-900 tracking-tight">
                                        ${(Number(order?.total_amount || 0) + cart.reduce((acc, i) => acc + (Number(i.price || 0) * i.quantity), 0)).toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            {order && (
                                <div className="flex gap-3 pt-2">
                                    <button 
                                        onClick={() => setShowPaymentModal(true)}
                                        className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle className="w-5 h-5" />
                                        FINALIZAR Y COBRAR
                                    </button>
                                    <button className="p-4 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-colors">
                                        <Settings className="w-5 h-5" />
                                    </button>
                                </div>
                            )}
                        </footer>
                    </div>
                </main>

                {/* Shared Modals */}
                {showPaymentModal && order && (
                    <PaymentModal
                        isOpen={showPaymentModal}
                        onClose={() => setShowPaymentModal(false)}
                        totalUSD={parseFloat(order.total_amount)}
                        totalsByCurrency={{ USD: parseFloat(order.total_amount) }}
                        cart={order.items.map(i => ({
                            product_id: i.product_id,
                            quantity: i.quantity,
                            unit_price_usd: parseFloat(i.unit_price),
                            subtotal: parseFloat(i.subtotal),
                            product_name: i.product_name
                        }))}
                        onConfirm={async (saleData) => {
                            try {
                                await restaurantService.checkoutOrder(order.id, {
                                    client_id: saleData.customer?.id || 1,
                                    payment_method: saleData.payment_method || (saleData.isCreditSale ? "Credito" : "Efectivo"),
                                    payments: (saleData.payments || []).map(p => ({
                                        amount: parseFloat(p.amount),
                                        currency: p.currency === "$" ? "USD" : p.currency,
                                        payment_method: p.method,
                                        exchange_rate: 1 // Default
                                    })),
                                    exchange_rate: 1,
                                    currency: saleData.currency || "USD",
                                    total_amount_bs: 0,
                                    change_amount: saleData.changeUSD || 0,
                                    change_currency: "USD"
                                });
                                toast.success("Mesa facturada y liberada");
                                setShowPaymentModal(false);
                                onUpdate();
                                onClose();
                            } catch (err) {
                                toast.error("Error al procesar pago: " + (err.response?.data?.detail || err.message));
                            }
                        }}
                    />
                )}
            </div>
        </div>
    );
};

export default OrderPanel;
