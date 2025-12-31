import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, FolderTree, Folder, Tags, X, Check } from 'lucide-react';
import apiClient from '../config/axios';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

const Categories = () => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const response = await apiClient.get('/categories');
            setCategories(response.data);
        } catch (error) {
            console.error('Error fetching categories:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`¿Eliminar la categoría "${name}"?`)) return;

        try {
            await apiClient.delete(`/categories/${id}`);
            fetchCategories();
        } catch (error) {
            alert(error.response?.data?.detail || 'Error al eliminar categoría');
        }
    };

    const openCreateModal = () => {
        setEditingCategory(null);
        setShowModal(true);
    };

    const openEditModal = (category) => {
        setEditingCategory(category);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingCategory(null);
    };

    const handleSuccess = () => {
        fetchCategories();
        closeModal();
    };

    // Organize categories hierarchically
    const rootCategories = categories.filter(cat => !cat.parent_id);
    const getChildren = (parentId) => categories.filter(cat => cat.parent_id === parentId);

    if (loading) return <div className="p-12 text-center text-slate-400">Cargando categorías...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center">
                        <Tags className="mr-2 text-indigo-600" /> Categorías de Productos
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Organiza tu inventario en categorías y subcategorías.</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5 transition-all font-bold text-sm flex items-center justify-center gap-2"
                >
                    <Plus size={18} />
                    Nueva Categoría
                </button>
            </div>

            {/* Desktop Table (Zebra Bento) */}
            <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/50">
                        <tr>
                            <th className="text-left px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Nombre</th>
                            <th className="text-left px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Descripción</th>
                            <th className="text-left px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Tipo</th>
                            <th className="text-right px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 bg-white">
                        {rootCategories.map((category, index) => (
                            <CategoryRow
                                key={category.id}
                                category={category}
                                level={0}
                                getChildren={getChildren}
                                onEdit={openEditModal}
                                onDelete={handleDelete}
                                isEven={index % 2 === 0}
                            />
                        ))}
                        {rootCategories.length === 0 && (
                            <tr>
                                <td colSpan="4" className="text-center py-12 text-slate-400 font-medium">
                                    No hay categorías. Crea una para comenzar.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-4">
                {rootCategories.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 font-medium bg-white rounded-xl border border-slate-200">
                        No hay categorías. Crea una para comenzar.
                    </div>
                ) : (
                    rootCategories.map(category => (
                        <MobileCategoryItem
                            key={category.id}
                            category={category}
                            level={0}
                            getChildren={getChildren}
                            onEdit={openEditModal}
                            onDelete={handleDelete}
                        />
                    ))
                )}
            </div>

            {showModal && (
                <CategoryModal
                    category={editingCategory}
                    categories={categories}
                    onClose={closeModal}
                    onSuccess={handleSuccess}
                />
            )}
        </div>
    );
};

// Recursive component for Desktop Table
const CategoryRow = ({ category, level, getChildren, onEdit, onDelete, isEven }) => {
    const children = getChildren(category.id);
    const indent = level * 32;

    return (
        <>
            <tr className={clsx(
                "transition-colors duration-200 hover:bg-indigo-50/40",
                isEven ? "bg-white" : "bg-slate-50/30"
            )}>
                <td className="px-6 py-4">
                    <div className="flex items-center" style={{ paddingLeft: `${indent}px` }}>
                        {level === 0 ? (
                            <div className="bg-indigo-50 p-1.5 rounded-lg mr-3 text-indigo-600 border border-indigo-100">
                                <FolderTree size={16} />
                            </div>
                        ) : (
                            <div className="relative mr-3 before:absolute before:content-[''] before:w-4 before:h-[1px] before:bg-slate-300 before:-left-4 before:top-1/2">
                                <Folder size={16} className="text-slate-400" />
                            </div>
                        )}
                        <span className={`font-bold ${level === 0 ? 'text-slate-800' : 'text-slate-600'}`}>
                            {category.name}
                        </span>
                    </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">{category.description || <span className="text-slate-300 italic">Sin descripción</span>}</td>
                <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${level === 0
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                        {level === 0 ? 'Principal' : 'Subcategoría'}
                    </span>
                </td>
                <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={() => onEdit(category)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Editar"
                        >
                            <Edit2 size={16} />
                        </button>
                        <button
                            onClick={() => onDelete(category.id, category.name)}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Eliminar"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </td>
            </tr>
            {children.map((child, idx) => (
                <CategoryRow
                    key={child.id}
                    category={child}
                    level={level + 1}
                    getChildren={getChildren}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    isEven={isEven} // Keep background consistent for children block or alternate? Let's keep consistent for tree clarity or just inherit.
                />
            ))}
        </>
    );
};

// Recursive component for Mobile List
const MobileCategoryItem = ({ category, level, getChildren, onEdit, onDelete }) => {
    const children = getChildren(category.id);
    const indent = level * 12;

    return (
        <div className="flex flex-col gap-2">
            <div
                className={clsx(
                    "bg-white p-4 rounded-xl shadow-sm border border-slate-200",
                    level > 0 && "ml-4 border-l-4 border-l-slate-200"
                )}
            // style={{ marginLeft: `${indent}px` }} // Use tailwind margin for cleaner nesting
            >
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center">
                        {level === 0 ? (
                            <div className="bg-indigo-50 p-1.5 rounded-lg mr-2 text-indigo-600 border border-indigo-100">
                                <FolderTree size={16} />
                            </div>
                        ) : (
                            <Folder size={16} className="mr-2 text-slate-400" />
                        )}
                        <h3 className="font-bold text-slate-800">{category.name}</h3>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide border ${level === 0
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                        {level === 0 ? 'root' : 'sub'}
                    </span>
                </div>

                {category.description && (
                    <p className="text-slate-500 text-sm mb-3 pl-8">{category.description}</p>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-2">
                    <button
                        onClick={() => onEdit(category)}
                        className="flex items-center text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg font-bold text-xs transition-colors"
                    >
                        <Edit2 size={14} className="mr-1.5" /> Editar
                    </button>
                    <button
                        onClick={() => onDelete(category.id, category.name)}
                        className="flex items-center text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-2 rounded-lg font-bold text-xs transition-colors"
                    >
                        <Trash2 size={14} className="mr-1.5" /> Eliminar
                    </button>
                </div>
            </div>
            {children.map(child => (
                <MobileCategoryItem
                    key={child.id}
                    category={child}
                    level={level + 1}
                    getChildren={getChildren}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            ))}
        </div>
    );
};

// Modal for Create/Edit
const CategoryModal = ({ category, categories, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        name: category?.name || '',
        description: category?.description || '',
        parent_id: category?.parent_id || null
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                ...formData,
                parent_id: formData.parent_id || null
            };

            if (category) {
                await apiClient.put(`/categories/${category.id}`, payload);
            } else {
                await apiClient.post('/categories', payload);
            }

            onSuccess();
        } catch (error) {
            alert(error.response?.data?.detail || 'Error al guardar categoría');
        } finally {
            setLoading(false);
        }
    };

    // Filter out current category and its children from parent options
    const availableParents = category
        ? categories.filter(cat => cat.id !== category.id && cat.parent_id !== category.id)
        : categories;

    return (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        {category ? <Edit2 size={20} className="text-indigo-600" /> : <Plus size={20} className="text-indigo-600" />}
                        {category ? 'Editar Categoría' : 'Nueva Categoría'}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                            Nombre <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-700 placeholder:text-slate-300"
                            placeholder="Ej. Herramientas Manuales"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                            Descripción
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-700 placeholder:text-slate-300 resize-none"
                            rows="3"
                            placeholder="Breve descripción de la categoría..."
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                            Categoría Padre (Opcional)
                        </label>
                        <div className="relative">
                            <select
                                value={formData.parent_id || ''}
                                onChange={(e) => setFormData({ ...formData, parent_id: e.target.value ? parseInt(e.target.value) : null })}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-700 bg-white appearance-none"
                            >
                                <option value="">-- Categoría Principal --</option>
                                {availableParents.filter(cat => !cat.parent_id).map(cat => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <FolderTree size={16} />
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1.5 font-medium ml-1">
                            Selecciona una categoría padre para crear una subcategoría.
                        </p>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                        >
                            {loading ? 'Guardando...' : (
                                <>
                                    <Check size={18} /> Guardar
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Categories;
