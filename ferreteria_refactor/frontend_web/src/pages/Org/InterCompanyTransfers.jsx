import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ArrowLeftRight, Plus, RefreshCw, Store,
  CheckCircle, XCircle, Clock, Search, Trash2, AlertCircle, Send, Inbox, Package
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
};

const COLORS = {
  amber:   'bg-amber-50 text-amber-700 border-amber-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rose:    'bg-rose-50 text-rose-700 border-rose-200',
  indigo:  'bg-indigo-50 text-indigo-700 border-indigo-200',
};

const EMPTY_ITEM = { product_sku: '', product_name: '', quantity: 1, stock: 0, unit_cost: 0 };

function MetricCard({ icon: Icon, label, value, tone = 'indigo' }) {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
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

export default function InterCompanyTransfers() {
  const [transfers, setTransfers]           = useState([]);
  const [companies, setCompanies]           = useState([]);
  const [products, setProducts]             = useState([]);
  const [loading, setLoading]               = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [showForm, setShowForm]             = useState(false);
  const [productSearch, setProductSearch]   = useState('');
  const [showDropdown, setShowDropdown]     = useState(false);
  const [activeItemIdx, setActiveItemIdx]   = useState(null);
  const [form, setForm]                     = useState({ to_id: '', notes: '' });
  const [items, setItems]                   = useState([{ ...EMPTY_ITEM }]);
  const [saving, setSaving]                 = useState(false);
  const [search, setSearch]                 = useState('');

  // Cargar org, tenants y traslados
  const loadAll = useCallback(async () => {
    setLoading(true);
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
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Prefill desde Buscar Stock ────────────────────────────────────────
  // Si el usuario hizo click en "Solicitar" en /org/stock-search, viene aquí
  // con prefill_transfer en localStorage. Lo consumimos UNA vez por sesión.
  const prefillConsumedRef = useRef(false);
  const [prefillBanner, setPrefillBanner] = useState(null);  // { product_name, from_tenant_name } o null

  useEffect(() => {
    if (prefillConsumedRef.current) return;
    if (loading) return;  // esperar a que companies esté cargado
    let raw = null;
    try { raw = localStorage.getItem('prefill_transfer'); } catch {}
    if (!raw) return;

    let pf;
    try { pf = JSON.parse(raw); } catch { localStorage.removeItem('prefill_transfer'); return; }
    if (!pf || !pf.product_sku) {
      localStorage.removeItem('prefill_transfer');
      return;
    }
    prefillConsumedRef.current = true;
    localStorage.removeItem('prefill_transfer');

    // Detectar empresa actual desde subdominio o localStorage
    const hostname  = (typeof window !== 'undefined') ? window.location.hostname : '';
    const subParts  = hostname.split('.');
    const subdomain = subParts.length >= 3 ? subParts[0] : null;
    const lsTenant  = (typeof localStorage !== 'undefined') ? localStorage.getItem('selected_tenant') : null;
    const currentSchema = subdomain || lsTenant || '';

    if (pf.from_tenant_schema && currentSchema && currentSchema !== pf.from_tenant_schema) {
      // Usuario está en otra empresa → mostrar banner para que cambie primero
      setPrefillBanner({
        product_name      : pf.product_name,
        from_tenant_name  : pf.from_tenant_name,
        from_tenant_schema: pf.from_tenant_schema,
        stock_available   : pf.stock_available,
      });
      return;
    }

    // Estamos en la empresa origen correcta → abrir formulario con item pre-llenado
    setShowForm(true);
    setForm({ to_id: '', notes: 'Solicitud generada desde Buscar Stock' });
    setItems([{
      product_sku : pf.product_sku,
      product_name: pf.product_name,
      quantity    : 1,
      stock       : parseFloat(pf.stock_available || 0),
      unit_cost   : parseFloat(pf.cost_price || 0),
    }]);
    loadProducts();
    toast.success(`Pre-llenado: ${pf.product_name} (origen: ${pf.from_tenant_name})`);
  }, [loading]);

  // Cargar productos frescos del tenant actual
  const loadProducts = async () => {
    setLoadingProducts(true);
    setProducts([]);
    try {
      const r = await apiClient.get('/products/', { params: { limit: 500, skip: 0 } });
      const list = Array.isArray(r.data) ? r.data : (r.data?.items || []);
      setProducts(list.filter(p => p.sku));
    } catch { setProducts([]); }
    finally { setLoadingProducts(false); }
  };

  const handleOpenForm = () => {
    setShowForm(true);
    setForm({ to_id: '', notes: '' });
    setItems([{ ...EMPTY_ITEM }]);
    setProductSearch('');
    setShowDropdown(false);
    loadProducts(); // Cargar productos frescos cada vez que se abre el form
  };

  const getId   = (c) => (c.id || c.tenant_id)?.toString() || '';
  const getName = (c) => c.name || c.schema_name || '';

  const currentSchema = useMemo(() => {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const parts = hostname.split('.');
    const subdomain = parts.length >= 3 ? parts[0] : null;
    const lsTenant = typeof localStorage !== 'undefined' ? localStorage.getItem('selected_tenant') : null;
    return subdomain || lsTenant || '';
  }, []);

  const currentCompany = useMemo(
    () => companies.find(c => c.schema_name === currentSchema),
    [companies, currentSchema]
  );
  const currentTenantId = Number(currentCompany?.id || currentCompany?.tenant_id || 0);

  // Filtrar productos en tiempo real
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 50);
    const q = productSearch.toLowerCase();
    return products.filter(p =>
      p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [products, productSearch]);

  const handleSearchChange = (e) => {
    setProductSearch(e.target.value);
    setShowDropdown(true);
  };

  const selectProduct = (idx, product) => {
    setItems(prev => prev.map((it, i) => i === idx ? {
      ...it,
      product_sku:  product.sku || '',
      product_name: product.name || '',
      stock:        parseFloat(product.stock || 0),
      unit_cost:    parseFloat(product.cost_price || 0),
      quantity:     1,
    } : it));
    setProductSearch('');
    setShowDropdown(false);
    setActiveItemIdx(null);
  };

  const openDropdownFor = (idx) => {
    setActiveItemIdx(idx);
    setProductSearch('');
    setShowDropdown(true);
  };

  const addItem    = () => setItems(p => [...p, { ...EMPTY_ITEM }]);
  const removeItem = (i) => setItems(p => p.filter((_, idx) => idx !== i));

  const handleCreate = async () => {
    if (!form.to_id) return toast.error('Selecciona empresa destino');
    const valid = items.filter(i => i.product_sku && i.quantity > 0);
    if (!valid.length) return toast.error('Selecciona al menos un producto');

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
      toast.success('Traslado creado — esperando aceptación de la empresa destino');
    } catch (e) {
      const detail = e.response?.data?.detail;
      toast.error(Array.isArray(detail)
        ? detail.map(d => d.msg || '').join(', ')
        : (typeof detail === 'string' ? detail : 'Error al crear traslado'));
    } finally { setSaving(false); }
  };

  const handleAction = async (id, action) => {
    try {
      const r = await apiClient.patch('/inter-transfers/' + id + '/' + action);
      setTransfers(p => p.map(t => t.id === id ? r.data : t));
      if (action === 'accept') {
        toast.success('Traslado aceptado — stock actualizado en ambas empresas');
        // Recargar productos frescos si el form está abierto
        if (showForm) loadProducts();
      } else {
        toast.success('Traslado rechazado');
      }
    } catch (e) {
      const detail = e.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Error al procesar el traslado');
    }
  };

  const filtered = transfers.filter(t => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.from_tenant_name?.toLowerCase().includes(q) ||
      t.to_tenant_name?.toLowerCase().includes(q) ||
      t.notes?.toLowerCase().includes(q) ||
      t.items?.some(i => i.product_name?.toLowerCase().includes(q) || i.product_sku?.toLowerCase().includes(q))
    );
  });

  const isPending = (t) => t.status === 'pending' || t.status === 'PENDING';
  const isIncoming = (t) => currentTenantId && Number(t.to_tenant_id) === currentTenantId;
  const isOutgoing = (t) => currentTenantId && Number(t.from_tenant_id) === currentTenantId;
  const pendingIncoming = transfers.filter(t => isPending(t) && isIncoming(t)).length;
  const pendingOutgoing = transfers.filter(t => isPending(t) && isOutgoing(t)).length;
  const acceptedCount = transfers.filter(t => ['ACCEPTED', 'accepted', 'COMPLETED'].includes(t.status)).length;
  const rejectedCount = transfers.filter(t => ['REJECTED', 'rejected'].includes(t.status)).length;

  return (
    <div className="space-y-6 max-w-5xl" onClick={() => setShowDropdown(false)}>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-100 shrink-0">
              <ArrowLeftRight size={22} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wide text-indigo-500">Operacion empresarial</p>
              <h1 className="text-2xl font-black text-slate-950 truncate">Traslados entre empresas</h1>
              <p className="text-sm text-slate-500">
                {companies.length} empresa{companies.length !== 1 ? 's' : ''} en el grupo. Origen actual: {currentCompany?.name || currentSchema || 'empresa actual'}.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={loadAll}
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors text-sm font-bold">
              <RefreshCw size={15} /> Actualizar
            </button>
            <button onClick={handleOpenForm}
              className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 text-sm">
              <Plus size={16} /> Nuevo traslado
            </button>
          </div>
        </div>
      </div>

      {/* Banner si el prefill apunta a otra empresa */}
      {prefillBanner && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-900">
              Quieres trasladar <span className="underline">{prefillBanner.product_name}</span> desde <strong>{prefillBanner.from_tenant_name}</strong>
            </p>
            <p className="text-xs text-amber-800 mt-1">
              Pero estás dentro de otra empresa. Cambia primero a <strong>{prefillBanner.from_tenant_name}</strong> para crear el traslado.
              <br/>
              Stock disponible allí: <strong>{prefillBanner.stock_available}</strong>.
            </p>
          </div>
          <button onClick={() => setPrefillBanner(null)}
            className="text-amber-700 hover:text-amber-900 text-xs font-bold p-1">
            Cerrar
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard icon={Inbox} label="Por aceptar" value={pendingIncoming} tone="amber" />
        <MetricCard icon={Send} label="Enviados pend." value={pendingOutgoing} tone="indigo" />
        <MetricCard icon={CheckCircle} label="Aceptados" value={acceptedCount} tone="emerald" />
        <MetricCard icon={XCircle} label="Rechazados" value={rejectedCount} tone="rose" />
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-indigo-200 p-6 shadow-md space-y-5"
          onClick={e => e.stopPropagation()}>
          <h3 className="font-bold text-slate-900 flex items-center gap-2 text-lg">
            <ArrowLeftRight size={18} className="text-indigo-500" /> Nuevo traslado de inventario
          </h3>

          <div className="flex items-start gap-2 bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-700">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <p>Los productos se envían desde <strong>tu empresa actual</strong>. Selecciona la empresa destino y los productos.</p>
          </div>

          {/* Empresa destino */}
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">
              Empresa Destino
            </label>
            <select value={form.to_id}
              onChange={e => setForm(p => ({ ...p, to_id: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
              <option value="">-- Seleccionar empresa destino --</option>
              {companies.map(c => (
                <option key={getId(c)} value={getId(c)}>{getName(c)}</option>
              ))}
            </select>
          </div>

          {/* Productos */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Productos a Trasladar
              </label>
              <button onClick={addItem}
                className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1">
                <Plus size={12} /> Agregar línea
              </button>
            </div>

            {/* Buscador global */}
            <div className="relative mb-3" onClick={e => e.stopPropagation()}>
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={loadingProducts ? 'Cargando productos...' : 'Buscar producto por nombre o SKU para agregar...'}
                value={productSearch}
                onChange={handleSearchChange}
                onFocus={() => setShowDropdown(true)}
                disabled={loadingProducts}
                className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 disabled:opacity-50"
              />
              {loadingProducts && (
                <RefreshCw size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 animate-spin" />
              )}

              {/* Dropdown de resultados */}
              {showDropdown && filteredProducts.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                  {filteredProducts.map(p => (
                    <button key={p.id}
                      onMouseDown={e => { e.preventDefault(); }}
                      onClick={() => {
                        // Agregar al primer item vacío o crear nuevo
                        const emptyIdx = items.findIndex(i => !i.product_sku);
                        if (emptyIdx >= 0) {
                          selectProduct(emptyIdx, p);
                        } else {
                          const newIdx = items.length;
                          setItems(prev => [...prev, { ...EMPTY_ITEM }]);
                          setTimeout(() => selectProduct(newIdx, p), 0);
                        }
                      }}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-indigo-50 transition-colors text-left border-b border-slate-50 last:border-0">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-400">
                          SKU: {p.sku} · Stock disponible: <strong>{parseFloat(p.stock || 0).toFixed(0)}</strong>
                        </p>
                      </div>
                      <Plus size={14} className="text-indigo-400 flex-shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              )}
              {showDropdown && productSearch.trim() && filteredProducts.length === 0 && !loadingProducts && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-sm text-slate-400 text-center">
                  No se encontraron productos con ese nombre o SKU
                </div>
              )}
            </div>

            {/* Lista de items seleccionados */}
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className={
                  'flex gap-2 items-center rounded-xl p-3 ' +
                  (item.product_sku
                    ? 'bg-indigo-50 border border-indigo-100'
                    : 'bg-slate-50 border border-dashed border-slate-200')
                }>
                  <div className="flex-1 min-w-0">
                    {item.product_sku ? (
                      <div>
                        <p className="text-sm font-bold text-slate-800">{item.product_name}</p>
                        <p className="text-xs text-slate-400">
                          SKU: {item.product_sku} · Stock: {item.stock.toFixed(0)} · ${item.unit_cost.toFixed(2)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Usa el buscador para seleccionar un producto</p>
                    )}
                  </div>
                  {item.product_sku && (
                    <div className="w-24 flex-shrink-0">
                      <input
                        type="number" min="1" max={item.stock || 9999}
                        value={item.quantity}
                        onChange={e => setItems(p => p.map((it, i) =>
                          i === idx ? { ...it, quantity: parseFloat(e.target.value) || 1 } : it
                        ))}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-center bg-white"
                      />
                    </div>
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
          <textarea placeholder="Notas del traslado (opcional)..."
            value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />

          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={saving}
              className="flex-1 bg-indigo-600 text-white rounded-xl py-3 font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm">
              {saving ? 'Creando...' : 'Crear Traslado'}
            </button>
            <button onClick={() => { setShowForm(false); setProducts([]); setProductSearch(''); }}
              className="flex-1 bg-slate-100 text-slate-600 rounded-xl py-3 font-bold hover:bg-slate-200 transition-colors text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <section className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
              <Package size={18} />
            </div>
            <div>
              <h2 className="font-black text-slate-900">Historial de traslados</h2>
              <p className="text-xs text-slate-500">Entrantes y salientes de la empresa actual.</p>
            </div>
          </div>
          <div className="relative w-full lg:w-80">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Buscar por empresa, producto, SKU o nota..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white" />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw size={24} className="text-indigo-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <ArrowLeftRight size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-semibold">Sin traslados</p>
            <p className="text-sm">Crea uno para mover inventario entre empresas.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(t => {
              const s = STATUS[t.status] || STATUS.PENDING;
              const SIcon = s.icon;
              const incoming = isIncoming(t);
              const outgoing = isOutgoing(t);
              const canResolve = isPending(t) && incoming;
              const itemsCount = t.items?.length || 0;
              const units = (t.items || []).reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
              return (
                <div key={t.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex flex-col xl:flex-row xl:items-center gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${incoming ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>
                        {incoming ? <Inbox size={18} /> : <Send size={18} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-black text-slate-900">
                          <span>{t.from_tenant_name || ('Empresa #' + t.from_tenant_id)}</span>
                          <ArrowLeftRight size={14} className="text-indigo-400 flex-shrink-0" />
                          <span>{t.to_tenant_name || ('Empresa #' + t.to_tenant_id)}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${incoming ? 'bg-amber-50 text-amber-700' : outgoing ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                            {incoming ? 'Entrante' : outgoing ? 'Saliente' : 'Grupo'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          #{t.id} - {t.created_at ? new Date(t.created_at).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '--'}
                          {t.notes ? ' - ' + t.notes : ''}
                        </p>
                        {itemsCount > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {t.items.slice(0, 4).map(i => (
                              <span key={i.id || i.product_sku} className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-slate-100 text-slate-600">
                                {Number(i.quantity).toFixed(Number(i.quantity) % 1 ? 2 : 0)} x {i.product_name || i.product_sku}
                              </span>
                            ))}
                            {itemsCount > 4 && <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-500">+{itemsCount - 4} mas</span>}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 xl:w-[360px]">
                      <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                        <p className="text-[10px] text-slate-400 font-black uppercase">Productos</p>
                        <p className="text-base font-black text-slate-800">{itemsCount}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                        <p className="text-[10px] text-slate-400 font-black uppercase">Unidades</p>
                        <p className="text-base font-black text-slate-800">{units.toFixed(units % 1 ? 2 : 0)}</p>
                      </div>
                      <div className={'rounded-lg border p-3 ' + COLORS[s.color]}>
                        <p className="text-[10px] font-black uppercase">Estado</p>
                        <p className="text-sm font-black flex items-center gap-1"><SIcon size={13} /> {s.label}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 xl:justify-end">
                      {canResolve ? (
                        <>
                          <button onClick={() => handleAction(t.id, 'accept')}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-all text-sm font-bold">
                            <CheckCircle size={14} /> Aceptar
                          </button>
                          <button onClick={() => handleAction(t.id, 'reject')}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all text-sm font-bold border border-rose-100">
                            <XCircle size={14} /> Rechazar
                          </button>
                        </>
                      ) : isPending(t) ? (
                        <span className="text-xs font-bold text-slate-400 px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
                          {outgoing ? 'Esperando destino' : 'Sin accion disponible'}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
