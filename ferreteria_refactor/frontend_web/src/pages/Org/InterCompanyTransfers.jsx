import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeftRight, Plus, RefreshCw, Store,
  CheckCircle, XCircle, Clock, Search, Trash2, AlertCircle
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';

const STATUS = {
  PENDING:   { label: 'Pendiente',  color: 'amber',   icon: Clock },
  ACCEPTED:  { label: 'Aceptado',   color: 'emerald', icon: CheckCircle },
  REJECTED:  { label: 'Rechazado',  color: 'rose',    icon: XCircle },
  COMPLETED: { label: 'Completado', color: 'indigo',  icon: CheckCircle },
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

const EMPTY_ITEM = { product_sku: '', product_name: '', product_display: '', quantity: 1, stock: 0, unit_cost: 0 };

export default function InterCompanyTransfers() {
  const [transfers, setTransfers]         = useState([]);
  const [companies, setCompanies]         = useState([]);
  const [products, setProducts]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [showForm, setShowForm]           = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [form, setForm]                   = useState({ to_id: '', notes: '' });
  const [items, setItems]                 = useState([{ ...EMPTY_ITEM }]);
  const [saving, setSaving]               = useState(false);
  const [search, setSearch]               = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        const orgRes = await apiClient.get('/organizations/my-org');
        if (orgRes.data && orgRes.data.length > 0) {
          const id = orgRes.data[0].id;
          const [tenantsRes, transfersRes] = await Promise.all([
            apiClient.get('/organizations/' + id + '/tenants'),
            apiClient.get('/inter-transfers'),
          ]);
          setCompanies(tenantsRes.data || []);
          setTransfers(transfersRes.data || []);
        }
      } catch {
        try {
          const cached = JSON.parse(localStorage.getItem('org_companies') || '[]');
          if (cached.length > 0) setCompanies(cached);
        } catch {}
      } finally { setLoading(false); }
    };
    init();
  }, []);

  // Cargar productos del tenant actual (el usuario está en el tenant origen)
  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const r = await apiClient.get('/products/', { params: { limit: 500, skip: 0 } });
      const list = Array.isArray(r.data) ? r.data : (r.data?.items || []);
      setProducts(list.filter(p => p.sku)); // Solo productos con SKU
    } catch { setProducts([]); }
    finally { setLoadingProducts(false); }
  };

  const handleOpenForm = () => {
    setShowForm(true);
    loadProducts();
  };

  const getId   = (c) => (c.id || c.tenant_id)?.toString() || '';
  const getName = (c) => c.name || c.schema_name || '';

  // Filtrar productos por búsqueda
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 100);
    const q = productSearch.toLowerCase();
    return products.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  const selectProduct = (idx, product) => {
    setItems(prev => prev.map((it, i) => i === idx ? {
      ...it,
      product_sku:     product.sku || '',
      product_name:    product.name || '',
      product_display: product.name + (product.sku ? ' [' + product.sku + ']' : ''),
      stock:           parseFloat(product.stock || 0),
      unit_cost:       parseFloat(product.cost_price || product.cost || 0),
      quantity:        1,
    } : it));
    setProductSearch('');
  };

  const addItem    = () => setItems(p => [...p, { ...EMPTY_ITEM }]);
  const removeItem = (i) => setItems(p => p.filter((_, idx) => idx !== i));

  const handleCreate = async () => {
    if (!form.to_id) return toast.error('Selecciona empresa destino');
    const valid = items.filter(i => i.product_sku && i.quantity > 0);
    if (!valid.length) return toast.error('Agrega al menos un producto con SKU');

    setSaving(true);
    try {
      const r = await apiClient.post('/inter-transfers', {
        to_tenant_id: parseInt(form.to_id),
        notes:        form.notes || null,
        items:        valid.map(i => ({
          product_sku:  i.product_sku,
          product_name: i.product_name,
          quantity:     parseFloat(i.quantity),
          unit_cost:    parseFloat(i.unit_cost || 0),
        })),
      });
      setTransfers(p => [r.data, ...p]);
      setShowForm(false);
      setForm({ to_id: '', notes: '' });
      setItems([{ ...EMPTY_ITEM }]);
      setProducts([]);
      setProductSearch('');
      toast.success('Traslado creado exitosamente');
    } catch (e) {
      // Manejar error de validación (array de objetos) y string
      const detail = e.response?.data?.detail;
      if (Array.isArray(detail)) {
        toast.error(detail.map(d => d.msg || JSON.stringify(d)).join(', '));
      } else {
        toast.error(typeof detail === 'string' ? detail : 'Error al crear traslado');
      }
    } finally { setSaving(false); }
  };

  const handleAction = async (id, action) => {
    try {
      const r = await apiClient.patch('/inter-transfers/' + id + '/' + action);
      setTransfers(p => p.map(t => t.id === id ? r.data : t));
      toast.success(action === 'accept' ? 'Traslado aceptado' : 'Traslado rechazado');
    } catch (e) {
      const detail = e.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Error');
    }
  };

  const filtered = transfers.filter(t =>
    !search ||
    t.from_tenant_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.to_tenant_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Traslados Entre Empresas</h1>
          <p className="text-slate-500 text-sm mt-1">
            {companies.length} empresa{companies.length !== 1 ? 's' : ''} disponible{companies.length !== 1 ? 's' : ''}
            {' · '}Los productos se trasladan desde tu empresa actual
          </p>
        </div>
        <button
          onClick={handleOpenForm}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
        >
          <Plus size={16} /> Nuevo Traslado
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-indigo-200 p-6 shadow-md space-y-5">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 text-lg">
            <ArrowLeftRight size={18} className="text-indigo-500" /> Nuevo traslado de inventario
          </h3>

          {/* Info */}
          <div className="flex items-start gap-2 bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-700">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <p>Los productos se envían desde <strong>tu empresa actual</strong>. Selecciona la empresa destino y los productos a trasladar.</p>
          </div>

          {/* Empresa destino */}
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">
              Empresa Destino
            </label>
            <select
              value={form.to_id}
              onChange={e => setForm(p => ({ ...p, to_id: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            >
              <option value="">-- Seleccionar empresa destino --</option>
              {companies.map(c => (
                <option key={getId(c)} value={getId(c)}>{getName(c)}</option>
              ))}
            </select>
          </div>

          {/* Productos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Productos a Trasladar
              </label>
              <button onClick={addItem}
                className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1">
                <Plus size={12} /> Agregar producto
              </button>
            </div>

            {/* Buscador */}
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={loadingProducts ? 'Cargando productos...' : 'Buscar por nombre o SKU...'}
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                disabled={loadingProducts}
                className="w-full pl-8 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 disabled:opacity-50"
              />
              {loadingProducts && (
                <RefreshCw size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 animate-spin" />
              )}
            </div>

            {/* Resultados de búsqueda como lista clicable */}
            {productSearch.trim() && filteredProducts.length > 0 && (
              <div className="border border-slate-200 rounded-xl overflow-hidden mb-3 shadow-sm max-h-48 overflow-y-auto">
                {filteredProducts.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      // Agregar a la lista de items o actualizar el último vacío
                      const lastEmpty = items.findIndex(i => !i.product_sku);
                      if (lastEmpty >= 0) {
                        selectProduct(lastEmpty, p);
                      } else {
                        setItems(prev => {
                          const newItems = [...prev, { ...EMPTY_ITEM }];
                          return newItems.map((it, i) => i === newItems.length - 1 ? {
                            ...it,
                            product_sku:     p.sku || '',
                            product_name:    p.name || '',
                            product_display: p.name + (p.sku ? ' [' + p.sku + ']' : ''),
                            stock:           parseFloat(p.stock || 0),
                            unit_cost:       parseFloat(p.cost_price || 0),
                            quantity:        1,
                          } : it);
                        });
                        setProductSearch('');
                      }
                    }}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-indigo-50 transition-colors text-left border-b border-slate-100 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                      <p className="text-xs text-slate-400">SKU: {p.sku} · Stock: {parseFloat(p.stock || 0).toFixed(0)}</p>
                    </div>
                    <Plus size={14} className="text-indigo-400 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {productSearch.trim() && filteredProducts.length === 0 && !loadingProducts && (
              <p className="text-xs text-slate-400 text-center py-3 bg-slate-50 rounded-xl mb-3">
                No se encontraron productos con ese nombre o SKU
              </p>
            )}

            {/* Lista de items seleccionados */}
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className={
                  'flex gap-2 items-center rounded-xl p-2 ' +
                  (item.product_sku ? 'bg-indigo-50 border border-indigo-100' : 'bg-slate-50 border border-dashed border-slate-200')
                }>
                  <div className="flex-1 min-w-0">
                    {item.product_sku ? (
                      <div>
                        <p className="text-sm font-semibold text-slate-800 truncate">{item.product_name}</p>
                        <p className="text-xs text-slate-400">SKU: {item.product_sku} · Stock disp: {item.stock.toFixed(0)}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 px-1">Usa el buscador para seleccionar un producto</p>
                    )}
                  </div>
                  <div className="w-20 flex-shrink-0">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      max={item.stock || 9999}
                      value={item.quantity}
                      onChange={e => setItems(p => p.map((it, i) => i === idx ? { ...it, quantity: parseFloat(e.target.value) || 1 } : it))}
                      placeholder="Cant."
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-center bg-white"
                    />
                  </div>
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
              {saving ? 'Creando traslado...' : 'Crear Traslado'}
            </button>
            <button
              onClick={() => { setShowForm(false); setProducts([]); setProductSearch(''); setItems([{ ...EMPTY_ITEM }]); }}
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

      {/* Lista traslados */}
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
            const s = STATUS[t.status] || STATUS.PENDING;
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
                        <span>{t.from_tenant_name || ('Empresa #' + t.from_tenant_id)}</span>
                        <ArrowLeftRight size={14} className="text-indigo-400 flex-shrink-0" />
                        <span>{t.to_tenant_name || ('Empresa #' + t.to_tenant_id)}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {t.created_at ? new Date(t.created_at).toLocaleDateString('es-VE') : '—'}
                        {t.notes ? ' · ' + t.notes : ''}
                        {t.items && t.items.length > 0 ? ' · ' + t.items.length + ' producto(s)' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={'flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ' + COLORS[s.color]}>
                      <SIcon size={11} /> {s.label}
                    </span>
                    {(t.status === 'pending' || t.status === 'PENDING') && (
                      <>
                        <button onClick={() => handleAction(t.id, 'accept')} title="Aceptar"
                          className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all">
                          <CheckCircle size={14} />
                        </button>
                        <button onClick={() => handleAction(t.id, 'reject')} title="Rechazar"
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
