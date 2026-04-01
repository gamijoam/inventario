import React, { useState, useEffect } from 'react';
import { Search, Minus, Plus, X, ChevronRight } from 'lucide-react';
import apiClient from '../../../config/axios';
import { toast } from 'react-hot-toast';

const QuickItemForm = ({ orderId, onClose, onSuccess }) => {
    const [activeTab, setActiveTab]         = useState('inventory');
    const [quantity, setQuantity]           = useState(1);
    const [unitPrice, setUnitPrice]         = useState('');
    const [description, setDescription]     = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [searchTerm, setSearchTerm]       = useState('');
    const [products, setProducts]           = useState([]);
    const [showResults, setShowResults]     = useState(false);
    const [submitting, setSubmitting]       = useState(false);
    const [technicianId, setTechnicianId]   = useState('');
    const [technicians, setTechnicians]     = useState([]);

    // Cargar técnicos reales desde la API
    useEffect(() => {
        apiClient.get('/users/')
            .then(res => {
                const users = Array.isArray(res.data) ? res.data : [];
                setTechnicians(users.filter(u => u.is_active));
            })
            .catch(() => setTechnicians([]));
    }, []);

    // Buscar productos — usa search= (no q=)
    useEffect(() => {
        const t = setTimeout(async () => {
            if (activeTab === 'inventory' && searchTerm.length > 1) {
                try {
                    const res = await apiClient.get(`/products/?search=${encodeURIComponent(searchTerm)}&limit=50`);
                    const items = Array.isArray(res.data) ? res.data : (res.data?.items || []);
                    setProducts(items);
                    setShowResults(items.length > 0);
                } catch { setProducts([]); setShowResults(false); }
            } else {
                setProducts([]); setShowResults(false);
            }
        }, 300);
        return () => clearTimeout(t);
    }, [searchTerm, activeTab]);

    const handleSelectProduct = (product) => {
        setSelectedProduct(product);
        setUnitPrice(String(product.price || product.sale_price || ''));
        setSearchTerm(product.name);
        setShowResults(false);
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setSelectedProduct(null);
        setSearchTerm('');
        setDescription('');
        setUnitPrice('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (activeTab === 'inventory' && !selectedProduct) {
            toast.error('Selecciona un producto del inventario'); return;
        }
        if (activeTab === 'manual' && !description.trim()) {
            toast.error('Describe el servicio'); return;
        }
        if (!unitPrice || parseFloat(unitPrice) <= 0) {
            toast.error('El precio debe ser mayor a 0'); return;
        }

        setSubmitting(true);
        try {
            const payload = {
                product_id:    activeTab === 'inventory' ? selectedProduct.id : null,
                description:   activeTab === 'manual' ? description : selectedProduct.name,
                quantity:      parseInt(quantity),
                unit_price:    parseFloat(unitPrice),
                is_manual:     activeTab === 'manual',
                technician_id: technicianId ? parseInt(technicianId) : null,
            };
            await apiClient.post(`/services/orders/${orderId}/items`, payload);
            toast.success('Ítem agregado');
            onSuccess?.();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al agregar ítem');
        } finally {
            setSubmitting(false);
        }
    };

    const subtotal = parseFloat(unitPrice || 0) * quantity;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-5 flex items-center justify-between rounded-t-2xl">
                    <h2 className="text-xl font-bold">Agregar Ítem a la Orden</h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                        <X size={22} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="border-b border-slate-200 flex">
                    {[
                        { id: 'inventory', label: '📦 Repuesto del Inventario' },
                        { id: 'manual',    label: '🔧 Servicio Manual' },
                    ].map(tab => (
                        <button key={tab.id} type="button"
                            onClick={() => handleTabChange(tab.id)}
                            className={`flex-1 py-3.5 font-semibold text-sm transition-colors ${
                                activeTab === tab.id
                                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                                    : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >{tab.label}</button>
                    ))}
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* ── TAB INVENTARIO ── */}
                    {activeTab === 'inventory' && (
                        <div className="space-y-4">
                            <div className="relative">
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                    Buscar Producto *
                                </label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-3 text-slate-400" size={16} />
                                    <input type="text" value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        placeholder="Nombre o código..."
                                        className="w-full pl-9 pr-4 py-2.5 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                                </div>
                                {showResults && products.length > 0 && (
                                    <div className="absolute z-20 w-full mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                                        {products.map(p => (
                                            <button key={p.id} type="button"
                                                onClick={() => handleSelectProduct(p)}
                                                className="w-full p-3 hover:bg-blue-50 border-b last:border-0 text-left transition-colors">
                                                <p className="font-semibold text-slate-800 text-sm">{p.name}</p>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    Stock: {p.stock ?? '—'} · ${Number(p.price || p.sale_price || 0).toFixed(2)}
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {selectedProduct && (
                                <div className="p-3 bg-blue-50 border-2 border-blue-200 rounded-xl text-sm">
                                    <p className="font-bold text-blue-900">✓ {selectedProduct.name}</p>
                                    <p className="text-blue-600 mt-0.5">Stock: {selectedProduct.stock ?? '—'}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── TAB MANUAL ── */}
                    {activeTab === 'manual' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                    Descripción del Servicio *
                                </label>
                                <input type="text" value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Ej: Cambio de pantalla, Limpieza interior..."
                                    className="w-full px-4 py-2.5 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                            </div>
                        </div>
                    )}

                    {/* ── TÉCNICO (ambos tabs) ── */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            Técnico asignado {activeTab === 'manual' ? '*' : '(opcional)'}
                        </label>
                        <select value={technicianId} onChange={e => setTechnicianId(e.target.value)}
                            className="w-full px-4 py-2.5 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm">
                            <option value="">— Sin técnico asignado —</option>
                            {technicians.map(u => (
                                <option key={u.id} value={u.id}>
                                    {u.full_name || u.username}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* ── CANTIDAD Y PRECIO ── */}
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Cantidad</label>
                            <div className="flex items-center gap-2 border-2 border-slate-200 rounded-xl px-3 py-2">
                                <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
                                    <Minus size={16} className="text-slate-600" />
                                </button>
                                <input type="number" value={quantity}
                                    onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="flex-1 text-center font-bold outline-none text-sm" />
                                <button type="button" onClick={() => setQuantity(quantity + 1)}
                                    className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
                                    <Plus size={16} className="text-slate-600" />
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Precio Unitario *</label>
                            <input type="number" step="0.01" min="0" value={unitPrice}
                                onChange={e => setUnitPrice(e.target.value)}
                                placeholder="0.00"
                                className="w-full px-4 py-2.5 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold" />
                        </div>
                    </div>

                    {/* ── SUBTOTAL ── */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex justify-between items-center">
                        <span className="text-slate-600 font-semibold text-sm">Subtotal</span>
                        <span className="text-xl font-bold text-slate-900">${subtotal.toFixed(2)}</span>
                    </div>

                    {/* ── BOTONES ── */}
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 border-2 border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors text-sm">
                            Cancelar
                        </button>
                        <button type="submit"
                            disabled={submitting || (activeTab === 'inventory' && !selectedProduct) || (activeTab === 'manual' && !technicianId)}
                            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                            {submitting ? 'Agregando...' : <><span>Agregar</span><ChevronRight size={16} /></>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default QuickItemForm;
