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
    Settings, MessageCircle, Package, Users,
    Save, Loader2, Check, X, Plus, Trash2,
    Building2, Info, Smartphone, Crown
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
function SectionCard({ icon: Icon, title, subtitle, children, color = 'indigo' }) {
    const colors = {
        indigo: 'bg-indigo-50 text-indigo-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        amber: 'bg-amber-50 text-amber-600',
        purple: 'bg-purple-50 text-purple-600',
    };
    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Header de sección */}
            <div className="flex items-center gap-3 p-5 border-b border-slate-50">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
                    <Icon size={20} />
                </div>
                <div>
                    <h2 className="font-bold text-slate-800">{title}</h2>
                    {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
                </div>
            </div>
            <div className="p-5">{children}</div>
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
                    ${value ? 'left-6.5 translate-x-0.5' : 'left-0.5'}
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
    const isOrgOwner = (() => {
        try {
            const orgs = JSON.parse(localStorage.getItem('org_companies') || '[]');
            const current = orgs.find(o => o.is_current) || orgs[0];
            return current?.org_role === 'owner';
        } catch { return false; }
    })();

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
        duo       : { label: 'Dúo',       color: 'emerald', icon: '🤝' },
        multi     : { label: 'Multi',      color: 'indigo',  icon: '🏢' },
        enterprise: { label: 'Enterprise', color: 'purple',  icon: '👑' },
    };
    const planMeta = planLabels[org.plan] || { label: org.plan, color: 'slate', icon: '📦' };

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
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

                {/* ── Header ── */}
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                        <Building2 size={24} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900">{org.name}</h1>
                        <p className="text-sm text-slate-400">Configuración del grupo empresarial</p>
                    </div>
                </div>

                {/* ── Sección: Información del plan ── */}
                <SectionCard
                    icon={Crown}
                    title="Plan actual"
                    subtitle="Límites y estado de tu suscripción"
                    color="amber"
                >
                    <div className="space-y-4">
                        {/* Badge del plan */}
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">{planMeta.icon}</span>
                                <div>
                                    <p className="font-black text-slate-800">Plan {planMeta.label}</p>
                                    <p className="text-xs text-slate-400">
                                        {planInfo?.current_tenants} de {planInfo?.max_tenants} empresas usadas
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-400">Disponibles</p>
                                <p className="text-2xl font-black text-indigo-600">
                                    {planInfo?.slots_available}
                                </p>
                            </div>
                        </div>

                        {/* Barra de uso de empresas */}
                        <div>
                            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                                <span>Empresas usadas</span>
                                <span>{planInfo?.current_tenants}/{planInfo?.max_tenants}</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${
                                        (planInfo?.current_tenants / planInfo?.max_tenants) > 0.8
                                            ? 'bg-amber-500'
                                            : 'bg-indigo-500'
                                    }`}
                                    style={{ width: `${Math.min(100, (planInfo?.current_tenants / planInfo?.max_tenants) * 100)}%` }}
                                />
                            </div>
                        </div>

                        {/* Precio y vencimiento */}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="p-3 bg-slate-50 rounded-xl">
                                <p className="text-slate-400 text-xs mb-1">Precio mensual</p>
                                <p className="font-black text-slate-800">
                                    {planInfo?.plan_price > 0 ? `$${planInfo.plan_price}/mes` : 'Sin costo'}
                                </p>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl">
                                <p className="text-slate-400 text-xs mb-1">Vencimiento</p>
                                <p className={`font-black ${planInfo?.is_expired ? 'text-rose-600' : 'text-slate-800'}`}>
                                    {planInfo?.plan_expires_at
                                        ? new Date(planInfo.plan_expires_at).toLocaleDateString('es-VE')
                                        : 'Sin vencimiento'}
                                </p>
                            </div>
                        </div>

                        {/* Alerta si está vencida */}
                        {planInfo?.is_expired && (
                            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl">
                                <Info size={16} className="text-rose-500 shrink-0" />
                                <p className="text-xs text-rose-700 font-semibold">
                                    Tu plan ha vencido. Contacta al soporte para renovar.
                                </p>
                            </div>
                        )}
                    </div>
                </SectionCard>

                {/* ── Sección: WhatsApp compartido ── */}
                <SectionCard
                    icon={MessageCircle}
                    title="WhatsApp compartido"
                    subtitle="Usa una sola instancia de WhatsApp para todo el grupo"
                    color="emerald"
                >
                    <div className="space-y-4">
                        {/* Toggle principal */}
                        <ToggleSwitch
                            value={waConfig.use_shared_whatsapp}
                            onChange={v => setWaConfig(prev => ({ ...prev, use_shared_whatsapp: v }))}
                            label="Activar WhatsApp compartido"
                            description="Todas las empresas del grupo usarán la misma instancia de Baileys para enviar mensajes a clientes."
                        />

                        {/* Nombre de la instancia — solo visible si está activo */}
                        {waConfig.use_shared_whatsapp && (
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                                    Nombre de la instancia Baileys
                                </label>
                                <div className="relative">
                                    <Smartphone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={waConfig.whatsapp_instance}
                                        onChange={e => setWaConfig(prev => ({ ...prev, whatsapp_instance: e.target.value }))}
                                        placeholder="ej: grupo-rodriguez"
                                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 text-sm outline-none font-mono"
                                    />
                                </div>
                                <p className="text-xs text-slate-400 mt-1">
                                    Debe coincidir exactamente con el nombre de la instancia configurada en el servidor de Baileys.
                                </p>
                            </div>
                        )}

                        {/* Info de cómo funciona */}
                        <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                            <Info size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-emerald-700">
                                Cuando está activo, los mensajes de WhatsApp (notificaciones de ventas, taller, etc.)
                                se enviarán desde el número del grupo en lugar del número individual de cada empresa.
                                Cada mensaje incluirá el nombre de la empresa de origen.
                            </p>
                        </div>

                        {/* Botón guardar WA */}
                        <button
                            onClick={handleSaveWa}
                            disabled={savingWa}
                            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors disabled:opacity-60"
                        >
                            {savingWa ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                            {savingWa ? 'Guardando...' : 'Guardar configuración de WhatsApp'}
                        </button>
                    </div>
                </SectionCard>

                {/* ── Sección: Empresas del grupo ── */}
                <SectionCard
                    icon={Building2}
                    title="Empresas del grupo"
                    subtitle="Empresas que forman parte de esta organización"
                    color="indigo"
                >
                    {planInfo?.current_tenants === 0 ? (
                        <p className="text-slate-400 text-sm text-center py-3">
                            No hay empresas asignadas aún. El administrador puede agregarlas desde el panel SaaS o el bot de Telegram.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {/* Las empresas las muestra el CompanySwitcher */}
                            <p className="text-sm text-slate-500">
                                Tu grupo tiene <span className="font-bold text-indigo-600">{planInfo?.current_tenants}</span> empresa(s) activa(s).
                                Para gestionar las empresas del grupo, utiliza el panel de administración del sistema o el bot de Telegram con el comando{' '}
                                <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">/org agregar {orgId} [schema]</code>.
                            </p>
                        </div>
                    )}
                </SectionCard>

                {/* ── Sección: Miembros con acceso al grupo ── */}
                <SectionCard
                    icon={Users}
                    title="Miembros del grupo"
                    subtitle="Usuarios que pueden cambiar entre empresas"
                    color="purple"
                >
                    <MembersSection orgId={orgId} />
                </SectionCard>

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
            toast.error('Ingresa un email válido');
            return;
        }
        setAdding(true);
        try {
            await apiClient.post(`/organizations/${orgId}/members`, {
                user_email: newEmail.trim(),
                role      : 'manager',
                can_switch: true,
            });
            toast.success('✅ Miembro agregado');
            setNewEmail('');
            fetchMembers();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al agregar miembro');
        } finally {
            setAdding(false);
        }
    };

    const handleRemove = async (memberId) => {
        if (!window.confirm('¿Quitar este miembro del grupo?')) return;
        try {
            await apiClient.delete(`/organizations/${orgId}/members/${memberId}`);
            toast.success('Miembro eliminado');
            fetchMembers();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al eliminar');
        }
    };

    if (loading) return <Loader2 size={20} className="animate-spin text-slate-400 mx-auto" />;

    return (
        <div className="space-y-3">
            {/* Lista de miembros */}
            {members.map(m => (
                <div key={m.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center shrink-0">
                        <span className="text-xs font-black text-purple-600">
                            {m.user_email.charAt(0).toUpperCase()}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">{m.user_email}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
                                ${m.role === 'owner' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500'}`}>
                                {m.role}
                            </span>
                            {m.can_switch && (
                                <span className="text-[10px] text-emerald-600 font-semibold">🔄 puede cambiar</span>
                            )}
                        </div>
                    </div>
                    {m.role !== 'owner' && (
                        <button
                            onClick={() => handleRemove(m.id)}
                            className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            ))}

            {/* Agregar nuevo miembro */}
            <div className="flex gap-2 pt-1">
                <input
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddMember()}
                    placeholder="email@empresa.com"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 text-sm outline-none"
                />
                <button
                    onClick={handleAddMember}
                    disabled={adding}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-60"
                >
                    {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Agregar
                </button>
            </div>
        </div>
    );
}
