/**
 * FinancingStep.jsx
 * Paso simple de financiamiento externo (Cashea, Krece, etc.) en el modal de pago.
 * La cajera solo selecciona la financiadora e ingresa el inicial.
 * El monto financiado se calcula automáticamente.
 */
import React, { useState, useEffect } from 'react';
import { Building2, DollarSign, ChevronDown, CheckCircle, AlertCircle } from 'lucide-react';
import apiClient from '../../config/axios';

export default function FinancingStep({ totalUSD, onConfirm, onCancel }) {
  const [financers, setFinancers]   = useState([]);
  const [selected, setSelected]     = useState('');
  const [initial, setInitial]       = useState('');
  const [loading, setLoading]       = useState(false);

  useEffect(() => {
    // Cargar financiadoras activas (métodos de pago marcados como is_external_financer)
    apiClient.get('/payment-methods/')
      .then(r => {
        const list = (r.data || []).filter(m => m.is_external_financer && m.is_active);
        setFinancers(list);
        if (list.length === 1) setSelected(list[0].name);
      })
      .catch(() => {});
  }, []);

  const initialNum  = parseFloat(initial) || 0;
  const financed    = Math.max(0, totalUSD - initialNum);
  const isValid     = selected && initialNum >= 0 && initialNum <= totalUSD;

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm({
      financer_name:    selected,
      initial_payment:  initialNum,
      financed_amount:  financed,
      total_price:      totalUSD,
    });
  };

  return (
    <div className="space-y-5">
      {/* Info */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <AlertCircle size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <p className="font-bold mb-1">Venta con financiamiento externo</p>
          <p>El inicial entra a caja ahora. El monto financiado lo recibirás cuando la empresa pague.</p>
        </div>
      </div>

      {/* Financiadora */}
      <div>
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">
          Empresa Financiadora
        </label>
        {financers.length === 0 ? (
          <div className="text-sm text-amber-600 bg-amber-50 rounded-xl px-4 py-3">
            No hay financiadoras configuradas. Ve a Configuración → Métodos de Pago y activa
            la opción "Es financiadora externa" en Cashea, Krece u otras.
          </div>
        ) : (
          <div className="grid gap-2">
            {financers.map(f => (
              <button
                key={f.name}
                onClick={() => setSelected(f.name)}
                className={
                  'flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ' +
                  (selected === f.name
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 bg-white hover:border-slate-300')
                }
              >
                <div className={
                  'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ' +
                  (selected === f.name ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500')
                }>
                  <Building2 size={16} />
                </div>
                <span className="font-semibold text-slate-800">{f.name}</span>
                {selected === f.name && (
                  <CheckCircle size={16} className="text-indigo-500 ml-auto flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Inicial */}
      <div>
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">
          Inicial cobrado por la tienda (USD)
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
          <input
            type="number"
            min="0"
            max={totalUSD}
            step="0.01"
            value={initial}
            onChange={e => setInitial(e.target.value)}
            placeholder="0.00"
            className="w-full pl-8 pr-4 py-3 rounded-xl border-2 border-slate-200 text-lg font-bold
              focus:outline-none focus:border-indigo-500 text-right"
          />
        </div>
        {initialNum > totalUSD && (
          <p className="text-xs text-rose-500 mt-1">El inicial no puede superar el total</p>
        )}
      </div>

      {/* Resumen */}
      <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Total de la venta</span>
          <span className="font-bold text-slate-800">${totalUSD.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-emerald-600 font-semibold">✓ Inicial (entra a caja ahora)</span>
          <span className="font-bold text-emerald-600">${initialNum.toFixed(2)}</span>
        </div>
        <div className="h-px bg-slate-200" />
        <div className="flex justify-between">
          <span className="text-slate-500 text-sm">Monto financiado por {selected || '...'}</span>
          <span className="font-black text-indigo-600 text-lg">${financed.toFixed(2)}</span>
        </div>
      </div>

      {/* Botones */}
      <div className="flex gap-3">
        <button
          onClick={handleConfirm}
          disabled={!isValid || financers.length === 0}
          className="flex-1 bg-indigo-600 text-white rounded-xl py-3.5 font-bold text-sm
            hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Confirmar Venta
        </button>
        <button
          onClick={onCancel}
          className="flex-1 bg-slate-100 text-slate-600 rounded-xl py-3.5 font-bold text-sm
            hover:bg-slate-200 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
