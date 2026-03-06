import React, { useState, useEffect } from 'react';
import { X, Search, Grid3x3, Tag, Plus, Check } from 'lucide-react';
import apiClient from '../../../config/axios';
import { toast } from 'react-hot-toast';

const ServiceSelectorModal = ({ isOpen, onClose, onSelectService, selectedServices = [] }) => {
    const [categories, setCategories] = useState([]);
    const [services, setServices] = useState([]);
    const [filteredServices, setFilteredServices] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);

    // Quick category creation
    const [showNewCategory, setShowNewCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [creatingCategory, setCreatingCategory] = useState(false);

    // Fetch categories on mount
    useEffect(() => {
        if (isOpen) {
            fetchCategories();
            fetchServices();
        }
    }, [isOpen]);

    // Filter services when category or search changes
    useEffect(() => {
        filterServices();
    }, [selectedCategory, searchTerm, services]);

    const fetchCategories = async () => {
        try {
            const res = await apiClient.get('/categories');
            setCategories(res.data);
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    const fetchServices = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/products', {
                params: { is_service: true }
            });
            setServices(res.data);
        } catch (error) {
            console.error('Error fetching services:', error);
            toast.error('Error cargando servicios');
        } finally {
            setLoading(false);
        }
    };

    const filterServices = () => {
        let filtered = [...services];

        // Filter by category
        if (selectedCategory) {
            filtered = filtered.filter(s => s.category_id === selectedCategory);
        }

        // Filter by search term
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(s =>
                s.name.toLowerCase().includes(term) ||
                s.description?.toLowerCase().includes(term)
            );
        }

        setFilteredServices(filtered);
    };

    const handleCreateCategory = async () => {
        if (!newCategoryName.trim()) return toast.error('Ingrese nombre de categoría');
        setCreatingCategory(true);
        try {
            await apiClient.post('/categories', { name: newCategoryName.trim(), description: '' });
            toast.success(`Categoría "${newCategoryName.trim()}" creada`);
            setNewCategoryName('');
            setShowNewCategory(false);
            fetchCategories();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Error al crear categoría');
        } finally {
            setCreatingCategory(false);
        }
    };

    const handleSelectService = (service) => {
        onSelectService(service);
        onClose();
        setSearchTerm('');
        setSelectedCategory(null);
    };

    const isServiceSelected = (serviceId) => {
        return selectedServices.some(s => s.product_id === serviceId || s.id === serviceId);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-2xl">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Grid3x3 size={24} />
                        Seleccionar Servicio
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-4 border-b border-slate-100">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 text-slate-400" size={20} />
                        <input
                            type="text"
                            className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                            placeholder="Buscar servicio por nombre..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* Categories Sidebar - Desktop */}
                    <div className="hidden md:block w-64 border-r border-slate-200 overflow-y-auto bg-slate-50">
                        <div className="p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                    <Tag size={14} />
                                    Categorías
                                </h3>
                                <button
                                    onClick={() => setShowNewCategory(!showNewCategory)}
                                    className={`p-1 rounded-md transition-colors ${showNewCategory ? 'bg-rose-100 text-rose-500' : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'}`}
                                    title={showNewCategory ? 'Cancelar' : 'Nueva categoría'}
                                >
                                    {showNewCategory ? <X size={14} /> : <Plus size={14} />}
                                </button>
                            </div>

                            {/* Quick Create Category Form */}
                            {showNewCategory && (
                                <div className="mb-3 p-2 bg-white rounded-lg border border-indigo-200 space-y-2 animate-in fade-in slide-in-from-top-2">
                                    <input
                                        className="w-full p-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="Nombre de categoría..."
                                        value={newCategoryName}
                                        onChange={e => setNewCategoryName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleCreateCategory()}
                                        autoFocus
                                    />
                                    <button
                                        onClick={handleCreateCategory}
                                        disabled={creatingCategory}
                                        className="w-full px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                                    >
                                        {creatingCategory ? 'Creando...' : <><Check size={12} /> Crear Categoría</>}
                                    </button>
                                </div>
                            )}

                            <div className="space-y-1">
                                <button
                                    onClick={() => setSelectedCategory(null)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedCategory === null
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'text-slate-700 hover:bg-slate-100'
                                        }`}
                                >
                                    Todos los servicios
                                </button>
                                {categories.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setSelectedCategory(cat.id)}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedCategory === cat.id
                                            ? 'bg-indigo-600 text-white shadow-md'
                                            : 'text-slate-700 hover:bg-slate-100'
                                            }`}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Categories Tabs - Mobile */}
                    <div className="md:hidden border-b border-slate-200">
                        <div className="flex gap-2 p-3 min-w-max overflow-x-auto">
                            <button
                                onClick={() => setSelectedCategory(null)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === null
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'bg-slate-100 text-slate-700'
                                    }`}
                            >
                                Todos
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === cat.id
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'bg-slate-100 text-slate-700'
                                        }`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                            <button
                                onClick={() => setShowNewCategory(!showNewCategory)}
                                className="px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap bg-indigo-100 text-indigo-600"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                        {/* Mobile quick create */}
                        {showNewCategory && (
                            <div className="px-3 pb-3 flex gap-2 animate-in fade-in slide-in-from-top-2">
                                <input
                                    className="flex-1 p-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="Nombre de categoría..."
                                    value={newCategoryName}
                                    onChange={e => setNewCategoryName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleCreateCategory()}
                                    autoFocus
                                />
                                <button
                                    onClick={handleCreateCategory}
                                    disabled={creatingCategory}
                                    className="px-3 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {creatingCategory ? '...' : <Check size={14} />}
                                </button>
                                <button onClick={() => { setShowNewCategory(false); setNewCategoryName(''); }} className="p-2 text-slate-400">
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Services Grid */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-slate-400">Cargando servicios...</div>
                            </div>
                        ) : filteredServices.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <Grid3x3 size={48} className="mb-3 opacity-50" />
                                <p className="text-sm">No se encontraron servicios</p>
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="mt-2 text-xs text-indigo-600 hover:underline"
                                    >
                                        Limpiar búsqueda
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {filteredServices.map(service => {
                                    const isSelected = isServiceSelected(service.id);
                                    return (
                                        <button
                                            key={service.id}
                                            onClick={() => handleSelectService(service)}
                                            className={`p-4 rounded-xl border-2 transition-all text-left hover:shadow-lg ${isSelected
                                                ? 'border-emerald-500 bg-emerald-50'
                                                : 'border-slate-200 hover:border-indigo-400 bg-white'
                                                }`}
                                        >
                                            <div className="font-bold text-slate-800 text-sm mb-1 line-clamp-2">
                                                {service.name}
                                            </div>
                                            <div className="text-lg font-black text-indigo-600">
                                                ${Number(service.price || 0).toFixed(2)}
                                            </div>
                                            {service.unit_type && (
                                                <div className="text-xs text-slate-500 mt-1">
                                                    {service.unit_type}
                                                </div>
                                            )}
                                            {isSelected && (
                                                <div className="mt-2 text-xs text-emerald-600 font-semibold">
                                                    ✓ En el carrito
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
                    <div className="flex justify-between items-center text-sm text-slate-600">
                        <span>{filteredServices.length} servicio{filteredServices.length !== 1 ? 's' : ''} disponible{filteredServices.length !== 1 ? 's' : ''}</span>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium transition-colors"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ServiceSelectorModal;
