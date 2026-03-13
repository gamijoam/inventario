import React, { useState, useRef, useEffect, useCallback } from 'react';
import apiClient from '../../../config/axios';
import { toast } from 'react-hot-toast';
import {
  Upload, Search, Check, AlertTriangle, Package,
  ArrowRight, X, FileJson, RefreshCw
} from 'lucide-react';

/* ─── Inline searchable product selector ─── */
function ProductSearchSelect({ value, onChange, currentMatch }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  // Click-outside to close
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await apiClient.get('/products', { params: { search: query, limit: 20 } });
        setResults(res.data?.items ?? res.data ?? []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  if (value) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium text-slate-700">{value.sku}</span>
        <span className="text-slate-500 truncate max-w-[140px]">{value.name}</span>
        <button onClick={() => onChange(null)} className="text-slate-400 hover:text-red-500 flex-shrink-0">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-300 focus-within:border-indigo-400">
        <Search size={14} className="ml-2 text-slate-400 flex-shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder="Buscar producto..."
          className="w-full px-2 py-1.5 text-sm outline-none bg-transparent"
        />
      </div>
      {open && (query.length >= 2) && (
        <div className="absolute z-50 mt-1 w-72 bg-white border border-slate-200 rounded-lg shadow-xl max-h-52 overflow-y-auto">
          {loading && <div className="px-3 py-2 text-sm text-slate-400">Buscando...</div>}
          {!loading && results.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">Sin resultados</div>}
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onChange({ id: p.id, sku: p.sku, name: p.name, stock: p.stock ?? p.current_stock ?? 0 });
                setQuery('');
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 flex items-center gap-2 border-b border-slate-50 last:border-0"
            >
              <span className="font-mono text-xs text-indigo-600 flex-shrink-0">{p.sku}</span>
              <span className="truncate text-slate-700">{p.name}</span>
              <span className="ml-auto text-xs text-slate-400 flex-shrink-0">Stock: {p.stock ?? p.current_stock ?? 0}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Match badge helper ─── */
const MATCH_CONFIG = {
  exact:  { label: 'Exacto',     color: 'bg-emerald-100 text-emerald-700', icon: Check },
  fuzzy:  { label: 'Similar',    color: 'bg-yellow-100 text-yellow-700',   icon: AlertTriangle },
  name:   { label: 'Por nombre', color: 'bg-blue-100 text-blue-700',       icon: Search },
  none:   { label: 'Sin match',  color: 'bg-red-100 text-red-700',         icon: X },
};

function MatchBadge({ type }) {
  const cfg = MATCH_CONFIG[type] || MATCH_CONFIG.none;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
      <Icon size={12} />
      {cfg.label}
    </span>
  );
}

/* ─── Main component ─── */
const ExternalTransferIn = () => {
  const fileInputRef = useRef(null);
  const [step, setStep] = useState('upload');   // upload | preview | result
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Preview data
  const [previewItems, setPreviewItems] = useState([]);
  const [sourceCompany, setSourceCompany] = useState('');

  // Result data
  const [result, setResult] = useState(null);

  /* ── Upload handlers ── */
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (!selected.name.endsWith('.json') && selected.type !== 'application/json') {
        toast.error('Solo se permiten archivos JSON');
        return;
      }
      setFile(selected);
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploading(true);
      const res = await apiClient.post('/inventory/transfer/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const data = res.data;
      setSourceCompany(data.source_company || '');
      const items = (data.items || []).map((item) => ({
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        match_type: item.match_type || 'none',
        matched_product_id: item.matched_product_id || null,
        matched_sku: item.matched_sku || '',
        matched_name: item.matched_name || '',
        matched_stock: item.matched_stock ?? 0,
        create_new: false,
        // editable override via search
        _override: item.matched_product_id
          ? { id: item.matched_product_id, sku: item.matched_sku, name: item.matched_name, stock: item.matched_stock ?? 0 }
          : null,
        _editing: false,
      }));
      setPreviewItems(items);
      setStep('preview');
      toast.success(`${items.length} productos cargados para revisión`);
    } catch (error) {
      const msg = error.response?.data?.detail || 'Error al previsualizar el archivo';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  /* ── Preview item mutation helpers ── */
  const updateItem = useCallback((idx, patch) => {
    setPreviewItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }, []);

  const handleProductSelect = useCallback((idx, product) => {
    if (product) {
      updateItem(idx, {
        _override: product,
        _editing: false,
        create_new: false,
      });
    } else {
      updateItem(idx, { _override: null, _editing: true });
    }
  }, [updateItem]);

  /* ── Derived stats ── */
  const mappedCount = previewItems.filter((it) => it._override || it.create_new).length;
  const totalCount = previewItems.length;
  const mappedPct = totalCount > 0 ? Math.round((mappedCount / totalCount) * 100) : 0;

  /* ── Confirm import ── */
  const handleConfirm = async () => {
    const items = previewItems
      .filter((it) => it._override || it.create_new)
      .map((it) => ({
        source_sku: it.sku,
        source_name: it.name,
        quantity: it.quantity,
        matched_product_id: it._override?.id || null,
        create_new: it.create_new,
      }));

    if (items.length === 0) {
      toast.error('No hay productos mapeados para importar');
      return;
    }

    try {
      setConfirming(true);
      const res = await apiClient.post('/inventory/transfer/import-mapped', {
        source_company: sourceCompany,
        warehouse_id: null,
        items,
      });
      setResult(res.data);
      setStep('result');
      toast.success('Traslado confirmado');
    } catch (error) {
      const msg = error.response?.data?.detail || 'Error al confirmar el traslado';
      toast.error(msg);
    } finally {
      setConfirming(false);
    }
  };

  /* ── Reset ── */
  const resetProcess = () => {
    setFile(null);
    setPreviewItems([]);
    setSourceCompany('');
    setResult(null);
    setStep('upload');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ──────────────────── RENDER ──────────────────── */

  // ── Step 1: Upload ──
  if (step === 'upload') {
    return (
      <div className="flex h-full bg-slate-50 items-center justify-center p-6">
        <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <Upload size={22} className="text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Importar Inventario</h2>
          </div>
          <p className="text-slate-500 mb-8 text-sm">
            Carga el archivo JSON generado por la otra sucursal. Podrás revisar y mapear los productos antes de confirmar.
          </p>

          {/* Drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all py-12 ${
              file ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />
            {file ? (
              <div className="text-center">
                <FileJson size={48} className="text-emerald-500 mx-auto mb-3" />
                <p className="font-bold text-slate-700 break-all">{file.name}</p>
                <p className="text-xs text-slate-500 mt-1">Listo para previsualizar</p>
              </div>
            ) : (
              <div className="text-center">
                <FileJson size={48} className="text-slate-300 mx-auto mb-3" />
                <p className="font-bold text-slate-600">Click para seleccionar archivo</p>
                <p className="text-xs text-slate-400 mt-1">Solo archivos .json</p>
              </div>
            )}
          </div>

          <button
            onClick={handlePreview}
            disabled={!file || uploading}
            className="mt-6 w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <ArrowRight size={18} />
                Previsualizar
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2: Preview table ──
  if (step === 'preview') {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Revisión de Productos</h2>
            {sourceCompany && (
              <p className="text-sm text-slate-500">Origen: <span className="font-semibold">{sourceCompany}</span></p>
            )}
          </div>

          {/* Summary bar */}
          <div className="flex items-center gap-4">
            <div className="text-sm text-slate-600">
              <span className="font-bold text-indigo-600">{mappedCount}</span> de{' '}
              <span className="font-bold">{totalCount}</span> productos mapeados
            </div>
            <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${mappedPct}%` }}
              />
            </div>
            <span className="text-xs font-bold text-slate-500">{mappedPct}%</span>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-6 py-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Producto Origen</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 w-20">Cant</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 w-28">Match</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 min-w-[240px]">Producto Local</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 w-32">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewItems.map((item, idx) => {
                  const hasOverride = !!item._override;
                  const isEditing = item._editing;
                  const showSearch = !hasOverride || isEditing;

                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      {/* Source product */}
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs text-indigo-600">{item.sku}</div>
                        <div className="text-slate-700 truncate max-w-[200px]">{item.name}</div>
                      </td>

                      {/* Quantity */}
                      <td className="text-center px-4 py-3">
                        <span className="font-bold text-slate-800">{item.quantity}</span>
                      </td>

                      {/* Match type badge */}
                      <td className="text-center px-4 py-3">
                        <MatchBadge type={item.match_type} />
                      </td>

                      {/* Local product */}
                      <td className="px-4 py-3">
                        {hasOverride && !isEditing ? (
                          <button
                            onClick={() => updateItem(idx, { _editing: true })}
                            className="text-left hover:bg-slate-100 rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors group w-full"
                            title="Click para cambiar producto"
                          >
                            <div className="font-mono text-xs text-emerald-600">{item._override.sku}</div>
                            <div className="text-slate-700 truncate max-w-[200px]">{item._override.name}</div>
                            <div className="text-xs text-slate-400">Stock: {item._override.stock}</div>
                          </button>
                        ) : (
                          <ProductSearchSelect
                            value={null}
                            onChange={(product) => handleProductSelect(idx, product)}
                            currentMatch={item.match_type}
                          />
                        )}
                      </td>

                      {/* Action */}
                      <td className="text-center px-4 py-3">
                        {hasOverride && !isEditing ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                            <Check size={14} />
                            Mapeado
                          </span>
                        ) : item.match_type === 'none' || (!hasOverride && !isEditing) ? (
                          <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={item.create_new}
                              onChange={(e) => updateItem(idx, { create_new: e.target.checked, _override: null })}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-slate-600">Crear nuevo</span>
                          </label>
                        ) : (
                          <span className="text-xs text-slate-400">--</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer actions */}
        <div className="bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={resetProcess}
            className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={mappedCount === 0 || confirming}
            className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {confirming ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Confirmando...
              </>
            ) : (
              <>
                <Package size={16} />
                Confirmar Traslado ({mappedCount})
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── Step 3: Result ──
  return (
    <div className="flex h-full bg-slate-50 items-center justify-center p-6">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">Resultado del Traslado</h2>

        <div className="space-y-4 mb-8">
          {/* Imported */}
          {(result?.imported_count ?? result?.success_count ?? 0) > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-4">
              <div className="bg-emerald-100 p-2 rounded-lg">
                <Check size={24} className="text-emerald-600" />
              </div>
              <div>
                <div className="text-2xl font-black text-emerald-600">
                  {result?.imported_count ?? result?.success_count ?? 0}
                </div>
                <div className="text-sm text-emerald-700 font-medium">Productos importados</div>
              </div>
            </div>
          )}

          {/* Created */}
          {(result?.created_count ?? 0) > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-4">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Package size={24} className="text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-black text-blue-600">{result.created_count}</div>
                <div className="text-sm text-blue-700 font-medium">Productos creados</div>
              </div>
            </div>
          )}

          {/* Errors */}
          {(result?.errors?.length ?? 0) > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-red-100 p-2 rounded-lg">
                  <AlertTriangle size={24} className="text-red-600" />
                </div>
                <div>
                  <div className="text-2xl font-black text-red-600">{result.errors.length}</div>
                  <div className="text-sm text-red-700 font-medium">Errores</div>
                </div>
              </div>
              <ul className="space-y-1 ml-12 text-sm text-red-600">
                {result.errors.map((err, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="mt-0.5 flex-shrink-0">-</span>
                    <span>{typeof err === 'string' ? err : err.message || JSON.stringify(err)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* No errors, all good */}
          {(result?.errors?.length ?? 0) === 0 && (
            <div className="text-center text-slate-400 text-sm py-2">
              Sin errores reportados
            </div>
          )}
        </div>

        <button
          onClick={resetProcess}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
        >
          <RefreshCw size={18} />
          Importar Otro
        </button>
      </div>
    </div>
  );
};

export default ExternalTransferIn;
