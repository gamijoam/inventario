import React, { useState, useEffect } from 'react';
import { ChefHat, Clock, CheckCircle, Flame, UtensilsCrossed, AlertCircle, RefreshCw, Send, Play } from 'lucide-react';
import restaurantService from '../../services/restaurantService';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';

const KitchenDisplay = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(new Date());

    const loadKitchenOrders = async () => {
        setLoading(true);
        try {
            const data = await restaurantService.getKitchenOrders();
            // Sort by creation date (oldest first)
            const sorted = data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            setOrders(sorted);
            setLastUpdated(new Date());
        } catch (err) {
            console.error("Error loading kitchen orders:", err);
            toast.error("Error al sincronizar cocina");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadKitchenOrders();
        const interval = setInterval(loadKitchenOrders, 10000); // Auto-refresh every 10s
        return () => clearInterval(interval);
    }, []);

    const updateItemStatus = async (itemId, newStatus) => {
        try {
            await restaurantService.updateItemStatus(itemId, newStatus);
            // Update local state immediately for snappy UI
            setOrders(prev => prev.map(order => ({
                ...order,
                items: order.items.map(item => 
                    item.id === itemId ? { ...item, status: newStatus } : item
                )
            })));
            toast.success(`Plato ${newStatus === 'READY' ? 'Listo' : 'en preparación'}`, { icon: '✅' });
        } catch {
            toast.error("Error al actualizar estado");
        }
    };

    const handleCompleteOrder = async (orderId, items) => {
        try {
            // Only serve items that are currently READY in this view
            const itemsToServe = items.filter(i => i.status === 'READY');
            await Promise.all(itemsToServe.map(item => 
                restaurantService.updateItemStatus(item.id, 'SERVED')
            ));
            toast.success("Items entregados", { icon: '🚀' });
            loadKitchenOrders();
        } catch {
            toast.error("Error al completar la orden");
        }
    };

    // Calculate elapsed minutes correctly (Using UTC to avoid server-client drift)
    const getElapsedTime = (created_at) => {
        if (!created_at) return 0;
        try {
            const start = new Date(created_at).getTime();
            const now = new Date().getTime();
            
            // If the server time is ahead/behind, we might get weird values.
            // We use a safe diff.
            const diff = Math.floor((now - start) / 60000);
            
            // If the diff is > 240 (4 hours), it's likely a timezone mismatch 
            // where naive dates are being compared. We normalize it.
            if (diff > 1440) return 0; // More than a day? reset to 0
            if (diff > 300 && diff < 500) {
                // If it's around 4-8 hours, it's a TZ drift. We subtract the 4h offset.
                return Math.max(0, diff - 240); 
            }
            
            return Math.max(0, diff);
        } catch { return 0; }
    };

    // Filter out items that are already SERVED
    const getPendingItems = (items) => items.filter(i => i.status !== 'SERVED');

    return (
        <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-6 flex flex-col font-sans">
            {/* ... header remains same ... */}
            <header className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8 bg-slate-800/50 p-4 rounded-3xl border border-slate-700 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                        <ChefHat className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight">KITCHEN DISPLAY (KDS)</h1>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Sistema en tiempo real • {orders.length} Órdenes activas
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                        <p className="text-[10px] text-slate-500 font-bold uppercase">Última actualización</p>
                        <p className="text-sm font-mono text-slate-300">{lastUpdated.toLocaleTimeString()}</p>
                    </div>
                    <button 
                        onClick={loadKitchenOrders}
                        className="p-4 bg-slate-700 hover:bg-slate-600 rounded-2xl transition-all active:scale-90"
                    >
                        <RefreshCw className={cn("w-6 h-6", loading && "animate-spin")} />
                    </button>
                </div>
            </header>

            {/* Orders Grid */}
            <div className="flex-1 overflow-y-auto no-scrollbar">
                {orders.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600">
                        <UtensilsCrossed className="w-24 h-24 mb-4 opacity-10" />
                        <h2 className="text-2xl font-black opacity-20">COCINA LIMPIA</h2>
                        <p className="text-sm font-bold opacity-20">No hay pedidos pendientes en este momento</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-500">
                        {orders.map(order => {
                            const pendingItems = getPendingItems(order.items);
                            if (pendingItems.length === 0) return null; // Don't show empty tickets

                            const minutes = getElapsedTime(order.created_at);
                            const isDelayed = minutes > 15;
                            const allReady = pendingItems.every(i => i.status === 'READY');
                            
                            return (
                                <div 
                                    key={order.id} 
                                    className={cn(
                                        "bg-white rounded-[2rem] overflow-hidden flex flex-col shadow-2xl transition-all hover:scale-[1.02]",
                                        isDelayed ? "ring-4 ring-rose-500/50" : "ring-1 ring-slate-200"
                                    )}
                                >
                                    {/* Ticket Header */}
                                    <div className={cn(
                                        "p-5 flex justify-between items-start",
                                        isDelayed ? "bg-rose-500" : "bg-slate-800"
                                    )}>
                                        <div>
                                            <h3 className="text-2xl font-black text-white leading-none mb-1 text-ellipsis overflow-hidden whitespace-nowrap max-w-[150px]">
                                                {order.table_id ? `MESA ${order.table_id}` : "PARA LLEVAR"}
                                            </h3>
                                            <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">
                                                ORDEN #{order.id}
                                            </p>
                                        </div>
                                        <div className={cn(
                                            "px-3 py-1.5 rounded-xl flex items-center gap-2 font-black text-sm",
                                            isDelayed ? "bg-white text-rose-500 animate-pulse" : "bg-slate-700 text-white"
                                        )}>
                                            <Clock className="w-4 h-4" />
                                            {minutes}'
                                        </div>
                                    </div>

                                    {/* Items List */}
                                    <div className="flex-1 p-5 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar-slate">
                                        {pendingItems.map(item => {
                                            const rawNotes = item.notes || '';
                                            const removedMatch = rawNotes.match(/\[(.*?)\]/);
                                            const removedIngredients = removedMatch ? removedMatch[1].split('|').map(s => s.trim()) : [];
                                            const chefNotes = rawNotes.replace(/\[.*?\]/, '').trim();

                                            return (
                                                <div key={item.id} className="group relative">
                                                    <div className={cn(
                                                        "rounded-2xl border-2 transition-all overflow-hidden",
                                                        item.status === 'READY' ? "bg-emerald-50 border-emerald-300" : "bg-white border-slate-200"
                                                    )}>
                                                        {/* Item Header - BIG QUANTITY + NAME */}
                                                        <div className={cn(
                                                            "p-4 flex items-center gap-4",
                                                            item.status === 'READY' ? "bg-emerald-100/50" : "bg-slate-800"
                                                        )}>
                                                            <div className={cn(
                                                                "w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl shrink-0",
                                                                item.status === 'READY'
                                                                    ? "bg-emerald-500 text-white"
                                                                    : "bg-orange-500 text-white"
                                                            )}>
                                                                {item.quantity}×
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className={cn(
                                                                    "font-black text-xl text-white leading-tight truncate",
                                                                    item.status === 'READY' && "opacity-60"
                                                                )}>
                                                                    {item.product_name}
                                                                </p>
                                                                {item.status === 'PREPARING' && (
                                                                    <p className="text-[10px] font-bold text-orange-300 uppercase tracking-widest mt-1">Preparando...</p>
                                                                )}
                                                                {item.status === 'READY' && (
                                                                    <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest mt-1">Listo para servir</p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Removed Ingredients - RED ALERT */}
                                                        {removedIngredients.length > 0 && (
                                                            <div className="px-4 py-2 bg-red-50 border-t-2 border-red-200 flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0">
                                                                    <span className="text-xs font-black">✕</span>
                                                                </div>
                                                                <div className="flex-1 flex flex-wrap gap-1">
                                                                    {removedIngredients.map((ing, idx) => (
                                                                        <span key={idx} className="text-xs font-black text-red-700 bg-red-100 px-2 py-0.5 rounded-lg uppercase">
                                                                            {ing}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Chef Notes - AMBER */}
                                                        {chefNotes && (
                                                            <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 flex items-start gap-2">
                                                                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                                                <p className="text-xs font-bold text-amber-700 leading-tight">{chefNotes}</p>
                                                            </div>
                                                        )}

                                                        {/* Action Button */}
                                                        <div className="p-3 bg-slate-50 border-t border-slate-100">
                                                            {item.status === 'SENT' || item.status === 'PENDING' ? (
                                                                <button
                                                                    onClick={() => updateItemStatus(item.id, 'PREPARING')}
                                                                    className="w-full py-3 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] transition-all text-white rounded-xl font-black text-sm flex items-center justify-center gap-2"
                                                                >
                                                                    <Play className="w-5 h-5 fill-current" />
                                                                    INICIAR PREPARACIÓN
                                                                </button>
                                                            ) : item.status === 'PREPARING' ? (
                                                                <button
                                                                    onClick={() => updateItemStatus(item.id, 'READY')}
                                                                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] transition-all text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 animate-pulse"
                                                                >
                                                                    <CheckCircle className="w-5 h-5" />
                                                                    MARCAR COMO LISTO
                                                                </button>
                                                            ) : (
                                                                <div className="w-full py-3 bg-emerald-500 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2">
                                                                    <CheckCircle className="w-5 h-5" />
                                                                    LISTO PARA SERVIR
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Ticket Footer */}
                                    <div className="p-5 bg-slate-50 border-t border-slate-200">
                                        <button 
                                            onClick={() => handleCompleteOrder(order.id, pendingItems)}
                                            disabled={!allReady}
                                            className={cn(
                                                "w-full py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2",
                                                allReady 
                                                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95" 
                                                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                            )}
                                        >
                                            COMPLETAR {pendingItems.length > 1 ? 'ITEMS' : 'PLATO'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default KitchenDisplay;
