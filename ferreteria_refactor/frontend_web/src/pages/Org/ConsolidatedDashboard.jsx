/**
 * ConsolidatedDashboard.jsx - Vista consolidada del grupo empresarial
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2, ShoppingCart,
  AlertTriangle, RefreshCw, ExternalLink, Trophy,
  DollarSign, Store, Wifi, Activity
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';

function KpiCard({ icon: Icon, label, value, color = 'indigo', sub }) {
  const colors = {
    indigo:  'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber:   'bg-amber-50 text-amber-600 border-amber-100',
    rose:    'bg-rose-50 text-rose-600 border-rose-100',
  };
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
        </div>
        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${colors[color]}`}>
          <Icon size={18} />
        </div>
      </div>
      {sub && <p className="text-xs text-slate-500 mt-2 truncate">{sub}</p>}
    </div>
  );
}

export default function ConsolidatedDashboard() {
  const [data, setData] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [switching, setSwitching] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const summaryRes = await apiClient.get('/organizations/consolidated-mine');
      setData(summaryRes.data);
      setCompanies(summaryRes.data?.tenants || []);
    } catch (err) {
      const message = err.response?.data?.detail || 'No se pudo cargar el dashboard empresarial';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleEnter = async (company) => {
    const schema = company.schema_name;
    if (!schema) return toast.error('Empresa sin schema');
    setSwitching(company.id || company.tenant_id);
    try {
      const r = await apiClient.post('/auth/switch-company', { target_schema: schema });
      if (r.data?.access_token) localStorage.setItem('access_token', r.data.access_token);
      if (r.data?.org_companies) {
        localStorage.setItem('org_companies', JSON.stringify(r.data.org_companies));
        localStorage.setItem('has_multiple_companies', r.data.org_companies.length > 1 ? 'true' : 'false');
      }
      const isQA = window.location.hostname.includes('.qa.');
      const url = isQA
        ? (r.data?.switch_url_qa || 'https://' + schema + '.qa.miinventariofacil.com/#/')
        : (r.data?.switch_url_prod || r.data?.switch_url || 'https://' + schema + '.miinventariofacil.com/#/');
      window.location.href = url;
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error al acceder');
    } finally {
      setSwitching(null);
    }
  };

  if (loading) return (
    <div className="space-y-4">
      <div className="h-32 animate-pulse rounded-lg border border-slate-200 bg-white shadow-sm" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-28 animate-pulse rounded-lg border border-slate-200 bg-white shadow-sm" />)}
      </div>
      <div className="h-80 animate-pulse rounded-lg border border-slate-200 bg-white shadow-sm" />
    </div>
  );

  const tenants = data?.tenants || companies;
  const totalVentas = Number(data?.total_sales_today ?? tenants.reduce((s, t) => s + (parseFloat(t.sales_today) || 0), 0));
  const totalTx = Number(data?.total_transactions ?? tenants.reduce((s, t) => s + (parseInt(t.sales_count ?? t.transactions_today, 10) || 0), 0));
  const totalLowStock = Number(data?.total_low_stock ?? tenants.reduce((s, t) => s + (parseInt(t.low_stock ?? t.low_stock_alerts, 10) || 0), 0));
  const bestTenant = [...tenants].sort((a, b) => (parseFloat(b.sales_today) || 0) - (parseFloat(a.sales_today) || 0))[0];
  const avgTicket = totalTx > 0 ? totalVentas / totalTx : 0;

  if (error && tenants.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center shadow-sm">
        <AlertTriangle size={34} className="mx-auto mb-3 text-amber-600" />
        <h2 className="text-lg font-black text-amber-950">No pudimos cargar el dashboard</h2>
        <p className="mx-auto mt-1 max-w-lg text-sm font-semibold text-amber-800">{error}</p>
        <button
          onClick={load}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-black text-amber-700 shadow-sm ring-1 ring-amber-100 hover:bg-amber-50"
        >
          <RefreshCw size={15} /> Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-100 shrink-0">
              <Building2 size={22} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wide text-indigo-500">Operacion empresarial</p>
              <h1 className="text-2xl font-black text-slate-950 truncate">{data?.organization_name || 'Dashboard consolidado'}</h1>
              <p className="text-sm text-slate-500">Ventas, actividad y alertas de todas las empresas del grupo.</p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-lg hover:bg-slate-50 text-sm font-bold transition-colors disabled:opacity-60"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard icon={Building2} label="Empresas" value={tenants.length} color="indigo" sub="Locales activos" />
        <KpiCard icon={DollarSign} label="Ventas hoy" value={`$${totalVentas.toFixed(2)}`} color="emerald" sub="Consolidado USD" />
        <KpiCard icon={ShoppingCart} label="Tickets" value={totalTx} color="amber" sub="Transacciones hoy" />
        <KpiCard icon={Activity} label="Ticket prom." value={`$${avgTicket.toFixed(2)}`} color="indigo" sub="Venta promedio" />
        <KpiCard icon={AlertTriangle} label="Bajo stock" value={totalLowStock} color="rose" sub="Productos en alerta" />
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
              <Store size={18} />
            </div>
            <div>
              <h2 className="font-black text-slate-900">Empresas del grupo</h2>
              <p className="text-xs text-slate-500">Ordenadas por ventas del dia.</p>
            </div>
          </div>
          {bestTenant && (
            <div className="inline-flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs font-black text-amber-700">
              <Trophy size={14} /> Mejor local: {bestTenant.name}
            </div>
          )}
        </div>

        <div className="divide-y divide-slate-100">
          {tenants.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-400">No hay empresas activas para mostrar.</div>
          )}
          {tenants.map((t, i) => {
            const ventas = parseFloat(t.sales_today || 0);
            const txs = parseInt(t.sales_count ?? t.transactions_today, 10) || 0;
            const lowStock = parseInt(t.low_stock ?? t.low_stock_alerts, 10) || 0;
            const isBest = bestTenant?.tenant_id === t.tenant_id || bestTenant?.id === t.id || bestTenant?.schema_name === t.schema_name;
            const share = totalVentas > 0 ? Math.min(100, (ventas / totalVentas) * 100) : 0;
            return (
              <div key={t.tenant_id || t.id || i} className="p-4 transition-colors hover:bg-slate-50">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-black shrink-0 ${isBest ? 'bg-amber-500' : 'bg-indigo-500'}`}>
                      {isBest ? <Trophy size={18} /> : t.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-slate-900 truncate">{t.name}</p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{t.schema_name}</span>
                      </div>
                      <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden max-w-lg">
                        <div className={`h-full rounded-full ${isBest ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${share}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:w-[360px]">
                    <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                      <p className="text-[10px] text-emerald-600 font-black uppercase">Ventas</p>
                      <p className="text-base font-black text-emerald-700">${ventas.toFixed(2)}</p>
                    </div>
                    <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3">
                      <p className="text-[10px] text-indigo-600 font-black uppercase">Tickets</p>
                      <p className="text-base font-black text-indigo-700">{txs}</p>
                    </div>
                    <div className={`rounded-lg border p-3 ${lowStock > 0 ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                      <p className={`text-[10px] font-black uppercase ${lowStock > 0 ? 'text-rose-600' : 'text-slate-400'}`}>Bajo stock</p>
                      <p className={`text-base font-black ${lowStock > 0 ? 'text-rose-700' : 'text-slate-500'}`}>{lowStock}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleEnter(t)}
                    disabled={switching === (t.id || t.tenant_id)}
                    className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white transition-all hover:bg-indigo-700 disabled:opacity-60 lg:self-center"
                  >
                    {switching === (t.id || t.tenant_id)
                      ? <Wifi size={14} className="animate-pulse" />
                      : <ExternalLink size={14} />}
                    Entrar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
