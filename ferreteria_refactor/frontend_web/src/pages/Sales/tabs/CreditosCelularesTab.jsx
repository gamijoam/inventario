import { useState, useEffect, useCallback } from "react";
import {
  Lock, Unlock, Smartphone, Download, RefreshCw, Search,
  DollarSign, AlertTriangle, CheckCircle2, QrCode,
  ChevronDown, ChevronUp, Copy, ExternalLink, Info, FileText
} from "lucide-react";
import apiClient from "../../../config/axios";
import { toast } from "react-hot-toast";

const APK_URL = "https://bloqueo.miinventariofacil.com/app/bloqueo.apk";

function EstadoBadge({ estado }) {
  const cfg = {
    activo: { label: "📱 Activo", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    bloqueado: { label: "🔒 Bloqueado", cls: "bg-red-50 text-red-700 border-red-200" },
    sin_activar: { label: "⚠️ Sin Activar", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  };
  const s = cfg[estado] || cfg.sin_activar;
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${s.cls}`}>{s.label}</span>;
}

function FilaCelular({ inv, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [estadoBLC, setEstadoBLC] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [abonoAbierto, setAbonoAbierto] = useState(false);
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState("USD");
  const [metodo, setMetodo] = useState("Efectivo");
  const [referencia, setReferencia] = useState("");

  const codigo = inv.bloqueo_codigo_activacion;
  const sincronizado = inv.bloqueo_sincronizado;
  const estadoReal = inv.bloqueo_estado || (sincronizado ? "activo" : "sin_activar");

  useEffect(() => {
    if (expanded && sincronizado) {
      apiClient.get(`/bloqueo/sales/${inv.id}/estado`).then((r) => setEstadoBLC(r.data)).catch(() => {});
    }
  }, [expanded, inv.id, sincronizado]);

  const registrarAbono = async () => {
    const amt = parseFloat(monto);
    if (!amt || amt <= 0) { toast.error("Ingresa un monto válido"); return; }
    setCargando(true);
    try {
      let rate = 1.0;
      if (moneda !== "USD") {
        const r = await apiClient.get("/config/exchange-rates").catch(() => ({ data: [] }));
        const rateObj = (r.data || []).find((curr) => curr.symbol === moneda);
        rate = rateObj ? parseFloat(rateObj.rate) : 1.0;
      }
      await apiClient.post("/products/sales/payments", {
        sale_id: inv.id, amount: amt, currency: moneda,
        payment_method: metodo, exchange_rate: rate, reference: referencia,
      });
      toast.success("✅ Pago registrado");
      setMonto(""); setReferencia(""); setAbonoAbierto(false); onRefresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al registrar abono");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl mb-3 overflow-hidden hover:border-indigo-200 transition-all shadow-sm">
      <div className="p-4 flex items-center gap-4">
        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
          <Smartphone size={20} className={sincronizado ? "text-indigo-600" : "text-slate-300"} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">#{inv.id}</span>
            <span className="text-sm font-medium text-slate-600 truncate">{inv.customer?.name}</span>
            <EstadoBadge estado={estadoReal} />
          </div>
          <p className="text-[11px] text-slate-400">IMEI: <span className="font-mono font-bold text-slate-600">{inv.bloqueo_imei || "No reg."}</span></p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-black text-indigo-600">${parseFloat(inv.balance_pending || 0).toFixed(2)}</p>
            <p className="text-[9px] text-slate-400 font-bold uppercase">Pendiente</p>
          </div>
          <button onClick={() => setAbonoAbierto(!abonoAbierto)} className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black rounded-xl hover:bg-indigo-700 uppercase tracking-tighter">Abonar</button>
          <button onClick={() => setExpanded(!expanded)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            {expanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
          </button>
        </div>
      </div>

      {abonoAbierto && (
        <div className="p-4 bg-indigo-50/50 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="relative">
            <span className="absolute left-3 top-1 text-[8px] font-bold text-indigo-400 uppercase">Monto</span>
            <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} className="w-full pl-3 pr-3 pt-4 pb-1.5 rounded-xl border border-indigo-200 text-sm font-black outline-none focus:border-indigo-400" />
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1 text-[8px] font-bold text-indigo-400 uppercase">Moneda</span>
            <select value={moneda} onChange={(e) => setMoneda(e.target.value)} className="w-full pl-3 pr-3 pt-4 pb-1.5 rounded-xl border border-indigo-200 text-sm font-bold outline-none appearance-none">
              <option value="USD">USD ($)</option>
              <option value="VES">Bs (VES)</option>
            </select>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1 text-[8px] font-bold text-indigo-400 uppercase">Método</span>
            <select value={metodo} onChange={(e) => setMetodo(e.target.value)} className="w-full pl-3 pr-3 pt-4 pb-1.5 rounded-xl border border-indigo-200 text-sm font-bold outline-none appearance-none">
              <option value="Efectivo">Efectivo</option>
              <option value="Zelle">Zelle</option>
              <option value="Pago Movil">Pago Móvil</option>
            </select>
          </div>
          <button onClick={registrarAbono} disabled={cargando} className="bg-indigo-600 text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-indigo-100">
            {cargando ? "..." : "PAGAR"}
          </button>
        </div>
      )}

      {expanded && (
        <div className="p-4 border-t border-slate-100 bg-slate-50/30 space-y-4">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                   <QrCode size={14} className="text-indigo-500" />
                   <span className="text-[10px] font-black text-slate-400 uppercase">Código de Activación</span>
                </div>
                <p className="text-2xl font-mono font-black text-slate-800">{codigo || "SIN CÓDIGO"}</p>
                <p className="text-[10px] text-slate-400 mt-1 italic">Ingresar en la App de Bloqueo</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="p-1 bg-white border border-slate-100 rounded-lg">
                   <img src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(APK_URL)}&size=80x80`} alt="APK" className="w-16 h-16" />
                </div>
                <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase">App Técnico</p>
                   <a href={APK_URL} target="_blank" className="flex items-center gap-1 text-xs font-bold text-indigo-600 mt-1">
                      <Download size={14} /> Descargar APK
                   </a>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                 <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Estado BloqueCelular</p>
                 {estadoBLC ? (
                    <div className="space-y-1">
                       <p className="text-sm font-bold text-slate-700 capitalize">{estadoBLC.status || "Desconocido"}</p>
                       <p className="text-[10px] text-slate-400">Última sinc: {new Date(estadoBLC.last_sync).toLocaleDateString()}</p>
                    </div>
                 ) : (
                    <p className="text-xs text-slate-400 italic">Cargando estado...</p>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

export default function CreditosCelularesTab() {
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiClient.get("/products/credits?limit=200");
      const items = Array.isArray(r.data) ? r.data : (r.data?.items || []);
      // Filtrar solo los que tienen datos de IMEI o sincronizacion de bloqueo
      setVentas(items.filter(i => i.has_imei || i.bloqueo_sincronizado || i.bloqueo_imei));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const filtradas = ventas.filter(v => 
    !busqueda || 
    (v.customer?.name || "").toLowerCase().includes(busqueda.toLowerCase()) ||
    (v.bloqueo_imei || "").includes(busqueda) ||
    v.id.toString().includes(busqueda)
  );

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center justify-between">
         <div>
            <h3 className="text-lg font-black text-slate-800">Gestión de Equipos Financiados</h3>
            <p className="text-xs text-slate-400">Control de bloqueos e historial de pagos</p>
         </div>
         <button onClick={cargar} className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors">
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
         </button>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3.5 top-3 text-slate-400" />
        <input 
            type="text" 
            value={busqueda} 
            onChange={(e) => setBusqueda(e.target.value)} 
            placeholder="Buscar por cliente, IMEI o # de factura..." 
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all text-sm font-medium" 
        />
      </div>

      {loading ? (
          <div className="text-center py-20">
              <RefreshCw size={32} className="animate-spin mx-auto text-indigo-300 mb-3" />
              <p className="text-slate-400 font-medium text-sm">Cargando créditos...</p>
          </div>
      ) : filtradas.length === 0 ? (
          <div className="text-center py-20 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
              <Smartphone size={48} className="mx-auto text-slate-300 mb-4 opacity-50" />
              <p className="text-slate-500 font-bold">No se encontraron equipos registrados</p>
              <p className="text-slate-400 text-xs mt-1">Verifica si las ventas tienen asignado un IMEI</p>
          </div>
      ) : (
        <div className="animate-in fade-in duration-500">
          {filtradas.map(v => <FilaCelular key={v.id} inv={v} onRefresh={cargar} />)}
        </div>
      )}
    </div>
  );
}
