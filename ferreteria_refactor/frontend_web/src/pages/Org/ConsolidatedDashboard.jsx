/**
 * ConsolidatedDashboard.jsx — Vista consolidada del grupo empresarial
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2, TrendingUp, ShoppingCart, Package,
  AlertTriangle, RefreshCw, ExternalLink, Trophy,
  DollarSign, BarChart3, Store, ArrowUpRight, Wifi
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';

function KpiCard({ icon: Icon, label, value, color = 'indigo', sub }) {
  const colors = {
    indigo:  'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber:   'bg-amber-50 text-amber-600',
    rose:    'bg-rose-50 text-rose-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon size={20} />
        </div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </div>
      <p className="text-2xl font-black text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function ConsolidatedDashboard() {
  const [data, setData] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [orgRes, summaryRes] = await Promise.all([
        apiClient.get('/organizations/my-org'),
        apiClient.get('/organizations/consolidated-mine'),
      ]);
      setData(summaryRes.data);
      if (orgRes.data?.[0]) {
        const r = await apiClient.get(`/organizations/${orgRes.data[0].id}/tenants`);
        setCompanies(r.data || []);
      }
    } catch { toast.error('Error cargando datos'); }
    finally { setLoading(false); }
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
    } finally { setSwitching(null); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <RefreshCw size={28} className="text-indigo-500 animate-spin" />
    </div>
  );

  const tenants = data?.tenants || companies;
  const totalVentas = tenants.reduce((s, t) => s + (parseFloat(t.sales_today) || 0), 0);
  const totalTx = tenants.reduce((s, t) => s + (parseInt(t.transactions_today) || 0), 0);
  const bestTenant = [...tenants].sort((a, b) => (parseFloat(b.sales_today) || 0) - (parseFloat(a.sales_today) || 0))[0];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Dashboard Consolidado</h1>
          <p className="text-slate-500 text-sm mt-1">Resumen de todas tus empresas en tiempo real</p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl hover:bg-slate-50 text-sm font-bold transition-colors">
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {/* KPIs globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Building2} label="Empresas activas" value={tenants.length} color="indigo" />
        <KpiCard icon={DollarSign} label="Ventas hoy (USD)" value={`$${totalVentas.toFixed(2)}`} color="emerald" sub="Suma de todos los locales" />
        <KpiCard icon={ShoppingCart} label="Transacciones hoy" value={totalTx} color="amber" />
        <KpiCard icon={Trophy} label="Mejor local" value={bestTenant?.name?.split(' ')[0] || '—'} color="rose" sub={bestTenant ? `$${parseFloat(bestTenant.sales_today || 0).toFixed(2)}` : ''} />
      </div>

      {/* Empresas */}
      <div>
        <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
          <Store size={18} className="text-indigo-500" /> Mis Empresas
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(tenants.length > 0 ? tenants : companies).map((t, i) => {
            const ventas = parseFloat(t.sales_today || 0);
            const txs = parseInt(t.transactions_today || 0);
            const isBest = bestTenant?.id === t.id || bestTenant?.schema_name === t.schema_name;
            return (
              <div key={t.id || i}
                className={`bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all
                  ${isBest ? 'border-amber-300 bg-amber-50/30' : 'border-slate-100'}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black
                      ${isBest ? 'bg-amber-500' : 'bg-indigo-500'}`}>
                      {isBest ? <Trophy size={18} /> : t.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm leading-tight">{t.name}</p>
                      <p className="text-[11px] text-slate-400">{t.schema_name}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleEnter(t)}
                    disabled={switching === t.id}
                    className="p-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all"
                  >
                    {switching === t.id
                      ? <Wifi size={14} className="animate-pulse" />
                      : <ExternalLink size={14} />}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-50 rounded-xl p-3">
                    <p className="text-[10px] text-emerald-600 font-bold mb-1">VENTAS HOY</p>
                    <p className="text-lg font-black text-emerald-700">${ventas.toFixed(2)}</p>
                  </div>
                  <div className="bg-indigo-50 rounded-xl p-3">
                    <p className="text-[10px] text-indigo-600 font-bold mb-1">TRANSACCIONES</p>
                    <p className="text-lg font-black text-indigo-700">{txs}</p>
                  </div>
                </div>

                {t.low_stock_alerts > 0 && (
                  <div className="mt-3 flex items-center gap-2 bg-amber-50 rounded-xl px-3 py-2">
                    <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />
                    <p className="text-xs text-amber-700 font-semibold">
                      {t.low_stock_alerts} producto{t.low_stock_alerts !== 1 ? 's' : ''} con bajo stock
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
