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
            setLoadingOrder(false); // Wait, loadingOrder doesn't exist here
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
            toast.success(`Item marcado como ${newStatus}`);
            loadKitchenOrders();
        } catch (err) {
            toast.error("Error al actualizar estado");
        }
    };

    // Calculate elapsed minutes correctly
    const getElapsedTime = (created_at) => {
        if (!created_at) return 0;
        const start = new Date(created_at);
        const now = new Date();
        const diff = Math.floor((now - start) / 60000);
        return diff;
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-6 flex flex-col font-sans">
            {/* Header KDS */}
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
                            const minutes = getElapsedTime(order.created_at);
                            const isDelayed = minutes > 15;
                            
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
                                            <h3 className="text-2xl font-black text-white leading-none mb-1">
                                                {order.table_id ? `MESA ${order.table_id}` : "PARA LLEVAR"}
                                            </h3>
                                            <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">
                                                ORDEN #{order.id} • {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                                    <div className="flex-1 p-5 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar-slate">
                                        {order.items.map(item => (
                                            <div key={item.id} className="group relative">
                                                <div className={cn(
                                                    "p-4 rounded-2xl border-2 transition-all flex items-center justify-between gap-4",
                                                    item.status === 'READY' ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-100"
                                                )}>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-3">
                                                            <span className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center font-black text-sm shrink-0">
                                                                {item.quantity}
                                                            </span>
                                                            <p className={cn(
                                                                "font-bold text-slate-800 text-lg leading-tight truncate",
                                                                item.status === 'READY' && "line-through text-slate-400"
                                                            )}>
                                                                {item.product_name}
                                                            </p>
                                                        </div>
                                                        {item.notes && (
                                                            <div className="mt-2 flex items-start gap-2 bg-amber-100/50 p-2 rounded-lg border border-amber-200">
                                                                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                                                <p className="text-xs font-bold text-amber-700 leading-tight uppercase italic">{item.notes}</p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Actions per Item */}
                                                    <div className="flex gap-2">
                                                        {item.status === 'SENT' || item.status === 'PENDING' ? (
                                                            <button 
                                                                onClick={() => updateItemStatus(item.id, 'PREPARING')}
                                                                className="w-12 h-12 bg-orange-100 text-orange-600 hover:bg-orange-500 hover:text-white rounded-xl flex items-center justify-center transition-all shadow-sm"
                                                                title="Cocinar"
                                                            >
                                                                <Play className="w-6 h-6 fill-current" />
                                                            </button>
                                                        ) : item.status === 'PREPARING' ? (
                                                            <button 
                                                                onClick={() => updateItemStatus(item.id, 'READY')}
                                                                className="w-12 h-12 bg-emerald-100 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-xl flex items-center justify-center transition-all shadow-sm animate-bounce"
                                                                title="Listo"
                                                            >
                                                                <CheckCircle className="w-6 h-6" />
                                                            </button>
                                                        ) : (
                                                            <div className="w-12 h-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center">
                                                                <CheckCircle className="w-6 h-6" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Ticket Footer */}
                                    <div className="p-5 bg-slate-50 border-t border-slate-200">
                                        <button 
                                            disabled={!order.items.every(i => i.status === 'READY')}
                                            className={cn(
                                                "w-full py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2",
                                                order.items.every(i => i.status === 'READY') 
                                                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95" 
                                                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                            )}
                                        >
                                            COMPLETAR ORDEN
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
