/**
 * StockSearch.jsx - Buscar producto en todas las empresas del grupo
 * Llama a GET /organizations/my-org/stock-search?q=...
 */
import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Store, AlertTriangle, ArrowLeftRight,
  Loader2, PackageSearch, Building2, Tag, Boxes
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';

const MIN_Q = 2;
const DEBOUNCE_MS = 350;

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

export default function StockSearch() {
  const navigate = useNavigate();
  const [q, setQ]               = useState('');
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError]       = useState(null);
  const debounceRef = useRef(null);
  const abortRef    = useRef(null);

  const runSearch = useCallback(async (query) => {
    const trimmed = (query || '').trim();
    if (trimmed.length < MIN_Q) {
      setData(null);
      setSearched(false);
      setError(null);
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const r = await apiClient.get('/organizations/my-org/stock-search', {
        params: { q: trimmed, limit_per_tenant: 50 },
        signal: controller.signal,
      });
      setData(r.data);
      setSearched(true);
    } catch (e) {
      if (e.name === 'CanceledError' || e.code === 'ERR_CANCELED') return;
      const msg = e?.response?.data?.detail || 'Error al buscar';
      setError(msg);
      setData(null);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (val) => {
    setQ(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), DEBOUNCE_MS);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    runSearch(q);
  };

  const handleRequestTransfer = (match) => {
    try {
      localStorage.setItem('prefill_transfer', JSON.stringify({
        from_tenant_id     : match.tenant_id,
        from_tenant_name   : match.tenant_name,
        from_tenant_schema : match.tenant_schema,
        product_sku        : match.sku,
        product_name       : match.name,
        stock_available    : match.stock,
        cost_price         : match.cost_price,
      }));
    } catch {}
    toast.success(`Producto seleccionado de ${match.tenant_name}`);
    navigate('/org/transfers');
  };

  const results       = data?.results || [];
  const tenantsCount  = data?.tenants_searched ?? 0;
  const totalMatches  = data?.total_matches ?? 0;
  const orgName       = data?.organization_name || '';
  const totalStock    = results.reduce((sum, item) => sum + (Number(item.stock) || 0), 0);
  const lowStockRows  = results.filter(item => item.low_stock).length;
  const bestMatch     = [...results].sort((a, b) => (Number(b.stock) || 0) - (Number(a.stock) || 0))[0];

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-100 shrink-0">
              <PackageSearch size={22} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wide text-indigo-500">Operacion empresarial</p>
              <h1 className="text-2xl font-black text-slate-950 truncate">Buscar stock en el grupo</h1>
              <p className="text-sm text-slate-500">Encuentra productos por SKU o nombre y solicita traslado desde la empresa con inventario.</p>
            </div>
          </div>
          {orgName && (
            <span className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2 text-xs font-black text-indigo-700">
              <Building2 size={14} /> {orgName}
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="SKU o nombre del producto"
            autoFocus
            className="w-full pl-12 pr-12 py-3 text-base rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition"
          />
          {loading && (
            <Loader2 size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-500 animate-spin" />
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold">Min. {MIN_Q} caracteres</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold">SKU por prefijo</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold">Nombre por coincidencia</span>
        </div>
      </form>

      {!searched && !loading && (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg p-10 text-center">
          <Search size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">Empieza a escribir para buscar productos en tu grupo empresarial.</p>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-sm text-rose-700">
          <AlertTriangle size={16} className="inline mr-2" />
          {error}
        </div>
      )}

      {searched && !loading && !error && results.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-8 text-center">
          <PackageSearch size={32} className="mx-auto text-amber-500 mb-2" />
          <p className="text-sm font-semibold text-amber-800">No se encontro nada para "{data?.query}"</p>
          <p className="text-xs text-amber-700 mt-1">Se revisaron {tenantsCount} empresas del grupo.</p>
        </div>
      )}

      {results.length > 0 && (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <MetricCard icon={PackageSearch} label="Coincidencias" value={totalMatches} tone="indigo" />
            <MetricCard icon={Store} label="Empresas" value={tenantsCount} tone="indigo" />
            <MetricCard icon={Boxes} label="Stock total" value={totalStock.toLocaleString()} tone="emerald" />
            <MetricCard icon={AlertTriangle} label="Stock bajo" value={lowStockRows} tone={lowStockRows > 0 ? 'rose' : 'amber'} />
          </div>

          {bestMatch && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-800 flex flex-wrap items-center gap-2">
              <span className="font-black">Mejor disponibilidad:</span>
              <span>{bestMatch.tenant_name}</span>
              <span className="font-black">{Number(bestMatch.stock || 0).toLocaleString()} un.</span>
            </div>
          )}

          <section className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
                  <PackageSearch size={18} />
                </div>
                <div>
                  <h2 className="font-black text-slate-900">Resultados</h2>
                  <p className="text-xs text-slate-500">{totalMatches} coincidencia{totalMatches !== 1 ? 's' : ''} para "{data?.query}".</p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {results.map((m, idx) => {
                const stock = Number(m.stock || 0);
                const minStock = Number(m.min_stock || 0);
                return (
                  <div key={`${m.tenant_id}-${m.product_id}-${idx}`} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex flex-col xl:flex-row xl:items-center gap-4">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${m.low_stock ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                          {m.low_stock ? <AlertTriangle size={18} /> : <PackageSearch size={18} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-black text-slate-900 truncate">{m.name}</p>
                            {m.sku && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                <Tag size={10} /> {m.sku}
                              </span>
                            )}
                            {m.low_stock && (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-black">
                                <AlertTriangle size={10} /> Stock bajo
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1 font-semibold">
                              <Store size={12} /> {m.tenant_name}
                            </span>
                            <span className="text-slate-300">/</span>
                            <span>{m.tenant_schema}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 xl:w-[360px]">
                        <div className={`rounded-lg border p-3 ${stock <= 0 ? 'bg-slate-50 border-slate-100' : m.low_stock ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
                          <p className={`text-[10px] font-black uppercase ${stock <= 0 ? 'text-slate-400' : m.low_stock ? 'text-rose-600' : 'text-emerald-600'}`}>Stock</p>
                          <p className={`text-base font-black ${stock <= 0 ? 'text-slate-500' : m.low_stock ? 'text-rose-700' : 'text-emerald-700'}`}>{stock.toLocaleString()}</p>
                          {minStock > 0 && <p className="text-[10px] text-slate-400">min {minStock}</p>}
                        </div>
                        <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                          <p className="text-[10px] text-slate-400 font-black uppercase">Precio</p>
                          <p className="text-base font-black text-slate-800">{m.price > 0 ? `$${Number(m.price).toFixed(2)}` : '-'}</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                          <p className="text-[10px] text-slate-400 font-black uppercase">Costo</p>
                          <p className="text-base font-black text-slate-800">{m.cost_price > 0 ? `$${Number(m.cost_price).toFixed(2)}` : '-'}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleRequestTransfer(m)}
                        disabled={stock <= 0}
                        className="xl:self-center flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-all text-sm font-bold disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                        title={stock <= 0 ? 'Sin stock disponible' : 'Solicitar traslado desde esta empresa'}
                      >
                        <ArrowLeftRight size={14} /> Solicitar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
