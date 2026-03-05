import React, { useState, useEffect } from 'react';
import { useConfig } from '../../context/ConfigContext';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import { Plus, Trash2, Search, GripVertical, X, ChefHat } from 'lucide-react';

const MenuManager = () => {
    const { business } = useConfig();
    const [sections, setSections] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [newSectionName, setNewSectionName] = useState('');
    const [draggedProduct, setDraggedProduct] = useState(null);
    const [activeDropZone, setActiveDropZone] = useState(null);

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
            toast.error("El nombre de la sección no puede estar vacío");
            return;
        }

        try {
            await apiClient.post('/restaurant/menu/sections', { name: newSectionName });
            setNewSectionName('');
            loadData();
            toast.success('Sección creada correctamente');
        } catch (error) {
            console.error("Error creating section:", error);
            const msg = error.response?.data?.detail || "Error desconocido";
            toast.error(`Error creando sección: ${msg}`);
        }
    };

    const handleDeleteSection = async (id) => {
        if (!window.confirm('¿Borrar sección y todos sus items?')) return;
        try {
            await apiClient.delete(`/restaurant/menu/sections/${id}`);
            loadData();
            toast.success('Sección eliminada');
        } catch (error) {
            toast.error('Error borrando sección');
        }
    };

    const handleAddItem = async (sectionId, product) => {
        try {
            await apiClient.post('/restaurant/menu/items', {
                section_id: sectionId,
                product_id: product.id,
                alias: product.name,
                price_override: null
            });
            loadData();
            toast.success(`Agregado: ${product.name}`);
        } catch (error) {
            toast.error('Error agregando producto');
        }
    };

    const handleRemoveItem = async (itemId) => {
        try {
            await apiClient.delete(`/restaurant/menu/items/${itemId}`);
            loadData();
        } catch (error) {
            toast.error('Error removiendo item');
        }
    };

    // Filter products for sidebar
    const filteredProducts = products.filter(p =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.sku && p.sku.includes(searchTerm))
    );

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                    <p className="text-slate-500">Cargando menú...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-50">

            {/* LEFT: Product Catalog */}
            <div className="w-80 bg-white border-r border-slate-200 flex flex-col shadow-sm">
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                    <h2 className="font-bold text-base text-slate-700 flex items-center gap-2">
                        📦 Productos Disponibles
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">{products.length} productos</p>
                    <div className="relative mt-2">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar producto o código..."
                            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                    {filteredProducts.length === 0 && (
                        <p className="text-center text-sm text-slate-400 py-8">No se encontraron productos</p>
                    )}
                    {filteredProducts.map(product => (
                        <div
                            key={product.id}
                            className="p-3 bg-slate-50 rounded-lg border border-slate-100 cursor-grab hover:bg-indigo-50 hover:border-indigo-200 transition-all group"
                            draggable
                            onDragStart={() => setDraggedProduct(product)}
                            onDragEnd={() => setDraggedProduct(null)}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm text-slate-700 truncate">{product.name}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs text-emerald-600 font-semibold">${Number(product.price).toFixed(2)}</span>
                                        {product.sku && <span className="text-[10px] text-slate-400">{product.sku}</span>}
                                    </div>
                                </div>
                                {/* Dropdown: add to section */}
                                {sections.length > 0 && (
                                    <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
                                        <select
                                            className="text-xs bg-indigo-600 text-white rounded px-2 py-1 cursor-pointer appearance-none font-medium"
                                            defaultValue=""
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    handleAddItem(parseInt(e.target.value), product);
                                                    e.target.value = '';
                                                }
                                            }}
                                        >
                                            <option value="" disabled>+ Agregar</option>
                                            {sections.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* RIGHT: Menu Structure */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center">
                    <div>
                        <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                            <ChefHat size={22} className="text-indigo-600" />
                            Estructura del Menú
                        </h2>
                        <p className="text-xs text-slate-400">{sections.length} secciones</p>
                    </div>
                    <form onSubmit={handleCreateSection} className="flex gap-2">
                        <input
                            type="text"
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-56"
                            placeholder="Nueva Sección (Ej: Bebidas)"
                            value={newSectionName}
                            onChange={(e) => setNewSectionName(e.target.value)}
                        />
                        <button
                            type="submit"
                            className="flex items-center gap-1 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 transition font-medium"
                        >
                            <Plus size={16} />
                            Crear
                        </button>
                    </form>
                </div>

                {/* Sections */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {sections.length === 0 && (
                        <div className="text-center py-20">
                            <p className="text-6xl mb-4">📋</p>
                            <p className="text-slate-400 text-lg">Tu menú está vacío</p>
                            <p className="text-slate-400 text-sm mt-1">Crea una sección para empezar a agregar productos</p>
                        </div>
                    )}

                    {sections.map(section => (
                        <div
                            key={section.id}
                            className={`border-2 rounded-xl p-5 transition-all ${activeDropZone === section.id
                                    ? 'border-indigo-400 bg-indigo-50/50 shadow-md'
                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                }`}
                            onDragOver={(e) => {
                                e.preventDefault();
                                setActiveDropZone(section.id);
                            }}
                            onDragLeave={() => setActiveDropZone(null)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setActiveDropZone(null);
                                if (draggedProduct) {
                                    handleAddItem(section.id, draggedProduct);
                                    setDraggedProduct(null);
                                }
                            }}
                        >
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-2">
                                    <GripVertical size={16} className="text-slate-300" />
                                    <h3 className="font-bold text-lg text-slate-700">{section.name}</h3>
                                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                        {section.items.length} items
                                    </span>
                                </div>
                                <button
                                    onClick={() => handleDeleteSection(section.id)}
                                    className="flex items-center gap-1 text-red-400 hover:text-red-600 text-xs font-medium transition"
                                >
                                    <Trash2 size={14} />
                                    Eliminar
                                </button>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {section.items.map(item => (
                                    <div key={item.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100 relative group hover:shadow-sm transition-all">
                                        <button
                                            onClick={() => handleRemoveItem(item.id)}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                        >
                                            <X size={12} />
                                        </button>
                                        <p className="font-medium text-sm truncate text-slate-700" title={item.alias || item.product_name}>
                                            {item.alias || item.product_name}
                                        </p>
                                        <p className="text-xs text-emerald-600 font-semibold mt-0.5">${Number(item.price).toFixed(2)}</p>
                                    </div>
                                ))}
                                {section.items.length === 0 && (
                                    <div className="col-span-full py-8 text-center text-slate-400 text-sm italic border-2 border-dashed border-slate-200 rounded-lg">
                                        {draggedProduct ? '⬇️ Suelta aquí para agregar' : 'Arrastra productos aquí o usa el botón "+" en la lista'}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default MenuManager;
