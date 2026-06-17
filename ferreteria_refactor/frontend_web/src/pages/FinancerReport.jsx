/**
 * FinancerReport.jsx — Panel de Cuentas por Cobrar a Financiadoras
 * Muestra cuánto debe cada financiadora (Cashea, Krece, etc.) y permite marcar como pagado.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2, DollarSign, CheckCircle, Clock, ChevronDown,
  ChevronRight, RefreshCw, AlertCircle, TrendingUp
} from 'lucide-react';
import apiClient from '../config/axios';
import { toast } from 'react-hot-toast';

const STATUS = {
  PENDING:   { label: 'Pendiente',  color: 'amber',   icon: Clock },
  PARTIAL:   { label: 'Parcial',    color: 'blue',    icon: AlertCircle },
  COMPLETED: { label: 'Pagado',     color: 'emerald', icon: CheckCircle },
};

const COLORS = {
  amber:   'bg-amber-50 text-amber-700 border-amber-200',
  blue:    'bg-blue-50 text-blue-700 border-blue-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function MarkPaidModal({ record, onClose, onSaved }) {
  const [amount, setAmount] = useState(record.financed_amount.toFixed(2));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.post('/external-financing/' + record.id + '/mark-paid', {
        amount: parseFloat(amount)
      });
      toast.success('Pago registrado correctamente');
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error al registrar el pago');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <h2 className="text-xl font-black text-slate-900">Registrar Pago de Financiadora</h2>

        <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Financiadora</span>
            <span className="font-bold">{record.financer_name || record.financer}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Venta #{record.sale_id}</span>
            <span className="font-bold">{record.customer_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Monto financiado</span>
            <span className="font-bold text-indigo-600">${record.financed_amount.toFixed(2)}</span>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">
            Monto recibido de la financiadora (USD)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
            <input
              type="number" min="0" step="0.01" max={record.financed_amount}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full pl-8 pr-4 py-3 rounded-xl border-2 border-slate-200 text-lg font-bold
                focus:outline-none focus:border-indigo-500 text-right"
            />
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={() => setAmount(record.financed_amount.toFixed(2))}
              className="text-xs text-indigo-600 font-bold hover:underline">
              Pago total
            </button>
            <span className="text-slate-300">·</span>
            <button onClick={() => setAmount((record.financed_amount / 2).toFixed(2))}
              className="text-xs text-slate-500 font-bold hover:underline">
              50%
            </button>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-emerald-600 text-white rounded-xl py-3 font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50">
            {saving ? 'Guardando...' : 'Confirmar Pago'}
          </button>
          <button onClick={onClose}
            className="flex-1 bg-slate-100 text-slate-600 rounded-xl py-3 font-bold hover:bg-slate-200 transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FinancerReport() {
  const [financers, setFinancers]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [expanded, setExpanded]     = useState({});
  const [markingRecord, setMarkingRecord] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiClient.get('/external-financing/by-financer');
      setFinancers(r.data || []);
    } catch { toast.error('Error cargando datos'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalPending  = financers.reduce((s, f) => s + (f.total_pending || 0), 0);
  const totalReceived = financers.reduce((s, f) => s + (f.total_received || 0), 0);
  const totalFinanced = financers.reduce((s, f) => s + (f.total_financed || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Cuentas por Cobrar — Financiadoras</h1>
            <p className="text-slate-500 text-sm mt-1">
              Control de lo que Cashea, Krece y otras empresas deben pagar a tu tienda
            </p>
          </div>
          <button onClick={load}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600
              px-4 py-2 rounded-xl hover:bg-slate-50 text-sm font-bold transition-colors">
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>

        {/* KPIs globales */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
                <Clock size={18} className="text-amber-500" />
              </div>
              <p className="text-sm text-slate-500 font-medium">Pendiente por cobrar</p>
            </div>
            <p className="text-2xl font-black text-amber-600">${totalPending.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
                <CheckCircle size={18} className="text-emerald-500" />
              </div>
              <p className="text-sm text-slate-500 font-medium">Ya cobrado</p>
            </div>
            <p className="text-2xl font-black text-emerald-600">${totalReceived.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
                <TrendingUp size={18} className="text-indigo-500" />
              </div>
              <p className="text-sm text-slate-500 font-medium">Total financiado</p>
            </div>
            <p className="text-2xl font-black text-indigo-600">${totalFinanced.toFixed(2)}</p>
          </div>
        </div>

        {/* Lista por financiadora */}
        {loading ? (
          <div className="flex justify-center py-16">
            <RefreshCw size={28} className="text-indigo-500 animate-spin" />
          </div>
        ) : financers.length === 0 ? (
          <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-100">
            <Building2 size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-semibold">Sin ventas financiadas aún</p>
            <p className="text-sm">Las ventas con Cashea, Krece u otras financiadoras aparecerán aquí</p>
          </div>
        ) : (
          <div className="space-y-4">
            {financers.map(f => (
              <div key={f.financer_name} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

                {/* Cabecera de la financiadora */}
                <button
                  onClick={() => setExpanded(p => ({ ...p, [f.financer_name]: !p[f.financer_name] }))}
                  className="w-full flex items-center gap-4 p-5 hover:bg-slate-50 transition-colors"
                >
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Building2 size={20} className="text-indigo-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-black text-slate-900 text-lg">{f.financer_name}</p>
                    <p className="text-xs text-slate-400">{f.total_sales} venta{f.total_sales !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-right mr-4">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Financiado</p>
                      <p className="font-black text-slate-700">${f.total_financed.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-emerald-500 font-bold uppercase">Cobrado</p>
                      <p className="font-black text-emerald-600">${f.total_received.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-amber-500 font-bold uppercase">Pendiente</p>
                      <p className="font-black text-amber-600">${f.total_pending.toFixed(2)}</p>
                    </div>
                  </div>
                  {expanded[f.financer_name]
                    ? <ChevronDown size={18} className="text-slate-400 flex-shrink-0" />
                    : <ChevronRight size={18} className="text-slate-400 flex-shrink-0" />
                  }
                </button>

                {/* Detalle de ventas */}
                {expanded[f.financer_name] && (
                  <div className="border-t border-slate-100">
                    {(f.records || []).map(r => {
                      const s = STATUS[r.financer_payment_status] || STATUS.PENDING;
                      const SIcon = s.icon;
                      const pending = r.financed_amount - r.financer_paid_amount;
                      return (
                        <div key={r.id}
                          className="flex items-center gap-4 px-5 py-4 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-800">{r.customer_name}</span>
                              <span className="text-xs text-slate-400">· Venta #{r.sale_id}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                              <span>{r.sale_date ? new Date(r.sale_date).toLocaleDateString('es-VE') : '—'}</span>
                              <span>·</span>
                              <span>Inicial: <strong className="text-emerald-600">${r.initial_payment.toFixed(2)}</strong></span>
                              <span>·</span>
                              <span>Financiado: <strong className="text-indigo-600">${r.financed_amount.toFixed(2)}</strong></span>
                            </div>
                          </div>
                          <div className="text-right mr-3">
                            {pending > 0 && (
                              <p className="text-sm font-black text-amber-600">
                                ${pending.toFixed(2)} pendiente
                              </p>
                            )}
                          </div>
                          <span className={'flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border flex-shrink-0 ' + COLORS[s.color]}>
                            <SIcon size={11} /> {s.label}
                          </span>
                          {r.financer_payment_status !== 'COMPLETED' && (
                            <button
                              onClick={() => setMarkingRecord({ ...r, financer_name: f.financer_name })}
                              className="flex-shrink-0 flex items-center gap-1.5 bg-emerald-600 text-white
                                px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors"
                            >
                              <CheckCircle size={12} /> Marcar Pagado
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal marcar pagado */}
      {markingRecord && (
        <MarkPaidModal
          record={markingRecord}
          onClose={() => setMarkingRecord(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
