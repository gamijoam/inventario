import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
    RefreshCw, Search, Smartphone, User, ChevronRight, ChevronDown, 
    Shield, ShieldAlert, ShieldCheck, DollarSign, Calendar, History,
    ExternalLink, AlertCircle, Lock, Unlock, Zap, CreditCard, X, CheckCircle2
} from "lucide-react";
import apiClient from "../../../config/axios";
import { toast } from "react-hot-toast";
import { getApiErrorMessage } from '../../../utils/apiErrors';
import clsx from "clsx";

const formatUSD = (val) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val || 0);
const formatFecha = (d) => d ? new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "---";

function ModalPagoCelular({ isOpen, onClose, inv, onRefresh }) {
    const [numCuotas, setNumCuotas] = useState(1);
    const [loading, setLoading] = useState(false);
    const [metodo, setMetodo] = useState("Efectivo");
    const [referencia, setReferencia] = useState("");

    if (!isOpen || !inv) return null;

    const montoCuota = inv.credit_installment_amount || (inv.total_amount / (inv.credit_installments || 1));
    const totalAPagar = montoCuota * numCuotas;
    const cuotasPendientes = Math.ceil(inv.balance_pending / montoCuota);

    const handlePago = async () => {
        setLoading(true);
        try {
            await apiClient.post("/products/sales/payments", {
                sale_id: inv.id,
                amount: totalAPagar,
                payment_method: metodo,
                reference: referencia,
                currency: "USD",
                exchange_rate: 1,
                payment_date: new Date().toISOString()
            });
            toast.success("✅ Abono registrado");
            onRefresh();
            onClose();
        } catch (e) {
            toast.error(getApiErrorMessage(error, "Error al registrar pago"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
                <div className="p-6 bg-indigo-600 text-white">
                    <h3 className="text-xl font-black">Abonar Cuota</h3>
                    <p className="text-xs opacity-80">Factura #{inv.id} - {inv.customer?.name}</p>
                </div>
                <div className="p-6 space-y-6">
                    <div className="flex justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div><p className="text-[10px] font-black text-slate-400 uppercase">Monto Cuota</p><p className="text-lg font-black">{formatUSD(montoCuota)}</p></div>
                        <div className="text-right"><p className="text-[10px] font-black text-slate-400 uppercase">Pendiente</p><p className="text-lg font-black text-rose-600">{formatUSD(inv.balance_pending)}</p></div>
                    </div>
                    <div>
                        <p className="text-xs font-black text-slate-500 uppercase mb-3">¿Cuántas cuotas abona?</p>
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            {[1, 2, 3, 4].map(n => (
                                <button key={n} disabled={n > cuotasPendientes} onClick={() => setNumCuotas(n)} className={clsx("flex-1 py-2.5 rounded-lg font-black text-sm", numCuotas === n ? "bg-indigo-600 text-white shadow-md" : "text-slate-400")}>
                                    {n}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="bg-emerald-600 p-4 rounded-2xl text-white flex justify-between items-center shadow-lg shadow-emerald-100">
                        <p className="text-sm font-bold">Total a Pagar</p>
                        <p className="text-2xl font-black">{formatUSD(totalAPagar)}</p>
                    </div>
                    <div className="space-y-3">
                        <select value={metodo} onChange={(e) => setMetodo(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none">
                            <option>Efectivo</option><option>Transferencia</option><option>Pago Móvil</option><option>Zelle</option>
                        </select>
                        {metodo !== "Efectivo" && <input type="text" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Referencia" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none" />}
                    </div>
                </div>
                <div className="p-6 bg-slate-50 border-t flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 font-black text-slate-400 uppercase text-xs">Cerrar</button>
                    <button onClick={handlePago} disabled={loading} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-black uppercase text-xs shadow-lg">
                        {loading ? "Procesando..." : "Confirmar Abono"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function FilaEquipo({ inv, onRefresh }) {
    const [expanded, setExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState("plan");
    const [showPayModal, setShowPayModal] = useState(false);
    const [loadingAction, setLoadingAction] = useState(false);
    
    const isBlocked = inv.bloqueo_estado === "bloqueado";
    const isSynced = inv.bloqueo_sincronizado;
    
    // IMEI: Buscar en todas las posibles rutas de la data
    const imei = inv.bloqueo_imei || inv.imei || (inv.details?.[0]?.instances?.[0]?.product_instance?.serial_number) || "---";

    const planCalculado = useMemo(() => {
        const numCuotas = inv.credit_installments || 1;
        const montoCuota = inv.credit_installment_amount || (inv.total_amount / numCuotas);
        const frecuencia = (inv.credit_frequency || "semanal").toLowerCase();
        const totalPagado = (inv.total_amount || 0) - (inv.balance_pending || 0);
        const plan = [];
        let f = new Date(inv.date || new Date());
        for(let i=1; i<=numCuotas; i++) {
            if(frecuencia.includes("semanal")) f.setDate(f.getDate() + 7);
            else if(frecuencia.includes("quincenal")) f.setDate(f.getDate() + 15);
            else if(frecuencia.includes("mensual")) f.setMonth(f.getMonth() + 1);
            else f.setDate(f.getDate() + 7);
            plan.push({ num: i, fecha: new Date(f), monto: montoCuota, paid: totalPagado >= (i * montoCuota - 0.01) });
        }
        return plan;
    }, [inv]);

    const handleAction = async (a) => {
        setLoadingAction(true);
        try {
            const r = await apiClient.post(`/bloqueo/sales/${inv.id}/${a}`);
            toast.success(r.data.mensaje || "Exito");
            onRefresh();
        } catch (e) { toast.error(getApiErrorMessage(e, "Error")); }
        finally { setLoadingAction(false); }
    };

    return (
        <div className="border-b border-slate-100 last:border-0">
            <ModalPagoCelular isOpen={showPayModal} onClose={() => setShowPayModal(false)} inv={inv} onRefresh={onRefresh} />
            <div onClick={() => setExpanded(!expanded)} className="flex items-center justify-between p-4 hover:bg-slate-50 cursor-pointer">
                <div className="flex items-center gap-4">
                    <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center", isBlocked ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600")}>
                        {isBlocked ? <Lock size={20} /> : <Smartphone size={20} />}
                    </div>
                    <div>
                        <p className="text-sm font-black text-slate-800">Factura #{inv.id}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">IMEI: {imei}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right mr-2"><p className="text-[10px] font-bold text-slate-400 uppercase">Deuda</p><p className="text-sm font-black text-rose-600">{formatUSD(inv.balance_pending)}</p></div>
                    <button onClick={(e) => { e.stopPropagation(); setShowPayModal(true); }} className="px-4 py-2 bg-emerald-600 text-white text-[10px] font-black rounded-xl shadow-lg">ABONAR CUOTA</button>
                    {expanded ? <ChevronDown className="text-slate-300" /> : <ChevronRight className="text-slate-300" />}
                </div>
            </div>
            {expanded && (
                <div className="bg-slate-50/50 p-4 border-t border-slate-100">
                    <div className="flex gap-2 mb-4 bg-white p-1 rounded-xl border border-slate-200 w-fit">
                        {[{ id: "plan", label: "Plan", icon: Calendar }, { id: "pagos", label: "Historial", icon: History }, { id: "seguridad", label: "Seguridad", icon: Shield }].map(t => (
                            <button key={t.id} onClick={() => setActiveTab(t.id)} className={clsx("px-4 py-2 rounded-lg text-xs font-black flex items-center gap-2", activeTab === t.id ? "bg-indigo-600 text-white shadow-md" : "text-slate-400")}>
                                <t.icon size={14} /> {t.label}
                            </button>
                        ))}
                    </div>
                    <div className="animate-in fade-in">
                        {activeTab === "plan" && (
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                <table className="w-full text-left text-xs"><thead className="bg-slate-50 border-b"><tr><th className="px-4 py-3 font-black text-slate-400 uppercase">#</th><th className="px-4 py-3 font-black text-slate-400 uppercase">Vencimiento</th><th className="px-4 py-3 font-black text-slate-400 uppercase text-right">Monto</th><th className="px-4 py-3 font-black text-slate-400 uppercase text-center">Estado</th></tr></thead>
                                <tbody className="divide-y">{planCalculado.map(c => (<tr key={c.num}><td className="px-4 py-3 font-bold text-slate-400">{c.num}</td><td className="px-4 py-3 font-bold text-slate-600">{formatFecha(c.fecha)}</td><td className="px-4 py-3 font-black text-slate-900 text-right">{formatUSD(c.monto)}</td><td className="px-4 py-3 text-center"><span className={clsx("text-[9px] font-black px-1.5 py-0.5 rounded uppercase", c.paid ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600")}>{c.paid ? "Pagado" : "Pendiente"}</span></td></tr>))}</tbody></table>
                            </div>
                        )}
                        {activeTab === "pagos" && (
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                <table className="w-full text-left text-xs"><thead className="bg-slate-50 border-b"><tr><th className="px-4 py-3 font-black text-slate-400 uppercase">Fecha</th><th className="px-4 py-3 font-black text-slate-400 uppercase">Monto</th><th className="px-4 py-3 font-black text-slate-400 uppercase text-right">Ref</th></tr></thead>
                                <tbody className="divide-y">{(inv.payments || []).map(p => (<tr key={p.id}><td className="px-4 py-3 font-bold">{formatFecha(p.payment_date)}</td><td className="px-4 py-3 font-black text-indigo-600">{formatUSD(p.amount)}</td><td className="px-4 py-3 font-mono text-slate-400 text-right uppercase">{p.reference || "---"}</td></tr>))}
                                {!(inv.payments?.length) && (<tr><td colSpan="3" className="px-4 py-8 text-center text-slate-400 font-bold">No hay abonos registrados</td></tr>)}</tbody></table>
                            </div>
                        )}
                        {activeTab === "seguridad" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Control del Equipo</p>
                                    <div className="flex items-center gap-3"><div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center", isBlocked ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600")}>{isBlocked ? <Lock size={16} /> : <Unlock size={16} />}</div><div><p className="text-sm font-black text-slate-800 tracking-tight uppercase">{inv.bloqueo_estado || "ACTIVO"}</p><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Cód: {inv.bloqueo_codigo_activacion || "---"}</p></div></div>
                                    <div className="grid grid-cols-2 gap-2 mt-4">
                                        <button onClick={() => handleAction(isBlocked ? "desbloquear" : "bloquear")} disabled={loadingAction || !isSynced} className={clsx("py-2.5 rounded-lg text-[10px] font-black uppercase transition-all", isBlocked ? "bg-emerald-600 text-white" : "bg-rose-600 text-white", (!isSynced || loadingAction) && "opacity-50")}>{isBlocked ? "Desbloquear" : "Bloquear"}</button>
                                        {!isSynced && <button onClick={() => handleAction("sync")} className="bg-indigo-600 text-white py-2.5 rounded-lg text-[10px] font-black uppercase">Sincronizar</button>}
                                    </div>
                                </div>
                                <div className="bg-slate-800 p-4 rounded-xl text-white relative overflow-hidden group">
                                    <p className="text-[9px] font-black uppercase opacity-60">App Técnico APK</p><p className="text-xs font-bold leading-tight mt-1">Escanea para control directo</p>
                                    <div className="flex items-end gap-3 mt-4"><div className="bg-white p-1 rounded-lg"><img src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent("https://colaloca2.qa.miinventariofacil.com/apk")}&size=60x60`} alt="QR" /></div><div className="flex-1"><p className="text-[10px] font-bold text-slate-400 mb-1">IMEI del Equipo:</p><p className="text-xs font-black text-indigo-400 break-all">{imei}</p></div></div>
                                    <Smartphone size={100} className="absolute -bottom-8 -right-8 opacity-10 rotate-12 group-hover:rotate-0 transition-transform duration-500" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function GrupoCliente({ cliente, equipos, onRefresh }) {
    const [expanded, setExpanded] = useState(false);
    const totalP = equipos.reduce((s, e) => s + (e.balance_pending || 0), 0);
    return (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm mb-4 hover:border-indigo-200 transition-all">
            <div onClick={() => setExpanded(!expanded)} className={clsx("flex items-center justify-between p-5 cursor-pointer", expanded ? "bg-slate-50" : "hover:bg-slate-50/50")}>
                <div className="flex items-center gap-4"><div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-lg shadow-inner">{cliente.name?.charAt(0) || "C"}</div><div><h4 className="text-base font-black text-slate-800 tracking-tight">{cliente.name || "Cliente General"}</h4><p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">{equipos.length} equipos</p></div></div>
                <div className="flex items-center gap-6"><div className="text-right"><p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-0.5">Total Deuda</p><p className="text-xl font-black text-slate-900">{formatUSD(totalP)}</p></div>{expanded ? <ChevronDown className="text-slate-400" /> : <ChevronRight className="text-slate-400" />}</div>
            </div>
            {expanded && <div className="divide-y divide-slate-100 animate-in fade-in slide-in-from-top-1">{equipos.map(e => <FilaEquipo key={e.id} inv={e} onRefresh={onRefresh} />)}</div>}
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
            const r = await apiClient.get("/products/credits?limit=500");
            const items = Array.isArray(r.data) ? r.data : (r.data?.items || []);
            setVentas(items.filter(i => i.has_imei || i.bloqueo_sincronizado || i.bloqueo_imei || i.bloqueo_cliente_id));
        } catch (e) { toast.error(getApiErrorMessage(e, "Error al cargar")); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { cargar(); }, [cargar]);
    const clientesA = useMemo(() => {
        const filtradas = ventas.filter(v => !busqueda || (v.customer?.name || "").toLowerCase().includes(busqueda.toLowerCase()) || (v.bloqueo_imei || "").includes(busqueda) || (v.imei || "").includes(busqueda));
        const grupos = filtradas.reduce((acc, sale) => {
            const cId = sale.customer?.id || "general";
            if (!acc[cId]) acc[cId] = { info: sale.customer || { id: "general", name: "Cliente General" }, equipos: [] };
            acc[cId].equipos.push(sale);
            return acc;
        }, {});
        return Object.values(grupos).sort((a, b) => (a.info.name || "").localeCompare(b.info.name || ""));
    }, [ventas, busqueda]);
    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-end"><div><h3 className="text-3xl font-black text-slate-900 tracking-tighter">Créditos Celulares</h3><p className="text-sm text-slate-500 font-medium tracking-tight">Gestión especializada de abonos y bloqueo</p></div><button onClick={cargar} className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 shadow-sm transition-all"><RefreshCw size={20} className={loading ? "animate-spin text-indigo-500" : "text-slate-400"} /></button></div>
            <div className="relative group"><Search size={22} className="absolute left-4 top-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" /><input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por cliente o IMEI..." className="w-full pl-12 pr-4 py-4.5 bg-white border border-slate-200 rounded-3xl outline-none focus:border-indigo-400 font-bold shadow-sm" /></div>
            {loading ? <div className="text-center py-24"><RefreshCw size={48} className="animate-spin mx-auto text-indigo-300" /></div> : (
                <div className="animate-in fade-in duration-500">{clientesA.map(g => <GrupoCliente key={g.info.id} cliente={g.info} equipos={g.equipos} onRefresh={cargar} />)}</div>
            )}
        </div>
    );
}
