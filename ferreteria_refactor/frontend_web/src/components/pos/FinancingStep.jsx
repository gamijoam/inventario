/**
 * FinancingStep.jsx
 * Paso de financiamiento externo (Cashea, Krece, etc.) en el modal de pago.
 * Separa el monto financiado del dinero real que entra a caja como inicial.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Building2, CheckCircle, AlertCircle, CreditCard, ReceiptText } from 'lucide-react';
import apiClient from '../../config/axios';

const normalizeCurrencyCode = (value) => {
  const raw = String(value || 'USD').trim().toUpperCase();
  if (!raw || raw === '$' || raw === 'DOLLAR' || raw === 'DOLAR' || raw === 'DÓLAR') return 'USD';
  if (['BS', 'BSS', 'VEF', 'VES', 'BOLIVAR', 'BOLÍVAR'].includes(raw)) return 'VES';
  return raw;
};

const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export default function FinancingStep({
  totalUSD,
  totalsByCurrency = {},
  paymentMethods = [],
  currencies = [],
  getAllowedPaymentMethods,
  getExchangeRate,
  defaultBsRate = 1,
  formatAmount,
  onConfirm,
  onCancel,
}) {
  const [financers, setFinancers] = useState([]);
  const [selected, setSelected] = useState('');
  const [initial, setInitial] = useState('');
  const [initialCurrency, setInitialCurrency] = useState('USD');
  const [initialMethod, setInitialMethod] = useState('');
  const [reference, setReference] = useState('');

  useEffect(() => {
    apiClient.get('/payment-methods/')
      .then(r => {
        const list = (r.data || []).filter(m => m.is_external_financer && m.is_active);
        setFinancers(list);
        if (list.length === 1) setSelected(list[0].name);
      })
      .catch(() => {});
  }, []);

  const currencyOptions = useMemo(() => {
    const source = currencies.length ? currencies : [{ symbol: 'USD' }];
    return source.filter((curr, index, self) => index === self.findIndex(c => c.symbol === curr.symbol));
  }, [currencies]);

  const selectedFinancer = financers.find(f => f.name === selected);
  const methodOptions = useMemo(() => {
    const list = getAllowedPaymentMethods
      ? getAllowedPaymentMethods(initialCurrency)
      : paymentMethods.filter(m => m?.is_active);
    return list.filter(m => !m?.is_external_financer);
  }, [getAllowedPaymentMethods, initialCurrency, paymentMethods]);

  useEffect(() => {
    const currentStillValid = methodOptions.some(m => m.name === initialMethod);
    if (!currentStillValid) setInitialMethod(methodOptions[0]?.name || '');
  }, [initialCurrency, methodOptions, initialMethod]);

  const selectedMethod = methodOptions.find(m => m.name === initialMethod);
  const needsReference = Boolean(selectedMethod?.requires_reference);

  const currencyRate = (() => {
    const normalized = normalizeCurrencyCode(initialCurrency);
    if (normalized === 'USD') return 1;
    if (normalized === 'VES') return defaultBsRate || 1;
    const weightedTotal = totalsByCurrency?.[initialCurrency] || totalsByCurrency?.[normalized];
    if (weightedTotal && totalUSD) return Number(weightedTotal) / Number(totalUSD);
    return Number(getExchangeRate?.(initialCurrency) || getExchangeRate?.(normalized) || 1);
  })();

  const initialNum = parseFloat(initial) || 0;
  const initialUSD = round2(initialNum / (currencyRate || 1));
  const financed = round2(Math.max(0, totalUSD - initialUSD));
  const isValid = selected
    && initialNum >= 0
    && initialUSD <= totalUSD + 0.005
    && (initialNum === 0 || Boolean(initialMethod))
    && (!needsReference || Boolean(reference.trim()));
  const money = (value) => formatAmount ? formatAmount(value) : Number(value || 0).toFixed(2);

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm({
      financer_name: selected,
      financer_payment_method_id: selectedFinancer?.id || null,
      initial_payment: initialUSD,
      initial_payment_amount: initialNum,
      initial_currency: normalizeCurrencyCode(initialCurrency),
      initial_currency_label: initialCurrency,
      initial_payment_method: initialMethod,
      initial_payment_reference: reference.trim() || null,
      initial_exchange_rate: currencyRate || 1,
      financed_amount: financed,
      total_price: totalUSD,
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <AlertCircle size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <p className="font-bold mb-1">Venta con financiamiento externo</p>
          <p>Registra aqui solo el inicial que entra realmente a caja. El saldo queda pendiente por la financiadora.</p>
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">
          Empresa financiadora
        </label>
        {financers.length === 0 ? (
          <div className="text-sm text-amber-600 bg-amber-50 rounded-xl px-4 py-3">
            No hay financiadoras configuradas. Ve a Configuracion - Metodos de Pago y activa
            la opcion "Es financiadora externa" en Cashea, Krece u otras.
          </div>
        ) : (
          <div className="grid gap-2">
            {financers.map(f => (
              <button
                key={f.name}
                type="button"
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

      <div>
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">
          Inicial cobrado por la tienda
        </label>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
              {normalizeCurrencyCode(initialCurrency) === 'USD' ? '$' : initialCurrency}
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={initial}
              onChange={e => setInitial(e.target.value)}
              placeholder="0.00"
              className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-slate-200 text-lg font-bold focus:outline-none focus:border-indigo-500 text-right"
            />
          </div>
          <div className="flex rounded-xl border-2 border-slate-200 overflow-hidden bg-white">
            {currencyOptions.map(c => (
              <button
                key={c.symbol}
                type="button"
                onClick={() => setInitialCurrency(c.symbol)}
                className={
                  'px-3 text-xs font-black transition-colors ' +
                  (initialCurrency === c.symbol ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50')
                }
              >
                {c.symbol}
              </button>
            ))}
          </div>
        </div>
        {initialUSD > totalUSD + 0.005 && (
          <p className="text-xs text-rose-500 mt-1">El inicial no puede superar el total de la venta</p>
        )}
      </div>

      {initialNum > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <CreditCard size={13} /> Metodo real del inicial
            </label>
            <select
              value={initialMethod}
              onChange={e => setInitialMethod(e.target.value)}
              className="w-full px-3 py-3 rounded-xl border-2 border-slate-200 text-sm font-bold text-slate-700 bg-white focus:outline-none focus:border-indigo-500"
            >
              {methodOptions.length === 0 ? (
                <option value="">Sin metodos para esta moneda</option>
              ) : methodOptions.map(method => (
                <option key={method.id || method.name} value={method.name}>{method.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <ReceiptText size={13} /> Referencia {needsReference && <span className="text-rose-500">*</span>}
            </label>
            <input
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder={needsReference ? 'Obligatoria' : 'Opcional'}
              className="w-full px-3 py-3 rounded-xl border-2 border-slate-200 text-sm font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      )}

      <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Total de la venta</span>
          <span className="font-bold text-slate-800">${money(totalUSD)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-emerald-600 font-semibold">Inicial equivalente en caja</span>
          <span className="font-bold text-emerald-600">${money(initialUSD)}</span>
        </div>
        {initialNum > 0 && normalizeCurrencyCode(initialCurrency) !== 'USD' && (
          <div className="flex justify-between text-xs text-slate-500">
            <span>Cobrado</span>
            <span className="font-bold">{initialCurrency} {money(initialNum)} - tasa {money(currencyRate)}</span>
          </div>
        )}
        <div className="h-px bg-slate-200" />
        <div className="flex justify-between">
          <span className="text-slate-500 text-sm">Monto financiado por {selected || '...'}</span>
          <span className="font-black text-indigo-600 text-lg">${money(financed)}</span>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!isValid || financers.length === 0}
          className="flex-1 bg-indigo-600 text-white rounded-xl py-3.5 font-bold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Confirmar venta
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-slate-100 text-slate-600 rounded-xl py-3.5 font-bold text-sm hover:bg-slate-200 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
