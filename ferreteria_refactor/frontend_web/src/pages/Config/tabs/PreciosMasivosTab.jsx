/**
 * PreciosMasivosTab.jsx — Cambio masivo de precios por margen
 *
 * Permite aplicar un margen porcentual a TODOS los productos del tenant,
 * actualizando la lista de precios seleccionada (recomendado), products.price
 * o ambos. Mantiene historial en price_change_log.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Calculator, TrendingUp, RefreshCw, Eye, Check, AlertCircle,
  History, Undo2, ChevronRight, Sparkles, DollarSign, AlertTriangle, Trash2, Info
} from 'lucide-react';
import apiClient from '../../../config/axios';
import { toast } from 'react-hot-toast';

const ROUNDING_LABELS = {
  smart:      'Inteligente: ≤$20 entero, >$20 múltiplo de 5 ↑ (recomendado)',
  none:       'Sin redondear',
  integer:    'Al entero más cercano',
  multiple_5: 'Al múltiplo de 5 más cercano',
};

const TARGET_LABELS = {
  price_list:    'Lista de precios',
  product_price: 'Precio base (products.price)',
  both:          'Ambos',
};

const PRICE_LIST_CURRENCY_OPTIONS = [
  { value: 'FLEX', label: 'Flexible' },
  { value: 'USD', label: 'USD' },
  { value: 'VES', label: 'Bs / VES' },
];

const PRICE_LIST_POLICY_OPTIONS = [
  { value: 'flexible', label: 'Cobro flexible' },
  { value: 'strict', label: 'Solo su moneda' },
];

// FastAPI/Pydantic v2 puede devolver detail como string o como array de validation errors.
// Si lo renderizamos tal cual, React tira "object is not a valid child" (#31).
const getApiErrorMessage = (e, fallback) => {
  const detail = e?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map(d => {
      const loc = Array.isArray(d?.loc) ? (d.loc.slice(1).join('.') || d.loc.join('.')) : '';
      return loc ? `${loc}: ${d.msg || 'inválido'}` : (d.msg || 'inválido');
    }).join(' | ') || fallback;
  }
  return fallback;
};

export default function PreciosMasivosTab() {
  const [priceLists, setPriceLists] = useState([]);
  const [form, setForm] = useState({
    margin_percent: 45,
    target:         'both',
    price_list_id:  null,
    rounding:       'smart',
    notes:          '',
  });
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [history, setHistory] = useState([]);

  const loadLists = useCallback(async () => {
    try {
      const r = await apiClient.get('/config/pricing/price-lists');
      setPriceLists(r.data || []);
      if (r.data?.length && !form.price_list_id) {
        // Por defecto: lista activa con id más alto (suele ser la principal)
        const activa = r.data.find(l => l.is_active) || r.data[0];
        setForm(p => ({ ...p, price_list_id: activa.id }));
      }
    } catch {}
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const r = await apiClient.get('/config/pricing/history?limit=15');
      setHistory(r.data || []);
    } catch {}
  }, []);

  // Cargar margen por defecto desde /config (unifica con ProductForm) — sobreescribe el 45 inicial
  const loadDefaultMargin = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/config/default_price_list_margin');
      const v = parseFloat(data?.value);
      if (Number.isFinite(v)) setForm(p => ({ ...p, margin_percent: v }));
    } catch (_) { /* mantener 45 si falla */ }
  }, []);

  // Persistir el margen actual como nuevo predeterminado para todo el sistema
  const saveDefaultMargin = async () => {
    try {
      await apiClient.put('/config/default_price_list_margin', {
        key: 'default_price_list_margin',
        value: String(form.margin_percent)
      });
      toast.success(`✓ Margen predeterminado guardado: ${form.margin_percent}%`);
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Error al guardar el margen predeterminado'));
    }
  };

  useEffect(() => { loadLists(); loadHistory(); loadDefaultMargin(); }, [loadLists, loadHistory, loadDefaultMargin]);

  const handlePreview = async () => {
    if ((form.target === 'price_list' || form.target === 'both') && !form.price_list_id) {
      toast.error('Selecciona una lista de precios');
      return;
    }
    setLoading(true); setPreview(null);
    try {
      const r = await apiClient.post('/config/pricing/bulk-margin-preview', {
        ...form, margin_percent: parseFloat(form.margin_percent), limit_preview: 10,
      });
      setPreview(r.data);
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Error en preview'));
    } finally { setLoading(false); }
  };

  const handleApply = async () => {
    if (!preview) { toast.error('Primero genera la vista previa'); return; }
    // Si el total antes ≈ total después, no hay cambios reales (precios ya están a este margen
    // o el redondeo los deja iguales). No tiene sentido aplicar.
    const totalDiff = Math.abs(preview.total_value_after - preview.total_value_before);
    if (totalDiff < 0.01) {
      toast.error('No hay cambios que aplicar. Los precios de esta lista ya están a este margen o el redondeo los deja iguales. Probá con un margen mayor.');
      return;
    }
    const msg = `¿Aplicar margen del ${form.margin_percent}% a ${preview.total_products} productos?\n\n` +
      `Valor total antes: $${preview.total_value_before.toFixed(2)}\n` +
      `Valor total después: $${preview.total_value_after.toFixed(2)}\n\n` +
      `Esta acción quedará registrada en el historial y puede revertirse después.`;
    if (!window.confirm(msg)) return;

    setApplying(true);
    try {
      const r = await apiClient.post('/config/pricing/bulk-margin-apply', {
        ...form, margin_percent: parseFloat(form.margin_percent),
      });
      toast.success(`✓ Margen aplicado a ${r.data.total_products} productos`);
      setPreview(null);
      loadHistory();
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Error al aplicar'));
    } finally { setApplying(false); }
  };

  const handleUpdateListPolicy = async (list, patch) => {
    const next = {
      name: list.name,
      requires_auth: !!list.requires_auth,
      is_active: list.is_active !== false,
      currency_code: patch.currency_code ?? list.currency_code ?? 'FLEX',
      payment_policy: patch.payment_policy ?? list.payment_policy ?? 'flexible',
    };
    try {
      await apiClient.put(`/price-lists/${list.id}`, next);
      toast.success('Lista actualizada');
      loadLists();
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'No se pudo actualizar la lista'));
    }
  };

  const handleDeleteList = async (list) => {
    const msg = `¿Eliminar la lista "${list.name}"?\n\n` +
      `Se borrarán TODOS los precios asociados a esta lista (un precio por producto).\n` +
      `Esta acción NO se puede deshacer.\n\n` +
      `Escribe el nombre de la lista para confirmar.`;
    const confirm = window.prompt(msg);
    if (confirm !== list.name) {
      if (confirm !== null) toast.error('El nombre no coincide. Cancelado.');
      return;
    }
    try {
      const r = await apiClient.delete(`/config/pricing/price-lists/${list.id}`);
      toast.success(r.data?.message || 'Lista eliminada');
      // Si la lista borrada era la seleccionada, limpiar
      if (form.price_list_id === list.id) {
        setForm(p => ({ ...p, price_list_id: null }));
      }
      loadLists();
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Error al eliminar'));
    }
  };

  const handleRevert = async (logId) => {
    if (!window.confirm('¿Revertir este cambio? Los precios volverán a su valor anterior.')) return;
    try {
      await apiClient.post(`/config/pricing/history/${logId}/revert`);
      toast.success('Cambio revertido. Precios restaurados.');
      loadHistory();
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Error al revertir'));
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-white shadow-sm">
          <Calculator className="text-white" size={22} />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900">Cambio masivo de precios</h2>
          <p className="text-sm text-slate-500">
            Aplica un margen porcentual a todos los productos a la vez
          </p>
        </div>
      </div>

      {/* Banner explicativo */}
      <div className="flex items-start gap-3 rounded-lg border border-indigo-100 bg-indigo-50 p-4">
        <Info size={18} className="mt-0.5 flex-shrink-0 text-indigo-600" />
        <div className="text-xs leading-relaxed text-indigo-900">
          <p className="font-bold mb-1">¿Qué hace cada opción de "A qué actualizar"?</p>
          <ul className="space-y-0.5 ml-4 list-disc">
            <li><strong>Lista de precios</strong> — actualiza el precio que el cliente paga en el POS (table <code className="rounded bg-indigo-100 px-1">product_prices</code>). El precio en el formulario del producto NO cambia.</li>
            <li><strong>Precio base</strong> — actualiza el campo "PRECIO DE VENTA" que ves en el formulario del producto (<code className="rounded bg-indigo-100 px-1">products.price</code>).</li>
            <li><strong>Ambos (recomendado)</strong> — actualiza los dos a la vez. Lo que ves en el formulario y lo que paga el cliente quedan iguales.</li>
          </ul>
        </div>
      </div>

      {/* Formulario */}
      <div className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Margen */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block flex items-center gap-1">
              <TrendingUp size={11} /> Margen a aplicar
            </label>
            <div className="relative">
              <input
                type="number" step="0.01" min="-99" max="10000"
                value={form.margin_percent}
                onChange={e => setForm(p => ({ ...p, margin_percent: e.target.value }))}
                className="w-full pl-3 pr-10 py-2.5 rounded-md border border-slate-200 text-lg font-bold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Ej. 45% = costo × 1.45 (un costo de $100 se vende a $145)
            </p>
            <button
              type="button"
              onClick={saveDefaultMargin}
              className="mt-2 text-[10px] font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md px-2.5 py-1.5 transition-colors"
              title="Guarda este valor como margen predeterminado (lo usará también el formulario de producto al calcular)"
            >
              ⭐ Guardar como margen predeterminado
            </button>
          </div>

          {/* Target */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
              ¿A qué actualizar?
            </label>
            <select value={form.target}
              onChange={e => setForm(p => ({ ...p, target: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-md border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-white">
              <option value="price_list">Lista de precios (recomendado)</option>
              <option value="product_price">Precio base del producto</option>
              <option value="both">Ambos</option>
            </select>
          </div>

          {/* Lista de precios */}
          {(form.target === 'price_list' || form.target === 'both') && (
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                Lista de precios
              </label>
              <select value={form.price_list_id || ''}
                onChange={e => setForm(p => ({ ...p, price_list_id: parseInt(e.target.value) }))}
                className="w-full px-3 py-2.5 rounded-md border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-white">
                <option value="">-- Selecciona --</option>
                {priceLists.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.name} {!l.is_active && '(inactiva)'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Redondeo */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
              Redondeo
            </label>
            <select value={form.rounding}
              onChange={e => setForm(p => ({ ...p, rounding: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-md border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-white">
              {Object.entries(ROUNDING_LABELS).map(([k,v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
            Notas (opcional)
          </label>
          <input type="text" placeholder="Ej: Ajuste por inflación de mayo"
            value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-md border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
        </div>

        {/* Botones */}
        <div className="flex gap-3 pt-2">
          <button onClick={handlePreview} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition disabled:opacity-50">
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Eye size={14} />}
            Generar vista previa
          </button>
          <button onClick={handleApply}
            disabled={!preview || applying}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm disabled:opacity-50 transition-colors">
            {applying ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Aplicar a todos
          </button>
        </div>
      </div>

      {/* Gestión de listas de precios existentes */}
      {priceLists.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-black text-slate-800 text-sm flex items-center gap-2 mb-3">
            <DollarSign size={14} className="text-slate-500" /> Listas de precios existentes
          </h3>
          <div className="space-y-2">
            {priceLists.map(l => (
              <div key={l.id}
                className={`flex items-center justify-between rounded-md border p-3 ${
                  l.is_active ? 'border-slate-200' : 'border-slate-100 bg-slate-50 opacity-70'
                }`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-md ${
                    l.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200 text-slate-400'
                  }`}>
                    <DollarSign size={15} />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-800">{l.name}</p>
                    <p className="text-[10px] text-slate-400">
                      ID #{l.id} · {l.is_active ? 'Activa' : 'Inactiva'} · {(l.currency_code || 'FLEX') === 'FLEX' ? 'Flexible' : l.currency_code}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <select
                    value={l.currency_code || 'FLEX'}
                    onChange={e => handleUpdateListPolicy(l, { currency_code: e.target.value })}
                    className="h-9 rounded-md border border-indigo-100 bg-indigo-50 px-2 text-xs font-black text-indigo-700 outline-none focus:border-indigo-400">
                    {PRICE_LIST_CURRENCY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <select
                    value={l.payment_policy || 'flexible'}
                    onChange={e => handleUpdateListPolicy(l, { payment_policy: e.target.value })}
                    className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-400">
                    {PRICE_LIST_POLICY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <button
                    onClick={() => handleDeleteList(l)}
                    title="Eliminar lista y todos sus precios"
                    className="flex h-9 items-center gap-1.5 rounded-md bg-rose-50 px-3 text-xs font-bold text-rose-700 hover:bg-rose-100">
                    <Trash2 size={12} /> Borrar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="space-y-4 rounded-lg border border-indigo-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-black text-slate-800 flex items-center gap-2">
              <Eye size={16} className="text-indigo-500" />
              Vista previa
            </h3>
            <div className="flex items-center gap-3 text-xs">
              <span className="rounded-md bg-indigo-50 px-2.5 py-1 font-bold text-indigo-700">
                {preview.total_products} productos
              </span>
              <span className="text-slate-500">
                Valor antes: <span className="font-bold text-slate-800">${preview.total_value_before.toFixed(2)}</span>
              </span>
              <ChevronRight size={12} className="text-slate-400" />
              <span className="text-slate-500">
                Después: <span className="font-bold text-emerald-700">${preview.total_value_after.toFixed(2)}</span>
              </span>
              <span className={`font-bold px-2 py-0.5 rounded ${preview.total_value_after >= preview.total_value_before ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'}`}>
                {preview.total_value_after >= preview.total_value_before ? '+' : ''}{((preview.total_value_after - preview.total_value_before) / Math.max(preview.total_value_before, 1) * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          {Math.abs(preview.total_value_after - preview.total_value_before) < 0.01 && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-bold text-amber-800">No hay cambios que aplicar</p>
                <p className="text-xs text-amber-700 mt-1">
                  Los precios de esta lista ya están a este margen, o el redondeo los deja iguales.
                  Probá con un margen mayor para ver cambios reales.
                </p>
              </div>
            </div>
          )}

          <p className="text-[11px] text-slate-500">
            Mostrando primeras 10 filas. Al aplicar, se procesarán las {preview.total_products}.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-bold">Producto</th>
                  <th className="px-3 py-2 text-right font-bold">Costo</th>
                  <th className="px-3 py-2 text-right font-bold">Antes</th>
                  <th className="px-3 py-2 text-right font-bold">Después</th>
                  <th className="px-3 py-2 text-right font-bold">Δ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.sample.map(s => (
                  <tr key={s.product_id}>
                    <td className="px-3 py-2 font-medium text-slate-800">{s.product_name}</td>
                    <td className="px-3 py-2 text-right text-slate-500">${s.cost_price.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-slate-500">${s.price_before.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-bold text-emerald-700">${s.price_after.toFixed(2)}</td>
                    <td className={`px-3 py-2 text-right font-bold ${s.diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {s.diff >= 0 ? '+' : ''}${s.diff.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800">
              Al hacer click en "Aplicar a todos" se actualizan los precios de los {preview.total_products} productos.
              Quedará registrado en el historial y podrás revertir si lo necesitas.
            </p>
          </div>
        </div>
      )}

      {/* Historial */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-slate-800 flex items-center gap-2">
            <History size={16} className="text-slate-500" /> Historial de cambios
          </h3>
          <button onClick={loadHistory} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition">
            <RefreshCw size={14} />
          </button>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">
            No hay cambios registrados todavía
          </p>
        ) : (
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id}
                className={`flex items-center justify-between gap-3 rounded-md border p-3 ${
                  h.reverted_at ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-100 hover:border-indigo-200'
                }`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md ${
                    h.reverted_at ? 'bg-slate-200 text-slate-500' : 'bg-indigo-50 text-indigo-600'
                  }`}>
                    <DollarSign size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-sm font-bold text-slate-800">
                      <span>{h.margin_percent}%</span>
                      <span className="text-slate-400 font-normal">·</span>
                      <span className="text-xs font-semibold bg-slate-100 px-2 py-0.5 rounded">
                        {TARGET_LABELS[h.target] || h.target}
                      </span>
                      <span className="text-slate-400 font-normal">·</span>
                      <span className="text-xs text-slate-500">{h.total_products} productos</span>
                      {h.reverted_at && (
                        <span className="text-[10px] font-bold bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded ml-1">
                          REVERTIDO
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(h.applied_at).toLocaleString('es-VE')}
                      {' · '}
                      por {h.user_email || '—'}
                      {h.notes ? ` · ${h.notes}` : ''}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      ${h.total_value_before.toFixed(2)} → ${h.total_value_after.toFixed(2)}
                    </p>
                  </div>
                </div>
                {!h.reverted_at && (
                  <button onClick={() => handleRevert(h.id)}
                    className="flex flex-shrink-0 items-center gap-1.5 rounded-md bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100">
                    <Undo2 size={12} /> Revertir
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
