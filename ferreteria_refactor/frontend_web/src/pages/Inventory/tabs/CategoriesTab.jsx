import { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, FolderTree, Folder, Tags, Check, Search, FolderPlus } from 'lucide-react';
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
    const [searchTerm, setSearchTerm] = useState('');

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

    const rootCategories = useMemo(() => categories.filter(cat => !cat.parent_id), [categories]);
    const childCategories = useMemo(() => categories.filter(cat => cat.parent_id), [categories]);
    const getChildren = (parentId) => categories.filter(cat => cat.parent_id === parentId);

    const filteredRoots = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return rootCategories;
        const matches = (cat) => `${cat.name || ''} ${cat.description || ''}`.toLowerCase().includes(term);
        return rootCategories.filter(root => matches(root) || getChildren(root.id).some(matches));
    }, [rootCategories, categories, searchTerm]);

    if (loading) {
        return (
            <div className="flex min-h-64 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400">
                Cargando categorias...
            </div>
        );
    }

    return (
        <div className="space-y-2 animate-in fade-in duration-300">
            <section className="rounded-t-lg border border-b-0 border-slate-200 bg-white p-2 shadow-sm">
                <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
                            <Tags size={17} />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base font-black leading-tight text-slate-900">Categorias</h2>
                            <p className="text-xs font-medium text-slate-500">Organiza el catalogo para POS, filtros y reportes.</p>
                        </div>
                        <div className="hidden items-center gap-1.5 md:flex">
                            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-black text-slate-600">{rootCategories.length} principales</span>
                            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-black text-slate-600">{childCategories.length} subcategorias</span>
                        </div>
                    </div>

                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center xl:justify-end">
                        <div className="relative min-w-[240px] flex-1 xl:w-[360px] xl:flex-none">
                            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="Buscar categoria..."
                                className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm font-medium text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                            />
                        </div>
                        <Button id="tour-categories-add-btn" onClick={openCreateModal} className="h-9 rounded-md px-3 text-sm font-black">
                            <Plus size={16} />
                            Nueva Categoria
                        </Button>
                    </div>
                </div>
            </section>

            <section className="hidden rounded-b-lg border border-slate-200 bg-slate-50/80 p-2 shadow-sm md:block">
                {filteredRoots.length === 0 ? (
                    <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white text-center">
                        <div className="max-w-sm px-6 py-8">
                            <FolderPlus size={30} className="mx-auto mb-3 text-slate-300" />
                            <p className="font-black text-slate-700">No hay categorias para mostrar</p>
                            <p className="mt-1 text-xs font-medium text-slate-400">Crea una categoria o ajusta la busqueda.</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 min-[1900px]:grid-cols-5">
                        {filteredRoots.map(category => (
                            <CategoryCard
                                key={category.id}
                                category={category}
                                children={getChildren(category.id)}
                                onEdit={openEditModal}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                )}
            </section>

            <div className="md:hidden space-y-3">
                {filteredRoots.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-white px-5 py-10 text-center shadow-sm">
                        <FolderPlus size={28} className="mx-auto mb-3 text-slate-300" />
                        <p className="font-black text-slate-700">No hay categorias para mostrar</p>
                        <p className="mt-1 text-xs font-medium text-slate-400">Crea una categoria o ajusta la busqueda.</p>
                    </div>
                ) : (
                    filteredRoots.map(category => (
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

const CategoryCard = ({ category, children, onEdit, onDelete }) => {
    return (
        <article className="flex min-h-[170px] flex-col rounded-lg border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-3">
                <div className="flex min-w-0 items-start gap-2.5">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-indigo-100 bg-indigo-50 text-indigo-600">
                        <FolderTree size={17} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="line-clamp-2 text-sm font-black leading-snug text-slate-900">{category.name}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                            <span className="rounded-md border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-indigo-700">Principal</span>
                            <span className="rounded-md border border-slate-100 bg-slate-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-500">{children.length} sub</span>
                        </div>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => onEdit(category)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-indigo-600 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50" title="Editar">
                        <Edit2 size={14} />
                    </button>
                    <button onClick={() => onDelete(category.id, category.name)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-rose-500 shadow-sm transition-colors hover:border-rose-200 hover:bg-rose-50" title="Eliminar">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            <div className="flex flex-1 flex-col p-3">
                <p className="line-clamp-2 min-h-[32px] text-xs font-medium leading-relaxed text-slate-500">
                    {category.description || <span className="italic text-slate-300">Sin descripcion</span>}
                </p>

                <div className="mt-3 flex-1 rounded-md border border-slate-100 bg-slate-50/70">
                    {children.length === 0 ? (
                        <div className="flex h-full min-h-[58px] items-center justify-center px-3 text-xs font-bold text-slate-300">Sin subcategorias</div>
                    ) : (
                        <div className="max-h-28 divide-y divide-slate-100 overflow-y-auto">
                            {children.map(child => (
                                <div key={child.id} className="group flex items-center justify-between gap-2 px-2.5 py-1.5">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <Folder size={13} className="flex-shrink-0 text-slate-400" />
                                        <span className="truncate text-xs font-bold text-slate-600">{child.name}</span>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
                                        <button onClick={() => onEdit(child)} className="rounded p-1 text-indigo-500 hover:bg-indigo-50" title="Editar subcategoria">
                                            <Edit2 size={12} />
                                        </button>
                                        <button onClick={() => onDelete(child.id, child.name)} className="rounded p-1 text-rose-500 hover:bg-rose-50" title="Eliminar subcategoria">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </article>
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
