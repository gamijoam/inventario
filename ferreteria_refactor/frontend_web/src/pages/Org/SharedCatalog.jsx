/**
 * SharedCatalog.jsx
 * Sprint 4 — Multi-Empresa
 *
 * Catálogo compartido entre todas las empresas del grupo organizacional.
 * Permite ver, agregar e importar productos al catálogo compartido.
 *
 * Funcionalidades:
 *   - Ver todos los productos del catálogo de la organización
 *   - Buscar por nombre
 *   - Agregar un producto de esta empresa al catálogo compartido
 *   - Importar productos del catálogo a esta empresa (crea el producto localmente)
 *
 * Ruta: /org/catalog
 * Solo visible para usuarios con membresía en una organización multi-empresa.
 */

import React, {
    useState, useEffect, useCallback, useRef
} from 'react';
import {
    BookOpen, Plus, Search, Download, Upload,
    Package, Tag, DollarSign, X, Check,
    Loader2, AlertCircle, RefreshCw, ChevronDown
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Formatea un número como precio USD */
const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componente: ProductCard del catálogo compartido
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CatalogProductCard — Tarjeta de un producto en el catálogo compartido.
 * Muestra nombre, SKU, categoría, precio sugerido y costo.
 * Incluye botón para importar el producto a la empresa actual.
 */
function CatalogProductCard({ product, selected, onToggle, onImport, importing }) {
    return (
        <div
            className={`
                relative bg-white rounded-2xl border-2 transition-all cursor-pointer
                ${selected
                    ? 'border-indigo-400 shadow-md shadow-indigo-100'
                    : 'border-slate-100 hover:border-indigo-200 hover:shadow-sm'}
            `}
            onClick={() => onToggle(product.id)}
        >
            {/* Indicador de selección */}
            {selected && (
                <div className="absolute top-3 right-3 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center z-10">
                    <Check size={12} className="text-white" strokeWidth={3} />
                </div>
            )}

            <div className="p-4">
                {/* Inicial / avatar del producto */}
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-3">
                    <Package size={22} className="text-indigo-500" />
                </div>

                {/* Nombre */}
                <h3 className="font-bold text-slate-800 text-sm leading-snug mb-1 pr-6">
                    {product.name}
                </h3>

                {/* SKU y categoría */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                    {product.sku && (
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                            {product.sku}
                        </span>
                    )}
                    {product.category_name && (
                        <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                            {product.category_name}
                        </span>
                    )}
                </div>

                {/* Precios */}
                <div className="flex items-center justify-between text-xs">
                    <div>
                        <p className="text-slate-400 text-[10px]">Precio sugerido</p>
                        <p className="font-black text-emerald-600">{fmt(product.suggested_price)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-slate-400 text-[10px]">Costo</p>
                        <p className="font-semibold text-slate-600">{fmt(product.cost_price)}</p>
                    </div>
                </div>

                {/* Botón importar individual */}
                <button
                    onClick={(e) => { e.stopPropagation(); onImport([product.id]); }}
                    disabled={importing}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors disabled:opacity-50"
                >
                    {importing
                        ? <Loader2 size={12} className="animate-spin" />
                        : <Download size={12} />
                    }
                    Importar a esta empresa
                </button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componente: Modal para agregar producto al catálogo compartido
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AddToCatalogModal — Formulario para agregar un producto nuevo al catálogo compartido.
 * Los campos coinciden con SharedProductCreate en el backend.
 */
function AddToCatalogModal({ orgId, onClose, onSuccess }) {
    // Estado del formulario
    const [form, setForm] = useState({
        name           : '',
        sku            : '',
        description    : '',
        cost_price     : '',
        suggested_price: '',
        category_name  : '',
    });
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    // Referencia al primer input para auto-foco
    const firstInputRef = useRef(null);
    useEffect(() => { firstInputRef.current?.focus(); }, []);

    /** Actualizar un campo del formulario */
    const set = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    };

    /** Validar campos requeridos antes de guardar */
    const validate = () => {
        const errs = {};
        if (!form.name.trim())            errs.name = 'El nombre es requerido';
        if (form.suggested_price !== '' && isNaN(Number(form.suggested_price)))
            errs.suggested_price = 'Precio inválido';
        if (form.cost_price !== '' && isNaN(Number(form.cost_price)))
            errs.cost_price = 'Costo inválido';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    /** Enviar el formulario al backend */
    const handleSave = async () => {
        if (!validate()) return;
        setSaving(true);
        try {
            await apiClient.post(`/organizations/${orgId}/catalog`, {
                name           : form.name.trim(),
                sku            : form.sku.trim() || null,
                description    : form.description.trim() || null,
                cost_price     : Number(form.cost_price)      || 0,
                suggested_price: Number(form.suggested_price) || 0,
                category_name  : form.category_name.trim() || null,
            });
            toast.success('✅ Producto agregado al catálogo compartido');
            onSuccess();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al guardar el producto');
        } finally {
            setSaving(false);
        }
    };

    return (
        /* Overlay */
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl">

                {/* Header del modal */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
                            <BookOpen size={18} className="text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="font-black text-slate-800 text-base">Agregar al catálogo</h2>
                            <p className="text-xs text-slate-400">Este producto estará disponible para todas las empresas del grupo</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Cuerpo del formulario */}
                <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">

                    {/* Nombre — requerido */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                            Nombre del producto <span className="text-rose-500">*</span>
                        </label>
                        <input
                            ref={firstInputRef}
                            type="text"
                            value={form.name}
                            onChange={e => set('name', e.target.value)}
                            placeholder="Ej: Cable HDMI 2.0"
                            className={`w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors
                                ${errors.name
                                    ? 'border-rose-300 focus:border-rose-500'
                                    : 'border-slate-200 focus:border-indigo-400'}`}
                        />
                        {errors.name && (
                            <p className="text-rose-500 text-xs mt-1">{errors.name}</p>
                        )}
                    </div>

                    {/* SKU y categoría — en la misma fila */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">SKU</label>
                            <input
                                type="text"
                                value={form.sku}
                                onChange={e => set('sku', e.target.value)}
                                placeholder="HDMI-20-BLK"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 text-sm outline-none transition-colors font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">Categoría</label>
                            <input
                                type="text"
                                value={form.category_name}
                                onChange={e => set('category_name', e.target.value)}
                                placeholder="Accesorios"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 text-sm outline-none transition-colors"
                            />
                        </div>
                    </div>

                    {/* Costo y precio sugerido */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">Costo (USD)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.cost_price}
                                    onChange={e => set('cost_price', e.target.value)}
                                    placeholder="0.00"
                                    className={`w-full pl-7 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-colors
                                        ${errors.cost_price ? 'border-rose-300' : 'border-slate-200 focus:border-indigo-400'}`}
                                />
                            </div>
                            {errors.cost_price && (
                                <p className="text-rose-500 text-xs mt-1">{errors.cost_price}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">Precio sugerido (USD)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.suggested_price}
                                    onChange={e => set('suggested_price', e.target.value)}
                                    placeholder="0.00"
                                    className={`w-full pl-7 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-colors
                                        ${errors.suggested_price ? 'border-rose-300' : 'border-slate-200 focus:border-indigo-400'}`}
                                />
                            </div>
                            {errors.suggested_price && (
                                <p className="text-rose-500 text-xs mt-1">{errors.suggested_price}</p>
                            )}
                        </div>
                    </div>

                    {/* Descripción opcional */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                            Descripción <span className="text-slate-400 font-normal">(opcional)</span>
                        </label>
                        <textarea
                            value={form.description}
                            onChange={e => set('description', e.target.value)}
                            placeholder="Descripción del producto para las otras empresas del grupo..."
                            rows={3}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 text-sm outline-none resize-none transition-colors"
                        />
                    </div>
                </div>

                {/* Botones de acción */}
                <div className="p-5 border-t border-slate-100 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                        {saving ? 'Guardando...' : 'Agregar al catálogo'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export default function SharedCatalog() {
    const { user }  = useAuth();

    // Estado del catálogo
    const [products, setProducts]   = useState([]);    // Productos del catálogo compartido
    const [loading, setLoading]     = useState(true);
    const [search, setSearch]       = useState('');    // Filtro de búsqueda

    // Estado de selección múltiple (para importar varios a la vez)
    const [selected, setSelected]   = useState(new Set());

    // Estado de los modales
    const [showAddModal, setShowAddModal] = useState(false);

    // Estado de operaciones en curso
    const [importing, setImporting] = useState(false);  // Importando productos a esta empresa

    // ID de la organización — se obtiene de localStorage (org_companies)
    const [orgId, setOrgId]         = useState(null);
    const [orgName, setOrgName]     = useState('');

    // ── Detectar la organización del usuario ──────────────────────────────────
    useEffect(() => {
        // Obtener org_id desde localStorage (viene en el login response)
        // o como fallback desde el endpoint consolidated-mine
        const loadOrg = async () => {
            try {
                // Primero intentar desde localStorage (más rápido, sin petición extra)
                const stored = localStorage.getItem('org_companies');
                if (stored) {
                    const orgs = JSON.parse(stored);
                    const current = orgs.find(o => o.is_current) || orgs[0];
                    if (current?.org_id) {
                        setOrgId(current.org_id);
                        // Obtener nombre desde consolidated-mine
                        const consolidatedRes = await apiClient.get('/organizations/consolidated-mine');
                        setOrgName(consolidatedRes.data?.organization_name || 'Mi Grupo');
                        return;
                    }
                }
                // Fallback: endpoint directo
                const consolidatedRes = await apiClient.get('/organizations/consolidated-mine');
                const orgIdFromConsolidated = consolidatedRes.data?.organization_id;
                if (orgIdFromConsolidated && orgIdFromConsolidated > 0) {
                    setOrgId(orgIdFromConsolidated);
                    setOrgName(consolidatedRes.data?.organization_name || 'Mi Grupo');
                }
            } catch {
                // Sin organización
            }
        };
        loadOrg();
    }, []);

    // ── Cargar catálogo compartido ────────────────────────────────────────────
    const fetchCatalog = useCallback(async () => {
        if (!orgId) return;
        setLoading(true);
        try {
            const res = await apiClient.get(`/organizations/${orgId}/catalog`, {
                params: { search: search || undefined }
            });
            setProducts(res.data || []);
        } catch (err) {
            toast.error('Error al cargar el catálogo compartido');
        } finally {
            setLoading(false);
        }
    }, [orgId, search]);

    // Recargar cuando cambia el orgId o el filtro de búsqueda
    useEffect(() => { fetchCatalog(); }, [fetchCatalog]);

    // ── Toggle de selección ───────────────────────────────────────────────────
    const toggleSelect = (id) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    /** Seleccionar / deseleccionar todos */
    const toggleAll = () => {
        if (selected.size === products.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(products.map(p => p.id)));
        }
    };

    // ── Importar productos a esta empresa ────────────────────────────────────
    /**
     * handleImport — Llama al endpoint /organizations/{id}/catalog/import
     * con los IDs de los productos seleccionados.
     * Crea los productos en el schema del tenant actual si no existen por SKU.
     */
    const handleImport = async (ids = null) => {
        const toImport = ids || Array.from(selected);
        if (toImport.length === 0) {
            toast.error('Selecciona al menos un producto para importar');
            return;
        }
        setImporting(true);
        try {
            const res = await apiClient.post(`/organizations/${orgId}/catalog/import`, {
                product_ids        : toImport,
                warehouse_id       : 1,
                initial_stock      : 0,
                use_suggested_price: true,
            });
            const { imported, skipped, message } = res.data;
            toast.success(`✅ ${message}`);
            // Limpiar selección después de importar
            setSelected(new Set());
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al importar productos');
        } finally {
            setImporting(false);
        }
    };

    // ── Render: sin organización ──────────────────────────────────────────────
    if (!loading && !orgId) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="text-center max-w-sm">
                    <BookOpen size={48} className="text-slate-300 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-slate-700 mb-2">Sin catálogo compartido</h2>
                    <p className="text-slate-400 text-sm">
                        No perteneces a ningún grupo empresarial.
                        Contacta al administrador para habilitar el catálogo compartido.
                    </p>
                </div>
            </div>
        );
    }

    // ── Render principal ──────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

                {/* ── Header ── */}
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <BookOpen size={20} className="text-indigo-600" />
                            <h1 className="text-xl font-black text-slate-900">Catálogo compartido</h1>
                        </div>
                        <p className="text-sm text-slate-400">
                            {orgName} • {products.length} producto{products.length !== 1 ? 's' : ''} disponibles para todas las empresas
                        </p>
                    </div>
                    {/* Botón agregar al catálogo */}
                    <button
                        onClick={() => setShowAddModal(true)}
                        disabled={!orgId}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm shadow-indigo-200 disabled:opacity-50"
                    >
                        <Plus size={16} />
                        Agregar producto
                    </button>
                </div>

                {/* ── Barra de búsqueda + acciones de selección ── */}
                <div className="flex gap-3 flex-wrap">
                    {/* Búsqueda */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar producto en el catálogo..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 transition-colors"
                        />
                    </div>

                    {/* Botón seleccionar todos */}
                    {products.length > 0 && (
                        <button
                            onClick={toggleAll}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors"
                        >
                            <Check size={15} />
                            {selected.size === products.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                        </button>
                    )}

                    {/* Botón importar seleccionados */}
                    {selected.size > 0 && (
                        <button
                            onClick={() => handleImport()}
                            disabled={importing}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors disabled:opacity-60"
                        >
                            {importing
                                ? <Loader2 size={15} className="animate-spin" />
                                : <Download size={15} />
                            }
                            Importar {selected.size} seleccionado{selected.size !== 1 ? 's' : ''}
                        </button>
                    )}

                    {/* Botón refrescar */}
                    <button
                        onClick={fetchCatalog}
                        disabled={loading}
                        className="p-2.5 text-slate-400 hover:text-indigo-600 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors"
                        title="Refrescar catálogo"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* ── Banner informativo ── */}
                <div className="flex items-start gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                    <BookOpen size={16} className="text-indigo-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-indigo-700">
                        <span className="font-bold">¿Cómo funciona?</span> Los productos del catálogo compartido
                        son una biblioteca central para todo el grupo. Al importar un producto, se crea una copia
                        en tu empresa con el precio sugerido. Los cambios en el catálogo no afectan las copias ya importadas.
                    </p>
                </div>

                {/* ── Grid de productos ── */}
                {loading ? (
                    /* Estado de carga */
                    <div className="flex items-center justify-center py-16">
                        <div className="text-center">
                            <Loader2 size={36} className="text-indigo-400 animate-spin mx-auto mb-3" />
                            <p className="text-slate-400 text-sm">Cargando catálogo compartido...</p>
                        </div>
                    </div>
                ) : products.length === 0 ? (
                    /* Sin productos */
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                            <Package size={28} className="text-slate-400" />
                        </div>
                        <h3 className="font-bold text-slate-600 mb-1">
                            {search ? 'Sin resultados' : 'Catálogo vacío'}
                        </h3>
                        <p className="text-slate-400 text-sm max-w-xs">
                            {search
                                ? `No hay productos que coincidan con "${search}"`
                                : 'Todavía no hay productos en el catálogo compartido. Sé el primero en agregar uno.'}
                        </p>
                        {!search && (
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="mt-4 flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
                            >
                                <Plus size={15} />
                                Agregar primer producto
                            </button>
                        )}
                    </div>
                ) : (
                    /* Grid de tarjetas */
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {products.map(product => (
                            <CatalogProductCard
                                key={product.id}
                                product={product}
                                selected={selected.has(product.id)}
                                onToggle={toggleSelect}
                                onImport={handleImport}
                                importing={importing}
                            />
                        ))}
                    </div>
                )}

            </div>

            {/* ── Modal para agregar producto al catálogo ── */}
            {showAddModal && orgId && (
                <AddToCatalogModal
                    orgId={orgId}
                    onClose={() => setShowAddModal(false)}
                    onSuccess={() => {
                        setShowAddModal(false);
                        fetchCatalog();  // Recargar catálogo
                    }}
                />
            )}
        </div>
    );
}
