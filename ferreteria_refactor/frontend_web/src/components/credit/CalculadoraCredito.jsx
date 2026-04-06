/**
 * CalculadoraCredito.jsx — Rediseño responsive (tablet + PC)
 *
 * Layout:
 *  - Tablet/mobile: columna única, compacta, tabla colapsable
 *  - PC (lg+): dos columnas lado a lado, tabla visible
 *
 * El modal padre (CreditoCelularModal) ya maneja el scroll y el z-index.
 */

import { useState, useCallback } from 'react';
import { Calculator, ChevronRight, ChevronDown, X } from 'lucide-react';

// ─── Cálculo ──────────────────────────────────────────────────────────────────
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
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' });
}

const PILLS_CUOTAS = [3, 6, 9, 12, 18, 24];
const FRECUENCIAS  = [
  { id: 'semanal',   label: 'Semanal'   },
  { id: 'quincenal', label: 'Quincenal' },
  { id: 'mensual',   label: 'Mensual'   },
];

// ─── Componente ───────────────────────────────────────────────────────────────
export default function CalculadoraCredito({ precioInicial = 0, onUsarEnVenta, onCerrar }) {
  const [precio,      setPrecio]      = useState(precioInicial > 0 ? precioInicial : '');
  const [enganche,    setEnganche]    = useState('');
  const [enganchePct, setEnganchePct] = useState('');
  const [tasa,        setTasa]        = useState(0);
  const [cuotas,      setCuotas]      = useState(6);
  const [freq,        setFreq]        = useState('mensual');
  const [fecha,       setFecha]       = useState('');
  const [tablaOpen,   setTablaOpen]   = useState(false); // colapsable en tablet

  const onEngancheDinero = (val) => {
    setEnganche(val);
    const pr = parseFloat(precio) || 0;
    if (pr > 0 && val !== '') setEnganchePct(((parseFloat(val) / pr) * 100).toFixed(0));
  };
  const onEnganchePctChange = (val) => {
    setEnganchePct(val);
    const pr = parseFloat(precio) || 0;
    if (pr > 0 && val !== '') setEnganche((pr * parseFloat(val) / 100).toFixed(2));
  };

  const pr     = parseFloat(precio)   || 0;
  const eng    = parseFloat(enganche) || 0;
  const result = pr > 0 ? calcCuota(pr, eng, tasa, cuotas, fecha, freq) : null;

  const freqLabel = { semanal: 'sem.', quincenal: 'quin.', mensual: 'mes' };

  const handleUsarEnVenta = useCallback(() => {
    if (!result) return;
    onUsarEnVenta?.({
      precio        : pr,               // número, no el string del input
      enganche      : eng,
      tasa          : tasa,
      cuotas        : cuotas,
      frecuencia    : freq,
      fechaPrimerCobro: fecha || null,
      cuotaMonto    : result.cuota,
      financiado    : result.financiado,
      totalCliente  : result.total,
      interes       : result.intTotal,
    });
  }, [result, pr, eng, tasa, cuotas, freq, fecha, onUsarEnVenta]);

  return (
    /* Wrapper — el modal padre ya tiene su propio fixed + overflow */
    <div className="flex flex-col h-full">

      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
            <Calculator size={16} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="font-black text-slate-800 text-sm leading-tight">Calculadora de Crédito</h2>
            <p className="text-[10px] text-slate-400 hidden sm:block">Interés plano: precio + interés − enganche ÷ cuotas</p>
          </div>
        </div>
        {onCerrar && (
          <button onClick={onCerrar} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
            <X size={16} className="text-slate-400" />
          </button>
        )}
      </div>

      {/* ── BODY SCROLL ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">

        {/* Grid principal: 1 col en tablet, 2 col en PC */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">

          {/* ══ COLUMNA IZQUIERDA: INPUTS ══════════════════════════════ */}
          <div className="p-4 space-y-3">

            {/* Precio */}
            <div>
              <label className="text-[10px] font-bold tracking-widest text-slate-400 uppercase block mb-1.5">
                Precio del Equipo
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                <input type="number" min="0" step="0.01" value={precio}
                  onChange={e => setPrecio(e.target.value)} placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2.5 text-xl font-black bg-slate-50 border-2 border-slate-200 focus:border-indigo-400 rounded-xl outline-none transition-colors"
                />
              </div>
            </div>

            {/* Enganche — $ y % en una sola fila */}
            <div>
              <label className="text-[10px] font-bold tracking-widest text-slate-400 uppercase block mb-1.5">
                Enganche
              </label>
              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input type="number" min="0" step="0.01" value={enganche}
                    onChange={e => onEngancheDinero(e.target.value)} placeholder="0.00"
                    className="w-full pl-6 pr-2 py-2 text-sm font-bold bg-slate-50 border-2 border-slate-200 focus:border-indigo-400 rounded-xl outline-none"
                  />
                </div>
                <span className="text-slate-300 text-xs">ó</span>
                <div className="relative">
                  <input type="number" min="0" max="100" step="1" value={enganchePct}
                    onChange={e => onEnganchePctChange(e.target.value)} placeholder="0"
                    className="w-full pl-2 pr-6 py-2 text-sm font-bold bg-slate-50 border-2 border-slate-200 focus:border-emerald-400 rounded-xl outline-none"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                </div>
              </div>
            </div>

            {/* Tasa — slider */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Interés</label>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-black text-indigo-600">{tasa}%</span>
                  {pr > 0 && <span className="text-xs text-emerald-600 font-semibold">= ${(pr * tasa / 100).toFixed(2)}</span>}
                </div>
              </div>
              <input type="range" min="0" max="100" step="1" value={tasa}
                onChange={e => setTasa(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer h-1.5"
              />
              <div className="flex justify-between text-[9px] text-slate-300 mt-0.5">
                {['0%','25%','50%','75%','100%'].map(l => <span key={l}>{l}</span>)}
              </div>
            </div>

            {/* Cuotas — pills */}
            <div>
              <label className="text-[10px] font-bold tracking-widest text-slate-400 uppercase block mb-1.5">Cuotas</label>
              <div className="flex gap-1.5">
                {PILLS_CUOTAS.map(n => (
                  <button key={n} onClick={() => setCuotas(n)}
                    className={`flex-1 py-2 rounded-lg font-black text-sm border-2 transition-all
                      ${cuotas === n
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-indigo-300'}`}
                  >{n}</button>
                ))}
              </div>
            </div>

            {/* Frecuencia + Fecha — fila horizontal */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold tracking-widest text-slate-400 uppercase block mb-1.5">Frecuencia</label>
                <div className="flex flex-col gap-1">
                  {FRECUENCIAS.map(f => (
                    <button key={f.id} onClick={() => setFreq(f.id)}
                      className={`text-left px-3 py-1.5 rounded-lg text-xs border-2 transition-all font-semibold
                        ${freq === f.id
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-indigo-300'}`}
                    >{f.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold tracking-widest text-slate-400 uppercase block mb-1.5">Primer Cobro</label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-400"
                />
                <p className="text-[9px] text-slate-300 mt-1">Vacío = sin fechas</p>
              </div>
            </div>
          </div>

          {/* ══ COLUMNA DERECHA: RESULTADO ═════════════════════════════ */}
          <div className="p-4 flex flex-col gap-3">

            {/* Hero cuota */}
            <div className="bg-gradient-to-br from-[#1e3a5f] to-[#1a1f35] rounded-2xl p-5 text-center">
              <p className="text-[10px] font-bold tracking-widest text-[#60a5fa] mb-1 uppercase">Cuota a Cobrar</p>
              <p className="text-4xl font-black text-white leading-none">
                {result ? `$${result.cuota.toFixed(2)}` : '$0.00'}
              </p>
              <p className="text-xs text-[#93c5fd] mt-1">
                {result ? `${cuotas} cuotas / ${freqLabel[freq]}` : 'Ingresa el precio'}
              </p>
            </div>

            {/* Stats en fila — compactos */}
            {result && (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Total cliente', val: `$${result.total.toFixed(2)}`,     color: 'text-amber-600'  },
                  { label: 'Interés',        val: `$${result.intTotal.toFixed(2)}`,  color: 'text-emerald-600'},
                  { label: 'Último pago',    val: result.fechas.length ? fmtFecha(result.fechas.at(-1)) : '—', color: 'text-slate-700' },
                ].map(s => (
                  <div key={s.label} className="bg-slate-50 rounded-xl p-2.5 text-center">
                    <p className="text-[9px] text-slate-400 uppercase font-bold leading-tight mb-0.5">{s.label}</p>
                    <p className={`font-black text-xs ${s.color}`}>{s.val}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Ecuación compacta */}
            {result && (
              <div className="bg-slate-900 rounded-xl px-3 py-2.5 flex items-center gap-1.5 flex-wrap text-xs font-mono">
                <span className="text-slate-400">${pr.toFixed(0)}</span>
                <span className="text-slate-600">+</span>
                <span className="text-emerald-400">${result.intTotal.toFixed(0)}</span>
                <span className="text-slate-600">−</span>
                <span className="text-red-400">${eng.toFixed(0)}</span>
                <span className="text-slate-600">=</span>
                <span className="text-blue-400 font-bold">${result.financiado.toFixed(0)} ÷ {cuotas}</span>
                <span className="text-slate-600">=</span>
                <span className="text-white font-black">${result.cuota.toFixed(2)}</span>
              </div>
            )}

            {/* Tabla de pagos — colapsable en tablet, visible en PC */}
            {result && result.desglose.length > 0 && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {/* Trigger colapsable (solo visible cuando el espacio es limitado) */}
                <button
                  onClick={() => setTablaOpen(o => !o)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 text-left lg:pointer-events-none"
                >
                  <div>
                    <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Plan de Pagos</p>
                    <p className="text-[10px] text-slate-400">
                      {cuotas} cuotas de ${result.cuota.toFixed(2)} · Financiado ${result.financiado.toFixed(2)}
                    </p>
                  </div>
                  <ChevronDown
                    size={14}
                    className={`text-slate-400 transition-transform lg:hidden ${tablaOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* Tabla — siempre visible en PC, colapsable en tablet */}
                <div className={`${tablaOpen ? 'block' : 'hidden'} lg:block overflow-x-auto max-h-48 overflow-y-auto`}>
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-white">
                      <tr className="text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">Fecha</th>
                        <th className="px-3 py-2 text-right">Cuota</th>
                        <th className="px-3 py-2 text-right">Saldo</th>
                        <th className="px-3 py-2 w-20">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.desglose.map((row, i) => {
                        const pagado = result.financiado - row.saldo;
                        const pct    = result.financiado > 0 ? Math.round((pagado / result.financiado) * 100) : 0;
                        return (
                          <tr key={i} className="border-t border-slate-50 hover:bg-slate-50">
                            <td className="px-3 py-1.5 font-bold text-slate-400">{i + 1}</td>
                            <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">
                              {result.fechas[i] ? fmtFecha(result.fechas[i]) : '—'}
                            </td>
                            <td className="px-3 py-1.5 text-right font-bold text-slate-800">${row.cuota.toFixed(2)}</td>
                            <td className="px-3 py-1.5 text-right text-slate-400">${row.saldo.toFixed(2)}</td>
                            <td className="px-3 py-1.5">
                              <div className="bg-slate-100 rounded-full h-1 w-full mb-0.5">
                                <div className="bg-indigo-500 rounded-full h-1" style={{ width: `${pct}%` }} />
                              </div>
                              <p className="text-[9px] text-slate-300 text-center">{pct}%</p>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Placeholder */}
            {!result && (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300 py-6">
                <div className="text-3xl mb-2">🧮</div>
                <p className="text-xs text-center">Ingresa el precio<br/>para ver el resultado</p>
              </div>
            )}

            {/* Botón usar en venta — siempre visible al fondo */}
            {result && onUsarEnVenta && (
              <button onClick={handleUsarEnVenta}
                className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-xl transition-all text-sm shrink-0">
                Usar en registro de venta
                <ChevronRight size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
