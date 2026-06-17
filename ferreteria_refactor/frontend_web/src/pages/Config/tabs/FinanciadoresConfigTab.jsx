import { useState, useEffect } from 'react';
import { Building2, ToggleLeft, ToggleRight, Save, Plus, Trash2, RefreshCw } from 'lucide-react';
import apiClient from '../../../config/axios';
import { useConfig } from '../../../context/ConfigContext';
import { toast } from 'react-hot-toast';

export default function FinanciadoresConfigTab() {
    const [enabled, setEnabled] = useState(false);
    const [financers, setFinancers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { refreshConfig } = useConfig();

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        setLoading(true);
        try {
            // Cargar config del módulo
            const cfgRes = await apiClient.get('/config/business');
            const cfg = cfgRes.data;
            setEnabled(cfg.external_financing_enabled === true || cfg.external_financing_enabled === 'true');

            // Cargar métodos de pago que son financiadoras
            const pmRes = await apiClient.get('/payment-methods/');
            const list = (pmRes.data || []).filter(m => m.is_external_financer);
            setFinancers(list);
        } catch {
            toast.error('Error cargando configuración');
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async () => {
        const newVal = !enabled;
        setSaving(true);
        try {
            await apiClient.patch('/config/business', {
                external_financing_enabled: newVal
            });
            setEnabled(newVal);
            // Recargar config global para que el POS y Sidebar reflejen el cambio
            if (typeof refreshConfig === 'function') refreshConfig();
            toast.success(newVal ? 'Módulo de financiadoras activado' : 'Módulo de financiadoras desactivado');
        } catch {
            toast.error('Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleFinancer = async (pm) => {
        try {
            await apiClient.put(`/payment-methods/${pm.id}`, {
                ...pm,
                is_active: !pm.is_active
            });
            setFinancers(prev => prev.map(f =>
                f.id === pm.id ? { ...f, is_active: !f.is_active } : f
            ));
            toast.success(`${pm.name} ${!pm.is_active ? 'activada' : 'desactivada'}`);
        } catch {
            toast.error('Error al actualizar');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <RefreshCw size={24} className="text-indigo-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-white shadow-sm">
                        <Building2 size={21} />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-xl font-black text-slate-900">Financiadoras Externas</h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Activa ventas con Cashea, Krece u otras empresas financiadoras.
                        </p>
                    </div>
                </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${enabled ? 'bg-emerald-50' : 'bg-slate-100'}`}>
                            <Building2 size={20} className={enabled ? 'text-emerald-600' : 'text-slate-400'} />
                        </div>
                        <div className="min-w-0">
                            <p className="font-black text-slate-900">Módulo de Financiadoras</p>
                            <p className="text-sm text-slate-500">
                                {enabled
                                    ? 'Activo: aparece en el POS y en Reportes'
                                    : 'Inactivo: no aparece en el POS ni en Reportes'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleToggle}
                        disabled={saving}
                        className="flex-shrink-0 rounded-md p-1 transition-colors hover:bg-slate-50 disabled:opacity-50"
                    >
                        {enabled
                            ? <ToggleRight size={38} className="text-emerald-500 hover:text-emerald-600 transition-colors" />
                            : <ToggleLeft size={38} className="text-slate-300 hover:text-slate-400 transition-colors" />}
                    </button>
                </div>
            </div>

            <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div>
                    <p className="font-black text-slate-900">Empresas Financiadoras</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                        Las financiadoras se configuran en <strong>Métodos de Pago</strong> marcando la opción "Es financiadora externa".
                    </p>
                </div>

                {financers.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-slate-400">
                        <Building2 size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm font-semibold">Sin financiadoras configuradas</p>
                        <p className="mt-1 text-xs">Ve a <strong>Métodos de Pago</strong> y activa la opción "Es financiadora externa".</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {financers.map(f => (
                            <div key={f.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-3 transition-colors hover:border-indigo-200">
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${f.is_active ? 'bg-emerald-50' : 'bg-slate-100'}`}>
                                        <Building2 size={16} className={f.is_active ? 'text-emerald-600' : 'text-slate-400'} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-black text-slate-900">{f.name}</p>
                                        <p className="text-xs text-slate-400">{f.is_active ? 'Disponible en el POS' : 'Desactivada'}</p>
                                    </div>
                                </div>
                                <button onClick={() => handleToggleFinancer(f)} className="rounded-md p-1 transition-colors hover:bg-slate-50">
                                    {f.is_active
                                        ? <ToggleRight size={30} className="text-emerald-500 hover:text-emerald-600 transition-colors" />
                                        : <ToggleLeft size={30} className="text-slate-300 hover:text-slate-400 transition-colors" />}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-800">
                <p className="mb-1 font-bold">¿Cómo funciona?</p>
                <ul className="list-inside list-disc space-y-1 text-xs">
                    <li>Cuando el módulo está activo, aparece el botón <strong>"Financiamiento Externo"</strong> en el modal de pago del POS.</li>
                    <li>La cajera selecciona la financiadora e ingresa el monto inicial: ese valor entra a caja.</li>
                    <li>El monto financiado queda registrado como pendiente de cobro a la financiadora.</li>
                    <li>Desde <strong>Finanzas &gt; Financiadoras</strong> puedes ver y marcar como pagados los montos pendientes.</li>
                </ul>
            </div>
        </div>
    );

}
