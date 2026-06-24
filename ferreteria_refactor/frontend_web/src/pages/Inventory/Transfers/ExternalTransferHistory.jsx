import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Boxes, Eye, FileJson, History, Loader2, Package, RefreshCw, Search, X } from 'lucide-react';
import apiClient from '../../../config/axios';
import { toast } from 'react-hot-toast';

const formatQty = (value) => {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
};

const formatDate = (value) => {
  if (!value) return 'Sin fecha';
  try {
    return new Date(value).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(value);
  }
};

const ExternalTransferHistory = () => {
  const [direction, setDirection] = useState('all');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get('/transfers/external/history', { params: { direction, limit: 250 } });
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || 'No se pudo cargar el historial externo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [direction]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(row => {
      const haystack = [
        row.package_id,
        row.dispatch_guide_number,
        row.company,
        row.warehouse_name,
        row.description,
        ...(row.items || []).flatMap(item => [item.product_name, item.sku]),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [rows, search]);

  const totals = useMemo(() => rows.reduce((acc, row) => {
    acc.packages += 1;
    acc.models += Number(row.models_count || 0);
    acc.units += Number(row.units_count || 0);
    if (row.direction === 'out') acc.out += Number(row.units_count || 0);
    if (row.direction === 'in') acc.in += Number(row.units_count || 0);
    return acc;
  }, { packages: 0, models: 0, units: 0, out: 0, in: 0 }), [rows]);

  return (
    <div className="space-y-4">
      <div className="grid gap-2 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">Movimientos</p>
          <p className="mt-1 text-2xl font-black text-slate-900">{totals.packages}</p>
        </div>
        <div className="rounded-lg border border-rose-100 bg-rose-50 p-3 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-rose-500">Salidas externas</p>
          <p className="mt-1 text-2xl font-black text-rose-700">{formatQty(totals.out)}</p>
        </div>
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-600">Entradas externas</p>
          <p className="mt-1 text-2xl font-black text-emerald-700">{formatQty(totals.in)}</p>
        </div>
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-indigo-500">Modelos</p>
          <p className="mt-1 text-2xl font-black text-indigo-700">{totals.models}</p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
              <History size={18} />
            </span>
            <div>
              <h2 className="font-black text-slate-900">Historial externo</h2>
              <p className="text-xs font-semibold text-slate-500">Salidas exportadas y entradas importadas desde otras empresas.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar paquete, guia, empresa o producto..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-300 sm:w-80"
              />
            </div>
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              {[
                { key: 'all', label: 'Todo' },
                { key: 'out', label: 'Salidas' },
                { key: 'in', label: 'Entradas' },
              ].map(option => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setDirection(option.key)}
                  className={`rounded-md px-2.5 py-2 text-xs font-black transition-colors ${direction === option.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-white'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button onClick={fetchHistory} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              Actualizar
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Tipo</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Fecha</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Paquete / guia</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Empresa</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Almacen</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Contenido</th>
                <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan="7" className="py-14 text-center text-slate-400">
                    <Loader2 size={28} className="mx-auto mb-2 animate-spin" />
                    Cargando historial externo...
                  </td>
                </tr>
              )}
              {!loading && filteredRows.map(row => {
                const isOut = row.direction === 'out';
                return (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-black ${isOut ? 'border-rose-100 bg-rose-50 text-rose-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
                        {isOut ? <ArrowUpRight size={13} /> : <ArrowDownLeft size={13} />}
                        {isOut ? 'Salida externa' : 'Entrada externa'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-700">{formatDate(row.date)}</td>
                    <td className="px-5 py-4">
                      <div className="font-mono text-xs font-black text-slate-700">{row.package_id || 'Sin paquete'}</div>
                      {row.dispatch_guide_number && <div className="mt-1 text-xs font-bold text-indigo-600">{row.dispatch_guide_number}</div>}
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-slate-700">{row.company || (isOut ? 'Destino externo' : 'Origen externo')}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-500">{row.warehouse_name || 'Sin almacen'}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2 text-xs font-black">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">{row.models_count} modelo{row.models_count !== 1 ? 's' : ''}</span>
                        <span className="rounded-md bg-indigo-50 px-2 py-1 text-indigo-700">{formatQty(row.units_count)} unidad{Number(row.units_count) !== 1 ? 'es' : ''}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button onClick={() => setSelected(row)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-black text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
                        <Eye size={15} /> Ver
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan="7" className="py-16 text-center text-slate-400">
                    <FileJson size={44} className="mx-auto mb-2 opacity-25" />
                    <p className="font-bold">Sin traslados externos</p>
                    <p className="mt-1 text-sm">Cuando exportes o importes paquetes apareceran aqui.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-[95] bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="mx-auto flex max-h-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Detalle externo</p>
                <h3 className="text-base font-black text-slate-900">{selected.direction === 'out' ? 'Salida externa' : 'Entrada externa'}</h3>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Cerrar detalle">
                <X size={20} />
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto p-5">
              <div className="grid gap-2 md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">Paquete</p>
                  <p className="mt-1 break-all font-mono text-sm font-black text-slate-800">{selected.package_id || 'No registrado'}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">Empresa</p>
                  <p className="mt-1 font-black text-slate-800">{selected.company || 'No especificada'}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">Fecha</p>
                  <p className="mt-1 font-black text-slate-800">{formatDate(selected.date)}</p>
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-400">Producto</th>
                      <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-400">SKU</th>
                      <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wide text-slate-400">Cantidad</th>
                      <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wide text-slate-400">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selected.items || []).map(item => (
                      <tr key={item.movement_id}>
                        <td className="px-4 py-3 font-black text-slate-800">{item.product_name}</td>
                        <td className="px-4 py-3 font-mono text-sm font-bold text-slate-500">{item.sku || '-'}</td>
                        <td className="px-4 py-3 text-right text-sm font-black text-slate-900">{formatQty(item.quantity)}</td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-slate-500">{formatQty(item.balance_after)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4">
              <button onClick={() => setSelected(null)} className="rounded-lg px-4 py-2 text-sm font-black text-slate-600 hover:bg-white">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExternalTransferHistory;
