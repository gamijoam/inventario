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
    UserPlus, CheckCircle, Clock, Mail, Radio, Power, Server, Eye, ToggleRight, Store, ExternalLink, Wifi, AlertTriangle, Activity
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
    const [companies, setCompanies] = useState([]);
    const [activity, setActivity] = useState(null);
    const [switchingCompany, setSwitchingCompany] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);

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

            setLoadError(null);
            const [orgRes, planRes, tenantsRes, activityRes] = await Promise.allSettled([
                apiClient.get(`/organizations/${id}`),
                apiClient.get(`/organizations/${id}/plan-info`),
                apiClient.get(`/organizations/${id}/tenants`),
                apiClient.get(`/organizations/${id}/activity?limit=12`),
            ]);

            if (orgRes.status === 'fulfilled') {
                setOrg(orgRes.value.data);
                setWaConfig({
                    use_shared_whatsapp: orgRes.value.data.use_shared_whatsapp || false,
                    whatsapp_instance  : orgRes.value.data.whatsapp_instance   || '',
                });
            } else {
                setOrg({ id, name: consolidatedRes.data?.organization_name || 'Organizacion', plan: 'multi', is_active: true });
                setLoadError('Algunos datos de administracion no pudieron cargarse. Puedes reintentar sin perder la sesion.');
            }

            setPlanInfo(planRes.status === 'fulfilled' ? planRes.value.data : null);
            setCompanies(tenantsRes.status === 'fulfilled' ? (tenantsRes.value.data || []) : []);
            setActivity(activityRes.status === 'fulfilled' ? (activityRes.value.data || null) : { events: [], total_events: 0, members_count: 0, tenants_count: 0 });
            if ([planRes, tenantsRes, activityRes].some(r => r.status === 'rejected')) {
                setLoadError('Una parte del portal no respondio. La pantalla sigue disponible con datos parciales.');
            }
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
    const handleEnterCompany = async (company) => {
        const schema = company.schema_name;
        if (!schema) {
            toast.error('Empresa sin schema configurado');
            return;
        }

        setSwitchingCompany(company.id || company.tenant_id || schema);
        try {
            const r = await apiClient.post('/auth/switch-company', { target_schema: schema });
            if (r.data?.access_token) localStorage.setItem('access_token', r.data.access_token);
            if (r.data?.org_companies) {
                localStorage.setItem('org_companies', JSON.stringify(r.data.org_companies));
                localStorage.setItem('has_multiple_companies', r.data.org_companies.length > 1 ? 'true' : 'false');
            }

            const isQA = window.location.hostname.includes('.qa.');
            const url = isQA
                ? (r.data?.switch_url_qa || `https://${schema}.qa.miinventariofacil.com/#/`)
                : (r.data?.switch_url_prod || r.data?.switch_url || `https://${schema}.miinventariofacil.com/#/`);
            window.location.href = url;
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al entrar a la empresa');
        } finally {
            setSwitchingCompany(null);
        }
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="h-11 w-11 animate-pulse rounded-lg bg-indigo-100" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
                            <div className="h-6 w-64 max-w-full animate-pulse rounded bg-slate-100" />
                        </div>
                    </div>
                </div>
                <div className="grid gap-4 2xl:grid-cols-2">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-52 animate-pulse rounded-lg border border-slate-200 bg-white shadow-sm" />)}
                </div>
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

                {loadError && (
                    <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-2">
                            <Info size={16} className="mt-0.5 shrink-0" />
                            <p className="text-xs font-semibold leading-relaxed">{loadError}</p>
                        </div>
                        <button onClick={loadOrg} className="rounded-lg bg-white px-3 py-2 text-xs font-black text-amber-700 shadow-sm ring-1 ring-amber-100 hover:bg-amber-50">Reintentar</button>
                    </div>
                )}

                {planInfo?.is_expired && (
                    <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg">
                        <Info size={16} className="text-rose-500 shrink-0" />
                        <p className="text-xs text-rose-700 font-semibold">Tu plan ha vencido. Contacta al soporte para renovar.</p>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] items-start">
                    <div className="space-y-4">
                        <SectionCard icon={Crown} title="Licencia y facturacion" subtitle="Plan, vencimiento y capacidad del grupo" color="amber">
                            <BillingSection
                                org={org}
                                planInfo={planInfo}
                                planMeta={planMeta}
                                usedTenants={usedTenants}
                                maxTenants={maxTenants}
                                usagePct={usagePct}
                            />
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

                        <SectionCard icon={Building2} title="Empresas del grupo" subtitle="Estado, licencia y acceso rapido" color="indigo">
                            <CompaniesSection
                                companies={companies}
                                maxTenants={maxTenants}
                                usedTenants={usedTenants}
                                switchingCompany={switchingCompany}
                                onEnter={handleEnterCompany}
                            />
                        </SectionCard>

                        <SectionCard icon={Activity} title="Actividad reciente" subtitle="Eventos clave del grupo empresarial" color="slate">
                            <ActivitySection activity={activity} />
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ActivitySection({ activity }) {
    const events = activity?.events || [];
    const severityStyles = {
        success: 'border-emerald-100 bg-emerald-50 text-emerald-700',
        warning: 'border-amber-100 bg-amber-50 text-amber-700',
        danger : 'border-rose-100 bg-rose-50 text-rose-700',
        info   : 'border-indigo-100 bg-indigo-50 text-indigo-700',
    };

    const formatDate = (value) => {
        if (!value) return 'Sin fecha';
        try {
            return new Date(value).toLocaleString('es-VE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return 'Sin fecha';
        }
    };

    if (!activity) {
        return (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-center">
                <Loader2 size={24} className="mx-auto mb-2 animate-spin text-slate-300" />
                <p className="text-sm font-bold text-slate-500">Cargando actividad...</p>
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <Activity size={30} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-black text-slate-700">Sin actividad registrada</p>
                <p className="mt-1 text-xs text-slate-500">Cuando el grupo tenga cambios importantes, apareceran aqui.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] font-black uppercase text-slate-400">Eventos</p>
                    <p className="text-xl font-black text-slate-900">{activity.total_events}</p>
                </div>
                <div className="rounded-lg border border-purple-100 bg-purple-50 p-3">
                    <p className="text-[10px] font-black uppercase text-purple-500">Miembros</p>
                    <p className="text-xl font-black text-purple-900">{activity.members_count}</p>
                </div>
                <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3">
                    <p className="text-[10px] font-black uppercase text-indigo-500">Empresas</p>
                    <p className="text-xl font-black text-indigo-900">{activity.tenants_count}</p>
                </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white">
                <div className="divide-y divide-slate-100">
                    {events.map((event, index) => (
                        <div key={`${event.type}-${event.occurred_at || index}-${index}`} className="flex gap-3 p-3">
                            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${severityStyles[event.severity] || severityStyles.info}`}>
                                <Activity size={14} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-black text-slate-900">{event.title}</p>
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-500">{event.type}</span>
                                </div>
                                <p className="mt-0.5 text-xs font-semibold leading-relaxed text-slate-500">{event.detail}</p>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-400">
                                    <span>{formatDate(event.occurred_at)}</span>
                                    {event.actor && <span className="truncate">por {event.actor}</span>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function BillingSection({ org, planInfo, planMeta, usedTenants, maxTenants, usagePct }) {
    const price = Number(planInfo?.plan_price || 0);
    const daysLeft = planInfo?.days_left;
    const expiresAt = planInfo?.plan_expires_at ? new Date(planInfo.plan_expires_at) : null;
    const isExpired = Boolean(planInfo?.is_expired || org?.is_active === false);
    const nearLimit = maxTenants > 0 && usagePct >= 80;
    const nearExpiry = typeof daysLeft === 'number' && daysLeft <= 7 && !isExpired;
    const statusTone = isExpired
        ? 'border-rose-100 bg-rose-50 text-rose-700'
        : nearExpiry
            ? 'border-amber-100 bg-amber-50 text-amber-700'
            : 'border-emerald-100 bg-emerald-50 text-emerald-700';
    const statusLabel = isExpired ? 'Requiere atencion' : nearExpiry ? 'Por vencer' : 'Al dia';

    const formatDate = (value) => {
        if (!value) return 'Sin vencimiento';
        try {
            return value.toLocaleDateString('es-VE');
        } catch {
            return 'Sin vencimiento';
        }
    };

    return (
        <div className="space-y-4">
            <div className={`rounded-lg border p-4 ${statusTone}`}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/80">
                            {isExpired ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
                        </div>
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-wide opacity-80">Estado de licencia</p>
                            <p className="text-lg font-black">{statusLabel}</p>
                            <p className="mt-0.5 text-xs font-semibold opacity-80">
                                {isExpired
                                    ? 'El plan debe renovarse para mantener acceso completo.'
                                    : expiresAt
                                        ? `${daysLeft ?? '-'} dia(s) restantes antes del vencimiento.`
                                        : 'Este grupo no tiene fecha de vencimiento configurada.'}
                            </p>
                        </div>
                    </div>
                    <div className="rounded-lg bg-white/80 px-4 py-3 text-right shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-wide opacity-70">Plan actual</p>
                        <p className="text-xl font-black">{planInfo?.plan_label || planMeta.label}</p>
                    </div>
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center gap-2 text-slate-500">
                        <CreditCard size={15} />
                        <p className="text-[10px] font-black uppercase tracking-wide">Mensualidad</p>
                    </div>
                    <p className="text-2xl font-black text-slate-950">{price > 0 ? `$${price.toFixed(2)}` : '$0.00'}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{price > 0 ? 'Monto configurado del plan' : 'Sin precio configurado'}</p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center gap-2 text-slate-500">
                        <CalendarDays size={15} />
                        <p className="text-[10px] font-black uppercase tracking-wide">Vencimiento</p>
                    </div>
                    <p className="text-lg font-black text-slate-950">{formatDate(expiresAt)}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{expiresAt ? `${daysLeft ?? '-'} dia(s) disponibles` : 'Renovacion manual'}</p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center gap-2 text-slate-500">
                        <Building2 size={15} />
                        <p className="text-[10px] font-black uppercase tracking-wide">Capacidad</p>
                    </div>
                    <p className="text-lg font-black text-slate-950">{usedTenants} de {maxTenants || '-'} empresas</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{planInfo?.slots_available ?? 0} cupos libres</p>
                </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-black text-slate-900">Uso del plan</p>
                        <p className="text-xs font-semibold text-slate-500">Controla si el grupo puede sumar mas empresas.</p>
                    </div>
                    <p className={`rounded-full px-2.5 py-1 text-xs font-black ${nearLimit ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'}`}>{Math.round(usagePct)}%</p>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full transition-all ${nearLimit ? 'bg-amber-500' : 'bg-indigo-600'}`} style={{ width: `${usagePct}%` }} />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <p className="text-[10px] font-black uppercase text-slate-400">Descripcion</p>
                        <p className="mt-1 text-sm font-bold text-slate-700">{planInfo?.plan_description || 'Sin descripcion configurada'}</p>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <p className="text-[10px] font-black uppercase text-slate-400">Organizacion</p>
                        <p className="mt-1 truncate text-sm font-bold text-slate-700">{planInfo?.organization_name || org?.name}</p>
                    </div>
                </div>
            </div>

            {(nearLimit || nearExpiry || isExpired) && (
                <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-amber-800">
                    <div className="flex items-start gap-2">
                        <Info size={15} className="mt-0.5 shrink-0" />
                        <p className="text-xs font-semibold leading-relaxed">
                            {isExpired
                                ? 'Prioridad alta: renovar o ajustar el plan antes de seguir creando empresas.'
                                : nearExpiry
                                    ? 'Este plan esta cerca de vencer. Conviene coordinar renovacion antes de la fecha limite.'
                                    : 'El grupo esta cerca del limite de empresas. Si vas a crecer, prepara una ampliacion del plan.'}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

function CompaniesSection({ companies, maxTenants, usedTenants, switchingCompany, onEnter }) {
    const activeCompanies = companies.filter(c => c.is_active !== false).length;
    const suspendedCompanies = companies.length - activeCompanies;
    const slotsLeft = maxTenants > 0 ? Math.max(0, maxTenants - usedTenants) : 0;
    const atLimit = maxTenants > 0 && usedTenants >= maxTenants;

    const formatDate = (value) => {
        if (!value) return 'Sin fecha';
        try {
            return new Date(value).toLocaleDateString('es-VE');
        } catch {
            return 'Sin fecha';
        }
    };

    return (
        <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3">
                    <p className="text-[10px] font-black uppercase text-indigo-500">Usadas</p>
                    <p className="text-xl font-black text-indigo-900">{usedTenants}/{maxTenants || '-'}</p>
                </div>
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                    <p className="text-[10px] font-black uppercase text-emerald-600">Activas</p>
                    <p className="text-xl font-black text-emerald-900">{activeCompanies}</p>
                </div>
                <div className={`rounded-lg border p-3 ${atLimit ? 'border-amber-100 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
                    <p className={`text-[10px] font-black uppercase ${atLimit ? 'text-amber-600' : 'text-slate-500'}`}>Disponibles</p>
                    <p className={`text-xl font-black ${atLimit ? 'text-amber-900' : 'text-slate-800'}`}>{slotsLeft}</p>
                </div>
            </div>

            {atLimit && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 p-3 text-amber-800">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    <p className="text-xs font-semibold leading-relaxed">La organizacion llego al limite del plan. Para agregar otra empresa hace falta ampliar capacidad.</p>
                </div>
            )}

            {companies.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                    <Building2 size={30} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-black text-slate-700">No hay empresas asignadas aun</p>
                    <p className="mt-1 text-xs text-slate-500">Cuando se asocien empresas al grupo, apareceran aqui.</p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
                        <p className="text-xs font-black uppercase tracking-wide text-slate-500">Empresas conectadas</p>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {companies.map(company => {
                            const id = company.id || company.tenant_id || company.schema_name;
                            const isSwitching = switchingCompany === id;
                            const active = company.is_active !== false;

                            return (
                                <div key={id} className="p-3 transition-colors hover:bg-slate-50">
                                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                                        <div className="flex min-w-0 flex-1 items-center gap-3">
                                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${active ? 'border-indigo-100 bg-indigo-50 text-indigo-600' : 'border-slate-200 bg-slate-100 text-slate-400'}`}>
                                                <Store size={17} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="truncate text-sm font-black text-slate-900">{company.name || company.schema_name}</p>
                                                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${active ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-rose-100 bg-rose-50 text-rose-700'}`}>
                                                        {active ? 'Activa' : 'Suspendida'}
                                                    </span>
                                                </div>
                                                <p className="mt-0.5 truncate font-mono text-[11px] font-semibold text-slate-400">{company.schema_name}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 xl:w-[230px]">
                                            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                                                <p className="text-[10px] font-black uppercase text-slate-400">Licencia</p>
                                                <p className="truncate text-xs font-black text-slate-700">{company.license_type || 'N/A'}</p>
                                            </div>
                                            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                                                <p className="text-[10px] font-black uppercase text-slate-400">Trial</p>
                                                <p className="truncate text-xs font-black text-slate-700">{formatDate(company.trial_ends_at)}</p>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => onEnter(company)}
                                            disabled={!active || isSwitching}
                                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 xl:w-[92px]"
                                        >
                                            {isSwitching ? <Wifi size={14} className="animate-pulse" /> : <ExternalLink size={14} />}
                                            Entrar
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
                <p className="font-bold text-slate-700">Alta de empresas</p>
                <p className="mt-1">Por ahora la asociacion o retiro de empresas se mantiene en superadmin/bot para proteger plan y facturacion.</p>
                {suspendedCompanies > 0 && <p className="mt-1 font-semibold text-rose-600">Hay {suspendedCompanies} empresa(s) suspendida(s) en el grupo.</p>}
            </div>
        </div>
    );
}

/**
 * MembersSection ? Lista y gesti?n de miembros de la organizaci?n.
 * Separado para poder refrescarlo independientemente.
 */
function MembersSection({ orgId }) {
    const [members, setMembers]   = useState([]);
    const [loading, setLoading]   = useState(true);
    const [newEmail, setNewEmail] = useState('');
    const [newRole, setNewRole] = useState('manager');
    const [newCanSwitch, setNewCanSwitch] = useState(true);
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
                role      : newRole,
                can_switch: newCanSwitch,
            });
            toast.success('Miembro agregado');
            setNewEmail('');
            setNewRole('manager');
            setNewCanSwitch(true);
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
    const managers = members.filter(m => m.role === 'manager').length;
    const viewers = members.filter(m => m.role === 'viewer').length;
    const canSwitch = members.filter(m => m.can_switch).length;
    const roleCards = [
        { id: 'manager', label: 'Manager', icon: ShieldCheck, desc: 'Opera entre empresas y ve datos de gestion.', tone: 'indigo' },
        { id: 'viewer', label: 'Viewer', icon: Eye, desc: 'Consulta informacion sin administrar accesos.', tone: 'slate' },
        { id: 'owner', label: 'Owner', icon: Crown, desc: 'Control total del grupo empresarial.', tone: 'amber' },
    ];
    const roleMeta = {
        owner: { label: 'Owner', icon: Crown, className: 'bg-amber-50 text-amber-700 border-amber-100' },
        manager: { label: 'Manager', icon: ShieldCheck, className: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
        viewer: { label: 'Viewer', icon: Eye, className: 'bg-slate-100 text-slate-600 border-slate-200' },
    };

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
                        <span className="text-[10px] font-black text-slate-400">{managers} manager{managers !== 1 ? 's' : ''} / {viewers} viewer{viewers !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {members.map(m => {
                            const meta = roleMeta[m.role] || roleMeta.viewer;
                            const RoleIcon = meta.icon;
                            return (
                                <div key={m.id} className="p-3 hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border bg-white border-slate-200">
                                            <span className="text-xs font-black text-slate-700">
                                                {(m.user_email || '?').charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-black text-slate-800 truncate">{m.user_email}</p>
                                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${meta.className}`}>
                                                    <RoleIcon size={10} /> {meta.label}
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

            <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wide text-indigo-600">Nuevo acceso</label>
                        <p className="text-xs font-semibold text-indigo-700/80">Invita una cuenta al portal empresarial.</p>
                    </div>
                    <UserPlus size={18} className="text-indigo-500" />
                </div>
                <div className="relative">
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
                <div className="grid gap-2 sm:grid-cols-3">
                    {roleCards.map(role => {
                        const Icon = role.icon;
                        const active = newRole === role.id;
                        return (
                            <button
                                key={role.id}
                                type="button"
                                onClick={() => setNewRole(role.id)}
                                className={`rounded-lg border p-3 text-left transition-all ${active ? 'border-indigo-300 bg-white shadow-sm ring-2 ring-indigo-100' : 'border-indigo-100 bg-indigo-50/50 hover:bg-white'}`}
                            >
                                <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                                    <Icon size={15} className={role.tone === 'amber' ? 'text-amber-600' : role.tone === 'slate' ? 'text-slate-500' : 'text-indigo-600'} />
                                    {role.label}
                                </div>
                                <p className="mt-1 text-[11px] font-semibold leading-snug text-slate-500">{role.desc}</p>
                            </button>
                        );
                    })}
                </div>
                <button
                    type="button"
                    onClick={() => setNewCanSwitch(v => !v)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${newCanSwitch ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600'}`}
                >
                    <span className="flex items-center gap-2 text-sm font-black">
                        <ToggleRight size={16} /> Puede cambiar entre empresas
                    </span>
                    <span className={`h-6 w-11 rounded-full p-0.5 transition-colors ${newCanSwitch ? 'bg-emerald-600' : 'bg-slate-300'}`}>
                        <span className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${newCanSwitch ? 'translate-x-5' : 'translate-x-0'}`} />
                    </span>
                </button>
                <button
                    onClick={handleAddMember}
                    disabled={adding}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
                >
                    {adding ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                    Agregar acceso
                </button>
            </div>
        </div>
    );
}
