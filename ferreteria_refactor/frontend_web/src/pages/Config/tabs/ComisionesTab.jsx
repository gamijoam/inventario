import React, { useState, useEffect, useCallback } from 'react';
import { DollarSign, Plus, Trash2, Edit2, Save, X, ToggleLeft, ToggleRight, Zap, Wrench, Users, Tag, BookOpen } from 'lucide-react';
import GuiaComisiones from './GuiaComisiones';
import apiClient from '../../../config/axios';
import { toast } from 'react-hot-toast';
import { useFeatureFlag } from '../../../hooks/useFeatureFlag';

/* ─── Toggle bonito ─────────────────────────────────────────────── */
const Toggle = ({ value, onChange, disabled }) => (
    <button onClick={() => !disabled && onChange(!value)} disabled={disabled}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? 'bg-emerald-500' : 'bg-slate-300'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
);

/* ─── Modal Regla ────────────────────────────────────────────────── */
const RuleModal = ({ rule, categories, onSave, onClose }) => {
    const [form, setForm] = useState({
        name: rule?.name || '',
        category_id: rule?.category_id || '',
        module: rule?.module || '',
        percentage: rule?.percentage || '',
        is_active: rule?.is_active ?? true,
        priority: rule?.priority || 0,
    });
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!form.name.trim()) { toast.error('Nombre requerido'); return; }
        if (!form.category_id) { toast.error('Selecciona una categoría'); return; }
        if (!form.percentage || Number(form.percentage) < 0) { toast.error('% inválido'); return; }
        setSaving(true);
        try {
            await onSave({
                ...form,
                category_id: Number(form.category_id),
                percentage: Number(form.percentage),
                priority: Number(form.priority),
                module: form.module || null,
            });
            onClose();
        } catch { toast.error('Error al guardar'); }
        finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between p-5 border-b">
                    <h3 className="font-bold text-slate-800 text-lg">{rule ? 'Editar Regla' : 'Nueva Regla'}</h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre *</label>
                        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                            placeholder="Ej: Celulares 10%" className="w-full p-2.5 border-2 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Categoría *</label>
                        <select value={form.category_id} onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}
                            className="w-full p-2.5 border-2 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white">
                            <option value="">— Seleccionar —</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Módulo</label>
                            <select value={form.module} onChange={e => setForm(p => ({ ...p, module: e.target.value }))}
                                className="w-full p-2.5 border-2 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white">
                                <option value="">Ambos</option>
                                <option value="POS">Solo POS</option>
                                <option value="TALLER">Solo Taller</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Porcentaje % *</label>
                            <input type="number" min="0" max="100" step="0.5" value={form.percentage}
                                onChange={e => setForm(p => ({ ...p, percentage: e.target.value }))}
                                placeholder="10" className="w-full p-2.5 border-2 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                        </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                        <span className="text-sm font-semibold text-slate-700">Regla activa</span>
                        <Toggle value={form.is_active} onChange={v => setForm(p => ({ ...p, is_active: v }))} />
                    </div>
                </div>
                <div className="flex gap-3 p-5 border-t">
                    <button onClick={onClose} className="flex-1 py-2.5 border-2 border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50">
                        {saving ? 'Guardando...' : <><Save size={16} className="inline mr-1" />Guardar</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ─── MAIN ───────────────────────────────────────────────────────── */
const ComisionesTab = () => {
    const hasFlag = useFeatureFlag('sistema_comisiones');

    const [settings, setSettings] = useState(null);
    const [rules, setRules] = useState([]);
    const [userRates, setUserRates] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState(null);
    const [showRuleModal, setShowRuleModal] = useState(false);
    const [editingRule, setEditingRule] = useState(null);
    const [savingUser, setSavingUser] = useState(null);
    const [showGuia, setShowGuia]     = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [sRes, rRes, uRes, cRes] = await Promise.all([
                apiClient.get('/commission-config/settings'),
                apiClient.get('/commission-config/rules'),
                apiClient.get('/commission-config/user-rates'),
                apiClient.get('/categories/'),
            ]);
            setSettings(sRes.data);
            setRules(rRes.data);
            setUserRates(uRes.data);
            setCategories(cRes.data || []);
        } catch { toast.error('Error al cargar configuración de comisiones'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const patchSettings = async (patch) => {
        try {
            const res = await apiClient.patch('/commission-config/settings', patch);
            setSettings(res.data);
            toast.success('Configuración guardada');
        } catch { toast.error('Error al guardar'); }
    };

    const handleSaveRule = async (data) => {
        if (editingRule) {
            await apiClient.put(`/commission-config/rules/${editingRule.id}`, data);
            toast.success('Regla actualizada');
        } else {
            await apiClient.post('/commission-config/rules', data);
            toast.success('Regla creada');
        }
        await load();
    };

    const handleDeleteRule = async (id) => {
        if (!window.confirm('¿Eliminar esta regla?')) return;
        await apiClient.delete(`/commission-config/rules/${id}`);
        toast.success('Regla eliminada');
        await load();
    };

    const handleSaveUserRate = async (u) => {
        setSavingUser(u.user_id);
        try {
            await apiClient.patch(`/commission-config/user-rates/${u.user_id}`, {
                user_id: u.user_id,
                commission_vendor_pct: Number(u.commission_vendor_pct),
                commission_technician_pct: Number(u.commission_technician_pct),
            });
            toast.success(`Tasas de ${u.username} guardadas`);
            setEditingUser(null);
            await load();
        } catch { toast.error('Error al guardar'); }
        finally { setSavingUser(null); }
    };

    if (!hasFlag) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <DollarSign size={48} className="mb-4 opacity-30" />
                <p className="font-semibold text-lg">Sistema de Comisiones no disponible</p>
                <p className="text-sm mt-1">Contacta a soporte para activar esta funcionalidad.</p>
            </div>
        );
    }

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="space-y-8 max-w-4xl">
            {/* ── MASTER SWITCH ── */}
            {/* Botón guía */}
            <div className="flex justify-end">
                <button onClick={() => setShowGuia(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors">
                    <BookOpen size={16} /> Ver Guía
                </button>
            </div>

            <div className={`rounded-2xl border-2 p-6 ${settings?.global_enabled ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${settings?.global_enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                            <DollarSign size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Sistema de Comisiones</h2>
                            <p className="text-slate-500 text-sm">
                                {settings?.global_enabled ? '✅ Activo — se calculan comisiones en ventas y taller' : '⏸ Inactivo — no se generan comisiones'}
                            </p>
                        </div>
                    </div>
                    <Toggle value={settings?.global_enabled || false}
                        onChange={v => patchSettings({ global_enabled: v })} />
                </div>
            </div>

            {settings?.global_enabled && (<>
                {/* ── MÓDULOS ── */}
                <div>
                    <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <Zap size={18} className="text-blue-600" /> Módulos activos
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                            { key: 'pos_module_enabled',              label: 'Ventas POS',          icon: <Tag size={20} />,   desc: 'Comisión al vendedor asignado por cada ítem vendido en el POS' },
                            { key: 'taller_module_enabled',           label: 'Taller — Técnico',    icon: <Wrench size={20} />, desc: 'Comisión al técnico asignado por cada servicio en el taller' },
                            { key: 'taller_vendor_commission_enabled', label: 'Taller — Vendedor',  icon: <Users size={20} />,  desc: 'Comisión adicional a quien creó/facturó la orden (si es diferente al técnico)' },
                        ].map(m => (
                            <div key={m.key} className={`border-2 rounded-xl p-4 flex items-start justify-between transition-all ${settings[m.key] ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                                <div className="flex items-start gap-3">
                                    <div className={`p-2 rounded-lg mt-0.5 ${settings[m.key] ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                                        {m.icon}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{m.label}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{m.desc}</p>
                                    </div>
                                </div>
                                <Toggle value={settings[m.key]}
                                    onChange={v => patchSettings({ [m.key]: v })} />
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                        <strong>Jerarquía de comisión:</strong> si el producto tiene categoría con regla → usa ese %. Si no, usa el % individual del usuario. Si el usuario tampoco tiene % → sin comisión.
                        <br /><span className="text-slate-500 mt-1 inline-block">Los ítems de mano de obra del taller siempre usan el % del técnico directamente.</span>
                    </div>
                </div>

                {/* ── REGLAS POR CATEGORÍA ── */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                            <Tag size={18} className="text-purple-600" /> Reglas por Categoría
                        </h3>
                        <button onClick={() => { setEditingRule(null); setShowRuleModal(true); }}
                            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
                            <Plus size={16} /> Nueva Regla
                        </button>
                    </div>

                    {rules.length === 0 ? (
                        <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400">
                            <Tag size={32} className="mx-auto mb-2 opacity-40" />
                            <p className="font-semibold">Sin reglas configuradas</p>
                            <p className="text-sm mt-1">Agrega reglas para definir el % por categoría de producto.</p>
                        </div>
                    ) : (
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    <tr>
                                        <th className="p-3 text-left">Categoría</th>
                                        <th className="p-3 text-left">Módulo</th>
                                        <th className="p-3 text-center">%</th>
                                        <th className="p-3 text-center">Estado</th>
                                        <th className="p-3 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {rules.map(r => (
                                        <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-3">
                                                <p className="font-semibold text-slate-800">{r.name}</p>
                                                <p className="text-xs text-slate-500">{r.category_name || '—'}</p>
                                            </td>
                                            <td className="p-3 text-slate-600">
                                                {r.module === 'POS' ? '🛒 POS' : r.module === 'TALLER' ? '🔧 Taller' : '🌐 Ambos'}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="inline-block px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg border border-emerald-200">
                                                    {Number(r.percentage).toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <Toggle value={r.is_active}
                                                    onChange={v => apiClient.put(`/commission-config/rules/${r.id}`, { is_active: v }).then(load)} />
                                            </td>
                                            <td className="p-3 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => { setEditingRule(r); setShowRuleModal(true); }}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                                        <Edit2 size={15} />
                                                    </button>
                                                    <button onClick={() => handleDeleteRule(r.id)}
                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* ── TASAS POR USUARIO ── */}
                <div>
                    <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <Users size={18} className="text-indigo-600" /> Tasas por Usuario
                    </h3>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                <tr>
                                    <th className="p-3 text-left">Usuario</th>
                                    <th className="p-3 text-center">% Vendedor (POS)</th>
                                    <th className="p-3 text-center">% Técnico (Taller)</th>
                                    <th className="p-3 text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {userRates.map(u => {
                                    const isEditing = editingUser?.user_id === u.user_id;
                                    const current = isEditing ? editingUser : u;
                                    return (
                                        <tr key={u.user_id} className={`transition-colors ${isEditing ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                                            <td className="p-3">
                                                <p className="font-semibold text-slate-800">{u.full_name || u.username}</p>
                                                <p className="text-xs text-slate-400">{u.role}</p>
                                            </td>
                                            <td className="p-3 text-center">
                                                {isEditing ? (
                                                    <input type="number" min="0" max="100" step="0.5"
                                                        value={current.commission_vendor_pct}
                                                        onChange={e => setEditingUser(p => ({ ...p, commission_vendor_pct: e.target.value }))}
                                                        className="w-20 p-1.5 border-2 border-blue-400 rounded-lg text-center text-sm font-bold outline-none" />
                                                ) : (
                                                    <span className={`inline-block px-2.5 py-1 rounded-lg font-bold text-xs border ${Number(u.commission_vendor_pct) > 0 ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                        {Number(u.commission_vendor_pct).toFixed(1)}%
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 text-center">
                                                {isEditing ? (
                                                    <input type="number" min="0" max="100" step="0.5"
                                                        value={current.commission_technician_pct}
                                                        onChange={e => setEditingUser(p => ({ ...p, commission_technician_pct: e.target.value }))}
                                                        className="w-20 p-1.5 border-2 border-blue-400 rounded-lg text-center text-sm font-bold outline-none" />
                                                ) : (
                                                    <span className={`inline-block px-2.5 py-1 rounded-lg font-bold text-xs border ${Number(u.commission_technician_pct) > 0 ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                        {Number(u.commission_technician_pct).toFixed(1)}%
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 text-center">
                                                {isEditing ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button onClick={() => handleSaveUserRate(editingUser)}
                                                            disabled={savingUser === u.user_id}
                                                            className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50">
                                                            <Save size={15} />
                                                        </button>
                                                        <button onClick={() => setEditingUser(null)}
                                                            className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors">
                                                            <X size={15} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => setEditingUser({ ...u })}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                                        <Edit2 size={15} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </>)}

            {/* ── Modal ── */}
            {showGuia && <GuiaComisiones onClose={() => setShowGuia(false)} />}

            {showRuleModal && (
                <RuleModal
                    rule={editingRule}
                    categories={categories}
                    onSave={handleSaveRule}
                    onClose={() => { setShowRuleModal(false); setEditingRule(null); }}
                />
            )}
        </div>
    );
};

export default ComisionesTab;
