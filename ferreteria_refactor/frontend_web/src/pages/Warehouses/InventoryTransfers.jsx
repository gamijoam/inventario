import React, { useState, useEffect } from 'react';
import { ArrowRight, Plus, Calendar, Package, CheckCircle, Search, MapPin, Truck, History, X } from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import clsx from 'clsx';

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
            stock_available: product.stock,
            sku: product.sku
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
        if (formData.source_warehouse_id === formData.target_warehouse_id) {
            return toast.error("El origen y destino deben ser diferentes");
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

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
    );

    // --- Render List View ---
    if (view === 'list') {
        return (
            <div className="p-6 max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
                            <Truck className="text-indigo-600" size={32} /> Traslados de Inventario
                        </h1>
                        <p className="text-slate-500 font-medium">Historial y gestión de movimientos entre bodegas</p>
                    </div>
                    <button
                        onClick={() => setView('create')}
                        className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5"
                    >
                        <Plus size={20} /> Nuevo Traslado
                    </button>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">ID</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Origen</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Destino</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Artículos</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {transfers.map((t, idx) => (
                                    <tr key={t.id} className={clsx(
                                        "hover:bg-slate-50/80 transition-colors",
                                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                                    )}>
                                        <td className="px-6 py-4 text-xs font-mono font-bold text-slate-400">#{t.id}</td>
                                        <td className="px-6 py-4 text-sm font-medium text-slate-700">{format(new Date(t.date), 'dd/MM/yyyy')}</td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className="flex items-center gap-1.5 text-rose-700 bg-rose-50 px-3 py-1 rounded-lg text-xs font-bold w-fit border border-rose-100">
                                                <MapPin size={12} /> {t.source_warehouse?.name}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg text-xs font-bold w-fit border border-emerald-100">
                                                <ArrowRight size={12} /> {t.target_warehouse?.name}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-slate-600">{t.details.length}</td>
                                        <td className="px-6 py-4">
                                            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                                                {t.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {transfers.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="py-16 text-center text-slate-400">
                                            <History size={48} className="mx-auto mb-3 opacity-20" />
                                            <p className="font-medium">No hay traslados registrados</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    // --- Render Create View ---
    return (
        <div className="p-6 max-w-6xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => setView('list')}
                    className="p-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-500 transition-colors shadow-sm"
                >
                    <ArrowRight className="rotate-180" size={20} />
                </button>
                <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Nuevo Traslado</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Config & Items */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Route Card */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 text-lg border-b border-slate-100 pb-4">
                            <MapPin className="text-indigo-600" size={20} /> Ruta del Traslado
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                            {/* Connector Arrow for Desktop */}
                            <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 bg-white p-2 rounded-full shadow-sm border border-slate-200 text-slate-400">
                                <ArrowRight size={20} />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Bodega Origen (Sale)</label>
                                <select
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 bg-rose-50/30 text-slate-700 font-medium transition-all"
                                    value={formData.source_warehouse_id}
                                    onChange={e => setFormData({ ...formData, source_warehouse_id: e.target.value })}
                                >
                                    <option value="">Seleccione Origen...</option>
                                    {warehouses.map(w => (
                                        <option key={w.id} value={w.id} disabled={Number(w.id) === Number(formData.target_warehouse_id)}>{w.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Bodega Destino (Entra)</label>
                                <select
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-emerald-50/30 text-slate-700 font-medium transition-all"
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

                    {/* Products Card */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 min-h-[500px] flex flex-col">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-lg border-b border-slate-100 pb-4">
                            <Package className="text-indigo-600" size={20} /> Productos a Trasladar
                        </h3>

                        {/* Product Search */}
                        <div className="relative mb-6 group z-20">
                            <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all bg-slate-50 hover:bg-white group-focus-within:bg-white shadow-sm">
                                <Search className="ml-4 text-slate-400" size={20} />
                                <input
                                    type="text"
                                    className="w-full p-3.5 bg-transparent outline-none font-medium text-slate-700 placeholder:text-slate-400"
                                    placeholder="Buscar producto por nombre o código..."
                                    value={productSearch}
                                    onChange={e => {
                                        setProductSearch(e.target.value);
                                        searchProducts(e.target.value);
                                    }}
                                />
                            </div>
                            {searchResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 bg-white shadow-xl rounded-xl mt-2 border border-slate-100 max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                                    {searchResults.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => addItem(p)}
                                            className="w-full text-left p-4 hover:bg-slate-50 border-b border-slate-50 flex justify-between items-center group transition-colors"
                                        >
                                            <div>
                                                <div className="font-bold text-slate-800 group-hover:text-indigo-600">{p.name}</div>
                                                <div className="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded w-fit mt-1">SKU: {p.sku || 'N/A'}</div>
                                            </div>
                                            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                                <Plus size={16} />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Items List */}
                        <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            {items.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-4 p-4 border border-slate-100 rounded-xl bg-white hover:bg-slate-50/50 hover:border-slate-200 transition-all shadow-sm group">
                                    <div className="flex-1">
                                        <div className="font-bold text-slate-700">{item.name}</div>
                                        <div className="text-xs text-slate-400 mt-0.5">Stock disponible: {item.stock_available}</div>
                                    </div>
                                    <div className="w-32">
                                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block text-center">Cantidad</label>
                                        <input
                                            type="number"
                                            className="w-full p-2 border border-slate-200 rounded-lg text-center font-bold text-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                            value={item.quantity}
                                            onChange={e => updateItemQty(idx, e.target.value)}
                                            min="0.1"
                                            step="0.1"
                                        />
                                    </div>
                                    <button
                                        onClick={() => removeItem(idx)}
                                        className="text-slate-300 hover:text-rose-500 p-2 hover:bg-rose-50 rounded-lg transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            ))}
                            {items.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-center py-12 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/30">
                                    <Package size={48} className="mb-4 opacity-30" />
                                    <p className="font-bold text-slate-500">Lista de traslado vacía</p>
                                    <p className="text-sm">Busca productos arriba para agregarlos</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Actions */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 sticky top-6">
                        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 text-lg border-b border-slate-100 pb-4">
                            <Calendar className="text-indigo-600" size={20} /> Detalles del Envío
                        </h3>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha</label>
                                <input
                                    type="date"
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-700"
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notas / Referencia</label>
                                <textarea
                                    className="w-full p-3 border border-slate-200 rounded-xl resize-none h-32 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700"
                                    placeholder="Razón del traslado, número de guía..."
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                ></textarea>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-100">
                            <div className="bg-indigo-50 rounded-xl p-4 mb-4 flex items-start gap-3">
                                <Truck className="text-indigo-600 shrink-0 mt-1" size={18} />
                                <div className="text-xs text-indigo-800 font-medium">
                                    Estás moviendo <span className="font-bold">{items.length} productos</span> de {warehouses.find(w => w.id == formData.source_warehouse_id)?.name || '...'} a {warehouses.find(w => w.id == formData.target_warehouse_id)?.name || '...'}.
                                </div>
                            </div>

                            <button
                                onClick={handleSubmit}
                                disabled={items.length === 0 || !formData.source_warehouse_id || !formData.target_warehouse_id}
                                className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none flex justify-center items-center gap-2"
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
