import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Save, ToggleLeft, ToggleRight, Zap } from 'lucide-react';
import apiClient from '../../../config/axios';
import { toast } from 'react-hot-toast';

const EMPTY_ITEM = { description: '', unit_price: '', quantity: '1' };

const useProductSearch = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [activeIndex, setActiveIndex] = useState(null);

    useEffect(() => {
        if (!query || query.length < 2) { setResults([]); return; }
        const t = setTimeout(async () => {
            try {
                const res = await apiClient.get(`/products/?search=${encodeURIComponent(query)}`);
                setResults(res.data || []);
            } catch { setResults([]); }
        }, 400);
        return () => clearTimeout(t);
    }, [query]);

    const reset = () => { setQuery(''); setResults([]); setActiveIndex(null); };
    return { query, setQuery, results, activeIndex, setActiveIndex, reset };
};

const EMPTY_FORM = {
    name: '',
    description: '',
    category: '',
    estimated_days: '',
    is_active: true,
    items: [{ ...EMPTY_ITEM }],
};

const ServiceTemplatesManager = ({ onClose }) => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const productSearch = useProductSearch();
    const [searchingItemIndex, setSearchingItemIndex] = useState(null);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/service-templates/all').catch(() => apiClient.get('/service-templates'));
            setTemplates(res.data || []);
        } catch {
            toast.error('Error al cargar plantillas');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTemplates(); }, []);

    const openCreate = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setShowForm(true);
    };

    const openEdit = (t) => {
        setEditingId(t.id);
        setForm({
            name: t.name,
            description: t.description || '',
            category: t.category || '',
            estimated_days: t.estimated_days || '',
            is_active: t.is_active,
            items: t.items.length > 0
                ? t.items.map(i => ({
                    description: i.description,
                    unit_price: String(i.unit_price),
                    quantity: String(i.quantity),
                }))
                : [{ ...EMPTY_ITEM }],
        });
        setShowForm(true);
    };

    const handleItemChange = (index, field, value) => {
        setForm(prev => {
            const items = [...prev.items];
            items[index] = { ...items[index], [field]: value };
            return { ...prev, items };
        });
        if (field === 'description') {
            setSearchingItemIndex(index);
            productSearch.setQuery(value);
        }
    };

    const handleSelectProduct = (index, product) => {
        setForm(prev => {
            const items = [...prev.items];
            items[index] = {
                ...items[index],
                description: product.name,
                unit_price: String(product.price ?? ''),
            };
            return { ...prev, items };
        });
        productSearch.reset();
        setSearchingItemIndex(null);
    };

    const addItem = () => {
        setForm(prev => ({ ...prev, items: [...prev.items, { ...EMPTY_ITEM }] }));
    };

    const removeItem = (index) => {
        setForm(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index),
        }));
    };

    const handleSave = async () => {
        if (!form.name.trim()) { toast.error('El nombre es obligatorio'); return; }
        if (form.items.some(i => !i.description.trim() || !i.unit_price)) {
            toast.error('Todos los ítems deben tener descripción y precio');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                name: form.name.trim(),
                description: form.description.trim() || null,
                category: form.category.trim() || null,
                estimated_days: form.estimated_days ? parseInt(form.estimated_days) : null,
                is_active: form.is_active,
                items: form.items.map(i => ({
                    description: i.description.trim(),
                    unit_price: parseFloat(i.unit_price),
                    quantity: parseFloat(i.quantity) || 1,
                })),
            };

            if (editingId) {
                await apiClient.put(`/service-templates/${editingId}`, payload);
                toast.success('Plantilla actualizada');
            } else {
                await apiClient.post('/service-templates', payload);
                toast.success('Plantilla creada');
            }

            setShowForm(false);
            fetchTemplates();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (t) => {
        try {
            await apiClient.put(`/service-templates/${t.id}`, { is_active: !t.is_active });
            fetchTemplates();
        } catch {
            toast.error('Error al cambiar estado');
        }
    };

    const handleDelete = async (t) => {
        if (!window.confirm(`¿Eliminar la plantilla "${t.name}"? Esta acción no se puede deshacer.`)) return;
        try {
            await apiClient.delete(`/service-templates/${t.id}`);
            toast.success('Plantilla eliminada');
            fetchTemplates();
        } catch {
            toast.error('Error al eliminar');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col z-10">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
                    <div className="flex items-center gap-2">
                        <Zap size={20} className="text-yellow-500" />
                        <h2 className="text-lg font-bold text-gray-800">Plantillas de Servicio</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {!showForm && (
                            <button
                                onClick={openCreate}
                                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
                            >
                                <Plus size={16} /> Nueva
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {/* Form */}
                    {showForm && (
                        <div className="p-6 border-b border-gray-100 bg-gray-50">
                            <h3 className="font-semibold text-gray-800 mb-4 text-sm">
                                {editingId ? 'Editar Plantilla' : 'Nueva Plantilla'}
                            </h3>

                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                                        <input
                                            value={form.name}
                                            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                            className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="Ej: Cambio de Pantalla"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Categoría</label>
                                        <input
                                            value={form.category}
                                            onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                                            className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="Ej: Pantallas"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Descripción (auto-rellena problema)</label>
                                        <input
                                            value={form.description}
                                            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                                            className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="Ej: Cambio de pantalla rota"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Días estimados</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={form.estimated_days}
                                            onChange={e => setForm(p => ({ ...p, estimated_days: e.target.value }))}
                                            className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="Ej: 2"
                                        />
                                    </div>
                                </div>

                                {/* Items */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-medium text-gray-600">Ítems / Servicios *</label>
                                        <button
                                            type="button"
                                            onClick={addItem}
                                            className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                                        >
                                            <Plus size={12} /> Agregar ítem
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {form.items.map((item, i) => (
                                            <div key={i} className="flex gap-2 items-start">
                                                <div className="flex-1 relative">
                                                    <input
                                                        value={item.description}
                                                        onChange={e => handleItemChange(i, 'description', e.target.value)}
                                                        onBlur={() => setTimeout(() => { productSearch.reset(); setSearchingItemIndex(null); }, 200)}
                                                        className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                        placeholder="Descripción o buscar en inventario"
                                                    />
                                                    {searchingItemIndex === i && productSearch.results.length > 0 && (
                                                        <ul className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto text-sm">
                                                            {productSearch.results.map(p => (
                                                                <li
                                                                    key={p.id}
                                                                    onMouseDown={() => handleSelectProduct(i, p)}
                                                                    className="px-3 py-2 hover:bg-indigo-50 cursor-pointer flex justify-between items-center gap-2"
                                                                >
                                                                    <span className="truncate text-gray-800">{p.name}</span>
                                                                    <span className="text-xs text-gray-400 shrink-0">${parseFloat(p.price ?? 0).toFixed(2)}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={item.unit_price}
                                                    onChange={e => handleItemChange(i, 'unit_price', e.target.value)}
                                                    className="w-24 p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    placeholder="Precio"
                                                />
                                                <input
                                                    type="number"
                                                    min="1"
                                                    step="1"
                                                    value={item.quantity}
                                                    onChange={e => handleItemChange(i, 'quantity', e.target.value)}
                                                    className="w-16 p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    placeholder="Cant"
                                                />
                                                {form.items.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeItem(i)}
                                                        className="text-red-400 hover:text-red-600"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={form.is_active}
                                            onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                                            className="rounded"
                                        />
                                        Activa
                                    </label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowForm(false)}
                                            className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1 disabled:opacity-50"
                                        >
                                            <Save size={14} />
                                            {saving ? 'Guardando...' : 'Guardar'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* List */}
                    <div className="p-4">
                        {loading ? (
                            <div className="text-center py-8 text-gray-400 text-sm">Cargando...</div>
                        ) : templates.length === 0 ? (
                            <div className="text-center py-12">
                                <Zap size={32} className="text-gray-300 mx-auto mb-2" />
                                <p className="text-sm text-gray-500">No hay plantillas creadas aún.</p>
                                <button
                                    onClick={openCreate}
                                    className="mt-3 text-indigo-600 text-sm hover:underline font-medium"
                                >
                                    Crear primera plantilla
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {templates.map(t => (
                                    <div
                                        key={t.id}
                                        className={`p-3 rounded-xl border transition-all ${t.is_active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-semibold text-sm text-gray-800">{t.name}</span>
                                                    {t.category && (
                                                        <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                                                            {t.category}
                                                        </span>
                                                    )}
                                                    {t.estimated_days && (
                                                        <span className="text-xs text-gray-400">~{t.estimated_days}d</span>
                                                    )}
                                                    {!t.is_active && (
                                                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactiva</span>
                                                    )}
                                                </div>
                                                {t.description && (
                                                    <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
                                                )}
                                                <div className="flex flex-wrap gap-1 mt-1.5">
                                                    {t.items.map((item, i) => (
                                                        <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                                            {item.description} — ${parseFloat(item.unit_price).toFixed(2)}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    onClick={() => handleToggleActive(t)}
                                                    className={`p-1.5 rounded-lg transition-colors ${t.is_active ? 'text-green-500 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                                                    title={t.is_active ? 'Desactivar' : 'Activar'}
                                                >
                                                    {t.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                                </button>
                                                <button
                                                    onClick={() => openEdit(t)}
                                                    className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Editar"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(t)}
                                                    className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ServiceTemplatesManager;
