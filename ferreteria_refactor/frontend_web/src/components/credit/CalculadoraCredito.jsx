/**
 * CalculadoraCredito.jsx
 * Calculadora de crédito copiada exactamente de BloqueCelular.
 *
 * Modelo: Interés plano (flat rate)
 *   interes_total = precio × tasa%
 *   total         = precio + interes_total
 *   financiado    = total - enganche
 *   cuota         = financiado / num_cuotas
 *
 * Props:
 *   precioInicial  — precio del celular (prellenado desde el POS)
 *   onUsarEnVenta  — callback({ precio, enganche, tasa, cuotas, frecuencia,
 *                               fechaPrimerCobro, cuotaMonto, financiado,
 *                               totalCliente, interes })
 *   onCerrar       — callback para cerrar el modal
 */

import { useState, useCallback } from 'react';
import { Calculator, ChevronRight, X } from 'lucide-react';

// ─── Función núcleo del cálculo — idéntica a BloqueCelular ───────────────────
function calcCuota(precio, enganche, tasaPct, n, fechaBase, freq) {
  const intTotal   = precio * (tasaPct / 100);
  const total      = precio + intTotal;
  const financiado = Math.max(0, total - enganche);
  const cuota      = n > 0 ? financiado / n : 0;
  const desglose   = [];
  const fechas     = [];
  const dias       = { semanal: 7, quincenal: 15, mensual: 30 };

  let fechaActual = fechaBase
    ? new Date(fechaBase + 'T12:00:00')
    : new Date();
  let saldo = financiado;

  for (let i = 0; i < n; i++) {
    if (i > 0) {
      if (freq === 'mensual') {
        fechaActual.setMonth(fechaActual.getMonth() + 1);
      } else {
        fechaActual.setDate(fechaActual.getDate() + (dias[freq] || 30));
      }
    }
    fechas.push(new Date(fechaActual).toISOString().split('T')[0]);
    saldo = Math.max(0, saldo - cuota);
    desglose.push({ cuota, saldo });
  }

  return { cuota, intTotal, total, financiado, desglose, fechas };
}

function fmtFecha(f) {
  if (!f) return '—';
  const d = new Date(f + 'T12:00:00');
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

const PILLS_CUOTAS = [3, 6, 9, 12, 18, 24];
const FRECUENCIAS  = [
  { id: 'semanal',   label: '📅 Semanal'   },
  { id: 'quincenal', label: '📅 Quincenal' },
  { id: 'mensual',   label: '📅 Mensual'   },
];

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CalculadoraCredito({ precioInicial = 0, onUsarEnVenta, onCerrar }) {
  const [precio,  setPrecio]  = useState(precioInicial > 0 ? precioInicial : '');
  const [enganche, setEnganche] = useState('');
  const [enganchePct, setEnganchePct] = useState('');
  const [tasa,    setTasa]    = useState(0);
  const [cuotas,  setCuotas]  = useState(6);
  const [freq,    setFreq]    = useState('mensual');
  const [fecha,   setFecha]   = useState('');

  // Sincronizar enganche $ ↔ %
  const onEngancheDinero = (val) => {
    setEnganche(val);
    const pr = parseFloat(precio) || 0;
    if (pr > 0 && val !== '') {
      setEnganchePct(((parseFloat(val) / pr) * 100).toFixed(0));
    }
  };

  const onEnganchePct = (val) => {
    setEnganchePct(val);
    const pr = parseFloat(precio) || 0;
    if (pr > 0 && val !== '') {
      setEnganche((pr * parseFloat(val) / 100).toFixed(2));
    }
  };

  // Calcular resultado
  const pr  = parseFloat(precio)   || 0;
  const eng = parseFloat(enganche) || 0;
  const result = pr > 0 ? calcCuota(pr, eng, tasa, cuotas, fecha, freq) : null;

  const freqLabels = { semanal: 'por semana', quincenal: 'quincenal', mensual: 'por mes' };

  const handleUsarEnVenta = useCallback(() => {
    if (!result) return;
    onUsarEnVenta?.({
      precio       : pr,
      enganche     : eng,
      tasa,
      cuotas,
      frecuencia   : freq,
      fechaPrimerCobro: fecha || null,
      cuotaMonto   : result.cuota,
      financiado   : result.financiado,
      totalCliente : result.total,
      interes      : result.intTotal,
    });
  }, [result, pr, eng, tasa, cuotas, freq, fecha, onUsarEnVenta]);

  return (
    <div className="flex flex-col h-full max-h-[90vh] overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Calculator size={18} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="font-black text-slate-800 text-base">Calculadora de Crédito</h2>
            <p className="text-xs text-slate-400">Modelo de interés plano — precio + interés − enganche ÷ cuotas</p>
          </div>
        </div>
        {onCerrar && (
          <button onClick={onCerrar}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={18} className="text-slate-400" />
          </button>
        )}
      </div>

      {/* Body — scroll */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">

          {/* ── IZQUIERDA: INPUTS ─────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Precio del equipo */}
            <div>
              <p className="text-[11px] font-bold tracking-widest text-slate-400 mb-2 uppercase">
                Precio del Equipo
              </p>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">$</span>
                <input
                  type="number" min="0" step="0.01"
                  value={precio}
                  onChange={e => setPrecio(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-3.5 text-2xl font-black bg-slate-50 border-2 border-slate-200 focus:border-indigo-400 rounded-xl outline-none transition-colors"
                />
              </div>
            </div>

            {/* Enganche $ y % sincronizados */}
            <div>
              <p className="text-[11px] font-bold tracking-widest text-slate-400 mb-2 uppercase">Enganche</p>
              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">$</span>
                  <input type="number" min="0" step="0.01"
                    value={enganche}
                    onChange={e => onEngancheDinero(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-3 text-base font-bold bg-slate-50 border-2 border-slate-200 focus:border-indigo-400 rounded-xl outline-none"
                  />
                </div>
                <span className="text-slate-400 text-sm text-center">o</span>
                <div className="relative">
                  <input type="number" min="0" max="100" step="1"
                    value={enganchePct}
                    onChange={e => onEnganchePct(e.target.value)}
                    placeholder="0"
                    className="w-full pl-3 pr-8 py-3 text-base font-bold bg-slate-50 border-2 border-slate-200 focus:border-emerald-400 rounded-xl outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">%</span>
                </div>
              </div>
            </div>

            {/* Interés — slider exacto de BloqueCelular */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                  Interés total sobre el precio
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-indigo-600">{tasa}%</span>
                  <span className="text-sm text-emerald-600 font-semibold">
                    = ${pr > 0 ? (pr * tasa / 100).toFixed(2) : '0.00'}
                  </span>
                </div>
              </div>
              <input type="range" min="0" max="100" step="1"
                value={tasa}
                onChange={e => setTasa(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer h-1.5"
              />
              <div className="flex justify-between text-[10px] text-slate-300 mt-1">
                {['0%','25%','50%','75%','100%'].map(l => <span key={l}>{l}</span>)}
              </div>
            </div>

            {/* Cuotas — pills exactas de BloqueCelular */}
            <div>
              <p className="text-[11px] font-bold tracking-widest text-slate-400 mb-2 uppercase">
                Número de Cuotas
              </p>
              <div className="flex gap-2">
                {PILLS_CUOTAS.map(n => (
                  <button key={n}
                    onClick={() => setCuotas(n)}
                    className={`flex-1 py-2.5 rounded-xl font-black text-sm border-2 transition-all
                      ${cuotas === n
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-100 text-slate-500 border-slate-200 hover:border-indigo-300'}`}
                  >{n}</button>
                ))}
              </div>
            </div>

            {/* Frecuencia + Fecha — igual a BloqueCelular */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-bold tracking-widest text-slate-400 mb-2 uppercase">Frecuencia</p>
                <div className="space-y-1.5">
                  {FRECUENCIAS.map(f => (
                    <button key={f.id}
                      onClick={() => setFreq(f.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm border-2 transition-all
                        ${freq === f.id
                          ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-indigo-300'}`}
                    >{f.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold tracking-widest text-slate-400 mb-2 uppercase">Primer Cobro</p>
                <input type="date"
                  value={fecha}
                  onChange={e => setFecha(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400"
                />
                <p className="text-[10px] text-slate-300 mt-1.5">Deja vacío para calcular sin fechas</p>
              </div>
            </div>
          </div>

          {/* ── DERECHA: RESULTADO — idéntico a BloqueCelular ────────── */}
          <div className="space-y-4">

            {/* Hero cuota */}
            <div className="bg-gradient-to-br from-[#1e3a5f] to-[#1a1f35] border border-[#2d4a7a] rounded-2xl p-7 text-center">
              <p className="text-[11px] font-bold tracking-widest text-[#60a5fa] mb-2 uppercase">Cuota a Cobrar</p>
              <p className="text-5xl font-black text-white leading-none tracking-tight">
                {result ? `$${result.cuota.toFixed(2)}` : '$0.00'}
              </p>
              <p className="text-sm text-[#93c5fd] mt-2">
                {result
                  ? `${cuotas} cuotas · ${freqLabels[freq]}`
                  : 'Ingresa el precio para calcular'}
              </p>
            </div>

            {/* Desglose — ecuación visual */}
            {result && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <p className="text-[11px] font-bold tracking-widest text-slate-400 mb-4 uppercase">Desglose</p>

                {/* Ecuación: precio + interés - enganche = a financiar */}
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  {[
                    { label: 'Precio',     val: `$${pr.toFixed(2)}`,               bg: 'bg-slate-100',  text: 'text-slate-700' },
                    { op: '+' },
                    { label: 'Interés',    val: `+$${result.intTotal.toFixed(2)}`,  bg: 'bg-emerald-950', text: 'text-emerald-400' },
                    { op: '−' },
                    { label: 'Enganche',   val: `-$${eng.toFixed(2)}`,              bg: 'bg-red-950',    text: 'text-red-400'     },
                    { op: '=' },
                    { label: 'A financiar',val: `$${result.financiado.toFixed(2)}`, bg: 'bg-blue-950',   text: 'text-blue-400'    },
                  ].map((item, i) =>
                    item.op
                      ? <span key={i} className="text-slate-400 font-bold text-lg">{item.op}</span>
                      : (
                        <div key={i} className="text-center flex-1 min-w-0">
                          <p className={`text-[9px] font-bold mb-1 ${item.text} uppercase`}>{item.label}</p>
                          <div className={`${item.bg} rounded-lg px-2 py-1.5 font-bold text-sm ${item.text} whitespace-nowrap`}>
                            {item.val}
                          </div>
                        </div>
                      )
                  )}
                </div>

                {/* Stats: total cliente paga / interés ganado / último pago */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { label: 'Total cliente paga', val: `$${result.total.toFixed(2)}`,    color: 'text-amber-500'  },
                    { label: 'Interés ganado',      val: `$${result.intTotal.toFixed(2)}`, color: 'text-emerald-500'},
                    { label: 'Último pago',         val: result.fechas.length ? fmtFecha(result.fechas[result.fechas.length-1]) : '—', color: 'text-slate-600' },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-50 rounded-xl p-3 text-center">
                      <p className="text-[9px] text-slate-400 uppercase font-bold mb-1">{s.label}</p>
                      <p className={`font-black text-sm ${s.color}`}>{s.val}</p>
                    </div>
                  ))}
                </div>

                {/* Botón usar en venta */}
                {onUsarEnVenta && (
                  <button onClick={handleUsarEnVenta}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors">
                    Usar en registro de venta
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>
            )}

            {/* Placeholder */}
            {!result && (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-300">
                <div className="text-4xl mb-3 opacity-40">🧮</div>
                <p className="text-sm">Ingresa el precio del equipo<br />para ver el resultado</p>
              </div>
            )}
          </div>
        </div>

        {/* ── TABLA DE PAGOS — full width, igual a BloqueCelular ──── */}
        {result && result.desglose.length > 0 && (
          <div className="mx-6 mb-6 bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">Plan de Pagos</p>
              <p className="text-xs text-slate-400">
                {cuotas} cuotas de ${result.cuota.toFixed(2)} · Total financiado ${result.financiado.toFixed(2)}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left w-10">#</th>
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-right">Cuota</th>
                    <th className="px-4 py-3 text-right">Saldo restante</th>
                    <th className="px-4 py-3 text-left w-32">Progreso</th>
                  </tr>
                </thead>
                <tbody>
                  {result.desglose.map((row, i) => {
                    const pagado = result.financiado - row.saldo;
                    const pct    = result.financiado > 0
                      ? Math.round((pagado / result.financiado) * 100) : 0;
                    return (
                      <tr key={i} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5 font-bold text-slate-400">{i + 1}</td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {result.fechas[i] ? fmtFecha(result.fechas[i]) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-800">
                          ${row.cuota.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-500">
                          ${row.saldo.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="bg-slate-100 rounded-full h-1.5 w-full">
                            <div
                              className="bg-indigo-500 rounded-full h-1.5 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-slate-300 mt-1">{pct}%</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
