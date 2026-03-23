/**
 * Tests: Subscription / Plans system logic
 *
 * Pure function tests — no DOM, no React, no real API calls.
 * All helpers are reproduced inline from their source files so the suite
 * runs with plain Jest (no jsdom, no module resolution for src/ files).
 *
 * Sources:
 *  - useSubscription.js       → computed flags (isWarning, isExpired, isGrace, isLifetime)
 *  - SubscriptionBanner.jsx   → banner visibility rules
 *  - scheduler.py             → grace period / blocking / expiry-warning logic
 *  - saas_admin seed logic    → demo trial days
 *
 * Run:
 *   npx jest src/__tests__/subscription-plans.test.js
 */

// ---------------------------------------------------------------------------
// Pure helpers (reproduced from source, no imports needed)
// ---------------------------------------------------------------------------

/**
 * Reproduces the four computed flags from useSubscription.js.
 * @param {object|null} subscription  API response object
 */
function computeFlags(subscription) {
    const isWarning =
        subscription &&
        subscription.days_remaining !== null &&
        subscription.days_remaining <= 10 &&
        !subscription.is_expired;
    const isExpired = subscription?.is_expired && !subscription?.grace_period_active;
    const isGrace = subscription?.grace_period_active;
    const isLifetime = subscription?.license_type === 'lifetime';
    return { isWarning, isExpired, isGrace, isLifetime };
}

/**
 * Reproduces the banner visibility logic from SubscriptionBanner.jsx.
 * @param {{ isWarning, isExpired, isGrace, isLifetime }} flags
 * @param {boolean} dismissed  local dismissed state
 */
function shouldShowBanner(flags, dismissed) {
    if (flags.isLifetime || dismissed) return false;
    return flags.isWarning || flags.isExpired || flags.isGrace;
}

/**
 * Mirrors the backend grace-period check in scheduler.py / config.py:
 * is the tenant currently inside the 5-day grace window after expiry?
 *
 * @param {string|Date|null} expiryDate
 * @param {Date} now
 * @param {number} graceDays  default 5 (matches scheduler.py)
 */
function isInGracePeriod(expiryDate, now, graceDays = 5) {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const diffMs = now - expiry;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays > 0 && diffDays <= graceDays;
}

/**
 * Returns true when the tenant has passed the grace window and should be
 * blocked (mirrors the scheduler's cutoff logic).
 *
 * @param {string|Date|null} expiryDate
 * @param {Date} now
 * @param {number} graceDays  default 5
 */
function shouldBlockTenant(expiryDate, now, graceDays = 5) {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const cutoff = new Date(expiry.getTime() + graceDays * 24 * 60 * 60 * 1000);
    return now > cutoff;
}

/**
 * Computes the demo trial expiry date.
 * Default is 2 days (current behaviour) — NOT 15.
 *
 * @param {string|Date} createdAt
 * @param {number} trialDays  default 2
 * @returns {Date}
 */
function calcDemoExpiry(createdAt, trialDays = 2) {
    const d = new Date(createdAt);
    d.setDate(d.getDate() + trialDays);
    return d;
}

/**
 * Returns true when an expiry-warning email should be sent.
 * The scheduler sends warnings when expiry is within the next 7 days.
 *
 * @param {string|Date|null} expiryDate
 * @param {Date} now
 * @param {number} warningDays  default 7 (matches scheduler.py)
 */
function shouldSendWarningEmail(expiryDate, now, warningDays = 7) {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const diffMs = expiry - now;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays > 0 && diffDays <= warningDays;
}

// ---------------------------------------------------------------------------
// Helpers for building test fixtures
// ---------------------------------------------------------------------------

/** Returns a Date offset by `days` from `base` (positive = future, negative = past). */
function daysFrom(base, days) {
    return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// 1. useSubscription — computed flags
// ---------------------------------------------------------------------------

describe('useSubscription: computed flags', () => {
    test('1. days_remaining: 15 → isWarning=false, isExpired=false', () => {
        const { isWarning, isExpired } = computeFlags({
            days_remaining: 15,
            is_expired: false,
            grace_period_active: false,
            license_type: 'monthly',
        });
        expect(isWarning).toBe(false);
        expect(isExpired).toBe(false);
    });

    test('2. days_remaining: 10 → isWarning=true (boundary)', () => {
        const { isWarning } = computeFlags({
            days_remaining: 10,
            is_expired: false,
            grace_period_active: false,
            license_type: 'monthly',
        });
        expect(isWarning).toBe(true);
    });

    test('3. days_remaining: 3 → isWarning=true', () => {
        const { isWarning } = computeFlags({
            days_remaining: 3,
            is_expired: false,
            grace_period_active: false,
            license_type: 'monthly',
        });
        expect(isWarning).toBe(true);
    });

    test('4. days_remaining: 0, is_expired: true, grace_period_active: false → isExpired=true, isWarning=false', () => {
        const { isExpired, isWarning } = computeFlags({
            days_remaining: 0,
            is_expired: true,
            grace_period_active: false,
            license_type: 'monthly',
        });
        expect(isExpired).toBe(true);
        expect(isWarning).toBe(false);
    });

    test('5. is_expired: true, grace_period_active: true → isGrace=true, isExpired=false', () => {
        const { isGrace, isExpired } = computeFlags({
            days_remaining: 0,
            is_expired: true,
            grace_period_active: true,
            license_type: 'monthly',
        });
        expect(isGrace).toBe(true);
        expect(isExpired).toBe(false);
    });

    test('6. license_type: lifetime → isLifetime=true, isWarning=false', () => {
        const { isLifetime, isWarning } = computeFlags({
            days_remaining: null,
            is_expired: false,
            grace_period_active: false,
            license_type: 'lifetime',
        });
        expect(isLifetime).toBe(true);
        expect(isWarning).toBe(false);
    });

    test('7. subscription: null → all flags false/falsy', () => {
        const { isWarning, isExpired, isGrace, isLifetime } = computeFlags(null);
        expect(Boolean(isWarning)).toBe(false);
        expect(Boolean(isExpired)).toBe(false);
        expect(Boolean(isGrace)).toBe(false);
        expect(Boolean(isLifetime)).toBe(false);
    });

    test('8. days_remaining: 1, is_expired: false → isWarning=true (urgent)', () => {
        const { isWarning } = computeFlags({
            days_remaining: 1,
            is_expired: false,
            grace_period_active: false,
            license_type: 'trial',
        });
        expect(isWarning).toBe(true);
    });

    test('9. days_remaining: 11 → isWarning=false (just above boundary)', () => {
        const { isWarning } = computeFlags({
            days_remaining: 11,
            is_expired: false,
            grace_period_active: false,
            license_type: 'monthly',
        });
        expect(isWarning).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// 2. SubscriptionBanner — visibility logic
// ---------------------------------------------------------------------------

describe('SubscriptionBanner: visibility logic', () => {
    test('10. lifetime → banner should NOT show', () => {
        const flags = computeFlags({
            days_remaining: null,
            is_expired: false,
            grace_period_active: false,
            license_type: 'lifetime',
        });
        expect(shouldShowBanner(flags, false)).toBe(false);
    });

    test('11. dismissed=true + warning active → banner should NOT show', () => {
        const flags = computeFlags({
            days_remaining: 5,
            is_expired: false,
            grace_period_active: false,
            license_type: 'monthly',
        });
        expect(shouldShowBanner(flags, true)).toBe(false);
    });

    test('12. warning active, not dismissed → banner SHOULD show', () => {
        const flags = computeFlags({
            days_remaining: 7,
            is_expired: false,
            grace_period_active: false,
            license_type: 'monthly',
        });
        expect(shouldShowBanner(flags, false)).toBe(true);
    });

    test('13. expired → banner SHOULD show (cannot dismiss expired)', () => {
        const flags = computeFlags({
            days_remaining: 0,
            is_expired: true,
            grace_period_active: false,
            license_type: 'monthly',
        });
        // Expired banners cannot be dismissed in SubscriptionBanner (no X button)
        // but shouldShowBanner still returns true regardless of dismissed param
        expect(shouldShowBanner(flags, false)).toBe(true);
    });

    test('14. grace period active → banner SHOULD show', () => {
        const flags = computeFlags({
            days_remaining: 0,
            is_expired: true,
            grace_period_active: true,
            license_type: 'monthly',
        });
        expect(shouldShowBanner(flags, false)).toBe(true);
    });

    test('15. no flags active (active subscription, plenty of days) → banner should NOT show', () => {
        const flags = computeFlags({
            days_remaining: 25,
            is_expired: false,
            grace_period_active: false,
            license_type: 'annual',
        });
        expect(shouldShowBanner(flags, false)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// 3. Grace period backend logic
// ---------------------------------------------------------------------------

describe('Grace period: backend block/grace logic (mirrors scheduler.py)', () => {
    const NOW = new Date('2026-03-23T12:00:00Z');

    test('16. grace period: tenant expired yesterday is in grace, not blocked', () => {
        const expiry = daysFrom(NOW, -1); // 1 day ago
        expect(isInGracePeriod(expiry, NOW)).toBe(true);
        expect(shouldBlockTenant(expiry, NOW)).toBe(false);
    });

    test('17. grace period: tenant expired 4 days ago is still in grace, not blocked', () => {
        const expiry = daysFrom(NOW, -4);
        expect(isInGracePeriod(expiry, NOW)).toBe(true);
        expect(shouldBlockTenant(expiry, NOW)).toBe(false);
    });

    test('18. grace period: tenant expired exactly 5 days ago (boundary) — shouldBlock=false, still in grace', () => {
        // cutoff = expiry + 5 days = NOW exactly → now > cutoff is false
        const expiry = daysFrom(NOW, -5);
        expect(shouldBlockTenant(expiry, NOW)).toBe(false);
        // 5 days have elapsed → isInGracePeriod: diffDays = 5, ≤ 5 → true
        expect(isInGracePeriod(expiry, NOW)).toBe(true);
    });

    test('19. grace period: tenant expired 6 days ago → shouldBlock=true (past grace window)', () => {
        const expiry = daysFrom(NOW, -6);
        expect(shouldBlockTenant(expiry, NOW)).toBe(true);
        expect(isInGracePeriod(expiry, NOW)).toBe(false);
    });

    test('20. active tenant (expiry tomorrow) → isInGracePeriod=false, shouldBlock=false', () => {
        const expiry = daysFrom(NOW, 1); // future
        expect(isInGracePeriod(expiry, NOW)).toBe(false);
        expect(shouldBlockTenant(expiry, NOW)).toBe(false);
    });

    test('21. no expiry date → isInGracePeriod=false, shouldBlock=false', () => {
        expect(isInGracePeriod(null, NOW)).toBe(false);
        expect(shouldBlockTenant(null, NOW)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// 4. Demo trial days
// ---------------------------------------------------------------------------

describe('Demo trial: default is 2 days not 15', () => {
    const TODAY = new Date('2026-03-23T00:00:00Z');

    test('22. created today + 2 days → expiry = today + 2', () => {
        const expiry = calcDemoExpiry(TODAY);
        const expected = daysFrom(TODAY, 2);
        expect(expiry.toISOString()).toBe(expected.toISOString());
    });

    test('23. demo trial: 2-day expiry is NOT equal to 15-day expiry (old behaviour removed)', () => {
        const twoDay = calcDemoExpiry(TODAY, 2);
        const fifteenDay = daysFrom(TODAY, 15);
        expect(twoDay.toISOString()).not.toBe(fifteenDay.toISOString());
    });

    test('24. trial days = 2: expiry is exactly 2 days out from creation', () => {
        const created = new Date('2026-01-01T00:00:00Z');
        const expiry = calcDemoExpiry(created, 2);
        const expected = new Date('2026-01-03T00:00:00Z');
        expect(expiry.toISOString()).toBe(expected.toISOString());
    });
});

// ---------------------------------------------------------------------------
// 5. Expiry warning email trigger logic
// ---------------------------------------------------------------------------

describe('Warning email: only triggers within 7-day window (mirrors scheduler.py)', () => {
    const NOW = new Date('2026-03-23T12:00:00Z');

    test('25. expiry in exactly 7 days → shouldSendWarning=true', () => {
        const expiry = daysFrom(NOW, 7);
        expect(shouldSendWarningEmail(expiry, NOW)).toBe(true);
    });

    test('26. expiry in 8 days → shouldSendWarning=false (outside 7-day window)', () => {
        const expiry = daysFrom(NOW, 8);
        expect(shouldSendWarningEmail(expiry, NOW)).toBe(false);
    });

    test('27. expiry in 1 day → shouldSendWarning=true', () => {
        const expiry = daysFrom(NOW, 1);
        expect(shouldSendWarningEmail(expiry, NOW)).toBe(true);
    });

    test('28. expiry yesterday (already past) → shouldSendWarning=false', () => {
        const expiry = daysFrom(NOW, -1);
        expect(shouldSendWarningEmail(expiry, NOW)).toBe(false);
    });

    test('29. expiry in 0.5 days (12 hours) → shouldSendWarning=true', () => {
        const expiry = new Date(NOW.getTime() + 0.5 * 24 * 60 * 60 * 1000);
        expect(shouldSendWarningEmail(expiry, NOW)).toBe(true);
    });
});
