/**
 * InterCompanyTransfers.jsx — Traslados de inventario entre empresas
 */
import React, { useState, useEffect } from 'react';
import {
  ArrowLeftRight, Plus, RefreshCw, Store, Package,
  CheckCircle, XCircle, Clock, Search, ChevronDown
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';

const STATUS = {
  pending:   { label: 'Pendiente',  color: 'amber',   icon: Clock },
  accepted:  { label: 'Aceptado',   color: 'emerald', icon: CheckCircle },
  rejected:  { label: 'Rechazado',  color: 'rose',    icon: XCircle },
  completed: { label: 'Completado', color: 'indigo',  icon: CheckCircle },
};

export default function InterCompanyTransfers() {
  const [transfers, setTransfers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [products, setProducts] = useState([]);
  const [orgId, setOrgId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ from_tenant_id: '', to_tenant_id: '', notes: '' });
  const [items, setItems] = useState([{ product_id: '', quantity: 1 }]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        const r = await apiClient.get('/organizations/mine');
        if (r.data?.[0]) {
          const id = r.data[0].id;
          setOrgId(id);
          const [tc, tt] = await Promise.all([
            apiClient.get(`/organizations/${id}/tenants`),
            apiClient.get(`/inter-company-transfers`),
          ]);
          setCompanies(tc.data || []);
          setTransfers(tt.data || []);
        }
      } catch { toast.error('Error cargando datos'); }
      finally { setLoading(false); }
    };
    init();
  }, []);

  // Cargar productos cuando se selecciona empresa origen
  useEffect(() => {
    if (!form.from_tenant_id) { setProducts([]); return; }
    apiClient.get('/products/', { params: { limit: 200 } })
      .then(r => setProducts(Array.isArray(r.data) ? r.data : r.data?.items || []))
      .catch(() => {});
  }, [form.from_tenant_id]);

  const handleCreate = async () => {
    if (!form.from_tenant_id || !form.to_tenant_id)
      return toast.error('Selecciona empresas origen y destino');
    if (form.from_tenant_id === form.to_tenant_id)
      return toast.error('Origen y destino no pueden ser la misma empresa');
    setSaving(true);
    try {
      const r = await apiClient.post('/inter-company-transfers', {
        from_tenant_id: parseInt(form.from_tenant_id),
        to_tenant_id: parseInt(form.to_tenant_id),
        notes: form.notes,
        items: items.filter(i => i.product_id),
      });
      setTransfers(prev => [r.data, ...prev]);
      setShowForm(false);
      setForm({ from_tenant_id: '', to_tenant_id: '', notes: '' });
      setItems([{ product_id: '', quantity: 1 }]);
      toast.success('Traslado creado exitosamente');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error al crear traslado');
    } finally { setSaving(false); }
  };

  const handleAction = async (id, action) => {
    try {
      const r = await apiClient.patch(`/inter-company-transfers/${id}/${action}`);
      setTransfers(prev => prev.map(t => t.id === id ? r.data : t));
      toast.success(action === 'accept' ? 'Traslado aceptado' : 'Traslado rechazado');
    } catch { toast.error('Error al actualizar traslado'); }
  };

  const filtered = transfers.filter(t =>
    !search || t.from_tenant_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.to_tenant_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Traslados Entre Empresas</h1>
          <p className="text-slate-500 text-sm mt-1">Mueve inventario entre tus locales sin salir del panel</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5
            rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
          <Plus size={16} /> Nuevo Traslado
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-indigo-200 p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <ArrowLeftRight size={16} className="text-indigo-500" /> Nuevo traslado de inventario
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">EMPRESA ORIGEN</label>
              <select value={form.from_tenant_id} onChange={e => setForm(p => ({ ...p, from_tenant_id: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="">Seleccionar...</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">EMPRESA DESTINO</label>
              <select value={form.to_tenant_id} onChange={e => setForm(p => ({ ...p, to_tenant_id: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="">Seleccionar...</option>
                {companies.filter(c => c.id.toString() !== form.from_tenant_id).map(c =>
                  <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Items */}
          <div>
            <label className="text-xs font-bold text-slate-500 mb-2 block">PRODUCTOS A TRASLADAR</label>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <select value={item.product_id}
                      onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, product_id: e.target.value } : it))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                      <option value="">Seleccionar producto...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>)}
                    </select>
                  </div>
                  <input type="number" min="1" value={item.quantity}
                    onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: parseInt(e.target.value) || 1 } : it))}
                    placeholder="Cant."
                    className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
              ))}
              <button onClick={() => setItems(prev => [...prev, { product_id: '', quantity: 1 }])}
                className="text-indigo-600 text-xs font-bold hover:underline">
                + Agregar producto
              </button>
            </div>
          </div>

          <textarea placeholder="Notas del traslado (opcional)" value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />

          <div className="flex gap-3 pt-2">
            <button onClick={handleCreate} disabled={saving}
              className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50">
              {saving ? 'Creando...' : 'Crear Traslado'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="flex-1 bg-slate-100 text-slate-600 rounded-xl py-2.5 font-bold hover:bg-slate-200 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Buscador */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Buscar por empresa..." value={search}
          onChange={e => setSearch(e.target.value)}
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
          <p className="text-sm">Crea el primero para mover inventario entre tus empresas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => {
            const s = STATUS[t.status] || STATUS.pending;
            const SIcon = s.icon;
            const colors = {
              amber:   'bg-amber-50 text-amber-700 border-amber-200',
              emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
              rose:    'bg-rose-50 text-rose-700 border-rose-200',
              indigo:  'bg-indigo-50 text-indigo-700 border-indigo-200',
            };
            return (
              <div key={t.id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center">
                        <Store size={16} className="text-slate-500" />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                        <span>{t.from_tenant_name || `Empresa #${t.from_tenant_id}`}</span>
                        <ArrowLeftRight size={14} className="text-indigo-400" />
                        <span>{t.to_tenant_name || `Empresa #${t.to_tenant_id}`}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {t.created_at ? new Date(t.created_at).toLocaleDateString('es-VE') : '—'}
                        {t.notes && ` · ${t.notes}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${colors[s.color]}`}>
                      <SIcon size={11} /> {s.label}
                    </span>
                    {t.status === 'pending' && (
                      <>
                        <button onClick={() => handleAction(t.id, 'accept')}
                          className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all">
                          <CheckCircle size={14} />
                        </button>
                        <button onClick={() => handleAction(t.id, 'reject')}
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
