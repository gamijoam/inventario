import React, { useState, useEffect } from 'react';
import restaurantService from '../../services/restaurantService';
import { RefreshCw, Plus, Trash2, Edit2, X, Users, Clock, Calendar, Sparkles, DollarSign } from 'lucide-react';
import OrderPanel from './components/OrderPanel';
import { toast } from 'react-hot-toast';

const TableMap = () => {
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedZone, setSelectedZone] = useState('ALL');
    const [zones, setZones] = useState([]);
    const [selectedTable, setSelectedTable] = useState(null);
    const [isAddingProducts, setIsAddingProducts] = useState(false);
    const [draggedTable, setDraggedTable] = useState(null);

    // New Table Modal
    const [showNewTableModal, setShowNewTableModal] = useState(false);
    const [newTable, setNewTable] = useState({ name: '', zone: 'Principal', capacity: 4 });
    const [saving, setSaving] = useState(false);

    // Edit/Delete
    const [_editingTable, _setEditingTable] = useState(null);

    const fetchTables = async () => {
        setLoading(true);
        try {
            const data = await restaurantService.getTables();
            setTables(data);
            const uniqueZones = [...new Set(data.map(t => t.zone))];
            setZones(uniqueZones);
        } catch (_) {
            console.error("Error fetching tables:", _);
            toast.error("Error cargando mesas");
        } finally {
            setLoading(false);
        }
    };

    const handleDragStart = (e, table) => {
        if (table.status === 'OCCUPIED' && table.current_order_id) {
            setDraggedTable(table);
            e.dataTransfer.setData('text/plain', table.id);
            e.dataTransfer.effectAllowed = 'move';
        } else {
            e.preventDefault();
        }
    };

    const handleDragOver = (e, targetTable) => {
        e.preventDefault();
        if (draggedTable && draggedTable.id !== targetTable.id && targetTable.status === 'AVAILABLE') {
            e.dataTransfer.dropEffect = 'move';
        } else {
            e.dataTransfer.dropEffect = 'none';
        }
    };

    const handleDrop = async (e, targetTable) => {
        e.preventDefault();
        if (!draggedTable || draggedTable.id === targetTable.id) return;
        if (targetTable.status !== 'AVAILABLE') {
            toast.error("Solo puedes mover cuentas a mesas disponibles.");
            return;
        }
        
        if (window.confirm(`¿Mover cuenta de ${draggedTable.name} a ${targetTable.name}?`)) {
            try {
                await restaurantService.moveOrder(draggedTable.current_order_id, targetTable.id);
                toast.success(`Cuenta movida a ${targetTable.name}`);
                fetchTables();
                if (selectedTable && selectedTable.id === draggedTable.id) {
                    handleCloseModal();
                }
            } catch (err) {
                toast.error(error.response?.data?.detail || "Error al mover la cuenta");
            }
        }
        setDraggedTable(null);
    };

    const handleDragEnd = () => {
        setDraggedTable(null);
    };

    useEffect(() => {
        fetchTables();
        const interval = setInterval(fetchTables, 10000); // Auto-refresh every 10s
        return () => clearInterval(interval);
    }, []);

    const handleTableClick = (table) => {
        setSelectedTable(table);
    };

    const handleCloseModal = () => {
        setSelectedTable(null);
        setIsAddingProducts(false);
    };

    const handleUpdateMap = () => {
        fetchTables();
    };

    // ===== CREATE TABLE =====
    const handleCreateTable = async (e) => {
        e.preventDefault();
        if (!newTable.name.trim()) {
            toast.error("El nombre de la mesa es obligatorio");
            return;
        }
        setSaving(true);
        try {
            await restaurantService.createTable(newTable);
            toast.success(`Mesa "${newTable.name}" creada`);
            setNewTable({ name: '', zone: newTable.zone, capacity: 4 });
            setShowNewTableModal(false);
            fetchTables();
        } catch (err) {
            console.error(error);
            toast.error(error.response?.data?.detail || "Error creando mesa");
        } finally {
            setSaving(false);
        }
    };

    // ===== DELETE TABLE =====
    const handleDeleteTable = async (e, tableId) => {
        e.stopPropagation();
        if (!window.confirm('¿Seguro que deseas eliminar esta mesa?')) return;
        try {
            await restaurantService.deleteTable(tableId);
            toast.success("Mesa eliminada");
            fetchTables();
        } catch (err) {
            toast.error("Error eliminando mesa");
        }
    };

    const handleChangeStatus = async (e, tableId, newStatus) => {
        e.stopPropagation();
        try {
            await restaurantService.updateTableStatus(tableId, newStatus);
            toast.success(`Mesa marcada como ${newStatus.toLowerCase()}`);
            fetchTables();
        } catch (err) {
            toast.error(error.response?.data?.detail || "Error cambiando estado");
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'AVAILABLE': return {
                bg: 'bg-gradient-to-br from-emerald-50 to-green-100',
                border: 'border-emerald-400',
                text: 'text-emerald-700',
                badge: 'bg-emerald-500',
                label: 'Disponible',
                icon: '🟢'
            };
            case 'OCCUPIED': return {
                bg: 'bg-gradient-to-br from-red-50 to-rose-100',
                border: 'border-red-400',
                text: 'text-red-700',
                badge: 'bg-red-500',
                label: 'Ocupada',
                icon: '🔴'
            };
            case 'RESERVED': return {
                bg: 'bg-gradient-to-br from-amber-50 to-yellow-100',
                border: 'border-amber-400',
                text: 'text-amber-700',
                badge: 'bg-amber-500',
                label: 'Reservada',
                icon: '🟡'
            };
            case 'CLEANING': return {
                bg: 'bg-gradient-to-br from-blue-50 to-sky-100',
                border: 'border-blue-400',
                text: 'text-blue-700',
                badge: 'bg-blue-500',
                label: 'Limpieza',
                icon: '🔵'
            };
            case 'WAITING_BILL': return {
                bg: 'bg-gradient-to-br from-orange-50 to-amber-100',
                border: 'border-orange-400',
                text: 'text-orange-700',
                badge: 'bg-orange-500',
                label: 'Por Cobrar',
                icon: '🟠'
            };
            default: return {
                bg: 'bg-gray-100',
                border: 'border-gray-300',
                text: 'text-gray-600',
                badge: 'bg-gray-400',
                label: status,
                icon: '⚪'
            };
        }
    };

    const formatDuration = (startTimeStr) => {
        if (!startTimeStr) return '';
        const start = new Date(startTimeStr + 'Z'); // Add 'Z' to ensure it's treated as UTC if backend sends naive UTC
        const now = new Date();
        const diffMs = Math.max(0, now - start); // Ensure we don't get negative values due to slight clock drift
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 60) return `${diffMins}m`;
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return `${hours}h ${mins}m`;
    };

    const filteredTables = selectedZone === 'ALL'
        ? tables
        : tables.filter(t => t.zone === selectedZone);

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden relative">
            <div id="tour-restaurant-tablemap" className={`flex-1 p-6 flex flex-col transition-all duration-300 overflow-hidden ${selectedTable ? 'pr-6 opacity-60 xl:opacity-100' : ''}`}>
                {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        🍽️ MAPA DE MESAS
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {tables.filter(t => t.status === 'OCCUPIED').length} ocupada(s) de {tables.length} total
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchTables}
                        className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-sm hover:bg-slate-50 text-slate-500 transition-colors"
                        title="Actualizar"
                    >
                        <RefreshCw size={18} />
                    </button>

                    <button
                        onClick={() => setSelectedTable({ id: null, name: 'LLEVAR', is_takeout: true, status: 'AVAILABLE' })}
                        className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-lg shadow-sm hover:bg-orange-600 transition font-medium text-sm"
                    >
                        🥡 Para Llevar
                    </button>

                    <button
                        id="tour-restaurant-add-table"
                        onClick={() => setShowNewTableModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 transition font-medium text-sm"
                    >
                        <Plus size={18} />
                        Nueva Mesa
                    </button>
                </div>
            </div>

            {/* Zone Filter */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                <button
                    onClick={() => setSelectedZone('ALL')}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${selectedZone === 'ALL'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                >
                    Todas las Zonas ({tables.length})
                </button>
                {zones.map(zone => (
                    <button
                        key={zone}
                        onClick={() => setSelectedZone(zone)}
                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${selectedZone === zone
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                    >
                        {zone} ({tables.filter(t => t.zone === zone).length})
                    </button>
                ))}
            </div>

            {/* Status Legend */}
            <div className="flex gap-4 mb-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">🟢 Disponible</span>
                <span className="flex items-center gap-1">🔴 Ocupada</span>
                <span className="flex items-center gap-1">🟠 Por Cobrar</span>
                <span className="flex items-center gap-1">🟡 Reservada</span>
                <span className="flex items-center gap-1">🔵 Limpieza</span>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="flex-1 flex justify-center items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 overflow-y-auto pb-20">
                    {filteredTables.map(table => {
                        const status = getStatusColor(table.status);
                        return (
                            <div
                                key={table.id}
                                onClick={() => handleTableClick(table)}
                                draggable={table.status === 'OCCUPIED' && !!table.current_order_id}
                                onDragStart={(e) => handleDragStart(e, table)}
                                onDragOver={(e) => handleDragOver(e, table)}
                                onDrop={(e) => handleDrop(e, table)}
                                onDragEnd={handleDragEnd}
                                className={`
                                    relative rounded-2xl border-2 p-5 cursor-pointer shadow-sm
                                    transition-all transform hover:scale-[1.03] hover:shadow-lg
                                    ${status.bg} ${status.border}
                                    ${draggedTable?.id === table.id ? 'opacity-50 ring-4 ring-indigo-400' : ''}
                                    min-h-[140px] flex flex-col justify-between
                                `}
                            >
                                {/* Delete button (top-right) */}
                                <button
                                    onClick={(e) => handleDeleteTable(e, table.id)}
                                    className="absolute top-2 right-2 p-1 rounded-full bg-white/70 text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                    title="Eliminar Mesa"
                                    style={{ opacity: undefined }}
                                    onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                                    onMouseLeave={(e) => e.currentTarget.style.opacity = ''}
                                >
                                    <Trash2 size={14} />
                                </button>

                                {/* Status Action Buttons (bottom) */}
                                {table.status === 'AVAILABLE' && (
                                    <button
                                        onClick={(e) => handleChangeStatus(e, table.id, 'RESERVED')}
                                        className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-amber-100 text-amber-700 text-[10px] font-bold hover:bg-amber-200 transition"
                                        title="Reservar Mesa"
                                    >
                                        <Calendar size={10} className="inline mr-1" />Reservar
                                    </button>
                                )}
                                {table.status === 'OCCUPIED' && (
                                    <button
                                        onClick={(e) => handleChangeStatus(e, table.id, 'CLEANING')}
                                        className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-blue-100 text-blue-700 text-[10px] font-bold hover:bg-blue-200 transition"
                                        title="Marcar en Limpieza"
                                    >
                                        <Sparkles size={10} className="inline mr-1" />Limpieza
                                    </button>
                                )}
                                {table.status === 'RESERVED' && (
                                    <button
                                        onClick={(e) => handleChangeStatus(e, table.id, 'AVAILABLE')}
                                        className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold hover:bg-slate-200 transition"
                                        title="Cancelar Reserva"
                                    >
                                        ✕ Cancelar
                                    </button>
                                )}
                                {table.status === 'CLEANING' && (
                                    <button
                                        onClick={(e) => handleChangeStatus(e, table.id, 'AVAILABLE')}
                                        className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-[10px] font-bold hover:bg-emerald-200 transition"
                                        title="Terminar Limpieza"
                                    >
                                        <Sparkles size={10} className="inline mr-1" />Limpia
                                    </button>
                                )}

                                <div className="text-center mt-2">
                                    <span className="text-3xl font-bold mb-1 block">{table.name}</span>
                                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${status.text} bg-white/60`}>
                                        {status.icon} {status.label}
                                    </span>
                                </div>

                                {table.current_order_id && table.status === 'OCCUPIED' && (
                                    <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                                        {table.current_order_total != null && (
                                            <span className="inline-flex items-center gap-0.5 bg-white/90 text-emerald-700 text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-sm border border-emerald-100">
                                                <DollarSign size={10} /> {parseFloat(table.current_order_total).toFixed(2)}
                                            </span>
                                        )}
                                        {table.current_order_time && (
                                            <span className="inline-flex items-center gap-0.5 bg-white/90 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-sm border border-slate-200">
                                                <Clock size={10} /> {formatDuration(table.current_order_time)}
                                            </span>
                                        )}
                                    </div>
                                )}

                                <div className="flex justify-between items-end mt-3">
                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                        <Users size={12} />
                                        {table.capacity}
                                    </div>
                                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">{table.zone}</span>
                                </div>
                            </div>
                        );
                    })}

                    {filteredTables.length === 0 && (
                        <div className="col-span-full py-16 text-center">
                            <p className="text-6xl mb-4">🍽️</p>
                            <p className="text-slate-400 text-lg">No hay mesas en esta zona.</p>
                            <button
                                onClick={() => setShowNewTableModal(true)}
                                className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
                            >
                                Crear Primera Mesa
                            </button>
                        </div>
                    )}
                </div>
            )}

            </div>

            {/* Side Panel (Order Panel) */}
            {selectedTable && (
                <div className={`absolute right-0 top-0 bottom-0 z-20 flex flex-col bg-white xl:relative xl:flex-shrink-0 transition-all duration-300 shadow-[-8px_0_30px_-15px_rgba(0,0,0,0.15)] border-l border-slate-200 ${isAddingProducts ? 'w-full xl:w-[75vw] 2xl:w-[70vw]' : 'w-full sm:w-[480px]'}`}>
                    <OrderPanel
                        table={selectedTable}
                        onClose={handleCloseModal}
                        onUpdate={handleUpdateMap}
                        isAddingProducts={isAddingProducts}
                        onToggleAddProducts={setIsAddingProducts}
                    />
                </div>
            )}

            {/* NEW TABLE MODAL */}
            {showNewTableModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-indigo-600 text-white px-6 py-4 flex justify-between items-center">
                            <h2 className="text-lg font-bold">Nueva Mesa</h2>
                            <button onClick={() => setShowNewTableModal(false)} className="p-1 hover:bg-white/20 rounded-lg transition">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateTable} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                                <input
                                    type="text"
                                    value={newTable.name}
                                    onChange={(e) => setNewTable(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-lg"
                                    placeholder="Ej: Mesa 1, Barra 3"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Zona</label>
                                <input
                                    type="text"
                                    value={newTable.zone}
                                    onChange={(e) => setNewTable(prev => ({ ...prev, zone: e.target.value }))}
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    placeholder="Ej: Terraza, Salón Principal"
                                    list="zone-suggestions"
                                />
                                <datalist id="zone-suggestions">
                                    {zones.map(z => (
                                        <option key={z} value={z} />
                                    ))}
                                    <option value="Principal" />
                                    <option value="Terraza" />
                                    <option value="Barra" />
                                    <option value="VIP" />
                                </datalist>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Capacidad</label>
                                <div className="flex items-center gap-3">
                                    {[2, 4, 6, 8, 10].map(cap => (
                                        <button
                                            key={cap}
                                            type="button"
                                            onClick={() => setNewTable(prev => ({ ...prev, capacity: cap }))}
                                            className={`w-12 h-12 rounded-xl font-bold text-lg transition-all ${newTable.capacity === cap
                                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                        >
                                            {cap}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowNewTableModal(false)}
                                    className="flex-1 p-3 border border-slate-300 rounded-xl text-slate-600 hover:bg-slate-50 transition font-medium"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-medium disabled:opacity-50"
                                >
                                    {saving ? 'Creando...' : 'Crear Mesa'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TableMap;
