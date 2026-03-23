import { useSubscription } from '../hooks/useSubscription';
import {
    CalendarDays,
    Clock,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Infinity,
    PhoneCall,
    Mail,
    CreditCard,
    RefreshCw,
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const PLAN_LABELS = {
    demo: 'Demo',
    monthly: 'Mensual',
    annual: 'Anual',
    lifetime: 'Vitalicia',
};

const PLAN_COLORS = {
    demo: 'bg-slate-100 text-slate-700 border-slate-200',
    monthly: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    annual: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    lifetime: 'bg-violet-50 text-violet-700 border-violet-200',
};

// ─── Skeleton ───────────────────────────────────────────────────────────────

function Skeleton({ className }) {
    return <div className={`animate-pulse bg-slate-200 rounded-lg ${className}`} />;
}

function LoadingState() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-10 w-48" />
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-4 w-64" />
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        </div>
    );
}

// ─── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ subscription, isExpired, isGrace, isWarning }) {
    if (isExpired) {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-red-50 text-red-700 border border-red-200">
                <XCircle className="w-4 h-4" /> Vencida
            </span>
        );
    }
    if (isGrace) {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                <AlertTriangle className="w-4 h-4" /> Período de gracia
            </span>
        );
    }
    if (isWarning) {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <Clock className="w-4 h-4" /> Por vencer
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-4 h-4" /> Activa
        </span>
    );
}

// ─── Days progress bar ───────────────────────────────────────────────────────

function DaysProgress({ subscription, isWarning, isExpired }) {
    if (!subscription || subscription.license_type === 'lifetime') return null;
    if (subscription.days_remaining === null || subscription.total_days === null) return null;

    const total = subscription.total_days || 1;
    const remaining = Math.max(0, subscription.days_remaining);
    const pct = Math.min(100, Math.round((remaining / total) * 100));

    const barColor = isExpired
        ? 'bg-red-400'
        : isWarning
            ? pct <= 30
                ? 'bg-amber-400'
                : 'bg-amber-400'
            : 'bg-emerald-400';

    return (
        <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-500 font-medium">
                <span>{remaining} día{remaining !== 1 ? 's' : ''} restante{remaining !== 1 ? 's' : ''}</span>
                <span>{pct}% del período</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function MiSuscripcion() {
    const { subscription, loading, isWarning, isExpired, isGrace, isLifetime } = useSubscription();

    if (loading) {
        return (
            <div className="max-w-2xl mx-auto py-6">
                <LoadingState />
            </div>
        );
    }

    if (!subscription) {
        return (
            <div className="max-w-2xl mx-auto py-6">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center space-y-3">
                    <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
                    <p className="text-slate-600 font-medium">No se pudo cargar la información de suscripción.</p>
                    <p className="text-slate-400 text-sm">Verifica tu conexión e intenta de nuevo.</p>
                </div>
            </div>
        );
    }

    const planLabel = PLAN_LABELS[subscription.license_type] ?? subscription.license_type ?? '—';
    const planColor = PLAN_COLORS[subscription.license_type] ?? 'bg-slate-100 text-slate-700 border-slate-200';

    return (
        <div className="max-w-2xl mx-auto py-6 space-y-6">

            {/* Header */}
            <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <CreditCard className="w-6 h-6 text-indigo-500" />
                    Mi Suscripción
                </h1>
                <p className="text-slate-500 text-sm mt-1">Detalles del plan activo de tu negocio.</p>
            </div>

            {/* Plan card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Plan actual</p>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border ${planColor}`}>
                            {isLifetime && <Infinity className="w-4 h-4" />}
                            {planLabel}
                        </span>
                    </div>
                    <StatusBadge
                        subscription={subscription}
                        isExpired={isExpired}
                        isGrace={isGrace}
                        isWarning={isWarning}
                    />
                </div>

                {/* Expiry date */}
                {!isLifetime && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <CalendarDays className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span>
                            Fecha de vencimiento:{' '}
                            <span className="font-semibold text-slate-800">{formatDate(subscription.expires_at)}</span>
                        </span>
                    </div>
                )}

                {/* Lifetime message */}
                {isLifetime && (
                    <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3 border border-emerald-100">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        <span className="font-medium">Tu licencia es vitalicia. No necesitas renovar.</span>
                    </div>
                )}

                {/* Grace period notice */}
                {isGrace && (
                    <div className="flex items-start gap-2 text-sm text-orange-700 bg-orange-50 rounded-xl px-4 py-3 border border-orange-100">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold">Período de gracia activo</p>
                            <p className="text-orange-600 text-xs mt-0.5">
                                Tu plan venció pero aún tienes acceso temporal. Renueva cuanto antes para no perder el servicio.
                            </p>
                        </div>
                    </div>
                )}

                {/* Expired notice */}
                {isExpired && (
                    <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-xl px-4 py-3 border border-red-100">
                        <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold">Suscripción vencida</p>
                            <p className="text-red-600 text-xs mt-0.5">
                                Tu acceso está suspendido. Contacta a soporte para reactivar tu cuenta.
                            </p>
                        </div>
                    </div>
                )}

                {/* Days progress */}
                {!isLifetime && (
                    <DaysProgress
                        subscription={subscription}
                        isWarning={isWarning}
                        isExpired={isExpired}
                    />
                )}
            </div>

            {/* Renewal / Contact section */}
            {!isLifetime && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">¿Necesitas renovar?</p>
                        <p className="text-slate-600 text-sm">
                            Contáctanos por WhatsApp o correo electrónico y te ayudamos a renovar tu plan de forma rápida y sencilla.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        {/* WhatsApp button */}
                        <a
                            href="https://wa.me/584227410094"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors shadow-sm shadow-emerald-200 text-sm"
                        >
                            <PhoneCall className="w-4 h-4" />
                            Renovar por WhatsApp
                        </a>

                        {/* Email link */}
                        <a
                            href="mailto:soporte@miinventariofacil.com"
                            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors text-sm border border-slate-200"
                        >
                            <Mail className="w-4 h-4" />
                            soporte@miinventariofacil.com
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
