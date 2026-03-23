import { useState } from 'react';
import { AlertTriangle, X, PhoneCall } from 'lucide-react';
import { useSubscription } from '../../hooks/useSubscription';

export default function SubscriptionBanner() {
    const { subscription, isWarning, isExpired, isGrace, isLifetime, loading } = useSubscription();
    const [dismissed, setDismissed] = useState(false);

    if (loading || isLifetime || dismissed) return null;
    if (!isWarning && !isExpired && !isGrace) return null;

    const isUrgent = isExpired || isGrace || (subscription?.days_remaining <= 3);

    // Colors: urgent = red, warning = amber
    const colors = isUrgent
        ? 'bg-red-50 border-red-200 text-red-800'
        : 'bg-amber-50 border-amber-200 text-amber-800';
    const iconColor = isUrgent ? 'text-red-500' : 'text-amber-500';

    let message = '';
    if (isGrace) {
        message = `⚠️ Tu plan ha vencido. Tienes un período de gracia activo. Renueva antes de que se suspenda tu acceso.`;
    } else if (isExpired) {
        message = `🚫 Tu suscripción ha vencido. Contacta a soporte para renovar.`;
    } else {
        message = `Tu suscripción vence en ${subscription.days_remaining} día${subscription.days_remaining !== 1 ? 's' : ''}. Renueva para no perder el acceso.`;
    }

    return (
        <div className={`border-b px-4 py-2.5 flex items-center justify-between gap-3 text-sm ${colors}`}>
            <div className="flex items-center gap-2 flex-1 min-w-0">
                <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${iconColor}`} />
                <span className="font-medium truncate">{message}</span>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
                <a
                    href="https://wa.me/584227410094"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-1 text-xs font-semibold underline underline-offset-2 hover:no-underline`}
                >
                    <PhoneCall className="w-3 h-3" />
                    Renovar ahora
                </a>
                {!isExpired && (
                    <button onClick={() => setDismissed(true)} className="opacity-60 hover:opacity-100">
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
}
