import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, MapPin, Check, X, Shield, Warehouse, Search, Package } from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';

const WarehouseManager = () => {
    const [warehouses, setWarehouses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingWarehouse, setEditingWarehouse] = useState(null);
    const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
    const [inventoryWarehouse, setInventoryWarehouse] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        is_main: false,
        is_active: true
    });

    useEffect(() => {
        fetchWarehouses();
    }, []);

    const fetchWarehouses = async () => {
        try {
            const { data } = await apiClient.get('/warehouses');
            setWarehouses(data);
        } catch (error) {
            console.error('Error fetching warehouses:', error);
            toast.error('Error al cargar almacenes');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (warehouse = null) => {
        if (warehouse) {
            setEditingWarehouse(warehouse);
            setFormData({
                name: warehouse.name,
                address: warehouse.address || '',
                is_main: warehouse.is_main,
                is_active: warehouse.is_active
            });
        } else {
            setEditingWarehouse(null);
            setFormData({
                name: '',
                address: '',
                is_main: false,
                is_active: true
            });
        }
        setIsModalOpen(true);
    };

    const handleViewInventory = (warehouse) => {
        setInventoryWarehouse(warehouse);
        setInventoryModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (editingWarehouse) {
                await apiClient.put(`/warehouses/${editingWarehouse.id}`, formData);
                toast.success('Almacén actualizado');
            } else {
                await apiClient.post('/warehouses', formData);
                toast.success('Almacén creado');
            }
            fetchWarehouses();
            setIsModalOpen(false);
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.detail || 'Error al guardar');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Estás seguro de eliminar este almacén? Esta acción no se puede deshacer.')) return;

        try {
            await apiClient.delete(`/warehouses/${id}`);
            toast.success('Almacén eliminado');
            fetchWarehouses();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.detail || 'Error al eliminar');
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Gestión de Almacenes</h1>
                    <p className="text-slate-500 font-medium">Configura tus bodegas y sucursales</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5 active:translate-y-0"
                >
                    <Plus size={20} />
                    Nuevo Almacén
                </button>
            </div>

            {/* Warehouse Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {warehouses.map(warehouse => (
                    <div key={warehouse.id} className={clsx(
                        "rounded-2xl border p-6 transition-all duration-300 hover:shadow-xl relative overflow-hidden group",
                        warehouse.is_main
                            ? 'border-amber-200 bg-amber-50/30'
                            : 'bg-white border-slate-200 shadow-sm'
                    )}>
                        {warehouse.is_main && (
                            <div className="absolute top-0 right-0 bg-amber-400 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl flex items-center gap-1 shadow-sm uppercase tracking-wider">
                                <Shield size={10} fill="currentColor" /> Principal
                            </div>
                        )}

                        <div className="flex items-start gap-4 mb-6">
                            <div className={clsx(
                                "p-3.5 rounded-xl flex items-center justify-center shadow-sm",
                                warehouse.is_main ? "bg-amber-100/50 text-amber-600" : "bg-slate-100 text-slate-500"
                            )}>
                                <Warehouse size={28} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-xl font-bold text-slate-800 mb-1 truncate">{warehouse.name}</h3>
                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                    <MapPin size={14} className="mt-0.5 shrink-0" />
                                    <span className="truncate">{warehouse.address || 'Sin dirección registrada'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-slate-100/80">
                            <div className={clsx(
                                "text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide",
                                warehouse.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                            )}>
                                {warehouse.is_active ? 'Activo' : 'Inactivo'}
                            </div>

                            <div className="flex gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleViewInventory(warehouse)}
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="Ver Inventario"
                                >
                                    <Package size={18} />
                                </button>
                                <button
                                    onClick={() => handleOpenModal(warehouse)}
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="Editar"
                                >
                                    <Edit size={18} />
                                </button>
                                {!warehouse.is_main && (
                                    <button
                                        onClick={() => handleDelete(warehouse.id)}
                                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                        title="Eliminar"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {warehouses.length === 0 && (
                    <div className="col-span-full py-16 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <Warehouse className="mx-auto text-slate-300 mb-4" size={48} />
                        <p className="text-slate-900 font-bold text-lg">No hay almacenes registrados</p>
                        <p className="text-slate-500">Crea el primer almacén para comenzar a gestionar tu inventario</p>
                    </div>
                )}
            </div>

            {/* MODAL: CREATE/EDIT */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white">
                            <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                                <Warehouse className="text-indigo-600" size={24} />
                                {editingWarehouse ? 'Editar Almacén' : 'Nuevo Almacén'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nombre del Almacén</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-bold text-slate-700 placeholder-slate-300"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Ej: Bodega Norte"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Dirección</label>
                                <textarea
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none font-medium text-slate-700 placeholder-slate-300"
                                    rows="3"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="Dirección física..."
                                ></textarea>
                            </div>

                            <div className="space-y-3 pt-2">
                                <label className={clsx(
                                    "flex items-start gap-3 cursor-pointer p-4 border rounded-xl transition-all",
                                    formData.is_main ? "bg-amber-50 border-amber-200" : "hover:bg-slate-50 border-slate-200"
                                )}>
                                    <div className="flex-shrink-0 mt-0.5">
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 text-amber-500 border-slate-300 rounded focus:ring-amber-500"
                                            checked={formData.is_main}
                                            onChange={e => setFormData({ ...formData, is_main: e.target.checked })}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <span className={clsx("font-bold block", formData.is_main ? "text-amber-900" : "text-slate-700")}>
                                            Almacén Principal
                                        </span>
                                        <span className={clsx("text-xs block mt-0.5", formData.is_main ? "text-amber-700" : "text-slate-500")}>
                                            El inventario no asignado y las ventas por defecto utilizarán este almacén.
                                        </span>
                                    </div>
                                </label>

                                <label className={clsx(
                                    "flex items-center gap-3 cursor-pointer p-4 border rounded-xl transition-all",
                                    formData.is_active ? "bg-emerald-50 border-emerald-200" : "hover:bg-slate-50 border-slate-200"
                                )}>
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 text-emerald-500 border-slate-300 rounded focus:ring-emerald-500"
                                        checked={formData.is_active}
                                        onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                    />
                                    <span className={clsx("font-bold", formData.is_active ? "text-emerald-900" : "text-slate-700")}>
                                        Almacén Activo
                                    </span>
                                </label>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-5 py-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-xl font-bold transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all active:scale-95 flex items-center gap-2"
                                >
                                    <Check size={18} />
                                    Guardar Almacén
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <WarehouseInventoryModal
                isOpen={inventoryModalOpen}
                onClose={() => setInventoryModalOpen(false)}
                warehouse={inventoryWarehouse}
            />
        </div>
    );
};

const WarehouseInventoryModal = ({ isOpen, onClose, warehouse }) => {
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen && warehouse) {
            setLoading(true);
            setSearchTerm('');
            apiClient.get(`/warehouses/${warehouse.id}/inventory`)
                .then(({ data }) => setInventory(data))
                .catch(err => toast.error('Error cargando inventario'))
                .finally(() => setLoading(false));
        }
    }, [isOpen, warehouse]);

    const filteredInventory = inventory.filter(item =>
        item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh]">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <div>
                        <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                            <Package className="text-indigo-600" size={24} />
                            Inventario: {warehouse?.name}
                        </h3>
                        <p className="text-sm text-slate-500 font-medium">Listado de productos disponibles en esta bodega</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                        <X size={24} />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="p-4 bg-slate-50/50 border-b border-slate-100">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar producto por nombre o SKU..."
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 bg-white">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
                            <p className="font-medium">Cargando inventario...</p>
                        </div>
                    ) : inventory.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <Package size={48} className="mb-4 opacity-50" />
                            <p className="font-bold text-slate-600">Almacén vacío</p>
                            <p className="text-sm">No hay productos asignados a este almacén</p>
                        </div>
                    ) : filteredInventory.length === 0 ? (
                        <div className="p-12 text-center text-slate-500">
                            No se encontraron productos coincidentes.
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-slate-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Producto</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">SKU</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Stock</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Ubicación</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                                {filteredInventory.map((item, index) => (
                                    <tr key={item.product_id} className={clsx(
                                        "hover:bg-indigo-50/10 transition-colors",
                                        index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40' // Zebra striping
                                    )}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-700">{item.product_name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-500 bg-slate-50 rounded mx-2 w-fit px-2 py-0.5">{item.sku || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <span className={clsx(
                                                "px-2.5 py-1 rounded-full text-xs font-bold",
                                                Number(item.quantity) > 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                                            )}>
                                                {Number(item.quantity).toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                            <div className="flex items-center gap-1">
                                                <MapPin size={14} className="text-slate-400" />
                                                {item.location || <span className="text-slate-300 italic">Sin ubicación</span>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50/50 text-right rounded-b-2xl">
                    <button onClick={onClose} className="px-6 py-2 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-600 rounded-xl font-bold shadow-sm transition-all text-sm">
                        Cerrar Ventana
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WarehouseManager;
