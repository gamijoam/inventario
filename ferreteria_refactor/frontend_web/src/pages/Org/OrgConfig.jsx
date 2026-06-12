/**
 * OrgConfig.jsx
 * Sprint 6 — Multi-Empresa
 *
 * Página de configuración del grupo empresarial.
 * Permite gestionar: plan, WhatsApp compartido, miembros y branding.
 *
 * Ruta: /org/config
 * Solo visible para el owner de la organización o superadmin.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Settings, MessageCircle, Users,
    Save, Loader2, Plus, Trash2,
    Building2, Info, Smartphone, Crown, ShieldCheck, CreditCard, CalendarDays,
    UserPlus, CheckCircle, Clock, Mail, Radio, Power, Server
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes auxiliares
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SectionCard — Envoltorio de sección con título e ícono
 */
function SectionCard({ icon: Icon, title, subtitle, children, color = 'indigo', action }) {
    const colors = {
        indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        purple: 'bg-purple-50 text-purple-600 border-purple-100',
        slate: 'bg-slate-50 text-slate-600 border-slate-100',
    };
    return (
        <section className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-start justify-between gap-4 p-4 border-b border-slate-100">
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${colors[color]}`}>
                        <Icon size={18} />
                    </div>
                    <div className="min-w-0">
                        <h2 className="font-black text-slate-900 leading-tight">{title}</h2>
                        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
                    </div>
                </div>
                {action}
            </div>
            <div className="p-4">{children}</div>
        </section>
    );
}

function MetricCard({ icon: Icon, label, value, tone = 'indigo' }) {
    const tones = {
        indigo: 'bg-indigo-50 text-indigo-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        amber: 'bg-amber-50 text-amber-600',
        slate: 'bg-slate-100 text-slate-600',
    };
    return (
        <div className="bg-white p-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${tones[tone]}`}>
                <Icon size={16} />
            </div>
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-1 text-xl font-black text-slate-900">{value}</p>
        </div>
    );
}

/**
 * ToggleSwitch — Interruptor visual para activar/desactivar opciones
 */
function ToggleSwitch({ value, onChange, label, description }) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
                <p className="text-sm font-semibold text-slate-700">{label}</p>
                {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
            </div>
            <button
                onClick={() => onChange(!value)}
                className={`
                    w-12 h-6 rounded-full transition-all duration-200 relative shrink-0 mt-0.5
                    ${value ? 'bg-indigo-600' : 'bg-slate-200'}
                `}
            >
                <span className={`
                    absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200
                    ${value ? 'left-[26px]' : 'left-0.5'}
                `} />
            </button>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export default function OrgConfig() {
    const { user } = useAuth();

    // Datos de la organización
    const [orgId, setOrgId]     = useState(null);
    const [org, setOrg]         = useState(null);
    const [planInfo, setPlanInfo] = useState(null);
    const [loading, setLoading] = useState(true);

    // Detectar si el usuario actual es dueño del grupo (desde localStorage)
    const isOrgOwner = Boolean(user?.is_superuser || user?.is_org_owner || user?.org_role === 'owner');

    // Estado de los formularios de cada sección
    const [waConfig, setWaConfig] = useState({
        use_shared_whatsapp: false,
        whatsapp_instance  : '',
    });
    const [savingWa, setSavingWa] = useState(false);

    // ── Cargar datos de la organización ──────────────────────────────────────
    const loadOrg = useCallback(async () => {
        setLoading(true);
        try {
            // Obtener org_id desde el dashboard consolidado
            const consolidatedRes = await apiClient.get('/organizations/consolidated-mine');
            const id = consolidatedRes.data?.organization_id;
            if (!id || id === 0) {
                setLoading(false);
                return;
            }
            setOrgId(id);

            // Cargar detalle de la org y la info del plan en paralelo
            const [orgRes, planRes] = await Promise.all([
                apiClient.get(`/organizations/${id}`),
                apiClient.get(`/organizations/${id}/plan-info`),
            ]);

            setOrg(orgRes.data);
            setPlanInfo(planRes.data);

            // Sincronizar estado local de WA
            setWaConfig({
                use_shared_whatsapp: orgRes.data.use_shared_whatsapp || false,
                whatsapp_instance  : orgRes.data.whatsapp_instance   || '',
            });
        } catch (err) {
            toast.error('Error al cargar la configuración del grupo');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadOrg(); }, [loadOrg]);

    // ── Guardar configuración de WhatsApp ─────────────────────────────────────
    const handleSaveWa = async () => {
        setSavingWa(true);
        try {
            await apiClient.patch(`/organizations/${orgId}/whatsapp`, {
                use_shared_whatsapp: waConfig.use_shared_whatsapp,
                whatsapp_instance  : waConfig.whatsapp_instance || null,
            });
            toast.success('✅ Configuración de WhatsApp guardada');
            loadOrg();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al guardar la configuración');
        } finally {
            setSavingWa(false);
        }
    };

    // ── Render: cargando ──────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 size={36} className="text-indigo-400 animate-spin" />
            </div>
        );
    }

    // ── Render: sin organización ──────────────────────────────────────────────
    if (!org || !orgId) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="text-center max-w-sm">
                    <Settings size={48} className="text-slate-300 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-slate-700 mb-2">Sin organización</h2>
                    <p className="text-slate-400 text-sm">
                        No perteneces a ningún grupo empresarial.
                        Contacta al administrador del sistema.
                    </p>
                </div>
            </div>
        );
    }

    // ── Labels de plan ────────────────────────────────────────────────────────
    const planLabels = {
        duo       : { label: 'Duo',       color: 'emerald' },
        multi     : { label: 'Multi',      color: 'indigo' },
        enterprise: { label: 'Enterprise', color: 'purple' },
    };
    const planMeta = planLabels[org.plan] || { label: org.plan, color: 'slate' };
    const maxTenants = planInfo?.max_tenants || 0;
    const usedTenants = planInfo?.current_tenants || 0;
    const usagePct = maxTenants > 0 ? Math.min(100, (usedTenants / maxTenants) * 100) : 0;

    // ── Render principal ──────────────────────────────────────────────────────
    // ── Guard: solo el dueño puede ver la configuración completa ─────────────
    if (!isOrgOwner) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="text-center max-w-sm">
                    <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">🔒</span>
                    </div>
                    <h2 className="text-lg font-black text-slate-800 mb-2">Acceso restringido</h2>
                    <p className="text-sm text-slate-500">
                        Solo el dueño de la organización puede ver y editar la configuración del grupo empresarial.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                            <div className="w-11 h-11 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-100 shrink-0">
                                <ShieldCheck size={22} className="text-white" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] font-black uppercase tracking-wide text-indigo-500">Administracion empresarial</p>
                                <h1 className="text-2xl font-black text-slate-950 truncate">{org.name}</h1>
                                <p className="text-sm text-slate-500">Control del grupo, miembros, permisos y servicios compartidos.</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-black border border-indigo-100">Plan {planMeta.label}</span>
                            <span className={`px-3 py-1.5 rounded-lg text-xs font-black border ${planInfo?.is_expired ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                                {planInfo?.is_expired ? 'Vencido' : 'Activo'}
                            </span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 border-t border-slate-200">
                        <MetricCard icon={Building2} label="Empresas" value={`${usedTenants}/${maxTenants || '-'}`} tone="indigo" />
                        <MetricCard icon={CreditCard} label="Disponibles" value={planInfo?.slots_available ?? 0} tone="emerald" />
                        <MetricCard icon={CalendarDays} label="Vence" value={planInfo?.plan_expires_at ? new Date(planInfo.plan_expires_at).toLocaleDateString('es-VE') : 'Sin fecha'} tone="amber" />
                        <MetricCard icon={MessageCircle} label="WhatsApp" value={waConfig.use_shared_whatsapp ? 'Compartido' : 'Individual'} tone="slate" />
                    </div>
                </div>

                {planInfo?.is_expired && (
                    <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg">
                        <Info size={16} className="text-rose-500 shrink-0" />
                        <p className="text-xs text-rose-700 font-semibold">Tu plan ha vencido. Contacta al soporte para renovar.</p>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[1.05fr_0.95fr] items-start">
                    <div className="space-y-4">
                        <SectionCard icon={Crown} title="Plan y capacidad" subtitle="Limites activos de la organizacion" color="amber">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 border border-slate-100 p-4">
                                    <div>
                                        <p className="text-xs font-bold text-slate-400">Uso de empresas</p>
                                        <p className="text-lg font-black text-slate-900">{usedTenants} de {maxTenants || '-'} empresas</p>
                                    </div>
                                    <p className="text-2xl font-black text-indigo-600">{Math.round(usagePct)}%</p>
                                </div>
                                <div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all ${usagePct > 80 ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${usagePct}%` }} />
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-500 mt-2">
                                        <span>{planInfo?.slots_available ?? 0} cupos disponibles</span>
                                        <span>{planInfo?.plan_price > 0 ? `$${planInfo.plan_price}/mes` : 'Sin costo'}</span>
                                    </div>
                                </div>
                            </div>
                        </SectionCard>

                        <SectionCard icon={MessageCircle} title="WhatsApp compartido" subtitle="Mensajeria centralizada del grupo" color="emerald">
                            <div className="space-y-4">
                                <div className={`rounded-lg border p-4 ${waConfig.use_shared_whatsapp ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200'}`}>
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${waConfig.use_shared_whatsapp ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>
                                                {waConfig.use_shared_whatsapp ? <Radio size={18} /> : <Power size={18} />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className={`text-sm font-black ${waConfig.use_shared_whatsapp ? 'text-emerald-900' : 'text-slate-800'}`}>
                                                    {waConfig.use_shared_whatsapp ? 'Compartido activo' : 'Modo individual'}
                                                </p>
                                                <p className={`text-xs mt-0.5 ${waConfig.use_shared_whatsapp ? 'text-emerald-700' : 'text-slate-500'}`}>
                                                    {waConfig.use_shared_whatsapp
                                                        ? 'Todas las empresas usaran una instancia comun para mensajes.'
                                                        : 'Cada empresa mantiene su propia configuracion de WhatsApp.'}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setWaConfig(prev => ({ ...prev, use_shared_whatsapp: !prev.use_shared_whatsapp }))}
                                            className={`w-12 h-6 rounded-full transition-all duration-200 relative shrink-0 mt-1 ${waConfig.use_shared_whatsapp ? 'bg-emerald-600' : 'bg-slate-300'}`}
                                            title={waConfig.use_shared_whatsapp ? 'Desactivar compartido' : 'Activar compartido'}
                                        >
                                            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${waConfig.use_shared_whatsapp ? 'left-[26px]' : 'left-0.5'}`} />
                                        </button>
                                    </div>
                                </div>

                                <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Server size={15} className="text-indigo-500" />
                                        <label className="text-xs font-black uppercase tracking-wide text-slate-500">Instancia Baileys</label>
                                    </div>
                                    <div className="relative">
                                        <Smartphone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            value={waConfig.whatsapp_instance}
                                            onChange={e => setWaConfig(prev => ({ ...prev, whatsapp_instance: e.target.value }))}
                                            placeholder="ej: grupo-rodriguez"
                                            disabled={!waConfig.use_shared_whatsapp}
                                            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 text-sm outline-none font-mono disabled:bg-slate-50 disabled:text-slate-400"
                                        />
                                    </div>
                                    <div className={`flex items-start gap-2 p-3 rounded-lg border ${waConfig.use_shared_whatsapp && !waConfig.whatsapp_instance.trim() ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                                        <Info size={14} className="shrink-0 mt-0.5" />
                                        <p className="text-xs leading-relaxed">
                                            {waConfig.use_shared_whatsapp && !waConfig.whatsapp_instance.trim()
                                                ? 'Activa una instancia valida antes de usar el envio compartido en operaciones reales.'
                                                : 'El nombre debe coincidir con la instancia configurada en el servidor de Baileys.'}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                    <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-emerald-800">
                                        <p className="font-black">Mantiene origen</p>
                                        <p className="mt-1">Los mensajes conservan la empresa que genero la accion.</p>
                                    </div>
                                    <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3 text-indigo-800">
                                        <p className="font-black">Ahorra sesiones</p>
                                        <p className="mt-1">Centraliza envios cuando varias empresas comparten numero.</p>
                                    </div>
                                </div>

                                <button
                                    onClick={handleSaveWa}
                                    disabled={savingWa || (waConfig.use_shared_whatsapp && !waConfig.whatsapp_instance.trim())}
                                    className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {savingWa ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                                    {savingWa ? 'Guardando...' : 'Guardar WhatsApp'}
                                </button>
                            </div>
                        </SectionCard>
                    </div>

                    <div className="space-y-4">
                        <SectionCard icon={Users} title="Miembros y accesos" subtitle="Usuarios que pueden operar entre empresas" color="purple">
                            <MembersSection orgId={orgId} />
                        </SectionCard>

                        <SectionCard icon={Building2} title="Empresas del grupo" subtitle="Capacidad y administracion de tenants" color="indigo">
                            {usedTenants === 0 ? (
                                <p className="text-slate-400 text-sm text-center py-3">No hay empresas asignadas aun.</p>
                            ) : (
                                <div className="space-y-3">
                                    <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-4">
                                        <p className="text-sm text-indigo-900 font-bold">{usedTenants} empresa(s) activa(s)</p>
                                        <p className="text-xs text-indigo-700 mt-1">La entrada a cada empresa se mantiene en el sidebar empresarial.</p>
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        Para asociar nuevas empresas hoy se usa el panel SaaS o el bot de Telegram con:
                                        <code className="block mt-2 bg-slate-100 px-2 py-1.5 rounded-lg text-xs font-mono text-slate-700 overflow-x-auto">/org agregar {orgId} [schema]</code>
                                    </p>
                                </div>
                            )}
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * MembersSection — Lista y gestión de miembros de la organización.
 * Separado para poder refrescarlo independientemente.
 */
function MembersSection({ orgId }) {
    const [members, setMembers]   = useState([]);
    const [loading, setLoading]   = useState(true);
    const [newEmail, setNewEmail] = useState('');
    const [adding, setAdding]     = useState(false);

    const fetchMembers = useCallback(async () => {
        try {
            const res = await apiClient.get(`/organizations/${orgId}/members`);
            setMembers(res.data || []);
        } catch {}
        setLoading(false);
    }, [orgId]);

    useEffect(() => { fetchMembers(); }, [fetchMembers]);

    const handleAddMember = async () => {
        if (!newEmail.trim() || !newEmail.includes('@')) {
            toast.error('Ingresa un email valido');
            return;
        }
        setAdding(true);
        try {
            await apiClient.post(`/organizations/${orgId}/members`, {
                user_email: newEmail.trim(),
                role      : 'manager',
                can_switch: true,
            });
            toast.success('Miembro agregado');
            setNewEmail('');
            fetchMembers();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al agregar miembro');
        } finally {
            setAdding(false);
        }
    };

    const handleRemove = async (memberId) => {
        if (!window.confirm('Quitar este miembro del grupo?')) return;
        try {
            await apiClient.delete(`/organizations/${orgId}/members/${memberId}`);
            toast.success('Miembro eliminado');
            fetchMembers();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al eliminar');
        }
    };

    const owners = members.filter(m => m.role === 'owner').length;
    const managers = members.length - owners;
    const canSwitch = members.filter(m => m.can_switch).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3">
                    <p className="text-[10px] font-black uppercase text-indigo-500">Total</p>
                    <p className="text-xl font-black text-indigo-900">{members.length}</p>
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
                    <p className="text-[10px] font-black uppercase text-amber-600">Owners</p>
                    <p className="text-xl font-black text-amber-900">{owners}</p>
                </div>
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                    <p className="text-[10px] font-black uppercase text-emerald-600">Switch</p>
                    <p className="text-xl font-black text-emerald-900">{canSwitch}</p>
                </div>
            </div>

            {members.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                    <Users size={30} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-black text-slate-700">Aun no hay miembros agregados</p>
                    <p className="text-xs text-slate-500 mt-1">Agrega un gerente para operar entre empresas.</p>
                </div>
            ) : (
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between gap-2">
                        <p className="text-xs font-black uppercase tracking-wide text-slate-500">Miembros</p>
                        <span className="text-[10px] font-black text-slate-400">{managers} gerente{managers !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {members.map(m => {
                            const isOwner = m.role === 'owner';
                            return (
                                <div key={m.id} className="p-3 hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${isOwner ? 'bg-amber-50 border-amber-100' : 'bg-indigo-50 border-indigo-100'}`}>
                                            <span className={`text-xs font-black ${isOwner ? 'text-amber-700' : 'text-indigo-600'}`}>
                                                {(m.user_email || '?').charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-black text-slate-800 truncate">{m.user_email}</p>
                                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${isOwner ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                    {isOwner ? <Crown size={10} /> : <ShieldCheck size={10} />}
                                                    {isOwner ? 'Propietario' : 'Gerente'}
                                                </span>
                                                {m.can_switch ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-black">
                                                        <CheckCircle size={10} /> Puede cambiar
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[10px] bg-slate-50 text-slate-500 border border-slate-100 px-2 py-0.5 rounded-full font-bold">
                                                        <Clock size={10} /> Sin switch
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {m.role !== 'owner' && (
                                            <button
                                                onClick={() => handleRemove(m.id)}
                                                className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                title="Quitar miembro"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-wide text-indigo-600">Agregar gerente</label>
                <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                        <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="email"
                            value={newEmail}
                            onChange={e => setNewEmail(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddMember()}
                            placeholder="email@empresa.com"
                            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-indigo-100 bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 text-sm outline-none"
                        />
                    </div>
                    <button
                        onClick={handleAddMember}
                        disabled={adding}
                        className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-60"
                    >
                        {adding ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                        Agregar
                    </button>
                </div>
            </div>
        </div>
    );
}
