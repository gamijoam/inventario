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
        <div className="space-y-6 max-w-2xl">
            <div>
                <h2 className="text-xl font-black text-slate-900">Financiadoras Externas</h2>
                <p className="text-slate-500 text-sm mt-1">
                    Activa este módulo para permitir ventas con Cashea, Krece u otras empresas financiadoras.
                </p>
            </div>

            {/* Toggle principal del módulo */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${enabled ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                            <Building2 size={22} className={enabled ? 'text-emerald-600' : 'text-slate-400'} />
                        </div>
                        <div>
                            <p className="font-bold text-slate-800">Módulo de Financiadoras</p>
                            <p className="text-sm text-slate-500">
                                {enabled
                                    ? 'Activo — aparece en el POS y en el menú de Reportes'
                                    : 'Inactivo — no aparece en el POS ni en Reportes'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleToggle}
                        disabled={saving}
                        className="flex-shrink-0"
                    >
                        {enabled
                            ? <ToggleRight size={44} className="text-emerald-500 hover:text-emerald-600 transition-colors" />
                            : <ToggleLeft size={44} className="text-slate-300 hover:text-slate-400 transition-colors" />}
                    </button>
                </div>
            </div>

            {/* Lista de financiadoras configuradas */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-bold text-slate-800">Empresas Financiadoras</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Las financiadoras se configuran en <strong>Métodos de Pago</strong> marcando la opción "Es financiadora externa".
                        </p>
                    </div>
                </div>

                {financers.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                        <Building2 size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm font-semibold">Sin financiadoras configuradas</p>
                        <p className="text-xs mt-1">Ve a <strong>Métodos de Pago</strong> y activa la opción "Es financiadora externa" en Cashea, Krece u otros.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {financers.map(f => (
                            <div key={f.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${f.is_active ? 'bg-emerald-100' : 'bg-slate-200'}`}>
                                        <Building2 size={16} className={f.is_active ? 'text-emerald-600' : 'text-slate-400'} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{f.name}</p>
                                        <p className="text-xs text-slate-400">{f.is_active ? 'Disponible en el POS' : 'Desactivada'}</p>
                                    </div>
                                </div>
                                <button onClick={() => handleToggleFinancer(f)}>
                                    {f.is_active
                                        ? <ToggleRight size={32} className="text-emerald-500 hover:text-emerald-600 transition-colors" />
                                        : <ToggleLeft size={32} className="text-slate-300 hover:text-slate-400 transition-colors" />}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-700">
                <p className="font-bold mb-1">¿Cómo funciona?</p>
                <ul className="space-y-1 text-xs list-disc list-inside">
                    <li>Cuando el módulo está activo, aparece el botón <strong>"Financiamiento Externo"</strong> en el modal de pago del POS</li>
                    <li>La cajera selecciona la financiadora e ingresa el monto inicial — ese valor entra a caja</li>
                    <li>El monto financiado queda registrado como pendiente de cobro a la financiadora</li>
                    <li>Desde <strong>Finanzas → Financiadoras</strong> puedes ver y marcar como pagados los montos que cada empresa te debe</li>
                </ul>
            </div>
        </div>
    );
}
