import React, { useState, useEffect, useMemo } from 'react';
import { useConfig } from '../../context/ConfigContext';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import { Plus, Trash2, Search, GripVertical, X, ChefHat, Check, Edit2, Box } from 'lucide-react';
import { normalizeSearch } from '../../utils/search';

const MenuManager = () => {
    const [sections, setSections] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [newSectionName, setNewSectionName] = useState('');
    const [draggedProduct, setDraggedProduct] = useState(null);
    const [activeDropZone, setActiveDropZone] = useState(null);

    // Edit Alias State
    const [editingItemId, setEditingItemId] = useState(null);
    const [editAliasValue, setEditAliasValue] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [menuRes, prodRes] = await Promise.all([
                apiClient.get('/restaurant/menu/full'),
                apiClient.get('/products?limit=1000')
            ]);
            // Ensure sections always have items array
            const safeSections = (menuRes.data.sections || []).map(s => ({
                ...s,
                items: s.items || []
            }));
            setSections(safeSections);
            setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
        } catch (error) {
            console.error(error);
            toast.error('Error cargando menú');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSection = async (e) => {
        e.preventDefault();
        if (!newSectionName.trim()) {
            toast.error("El nombre de la categoría es obligatorio");
            return;
        }

        try {
            await apiClient.post('/restaurant/menu/sections', { name: newSectionName });
            setNewSectionName('');
            loadData();
            toast.success('Categoría creada correctamente');
        } catch (error) {
            const msg = error.response?.data?.detail || "Error desconocido";
            toast.error(`Error: ${msg}`);
        }
    };

    const handleDeleteSection = async (id, name) => {
        if (!window.confirm(`¿Estás seguro de eliminar la categoría "${name}" y quitar todos los platos que contiene?`)) return;
        try {
            await apiClient.delete(`/restaurant/menu/sections/${id}`);
            loadData();
            toast.success('Categoría eliminada');
        } catch (err) {
            toast.error('Error borrando categoría');
        }
    };

    const handleAddItem = async (sectionId, product) => {
        try {
            await apiClient.post('/restaurant/menu/items', {
                section_id: sectionId,
                product_id: product.id,
                alias: product.name, // Default to product name
                price_override: null
            });
            loadData();
            toast.success(`${product.name} agregado al menú`);
        } catch (error) {
            toast.error('Error agregando plato');
        }
    };

    const handleRemoveItem = async (itemId) => {
        if (!window.confirm('¿Quitar este plato del menú?')) return;
        try {
            await apiClient.delete(`/restaurant/menu/items/${itemId}`);
            loadData();
        } catch (err) {
            toast.error('Error removiendo plato');
        }
    };

    const handleUpdateAlias = async (itemId) => {
        if (!editAliasValue.trim()) {
            setEditingItemId(null);
            return;
        }
        try {
            // Note: The backend schema needs an endpoint to update menu item alias.
            // If it doesn't exist, we will mock it or fail gracefully.
            // Assuming `PUT /restaurant/menu/items/{id}` exists in your backend.
            await apiClient.put(`/restaurant/menu/items/${itemId}`, {
                alias: editAliasValue
            });
            toast.success('Nombre comercial actualizado');
            loadData();
        } catch (error) {
            // Fallback if endpoint is missing
            toast.error(error.response?.data?.detail || 'No se pudo actualizar el nombre comercial');
        } finally {
            setEditingItemId(null);
        }
    };

    // --- Computed Values ---
    const menuProductIds = useMemo(() => {
        const ids = new Set();
        sections.forEach(s => s.items.forEach(i => ids.add(i.product_id)));
        return ids;
    }, [sections]);

    const filteredProducts = useMemo(() => {
        const term = normalizeSearch(searchTerm);
        return products.filter(p =>
            normalizeSearch(p.name).includes(term) ||
            (p.sku && p.sku.toLowerCase().includes(term.toLowerCase()))
        );
    }, [products, searchTerm]);


    // --- Drag & Drop Handlers ---
    const onDragStart = (e, product) => {
        setDraggedProduct(product);
        e.dataTransfer.effectAllowed = 'copy';
        // Make the drag ghost look nice if possible
        e.dataTransfer.setData('text/plain', product.id);
    };

    const onDragOver = (e, sectionId) => {
        e.preventDefault();
        setActiveDropZone(sectionId);
    };

    const onDragLeave = () => {
        setActiveDropZone(null);
    };

    const onDrop = (e, sectionId) => {
        e.preventDefault();
        setActiveDropZone(null);
        if (draggedProduct) {
            handleAddItem(sectionId, draggedProduct);
            setDraggedProduct(null);
        }
    };


    if (loading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600"></div>
                    <p className="text-slate-500 font-bold animate-pulse">Cargando menú interactivo...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-4rem)] bg-slate-50 overflow-hidden">

            {/* LEFT: Product Catalog (Inventario) */}
            <div className="w-1/3 max-w-sm bg-white border-r border-slate-200 flex flex-col shadow-sm z-10">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 mb-1">
                        <Box className="text-indigo-600" /> Inventario Maestro
                    </h2>
                    <p className="text-xs font-bold text-slate-400 mb-4 uppercase tracking-wider">
                        Arrastra los productos al menú
                    </p>
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar producto o código..."
                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {filteredProducts.length === 0 && (
                        <div className="text-center py-10">
                            <Box size={40} className="mx-auto text-slate-300 mb-2" />
                            <p className="text-sm font-bold text-slate-400">No se encontraron productos</p>
                        </div>
                    )}
                    {filteredProducts.map(product => {
                        const inMenu = menuProductIds.has(product.id);
                        return (
                            <div
                                key={product.id}
                                className={`p-4 rounded-xl border-2 transition-all cursor-grab active:cursor-grabbing group ${inMenu
                                        ? 'border-emerald-100 bg-emerald-50/30 opacity-70'
                                        : 'border-transparent bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 shadow-sm'
                                    }`}
                                draggable
                                onDragStart={(e) => onDragStart(e, product)}
                                onDragEnd={() => setDraggedProduct(null)}
                            >
                                <div className="flex justify-between items-center">
                                    <div className="flex-1 min-w-0 pr-3">
                                        <p className={`font-bold text-sm truncate ${inMenu ? 'text-emerald-800' : 'text-slate-700 group-hover:text-indigo-900'}`}>
                                            {product.name}
                                        </p>
                                        <div className="flex items-center gap-3 mt-1.5">
                                            <span className="text-xs font-black text-emerald-600">${Number(product.price).toFixed(2)}</span>
                                            {product.sku && <span className="text-[10px] text-slate-400 font-mono bg-white px-1.5 py-0.5 rounded border border-slate-100 shadow-sm">{product.sku}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {inMenu && (
                                            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-1 rounded-lg flex items-center gap-1">
                                                <Check size={10} /> En Menú
                                            </span>
                                        )}
                                        <GripVertical size={18} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* RIGHT: Menu Structure (El Menú del Restaurante) */}
            <div className="flex-1 flex flex-col bg-slate-50/50 relative">
                {/* Header */}
                <div className="bg-white border-b border-slate-200 p-6 shadow-sm flex justify-between items-center sticky top-0 z-10">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                            <ChefHat className="text-indigo-600" size={32} /> El Menú (Vitrina)
                        </h1>
                        <p className="text-slate-500 mt-1 font-medium">
                            Organiza cómo verán los productos tus meseros y cajeros.
                        </p>
                    </div>
                    
                    <form onSubmit={handleCreateSection} className="flex gap-2 items-center bg-slate-50 p-2 rounded-2xl border border-slate-100 shadow-sm">
                        <input
                            type="text"
                            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-64 font-medium transition-all"
                            placeholder="Ej: Entradas, Bebidas, Postres..."
                            value={newSectionName}
                            onChange={(e) => setNewSectionName(e.target.value)}
                        />
                        <button
                            type="submit"
                            disabled={!newSectionName.trim()}
                            className="flex items-center gap-1.5 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm hover:bg-indigo-700 active:scale-95 transition-all font-black shadow-md shadow-indigo-200 disabled:opacity-50 disabled:active:scale-100"
                        >
                            <Plus size={18} />
                            Crear Categoría
                        </button>
                    </form>
                </div>

                {/* Sections Grid */}
                <div className="flex-1 overflow-y-auto p-6">
                    {sections.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <div className="w-24 h-24 bg-white shadow-sm border border-slate-100 rounded-full flex items-center justify-center mb-6">
                                <ChefHat size={40} className="text-indigo-300" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-600 mb-2">Tu menú está vacío</h2>
                            <p className="text-center max-w-md text-slate-500">
                                Comienza creando una categoría arriba (ej. "Bebidas") y luego arrastra los productos desde el inventario.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-20">
                            {sections.map(section => (
                                <div
                                    key={section.id}
                                    className={`flex flex-col bg-white rounded-2xl border-2 shadow-sm transition-all overflow-hidden ${
                                        activeDropZone === section.id
                                            ? 'border-indigo-400 ring-4 ring-indigo-50 scale-[1.01]'
                                            : 'border-slate-200 hover:border-slate-300'
                                    }`}
                                    onDragOver={(e) => onDragOver(e, section.id)}
                                    onDragLeave={onDragLeave}
                                    onDrop={(e) => onDrop(e, section.id)}
                                >
                                    {/* Section Header */}
                                    <div className={`p-4 flex justify-between items-center border-b transition-colors ${activeDropZone === section.id ? 'bg-indigo-50/50 border-indigo-100' : 'bg-slate-50 border-slate-100'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                                <GripVertical size={16} />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-lg text-slate-800">{section.name}</h3>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                    {section.items.length} Platos
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteSection(section.id, section.name)}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                            title="Eliminar categoría"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>

                                    {/* Section Items (Dropzone) */}
                                    <div className="p-4 flex-1 min-h-[150px]">
                                        {section.items.length === 0 ? (
                                            <div className={`h-full flex items-center justify-center border-2 border-dashed rounded-xl transition-colors ${activeDropZone === section.id ? 'border-indigo-400 bg-indigo-50/50 text-indigo-600' : 'border-slate-200 text-slate-400'}`}>
                                                <p className="font-bold text-sm flex items-center gap-2">
                                                    {activeDropZone === section.id ? (
                                                        <>⬇️ ¡Suelta el producto aquí!</>
                                                    ) : (
                                                        <>Arrastra productos a esta categoría</>
                                                    )}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-3">
                                                {section.items.map(item => (
                                                    <div key={item.id} className="group relative bg-slate-50 border border-slate-100 p-3 rounded-xl hover:shadow-md hover:border-indigo-200 transition-all flex flex-col justify-between h-24">
                                                        
                                                        {/* Remove Button */}
                                                        <button
                                                            onClick={() => handleRemoveItem(item.id)}
                                                            className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-red-100 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-sm hover:bg-red-50 hover:text-red-600 transition-all z-10"
                                                            title="Quitar del menú"
                                                        >
                                                            <X size={14} />
                                                        </button>

                                                        <div className="flex-1 min-w-0">
                                                            {editingItemId === item.id ? (
                                                                <div className="flex items-center gap-1">
                                                                    <input 
                                                                        type="text"
                                                                        autoFocus
                                                                        className="w-full text-sm font-bold text-slate-800 bg-white border border-indigo-300 rounded px-1.5 py-0.5 outline-none"
                                                                        value={editAliasValue}
                                                                        onChange={e => setEditAliasValue(e.target.value)}
                                                                        onKeyDown={e => {
                                                                            if (e.key === 'Enter') handleUpdateAlias(item.id);
                                                                            if (e.key === 'Escape') setEditingItemId(null);
                                                                        }}
                                                                        onBlur={() => handleUpdateAlias(item.id)}
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <div className="flex justify-between items-start gap-1">
                                                                    <p 
                                                                        className="font-bold text-sm text-slate-700 leading-tight line-clamp-2"
                                                                        title={item.alias || item.product_name}
                                                                    >
                                                                        {item.alias || item.product_name}
                                                                    </p>
                                                                    <button 
                                                                        onClick={() => {
                                                                            setEditingItemId(item.id);
                                                                            setEditAliasValue(item.alias || item.product_name);
                                                                        }}
                                                                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition-opacity p-1"
                                                                        title="Editar nombre comercial (Alias)"
                                                                    >
                                                                        <Edit2 size={12} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                            
                                                            {/* Show original product name if alias is different */}
                                                            {item.alias && item.alias !== item.product_name && editingItemId !== item.id && (
                                                                <p className="text-[9px] text-slate-400 truncate mt-0.5" title={`Original: ${item.product_name}`}>
                                                                    Ref: {item.product_name}
                                                                </p>
                                                            )}
                                                        </div>

                                                        <div className="mt-2 text-right">
                                                            <span className="inline-block bg-white border border-slate-100 shadow-sm text-emerald-600 font-black text-xs px-2 py-0.5 rounded-lg">
                                                                ${Number(item.price).toFixed(2)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MenuManager;