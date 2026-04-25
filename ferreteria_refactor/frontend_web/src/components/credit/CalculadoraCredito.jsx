import { useState, useCallback, useEffect } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { useAuth } from '../../context/AuthContext';
import { Calculator, ChevronRight, ChevronDown, X, Smartphone } from 'lucide-react';

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
export default function CalculadoraCredito({ precioInicial = 0, onUsarEnVenta, onCerrar, disabled = false }) {
  const { business } = useConfig();
  const { user } = useAuth();
  const [precio,      setPrecio]      = useState(precioInicial > 0 ? precioInicial : '');
  const [enganche,    setEnganche]    = useState('');
  const [enganchePct, setEnganchePct] = useState('');
  const [tasa,        setTasa]        = useState(0);
  const [cuotas,      setCuotas]      = useState(6);
  const [freq,        setFreq]        = useState('mensual');
  const [fecha,       setFecha]       = useState('');
  const [tablaOpen,   setTablaOpen]   = useState(false);
  const [showConfig,  setShowConfig]  = useState(false);

  useEffect(() => {
    if (business) {
      const defEnganche = business.credit_default_down_payment_pct || 20;
      const defTasa = business.credit_default_interest_rate || 10;
      setTasa(parseFloat(defTasa));
      setEnganchePct(parseFloat(defEnganche));
      
      const pr = parseFloat(precioInicial) || 0;
      if (pr > 0) {
        setEnganche((pr * parseFloat(defEnganche) / 100).toFixed(2));
      }
    }
  }, [business, precioInicial]);

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
      precio        : pr,
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
        
        <div className="flex items-center gap-2">
          {user?.role === 'ADMIN' && (
            <button 
              onClick={() => setShowConfig(!showConfig)}
              className={`text-[10px] font-bold px-3 py-1 rounded-full transition-colors ${showConfig ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}
            >
              {showConfig ? '🔒 Bloquear Config' : '⚙️ Ajustar Manual'}
            </button>
          )}
          {onCerrar && (
            <button onClick={onCerrar} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
              <X size={16} className="text-slate-400" />
            </button>
          )}
        </div>
      </div>

      {/* ── BODY SCROLL ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className={`grid grid-cols-1 ${showConfig ? 'lg:grid-cols-2' : 'lg:grid-cols-1'} gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-100`}>
          
          {/* ══ COLUMNA IZQUIERDA: INPUTS (Hidden by default) ═════════════ */}
          {showConfig && (
            <div className="p-4 space-y-3 bg-slate-50/50">
              <div>
                <label className="text-[10px] font-bold tracking-widest text-slate-400 uppercase block mb-1.5">Precio del Equipo</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                  <input type="number" min="0" step="0.01" value={precio}
                    onChange={e => setPrecio(e.target.value)} placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2.5 text-xl font-black bg-white border-2 border-slate-200 focus:border-indigo-400 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold tracking-widest text-slate-400 uppercase block mb-1.5">Enganche (%)</label>
                  <input type="number" value={enganchePct} onChange={e => onEnganchePctChange(e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold" />
                </div>
                <div>
                  <label className="text-[10px] font-bold tracking-widest text-slate-400 uppercase block mb-1.5">Interés (%)</label>
                  <input type="number" value={tasa} onChange={e => setTasa(e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold tracking-widest text-slate-400 uppercase block mb-1.5">Cuotas</label>
                <div className="flex flex-wrap gap-2">
                  {PILLS_CUOTAS.map(n => (
                    <button key={n} onClick={() => setCuotas(n)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${cuotas === n ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-500'}`}
                    >{n}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold tracking-widest text-slate-400 uppercase block mb-1.5">Frecuencia</label>
                  <select value={freq} onChange={e => setFreq(e.target.value)} className="w-full px-2 py-2 bg-white border-2 border-slate-200 rounded-xl text-xs font-bold">
                    {FRECUENCIAS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold tracking-widest text-slate-400 uppercase block mb-1.5">Primer Pago</label>
                  <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-full px-2 py-1.5 bg-white border-2 border-slate-200 rounded-xl text-xs" />
                </div>
              </div>
            </div>
          )}

          {/* ══ COLUMNA DERECHA: RESULTADO (Main Focus) ════════════════ */}
          <div className="p-4 flex flex-col gap-3">
            <div className="bg-gradient-to-br from-[#1e3a5f] to-[#1a1f35] rounded-2xl p-5 text-center">
              <p className="text-[10px] font-bold tracking-widest text-[#60a5fa] mb-1 uppercase">Cuota a Cobrar</p>
              <p className="text-4xl font-black text-white leading-none">{result ? `$${result.cuota.toFixed(2)}` : '$0.00'}</p>
              <p className="text-xs text-[#93c5fd] mt-1">{result ? `${cuotas} cuotas / ${freqLabel[freq]}` : 'Cargando datos...'}</p>
            </div>

            {result && (
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-50 rounded-xl p-2 text-center">
                  <p className="text-[8px] text-slate-400 font-bold uppercase">Total</p>
                  <p className="font-black text-xs text-amber-600">${result.total.toFixed(2)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-2 text-center">
                  <p className="text-[8px] text-slate-400 font-bold uppercase">Enganche</p>
                  <p className="font-black text-xs text-indigo-600">${eng.toFixed(2)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-2 text-center">
                  <p className="text-[8px] text-slate-400 font-bold uppercase">Financia</p>
                  <p className="font-black text-xs text-emerald-600">${result.financiado.toFixed(2)}</p>
                </div>
              </div>
            )}

            {result && result.desglose.length > 0 && (
              <div className="border border-slate-100 rounded-xl overflow-hidden flex-1 flex flex-col">
                <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 flex justify-between items-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Plan de Pagos</p>
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{cuotas} cuotas</span>
                </div>
                <div className="overflow-y-auto max-h-[300px]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-white shadow-sm">
                      <tr className="text-[9px] font-bold text-slate-400 uppercase border-b border-slate-50">
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">Fecha</th>
                        <th className="px-3 py-2 text-right">Cuota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.desglose.map((row, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                          <td className="px-3 py-2 text-slate-600">{result.fechas[i] ? fmtFecha(result.fechas[i]) : '—'}</td>
                          <td className="px-3 py-2 text-right font-bold text-slate-800">${row.cuota.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result && onUsarEnVenta && (
              <button onClick={handleUsarEnVenta} disabled={disabled}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all text-sm shadow-lg shadow-indigo-200">
                {disabled ? '⏳ Registrando...' : 'Confirmar Crédito'}
                {!disabled && <ChevronRight size={16} />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
