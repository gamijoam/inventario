import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Trash2, Settings, ChevronRight, ToggleLeft, ToggleRight, AlertCircle, Check, X } from 'lucide-react';
import axiosInstance from '../../config/axios';
import restaurantService from '../../services/restaurantService';
import toast from 'react-hot-toast';

const ModifierConfig = () => {
    const [products, setProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [groups, setGroups] = useState([]);
    const [loadingGroups, setLoadingGroups] = useState(false);

    // New group form
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupType, setNewGroupType] = useState('SINGLE');
    const [newGroupRequired, setNewGroupRequired] = useState(false);
    const [addingGroup, setAddingGroup] = useState(false);

    // New option form per group
    const [optionForms, setOptionForms] = useState({}); // { [groupId]: { name, price_adjustment, recipe_factor } }

    useEffect(() => {
        axiosInstance.get('/products/', { params: { limit: 200, offset: 0 } })
            .then(res => setProducts(res.data?.data || res.data || []))
            .catch(() => setProducts([]));
    }, []);

    const loadGroups = useCallback(async (productId) => {
        setLoadingGroups(true);
        try {
            const data = await restaurantService.getProductModifiers(productId);
            setGroups(data);
        } catch {
            setGroups([]);
        } finally {
            setLoadingGroups(false);
        }
    }, []);

    const handleSelectProduct = (product) => {
        setSelectedProduct(product);
        setGroups([]);
        setOptionForms({});
        loadGroups(product.id);
    };

    const handleCreateGroup = async () => {
        if (!newGroupName.trim() || !selectedProduct) return;
        setAddingGroup(true);
        try {
            await restaurantService.createModifierGroup(selectedProduct.id, {
                name: newGroupName.trim(),
                selection_type: newGroupType,
                is_required: newGroupRequired,
                options: []
            });
            toast.success('Grupo creado');
            setNewGroupName('');
            loadGroups(selectedProduct.id);
        } catch {
            toast.error('Error creando grupo');
        } finally {
            setAddingGroup(false);
        }
    };

    const handleDeleteGroup = async (groupId) => {
        if (!confirm('¿Eliminar este grupo y todas sus opciones?')) return;
        try {
            await restaurantService.deleteModifierGroup(groupId);
            toast.success('Grupo eliminado');
            loadGroups(selectedProduct.id);
        } catch {
            toast.error('Error eliminando grupo');
        }
    };

    const handleAddOption = async (groupId) => {
        const form = optionForms[groupId] || {};
        if (!form.name?.trim()) return;
        try {
            await restaurantService.addModifierOption(groupId, {
                name: form.name.trim(),
                price_adjustment: parseFloat(form.price_adjustment || 0),
                recipe_factor: parseFloat(form.recipe_factor || 1)
            });
            toast.success('Opción añadida');
            setOptionForms(prev => ({ ...prev, [groupId]: {} }));
            loadGroups(selectedProduct.id);
        } catch {
            toast.error('Error añadiendo opción');
        }
    };

    const handleDeleteOption = async (optionId) => {
        try {
            await restaurantService.deleteModifierOption(optionId);
            toast.success('Opción eliminada');
            loadGroups(selectedProduct.id);
        } catch {
            toast.error('Error eliminando opción');
        }
    };

    const filteredProducts = products.filter(p =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex h-full min-h-screen bg-slate-50 gap-0">
            {/* Left: Product List */}
            <div className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0">
                <div className="p-4 border-b border-slate-100">
                    <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <Settings size={18} className="text-orange-500" /> Modificadores de Productos
                    </h2>
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Buscar producto..."
                            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {filteredProducts.map(p => (
                        <button
                            key={p.id}
                            onClick={() => handleSelectProduct(p)}
                            className={`w-full flex items-center justify-between px-4 py-3 text-left border-b border-slate-50 hover:bg-orange-50 transition
                                ${selectedProduct?.id === p.id ? 'bg-orange-50 border-l-4 border-l-orange-500' : ''}`}>
                            <div>
                                <p className={`text-sm font-semibold ${selectedProduct?.id === p.id ? 'text-orange-700' : 'text-slate-700'}`}>{p.name}</p>
                                <p className="text-xs text-slate-400">${parseFloat(p.price || 0).toFixed(2)}</p>
                            </div>
                            <ChevronRight size={14} className="text-slate-300" />
                        </button>
                    ))}
                </div>
            </div>

            {/* Right: Groups Editor */}
            <div className="flex-1 p-6 overflow-y-auto">
                {!selectedProduct ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
                        <Settings size={48} className="opacity-20" />
                        <p className="text-lg font-medium">Selecciona un producto para configurar sus modificadores</p>
                        <p className="text-sm">Tamaños, Porciones, Extras...</p>
                    </div>
                ) : (
                    <div className="max-w-2xl mx-auto space-y-6">
                        {/* Product Header */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">{selectedProduct.name}</h3>
                                    <p className="text-slate-500 text-sm">Precio base: ${parseFloat(selectedProduct.price || 0).toFixed(2)}</p>
                                </div>
                                <span className="bg-orange-100 text-orange-600 text-xs font-bold px-3 py-1 rounded-full">
                                    {groups.length} grupo{groups.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                        </div>

                        {/* Add Group Form */}
                        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-5 hover:border-orange-300 transition">
                            <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                <Plus size={16} className="text-orange-500" /> Nuevo Grupo de Modificadores
                            </h4>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 block mb-1">Nombre del Grupo</label>
                                    <input
                                        value={newGroupName}
                                        onChange={e => setNewGroupName(e.target.value)}
                                        placeholder='Ej: "Porción", "Extras"'
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 block mb-1">Tipo de selección</label>
                                    <select
                                        value={newGroupType}
                                        onChange={e => setNewGroupType(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 outline-none bg-white">
                                        <option value="SINGLE">Una opción (Radio)</option>
                                        <option value="MULTIPLE">Varias opciones (Extras)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
                                    <button onClick={() => setNewGroupRequired(v => !v)} className="relative">
                                        {newGroupRequired
                                            ? <ToggleRight size={24} className="text-orange-500" />
                                            : <ToggleLeft size={24} className="text-slate-300" />}
                                    </button>
                                    Selección obligatoria
                                </label>
                                <button
                                    onClick={handleCreateGroup}
                                    disabled={!newGroupName.trim() || addingGroup}
                                    className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-bold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition">
                                    {addingGroup ? 'Creando...' : 'Crear Grupo'}
                                </button>
                            </div>
                        </div>

                        {/* Existing Groups */}
                        {loadingGroups ? (
                            <div className="flex justify-center py-8">
                                <div className="animate-spin w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent" />
                            </div>
                        ) : groups.length === 0 ? (
                            <div className="text-center py-8 text-slate-400">
                                <AlertCircle size={32} className="mx-auto mb-2 opacity-30" />
                                <p>Sin grupos de modificadores. Crea el primero.</p>
                            </div>
                        ) : (
                            groups.map(group => (
                                <div key={group.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                    {/* Group Header */}
                                    <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <div>
                                                <span className="font-bold text-slate-800">{group.name}</span>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                                        group.selection_type === 'SINGLE'
                                                            ? 'bg-blue-100 text-blue-600'
                                                            : 'bg-purple-100 text-purple-600'}`}>
                                                        {group.selection_type === 'SINGLE' ? 'Una opción' : 'Varias opciones'}
                                                    </span>
                                                    {group.is_required && (
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 font-semibold">Obligatorio</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <button onClick={() => handleDeleteGroup(group.id)}
                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    {/* Options List */}
                                    <div className="divide-y divide-slate-50">
                                        {group.options.map(opt => (
                                            <div key={opt.id} className="flex items-center justify-between px-5 py-3">
                                                <div>
                                                    <span className="font-semibold text-slate-700 text-sm">{opt.name}</span>
                                                    <div className="flex gap-3 text-xs text-slate-400 mt-0.5">
                                                        <span>Precio: <strong className={parseFloat(opt.price_adjustment) !== 0 ? 'text-green-600' : ''}>
                                                            {parseFloat(opt.price_adjustment) >= 0 ? '+' : ''}{parseFloat(opt.price_adjustment).toFixed(2)}
                                                        </strong></span>
                                                        <span>Factor inventario: <strong>{parseFloat(opt.recipe_factor).toFixed(2)}x</strong></span>
                                                    </div>
                                                </div>
                                                <button onClick={() => handleDeleteOption(opt.id)}
                                                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Add Option Form */}
                                    <div className="px-5 py-4 bg-slate-50/50 border-t border-slate-100">
                                        <div className="grid grid-cols-3 gap-2">
                                            <input
                                                value={optionForms[group.id]?.name || ''}
                                                onChange={e => setOptionForms(prev => ({...prev, [group.id]: {...(prev[group.id]||{}), name: e.target.value}}))}
                                                placeholder='Ej: "1/2 Pollo"'
                                                className="col-span-1 px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-orange-400 outline-none"
                                            />
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={optionForms[group.id]?.price_adjustment || ''}
                                                onChange={e => setOptionForms(prev => ({...prev, [group.id]: {...(prev[group.id]||{}), price_adjustment: e.target.value}}))}
                                                placeholder="+Precio (0.00)"
                                                className="px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-orange-400 outline-none"
                                            />
                                            <div className="flex gap-1">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="10"
                                                    value={optionForms[group.id]?.recipe_factor || ''}
                                                    onChange={e => setOptionForms(prev => ({...prev, [group.id]: {...(prev[group.id]||{}), recipe_factor: e.target.value}}))}
                                                    placeholder="Factor (1.0)"
                                                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-orange-400 outline-none"
                                                />
                                                <button
                                                    onClick={() => handleAddOption(group.id)}
                                                    disabled={!optionForms[group.id]?.name?.trim()}
                                                    className="px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-30 transition flex items-center">
                                                    <Check size={14} />
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-2">Factor inventario: 1.0 = completo, 0.5 = medio, etc.</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ModifierConfig;
