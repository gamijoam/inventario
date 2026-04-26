import React, { useState, useEffect, useRef, useCallback } from 'react';
import kitchenService from '../../services/kitchenService';
import { Clock, CheckCircle, Flame, ChefHat, AlertTriangle, RefreshCw, Volume2, VolumeX, UtensilsCrossed } from 'lucide-react';
import toast from 'react-hot-toast';

const KitchenDisplay = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [now, setNow] = useState(new Date());
    const [soundEnabled, setSoundEnabled] = useState(true);
    const previousOrderCountRef = useRef(0);
    const audioRef = useRef(null);

    // Live timer — update "now" every second
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Sound alert
    const playAlert = useCallback(() => {
        if (!soundEnabled) return;
        try {
            // Use Web Audio API for a simple notification beep
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);
            // Second beep
            setTimeout(() => {
                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.frequency.value = 1100;
                osc2.type = 'sine';
                gain2.gain.setValueAtTime(0.3, ctx.currentTime);
                gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
                osc2.start(ctx.currentTime);
                osc2.stop(ctx.currentTime + 0.5);
            }, 300);
        } catch (e) {
            // Audio not supported
        }
    }, [soundEnabled]);

    const fetchOrders = useCallback(async () => {
        try {
            const data = await kitchenService.getPendingOrders();

            // Check for new orders
            const pendingItems = data.reduce((sum, o) => sum + o.items.filter(i => i.status === 'PENDING' || i.status === 'SENT').length, 0);
            if (pendingItems > previousOrderCountRef.current && previousOrderCountRef.current > 0) {
                playAlert();
                toast('🔔 ¡Nuevo pedido!', { icon: '🍳', style: { background: '#1e293b', color: '#fff' } });
            }
            previousOrderCountRef.current = pendingItems;

            setOrders(data);
            setLastUpdated(new Date());
            setLoading(false);
        } catch (error) {
            console.error("Error fetching kitchen orders:", error);
        }
    }, [playAlert]);

    // Polling every 5 seconds
    useEffect(() => {
        fetchOrders();
        const interval = setInterval(fetchOrders, 5000);
        return () => clearInterval(interval);
    }, [fetchOrders]);

    const handleStatusChange = async (itemId, newStatus) => {
        // Optimistic update
        setOrders(prev => prev.map(order => ({
            ...order,
            items: order.items.map(item =>
                item.id === itemId ? { ...item, status: newStatus } : item
            )
        })));

        try {
            await kitchenService.updateItemStatus(itemId, newStatus);
        } catch (error) {
            toast.error('Error actualizando estado');
            fetchOrders(); // Revert on error
        }
    };

    const getElapsedMinutes = (dateString) => {
        const start = new Date(dateString);
        return Math.floor((now - start) / 60000);
    };

    const getElapsedFormatted = (dateString) => {
        const start = new Date(dateString);
        const diffMs = now - start;
        const mins = Math.floor(diffMs / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        return `${mins}:${String(secs).padStart(2, '0')}`;
    };

    const getUrgencyLevel = (dateString) => {
        const mins = getElapsedMinutes(dateString);
        if (mins >= 20) return 'critical'; // Red pulsing
        if (mins >= 10) return 'warning';   // Orange
        return 'normal';                     // Green
    };

    const urgencyStyles = {
        normal: {
            border: 'border-slate-700',
            header: 'bg-slate-800',
            timer: 'text-emerald-400',
            timerBg: 'bg-emerald-500/10',
        },
        warning: {
            border: 'border-amber-500',
            header: 'bg-amber-900/40',
            timer: 'text-amber-400',
            timerBg: 'bg-amber-500/10',
        },
        critical: {
            border: 'border-red-500 animate-pulse',
            header: 'bg-red-900/50',
            timer: 'text-red-400',
            timerBg: 'bg-red-500/10',
        }
    };

    // Count stats
    const totalPending = orders.reduce((s, o) => s + o.items.filter(i => i.status === 'PENDING' || i.status === 'SENT').length, 0);
    const totalPreparing = orders.reduce((s, o) => s + o.items.filter(i => i.status === 'PREPARING').length, 0);
    const totalReady = orders.reduce((s, o) => s + o.items.filter(i => i.status === 'READY').length, 0);

    return (
        <div id="tour-restaurant-kitchen" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
            {/* Header */}
            <header className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                        <ChefHat size={28} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight">COCINA</h1>
                        <p className="text-xs text-slate-500">Kitchen Display System</p>
                    </div>
                </div>

                {/* Stats Bar */}
                <div className="flex items-center gap-6">
                    <div className="flex gap-3">
                        <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20">
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                            <span className="text-red-400 font-bold text-sm">{totalPending} Pendientes</span>
                        </div>
                        <div className="flex items-center gap-2 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20">
                            <Flame size={14} className="text-blue-400" />
                            <span className="text-blue-400 font-bold text-sm">{totalPreparing} Cocinando</span>
                        </div>
                        <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                            <CheckCircle size={14} className="text-emerald-400" />
                            <span className="text-emerald-400 font-bold text-sm">{totalReady} Listos</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-slate-500 text-xs">
                        <span>{lastUpdated.toLocaleTimeString()}</span>
                        <button
                            onClick={() => setSoundEnabled(!soundEnabled)}
                            className={`p-2 rounded-lg transition ${soundEnabled ? 'bg-slate-800 text-orange-400' : 'bg-slate-800 text-slate-600'}`}
                            title={soundEnabled ? 'Sonido activado' : 'Sonido desactivado'}
                        >
                            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                        </button>
                        <button
                            onClick={fetchOrders}
                            className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition text-slate-400"
                        >
                            <RefreshCw size={18} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 p-4 overflow-auto">
                {loading ? (
                    <div className="flex justify-center items-center h-96">
                        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-orange-500"></div>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-96 text-slate-600">
                        <UtensilsCrossed size={80} className="mb-4 opacity-30" />
                        <span className="text-2xl font-bold">Sin pedidos pendientes</span>
                        <span className="text-sm mt-1">Los pedidos aparecerán aquí automáticamente</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                        {orders.map(order => {
                            const urgency = getUrgencyLevel(order.created_at);
                            const style = urgencyStyles[urgency];
                            const activeItems = order.items.filter(i => i.status !== 'SERVED' && i.status !== 'CANCELLED');

                            if (activeItems.length === 0) return null;

                            return (
                                <div
                                    key={order.id}
                                    className={`flex flex-col rounded-xl overflow-hidden border-2 shadow-lg ${style.border} bg-slate-900`}
                                >
                                    {/* Card Header */}
                                    <div className={`px-4 py-3 flex justify-between items-center ${style.header}`}>
                                        <div>
                                            <h3 className="text-xl font-black text-white">
                                                {order.is_takeout ? (
                                                    <span className="text-orange-400">🥡 LLEVAR {order.customer_name ? `— ${order.customer_name}` : ''}</span>
                                                ) : (
                                                    <span>{order.table_name || `Mesa ${order.table_id}`}</span>
                                                )}
                                            </h3>
                                            <span className="text-[10px] text-slate-500 font-mono">#{order.id}</span>
                                        </div>
                                        <div className={`px-3 py-1.5 rounded-lg font-mono text-lg font-black flex items-center gap-1.5 ${style.timerBg} ${style.timer}`}>
                                            <Clock size={16} />
                                            {getElapsedFormatted(order.created_at)}
                                        </div>
                                    </div>

                                    {/* Items */}
                                    <div className="flex-1 p-3 space-y-2 overflow-y-auto max-h-[500px]">
                                        {activeItems.map(item => (
                                            <div key={item.id} className="bg-slate-800 rounded-lg p-3 space-y-2">
                                                <div className="flex justify-between items-start">
                                                    <span className="text-base font-bold text-white flex gap-2 items-center">
                                                        <span className="bg-slate-700 px-2.5 py-0.5 rounded-lg text-orange-300 font-black text-lg min-w-[32px] text-center">
                                                            {item.quantity}
                                                        </span>
                                                        <span className="leading-tight">{item.product_name}</span>
                                                    </span>
                                                </div>

                                                {item.modifiers && item.modifiers.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {item.modifiers.map(m => (
                                                            <span key={m.id} className="inline-flex items-center bg-orange-500/20 border border-orange-500/50 text-orange-300 text-xs font-black px-2 py-1 rounded-lg uppercase tracking-wide">
                                                                ⚡ {m.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {item.notes && (
                                                    <div className="bg-amber-950/50 text-amber-200 px-3 py-1.5 rounded-lg text-sm font-semibold border border-amber-800/50 flex items-start gap-1.5">
                                                        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                                        <span>{item.notes}</span>
                                                    </div>
                                                )}

                                                {/* Status Actions */}
                                                <div className="flex gap-2">
                                                    {(item.status === 'PENDING' || item.status === 'SENT') && (
                                                        <>
                                                            <button
                                                                onClick={() => handleStatusChange(item.id, 'PREPARING')}
                                                                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-lg font-black flex justify-center items-center gap-2 transition-all text-sm touch-manipulation"
                                                            >
                                                                <Flame size={18} /> COCINAR
                                                            </button>
                                                            <button
                                                                onClick={() => handleStatusChange(item.id, 'READY')}
                                                                className="py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-lg font-black flex justify-center items-center gap-1 transition-all text-sm touch-manipulation"
                                                            >
                                                                <CheckCircle size={18} />
                                                            </button>
                                                        </>
                                                    )}

                                                    {item.status === 'PREPARING' && (
                                                        <button
                                                            onClick={() => handleStatusChange(item.id, 'READY')}
                                                            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-lg font-black flex justify-center items-center gap-2 transition-all text-sm touch-manipulation"
                                                        >
                                                            <CheckCircle size={18} /> ¡LISTO!
                                                        </button>
                                                    )}

                                                    {item.status === 'READY' && (
                                                        <div className="flex-1 py-2.5 bg-emerald-900/30 text-emerald-400 text-center font-black border border-emerald-700/50 rounded-lg flex items-center justify-center gap-2">
                                                            <CheckCircle size={18} className="animate-bounce" /> PARA SERVIR
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
};

export default KitchenDisplay;
