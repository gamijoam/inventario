import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, FolderTree, Folder } from 'lucide-react';
import apiClient from '../config/axios';

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

    if (loading) return <div className="p-6">Cargando...</div>;

    return (
        <div className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Categorías</h1>
                    <p className="text-gray-600">Gestiona las categorías y subcategorías de productos</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="w-full md:w-auto flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow transition-colors"
                >
                    <Plus size={20} className="mr-2" />
                    Nueva Categoría
                </button>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-white rounded-lg shadow">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="text-left p-4 font-semibold text-gray-700">Nombre</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Descripción</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Tipo</th>
                            <th className="text-right p-4 font-semibold text-gray-700">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {rootCategories.map(category => (
                            <CategoryRow
                                key={category.id}
                                category={category}
                                level={0}
                                getChildren={getChildren}
                                onEdit={openEditModal}
                                onDelete={handleDelete}
                            />
                        ))}
                        {rootCategories.length === 0 && (
                            <tr>
                                <td colSpan="4" className="text-center p-8 text-gray-500">
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
                    <div className="text-center p-8 text-gray-500 bg-white rounded-lg shadow">
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
const CategoryRow = ({ category, level, getChildren, onEdit, onDelete }) => {
    const children = getChildren(category.id);
    const indent = level * 32;

    return (
        <>
            <tr className="hover:bg-gray-50">
                <td className="p-4">
                    <div className="flex items-center" style={{ paddingLeft: `${indent}px` }}>
                        {level === 0 ? (
                            <FolderTree size={18} className="mr-2 text-blue-600" />
                        ) : (
                            <Folder size={18} className="mr-2 text-gray-500" />
                        )}
                        <span className="font-medium text-gray-800">{category.name}</span>
                    </div>
                </td>
                <td className="p-4 text-gray-600">{category.description || '-'}</td>
                <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${level === 0
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                        }`}>
                        {level === 0 ? 'Principal' : 'Subcategoría'}
                    </span>
                </td>
                <td className="p-4">
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={() => onEdit(category)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Editar"
                        >
                            <Edit2 size={16} />
                        </button>
                        <button
                            onClick={() => onDelete(category.id, category.name)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Eliminar"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </td>
            </tr>
            {children.map(child => (
                <CategoryRow
                    key={child.id}
                    category={child}
                    level={level + 1}
                    getChildren={getChildren}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            ))}
        </>
    );
};

// Recursive component for Mobile List
const MobileCategoryItem = ({ category, level, getChildren, onEdit, onDelete }) => {
    const children = getChildren(category.id);
    const indent = level * 16; // Smaller indent for mobile

    return (
        <div className="flex flex-col gap-2">
            <div className="bg-white p-4 rounded-lg shadow border border-gray-100" style={{ marginLeft: `${indent}px` }}>
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center">
                        {level === 0 ? (
                            <FolderTree size={18} className="mr-2 text-blue-600" />
                        ) : (
                            <Folder size={18} className="mr-2 text-gray-500" />
                        )}
                        <h3 className="font-bold text-gray-800">{category.name}</h3>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${level === 0
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                        }`}>
                        {level === 0 ? 'Principal' : 'Sub'}
                    </span>
                </div>

                {category.description && (
                    <p className="text-gray-600 text-sm mb-3">{category.description}</p>
                )}

                <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                    <button
                        onClick={() => onEdit(category)}
                        className="flex items-center text-blue-600 bg-blue-50 px-3 py-2 rounded-lg font-medium text-xs"
                    >
                        <Edit2 size={14} className="mr-1" /> Editar
                    </button>
                    <button
                        onClick={() => onDelete(category.id, category.name)}
                        className="flex items-center text-red-600 bg-red-50 px-3 py-2 rounded-lg font-medium text-xs"
                    >
                        <Trash2 size={14} className="mr-1" /> Eliminar
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <div className="p-6 border-b">
                    <h2 className="text-xl font-bold text-gray-800">
                        {category ? 'Editar Categoría' : 'Nueva Categoría'}
                    </h2>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nombre *
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Descripción
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            rows="3"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Categoría Padre (opcional)
                        </label>
                        <select
                            value={formData.parent_id || ''}
                            onChange={(e) => setFormData({ ...formData, parent_id: e.target.value ? parseInt(e.target.value) : null })}
                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="">-- Categoría Principal --</option>
                            {availableParents.filter(cat => !cat.parent_id).map(cat => (
                                <option key={cat.id} value={cat.id}>
                                    {cat.name}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                            Deja vacío para crear una categoría principal
                        </p>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Categories;
