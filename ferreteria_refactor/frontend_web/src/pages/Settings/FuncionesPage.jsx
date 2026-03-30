/**
 * FuncionesPage — Autogestión de feature flags para modo offline/desktop.
 *
 * El ADMIN del tenant puede activar/desactivar funciones sin necesidad
 * del panel SaaS. Acceso: /funciones (solo ADMIN).
 */

import { useState, useEffect } from 'react';
import { ToggleLeft, ToggleRight, RefreshCw, Save, ChevronDown, ChevronUp } from 'lucide-react';
import apiClient from '../../config/axios';
import toast from 'react-hot-toast';

const CATEGORY_LABELS = {
    pos: 'Punto de Venta (POS)',
    ventas: 'Ventas',
    inventario: 'Inventario',
    reportes: 'Reportes',
    config: 'Configuración',
    otros: 'Otros',
};

export default function FuncionesPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [registry, setRegistry] = useState({});
    const [flags, setFlags] = useState({});
    const [pending, setPending] = useState({});
    const [openCategories, setOpenCategories] = useState({});

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/admin/flags');
            setRegistry(res.data.registry || {});
            setFlags(res.data.flags || {});
            setPending({});
            // Open all categories by default
            const cats = {};
            Object.values(res.data.registry || {}).forEach(f => { cats[f.category] = true; });
            setOpenCategories(cats);
        } catch (err) {
            toast.error('No se pudieron cargar las funciones');
        } finally {
            setLoading(false);
        }
    };

    const toggle = (key) => {
        const current = pending[key] !== undefined ? pending[key] : (flags[key] === true);
        setPending(prev => ({ ...prev, [key]: !current }));
    };

    const isOn = (key) => {
        return pending[key] !== undefined ? pending[key] : (flags[key] === true);
    };

    const hasPending = Object.keys(pending).length > 0;

    const save = async () => {
        if (!hasPending) return;
        setSaving(true);
        try {
            await apiClient.patch('/admin/flags', { flags: pending });
            setFlags(prev => ({ ...prev, ...pending }));
            setPending({});
            toast.success('Funciones guardadas correctamente');
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    // Group registry by category
    const byCategory = {};
    Object.entries(registry).forEach(([key, meta]) => {
        const cat = meta.category || 'otros';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push({ key, ...meta });
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-t-transparent border-indigo-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto py-6 px-4">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Funciones Activas</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Activa o desactiva funciones especiales para tu negocio.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={load}
                        className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
                    >
                        <RefreshCw size={14} />
                        Recargar
                    </button>
                    <button
                        onClick={save}
                        disabled={!hasPending || saving}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-colors ${hasPending ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                    >
                        <Save size={14} />
                        {saving ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                </div>
            </div>

            {hasPending && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 font-medium">
                    Tienes cambios sin guardar. Haz clic en "Guardar cambios" para aplicarlos.
                </div>
            )}

            <div className="space-y-4">
                {Object.entries(byCategory).map(([cat, items]) => (
                    <div key={cat} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <button
                            onClick={() => setOpenCategories(prev => ({ ...prev, [cat]: !prev[cat] }))}
                            className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
                        >
                            <span className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
                                {CATEGORY_LABELS[cat] || cat}
                            </span>
                            {openCategories[cat] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {openCategories[cat] && (
                            <div className="divide-y divide-gray-100">
                                {items.map(({ key, label, description }) => {
                                    const on = isOn(key);
                                    const changed = pending[key] !== undefined;
                                    return (
                                        <div key={key} className={`flex items-center justify-between px-5 py-4 ${changed ? 'bg-amber-50' : ''}`}>
                                            <div className="flex-1 mr-4">
                                                <p className="font-medium text-gray-800 text-sm">{label}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                                            </div>
                                            <button
                                                onClick={() => toggle(key)}
                                                className="flex-shrink-0"
                                                title={on ? 'Desactivar' : 'Activar'}
                                            >
                                                {on
                                                    ? <ToggleRight size={36} className="text-indigo-600" />
                                                    : <ToggleLeft size={36} className="text-gray-300" />
                                                }
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {Object.keys(byCategory).length === 0 && (
                <div className="text-center text-gray-400 py-16">
                    No hay funciones disponibles para este tenant.
                </div>
            )}
        </div>
    );
}
