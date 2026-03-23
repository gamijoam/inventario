import { useState, useEffect } from 'react';
import apiClient from '../config/axios';

export function useSubscription() {
    const [subscription, setSubscription] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiClient.get('/config/subscription')
            .then(r => setSubscription(r.data))
            .catch(() => setSubscription(null))
            .finally(() => setLoading(false));
    }, []);

    const isWarning = subscription && subscription.days_remaining !== null && subscription.days_remaining <= 10 && !subscription.is_expired;
    const isExpired = subscription?.is_expired && !subscription?.grace_period_active;
    const isGrace = subscription?.grace_period_active;
    const isLifetime = subscription?.license_type === 'lifetime';

    return { subscription, loading, isWarning, isExpired, isGrace, isLifetime };
}
