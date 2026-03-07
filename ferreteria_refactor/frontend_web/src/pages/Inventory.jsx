import { useState, useEffect } from 'react';
import { Archive, ArrowDownCircle, ArrowUpCircle, Filter, Search, Calendar, ChevronRight } from 'lucide-react';
import InventoryMovementSheet from '../components/inventory/InventoryMovementSheet';
import apiClient from '../config/axios';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

const Inventory = () => {
    const [kardex, setKardex] = useState([]);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        const date = new Date();
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
    });

    // Fetch Kardex
    const fetchKardex = async () => {
        setIsLoading(true);
        try {
            const params = {
                start_date: startDate,
                end_date: endDate
            };
            const response = await apiClient.get('/inventory/kardex', { params });
            setKardex(response.data);
        } catch (error) {
            console.error("Error fetching kardex:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchKardex();
    }, [startDate, endDate]); // Refetch when dates change

    const getMovementStyle = (type) => {
        if (['SALE', 'ADJUSTMENT_OUT', 'DAMAGED', 'INTERNAL_USE', 'OUT'].includes(type)) {
            return { color: 'text-rose-600', icon: <ArrowDownCircle size={16} className="mr-1.5" />, bg: 'bg-rose-50', border: 'border-rose-100' };
        }
        return { color: 'text-emerald-600', icon: <ArrowUpCircle size={16} className="mr-1.5" />, bg: 'bg-emerald-50', border: 'border-emerald-100' };
    };

    const getLabel = (type) => {
        const labels = {
            'SALE': 'Venta',
            'PURCHASE': 'Compra',
            'ADJUSTMENT_IN': 'Ajuste Entrada',
            'ADJUSTMENT_OUT': 'Ajuste Salida',
            'DAMAGED': 'Dañado',
            'INTERNAL_USE': 'Uso Interno'
        };
        return labels[type] || type;
    };

    return (
        <div className="space-y-6">
            {/* Header & Actions */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center">
                            <Archive className="mr-2 text-indigo-600 size-6 md:size-8" />
                            <span className="hidden md:inline">Movimientos de Inventario</span>
                            <span className="md:hidden">Inventario</span>
                        </h1>
                        <p className="hidden md:block text-slate-500 text-sm mt-1">Historial completo de entradas y salidas (Kardex)</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            id="tour-inventory-add-btn"
                            onClick={() => setIsSheetOpen(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl shadow-lg shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5 transition-all font-bold text-sm flex items-center gap-2"
                        >
                            <span className="md:hidden">+ Ajuste</span>
                            <span className="hidden md:inline">Nuevo Ajuste Manual</span>
                        </button>
                    </div>
                </div>

                {/* Search & Filters */}
                <div className="bg-white p-3 md:p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-3 items-center sticky top-0 z-10">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar producto..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700 text-sm"
                        />
                    </div>

                    {/* Date Filters */}
                    <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
                        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200 shrink-0">
                            <input
                                type="date"
                                className="bg-transparent text-xs md:text-sm font-medium text-slate-600 outline-none px-2 py-1.5"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                            <span className="text-slate-400 font-bold px-1"><ChevronRight size={14} /></span>
                            <input
                                type="date"
                                className="bg-transparent text-xs md:text-sm font-medium text-slate-600 outline-none px-2 py-1.5"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha / Hora</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Producto</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Movimiento</th>
                            <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Cantidad</th>
                            <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Saldo Final</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Nota</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-50">
                        {isLoading ? (
                            <tr>
                                <td colSpan="6" className="text-center py-12 text-slate-400">
                                    Cargando movimientos...
                                </td>
                            </tr>
                        ) : kardex
                            .filter(item => {
                                if (!searchQuery) return true;
                                const productName = item.product?.name || '';
                                return productName.toLowerCase().includes(searchQuery.toLowerCase());
                            })
                            .map((item, index) => {
                                const style = getMovementStyle(item.movement_type);
                                return (
                                    <tr
                                        key={item.id}
                                        className={clsx(
                                            "transition-colors duration-200 hover:bg-slate-50",
                                            index % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                                        )}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                                            {new Date(item.date).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="font-bold text-slate-800">
                                                {item.product ? item.product.name : <span className="text-slate-400">ID: {item.product_id}</span>}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${style.bg} ${style.color} ${style.border}`}>
                                                {style.icon}
                                                {getLabel(item.movement_type)}
                                            </span>
                                        </td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-black ${style.color}`}>
                                            {['SALE', 'ADJUSTMENT_OUT', 'DAMAGED', 'INTERNAL_USE'].includes(item.movement_type) ? '-' : '+'}{item.quantity}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-slate-700 bg-slate-50/50">
                                            {item.balance_after}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 italic truncate max-w-xs">
                                            {item.description || <span className="text-slate-300">-</span>}
                                        </td>
                                    </tr>
                                );
                            })}
                        {!isLoading && kardex.length === 0 && (
                            <tr>
                                <td colSpan="6" className="text-center py-12 text-slate-400">
                                    No hay movimientos registrados.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden grid grid-cols-1 gap-4">
                {kardex
                    .filter(item => {
                        if (!searchQuery) return true;
                        const productName = item.product?.name || '';
                        return productName.toLowerCase().includes(searchQuery.toLowerCase());
                    })
                    .map(item => {
                        const style = getMovementStyle(item.movement_type);
                        return (
                            <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="font-exrabold text-slate-800 text-sm mb-1 line-clamp-1">
                                            {item.product ? item.product.name : `ID: ${item.product_id}`}
                                        </div>
                                        <div className="text-xs text-slate-400 font-medium">
                                            {new Date(item.date).toLocaleString()}
                                        </div>
                                    </div>
                                    <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border ${style.bg} ${style.color} ${style.border}`}>
                                        {style.icon}
                                        {getLabel(item.movement_type)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center border-t border-slate-100 pt-3 mt-1">
                                    <div className="text-xs text-slate-500 italic max-w-[60%] truncate">
                                        {item.description || "Sin notas"}
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-lg font-black ${style.color}`}>
                                            {['SALE', 'ADJUSTMENT_OUT', 'DAMAGED', 'INTERNAL_USE'].includes(item.movement_type) ? '-' : '+'}{item.quantity}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded-full inline-block mt-0.5">
                                            Saldo: {item.balance_after}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                {!isLoading && kardex.length === 0 && (
                    <div className="py-12 text-center text-slate-400 font-medium">
                        No hay movimientos registrados.
                    </div>
                )}
            </div>

            <InventoryMovementSheet
                isOpen={isSheetOpen}
                onClose={() => setIsSheetOpen(false)}
                onSuccess={() => {
                    fetchKardex();
                }}
            />
        </div>
    );
};

export default Inventory;
