import React, { useState, useRef, useEffect } from 'react';
import { Search, RotateCcw, CheckCircle, XCircle, AlertTriangle, ShieldCheck, ShieldAlert, DollarSign, Package } from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';
import { useConfig } from '../../context/ConfigContext';

const WarrantyManager = () => {
    // State
    const { currencies } = useConfig();
    const [imei, setImei] = useState('');
    const [loading, setLoading] = useState(false);
    const [checkResult, setCheckResult] = useState(null); // Data from /rma/check
    const [step, setStep] = useState(1); // 1: Scan, 2: Decision

    // Form Data
    const [condition, setCondition] = useState('GOOD'); // GOOD | DAMAGED
    const [reason, setReason] = useState('');
    const [action, setAction] = useState('REFUND');

    const inputRef = useRef(null);

    const handleCheck = async () => {
        if (!imei.trim()) return;

        setLoading(true);
        try {
            const { data } = await apiClient.get(`/rma/check/${imei.trim().toUpperCase()}`);
            setCheckResult(data);

            if (data.valid || data.warranty_status !== 'NOT_FOUND') {
                setStep(2);
                if (data.warranty_status === 'EXPIRED') {
                    toast("Garantía Vencida", { icon: "⚠️" });
                } else if (data.valid) {
                    toast.success("Equipo encontrado y en garantía");
                }
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.detail || "Error verificando IMEI");
            setCheckResult(null);
        } finally {
            setLoading(false);
        }
    };

    const handleProcess = async () => {
        if (!reason.trim()) return toast.error("Debe especificar el motivo");

        if (!window.confirm("¿Está seguro de procesar esta devolución? Esta acción revertirá comisiones y afectará caja.")) return;

        setLoading(true);
        try {
            const payload = {
                imei: imei.trim().toUpperCase(),
                reason,
                condition,
                action,
                notes: ""
            };

            const { data } = await apiClient.post('/rma/process', payload);

            toast.success("Devolución procesada correctamente");
            // Success Info
            toast(`Reembolso: $${data.refund_amount}`, { duration: 4000, icon: '💰' });
            if (data.commission_reversed) toast("Comisión de vendedor revertida", { icon: '↩️' });

            handleReset();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.detail || "Error procesando devolución");
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setImei('');
        setCheckResult(null);
        setStep(1);
        setCondition('GOOD');
        setReason('');
        setAction('REFUND');
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col bg-slate-50 p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <ShieldCheck className="text-indigo-600" />
                    Gestión de Garantías (RMA)
                </h1>
                <p className="text-slate-500 font-medium ml-8">Procesar devoluciones de equipos serializados</p>
            </div>

            <div className="flex-1 flex gap-8 max-w-6xl mx-auto w-full">

                {/* LEFT: SCANNER & RESULT */}
                <div className="flex-1 flex flex-col gap-6">

                    {/* SEARCH BOX */}
                    <div className={clsx(
                        "bg-white p-8 rounded-2xl shadow-sm border transition-all duration-300",
                        step === 1 ? "border-indigo-200 shadow-md scale-100" : "border-slate-200 opacity-75 lg:opacity-100"
                    )}>
                        <label className="block text-sm font-bold text-slate-500 mb-3 uppercase tracking-wider">
                            Escanear IMEI / Serial
                        </label>
                        <div className="flex gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={imei}
                                    onChange={e => setImei(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleCheck()}
                                    className="w-full pl-12 pr-4 py-4 text-xl font-mono font-bold border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all uppercase placeholder-slate-300"
                                    placeholder="ESCANEAR AQUI..."
                                    disabled={loading || step === 2}
                                    autoFocus
                                />
                            </div>
                            {step === 2 && (
                                <button
                                    onClick={handleReset}
                                    className="px-6 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                                >
                                    <RotateCcw size={20} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* RESULT CARD */}
                    {checkResult && (
                        <div className={clsx(
                            "rounded-2xl border-l-8 shadow-sm p-6 animate-in fade-in slide-in-from-bottom-4",
                            checkResult.warranty_status === 'ACTIVE' ? "bg-emerald-50 border-emerald-500" :
                                checkResult.warranty_status === 'EXPIRED' ? "bg-amber-50 border-amber-500" :
                                    "bg-slate-50 border-slate-300"
                        )}>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className={clsx(
                                        "text-2xl font-black mb-1",
                                        checkResult.warranty_status === 'ACTIVE' ? "text-emerald-700" :
                                            checkResult.warranty_status === 'EXPIRED' ? "text-amber-700" : "text-slate-700"
                                    )}>
                                        {checkResult.message}
                                    </h2>
                                    <p className="text-sm font-bold opacity-75">
                                        {checkResult.warranty_status === 'ACTIVE' ? 'Equipo dentro del periodo de cobertura' : 'Verificar autorización de supervisor'}
                                    </p>
                                </div>
                                {checkResult.warranty_status === 'ACTIVE' ?
                                    <ShieldCheck size={48} className="text-emerald-200" /> :
                                    <ShieldAlert size={48} className="text-amber-200" />
                                }
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-6 bg-white/50 p-4 rounded-xl">
                                <div>
                                    <span className="text-xs uppercase font-bold opacity-50 block">Producto</span>
                                    <span className="font-bold text-lg leading-tight block">{checkResult.product_name}</span>
                                </div>
                                <div>
                                    <span className="text-xs uppercase font-bold opacity-50 block">Cliente Original</span>
                                    <span className="font-bold text-lg block">{checkResult.customer_name}</span>
                                </div>
                                <div>
                                    <span className="text-xs uppercase font-bold opacity-50 block">Fecha Compra</span>
                                    <span className="font-mono font-medium text-lg block">
                                        {new Date(checkResult.sale_date).toLocaleDateString()}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-xs uppercase font-bold opacity-50 block">Tiempo Transcurrido</span>
                                    <span className="font-mono font-medium text-lg block">{checkResult.days_elapsed} días</span>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* RIGHT: DECISION FORM */}
                {step === 2 && checkResult && (
                    <div className="w-[450px] bg-white rounded-2xl shadow-lg border border-slate-200 p-8 flex flex-col animate-in slide-in-from-right-8">
                        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                            Decisión de Garantía
                        </h3>

                        <div className="space-y-6 flex-1">
                            {/* Condition */}
                            <div>
                                <label className="block text-sm font-bold text-slate-500 mb-2">Estado del Equipo</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setCondition('GOOD')}
                                        className={clsx(
                                            "p-3 rounded-xl border-2 font-bold text-sm transition-all flex flex-col items-center gap-2",
                                            condition === 'GOOD' ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-100 bg-slate-50 text-slate-400 hover:bg-slate-100"
                                        )}
                                    >
                                        <CheckCircle size={24} />
                                        <span>Buen Estado</span>
                                        <span className="text-[10px] font-normal opacity-75">(Revender)</span>
                                    </button>
                                    <button
                                        onClick={() => setCondition('DAMAGED')}
                                        className={clsx(
                                            "p-3 rounded-xl border-2 font-bold text-sm transition-all flex flex-col items-center gap-2",
                                            condition === 'DAMAGED' ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-100 bg-slate-50 text-slate-400 hover:bg-slate-100"
                                        )}
                                    >
                                        <AlertTriangle size={24} />
                                        <span>Dañado / Falla</span>
                                        <span className="text-[10px] font-normal opacity-75">(Cuarentena)</span>
                                    </button>
                                </div>
                            </div>

                            {/* Reason */}
                            <div>
                                <label className="block text-sm font-bold text-slate-500 mb-2">Motivo / Diagnóstico</label>
                                <textarea
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none resize-none bg-slate-50 font-medium"
                                    rows="3"
                                    placeholder="Describa el problema o razón de devolución..."
                                />
                            </div>

                            {/* Refund Info */}
                            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-bold text-indigo-400 uppercase">Monto a Reembolsar</span>
                                    <span className="bg-white text-indigo-600 text-[10px] px-2 py-0.5 rounded font-bold border border-indigo-100">USD</span>
                                </div>
                                <div className="text-3xl font-black text-indigo-800">
                                    ${Number(checkResult.original_price).toFixed(2)}
                                </div>
                                <p className="text-xs text-indigo-400 mt-2 flex items-center gap-1">
                                    <AlertTriangle size={12} />
                                    Se debitará de la caja actual
                                </p>
                            </div>

                        </div>

                        <button
                            onClick={handleProcess}
                            disabled={loading || !reason.trim()}
                            className="w-full py-4 mt-8 bg-slate-900 text-white rounded-xl font-bold text-lg hover:bg-slate-800 shadow-xl shadow-slate-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center gap-2"
                        >
                            {loading ? <Package className="animate-spin" /> : <DollarSign />}
                            Confirmar Devolución
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WarrantyManager;
