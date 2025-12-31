import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, MapPin, Check, X, Shield } from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';

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

    if (loading) return <div className="p-8 text-center">Cargando almacenes...</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Gestión de Almacenes</h1>
                    <p className="text-gray-500">Configura tus bodegas y sucursales</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm"
                >
                    <Plus size={20} />
                    Nuevo Almacén
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {warehouses.map(warehouse => (
                    <div key={warehouse.id} className={`bg-white rounded-xl shadow-sm border p-5 transition-all hover:shadow-md relative overflow-hidden ${warehouse.is_main ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200'}`}>
                        {warehouse.is_main && (
                            <div className="absolute top-0 right-0 bg-amber-400 text-white text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1 shadow-sm">
                                <Shield size={12} fill="currentColor" /> PRINCIPAL
                            </div>
                        )}

                        <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-gray-800 mb-1">{warehouse.name}</h3>
                                <div className="flex items-start gap-2 text-sm text-gray-500">
                                    <MapPin size={16} className="mt-0.5 shrink-0" />
                                    <span>{warehouse.address || 'Sin dirección registrada'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                            <div className={`text-xs px-2 py-1 rounded-full font-medium ${warehouse.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {warehouse.is_active ? 'Activo' : 'Inactivo'}
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleViewInventory(warehouse)}
                                    className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                    title="Ver Inventario"
                                >
                                    <Check size={18} />
                                </button>
                                <button
                                    onClick={() => handleOpenModal(warehouse)}
                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                    <Edit size={18} />
                                </button>
                                {!warehouse.is_main && (
                                    <button
                                        onClick={() => handleDelete(warehouse.id)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-lg text-gray-800">
                                {editingWarehouse ? 'Editar Almacén' : 'Nuevo Almacén'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Almacén</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Ej: Bodega Norte"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                                <textarea
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                    rows="3"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="Dirección física..."
                                ></textarea>
                            </div>

                            <div className="flex flex-col gap-3 pt-2">
                                <label className="flex items-center gap-2 cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                                        checked={formData.is_main}
                                        onChange={e => setFormData({ ...formData, is_main: e.target.checked })}
                                    />
                                    <div className="flex-1">
                                        <span className="font-medium text-gray-800 block">Almacén Principal</span>
                                        <span className="text-xs text-gray-500 block">El inventario por defecto se asignará aquí</span>
                                    </div>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                                        checked={formData.is_active}
                                        onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                    />
                                    <span className="font-medium text-gray-800">Activo</span>
                                </label>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md transition-all active:scale-95"
                                >
                                    Guardar
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

    useEffect(() => {
        if (isOpen && warehouse) {
            setLoading(true);
            apiClient.get(`/warehouses/${warehouse.id}/inventory`)
                .then(({ data }) => setInventory(data))
                .catch(err => toast.error('Error cargando inventario'))
                .finally(() => setLoading(false));
        }
    }, [isOpen, warehouse]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <div>
                        <h3 className="font-bold text-lg text-gray-800">Inventario: {warehouse?.name}</h3>
                        <p className="text-xs text-gray-500">Listado de productos disponibles en esta bodega</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-0 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Cargando inventario...</div>
                    ) : inventory.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">No hay productos en este almacén</div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ubicación</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {inventory.map((item) => (
                                    <tr key={item.product_id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.product_name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.sku || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-blue-600">{Number(item.quantity).toFixed(2)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.location || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 text-right rounded-b-xl">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium text-gray-700 transition">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WarehouseManager;
