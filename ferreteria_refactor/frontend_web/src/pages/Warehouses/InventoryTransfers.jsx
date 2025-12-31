import React, { useState, useEffect } from 'react';
import { ArrowRight, Plus, Calendar, Package, CheckCircle, Search, MapPin, Truck } from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

const InventoryTransfers = () => {
    const [view, setView] = useState('list'); // list, create
    const [transfers, setTransfers] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [loading, setLoading] = useState(true);

    // Create Form State
    const [formData, setFormData] = useState({
        source_warehouse_id: '',
        target_warehouse_id: '',
        notes: '',
        date: new Date().toISOString().split('T')[0]
    });
    const [items, setItems] = useState([]);
    const [productSearch, setProductSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const [transfersRes, warehousesRes] = await Promise.all([
                apiClient.get('/transfers'),
                apiClient.get('/warehouses')
            ]);
            setTransfers(transfersRes.data);
            setWarehouses(warehousesRes.data);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Error cargando datos');
        } finally {
            setLoading(false);
        }
    };

    const searchProducts = async (query) => {
        if (!query || query.length < 2) {
            setSearchResults([]);
            return;
        }
        try {
            const { data } = await apiClient.get(`/products?search=${query}`);
            setSearchResults(data);
        } catch (error) {
            console.error(error);
        }
    };

    const addItem = (product) => {
        if (items.find(i => i.product_id === product.id)) return;
        setItems([...items, {
            product_id: product.id,
            name: product.name,
            quantity: 1,
            stock_available: product.stock // Note: This might be total stock, backend validates specific warehouse stock
        }]);
        setProductSearch('');
        setSearchResults([]);
    };

    const updateItemQty = (index, qty) => {
        const newItems = [...items];
        newItems[index].quantity = Number(qty);
        setItems(newItems);
    };

    const removeItem = (index) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.source_warehouse_id || !formData.target_warehouse_id) {
            return toast.error("Seleccione origen y destino");
        }
        if (items.length === 0) {
            return toast.error("Agregue al menos un producto");
        }

        try {
            const payload = {
                ...formData,
                items: items.map(i => ({
                    product_id: i.product_id,
                    quantity: i.quantity
                }))
            };
            await apiClient.post('/transfers', payload);
            toast.success("Traslado realizado con éxito");
            setView('list');
            fetchInitialData();
            // Reset form
            setFormData({ ...formData, notes: '' });
            setItems([]);
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.detail || "Error al procesar traslado");
        }
    };

    // --- Render List View ---
    if (view === 'list') {
        return (
            <div className="p-6 max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <Truck className="text-blue-600" /> Traslados de Inventario
                        </h1>
                        <p className="text-gray-500">Historial de movimientos entre bodegas</p>
                    </div>
                    <button
                        onClick={() => setView('create')}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-sm"
                    >
                        <Plus size={20} /> Nuevo Traslado
                    </button>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-lefts">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="p-4 text-sm font-semibold text-gray-600">ID</th>
                                <th className="p-4 text-sm font-semibold text-gray-600">Fecha</th>
                                <th className="p-4 text-sm font-semibold text-gray-600">Origen</th>
                                <th className="p-4 text-sm font-semibold text-gray-600">Destino</th>
                                <th className="p-4 text-sm font-semibold text-gray-600">Items</th>
                                <th className="p-4 text-sm font-semibold text-gray-600">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {transfers.map(t => (
                                <tr key={t.id} className="hover:bg-gray-50">
                                    <td className="p-4 font-mono text-xs text-gray-500">#{t.id}</td>
                                    <td className="p-4 text-sm">{format(new Date(t.date), 'dd/MM/yyyy')}</td>
                                    <td className="p-4 text-sm">
                                        <span className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded text-xs font-medium w-fit">
                                            <ArrowRight size={12} className="rotate-180" /> {t.source_warehouse?.name}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm">
                                        <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded text-xs font-medium w-fit">
                                            <ArrowRight size={12} /> {t.target_warehouse?.name}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm">{t.details.length} productos</td>
                                    <td className="p-4">
                                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-bold">
                                            {t.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {transfers.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-gray-500">No hay traslados registrados</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    // --- Render Create View ---
    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => setView('list')}
                    className="p-2 hover:bg-gray-100 rounded-full text-gray-500"
                >
                    <ArrowRight className="rotate-180" />
                </button>
                <h1 className="text-2xl font-bold text-gray-800">Nuevo Traslado</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column: Config & Items */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                            <MapPin size={18} /> Ruta del Traslado
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Bodega Origen</label>
                                <select
                                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-red-50/50 border-red-100"
                                    value={formData.source_warehouse_id}
                                    onChange={e => setFormData({ ...formData, source_warehouse_id: e.target.value })}
                                >
                                    <option value="">Seleccione Origen...</option>
                                    {warehouses.map(w => (
                                        <option key={w.id} value={w.id} disabled={Number(w.id) === Number(formData.target_warehouse_id)}>{w.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Bodega Destino</label>
                                <select
                                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-green-50/50 border-green-100"
                                    value={formData.target_warehouse_id}
                                    onChange={e => setFormData({ ...formData, target_warehouse_id: e.target.value })}
                                >
                                    <option value="">Seleccione Destino...</option>
                                    {warehouses.map(w => (
                                        <option key={w.id} value={w.id} disabled={Number(w.id) === Number(formData.source_warehouse_id)}>{w.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 min-h-[400px]">
                        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                            <Package size={18} /> Productos a Trasladar
                        </h3>

                        {/* Product Search */}
                        <div className="relative mb-6">
                            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                                <Search className="ml-3 text-gray-400" size={20} />
                                <input
                                    type="text"
                                    className="w-full p-3 outline-none"
                                    placeholder="Buscar producto por nombre o código..."
                                    value={productSearch}
                                    onChange={e => {
                                        setProductSearch(e.target.value);
                                        searchProducts(e.target.value);
                                    }}
                                />
                            </div>
                            {searchResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 bg-white shadow-xl rounded-lg mt-1 border border-gray-100 z-10 max-h-60 overflow-y-auto">
                                    {searchResults.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => addItem(p)}
                                            className="w-full text-left p-3 hover:bg-blue-50 border-b border-gray-50 flex justify-between items-center group"
                                        >
                                            <div>
                                                <div className="font-medium text-gray-800 group-hover:text-blue-700">{p.name}</div>
                                                <div className="text-xs text-gray-500">SKU: {p.sku}</div>
                                            </div>
                                            <Plus size={16} className="text-gray-400 group-hover:text-blue-600" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Items List */}
                        <div className="space-y-3">
                            {items.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-4 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-800">{item.name}</div>
                                    </div>
                                    <div className="w-32">
                                        <input
                                            type="number"
                                            className="w-full p-1.5 border rounded text-center font-mono"
                                            value={item.quantity}
                                            onChange={e => updateItemQty(idx, e.target.value)}
                                            min="0.1"
                                            step="0.1"
                                        />
                                    </div>
                                    <button
                                        onClick={() => removeItem(idx)}
                                        className="text-gray-400 hover:text-red-500 p-1"
                                    >
                                        <Plus size={20} className="rotate-45" />
                                    </button>
                                </div>
                            ))}
                            {items.length === 0 && (
                                <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-100 rounded-lg">
                                    Busca y agrega productos para trasladar
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Actions */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                            <Calendar size={18} /> Detalles
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Fecha</label>
                                <input
                                    type="date"
                                    className="w-full p-2 border rounded-lg"
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Notas / Referencia</label>
                                <textarea
                                    className="w-full p-2 border rounded-lg resize-none h-24"
                                    placeholder="Razón del traslado..."
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                ></textarea>
                            </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-gray-100">
                            <button
                                onClick={handleSubmit}
                                disabled={items.length === 0}
                                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none flex justify-center items-center gap-2"
                            >
                                <CheckCircle size={20} /> Confirmar Traslado
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InventoryTransfers;
