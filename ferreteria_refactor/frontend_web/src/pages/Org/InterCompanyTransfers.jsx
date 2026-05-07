/**
 * InterCompanyTransfers.jsx — Traslados de inventario entre empresas
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeftRight, Plus, RefreshCw, Store, Package,
  CheckCircle, XCircle, Clock, Search, Trash2
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';

const STATUS = {
  pending:   { label: 'Pendiente',  color: 'amber',   icon: Clock },
  accepted:  { label: 'Aceptado',   color: 'emerald', icon: CheckCircle },
  rejected:  { label: 'Rechazado',  color: 'rose',    icon: XCircle },
  completed: { label: 'Completado', color: 'indigo',  icon: CheckCircle },
};

const COLORS = {
  amber:   'bg-amber-50 text-amber-700 border-amber-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rose:    'bg-rose-50 text-rose-700 border-rose-200',
  indigo:  'bg-indigo-50 text-indigo-700 border-indigo-200',
};

export default function InterCompanyTransfers() {
  const [transfers, setTransfers]   = useState([]);
  const [companies, setCompanies]   = useState([]);
  const [products, setProducts]     = useState([]);
  const [orgId, setOrgId]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [form, setForm] = useState({ from_id: '', to_id: '', notes: '' });
  const [items, setItems] = useState([{ product_id: '', product_name: '', quantity: 1, stock: 0 }]);
  const [saving, setSaving]         = useState(false);
  const [search, setSearch]         = useState('');

  // Cargar org y tenants
  useEffect(() => {
    const init = async () => {
      try {
        const orgRes = await apiClient.get('/organizations/my-org');
        if (orgRes.data?.[0]) {
          const id = orgRes.data[0].id;
          setOrgId(id);
          const [tenantsRes, transfersRes] = await Promise.all([
            apiClient.get(\`/organizations/${id}/tenants\`),
            apiClient.get('/inter-transfers'),
          ]);
          setCompanies(tenantsRes.data || []);
          setTransfers(transfersRes.data || []);
        }
      } catch (e) {
        // Fallback: usar localStorage
        try {
          const cached = JSON.parse(localStorage.getItem('org_companies') || '[]');
          if (cached.length > 0) setCompanies(cached);
        } catch {}
        toast.error('Error cargando datos');
      } finally { setLoading(false); }
    };
    init();
  }, []);

  // Cargar productos del tenant origen cuando se selecciona
  const loadProducts = async (schemaName) => {
    if (!schemaName) { setProducts([]); return; }
    try {
      // Llamar a un endpoint que devuelva productos del schema especificado
      const r = await apiClient.get('/products/', {
        params: { limit: 500, skip: 0 },
        headers: { 'X-Tenant-Schema': schemaName }
      });
      const list = Array.isArray(r.data) ? r.data : (r.data?.items || []);
      setProducts(list);
    } catch {
      // Si falla, intentar sin header
      try {
        const r = await apiClient.get('/products/', { params: { limit: 500 } });
        const list = Array.isArray(r.data) ? r.data : (r.data?.items || []);
        setProducts(list);
      } catch { setProducts([]); }
    }
  };

  const handleFromChange = (val) => {
    setForm(p => ({ ...p, from_id: val }));
    const company = companies.find(c => c.id?.toString() === val || c.tenant_id?.toString() === val);
    if (company) loadProducts(company.schema_name);
  };

  // Productos filtrados por búsqueda
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 50);
    return products.filter(p =>
      p.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku?.toLowerCase().includes(productSearch.toLowerCase())
    ).slice(0, 50);
  }, [products, productSearch]);

  const addItem = () => setItems(p => [...p, { product_id: '', product_name: '', quantity: 1, stock: 0 }]);
  const removeItem = (i) => setItems(p => p.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) => setItems(p => p.map((it, idx) => idx === i ? { ...it, [field]: val } : it));

  const selectProduct = (idx, product) => {
    setItems(p => p.map((it, i) => i === idx ? {
      ...it,
      product_id: product.id,
      product_name: product.name,
      stock: parseFloat(product.stock || 0),
    } : it));
  };

  const handleCreate = async () => {
    if (!form.from_id) return toast.error('Selecciona empresa origen');
    if (!form.to_id)   return toast.error('Selecciona empresa destino');
    if (form.from_id === form.to_id) return toast.error('Origen y destino no pueden ser iguales');
    const validItems = items.filter(i => i.product_id && i.quantity > 0);
    if (validItems.length === 0) return toast.error('Agrega al menos un producto');

    setSaving(true);
    try {
      const fromCompany = companies.find(c => c.id?.toString() === form.from_id || c.tenant_id?.toString() === form.from_id);
      const toCompany   = companies.find(c => c.id?.toString() === form.to_id   || c.tenant_id?.toString() === form.to_id);

      const r = await apiClient.post('/inter-transfers', {
        from_tenant_id: parseInt(form.from_id),
        to_tenant_id:   parseInt(form.to_id),
        notes:          form.notes,
        items:          validItems.map(i => ({ product_id: parseInt(i.product_id), quantity: parseFloat(i.quantity) })),
      });
      setTransfers(p => [r.data, ...p]);
      setShowForm(false);
      setForm({ from_id: '', to_id: '', notes: '' });
      setItems([{ product_id: '', product_name: '', quantity: 1, stock: 0 }]);
      setProducts([]);
      toast.success('Traslado creado exitosamente');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error al crear traslado');
    } finally { setSaving(false); }
  };

  const handleAction = async (id, action) => {
    try {
      const r = await apiClient.patch(`/inter-transfers/${id}/${action}`);
      setTransfers(p => p.map(t => t.id === id ? r.data : t));
      toast.success(action === 'accept' ? 'Traslado aceptado' : 'Traslado rechazado');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error');
    }
  };

  const filtered = transfers.filter(t =>
    !search ||
    t.from_tenant_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.to_tenant_name?.toLowerCase().includes(search.toLowerCase())
  );

  const getCompanyId = (c) => (c.id || c.tenant_id)?.toString();
  const getCompanyName = (c) => c.name;

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Traslados Entre Empresas</h1>
          <p className="text-slate-500 text-sm mt-1">
            Mueve inventario entre tus locales · {companies.length} empresa{companies.length !== 1 ? 's' : ''} disponible{companies.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
          <Plus size={16} /> Nuevo Traslado
        </button>
      </div>

      {/* Formulario nuevo traslado */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-indigo-200 p-6 shadow-md space-y-5">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 text-lg">
            <ArrowLeftRight size={18} className="text-indigo-500" /> Nuevo traslado de inventario
          </h3>

          {/* Empresas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">
                Empresa Origen
              </label>
              <select
                value={form.from_id}
                onChange={e => handleFromChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              >
                <option value="">-- Seleccionar empresa --</option>
                {companies.map(c => (
                  <option key={getCompanyId(c)} value={getCompanyId(c)}>
                    {getCompanyName(c)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">
                Empresa Destino
              </label>
              <select
                value={form.to_id}
                onChange={e => setForm(p => ({ ...p, to_id: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              >
                <option value="">-- Seleccionar empresa --</option>
                {companies
                  .filter(c => getCompanyId(c) !== form.from_id)
                  .map(c => (
                    <option key={getCompanyId(c)} value={getCompanyId(c)}>
                      {getCompanyName(c)}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Productos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Productos a Trasladar
              </label>
              <button onClick={addItem}
                className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1">
                <Plus size={12} /> Agregar línea
              </button>
            </div>

            {/* Buscador de productos */}
            {form.from_id && (
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar producto por nombre o SKU..."
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
                />
              </div>
            )}

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center bg-slate-50 rounded-xl p-2">
                  <div className="flex-1">
                    {!form.from_id ? (
                      <p className="text-xs text-slate-400 px-2">Selecciona empresa origen primero</p>
                    ) : (
                      <select
                        value={item.product_id}
                        onChange={e => {
                          const p = products.find(p => p.id.toString() === e.target.value);
                          if (p) selectProduct(idx, p);
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                      >
                        <option value="">-- Seleccionar producto --</option>
                        {filteredProducts.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.sku ? `(${p.sku})` : ''} · Stock: {parseFloat(p.stock || 0).toFixed(0)}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="w-24 flex-shrink-0">
                    <input
                      type="number" min="1"
                      max={item.stock || 9999}
                      value={item.quantity}
                      onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 1)}
                      placeholder="Cant."
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-center"
                    />
                  </div>
                  {item.stock > 0 && (
                    <span className="text-[10px] text-emerald-600 font-bold flex-shrink-0">
                      Disp: {item.stock.toFixed(0)}
                    </span>
                  )}
                  {items.length > 1 && (
                    <button onClick={() => removeItem(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors flex-shrink-0">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Notas */}
          <textarea
            placeholder="Notas del traslado (opcional)..."
            value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />

          <div className="flex gap-3 pt-2">
            <button onClick={handleCreate} disabled={saving}
              className="flex-1 bg-indigo-600 text-white rounded-xl py-3 font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm">
              {saving ? 'Creando traslado...' : '✓ Crear Traslado'}
            </button>
            <button onClick={() => { setShowForm(false); setProducts([]); setProductSearch(''); }}
              className="flex-1 bg-slate-100 text-slate-600 rounded-xl py-3 font-bold hover:bg-slate-200 transition-colors text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Buscador historial */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Buscar traslados por empresa..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white" />
      </div>

      {/* Lista de traslados */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw size={24} className="text-indigo-500 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <ArrowLeftRight size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold">Sin traslados aún</p>
          <p className="text-sm">Crea el primero para mover inventario entre empresas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => {
            const s = STATUS[t.status] || STATUS.pending;
            const SIcon = s.icon;
            return (
              <div key={t.id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Store size={16} className="text-indigo-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-800 flex-wrap">
                        <span className="truncate">{t.from_tenant_name || `#${t.from_tenant_id}`}</span>
                        <ArrowLeftRight size={14} className="text-indigo-400 flex-shrink-0" />
                        <span className="truncate">{t.to_tenant_name || `#${t.to_tenant_id}`}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {t.created_at ? new Date(t.created_at).toLocaleDateString('es-VE') : '—'}
                        {t.notes && ` · ${t.notes}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${COLORS[s.color]}`}>
                      <SIcon size={11} /> {s.label}
                    </span>
                    {t.status === 'pending' && (
                      <>
                        <button onClick={() => handleAction(t.id, 'accept')}
                          title="Aceptar"
                          className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all">
                          <CheckCircle size={14} />
                        </button>
                        <button onClick={() => handleAction(t.id, 'reject')}
                          title="Rechazar"
                          className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all">
                          <XCircle size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
