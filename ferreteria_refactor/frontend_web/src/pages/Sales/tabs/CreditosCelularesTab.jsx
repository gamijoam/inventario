/**
 * CreditosCelularesTab.jsx
 * Sub-tab de gestión de créditos de celulares.
 *
 * Muestra todas las ventas a crédito de productos con has_imei=true.
 * Permite desde la lista:
 *   - Ver estado del bloqueo (activo / bloqueado / sin activar)
 *   - Bloquear / Desbloquear sin abrir modal
 *   - Ver el código BLC-XXXX
 *   - Descargar el APK para el técnico
 *   - Registrar abonos
 *   - Ver plan de cuotas completo
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Lock, Unlock, Smartphone, Download, RefreshCw,
  DollarSign, AlertTriangle, CheckCircle2, QrCode,
  ChevronDown, ChevronUp, Copy, ExternalLink, Info
} from 'lucide-react';
import apiClient from '../../../config/axios';
import { toast } from 'react-hot-toast';

// ─── APK URL pública ───────────────────────────────────────────────────────
const APK_URL = 'https://bloqueo.miinventariofacil.com/app/bloqueo.apk';

// ─── Badge de estado del bloqueo ──────────────────────────────────────────
function EstadoBadge({ estado }) {
  const cfg = {
    activo     : { label: '📱 Activo',       cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    bloqueado  : { label: '🔒 Bloqueado',    cls: 'bg-red-50 text-red-700 border-red-200'             },
    liberado   : { label: '✅ Liberado',     cls: 'bg-slate-100 text-slate-500 border-slate-200'      },
    sin_activar: { label: '⚠️ Sin activar',  cls: 'bg-amber-50 text-amber-700 border-amber-200'       },
  }[estado || 'sin_activar'];
  return (
    <span className={`text-[11px] font-bold px-2 py-1 rounded-full border whitespace-nowrap ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─── QR simple vía API pública ─────────────────────────────────────────────
function MiniQR({ url }) {
  return (
    <img src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(url)}&size=80x80&bgcolor=ffffff`}
      alt="QR APK" className="rounded border border-slate-200" width={80} height={80} />
  );
}

// ─── Fila expandible de un crédito de celular ──────────────────────────────
function FilaCelular({ inv, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [estadoBLC, setEstadoBLC] = useState(null);
  const [cargando, setCargando]   = useState(false);
  const [copiado, setCopiado]     = useState(false);
  const [abonoAbierto, setAbonoAbierto] = useState(false);
  const [monto, setMonto]         = useState('');

  const codigo   = inv.bloqueo_codigo_activacion;
  const sincronizado = inv.bloqueo_sincronizado;
  const estadoLocal  = inv.bloqueo_estado || (sincronizado ? 'activo' : 'sin_activar');

  // Cargar estado real de BloqueCelular al expandir
  useEffect(() => {
    if (expanded && sincronizado) {
      apiClient.get(`/bloqueo/sales/${inv.id}/estado`)
        .then(r => setEstadoBLC(r.data))
        .catch(() => {});
    }
  }, [expanded, inv.id, sincronizado]);

  const estadoReal = estadoBLC?.estado || estadoLocal;

  const bloquear = async () => {
    if (!confirm('¿Bloquear el equipo del cliente? Se bloqueará en segundos si tiene internet.')) return;
    setCargando(true);
    try {
      await apiClient.post(`/bloqueo/sales/${inv.id}/bloquear`, { motivo: 'Mora en pago' });
      toast.success('🔒 Equipo bloqueado');
      setEstadoBLC(prev => ({ ...prev, estado: 'bloqueado' }));
      onRefresh();
    } catch(e) { toast.error(e.response?.data?.detail || 'Error al bloquear'); }
    finally    { setCargando(false); }
  };

  const desbloquear = async () => {
    const fecha = prompt('Nueva fecha límite (YYYY-MM-DD):',
      new Date(Date.now()+30*24*60*60*1000).toISOString().split('T')[0]);
    if (!fecha) return;
    setCargando(true);
    try {
      await apiClient.post(`/bloqueo/sales/${inv.id}/desbloquear`, { nueva_fecha_limite: fecha });
      toast.success('🔓 Equipo desbloqueado');
      setEstadoBLC(prev => ({ ...prev, estado: 'activo' }));
      onRefresh();
    } catch(e) { toast.error(e.response?.data?.detail || 'Error al desbloquear'); }
    finally    { setCargando(false); }
  };

  const copiarCodigo = async () => {
    try { await navigator.clipboard.writeText(codigo); setCopiado(true); setTimeout(()=>setCopiado(false),2000); toast.success('Código copiado'); }
    catch { toast.error('No se pudo copiar'); }
  };

  const registrarAbono = async () => {
    const amt = parseFloat(monto);
    if (!amt || amt <= 0) { toast.error('Ingresa un monto válido'); return; }
    setCargando(true);
    try {
      await apiClient.post('/products/sales/payments', {
        sale_id: inv.id, amount: amt, currency: 'USD',
        payment_method: 'Efectivo', exchange_rate: 1.0
      });
      toast.success(`✅ Abono $${amt.toFixed(2)} registrado`);
      setMonto(''); setAbonoAbierto(false); onRefresh();
    } catch(e) { toast.error(e.response?.data?.detail || 'Error al registrar abono'); }
    finally    { setCargando(false); }
  };

  // Calcular plan de cuotas
  const calcPlan = () => {
    const pr  = parseFloat(inv.total_amount || 0);
    const eng = parseFloat(inv.credit_down_payment || 0);
    const t   = parseFloat(inv.credit_interest_rate || 0);
    const n   = parseInt(inv.credit_installments || 0);
    const freq= inv.credit_frequency || 'mensual';
    if (!n) return [];
    const fin  = Math.max(0, pr + pr*(t/100) - eng);
    const cuota= fin / n;
    let fecha  = new Date(); let saldo = fin; const rows = [];
    for (let i=0; i<n; i++) {
      if (i>0) { if(freq==='mensual') fecha.setMonth(fecha.getMonth()+1); else fecha.setDate(fecha.getDate()+(freq==='semanal'?7:15)); }
      saldo = Math.max(0, saldo-cuota);
      rows.push({ n:i+1, cuota:cuota.toFixed(2), saldo:saldo.toFixed(2),
        fecha: new Date(fecha).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'}) });
    }
    return rows;
  };

  const balance    = parseFloat(inv.balance_pending || inv.total_amount || 0);
  const totalPagado= parseFloat(inv.total_amount||0) - balance;
  const pctPagado  = inv.total_amount ? Math.round((totalPagado/parseFloat(inv.total_amount))*100) : 0;
  const clienteNombre = inv.customer?.name || `Cliente #${inv.customer_id}`;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-3">

      {/* ── Fila principal ── */}
      <div className="flex items-center gap-3 p-4">
        {/* Ícono */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
          ${estadoReal==='bloqueado' ? 'bg-red-50' : estadoReal==='activo' ? 'bg-emerald-50' : 'bg-amber-50'}`}>
          {estadoReal==='bloqueado'
            ? <Lock size={18} className="text-red-600" />
            : estadoReal==='activo'
              ? <Smartphone size={18} className="text-emerald-600" />
              : <AlertTriangle size={18} className="text-amber-600" />}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-slate-800">#{inv.id}</span>
            <span className="text-slate-400 text-xs">·</span>
            <span className="text-sm font-medium text-slate-600 truncate">{clienteNombre}</span>
            <EstadoBadge estado={estadoReal} />
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-xs text-slate-400">
              {inv.credit_installments ? `${inv.credit_installments} cuotas · $${parseFloat(inv.credit_installment_amount||0).toFixed(2)} · ${inv.credit_frequency||'mensual'}` : 'Sin plan'}
            </span>
            {codigo && (
              <span className="text-xs font-mono text-indigo-600 font-bold">{codigo}</span>
            )}
          </div>
        </div>

        {/* Saldo + barra */}
        <div className="text-right shrink-0 min-w-[90px]">
          <p className="font-black text-slate-800 text-sm">${balance.toFixed(2)}</p>
          <p className="text-[10px] text-slate-400">saldo</p>
          <div className="mt-1 bg-slate-100 rounded-full h-1.5 w-20">
            <div className="bg-indigo-500 rounded-full h-1.5" style={{width:`${pctPagado}%`}} />
          </div>
        </div>

        {/* Acciones rápidas */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Bloquear/Desbloquear directo */}
          {sincronizado && estadoReal==='activo' && (
            <button onClick={bloquear} disabled={cargando} title="Bloquear equipo"
              className="p-2 bg-red-50 hover:bg-red-100 rounded-xl text-red-600 transition-colors">
              {cargando ? <RefreshCw size={15} className="animate-spin" /> : <Lock size={15} />}
            </button>
          )}
          {sincronizado && estadoReal==='bloqueado' && (
            <button onClick={desbloquear} disabled={cargando} title="Desbloquear equipo"
              className="p-2 bg-emerald-50 hover:bg-emerald-100 rounded-xl text-emerald-600 transition-colors">
              {cargando ? <RefreshCw size={15} className="animate-spin" /> : <Unlock size={15} />}
            </button>
          )}
          {/* Abonar */}
          {!inv.paid && (
            <button onClick={() => setAbonoAbierto(v=>!v)}
              className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors">
              Abonar
            </button>
          )}
          {/* Expandir */}
          <button onClick={() => setExpanded(v=>!v)}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* ── Panel de abono rápido ── */}
      {abonoAbierto && (
        <div className="border-t border-slate-100 px-4 py-3 bg-indigo-50 flex items-center gap-3">
          <DollarSign size={16} className="text-indigo-500 shrink-0" />
          <input type="number" min="0" step="0.01" placeholder="Monto USD"
            value={monto} onChange={e=>setMonto(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&registrarAbono()}
            className="flex-1 px-3 py-1.5 rounded-xl border border-indigo-200 text-sm font-bold outline-none focus:border-indigo-400" />
          <button onClick={registrarAbono} disabled={cargando}
            className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-60">
            {cargando ? '...' : 'Registrar'}
          </button>
          <button onClick={()=>setAbonoAbierto(false)} className="p-1 text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {/* ── Detalle expandido ── */}
      {expanded && (
        <div className="border-t border-slate-100 p-4 space-y-4">

          {/* Código BLC + APK */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Código BLC */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-2">Código de Activación</p>
              {codigo ? (
                <>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white border-2 border-indigo-300 rounded-xl px-3 py-2 text-center">
                      <p className="font-black text-indigo-700 text-xl font-mono tracking-widest">{codigo}</p>
                    </div>
                    <button onClick={copiarCodigo}
                      className="p-2 bg-indigo-100 hover:bg-indigo-200 rounded-xl transition-colors">
                      {copiado ? <CheckCircle2 size={16} className="text-emerald-600" /> : <Copy size={16} className="text-indigo-600" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-indigo-500 mt-1.5">Técnico lo ingresa en la app después de instalarla</p>
                </>
              ) : (
                <div className="text-sm text-amber-600">
                  ⚠️ Sin código — la venta no fue sincronizada con BloqueCelular
                </div>
              )}
            </div>

            {/* APK Download — prominente para el técnico */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">App de Bloqueo (APK Android)</p>
              <div className="flex items-start gap-3">
                <MiniQR url={APK_URL} />
                <div className="flex-1 space-y-2">
                  <p className="text-xs font-bold text-slate-700">Pasos para activar:</p>
                  <ol className="space-y-1">
                    {['Descarga e instala la app en el celular del cliente',
                      `Abre la app e ingresa el código ${codigo||'BLC-XXXX'}`,
                      'El equipo queda vinculado y protegido'].map((s,i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                        <span className="w-4 h-4 bg-indigo-600 text-white rounded-full text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">{i+1}</span>
                        {s}
                      </li>
                    ))}
                  </ol>
                  <a href={APK_URL} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors mt-1">
                    <Download size={12} /> Descargar APK <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Estado del equipo en BloqueCelular */}
          {sincronizado && estadoBLC && (
            <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone size={15} className="text-slate-400" />
                <span className="text-sm text-slate-600">{estadoBLC.nombre_equipo || 'Equipo registrado'}</span>
                {estadoBLC.imei && <span className="text-[10px] text-slate-400 font-mono">IMEI: {estadoBLC.imei}</span>}
              </div>
              <div className="flex items-center gap-2">
                {estadoBLC.saldo_pendiente > 0 && (
                  <span className="text-xs text-slate-500">
                    Saldo BLC: <strong>${parseFloat(estadoBLC.saldo_pendiente).toFixed(2)}</strong>
                    {estadoBLC.cuotas_pagadas != null && ` · ${estadoBLC.cuotas_pagadas}/${estadoBLC.num_cuotas} cuotas`}
                  </span>
                )}
                <EstadoBadge estado={estadoBLC.estado} />
              </div>
            </div>
          )}

          {/* Plan de cuotas */}
          {inv.credit_installments && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Plan de Pagos</p>
                <p className="text-xs text-slate-400">
                  {inv.credit_installments} cuotas · ${parseFloat(inv.credit_installment_amount||0).toFixed(2)} · {inv.credit_frequency}
                </p>
              </div>
              <div className="overflow-x-auto max-h-40 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      {['#','Fecha','Cuota','Saldo'].map(h=>(
                        <th key={h} className="px-3 py-2 text-left font-bold text-slate-400 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {calcPlan().map(row=>(
                      <tr key={row.n} className="border-t border-slate-50 hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-400 font-bold">{row.n}</td>
                        <td className="px-3 py-2 text-slate-600">{row.fecha}</td>
                        <td className="px-3 py-2 font-bold text-slate-800">${row.cuota}</td>
                        <td className="px-3 py-2 text-slate-500">${row.saldo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Acciones de bloqueo completas */}
          {sincronizado && (
            <div className="flex flex-wrap gap-2">
              {estadoReal==='activo' && (
                <button onClick={bloquear} disabled={cargando}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-60">
                  {cargando?<RefreshCw size={12} className="animate-spin"/>:<Lock size={12}/>}
                  Bloquear equipo
                </button>
              )}
              {estadoReal==='bloqueado' && (
                <button onClick={desbloquear} disabled={cargando}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-60">
                  {cargando?<RefreshCw size={12} className="animate-spin"/>:<Unlock size={12}/>}
                  Desbloquear equipo
                </button>
              )}
              <button onClick={async()=>{
                setCargando(true);
                try{const r=await apiClient.post(`/bloqueo/sales/${inv.id}/nuevo-codigo`);toast.success(`Nuevo código: ${r.data.codigo_activacion}`);}
                catch(e){toast.error('Error generando código');}
                finally{setCargando(false);}
              }} disabled={cargando}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors disabled:opacity-60">
                <QrCode size={12} /> Nuevo código BLC
              </button>
              <button onClick={()=>{setCargando(true);apiClient.get(`/bloqueo/sales/${inv.id}/estado`).then(r=>setEstadoBLC(r.data)).finally(()=>setCargando(false));}}
                className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
                <RefreshCw size={12} /> Refrescar estado
              </button>
            </div>
          )}

          {/* Nota */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
            <Info size={13} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-700">
              El bloqueo se aplica en segundos si el celular tiene internet.
              Si está sin conexión, Firebase retiene el comando hasta 4 semanas.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CreditosCelularesTab() {
  const [ventas,   setVentas]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filtro,   setFiltro]   = useState('todos'); // todos/activos/bloqueados/sin_activar
  const [habilitado, setHabilitado] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      // Cargar créditos que tengan datos de bloqueo (celulares)
      const r = await apiClient.get('/products/credits?limit=200');
      const items = Array.isArray(r.data) ? r.data : (r.data?.items || []);
      // Filtrar solo los que son celulares (tienen credit_installments o bloqueo_sincronizado)
      const celulares = items.filter(i =>
        i.is_credit && (i.bloqueo_sincronizado || i.credit_installments)
      );
      setVentas(celulares);

      // Verificar si BloqueCelular está activo
      const cfg = await apiClient.get('/bloqueo/config/estado').catch(()=>null);
      setHabilitado(cfg?.data?.enabled === true);
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const ventasFiltradas = ventas.filter(v => {
    if (filtro === 'todos')        return true;
    if (filtro === 'activos')      return v.bloqueo_estado === 'activo' || (v.bloqueo_sincronizado && !v.bloqueo_estado);
    if (filtro === 'bloqueados')   return v.bloqueo_estado === 'bloqueado';
    if (filtro === 'sin_activar')  return !v.bloqueo_sincronizado;
    return true;
  });

  const stats = {
    total       : ventas.length,
    activos     : ventas.filter(v => v.bloqueo_estado==='activo' || (v.bloqueo_sincronizado && !v.bloqueo_estado)).length,
    bloqueados  : ventas.filter(v => v.bloqueo_estado==='bloqueado').length,
    sin_activar : ventas.filter(v => !v.bloqueo_sincronizado).length,
    saldo_total : ventas.reduce((s,v)=>s+parseFloat(v.balance_pending||0), 0),
  };

  return (
    <div className="space-y-5">

      {/* ── Banner APK — prominente para el técnico ── */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-2xl p-4 flex items-center gap-4">
        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
          <Smartphone size={24} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-white text-sm">App de Bloqueo para Técnicos</p>
          <p className="text-indigo-200 text-xs">Instala la app en el celular del cliente e ingresa el código BLC para activar el bloqueo</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <img src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(APK_URL)}&size=60x60&bgcolor=ffffff`}
            alt="QR APK" className="rounded-lg" width={60} height={60} />
          <a href={APK_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-700 font-bold text-sm rounded-xl hover:bg-indigo-50 transition-colors whitespace-nowrap">
            <Download size={15} /> Descargar APK
          </a>
        </div>
      </div>

      {/* ── Estado de integración ── */}
      {!habilitado && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700">
            BloqueCelular no está configurado. Ve a{' '}
            <strong>Configuración → Integraciones</strong> para conectarlo.
          </p>
        </div>
      )}

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total celulares', val: stats.total,        color: 'slate'   },
          { label: 'Activos',         val: stats.activos,      color: 'emerald' },
          { label: 'Bloqueados',      val: stats.bloqueados,   color: 'red'     },
          { label: 'Sin activar',     val: stats.sin_activar,  color: 'amber'   },
        ].map(s => (
          <div key={s.label} className={`bg-${s.color}-50 border border-${s.color}-100 rounded-xl p-3 text-center`}>
            <p className={`text-2xl font-black text-${s.color}-700`}>{s.val}</p>
            <p className={`text-[11px] text-${s.color}-500 font-medium mt-0.5`}>{s.label}</p>
          </div>
        ))}
      </div>
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex items-center justify-between">
        <span className="text-sm text-indigo-600 font-medium">Saldo total por cobrar</span>
        <span className="text-xl font-black text-indigo-700">${stats.saldo_total.toFixed(2)}</span>
      </div>

      {/* ── Filtros ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold text-slate-500 uppercase">Filtrar:</span>
        {[
          { id:'todos',       label:'Todos'        },
          { id:'activos',     label:'📱 Activos'   },
          { id:'bloqueados',  label:'🔒 Bloqueados' },
          { id:'sin_activar', label:'⚠️ Sin activar'},
        ].map(f => (
          <button key={f.id} onClick={()=>setFiltro(f.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all
              ${filtro===f.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
            {f.label}
          </button>
        ))}
        <button onClick={cargar} className="ml-auto flex items-center gap-1.5 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
          <RefreshCw size={14} /> <span className="text-xs">Actualizar</span>
        </button>
      </div>

      {/* ── Lista ── */}
      {loading ? (
        <div className="text-center py-10 text-slate-400">
          <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
          Cargando créditos de celulares...
        </div>
      ) : ventasFiltradas.length === 0 ? (
        <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
          <Smartphone size={40} className="mx-auto mb-2 opacity-30" />
          <p className="font-medium">No hay créditos de celulares {filtro!=='todos'?`con estado "${filtro}"`:'registrados'}</p>
          <p className="text-sm mt-1">Las ventas a crédito de celulares (has_imei=true) aparecen aquí</p>
        </div>
      ) : (
        <div>
          {ventasFiltradas.map(inv => (
            <FilaCelular key={inv.id} inv={inv} onRefresh={cargar} />
          ))}
        </div>
      )}
    </div>
  );
}
