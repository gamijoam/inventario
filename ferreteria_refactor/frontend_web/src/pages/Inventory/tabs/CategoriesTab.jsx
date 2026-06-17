import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, FolderTree, Folder, Tags, Check } from 'lucide-react';
import apiClient from '../../../config/axios';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
} from '../../../components/ui/sheet';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { useConfig } from '../../../context/ConfigContext';

const CategoriesTab = () => {
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
            toast.error(error.response?.data?.detail || 'Error al eliminar categoría');
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
    const childCategories = categories.filter(cat => cat.parent_id);
    const getChildren = (parentId) => categories.filter(cat => cat.parent_id === parentId);

    if (loading) return <div className="p-12 text-center text-slate-400">Cargando categorías...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center">
                        <Tags className="mr-2 text-indigo-600" /> Categorías de Productos
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Organiza tu inventario en categorías y subcategorías.</p>
                </div>
                <Button id="tour-categories-add-btn" onClick={openCreateModal}>
                    <Plus size={18} />
                    Nueva Categoría
                </Button>
            </div>

            {/* Desktop Table (Zebra Bento) */}
            <div className="hidden md:block bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
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
                    <div className="text-center py-12 text-slate-400 font-medium bg-white rounded-lg border border-slate-200">
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
                    isEven={isEven}
                />
            ))}
        </>
    );
};

// Recursive component for Mobile List
const MobileCategoryItem = ({ category, level, getChildren, onEdit, onDelete }) => {
    const children = getChildren(category.id);

    return (
        <div className="flex flex-col gap-2">
            <div
                className={clsx(
                    "bg-white p-4 rounded-xl shadow-sm border border-slate-200",
                    level > 0 && "ml-4 border-l-4 border-l-slate-200"
                )}
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
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(category)}
                        className="text-indigo-600"
                    >
                        <Edit2 size={14} className="mr-1.5" /> Editar
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(category.id, category.name)}
                        className="text-rose-600"
                    >
                        <Trash2 size={14} className="mr-1.5" /> Eliminar
                    </Button>
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

// Modal for Create/Edit - Using New Sheet Component
const CategoryModal = ({ category, categories, onClose, onSuccess }) => {
    const { modules } = useConfig();
    const [formData, setFormData] = useState({
        name: category?.name || '',
        description: category?.description || '',
        parent_id: category?.parent_id || null,
        is_no_kitchen_category: category?.is_no_kitchen_category || false
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
            toast.error(error.response?.data?.detail || 'Error al guardar categoría');
        } finally {
            setLoading(false);
        }
    };

    // Filter out current category and its children from parent options
    const availableParents = category
        ? categories.filter(cat => cat.id !== category.id && cat.parent_id !== category.id)
        : categories;

    return (
        <Sheet open={true} onOpenChange={(open) => !open && onClose()}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-md flex flex-col"
            >
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        {category ? <Edit2 size={20} className="text-indigo-600" /> : <Plus size={20} className="text-indigo-600" />}
                        {category ? 'Editar Categoría' : 'Nueva Categoría'}
                    </SheetTitle>
                    <SheetDescription>
                        {category ? 'Modifica los datos de la categoría' : 'Crea una nueva categoría para organizar tus productos'}
                    </SheetDescription>
                </SheetHeader>

                <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="category-name">
                                Nombre <span className="text-rose-500">*</span>
                            </Label>
                            <Input
                                id="category-name"
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Ej. Herramientas Manuales"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="category-description">Descripción</Label>
                            <Textarea
                                id="category-description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Breve descripción de la categoría..."
                                rows={3}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="category-parent">Categoría Padre (Opcional)</Label>
                            <div className="relative">
                                <select
                                    id="category-parent"
                                    value={formData.parent_id || ''}
                                    onChange={(e) => setFormData({ ...formData, parent_id: e.target.value ? parseInt(e.target.value) : null })}
                                    className="w-full h-11 px-4 py-2 rounded-xl border-2 border-slate-200 bg-white text-base transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:outline-none appearance-none"
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
                            <p className="text-xs text-slate-500 mt-1">
                                Selecciona una categoría padre para crear una subcategoría.
                            </p>
                        </div>

                        {/* is_no_kitchen_category: Only if restaurant module active */}
                        {modules?.restaurant && (
                            <div className={clsx(
                                "flex items-center gap-4 p-4 rounded-xl transition-all border",
                                formData.is_no_kitchen_category
                                    ? "bg-emerald-50 border-emerald-200"
                                    : "bg-slate-50 border-slate-100 hover:border-slate-200"
                            )}>
                                <div className={clsx(
                                    "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                                    formData.is_no_kitchen_category ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-400"
                                )}>
                                    <Tags size={20} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="is_no_kitchen_category" className="text-sm font-bold text-slate-800 cursor-pointer">
                                            Categoría Sin Cocina
                                        </Label>
                                        <input
                                            type="checkbox"
                                            id="is_no_kitchen_category"
                                            checked={formData.is_no_kitchen_category}
                                            onChange={(e) => setFormData({ ...formData, is_no_kitchen_category: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div
                                            onClick={() => setFormData(p => ({ ...p, is_no_kitchen_category: !p.is_no_kitchen_category }))}
                                            className={clsx(
                                                "w-11 h-6 rounded-full cursor-pointer transition-colors relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-slate-300 after:rounded-full after:h-5 after:w-5 after:transition-all",
                                                formData.is_no_kitchen_category
                                                    ? "bg-emerald-600 after:translate-x-5"
                                                    : "bg-slate-200"
                                            )}
                                        ></div>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                        Los productos de esta categoría no pasan por cocina y son servidos directamente por el mesero.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <SheetFooter className="gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            className="flex-1"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="flex-1"
                        >
                            {loading ? (
                                'Guardando...'
                            ) : (
                                <>
                                    <Check size={18} />
                                    Guardar
                                </>
                            )}
                        </Button>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    );
};

export default CategoriesTab;
