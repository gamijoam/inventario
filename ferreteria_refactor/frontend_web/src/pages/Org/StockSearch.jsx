/**
 * StockSearch.jsx — Buscar producto en TODAS las empresas del grupo
 * Llama a GET /organizations/my-org/stock-search?q=...
 */
import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Store, AlertTriangle, ArrowLeftRight,
  Loader2, PackageSearch, Building2, Tag
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';

const MIN_Q = 2;
const DEBOUNCE_MS = 350;

export default function StockSearch() {
  const navigate = useNavigate();
  const [q, setQ]               = useState('');
  const [data, setData]         = useState(null);  // {query, organization_name, tenants_searched, total_matches, results}
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false); // si ya disparó al menos una búsqueda
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
    // Cancelar request anterior si existe
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
    // Guardar contexto en localStorage para que la página de Traslados pre-llene el modal.
    // Fase 3 lo consumirá. Por ahora, navegar y dejar el dato listo.
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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <PackageSearch className="text-indigo-600" size={24} />
            Buscar stock en el grupo
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Encuentra un producto por SKU o nombre en todas las empresas de tu organización.
          </p>
        </div>
      </div>

      {/* Buscador */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Escribe SKU o nombre del producto… (mín. 2 caracteres)"
            autoFocus
            className="w-full pl-12 pr-4 py-3 text-base rounded-xl border border-slate-200
              focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition"
          />
          {loading && (
            <Loader2 size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-500 animate-spin" />
          )}
        </div>
        <p className="text-[11px] text-slate-400 mt-2 ml-1">
          Se busca por <span className="font-semibold">SKU</span> (prefijo) y por <span className="font-semibold">nombre</span> (contiene). Mayúsculas/minúsculas no importan.
        </p>
      </form>

      {/* Estado: aún no buscó */}
      {!searched && !loading && (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center">
          <Search size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">
            Empieza a escribir para buscar productos en tu grupo empresarial.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
          <AlertTriangle size={16} className="inline mr-2" />
          {error}
        </div>
      )}

      {/* Estado: buscó pero 0 matches */}
      {searched && !loading && !error && results.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
          <PackageSearch size={32} className="mx-auto text-amber-500 mb-2" />
          <p className="text-sm font-semibold text-amber-800">
            No se encontró nada para "{data?.query}"
          </p>
          <p className="text-xs text-amber-700 mt-1">
            Se revisaron {tenantsCount} empresas del grupo.
          </p>
        </div>
      )}

      {/* Resultados */}
      {results.length > 0 && (
        <>
          {/* Resumen */}
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-semibold">
              {totalMatches} coincidencias
            </span>
            <span className="flex items-center gap-1">
              <Building2 size={12} /> {orgName}
            </span>
            <span className="flex items-center gap-1">
              <Store size={12} /> {tenantsCount} empresas revisadas
            </span>
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-3 font-semibold">Producto</th>
                    <th className="px-4 py-3 font-semibold">SKU</th>
                    <th className="px-4 py-3 font-semibold">Empresa</th>
                    <th className="px-4 py-3 font-semibold text-right">Stock</th>
                    <th className="px-4 py-3 font-semibold text-right">Precio</th>
                    <th className="px-4 py-3 font-semibold text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.map((m, idx) => (
                    <tr
                      key={`${m.tenant_id}-${m.product_id}-${idx}`}
                      className="hover:bg-indigo-50/30 transition"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 leading-tight">{m.name}</div>
                        {m.low_stock && (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded mt-1 font-semibold">
                            <AlertTriangle size={10} /> Stock bajo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {m.sku ? (
                          <span className="inline-flex items-center gap-1 text-xs font-mono bg-slate-100 text-slate-700 px-2 py-1 rounded">
                            <Tag size={10} /> {m.sku}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Store size={14} className="text-slate-400" />
                          <div>
                            <div className="font-semibold text-slate-800">{m.tenant_name}</div>
                            <div className="text-[10px] text-slate-400">{m.tenant_schema}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold text-base ${
                          m.stock <= 0 ? 'text-slate-400'
                            : m.low_stock ? 'text-rose-600'
                            : 'text-emerald-600'
                        }`}>
                          {m.stock.toLocaleString()}
                        </span>
                        {m.min_stock > 0 && (
                          <div className="text-[10px] text-slate-400">mín {m.min_stock}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-slate-700 font-medium">
                          {m.price > 0 ? `$${m.price.toFixed(2)}` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleRequestTransfer(m)}
                          disabled={m.stock <= 0}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
                            bg-indigo-600 text-white rounded-lg hover:bg-indigo-700
                            disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed
                            transition shadow-sm"
                          title={m.stock <= 0 ? 'Sin stock disponible' : 'Solicitar traslado desde esta empresa'}
                        >
                          <ArrowLeftRight size={12} />
                          Solicitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
