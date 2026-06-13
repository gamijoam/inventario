import React, { useState, useRef, useEffect, useCallback } from 'react';
import apiClient from '../../../config/axios';
import { API_ROOT_URL } from '../../../config/constants';
import { toast } from 'react-hot-toast';
import {
  Upload, Search, Check, AlertTriangle, Package,
  ArrowRight, X, FileJson, RefreshCw, Warehouse, Camera, Image as ImageIcon
} from 'lucide-react';

/* Product search modal */
function ProductSearchModal({ isOpen, onClose, onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query || query.length < 2) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await apiClient.get('/products', { params: { search: query, limit: 30 } });
        setResults(res.data?.items ?? res.data ?? []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 pt-[10vh]">
      <div className="bg-white w-full max-w-lg rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-slate-100 bg-slate-50">
          <Search size={20} className="text-indigo-600" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar producto por nombre o codigo..."
            className="flex-1 bg-transparent outline-none text-slate-700 font-medium placeholder:text-slate-400"
          />
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8 text-slate-400 gap-2">
              <RefreshCw size={16} className="animate-spin" />
              Buscando...
            </div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">Sin resultados para "{query}"</div>
          )}

          {!loading && query.length < 2 && (
            <div className="text-center py-8 text-slate-400 text-sm">Escribe al menos 2 caracteres</div>
          )}

          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onSelect({ id: p.id, sku: p.sku, name: p.name, stock: p.stock ?? p.current_stock ?? 0 });
                onClose();
              }}
              className="w-full text-left px-4 py-3 hover:bg-indigo-50 flex items-center gap-3 border-b border-slate-50 last:border-0 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-700 truncate">{p.name}</div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="font-mono text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{p.sku || 'SIN SKU'}</span>
                  <span className="text-xs text-slate-400">Stock: {p.stock ?? p.current_stock ?? 0}</span>
                </div>
              </div>
              <ArrowRight size={16} className="text-slate-300 flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Match badge helper */
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

/* Main component */
const ExternalTransferIn = () => {
  const fileInputRef = useRef(null);
  const [step, setStep] = useState('upload');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [previewItems, setPreviewItems] = useState([]);
  const [packageId, setPackageId] = useState('');
  const [sourceCompany, setSourceCompany] = useState('');
  const [sourceSchema, setSourceSchema] = useState('');
  const [sourceWarehouseName, setSourceWarehouseName] = useState('');
  const [packageStats, setPackageStats] = useState({ models: 0, units: 0, imeis: 0, photos: 0 });

  const [warehouses, setWarehouses] = useState([]);
  const [globalWarehouseId, setGlobalWarehouseId] = useState('');

  const [result, setResult] = useState(null);
  const [photoUrls, setPhotoUrls] = useState([]);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  // Modal state
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchModalIdx, setSearchModalIdx] = useState(null);

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const res = await apiClient.get('/warehouses');
        setWarehouses(res.data?.items ?? res.data ?? []);
      } catch { /* silent */ }
    };
    fetchWarehouses();
  }, []);

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
      setPackageId(data.package_id || '');
      setSourceCompany(data.source_company || '');
      setSourceSchema(data.source_schema || '');
      setSourceWarehouseName(data.source_warehouse_name || '');
      setPhotoUrls(data.photo_urls || []);
      const items = (data.items || []).map((item) => ({
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        match_type: item.match_type || 'none',
        matched_product_id: item.matched_product_id || null,
        matched_sku: item.matched_sku || '',
        matched_name: item.matched_name || '',
        matched_stock: item.matched_stock ?? 0,
        has_imei: !!item.has_imei,
        serial_numbers: item.serial_numbers || [],
        create_new: false,
        warehouse_id: null,
        _override: item.matched_product_id
          ? { id: item.matched_product_id, sku: item.matched_sku, name: item.matched_name, stock: item.matched_stock ?? 0 }
          : null,
      }));
      const units = Number(data.units_count ?? items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0));
      const imeis = Number(data.imei_count ?? items.reduce((sum, item) => sum + (item.serial_numbers?.length || 0), 0));
      const photos = Number(data.photos_count ?? (data.photo_urls || []).length);
      setPackageStats({ models: Number(data.models_count ?? data.items_count ?? items.length), units, imeis, photos });
      setPreviewItems(items);
      setStep('preview');
      toast.success(`${items.length} modelos cargados para revision`);
    } catch (error) {
      const detail = error.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map(d => d.msg || JSON.stringify(d)).join(', ') : 'Error al previsualizar el archivo';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const updateItem = useCallback((idx, patch) => {
    setPreviewItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }, []);

  const openSearchFor = (idx) => {
    setSearchModalIdx(idx);
    setSearchModalOpen(true);
  };

  const handleModalSelect = (product) => {
    if (searchModalIdx !== null && product) {
      updateItem(searchModalIdx, {
        _override: product,
        create_new: false,
      });
    }
    setSearchModalIdx(null);
  };

  const handleGlobalWarehouseChange = useCallback((warehouseId) => {
    const wId = warehouseId ? parseInt(warehouseId, 10) : null;
    setGlobalWarehouseId(warehouseId);
    setPreviewItems((prev) => prev.map((it) => ({ ...it, warehouse_id: wId })));
  }, []);

  const mappedCount = previewItems.filter((it) => it._override || it.create_new).length;
  const totalCount = previewItems.length;
  const mappedUnits = previewItems.filter((it) => it._override || it.create_new).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const totalUnits = packageStats.units || previewItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const totalImeis = packageStats.imeis || previewItems.reduce((sum, item) => sum + (item.serial_numbers?.length || 0), 0);
  const noMatchCount = previewItems.filter((it) => !it._override && !it.create_new).length;
  const createNewCount = previewItems.filter((it) => it.create_new).length;
  const mappedPct = totalCount > 0 ? Math.round((mappedCount / totalCount) * 100) : 0;

  const handleConfirm = async () => {
    const items = previewItems
      .filter((it) => it._override || it.create_new)
      .map((it) => ({
        sku: it.sku,
        name: it.name,
        quantity: it.quantity,
        has_imei: !!it.has_imei,
        serial_numbers: it.serial_numbers || [],
        target_product_id: it._override?.id || null,
        create_new: it.create_new,
        warehouse_id: it.warehouse_id || null,
      }));

    if (items.length === 0) {
      toast.error('No hay productos mapeados para importar');
      return;
    }
    if (items.length !== previewItems.length) {
      toast.error('Debes mapear todos los productos antes de confirmar');
      return;
    }

    try {
      setConfirming(true);
      const res = await apiClient.post('/inventory/transfer/import-mapped', {
        package_id: packageId || null,
        source_company: sourceCompany,
        source_schema: sourceSchema || null,
        warehouse_id: globalWarehouseId ? parseInt(globalWarehouseId, 10) : null,
        items,
      });
      setResult(res.data);
      setStep('result');
      toast.success('Traslado confirmado');
    } catch (error) {
      const detail = error.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map(d => d.msg || JSON.stringify(d)).join(', ') : 'Error al confirmar el traslado';
      toast.error(msg);
    } finally {
      setConfirming(false);
    }
  };

  const resetProcess = () => {
    setFile(null);
    setPreviewItems([]);
    setPackageId('');
    setSourceCompany('');
    setSourceSchema('');
    setSourceWarehouseName('');
    setPackageStats({ models: 0, units: 0, imeis: 0, photos: 0 });
    setPhotoUrls([]);
    setShowPhotoModal(false);
    setSelectedPhoto(null);
    setResult(null);
    setStep('upload');
    setGlobalWarehouseId('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* Render */

  // Step 1: Upload
  if (step === 'upload') {
    return (
      <div className="flex h-full bg-slate-50 items-center justify-center p-6">
        <div className="bg-white w-full max-w-lg rounded-lg shadow-xl p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <Upload size={22} className="text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Importar Inventario</h2>
          </div>
          <p className="text-slate-500 mb-8 text-sm">
            Carga el archivo JSON generado por la otra sucursal. Podrás revisar y mapear los productos antes de confirmar.
          </p>

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
            className="mt-6 w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-sm shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
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

  // Step 2: Preview table
  if (step === 'preview') {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        {/* Search Modal */}
        <ProductSearchModal
          isOpen={searchModalOpen}
          onClose={() => { setSearchModalOpen(false); setSearchModalIdx(null); }}
          onSelect={handleModalSelect}
        />

        {/* Header */}
        <div className="border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Revision de traslado entrante</h2>
              <p className="text-sm text-slate-500">
                Origen: <span className="font-semibold text-slate-700">{sourceCompany || 'Sin origen'}</span>
                {sourceWarehouseName && <span> / {sourceWarehouseName}</span>}
              </p>
              {packageId && <p className="mt-0.5 font-mono text-[11px] text-slate-400">{packageId}</p>}
            </div>
            <div className="min-w-0 flex-1 xl:max-w-md">
              <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-500">
                <span>{mappedCount} de {totalCount} modelos mapeados</span>
                <span>{mappedPct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${mappedPct}%` }} />
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-6">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><p className="text-[10px] font-bold uppercase text-slate-400">Modelos</p><p className="text-lg font-black text-slate-800">{packageStats.models || totalCount}</p></div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2"><p className="text-[10px] font-bold uppercase text-emerald-600">Unidades</p><p className="text-lg font-black text-emerald-700">{totalUnits}</p></div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"><p className="text-[10px] font-bold uppercase text-amber-600">IMEI</p><p className="text-lg font-black text-amber-700">{totalImeis}</p></div>
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2"><p className="text-[10px] font-bold uppercase text-indigo-600">Fotos</p><p className="text-lg font-black text-indigo-700">{packageStats.photos || photoUrls.length}</p></div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2"><p className="text-[10px] font-bold uppercase text-blue-600">A crear</p><p className="text-lg font-black text-blue-700">{createNewCount}</p></div>
            <div className={`rounded-lg border px-3 py-2 ${noMatchCount ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}><p className={`text-[10px] font-bold uppercase ${noMatchCount ? 'text-red-600' : 'text-emerald-600'}`}>Pendientes</p><p className={`text-lg font-black ${noMatchCount ? 'text-red-700' : 'text-emerald-700'}`}>{noMatchCount}</p></div>
          </div>
        </div>
        {warehouses.length > 0 && (
          <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3">
            <Warehouse size={18} className="text-indigo-500 flex-shrink-0" />
            <label className="text-sm font-semibold text-slate-700 flex-shrink-0">Enviar todo a:</label>
            <select
              value={globalWarehouseId}
              onChange={(e) => handleGlobalWarehouseChange(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none min-w-[200px]"
            >
              <option value="">-- Sin almacén (stock global) --</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>{wh.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Photo Evidence Section */}
        {photoUrls.length > 0 && (
          <div className="bg-white border-b border-slate-200 px-6 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Camera size={16} className="text-indigo-500" />
              <span className="text-sm font-bold text-slate-700">Evidencia fotografica ({photoUrls.length} foto{photoUrls.length !== 1 ? 's' : ''})</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photoUrls.map((url, idx) => (
                <button
                  key={idx}
                  onClick={() => { setSelectedPhoto(url); setShowPhotoModal(true); }}
                  className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-slate-200 hover:border-indigo-400 transition-colors"
                >
                  <img src={`${API_ROOT_URL}${url}`} alt={`Evidencia ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Photo Lightbox Modal */}
        {showPhotoModal && selectedPhoto && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setShowPhotoModal(false)}
          >
            <div className="relative max-w-3xl max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowPhotoModal(false)}
                className="absolute -top-3 -right-3 bg-white rounded-full p-1.5 shadow-lg hover:bg-slate-100 transition-colors z-10"
              >
                <X size={18} className="text-slate-600" />
              </button>
              <img
                src={`${API_ROOT_URL}${selectedPhoto}`}
                alt="Evidencia de traslado"
                className="max-w-full max-h-[85vh] rounded-xl shadow-xl object-contain"
              />
              {/* Navigation arrows */}
              {photoUrls.length > 1 && (
                <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-2 pointer-events-none">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const currentIdx = photoUrls.indexOf(selectedPhoto);
                      const prevIdx = (currentIdx - 1 + photoUrls.length) % photoUrls.length;
                      setSelectedPhoto(photoUrls[prevIdx]);
                    }}
                    className="pointer-events-auto bg-white/80 hover:bg-white rounded-full p-2 shadow-lg transition-colors"
                  >
                    <ArrowRight size={18} className="text-slate-700 rotate-180" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const currentIdx = photoUrls.indexOf(selectedPhoto);
                      const nextIdx = (currentIdx + 1) % photoUrls.length;
                      setSelectedPhoto(photoUrls[nextIdx]);
                    }}
                    className="pointer-events-auto bg-white/80 hover:bg-white rounded-full p-2 shadow-lg transition-colors"
                  >
                    <ArrowRight size={18} className="text-slate-700" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto px-6 py-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Producto origen</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 w-20">Cant</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 w-28">Match</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 min-w-[240px]">Producto Local</th>
                  {warehouses.length > 0 && (
                    <th className="text-center px-4 py-3 font-semibold text-slate-600 w-40">Almacen</th>
                  )}
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 w-32">Accion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewItems.map((item, idx) => {
                  const hasOverride = !!item._override;

                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs text-indigo-600">{item.sku}</div>
                        <div className="text-slate-700 truncate max-w-[200px]">{item.name}</div>
                        {item.serial_numbers?.length > 0 && (
                          <div className="text-[10px] text-amber-700 font-bold mt-1">
                            {item.serial_numbers.length} IMEI{item.serial_numbers.length > 1 ? 's' : ''}: {item.serial_numbers.slice(0, 2).join(', ')}{item.serial_numbers.length > 2 ? '...' : ''}
                          </div>
                        )}
                      </td>

                      <td className="text-center px-4 py-3">
                        <span className="font-bold text-slate-800">{item.quantity}</span>
                      </td>

                      <td className="text-center px-4 py-3">
                        <MatchBadge type={item.match_type} />
                      </td>

                      <td className="px-4 py-3">
                        {hasOverride ? (
                          <button
                            onClick={() => openSearchFor(idx)}
                            className="text-left hover:bg-slate-100 rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors w-full"
                            title="Click para cambiar producto"
                          >
                            <div className="font-mono text-xs text-emerald-600">{item._override.sku}</div>
                            <div className="text-slate-700 truncate max-w-[200px]">{item._override.name}</div>
                            <div className="text-xs text-slate-400">Stock: {item._override.stock}</div>
                          </button>
                        ) : (
                          <button
                            onClick={() => openSearchFor(idx)}
                            className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-sm font-medium transition-colors"
                          >
                            <Search size={14} />
                            Buscar producto
                          </button>
                        )}
                      </td>

                      {warehouses.length > 0 && (
                        <td className="text-center px-4 py-3">
                          <select
                            value={item.warehouse_id ?? ''}
                            onChange={(e) => updateItem(idx, { warehouse_id: e.target.value ? parseInt(e.target.value, 10) : null })}
                            className="border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-600 focus:ring-2 focus:ring-indigo-300 outline-none w-full max-w-[140px]"
                          >
                            <option value="">Global</option>
                            {warehouses.map((wh) => (
                              <option key={wh.id} value={wh.id}>{wh.name}</option>
                            ))}
                          </select>
                        </td>
                      )}

                      <td className="text-center px-4 py-3">
                        {hasOverride ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                            <Check size={14} />
                            Mapeado
                          </span>
                        ) : (
                          <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={item.create_new}
                              onChange={(e) => updateItem(idx, { create_new: e.target.checked, _override: null })}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-slate-600">Crear nuevo</span>
                          </label>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={resetProcess}
            className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <div className="text-sm text-slate-500">
            Listo para importar: <span className="font-bold text-slate-800">{mappedUnits}</span> de <span className="font-bold text-slate-800">{totalUnits}</span> unidades
          </div>
          <button
            onClick={handleConfirm}
            disabled={mappedCount !== totalCount || confirming}
            className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl shadow-sm shadow-emerald-100 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {confirming ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Confirmando...
              </>
            ) : (
              <>
                <Package size={16} />
                Confirmar traslado ({mappedCount} modelos / {mappedUnits} unidades)
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Step 3: Result
  return (
    <div className="flex h-full bg-slate-50 items-center justify-center p-6">
      <div className="bg-white w-full max-w-lg rounded-lg shadow-xl p-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">Resultado del traslado</h2>


        <div className="mb-6 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3"><p className="text-[10px] font-bold uppercase text-slate-400">Modelos</p><p className="text-xl font-black text-slate-800">{result?.models_count ?? result?.success_count ?? 0}</p></div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3"><p className="text-[10px] font-bold uppercase text-emerald-600">Unidades</p><p className="text-xl font-black text-emerald-700">{result?.units_count ?? 0}</p></div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3"><p className="text-[10px] font-bold uppercase text-amber-600">IMEI</p><p className="text-xl font-black text-amber-700">{result?.imei_count ?? 0}</p></div>
        </div>

        <div className="space-y-4 mb-8">
          {(result?.imported_count ?? result?.success_count ?? 0) > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-4">
              <div className="bg-emerald-100 p-2 rounded-lg">
                <Check size={24} className="text-emerald-600" />
              </div>
              <div>
                <div className="text-2xl font-black text-emerald-600">
                  {result?.imported_count ?? result?.success_count ?? 0}
                </div>
                <div className="text-sm text-emerald-700 font-medium">Modelos importados</div>
              </div>
            </div>
          )}

          {(result?.created_count ?? 0) > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-4">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Package size={24} className="text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-black text-blue-600">{result.created_count}</div>
                <div className="text-sm text-blue-700 font-medium">Modelos creados</div>
              </div>
            </div>
          )}

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

          {(result?.errors?.length ?? 0) === 0 && (
            <div className="text-center text-slate-400 text-sm py-2">Sin errores reportados</div>
          )}
        </div>

        <button
          onClick={resetProcess}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-sm shadow-indigo-100 hover:bg-indigo-700 transition-all"
        >
          <RefreshCw size={18} />
          Importar otro
        </button>
      </div>
    </div>
  );
};

export default ExternalTransferIn;
