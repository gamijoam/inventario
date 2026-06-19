import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Activity,
    AlertTriangle,
    Bug,
    Building2,
    CheckCircle2,
    ChevronRight,
    Clock,
    Copy,
    Download,
    Filter,
    Globe2,
    RefreshCw,
    Search,
    ServerCrash,
    ShieldAlert,
    WifiOff,
    Wrench,
    XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getSystemHealth } from '../api/systemHealth';
import type { HealthKind, HealthSeverity, SystemHealthEvent, SystemHealthGroup, SystemHealthResponse, SystemHealthTenantCheck, SystemHealthTenantOption } from '../api/systemHealth';

type KindFilter = HealthKind | 'all';
type SeverityTone = 'red' | 'amber' | 'violet' | 'emerald';
type TenantStatus = 'healthy' | 'warning' | 'critical';
type DiagnosisPriority = 'critical' | 'warning' | 'info';

interface TenantDiagnosis {
    id: string;
    priority: DiagnosisPriority;
    title: string;
    action: string;
    impact: string;
}

interface TenantHealth {
    option: SystemHealthTenantOption;
    status: TenantStatus;
    total: number;
    critical: number;
    error: number;
    warning: number;
    api: number;
    network: number;
    client: number;
    lastSeen: string | null;
    routes: string[];
    events: SystemHealthEvent[];
    checks: SystemHealthTenantCheck[];
    checkSummary: { critical: number; warning: number; ok: number };
}

const kindLabels: Record<HealthKind, string> = {
    CLIENT_ERROR: 'Pantalla',
    API_ERROR: 'API',
    NETWORK_ERROR: 'Red',
};

const severityConfig: Record<HealthSeverity, { label: string; tone: SeverityTone; className: string }> = {
    critical: { label: 'Critico', tone: 'red', className: 'border-red-200 bg-red-50 text-red-700' },
    error: { label: 'Error', tone: 'violet', className: 'border-violet-200 bg-violet-50 text-violet-700' },
    warning: { label: 'Alerta', tone: 'amber', className: 'border-amber-200 bg-amber-50 text-amber-700' },
};

const tenantStatusConfig: Record<TenantStatus, { label: string; helper: string; className: string; dot: string; icon: React.ReactNode }> = {
    healthy: {
        label: 'Estable',
        helper: 'Sin eventos en la ventana',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        dot: 'bg-emerald-500',
        icon: <CheckCircle2 size={16} />,
    },
    warning: {
        label: 'Revisar',
        helper: 'Errores o red recientes',
        className: 'border-amber-200 bg-amber-50 text-amber-700',
        dot: 'bg-amber-500',
        icon: <AlertTriangle size={16} />,
    },
    critical: {
        label: 'Critico',
        helper: 'API 5xx o repetidos',
        className: 'border-red-200 bg-red-50 text-red-700',
        dot: 'bg-red-500',
        icon: <XCircle size={16} />,
    },
};

const hourOptions = [
    { label: '6h', value: 6 },
    { label: '24h', value: 24 },
    { label: '7 dias', value: 168 },
    { label: '30 dias', value: 720 },
];

const fmtTime = (iso: string | null) => {
    if (!iso) return 'Sin fecha';
    return new Date(iso).toLocaleString('es-VE', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
};

const timeAgo = (iso: string | null) => {
    if (!iso) return 'Nunca';
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (min < 1) return 'Ahora';
    if (min < 60) return `hace ${min}m`;
    if (hours < 24) return `hace ${hours}h`;
    return `hace ${days}d`;
};

const truncate = (value: string, size = 120) => value.length > size ? `${value.slice(0, size)}...` : value;

const metricTone: Record<SeverityTone, string> = {
    red: 'border-red-200 bg-red-50 text-red-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const MetricCard = ({ label, value, icon, tone, helper }: {
    label: string;
    value: number;
    icon: React.ReactNode;
    tone: SeverityTone;
    helper: string;
}) => (
    <div className={`rounded-2xl border p-4 shadow-sm ${metricTone[tone]}`}>
        <div className="flex items-start justify-between gap-3">
            <div>
                <p className="text-[11px] font-black uppercase tracking-widest opacity-70">{label}</p>
                <p className="mt-2 text-3xl font-black tracking-tight">{value}</p>
            </div>
            <div className="rounded-xl bg-white/70 p-2 shadow-sm">{icon}</div>
        </div>
        <p className="mt-3 text-xs font-semibold opacity-75">{helper}</p>
    </div>
);

const KindBadge = ({ kind }: { kind: HealthKind }) => {
    const styles: Record<HealthKind, string> = {
        CLIENT_ERROR: 'border-violet-200 bg-violet-50 text-violet-700',
        API_ERROR: 'border-blue-200 bg-blue-50 text-blue-700',
        NETWORK_ERROR: 'border-amber-200 bg-amber-50 text-amber-700',
    };
    return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${styles[kind]}`}>{kindLabels[kind]}</span>;
};

const SeverityBadge = ({ severity }: { severity: HealthSeverity }) => (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${severityConfig[severity].className}`}>
        {severityConfig[severity].label}
    </span>
);

const StatusPill = ({ status }: { status: TenantStatus }) => {
    const config = tenantStatusConfig[status];
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black ${config.className}`}>
            {config.icon}{config.label}
        </span>
    );
};

const CheckStatusBadge = ({ check }: { check: SystemHealthTenantCheck }) => {
    if (check.status === 'ok') {
        return <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700"><CheckCircle2 size={13} />OK</span>;
    }
    if (check.severity === 'critical') {
        return <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-black text-red-700"><XCircle size={13} />Critico</span>;
    }
    return <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-700"><AlertTriangle size={13} />Revisar</span>;
};

const diagnosisTone: Record<DiagnosisPriority, string> = {
    critical: 'border-red-200 bg-red-50 text-red-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    info: 'border-blue-200 bg-blue-50 text-blue-800',
};

const buildTenantDiagnosis = (tenant: TenantHealth): TenantDiagnosis[] => {
    const recommendations: TenantDiagnosis[] = [];
    const failingChecks = tenant.checks.filter(check => check.status !== 'ok');

    failingChecks.forEach(check => {
        if (check.id === 'exchange_rate_default') {
            recommendations.push({
                id: check.id,
                priority: check.severity === 'critical' ? 'critical' : 'warning',
                title: 'Revisar tasa activa',
                action: 'Entrar a Configuracion > Monedas y activar una tasa default con valor mayor a cero.',
                impact: 'Evita precios en bolivares vacios o conversiones incorrectas en POS y catalogo.',
            });
            return;
        }
        if (check.id === 'cash_register_bridge') {
            recommendations.push({
                id: check.id,
                priority: 'warning',
                title: 'Completar ID de caja',
                action: 'Asignar hardware_client_id a cada caja activa desde Gestion de Cajas.',
                impact: 'Reduce errores de impresion y enruta tickets al equipo correcto.',
            });
            return;
        }
        if (check.id === 'serialized_stock_sync') {
            recommendations.push({
                id: check.id,
                priority: 'warning',
                title: 'Sincronizar stock serializado',
                action: 'Comparar el detalle del check y cuadrar stock del producto contra IMEIs AVAILABLE.',
                impact: 'Evita que el POS diga sin disponibilidad cuando hay IMEIs, o que venda equipos inexistentes.',
            });
            return;
        }
        if (check.id === 'available_imei_duplicates') {
            recommendations.push({
                id: check.id,
                priority: 'critical',
                title: 'Resolver IMEIs duplicados',
                action: 'Revisar los seriales duplicados y dejar un unico registro disponible por IMEI.',
                impact: 'Previene ventas dobles del mismo equipo y garantias con serial repetido.',
            });
            return;
        }
        if (check.id === 'negative_stock') {
            recommendations.push({
                id: check.id,
                priority: 'critical',
                title: 'Corregir stock negativo',
                action: 'Auditar movimientos recientes del producto y ajustar inventario desde Kardex o correccion controlada.',
                impact: 'Evita descuadres contables y errores de disponibilidad.',
            });
            return;
        }
        recommendations.push({
            id: check.id,
            priority: check.severity === 'critical' ? 'critical' : 'warning',
            title: check.title,
            action: check.description,
            impact: 'Requiere revision operativa antes de cerrar el diagnostico.',
        });
    });

    if (tenant.critical > 0) {
        recommendations.push({
            id: 'critical_events',
            priority: 'critical',
            title: 'Atender errores criticos recientes',
            action: 'Abrir eventos recientes, copiar la firma y revisar la ruta/status que se repite.',
            impact: 'Puede estar bloqueando ventas, compras o pantallas clave del tenant.',
        });
    }

    if (tenant.error > 0 && tenant.critical === 0) {
        recommendations.push({
            id: 'ui_events',
            priority: 'warning',
            title: 'Revisar errores visuales',
            action: 'Filtrar por Pantalla y reproducir las rutas reportadas por el tenant.',
            impact: 'Mejora estabilidad percibida y reduce tickets de soporte.',
        });
    }

    if (recommendations.length === 0) {
        recommendations.push({
            id: 'healthy',
            priority: 'info',
            title: 'Sin acciones urgentes',
            action: 'Mantener monitoreo y revisar de nuevo si aparecen eventos o checks con alerta.',
            impact: 'El tenant luce estable en la ventana seleccionada.',
        });
    }

    return recommendations.sort((a, b) => {
        const rank: Record<DiagnosisPriority, number> = { critical: 0, warning: 1, info: 2 };
        return rank[a.priority] - rank[b.priority];
    });
};

const EventRow = ({ event }: { event: SystemHealthEvent }) => {
    const [open, setOpen] = useState(false);
    const target = event.route || event.url || 'Sin ruta';

    const copySignature = async () => {
        await navigator.clipboard.writeText(event.signature);
        toast.success('Firma copiada');
    };

    return (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md">
            <button type="button" onClick={() => setOpen(prev => !prev)} className="grid w-full grid-cols-1 gap-4 p-4 text-left lg:grid-cols-[1.2fr_1.8fr_auto]">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <SeverityBadge severity={event.severity} />
                        <KindBadge kind={event.kind} />
                        {event.status && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">HTTP {event.status}</span>}
                    </div>
                    <p className="mt-3 truncate text-sm font-black text-slate-900">{event.tenant_name}</p>
                    <p className="font-mono text-[11px] font-semibold text-slate-400">{event.tenant_schema}</p>
                </div>

                <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-bold leading-6 text-slate-800">{event.message}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                        <span className="inline-flex items-center gap-1"><Globe2 size={12} />{truncate(target, 80)}</span>
                        <span className="inline-flex items-center gap-1"><Bug size={12} />{event.source}</span>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-end">
                    <span className="text-xs font-black text-slate-500">{timeAgo(event.timestamp)}</span>
                    <span className="font-mono text-[11px] font-bold text-slate-400">#{event.audit_id}</span>
                </div>
            </button>

            {open && (
                <div className="border-t border-slate-100 bg-slate-50 px-4 py-4">
                    <div className="grid gap-3 text-xs md:grid-cols-2 xl:grid-cols-4">
                        <div>
                            <p className="font-black uppercase tracking-widest text-slate-400">Ruta</p>
                            <p className="mt-1 break-all font-semibold text-slate-700">{target}</p>
                        </div>
                        <div>
                            <p className="font-black uppercase tracking-widest text-slate-400">Metodo / origen</p>
                            <p className="mt-1 font-semibold text-slate-700">{event.method || '-'} - {event.source}</p>
                        </div>
                        <div>
                            <p className="font-black uppercase tracking-widest text-slate-400">Usuario / IP</p>
                            <p className="mt-1 font-semibold text-slate-700">Usuario {event.user_id || '-'} - {event.ip_address || '-'}</p>
                        </div>
                        <div>
                            <p className="font-black uppercase tracking-widest text-slate-400">Firma</p>
                            <button type="button" onClick={copySignature} className="mt-1 inline-flex items-center gap-2 font-mono font-black text-indigo-600 hover:text-indigo-800">
                                {event.signature}<Copy size={12} />
                            </button>
                        </div>
                    </div>
                    {Object.keys(event.context || {}).length > 0 && (
                        <pre className="mt-4 max-h-36 overflow-auto rounded-xl border border-slate-200 bg-white p-3 text-[11px] font-semibold text-slate-600">
                            {JSON.stringify(event.context, null, 2)}
                        </pre>
                    )}
                </div>
            )}
        </div>
    );
};

const GroupCard = ({ group }: { group: SystemHealthGroup }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={group.severity} />
                    <KindBadge kind={group.kind} />
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">{group.count} veces</span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm font-black text-slate-900">{group.message}</p>
                <p className="mt-1 truncate text-xs font-semibold text-slate-500">{group.route || group.source}</p>
            </div>
            <div className="rounded-xl bg-indigo-50 px-3 py-2 text-center text-indigo-700">
                <p className="text-lg font-black">{group.tenant_count}</p>
                <p className="text-[10px] font-black uppercase tracking-widest">tenants</p>
            </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
            {group.tenants.slice(0, 4).map(tenant => (
                <span key={tenant.schema_name} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">{tenant.name}</span>
            ))}
            {group.tenants.length > 4 && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">+{group.tenants.length - 4}</span>}
        </div>
        <p className="mt-3 text-[11px] font-semibold text-slate-400">Ultimo: {fmtTime(group.last_seen)} - Firma {group.signature}</p>
    </div>
);

const TenantHealthCard = ({ tenant, active, onSelect }: { tenant: TenantHealth; active: boolean; onSelect: () => void }) => {
    const config = tenantStatusConfig[tenant.status];
    return (
        <button
            type="button"
            onClick={onSelect}
            className={`group rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md ${active ? 'border-indigo-300 ring-4 ring-indigo-100' : 'border-slate-200'}`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${config.dot}`} />
                        <p className="truncate text-sm font-black text-slate-900">{tenant.option.name}</p>
                    </div>
                    <p className="mt-1 truncate font-mono text-[11px] font-semibold text-slate-400">{tenant.option.schema_name}</p>
                </div>
                <ChevronRight size={17} className={`shrink-0 text-slate-300 transition group-hover:text-indigo-500 ${active ? 'text-indigo-500' : ''}`} />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
                <StatusPill status={tenant.status} />
                <span className="text-xs font-black text-slate-500">{tenant.total} eventos</span>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs font-black text-slate-500">
                <span>Checks</span>
                <span className={tenant.checkSummary.critical ? 'text-red-700' : tenant.checkSummary.warning ? 'text-amber-700' : 'text-emerald-700'}>
                    {tenant.checkSummary.critical} crit. / {tenant.checkSummary.warning} rev.
                </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-red-50 px-2 py-2 text-red-700">
                    <p className="text-base font-black">{tenant.critical}</p>
                    <p className="text-[10px] font-black uppercase">Crit.</p>
                </div>
                <div className="rounded-xl bg-violet-50 px-2 py-2 text-violet-700">
                    <p className="text-base font-black">{tenant.error}</p>
                    <p className="text-[10px] font-black uppercase">UI</p>
                </div>
                <div className="rounded-xl bg-amber-50 px-2 py-2 text-amber-700">
                    <p className="text-base font-black">{tenant.warning}</p>
                    <p className="text-[10px] font-black uppercase">Red</p>
                </div>
            </div>
            <p className="mt-3 text-xs font-bold text-slate-500">Ultimo evento: {timeAgo(tenant.lastSeen)}</p>
        </button>
    );
};

const TenantDetailPanel = ({ tenant }: { tenant: TenantHealth | null }) => {
    if (!tenant) {
        return (
            <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center">
                <div>
                    <Building2 className="mx-auto h-10 w-10 text-slate-300" />
                    <p className="mt-3 text-base font-black text-slate-800">Selecciona un tenant</p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">El panel mostrara rutas afectadas, eventos recientes y severidad.</p>
                </div>
            </div>
        );
    }

    const topEvents = tenant.events.slice(0, 6);
    const diagnosis = buildTenantDiagnosis(tenant);

    return (
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Detalle por tenant</p>
                        <h3 className="mt-1 text-xl font-black text-slate-900">{tenant.option.name}</h3>
                        <p className="font-mono text-xs font-semibold text-slate-400">{tenant.option.schema_name}</p>
                    </div>
                    <StatusPill status={tenant.status} />
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-500">{tenantStatusConfig[tenant.status].helper}. Ultimo evento: {fmtTime(tenant.lastSeen)}.</p>
            </div>

            <div className="grid gap-3 p-5 sm:grid-cols-4">
                <MetricMini label="Total" value={tenant.total} className="bg-slate-50 text-slate-700" />
                <MetricMini label="API" value={tenant.api} className="bg-blue-50 text-blue-700" />
                <MetricMini label="Pantalla" value={tenant.client} className="bg-violet-50 text-violet-700" />
                <MetricMini label="Red" value={tenant.network} className="bg-amber-50 text-amber-700" />
            </div>

            <div className="border-t border-slate-100 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h4 className="inline-flex items-center gap-2 text-sm font-black text-slate-900"><Wrench size={16} /> Diagnostico recomendado</h4>
                        <p className="text-xs font-semibold text-slate-500">Acciones sugeridas segun checks y eventos capturados.</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">{diagnosis.length} acciones</span>
                </div>
                <div className="mt-3 space-y-3">
                    {diagnosis.slice(0, 5).map(item => (
                        <div key={item.id} className={`rounded-2xl border p-4 ${diagnosisTone[item.priority]}`}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-black">{item.title}</p>
                                <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-black uppercase">{item.priority === 'critical' ? 'Prioridad alta' : item.priority === 'warning' ? 'Revisar' : 'Informativo'}</span>
                            </div>
                            <p className="mt-2 text-xs font-bold leading-5">{item.action}</p>
                            <p className="mt-2 text-[11px] font-semibold opacity-75">Impacto: {item.impact}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="border-t border-slate-100 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h4 className="text-sm font-black text-slate-900">Checks automaticos</h4>
                        <p className="text-xs font-semibold text-slate-500">Validaciones rapidas de operacion por tenant.</p>
                    </div>
                    <div className="flex gap-2 text-[11px] font-black">
                        <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">{tenant.checkSummary.critical} criticos</span>
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">{tenant.checkSummary.warning} revisar</span>
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{tenant.checkSummary.ok} ok</span>
                    </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {tenant.checks.map(check => (
                        <div key={check.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-black text-slate-900">{check.title}</p>
                                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{check.description}</p>
                                </div>
                                <CheckStatusBadge check={check} />
                            </div>
                            {check.details?.length > 0 && (
                                <details className="mt-3 rounded-xl border border-slate-200 bg-white p-2 text-xs">
                                    <summary className="cursor-pointer font-black text-slate-500">Ver detalle</summary>
                                    <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] font-semibold text-slate-600">{JSON.stringify(check.details.slice(0, 5), null, 2)}</pre>
                                </details>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="border-t border-slate-100 p-5">
                <h4 className="text-sm font-black text-slate-900">Rutas afectadas</h4>
                {tenant.routes.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {tenant.routes.slice(0, 8).map(route => (
                            <span key={route} className="max-w-full truncate rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">{route}</span>
                        ))}
                    </div>
                ) : (
                    <p className="mt-2 text-sm font-semibold text-slate-500">Sin rutas reportadas.</p>
                )}
            </div>

            <div className="border-t border-slate-100 p-5">
                <h4 className="text-sm font-black text-slate-900">Ultimos eventos</h4>
                {topEvents.length ? (
                    <div className="mt-3 space-y-3">
                        {topEvents.map(event => (
                            <div key={event.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <SeverityBadge severity={event.severity} />
                                    <KindBadge kind={event.kind} />
                                    <span className="text-xs font-black text-slate-400">{timeAgo(event.timestamp)}</span>
                                </div>
                                <p className="mt-2 line-clamp-2 text-sm font-bold text-slate-800">{event.message}</p>
                                <p className="mt-1 truncate text-xs font-semibold text-slate-500">{event.route || event.url || 'Sin ruta'}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
                        No hay eventos registrados para este tenant en la ventana seleccionada.
                    </div>
                )}
            </div>
        </div>
    );
};

const MetricMini = ({ label, value, className }: { label: string; value: number; className: string }) => (
    <div className={`rounded-2xl px-3 py-3 ${className}`}>
        <p className="text-2xl font-black">{value}</p>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{label}</p>
    </div>
);

const getTenantStatus = (critical: number, error: number, warning: number, total: number, checkCritical: number, checkWarning: number): TenantStatus => {
    if (critical > 0 || checkCritical > 0 || total >= 10) return 'critical';
    if (error > 0 || warning > 0 || checkWarning > 0) return 'warning';
    return 'healthy';
};

const SystemHealth: React.FC = () => {
    const [data, setData] = useState<SystemHealthResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hours, setHours] = useState(24);
    const [tenant, setTenant] = useState('all');
    const [kind, setKind] = useState<KindFilter>('all');
    const [query, setQuery] = useState('');
    const [selectedTenant, setSelectedTenant] = useState<string | null>(null);

    const loadHealth = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await getSystemHealth({ hours, tenant, kind, q: query, limit: 250 });
            setData(response);
        } catch (err: any) {
            const message = err?.response?.data?.detail || err?.message || 'No se pudo cargar salud del sistema';
            setError(message);
            toast.error(message);
        } finally {
            setLoading(false);
        }
    }, [hours, tenant, kind, query]);

    useEffect(() => {
        loadHealth();
    }, [loadHealth]);

    const filteredEvents = data?.events ?? [];
    const topGroups = useMemo(() => (data?.groups ?? []).slice(0, 6), [data]);

    const tenantHealth = useMemo<TenantHealth[]>(() => {
        const options = data?.tenant_options ?? [];
        const events = data?.events ?? [];
        const byTenant = new Map<string, SystemHealthEvent[]>();
        events.forEach(event => {
            const list = byTenant.get(event.tenant_schema) ?? [];
            list.push(event);
            byTenant.set(event.tenant_schema, list);
        });
        const checksByTenant = new Map((data?.tenant_checks ?? []).map(item => [item.tenant_schema, item]));

        return options.map(option => {
            const tenantEvents = (byTenant.get(option.schema_name) ?? []).sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
            const critical = tenantEvents.filter(event => event.severity === 'critical').length;
            const errorCount = tenantEvents.filter(event => event.severity === 'error').length;
            const warning = tenantEvents.filter(event => event.severity === 'warning').length;
            const api = tenantEvents.filter(event => event.kind === 'API_ERROR').length;
            const network = tenantEvents.filter(event => event.kind === 'NETWORK_ERROR').length;
            const client = tenantEvents.filter(event => event.kind === 'CLIENT_ERROR').length;
            const routes = Array.from(new Set(tenantEvents.map(event => event.route || event.url).filter(Boolean))) as string[];
            const total = tenantEvents.length;
            const tenantChecks = checksByTenant.get(option.schema_name);
            const checkSummary = tenantChecks?.summary ?? { critical: 0, warning: 0, ok: 0 };
            return {
                option,
                status: getTenantStatus(critical, errorCount, warning, total, checkSummary.critical, checkSummary.warning),
                total,
                critical,
                error: errorCount,
                warning,
                api,
                network,
                client,
                lastSeen: tenantEvents[0]?.timestamp ?? null,
                routes,
                events: tenantEvents,
                checks: tenantChecks?.checks ?? [],
                checkSummary,
            };
        }).sort((a, b) => {
            const statusRank: Record<TenantStatus, number> = { critical: 0, warning: 1, healthy: 2 };
            if (statusRank[a.status] !== statusRank[b.status]) return statusRank[a.status] - statusRank[b.status];
            if (b.total !== a.total) return b.total - a.total;
            return a.option.name.localeCompare(b.option.name);
        });
    }, [data]);

    useEffect(() => {
        if (!tenantHealth.length) {
            setSelectedTenant(null);
            return;
        }
        if (!selectedTenant || !tenantHealth.some(item => item.option.schema_name === selectedTenant)) {
            setSelectedTenant(tenantHealth[0].option.schema_name);
        }
    }, [tenantHealth, selectedTenant]);

    const selectedTenantHealth = tenantHealth.find(item => item.option.schema_name === selectedTenant) ?? null;
    const statusCounts = useMemo(() => ({
        critical: tenantHealth.filter(item => item.status === 'critical').length,
        warning: tenantHealth.filter(item => item.status === 'warning').length,
        healthy: tenantHealth.filter(item => item.status === 'healthy').length,
    }), [tenantHealth]);

    const exportCSV = () => {
        if (!data) return;
        const header = ['Fecha', 'Tenant', 'Schema', 'Tipo', 'Severidad', 'Status', 'Ruta', 'Mensaje', 'Firma'];
        const rows = data.events.map(event => [
            event.timestamp || '',
            event.tenant_name,
            event.tenant_schema,
            event.kind,
            event.severity,
            event.status || '',
            event.route || event.url || '',
            event.message.replace(/\n/g, ' '),
            event.signature,
        ]);
        const csv = [header, ...rows].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const anchor = Object.assign(document.createElement('a'), { href: url, download: `salud_sistema_${hours}h.csv` });
        anchor.click();
        URL.revokeObjectURL(url);
        toast.success('CSV exportado');
    };

    return (
        <div className="space-y-6 bg-slate-50 font-[Plus_Jakarta_Sans,sans-serif]">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-xl">
                <div className="grid gap-6 p-6 text-white lg:grid-cols-[1.4fr_auto] lg:items-center">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-emerald-300">
                            <ShieldAlert size={13} /> Observabilidad SaaS
                        </div>
                        <h1 className="mt-4 text-3xl font-black tracking-tight">Salud del Sistema</h1>
                        <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-400">
                            Errores reales capturados desde los navegadores y APIs de cada tenant. Usa esta vista para priorizar incidentes, detectar rutas rotas y encontrar fallas repetidas antes de que escalen a soporte.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                        <button type="button" onClick={loadHealth} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/15 disabled:opacity-60">
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualizar
                        </button>
                        <button type="button" onClick={exportCSV} disabled={!data?.events.length} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-400 disabled:opacity-60">
                            <Download size={16} /> CSV
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Criticos" value={data?.summary.critical ?? 0} icon={<ServerCrash size={20} />} tone="red" helper="API 5xx o fallas severas" />
                <MetricCard label="Errores UI" value={data?.summary.error ?? 0} icon={<Bug size={20} />} tone="violet" helper="Pantallas o componentes rotos" />
                <MetricCard label="Alertas" value={data?.summary.warning ?? 0} icon={<WifiOff size={20} />} tone="amber" helper="Red, API 400 o eventos a revisar" />
                <MetricCard label="Checks criticos" value={data?.summary.check_critical ?? 0} icon={<XCircle size={20} />} tone={(data?.summary.check_critical ?? 0) > 0 ? 'red' : 'emerald'} helper={`${data?.summary.check_warning ?? 0} checks por revisar`} />
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-3 lg:grid-cols-[1fr_170px_190px_170px_auto]">
                    <label className="relative block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar mensaje, ruta, tenant o origen..." className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm font-semibold outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" />
                    </label>

                    <select value={tenant} onChange={event => setTenant(event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100">
                        <option value="all">Todos los tenants</option>
                        {(data?.tenant_options ?? []).map(option => (
                            <option key={option.schema_name} value={option.schema_name}>{option.name}</option>
                        ))}
                    </select>

                    <select value={kind} onChange={event => setKind(event.target.value as KindFilter)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100">
                        <option value="all">Todos los tipos</option>
                        <option value="CLIENT_ERROR">Pantalla</option>
                        <option value="API_ERROR">API</option>
                        <option value="NETWORK_ERROR">Red</option>
                    </select>

                    <select value={hours} onChange={event => setHours(Number(event.target.value))} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100">
                        {hourOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>

                    <button type="button" onClick={loadHealth} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white transition hover:bg-slate-800">
                        <Filter size={16} /> Filtrar
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                    {error}
                </div>
            )}

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                        <div>
                            <h2 className="text-lg font-black text-slate-900">Estado por tenant</h2>
                            <p className="text-sm font-semibold text-slate-500">Semaforo operativo segun eventos de la ventana seleccionada.</p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs font-black">
                            <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">{statusCounts.critical} criticos</span>
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">{statusCounts.warning} revisar</span>
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{statusCounts.healthy} estables</span>
                        </div>
                    </div>
                    {loading ? (
                        <div className="flex min-h-72 items-center justify-center">
                            <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
                        </div>
                    ) : (
                        <div className="mt-4 grid max-h-[620px] gap-3 overflow-auto pr-1 md:grid-cols-2 2xl:grid-cols-3">
                            {tenantHealth.map(item => (
                                <TenantHealthCard
                                    key={item.option.schema_name}
                                    tenant={item}
                                    active={selectedTenant === item.option.schema_name}
                                    onSelect={() => setSelectedTenant(item.option.schema_name)}
                                />
                            ))}
                        </div>
                    )}
                </div>
                <TenantDetailPanel tenant={selectedTenantHealth} />
            </section>

            {topGroups.length > 0 && (
                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-black text-slate-900">Errores repetidos</h2>
                            <p className="text-sm font-semibold text-slate-500">Firmas con mayor frecuencia en la ventana seleccionada.</p>
                        </div>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                        {topGroups.map(group => <GroupCard key={group.signature} group={group} />)}
                    </div>
                </section>
            )}

            <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-black text-slate-900">Eventos recientes</h2>
                        <p className="text-sm font-semibold text-slate-500">{filteredEvents.length} eventos - desde {fmtTime(data?.summary.since ?? null)}</p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-500">
                        <Clock size={13} /> Ventana {data?.summary.hours ?? hours}h
                    </div>
                </div>

                {loading ? (
                    <div className="flex min-h-72 items-center justify-center rounded-3xl border border-slate-200 bg-white">
                        <div className="text-center">
                            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-indigo-500" />
                            <p className="mt-3 text-sm font-bold text-slate-500">Leyendo auditoria de tenants...</p>
                        </div>
                    </div>
                ) : filteredEvents.length === 0 ? (
                    <div className="flex min-h-72 items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white">
                        <div className="text-center">
                            <Activity className="mx-auto h-10 w-10 text-emerald-500" />
                            <p className="mt-3 text-base font-black text-slate-800">Sin errores en esta ventana</p>
                            <p className="mt-1 text-sm font-semibold text-slate-500">Buena senal. Cambia el rango o limpia filtros si necesitas revisar historico.</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredEvents.map(event => <EventRow key={event.id} event={event} />)}
                    </div>
                )}
            </section>
        </div>
    );
};

export default SystemHealth;
