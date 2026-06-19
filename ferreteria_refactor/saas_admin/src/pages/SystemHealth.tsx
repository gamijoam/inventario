import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Activity,
    Bug,
    Building2,
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
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getSystemHealth } from '../api/systemHealth';
import type { HealthKind, HealthSeverity, SystemHealthEvent, SystemHealthGroup, SystemHealthResponse } from '../api/systemHealth';

type KindFilter = HealthKind | 'all';
type SeverityTone = 'red' | 'amber' | 'violet';

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
                            <p className="mt-1 font-semibold text-slate-700">{event.method || '-'} · {event.source}</p>
                        </div>
                        <div>
                            <p className="font-black uppercase tracking-widest text-slate-400">Usuario / IP</p>
                            <p className="mt-1 font-semibold text-slate-700">Usuario {event.user_id || '-'} · {event.ip_address || '-'}</p>
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
        <p className="mt-3 text-[11px] font-semibold text-slate-400">Ultimo: {fmtTime(group.last_seen)} · Firma {group.signature}</p>
    </div>
);

const SystemHealth: React.FC = () => {
    const [data, setData] = useState<SystemHealthResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hours, setHours] = useState(24);
    const [tenant, setTenant] = useState('all');
    const [kind, setKind] = useState<KindFilter>('all');
    const [query, setQuery] = useState('');

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
                <MetricCard label="Tenants afectados" value={data?.summary.affected_tenants ?? 0} icon={<Building2 size={20} />} tone="violet" helper={`${data?.summary.unique_groups ?? 0} firmas unicas`} />
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
                        <p className="text-sm font-semibold text-slate-500">{filteredEvents.length} eventos · desde {fmtTime(data?.summary.since ?? null)}</p>
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
                            <p className="mt-1 text-sm font-semibold text-slate-500">Buena señal. Cambia el rango o limpia filtros si necesitas revisar historico.</p>
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
