import React, { useState, useEffect, useCallback } from 'react';
import {
    ChefHat, Clock, CheckCircle, Flame, UtensilsCrossed,
    RefreshCw, Send, Play, Bell, MapPin, DollarSign,
    ShoppingBag, ArrowRightLeft, LogOut, Plus, Minus,
    CreditCard, Receipt, AlertCircle, X, Maximize2, Minimize2
} from 'lucide-react';
import restaurantService from '../../services/restaurantService';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import OrderPanel from './components/OrderPanel';

const TABS = {
    READY: 'ready',
    TABLES: 'tables',
    ACTIONS: 'actions'
};

const WaiterStation = () => {
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState(TABS.READY);
    const [readyItems, setReadyItems] = useState([]);
    const [myTables, setMyTables] = useState([]);
    const [availableTables, setAvailableTables] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedTable, setSelectedTable] = useState(null);
    const [showOrderPanel, setShowOrderPanel] = useState(false);
    const [showOpenTableModal, setShowOpenTableModal] = useState(false);
    const [showTakeoutModal, setShowTakeoutModal] = useState(false);
    const [takeoutName, setTakeoutName] = useState('');
    const [openingTable, setOpeningTable] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferFromTable, setTransferFromTable] = useState(null);
    const [transferTargetTable, setTransferTargetTable] = useState(null);
    const [transferring, setTransferring] = useState(false);
    const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
    const [closingShift, setClosingShift] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [screenSize, setScreenSize] = useState({ width: window.innerWidth, height: window.innerHeight });

    const updateScreenSize = useCallback(() => {
        setScreenSize({ width: window.innerWidth, height: window.innerHeight });
    }, []);

    useEffect(() => {
        window.addEventListener('resize', updateScreenSize);
        return () => window.removeEventListener('resize', updateScreenSize);
    }, [updateScreenSize]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [kitchenOrders, tables] = await Promise.all([
                restaurantService.getKitchenOrders(),
                restaurantService.getTables()
            ]);

            const allReadyItems = [];
            kitchenOrders.forEach(order => {
                order.items.forEach(item => {
                    if (item.status === 'READY') {
                        allReadyItems.push({
                            ...item,
                            order_id: order.id,
                            table_id: order.table_id,
                            order_created_at: order.created_at
                        });
                    }
                });
            });

            const myActiveTables = tables.filter(t =>
                t.status === 'OCCUPIED' && t.current_order_id
            );
            const availTables = tables.filter(t => t.status === 'AVAILABLE');

            setReadyItems(allReadyItems);
            setMyTables(myActiveTables);
            setAvailableTables(availTables);
        } catch (err) {
            console.error("Error loading data:", err);
            toast.error("Error al sincronizar");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 5000);
        return () => clearInterval(interval);
    }, [loadData]);

    const handleDeliverItem = async (itemId) => {
        try {
            await restaurantService.updateItemStatus(itemId, 'SERVED');
            setReadyItems(prev => prev.filter(item => item.id !== itemId));
            toast.success("Entregado", { icon: '✅' });
        } catch (err) {
            const msg = err.response?.data?.detail || "Error al marcar como entregado";
            toast.error(msg);
        }
    };

    const getElapsedTime = (created_at) => {
        if (!created_at) return '0m';
        try {
            const start = new Date(created_at).getTime();
            const diff = Math.floor((new Date().getTime() - start) / 60000);
            if (diff < 60) return `${diff}m`;
            const h = Math.floor(diff / 60);
            const m = diff % 60;
            return `${h}h ${m}m`;
        } catch { return '0m' }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-VE', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(amount || 0);
    };

    const handlePrecheck = async (orderId) => {
        try {
            await restaurantService.printPreCheck(orderId);
            toast.success("Pre-cuenta enviada a impresión");
        } catch {
            toast.error("Error al imprimir pre-cuenta");
        }
    };

    const handleOpenTable = async (tableId) => {
        setOpeningTable(true);
        try {
            await restaurantService.openTable(tableId);
            toast.success("Mesa abierta");
            setShowOpenTableModal(false);
            loadData();
        } catch (err) {
            const msg = err.response?.data?.detail || "Error al abrir mesa";
            toast.error(msg);
        } finally {
            setOpeningTable(false);
        }
    };

    const handleOpenTakeout = async () => {
        setOpeningTable(true);
        try {
            const order = await restaurantService.openTakeout(takeoutName || null);
            toast.success("Orden para llevar creada");
            setShowTakeoutModal(false);
            setTakeoutName('');
            setSelectedTable({ id: order.table_id || order.id, status: 'TAKEOUT', current_order_id: order.id, name: takeoutName || 'Para Llevar' });
            setShowOrderPanel(true);
        } catch (err) {
            const msg = err?.response?.data?.detail || "Error al crear orden";
            toast.error(msg);
        } finally {
            setOpeningTable(false);
        }
    };

    const handleTransferStep1 = (table) => {
        setTransferFromTable(table);
        setTransferTargetTable(null);
        setShowTransferModal(true);
    };

    const handleTransferStep2 = async () => {
        if (!transferFromTable || !transferTargetTable) return;
        setTransferring(true);
        try {
            await restaurantService.moveOrder(transferFromTable.current_order_id, transferTargetTable.id);
            toast.success(`Mesa transferida a ${transferTargetTable.name}`);
            setShowTransferModal(false);
            setTransferFromTable(null);
            setTransferTargetTable(null);
            loadData();
        } catch (err) {
            const msg = err?.response?.data?.detail || "Error al transferir";
            toast.error(msg);
        } finally {
            setTransferring(false);
        }
    };

    const handleCloseShift = async () => {
        setClosingShift(true);
        try {
            setShowCloseShiftModal(false);
            await logout();
        } catch {
            setClosingShift(false);
        }
    };

    const containerClass = isFullscreen
        ? "fixed inset-0 z-[9999] bg-slate-900 text-white flex flex-col font-sans"
        : "min-h-screen bg-slate-900 text-white flex flex-col font-sans";

    const orderCountClass = isFullscreen ? "text-5xl md:text-7xl font-black" : "text-3xl md:text-4xl font-black";

    const getGridCols = () => {
        if (!isFullscreen) return 1;
        const w = screenSize.width;
        if (w >= 1920) return 4;
        if (w >= 1280) return 3;
        if (w >= 768) return 2;
        return 1;
    };

    return (
        <div className={containerClass}>
            {/* Fullscreen header */}
            {isFullscreen ? (
                <div className="flex justify-between items-center px-4 py-2 bg-slate-800 border-b border-slate-700 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
                            <UtensilsCrossed className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-lg font-black text-slate-300">COCINA</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-4xl md:text-6xl font-black text-emerald-400 leading-none">
                            {readyItems.length}
                        </span>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            {readyItems.length === 1 ? 'plato listo' : 'platos listos'}
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
                <header className="bg-slate-800 px-4 py-1 flex items-center justify-between border-b border-slate-700 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                            <UtensilsCrossed className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-sm font-bold text-slate-400 hidden md:inline">COMANDER</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className={cn("text-emerald-400 leading-none", orderCountClass)}>
                            {readyItems.length}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {readyItems.length === 1 ? 'listo' : 'listos'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={loadData}
                            className={cn(
                                "p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-all active:scale-90",
                                loading && "animate-spin"
                            )}
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-all active:scale-90"
                            title="Modo Tablet"
                        >
                            <Maximize2 className="w-4 h-4" />
                        </button>
                    </div>
                </header>
            )}

            {/* Tab Navigation */}
            <nav className="flex bg-slate-800 border-b border-slate-700 shrink-0">
                <button
                    onClick={() => setActiveTab(TABS.READY)}
                    className={cn(
                        "flex-1 py-3 md:py-4 px-2 flex flex-col items-center gap-1 transition-all border-b-2 relative",
                        activeTab === TABS.READY
                            ? "border-emerald-500 text-emerald-400"
                            : "border-transparent text-slate-400 hover:text-white"
                    )}
                >
                    <Bell className="w-5 h-5 md:w-6 md:h-6" />
                    <span className="text-xs font-bold">LISTOS</span>
                    {readyItems.length > 0 && (
                        <span className="absolute top-1 right-1/4 w-6 h-6 bg-red-500 rounded-full text-[10px] font-black flex items-center justify-center">
                            {readyItems.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab(TABS.TABLES)}
                    className={cn(
                        "flex-1 py-3 md:py-4 px-2 flex flex-col items-center gap-1 transition-all border-b-2",
                        activeTab === TABS.TABLES
                            ? "border-emerald-500 text-emerald-400"
                            : "border-transparent text-slate-400 hover:text-white"
                    )}
                >
                    <MapPin className="w-5 h-5 md:w-6 md:h-6" />
                    <span className="text-xs font-bold">MIS MESAS</span>
                    <span className="text-[10px] text-slate-500">{myTables.length}</span>
                </button>
                <button
                    onClick={() => setActiveTab(TABS.ACTIONS)}
                    className={cn(
                        "flex-1 py-3 md:py-4 px-2 flex flex-col items-center gap-1 transition-all border-b-2",
                        activeTab === TABS.ACTIONS
                            ? "border-emerald-500 text-emerald-400"
                            : "border-transparent text-slate-400 hover:text-white"
                    )}
                >
                    <DollarSign className="w-5 h-5 md:w-6 md:h-6" />
                    <span className="text-xs font-bold">ACCIONES</span>
                </button>
            </nav>

            {/* Content Area */}
            <main className={cn("flex-1 overflow-y-auto", isFullscreen ? "p-3" : "p-3 pb-20")}>
                {loading && readyItems.length === 0 && myTables.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500">
                        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
                        <p className="text-sm font-medium">Sincronizando...</p>
                    </div>
                ) : (
                    <>
                        {/* READY ITEMS VIEW */}
                        {activeTab === TABS.READY && (
                            <div className={cn(
                                "space-y-3",
                                isFullscreen && "grid gap-4",
                                isFullscreen && getGridCols() > 1 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                            )}>
                                {readyItems.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                                        <CheckCircle className="w-20 h-20 mb-4 opacity-20" />
                                        <p className="text-2xl font-bold opacity-30">Todo servido</p>
                                        <p className="text-sm opacity-30 mt-1">No hay platos listos para entregar</p>
                                    </div>
                                ) : (
                                    readyItems.map(item => (
                                        <div
                                            key={`${item.order_id}-${item.id}`}
                                            className="bg-white rounded-2xl overflow-hidden shadow-lg"
                                        >
                                            <div className="p-4 md:p-5 bg-emerald-500 text-white flex items-start justify-between gap-4">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                                                        <span className="text-2xl font-black">{Number(item.quantity)}</span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-black text-lg md:text-xl truncate">{item.product_name}</p>
                                                        <p className="text-xs opacity-80">
                                                            Mesa {item.table_id || item.order_id} • {getElapsedTime(item.order_created_at)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {item.notes && (
                                                <div className="px-4 py-3 bg-amber-50 flex items-start gap-2 border-t border-amber-100">
                                                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                                    <p className="text-sm font-bold text-amber-700">{item.notes}</p>
                                                </div>
                                            )}

                                            <button
                                                onClick={() => handleDeliverItem(item.id)}
                                                className="w-full py-4 md:py-5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all text-white font-black text-base md:text-lg flex items-center justify-center gap-3"
                                            >
                                                <CheckCircle className="w-6 h-6" />
                                                ENTREGAR
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* MY TABLES VIEW */}
                        {activeTab === TABS.TABLES && (
                            <div className={cn(
                                "space-y-3",
                                isFullscreen && getGridCols() > 1 && "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                            )}>
                                {myTables.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                                        <MapPin className="w-20 h-20 mb-4 opacity-20" />
                                        <p className="text-2xl font-bold opacity-30">Sin mesas activas</p>
                                        <p className="text-sm opacity-30 mt-1">No tienes mesas abiertas</p>
                                    </div>
                                ) : (
                                    myTables.map(table => (
                                        <div
                                            key={table.id}
                                            className="bg-white rounded-2xl overflow-hidden"
                                        >
                                            <div className="p-4 md:p-5 flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-16 h-16 bg-red-500 rounded-2xl flex items-center justify-center text-white font-black text-2xl shrink-0">
                                                        {table.name}
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-xl md:text-2xl text-slate-800">Mesa {table.name}</p>
                                                        <p className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                                                            <Clock className="w-4 h-4" />
                                                            {table.current_order_time ? getElapsedTime(table.current_order_time) : '0m'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-2xl md:text-3xl font-black text-emerald-600">
                                                        {formatCurrency(table.current_order_total)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex border-t border-slate-200">
                                                <button
                                                    onClick={() => handlePrecheck(table.current_order_id)}
                                                    className="flex-1 py-4 flex items-center justify-center gap-2 text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition-all font-bold text-sm md:text-base"
                                                >
                                                    <Receipt className="w-5 h-5" />
                                                    PRE-CUENTA
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setSelectedTable(table);
                                                        setShowOrderPanel(true);
                                                    }}
                                                    className="flex-1 py-4 flex items-center justify-center gap-2 bg-emerald-500 text-white hover:bg-emerald-600 active:scale-[0.98] transition-all font-bold text-sm md:text-base"
                                                >
                                                    <CreditCard className="w-5 h-5" />
                                                    TOMAR PEDIDO
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* ACTIONS VIEW */}
                        {activeTab === TABS.ACTIONS && (
                            <div className="space-y-4 max-w-3xl mx-auto">
                                <div className="bg-white rounded-2xl p-4 md:p-6">
                                    <h3 className="text-base font-bold text-slate-500 uppercase mb-4">Acciones Rápidas</h3>
                                    <div className={cn(
                                        "gap-3",
                                        isFullscreen ? "grid grid-cols-2 md:grid-cols-4" : "grid grid-cols-2"
                                    )}>
                                        <button
                                            onClick={() => setShowOpenTableModal(true)}
                                            className="py-5 bg-slate-100 rounded-2xl flex flex-col items-center gap-3 text-slate-700 active:scale-95 transition-all"
                                        >
                                            <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center">
                                                <Plus className="w-6 h-6 text-white" />
                                            </div>
                                            <span className="text-sm font-bold">Abrir Mesa</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (myTables.length === 0) {
                                                    toast.error("No tienes mesas para transferir");
                                                    return;
                                                }
                                                handleTransferStep1(myTables[0]);
                                            }}
                                            className="py-5 bg-slate-100 rounded-2xl flex flex-col items-center gap-3 text-slate-700 active:scale-95 transition-all"
                                        >
                                            <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                                                <ArrowRightLeft className="w-6 h-6 text-white" />
                                            </div>
                                            <span className="text-sm font-bold">Transferir</span>
                                        </button>
                                        <button
                                            onClick={() => setShowTakeoutModal(true)}
                                            className="py-5 bg-slate-100 rounded-2xl flex flex-col items-center gap-3 text-slate-700 active:scale-95 transition-all"
                                        >
                                            <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center">
                                                <ShoppingBag className="w-6 h-6 text-white" />
                                            </div>
                                            <span className="text-sm font-bold">Para Llevar</span>
                                        </button>
                                        <button
                                            onClick={() => setShowCloseShiftModal(true)}
                                            className="py-5 bg-slate-100 rounded-2xl flex flex-col items-center gap-3 text-slate-700 active:scale-95 transition-all"
                                        >
                                            <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center">
                                                <LogOut className="w-6 h-6 text-white" />
                                            </div>
                                            <span className="text-sm font-bold">Cerrar Turno</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-white rounded-2xl p-4 md:p-6">
                                    <h3 className="text-base font-bold text-slate-500 uppercase mb-4">Mi Turno</h3>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-base text-slate-600">Mesero</span>
                                            <span className="text-base font-bold text-slate-800">{user?.full_name || 'Usuario'}</span>
                                        </div>
                                        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                                            <span className="text-base text-slate-600">Mesas atendidas</span>
                                            <span className="text-base font-bold text-emerald-600">{myTables.length}</span>
                                        </div>
                                        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                                            <span className="text-base text-slate-600">Platos servidos</span>
                                            <span className="text-base font-bold text-emerald-600">{readyItems.length}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>

            {/* Bottom Status Bar - only in normal mode */}
            {!isFullscreen && (
                <div className="fixed bottom-0 left-0 right-0 bg-emerald-600 text-white py-2 px-4 flex items-center justify-between max-w-[600px] mx-auto">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        <span className="text-xs font-medium">En línea</span>
                    </div>
                    <span className="text-xs font-medium">
                        {readyItems.length} listos • {myTables.length} mesas
                    </span>
                </div>
            )}

            {/* OrderPanel Modal */}
            {showOrderPanel && selectedTable && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="w-full max-w-lg max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl">
                        <OrderPanel
                            table={selectedTable}
                            onClose={() => {
                                setShowOrderPanel(false);
                                setSelectedTable(null);
                            }}
                            onUpdate={loadData}
                        />
                    </div>
                </div>
            )}

            {/* Abrir Mesa Modal */}
            {showOpenTableModal && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-2xl">
                        <div className="p-4 bg-emerald-500 text-white flex items-center justify-between">
                            <h2 className="text-lg font-black">Abrir Mesa</h2>
                            <button
                                onClick={() => setShowOpenTableModal(false)}
                                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-4">
                            {availableTables.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">
                                    <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                    <p className="font-bold">No hay mesas disponibles</p>
                                    <p className="text-xs mt-1">Todas las mesas están ocupadas</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-3">
                                    {availableTables.map(table => (
                                        <button
                                            key={table.id}
                                            onClick={() => handleOpenTable(table.id)}
                                            disabled={openingTable}
                                            className={cn(
                                                "aspect-square rounded-xl flex flex-col items-center justify-center gap-1 text-white font-black text-xl transition-all active:scale-95",
                                                openingTable ? "bg-slate-400 cursor-not-allowed" : "bg-emerald-500 hover:bg-emerald-600"
                                            )}
                                        >
                                            <MapPin className="w-6 h-6" />
                                            {table.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {openingTable && (
                            <div className="p-4 text-center text-sm text-slate-500">
                                Abriendo mesa...
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Para Llevar Modal */}
            {showTakeoutModal && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-2xl">
                        <div className="p-4 bg-amber-500 text-white flex items-center justify-between">
                            <h2 className="text-lg font-black">Para Llevar</h2>
                            <button
                                onClick={() => {
                                    setShowTakeoutModal(false);
                                    setTakeoutName('');
                                }}
                                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                                    Nombre del cliente (opcional)
                                </label>
                                <input
                                    type="text"
                                    value={takeoutName}
                                    onChange={(e) => setTakeoutName(e.target.value)}
                                    placeholder="Ej: Juan Pérez"
                                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-slate-800 font-medium focus:border-amber-500 focus:outline-none transition-colors"
                                />
                            </div>
                            <button
                                onClick={handleOpenTakeout}
                                disabled={openingTable}
                                className={cn(
                                    "w-full py-4 rounded-xl font-black text-white text-sm transition-all active:scale-[0.98]",
                                    openingTable
                                        ? "bg-slate-400 cursor-not-allowed"
                                        : "bg-amber-500 hover:bg-amber-600"
                                )}
                            >
                                {openingTable ? 'Creando...' : 'CREAR ORDEN'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Transferir Modal */}
            {showTransferModal && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-2xl">
                        <div className="p-4 bg-blue-500 text-white flex items-center justify-between">
                            <h2 className="text-lg font-black">Transferir Mesa</h2>
                            <button
                                onClick={() => {
                                    setShowTransferModal(false);
                                    setTransferFromTable(null);
                                    setTransferTargetTable(null);
                                }}
                                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        {!transferTargetTable ? (
                            <>
                                <div className="p-4">
                                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Mesa de origen</p>
                                    <div className="flex items-center gap-3 p-3 bg-slate-100 rounded-xl mb-4">
                                        <MapPin className="w-5 h-5 text-slate-500" />
                                        <span className="font-black text-slate-800">{transferFromTable?.name}</span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Selecciona mesa destino</p>
                                    {availableTables.length === 0 ? (
                                        <div className="text-center py-6 text-slate-400">
                                            <p className="text-sm font-bold">No hay mesas disponibles</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-3 gap-2">
                                            {availableTables.map(table => (
                                                <button
                                                    key={table.id}
                                                    onClick={() => setTransferTargetTable(table)}
                                                    className="aspect-square rounded-xl bg-blue-500 hover:bg-blue-600 text-white flex flex-col items-center justify-center gap-1 font-black text-lg transition-all active:scale-95"
                                                >
                                                    <MapPin className="w-5 h-5" />
                                                    {table.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="p-4 space-y-4">
                                <div className="text-center">
                                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Confirmar transferencia</p>
                                    <div className="flex items-center justify-center gap-3 py-3">
                                        <div className="px-4 py-2 bg-slate-100 rounded-xl font-black text-slate-800">
                                            {transferFromTable?.name}
                                        </div>
                                        <ArrowRightLeft className="w-5 h-5 text-blue-500" />
                                        <div className="px-4 py-2 bg-blue-100 rounded-xl font-black text-blue-700">
                                            {transferTargetTable.name}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={handleTransferStep2}
                                    disabled={transferring}
                                    className={cn(
                                        "w-full py-4 rounded-xl font-black text-white text-sm transition-all active:scale-[0.98]",
                                        transferring ? "bg-slate-400 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600"
                                    )}
                                >
                                    {transferring ? 'Transfiriendo...' : 'CONFIRMAR TRANSFERENCIA'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Cerrar Turno Modal */}
            {showCloseShiftModal && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-2xl">
                        <div className="p-4 bg-red-500 text-white flex items-center justify-between">
                            <h2 className="text-lg font-black">Cerrar Turno</h2>
                            <button
                                onClick={() => setShowCloseShiftModal(false)}
                                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="text-center">
                                <LogOut className="w-12 h-12 mx-auto mb-3 text-red-400" />
                                <p className="font-bold text-slate-800">¿Cerrar tu turno?</p>
                                <p className="text-xs text-slate-500 mt-1">Se finalizarán todas las mesas activas de este turno.</p>
                            </div>
                            <button
                                onClick={handleCloseShift}
                                disabled={closingShift}
                                className={cn(
                                    "w-full py-4 rounded-xl font-black text-white text-sm transition-all active:scale-[0.98]",
                                    closingShift ? "bg-slate-400 cursor-not-allowed" : "bg-red-500 hover:bg-red-600"
                                )}
                            >
                                {closingShift ? 'Cerrando...' : 'CERRAR TURNO'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WaiterStation;