/**
 * SharedCatalog.jsx - Catalogo compartido multiempresa
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    BookOpen, Plus, Search, Download, Package, Tag, DollarSign,
    X, Check, Loader2, RefreshCw, Layers, Building2, Info,
    AlertTriangle, ShieldCheck, Wand2, Database, Link2
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';

const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;

function MetricCard({ icon: Icon, label, value, tone = 'indigo' }) {
    const tones = {
        indigo : 'bg-indigo-50 text-indigo-600 border-indigo-100',
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        amber  : 'bg-amber-50 text-amber-600 border-amber-100',
        slate  : 'bg-slate-50 text-slate-600 border-slate-100',
    };
    return (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
                    <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
                </div>
                <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${tones[tone]}`}>
                    <Icon size={18} />
                </div>
            </div>
        </div>
    );
}

function CatalogProductCard({ product, selected, onToggle, onImport, importing }) {
    return (
        <article
            className={`relative bg-white rounded-lg border transition-all cursor-pointer overflow-hidden ${selected ? 'border-indigo-400 shadow-md shadow-indigo-100' : 'border-slate-200 hover:border-indigo-200 hover:shadow-sm'}`}
            onClick={() => onToggle(product.id)}
        >
            <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${selected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                        {selected ? <Check size={18} strokeWidth={3} /> : <Package size={18} />}
                    </div>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onToggle(product.id); }}
                        className={`w-6 h-6 rounded-md border flex items-center justify-center ${selected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-300 hover:text-indigo-600'}`}
                        title={selected ? 'Quitar de seleccion' : 'Seleccionar'}
                    >
                        {selected && <Check size={14} strokeWidth={3} />}
                    </button>
                </div>

                <div className="min-h-[72px]">
                    <h3 className="font-black text-slate-900 text-sm leading-snug line-clamp-2">{product.name}</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {product.sku && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                <Tag size={10} /> {product.sku}
                            </span>
                        )}
                        {product.category_name && (
                            <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                                {product.category_name}
                            </span>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-2.5">
                        <p className="text-[10px] font-black uppercase text-emerald-600">Precio</p>
                        <p className="text-sm font-black text-emerald-800">{fmt(product.suggested_price)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
                        <p className="text-[10px] font-black uppercase text-slate-400">Costo</p>
                        <p className="text-sm font-black text-slate-700">{fmt(product.cost_price)}</p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onImport([product.id]); }}
                    disabled={importing}
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50"
                >
                    {importing ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                    Importar
                </button>
            </div>
        </article>
    );
}

function TenantHealthRow({ tenant }) {
    const issueCount = Number(tenant.missing || 0) + Number(tenant.product_diffs || 0) + Number(tenant.missing_price_lists || 0) + Number(tenant.price_missing || 0) + Number(tenant.price_diffs || 0) + Number(tenant.duplicate_sku_groups || 0);
    const healthy = tenant.healthy && issueCount === 0;
    return (
        <tr className="border-t border-slate-100">
            <td className="py-3 pr-3">
                <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${healthy ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate">{tenant.tenant_name}</p>
                        <p className="text-[11px] font-bold text-slate-400 truncate">{tenant.schema_name}{tenant.is_master ? ' · Maestra' : ''}</p>
                    </div>
                </div>
            </td>
            <td className="py-3 px-2 text-right text-sm font-black text-slate-800">{tenant.products}</td>
            <td className="py-3 px-2 text-right text-sm font-black text-slate-800">{tenant.matched}</td>
            <td className={`py-3 px-2 text-right text-sm font-black ${tenant.missing ? 'text-amber-600' : 'text-slate-400'}`}>{tenant.missing}</td>
            <td className={`py-3 px-2 text-right text-sm font-black ${tenant.product_diffs ? 'text-rose-600' : 'text-slate-400'}`}>{tenant.product_diffs}</td>
            <td className={`py-3 px-2 text-right text-sm font-black ${tenant.price_missing || tenant.price_diffs || tenant.missing_price_lists ? 'text-indigo-600' : 'text-slate-400'}`}>{Number(tenant.price_missing || 0) + Number(tenant.price_diffs || 0) + Number(tenant.missing_price_lists || 0)}</td>
            <td className="py-3 pl-2 text-right">
                <span className={`inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-[11px] font-black ${healthy ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                    {healthy ? 'Alineada' : `${issueCount} alertas`}
                </span>
            </td>
        </tr>
    );
}

function CatalogHealthPanel({ health, loading, syncing, createMissing, onCreateMissingChange, onRefresh, onSync }) {
    const totals = health?.totals || {};
    const hasIssues = Number(totals.missing || 0) + Number(totals.product_diffs || 0) + Number(totals.missing_price_lists || 0) + Number(totals.price_missing || 0) + Number(totals.price_diffs || 0) > 0;
    return (
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-5 flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 border-b border-slate-100">
                <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 border ${hasIssues ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                        {hasIssues ? <AlertTriangle size={21} /> : <ShieldCheck size={21} />}
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Salud del catalogo</p>
                        <h2 className="text-lg font-black text-slate-950">Productos y precios entre empresas</h2>
                        <p className="text-sm text-slate-500">Compara contra la empresa maestra y sincroniza sin tocar stock, IMEIs, ventas ni kardex.</p>
                        {health?.master && (
                            <p className="mt-2 inline-flex items-center gap-2 rounded-lg bg-indigo-50 border border-indigo-100 px-2.5 py-1 text-xs font-black text-indigo-700">
                                <Database size={13} /> Maestra: {health.master.tenant_name}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                        <input type="checkbox" checked={createMissing} onChange={e => onCreateMissingChange(e.target.checked)} className="accent-indigo-600" />
                        Crear faltantes con stock 0
                    </label>
                    <button onClick={onRefresh} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 hover:border-indigo-300 disabled:opacity-60">
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Auditar
                    </button>
                    <button onClick={onSync} disabled={syncing || loading || !health} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-black text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-60">
                        {syncing ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />} Sincronizar
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 border-b border-slate-100">
                <div className="p-4 border-r border-slate-100"><p className="text-[11px] font-black uppercase text-slate-400">Empresas</p><p className="text-2xl font-black text-slate-950">{health?.tenants?.length || 0}</p></div>
                <div className="p-4 border-r border-slate-100"><p className="text-[11px] font-black uppercase text-slate-400">Maestro</p><p className="text-2xl font-black text-slate-950">{health?.master?.products || 0}</p></div>
                <div className="p-4 border-r border-slate-100"><p className="text-[11px] font-black uppercase text-slate-400">Faltantes</p><p className="text-2xl font-black text-amber-600">{totals.missing || 0}</p></div>
                <div className="p-4 border-r border-slate-100"><p className="text-[11px] font-black uppercase text-slate-400">Diferencias</p><p className="text-2xl font-black text-rose-600">{totals.product_diffs || 0}</p></div>
                <div className="p-4"><p className="text-[11px] font-black uppercase text-slate-400">Precios/listas</p><p className="text-2xl font-black text-indigo-600">{Number(totals.missing_price_lists || 0) + Number(totals.price_missing || 0) + Number(totals.price_diffs || 0)}</p></div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full min-w-[780px]">
                    <thead>
                        <tr className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                            <th className="py-3 pl-5 pr-3 text-left">Empresa</th>
                            <th className="py-3 px-2 text-right">Productos</th>
                            <th className="py-3 px-2 text-right">Coinciden</th>
                            <th className="py-3 px-2 text-right">Faltan</th>
                            <th className="py-3 px-2 text-right">Cambios</th>
                            <th className="py-3 px-2 text-right">Precios</th>
                            <th className="py-3 pl-2 pr-5 text-right">Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} className="py-10 text-center text-sm font-bold text-slate-400"><Loader2 size={24} className="animate-spin mx-auto mb-2 text-indigo-500" /> Auditando empresas...</td></tr>
                        ) : (health?.tenants || []).map(tenant => <TenantHealthRow key={tenant.schema_name} tenant={tenant} />)}
                    </tbody>
                </table>
            </div>
        </section>
    );
}


function ManualMatchPanel({ orgId, masterSchema, onMatched }) {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [selected, setSelected] = useState({});
    const [saving, setSaving] = useState(false);

    const selectedItems = Object.values(selected).filter(Boolean);
    const selectedMaster = selectedItems.find(item => item.tenant_schema === masterSchema) || selectedItems[0];

    const searchCandidates = async () => {
        if (!orgId) return;
        setLoading(true);
        try {
            const res = await apiClient.get(`/organizations/${orgId}/catalog/match-candidates`, {
                params: { query: query.trim(), master_schema: masterSchema || undefined, limit: 10 },
            });
            setData(res.data || null);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error buscando candidatos');
        } finally {
            setLoading(false);
        }
    };

    const toggleProduct = (tenant, product) => {
        setSelected(prev => {
            const current = prev[tenant.schema_name];
            const next = { ...prev };
            if (current?.id === product.id) delete next[tenant.schema_name];
            else next[tenant.schema_name] = { ...product, tenant_schema: tenant.schema_name, tenant_name: tenant.tenant_name };
            return next;
        });
    };

    const saveMatch = async () => {
        if (selectedItems.length < 2) return toast.error('Selecciona productos de al menos dos empresas');
        setSaving(true);
        try {
            const master = selectedMaster;
            const links = selectedItems
                .filter(item => !(item.tenant_schema === master.tenant_schema && item.id === master.id))
                .map(item => ({ tenant_schema: item.tenant_schema, product_id: item.id, is_master: false }));
            const res = await apiClient.post(`/organizations/${orgId}/catalog/manual-match`, {
                master_schema: master.tenant_schema,
                master_product_id: master.id,
                links,
            });
            toast.success(res.data?.message || 'Productos emparejados');
            setSelected({});
            await searchCandidates();
            onMatched?.();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al emparejar productos');
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                        <Link2 size={21} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Emparejamiento manual</p>
                        <h2 className="text-lg font-black text-slate-950">Unir productos equivalentes</h2>
                        <p className="text-sm text-slate-500">Para nombres distintos entre empresas. Conserva SKU/barcode y usa un codigo interno compartido.</p>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
                    <div className="relative flex-1 xl:w-80">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') searchCandidates(); }}
                            placeholder="Ej: base moto, A06, vidrio..."
                            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        />
                    </div>
                    <button onClick={searchCandidates} disabled={loading} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:border-indigo-300 disabled:opacity-60">
                        {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Buscar
                    </button>
                    <button onClick={saveMatch} disabled={saving || selectedItems.length < 2} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50">
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />} Emparejar {selectedItems.length || ''}
                    </button>
                </div>
            </div>

            {selectedItems.length > 0 && (
                <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 flex flex-wrap gap-2">
                    {selectedItems.map(item => (
                        <span key={`${item.tenant_schema}-${item.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-100 bg-white px-2.5 py-1 text-xs font-black text-blue-700">
                            {item.tenant_name}: {item.name}
                        </span>
                    ))}
                </div>
            )}

            <div className="p-4 grid grid-cols-1 xl:grid-cols-3 gap-3">
                {(data?.tenants || []).map(tenant => (
                    <div key={tenant.schema_name} className="rounded-lg border border-slate-200 overflow-hidden">
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-sm font-black text-slate-900 truncate">{tenant.tenant_name}</p>
                                <p className="text-[11px] font-bold text-slate-400 truncate">{tenant.schema_name}{tenant.is_master ? ' · Maestra' : ''}</p>
                            </div>
                            <span className="text-[11px] font-black text-slate-500 bg-white border border-slate-200 rounded-lg px-2 py-1">{tenant.products.length}</span>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                            {tenant.products.length === 0 ? (
                                <div className="p-4 text-sm font-bold text-slate-400">Sin candidatos</div>
                            ) : tenant.products.map(product => {
                                const active = selected[tenant.schema_name]?.id === product.id;
                                return (
                                    <button
                                        key={product.id}
                                        type="button"
                                        onClick={() => toggleProduct(tenant, product)}
                                        className={`w-full text-left p-3 transition-colors ${active ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-sm font-black text-slate-900 line-clamp-2">{product.name}</p>
                                                <div className="mt-1 flex flex-wrap gap-1.5">
                                                    {product.sku && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">{product.sku}</span>}
                                                    <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-black text-indigo-700">{product.catalog_code}</span>
                                                    {product.catalog_linked && <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black text-emerald-700">Enlazado</span>}
                                                </div>
                                            </div>
                                            <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${active ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 text-transparent'}`}>
                                                <Check size={13} strokeWidth={3} />
                                            </span>
                                        </div>
                                        <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-slate-500">
                                            <span>{fmt(product.price)}</span>
                                            <span>{Number(product.stock || 0).toFixed(0)} un.</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
                {!data && !loading && (
                    <div className="xl:col-span-3 p-8 text-center text-sm font-bold text-slate-400 border border-dashed border-slate-200 rounded-lg">
                        Busca un producto para ver candidatos por empresa.
                    </div>
                )}
            </div>
        </section>
    );
}

function AddToCatalogModal({ orgId, onClose, onSuccess }) {
    const [form, setForm] = useState({
        name: '', sku: '', description: '', cost_price: '', suggested_price: '', category_name: '',
    });
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const firstInputRef = useRef(null);

    useEffect(() => { firstInputRef.current?.focus(); }, []);

    const set = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    };

    const validate = () => {
        const errs = {};
        if (!form.name.trim()) errs.name = 'El nombre es requerido';
        if (form.suggested_price !== '' && isNaN(Number(form.suggested_price))) errs.suggested_price = 'Precio invalido';
        if (form.cost_price !== '' && isNaN(Number(form.cost_price))) errs.cost_price = 'Costo invalido';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return;
        setSaving(true);
        try {
            await apiClient.post(`/organizations/${orgId}/catalog`, {
                name: form.name.trim(),
                sku: form.sku.trim() || null,
                description: form.description.trim() || null,
                cost_price: Number(form.cost_price) || 0,
                suggested_price: Number(form.suggested_price) || 0,
                category_name: form.category_name.trim() || null,
            });
            toast.success('Producto agregado al catalogo compartido');
            onSuccess();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al guardar el producto');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
            <div className="bg-white rounded-lg w-full max-w-lg shadow-2xl overflow-hidden">
                <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                            <BookOpen size={18} className="text-white" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="font-black text-slate-900">Agregar al catalogo</h2>
                            <p className="text-xs text-slate-500">Quedara disponible para importar en las empresas del grupo.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-4 max-h-[68vh] overflow-y-auto">
                    <div>
                        <label className="block text-xs font-black uppercase tracking-wide text-slate-500 mb-1.5">Nombre *</label>
                        <input
                            ref={firstInputRef}
                            type="text"
                            value={form.name}
                            onChange={e => set('name', e.target.value)}
                            placeholder="Ej: Cable HDMI 2.0"
                            className={`w-full px-4 py-2.5 rounded-lg border text-sm outline-none transition-colors ${errors.name ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-indigo-400'}`}
                        />
                        {errors.name && <p className="text-rose-500 text-xs mt-1">{errors.name}</p>}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wide text-slate-500 mb-1.5">SKU</label>
                            <input type="text" value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="HDMI-20-BLK" className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-400 text-sm outline-none font-mono" />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wide text-slate-500 mb-1.5">Categoria</label>
                            <input type="text" value={form.category_name} onChange={e => set('category_name', e.target.value)} placeholder="Accesorios" className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-400 text-sm outline-none" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wide text-slate-500 mb-1.5">Costo USD</label>
                            <div className="relative">
                                <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input type="number" min="0" step="0.01" value={form.cost_price} onChange={e => set('cost_price', e.target.value)} placeholder="0.00" className={`w-full pl-8 pr-4 py-2.5 rounded-lg border text-sm outline-none ${errors.cost_price ? 'border-rose-300' : 'border-slate-200 focus:border-indigo-400'}`} />
                            </div>
                            {errors.cost_price && <p className="text-rose-500 text-xs mt-1">{errors.cost_price}</p>}
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wide text-slate-500 mb-1.5">Precio sugerido</label>
                            <div className="relative">
                                <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input type="number" min="0" step="0.01" value={form.suggested_price} onChange={e => set('suggested_price', e.target.value)} placeholder="0.00" className={`w-full pl-8 pr-4 py-2.5 rounded-lg border text-sm outline-none ${errors.suggested_price ? 'border-rose-300' : 'border-slate-200 focus:border-indigo-400'}`} />
                            </div>
                            {errors.suggested_price && <p className="text-rose-500 text-xs mt-1">{errors.suggested_price}</p>}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase tracking-wide text-slate-500 mb-1.5">Descripcion</label>
                        <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Notas visibles para las otras empresas del grupo..." rows={3} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-400 text-sm outline-none resize-none" />
                    </div>
                </div>

                <div className="p-5 border-t border-slate-100 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
                    <button onClick={handleSave} disabled={saving} className="flex-1 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                        {saving ? 'Guardando...' : 'Agregar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function SharedCatalog() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(new Set());
    const [showAddModal, setShowAddModal] = useState(false);
    const [importing, setImporting] = useState(false);
    const [health, setHealth] = useState(null);
    const [healthLoading, setHealthLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [createMissing, setCreateMissing] = useState(false);
    const [orgId, setOrgId] = useState(null);
    const [orgName, setOrgName] = useState('');

    useEffect(() => {
        const loadOrg = async () => {
            try {
                const stored = localStorage.getItem('org_companies');
                if (stored) {
                    const orgs = JSON.parse(stored);
                    const current = orgs.find(o => o.is_current) || orgs[0];
                    if (current?.org_id) {
                        setOrgId(current.org_id);
                        const consolidatedRes = await apiClient.get('/organizations/consolidated-mine');
                        setOrgName(consolidatedRes.data?.organization_name || 'Mi Grupo');
                        return;
                    }
                }
                const consolidatedRes = await apiClient.get('/organizations/consolidated-mine');
                const orgIdFromConsolidated = consolidatedRes.data?.organization_id;
                if (orgIdFromConsolidated && orgIdFromConsolidated > 0) {
                    setOrgId(orgIdFromConsolidated);
                    setOrgName(consolidatedRes.data?.organization_name || 'Mi Grupo');
                }
            } catch {}
        };
        loadOrg();
    }, []);

    const fetchCatalog = useCallback(async () => {
        if (!orgId) return;
        setLoading(true);
        try {
            const res = await apiClient.get(`/organizations/${orgId}/catalog`, { params: { search: search || undefined } });
            setProducts(Array.isArray(res.data) ? res.data : (res.data?.items || []));
        } catch {
            toast.error('Error al cargar el catalogo compartido');
        } finally {
            setLoading(false);
        }
    }, [orgId, search]);

    useEffect(() => { fetchCatalog(); }, [fetchCatalog]);

    const fetchHealth = useCallback(async () => {
        if (!orgId) return;
        setHealthLoading(true);
        try {
            const res = await apiClient.get(`/organizations/${orgId}/catalog/health`);
            setHealth(res.data || null);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al auditar el catalogo');
        } finally {
            setHealthLoading(false);
        }
    }, [orgId]);

    useEffect(() => { fetchHealth(); }, [fetchHealth]);

    const handleSyncCatalog = async () => {
        if (!orgId) return;
        const ok = window.confirm(createMissing
            ? 'Se actualizaran nombres, precios y listas. Tambien se crearan productos faltantes con stock 0. ¿Continuar?'
            : 'Se actualizaran nombres, precios y listas en las empresas del grupo. No se tocara stock ni IMEIs. ¿Continuar?');
        if (!ok) return;
        setSyncing(true);
        try {
            const res = await apiClient.post(`/organizations/${orgId}/catalog/sync`, {
                master_schema: health?.master?.schema_name || null,
                create_missing: createMissing,
                update_existing: true,
                sync_price_lists: true,
                dry_run: false,
            });
            toast.success(res.data?.message || 'Catalogo sincronizado');
            await fetchHealth();
            await fetchCatalog();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al sincronizar catalogo');
        } finally {
            setSyncing(false);
        }
    };

    const toggleSelect = (id) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selected.size === products.length) setSelected(new Set());
        else setSelected(new Set(products.map(p => p.id)));
    };

    const handleImport = async (ids = null) => {
        const toImport = ids || Array.from(selected);
        if (toImport.length === 0) return toast.error('Selecciona al menos un producto para importar');
        setImporting(true);
        try {
            const res = await apiClient.post(`/organizations/${orgId}/catalog/import`, {
                product_ids: toImport,
                warehouse_id: 1,
                initial_stock: 0,
                use_suggested_price: true,
            });
            const { imported = 0, skipped = 0, message } = res.data || {};
            toast.success(message || `${imported} importados, ${skipped} omitidos`);
            setSelected(new Set());
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al importar productos');
        } finally {
            setImporting(false);
        }
    };

    const selectedProducts = products.filter(p => selected.has(p.id));
    const avgPrice = products.length ? products.reduce((sum, p) => sum + Number(p.suggested_price || 0), 0) / products.length : 0;
    const categories = new Set(products.map(p => p.category_name).filter(Boolean));

    if (!loading && !orgId) {
        return (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg p-10 text-center">
                <BookOpen size={42} className="text-slate-300 mx-auto mb-3" />
                <h2 className="text-lg font-black text-slate-700 mb-1">Sin catalogo compartido</h2>
                <p className="text-slate-500 text-sm">No perteneces a ningun grupo empresarial.</p>
            </div>
        );
    }

    return (
        <div className="space-y-5 max-w-6xl">
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className="w-11 h-11 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-100 shrink-0">
                            <BookOpen size={22} className="text-white" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[11px] font-black uppercase tracking-wide text-indigo-500">Operacion empresarial</p>
                            <h1 className="text-2xl font-black text-slate-950 truncate">Catalogo compartido</h1>
                            <p className="text-sm text-slate-500">Biblioteca central de productos para importar entre empresas.</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {orgName && (
                            <span className="inline-flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-black text-slate-600">
                                <Building2 size={14} /> {orgName}
                            </span>
                        )}
                        <button onClick={() => setShowAddModal(true)} disabled={!orgId} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-lg shadow-indigo-100 disabled:opacity-50">
                            <Plus size={16} /> Agregar producto
                        </button>
                    </div>
                </div>
            </div>

            <CatalogHealthPanel
                health={health}
                loading={healthLoading}
                syncing={syncing}
                createMissing={createMissing}
                onCreateMissingChange={setCreateMissing}
                onRefresh={fetchHealth}
                onSync={handleSyncCatalog}
            />

            <ManualMatchPanel
                orgId={orgId}
                masterSchema={health?.master?.schema_name}
                onMatched={() => { fetchHealth(); fetchCatalog(); }}
            />

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                <MetricCard icon={Package} label="Productos" value={products.length} tone="indigo" />
                <MetricCard icon={Layers} label="Categorias" value={categories.size} tone="slate" />
                <MetricCard icon={Check} label="Seleccionados" value={selected.size} tone={selected.size > 0 ? 'emerald' : 'slate'} />
                <MetricCard icon={DollarSign} label="Precio prom." value={fmt(avgPrice)} tone="emerald" />
            </div>

            <section className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 flex flex-col xl:flex-row xl:items-center gap-3 border-b border-slate-100">
                    <div className="relative flex-1 min-w-[220px]">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto en el catalogo" className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {products.length > 0 && (
                            <button onClick={toggleAll} className="flex items-center gap-2 px-3 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:border-indigo-300 transition-colors">
                                <Check size={15} /> {selected.size === products.length ? 'Limpiar seleccion' : 'Seleccionar todo'}
                            </button>
                        )}
                        {selected.size > 0 && (
                            <button onClick={() => handleImport()} disabled={importing} className="flex items-center gap-2 px-3 py-2.5 text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-60">
                                {importing ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                                Importar {selected.size}
                            </button>
                        )}
                        <button onClick={fetchCatalog} disabled={loading} className="p-2.5 text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 rounded-lg hover:border-indigo-300 transition-colors" title="Refrescar catalogo">
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {selectedProducts.length > 0 && (
                    <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100 flex flex-wrap items-center gap-2 text-xs text-emerald-800">
                        <Info size={14} />
                        <span className="font-bold">Importacion:</span>
                        <span>se crean productos locales con stock 0 y precio sugerido.</span>
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="text-center">
                            <Loader2 size={32} className="text-indigo-500 animate-spin mx-auto mb-3" />
                            <p className="text-slate-500 text-sm font-semibold">Cargando catalogo compartido...</p>
                        </div>
                    </div>
                ) : products.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                        <div className="w-14 h-14 bg-slate-100 rounded-lg flex items-center justify-center mb-4">
                            <Package size={26} className="text-slate-400" />
                        </div>
                        <h3 className="font-black text-slate-700 mb-1">{search ? 'Sin resultados' : 'Catalogo vacio'}</h3>
                        <p className="text-slate-500 text-sm max-w-sm">{search ? `No hay productos que coincidan con "${search}"` : 'Agrega productos base para que las empresas del grupo puedan importarlos.'}</p>
                        {!search && (
                            <button onClick={() => setShowAddModal(true)} className="mt-4 flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">
                                <Plus size={15} /> Agregar primer producto
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {products.map(product => (
                            <CatalogProductCard key={product.id} product={product} selected={selected.has(product.id)} onToggle={toggleSelect} onImport={handleImport} importing={importing} />
                        ))}
                    </div>
                )}
            </section>

            {showAddModal && orgId && (
                <AddToCatalogModal orgId={orgId} onClose={() => setShowAddModal(false)} onSuccess={() => { setShowAddModal(false); fetchCatalog(); }} />
            )}
        </div>
    );
}
