import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChefHat, Clock, CheckCircle, Flame, UtensilsCrossed, AlertCircle, RefreshCw, Send, Play, Maximize2, Minimize2, X } from 'lucide-react';
import restaurantService from '../../services/restaurantService';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';

const KitchenDisplay = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [screenSize, setScreenSize] = useState({ width: window.innerWidth, height: window.innerHeight });
    const prevPendingCountRef = useRef(0);

    const playNewOrderSound = () => {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const now = audioCtx.currentTime;
            const playAlert = (freq, start, dur, vol = 0.4) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.frequency.value = freq;
                osc.type = 'sawtooth';
                gain.gain.setValueAtTime(vol, now + start);
                gain.gain.exponentialRampToValueAtTime(0.01, now + start + dur);
                osc.start(now + start);
                osc.stop(now + start + dur);
            };
            playAlert(800, 0, 0.15);
            playAlert(600, 0.12, 0.15);
            playAlert(800, 0.24, 0.4, 0.5);
        } catch {
            console.log('Audio not supported');
        }
    };

    const updateScreenSize = useCallback(() => {
        setScreenSize({ width: window.innerWidth, height: window.innerHeight });
    }, []);

    useEffect(() => {
        window.addEventListener('resize', updateScreenSize);
        return () => window.removeEventListener('resize', updateScreenSize);
    }, [updateScreenSize]);

    const getGridCols = () => {
        const w = screenSize.width;
        if (w >= 1920) return 6;
        if (w >= 1536) return 5;
        if (w >= 1280) return 4;
        if (w >= 1024) return 3;
        if (w >= 768) return 2;
        return 1;
    };

    const loadKitchenOrders = async () => {
        setLoading(true);
        try {
            const data = await restaurantService.getKitchenOrders();
            const sorted = data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

            const totalPending = sorted.reduce((acc, order) => {
                return acc + order.items.filter(i => i.status === 'PENDING' || i.status === 'SENT').length;
            }, 0);

            if (totalPending > prevPendingCountRef.current) {
                playNewOrderSound();
            }
            prevPendingCountRef.current = totalPending;

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

    const containerClass = isFullscreen
        ? "fixed inset-0 z-[9999] bg-slate-900 text-white flex flex-col font-sans"
        : "min-h-screen bg-slate-900 text-white flex flex-col font-sans";

    const orderCountClass = isFullscreen ? "text-5xl md:text-7xl font-black" : "text-3xl md:text-4xl font-black";

    const headerContent = (
        <header className="flex justify-between items-center px-4 py-1 bg-slate-800 border-b border-slate-700 shrink-0">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                    <ChefHat className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-bold text-slate-400 hidden md:inline">KDS</span>
            </div>

            {/* Centered big counter */}
            <div className="flex flex-col items-center">
                <span className={cn("text-emerald-400 leading-none", orderCountClass)}>
                    {orders.length}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {orders.length === 1 ? 'orden activa' : 'órdenes activas'}
                </span>
            </div>

            <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 hidden md:block">
                    {lastUpdated.toLocaleTimeString()}
                </span>
                <button
                    onClick={loadKitchenOrders}
                    className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-all active:scale-90"
                    title="Actualizar"
                >
                    <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                </button>
                <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className={cn(
                        "p-2 rounded-lg transition-all active:scale-90",
                        isFullscreen ? "bg-red-600 hover:bg-red-700" : "bg-slate-700 hover:bg-slate-600"
                    )}
                    title={isFullscreen ? "Salir de pantalla completa" : "Modo Tablet"}
                >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
            </div>
        </header>
    );

    return (
        <div id="tour-restaurant-kitchen" className={containerClass}>
            {/* Fullscreen header */}
            {isFullscreen ? (
                <div className="flex justify-between items-center px-4 py-2 bg-slate-800 border-b border-slate-700 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                            <ChefHat className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-lg font-black text-slate-300">COCINA</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-4xl md:text-6xl font-black text-emerald-400 leading-none">
                            {orders.length}
                        </span>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            {orders.length === 1 ? 'orden activa' : 'órdenes activas'}
                        </span>
                    </div>
                    <button
                        onClick={() => setIsFullscreen(false)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-xl font-black text-sm transition-all active:scale-95"
                    >
                        <X className="w-5 h-5" />
                        SALIR
                    </button>
                </div>
            ) : (
                headerContent
            )}

            {/* Orders Grid */}
            <div className="flex-1 overflow-y-auto no-scrollbar">
                {orders.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600">
                        <UtensilsCrossed className="w-24 h-24 mb-4 opacity-10" />
                        <h2 className="text-2xl font-black opacity-20">COCINA LIMPIA</h2>
                        <p className="text-sm font-bold opacity-20">No hay pedidos pendientes en este momento</p>
                    </div>
                ) : (
                    <div
                        className="grid gap-3 animate-in fade-in duration-500 p-2"
                        style={{ gridTemplateColumns: `repeat(${getGridCols()}, minmax(0, 1fr))` }}
                    >
                        {orders.map(order => {
                            const pendingItems = getPendingItems(order.items);
                            if (pendingItems.length === 0) return null;

                            const minutes = getElapsedTime(order.created_at);
                            const isDelayed = minutes > 15;
                            const allReady = pendingItems.every(i => i.status === 'READY');

                            return (
                                <div
                                    key={order.id}
                                    className={cn(
                                        "bg-white rounded-3xl overflow-hidden flex flex-col shadow-2xl border-2 transition-all",
                                        isDelayed ? "border-rose-500" : "border-transparent"
                                    )}
                                >
                                    {/* Ticket Header - FULL WIDTH */}
                                    <div className={cn(
                                        "px-5 py-4 flex justify-between items-center gap-3",
                                        isDelayed ? "bg-rose-500" : "bg-slate-800"
                                    )}>
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className={cn(
                                                "w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-black text-2xl leading-none shrink-0",
                                                isDelayed ? "bg-white text-rose-500" : "bg-slate-700 text-white"
                                            )}>
                                                <span className="text-[10px] font-bold opacity-60 uppercase">Mesa</span>
                                                <span>{order.table_id || '-'}</span>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xl font-black text-white leading-tight">Orden #{order.id}</p>
                                                {order.is_takeout && (
                                                    <p className="text-sm font-bold text-amber-400 mt-0.5">📦 Para Llevar</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Items List - NO HEIGHT LIMIT */}
                                    <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                                        {pendingItems.map(item => {
                                            const rawNotes = item.notes || '';
                                            const removedMatch = rawNotes.match(/\[(.*?)\]/);
                                            const removedIngredients = removedMatch ? removedMatch[1].split('|').map(s => s.trim()) : [];
                                            const chefNotes = rawNotes.replace(/\[.*?\]/, '').trim();

                                            return (
                                                <div key={item.id}>
                                                    <div className={cn(
                                                        "rounded-2xl border-2 overflow-hidden",
                                                        item.status === 'READY' ? "bg-emerald-50 border-emerald-300" : "bg-slate-50 border-slate-200"
                                                    )}>
                                                        {/* Item Header - BIG QUANTITY + NAME */}
                                                        <div className={cn(
                                                            "p-4 flex items-start gap-4",
                                                            item.status === 'READY' ? "bg-emerald-100/50" : "bg-slate-800"
                                                        )}>
                                                            <div className={cn(
                                                                "w-14 h-14 rounded-2xl flex items-center justify-center font-black text-3xl leading-none shrink-0",
                                                                item.status === 'READY'
                                                                    ? "bg-emerald-500 text-white"
                                                                    : item.status === 'PREPARING'
                                                                    ? "bg-orange-500 text-white"
                                                                    : "bg-slate-600 text-white"
                                                            )}>
                                                                {Number(item.quantity)}×
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className={cn(
                                                                    "font-black text-2xl text-white leading-tight break-words",
                                                                    item.status === 'READY' && "opacity-50 line-through"
                                                                )}>
                                                                    {item.product_name}
                                                                </p>
                                                                <div className="mt-1">
                                                                    {item.status === 'PREPARING' && (
                                                                        <span className="text-xs font-black text-orange-300 bg-orange-900/30 px-2 py-0.5 rounded uppercase tracking-wider">Preparando...</span>
                                                                    )}
                                                                    {item.status === 'READY' && (
                                                                        <span className="text-xs font-black text-emerald-300 bg-emerald-900/30 px-2 py-0.5 rounded uppercase tracking-wider">Listo!</span>
                                                                    )}
                                                                    {item.status === 'PENDING' && (
                                                                        <span className="text-xs font-black text-slate-400 bg-slate-700 px-2 py-0.5 rounded uppercase tracking-wider">Recibido</span>
                                                                    )}
                                                                    {item.status === 'SENT' && (
                                                                        <span className="text-xs font-black text-slate-400 bg-slate-700 px-2 py-0.5 rounded uppercase tracking-wider">Enviado</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Removed Ingredients - RED */}
                                                        {removedIngredients.length > 0 && (
                                                            <div className="px-4 py-3 bg-red-50 border-t-2 border-red-200">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <div className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0">
                                                                        <span className="text-[10px] font-black">✕</span>
                                                                    </div>
                                                                    <span className="text-xs font-black text-red-600 uppercase tracking-wider">Ingredientes Removidos</span>
                                                                </div>
                                                                <div className="flex flex-wrap gap-1.5 ml-8">
                                                                    {removedIngredients.map((ing, idx) => (
                                                                        <span key={idx} className="text-sm font-black text-red-700 bg-red-100 px-3 py-1 rounded-xl uppercase">
                                                                            {ing}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Chef Notes - AMBER */}
                                                        {chefNotes && (
                                                            <div className="px-4 py-3 bg-amber-50 border-t border-amber-200">
                                                                <div className="flex items-start gap-2">
                                                                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                                                    <p className="text-sm font-bold text-amber-800 leading-snug">{chefNotes}</p>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Action Button - LARGE TOUCH TARGET */}
                                                        <div className="p-2 bg-white border-t border-slate-100">
                                                            {item.status === 'SENT' || item.status === 'PENDING' ? (
                                                                <button
                                                                    onClick={() => updateItemStatus(item.id, 'PREPARING')}
                                                                    className="w-full py-4 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] transition-all text-white rounded-xl font-black text-base flex items-center justify-center gap-3"
                                                                >
                                                                    <Play className="w-6 h-6 fill-current" />
                                                                    INICIAR
                                                                </button>
                                                            ) : item.status === 'PREPARING' ? (
                                                                <button
                                                                    onClick={() => updateItemStatus(item.id, 'READY')}
                                                                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] transition-all text-white rounded-xl font-black text-base flex items-center justify-center gap-3 animate-pulse"
                                                                >
                                                                    <CheckCircle className="w-6 h-6" />
                                                                    LISTO
                                                                </button>
                                                            ) : (
                                                                <div className="w-full py-4 bg-emerald-500 text-white rounded-xl font-black text-base flex items-center justify-center gap-3">
                                                                    <CheckCircle className="w-6 h-6" />
                                                                    LISTO
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Ticket Footer */}
                                    <div className="p-3 bg-slate-100 border-t border-slate-200">
                                        <button
                                            onClick={() => handleCompleteOrder(order.id, pendingItems)}
                                            disabled={!allReady}
                                            className={cn(
                                                "w-full py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-3",
                                                allReady
                                                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95"
                                                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                            )}
                                        >
                                            <UtensilsCrossed className="w-5 h-5" />
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
