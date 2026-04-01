import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import restaurantService from '../../services/restaurantService';
import { Clock, Utensils, ChefHat, ShoppingBag, RefreshCw, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_STYLES = {
    AVAILABLE: {
        bg: 'bg-gradient-to-br from-emerald-50 to-green-50',
        border: 'border-emerald-200',
        badge: 'bg-emerald-500',
        text: 'text-emerald-700',
        label: 'LIBRE'
    },
    OCCUPIED: {
        bg: 'bg-gradient-to-br from-red-50 to-orange-50',
        border: 'border-red-200',
        badge: 'bg-red-500',
        text: 'text-red-700',
        label: 'OCUPADA'
    },
    RESERVED: {
        bg: 'bg-gradient-to-br from-blue-50 to-indigo-50',
        border: 'border-blue-200',
        badge: 'bg-blue-500',
        text: 'text-blue-700',
        label: 'RESERVADA'
    },
    CLEANING: {
        bg: 'bg-gradient-to-br from-amber-50 to-yellow-50',
        border: 'border-amber-200',
        badge: 'bg-amber-500',
        text: 'text-amber-700',
        label: 'LIMPIEZA'
    }
};

const MobileTableGrid = () => {
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeZone, setActiveZone] = useState('ALL');
    const [refreshing, setRefreshing] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        loadTables();
        const interval = setInterval(loadTables, 8000);
        return () => clearInterval(interval);
    }, []);

    const loadTables = async () => {
        try {
            const data = await restaurantService.getTables();
            setTables(data);
            setLoading(false);
        } catch (error) {
            console.error(error);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadTables();
        setRefreshing(false);
        toast.success('Actualizado', { duration: 1000, position: 'bottom-center' });
    };

    const handleTakeout = () => {
        navigate('/mobile/order/takeout');
    };

    const handleLogout = () => {
        localStorage.removeItem('waiter_pin');
        localStorage.removeItem('waiter_name');
        navigate('/mobile/login');
    };

    const zones = ['ALL', ...new Set(tables.map(t => t.zone).filter(Boolean))];
    const filteredTables = activeZone === 'ALL'
        ? tables
        : tables.filter(t => t.zone === activeZone);

    const stats = {
        total: tables.length,
        available: tables.filter(t => t.status === 'AVAILABLE').length,
        occupied: tables.filter(t => t.status === 'OCCUPIED').length,
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-indigo-500 mx-auto mb-4"></div>
                    <p className="text-slate-400 font-bold">Cargando mesas...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10 shadow-sm">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                            <Utensils size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-slate-800">Mesas</h1>
                            <p className="text-[10px] text-slate-400 font-bold">
                                {stats.available} libres • {stats.occupied} ocupadas
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleRefresh}
                            className={`p-2.5 rounded-xl bg-slate-100 text-slate-500 active:scale-95 transition ${refreshing ? 'animate-spin' : ''}`}
                        >
                            <RefreshCw size={18} />
                        </button>
                        <button
                            onClick={handleLogout}
                            className="p-2.5 rounded-xl bg-red-50 text-red-500 active:scale-95 transition"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>

                {/* Zone Filter */}
                <div className="flex gap-2 mt-3 overflow-x-auto pb-1 custom-scrollbar -mx-1 px-1">
                    {zones.map(zone => (
                        <button
                            key={zone}
                            onClick={() => setActiveZone(zone)}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition-all active:scale-95 ${activeZone === zone
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                                }`}
                        >
                            {zone === 'ALL' ? 'Todas' : zone}
                        </button>
                    ))}
                </div>
            </header>

            {/* Table Grid */}
            <main className="flex-1 p-3 overflow-y-auto">
                {/* Takeout Button */}
                <button
                    onClick={handleTakeout}
                    className="w-full mb-3 p-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl shadow-lg shadow-orange-200 flex items-center justify-between active:scale-[0.98] transition"
                >
                    <div className="flex items-center gap-3">
                        <ShoppingBag size={24} />
                        <div className="text-left">
                            <span className="font-black text-base block">Para Llevar</span>
                            <span className="text-orange-100 text-xs font-bold">Nuevo pedido sin mesa</span>
                        </div>
                    </div>
                    <ChefHat size={20} className="opacity-50" />
                </button>

                <div className="grid grid-cols-2 gap-3 pb-4">
                    {filteredTables.map(table => {
                        const style = STATUS_STYLES[table.status] || STATUS_STYLES.AVAILABLE;

                        return (
                            <button
                                key={table.id}
                                onClick={() => navigate(`/mobile/order/${table.id}`)}
                                className={`relative p-4 rounded-2xl text-left transition-all active:scale-95 h-28 flex flex-col justify-between border-2 shadow-sm ${style.bg} ${style.border}`}
                            >
                                {/* Status dot */}
                                <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${style.badge} ${table.status === 'OCCUPIED' ? 'animate-pulse' : ''}`}></div>

                                <span className={`font-black text-xl ${style.text}`}>
                                    {table.name}
                                </span>

                                <div className="space-y-1">
                                    <p className="text-[11px] text-slate-400 font-bold truncate">{table.zone || 'General'}</p>
                                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black ${table.status === 'OCCUPIED'
                                            ? 'bg-red-100 text-red-600'
                                            : table.status === 'AVAILABLE'
                                                ? 'bg-emerald-100 text-emerald-600'
                                                : 'bg-slate-100 text-slate-500'
                                        }`}>
                                        {table.status === 'OCCUPIED' && <Clock size={10} />}
                                        {style.label}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {filteredTables.length === 0 && (
                    <div className="text-center py-16 text-slate-400">
                        <Utensils size={48} className="mx-auto mb-3 opacity-30" />
                        <p className="font-bold">No hay mesas en esta zona</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default MobileTableGrid;
