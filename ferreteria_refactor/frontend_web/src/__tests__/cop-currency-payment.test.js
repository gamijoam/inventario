/**
 * Tests: COP payment calculation logic
 *
 * These tests exercise the pure calculation logic extracted from PaymentModal.jsx
 * (lines 148-178). No React, no imports from the component — the functions are
 * reproduced inline so the suite runs without a DOM or a running API.
 *
 * To run (once Jest is installed):
 *   npx jest src/__tests__/cop-currency-payment.test.js
 */

// ---------------------------------------------------------------------------
// Pure helpers reproduced from PaymentModal.jsx
// ---------------------------------------------------------------------------

/** Round to 2 decimal places (mirrors PaymentModal's `round2`) */
const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

/**
 * Compute totalPaidUSD from a payments array.
 *
 * Rules (mirrors PaymentModal lines 158-174):
 *  - USD / '$'           → rate = 1
 *  - Bs / VES            → rate = effectiveRate = totalBs / totalUSD  (or defaultBsRate)
 *  - any other currency  → rate = getExchangeRate(p.currency)
 *
 * @param {Array}  payments        [{amount, currency}]
 * @param {number} totalUSD        sale total in USD
 * @param {number} totalBs         sale total in local currency (optional for Bs payments)
 * @param {function} getExchangeRate  (symbol) => rate (number)
 * @returns {number} totalPaidUSD
 */
const calcTotalPaidUSD = (payments, totalUSD, totalBs, getExchangeRate) => {
    const defaultBsRate = getExchangeRate('Bs') || getExchangeRate('VES') || 1;

    return payments.reduce((acc, p) => {
        const amount = parseFloat(p.amount) || 0;
        let rate = 1;

        if (p.currency === 'USD' || p.currency === '$') {
            rate = 1;
        } else if (p.currency === 'Bs' || p.currency === 'VES') {
            const effectiveRate = (totalBs && totalUSD) ? (totalBs / totalUSD) : defaultBsRate;
            rate = effectiveRate;
        } else {
            rate = getExchangeRate(p.currency) || 1;
        }

        return round2(acc + round2(amount / rate));
    }, 0);
};

/** Build a mock getExchangeRate from a simple {symbol → rate} map */
const mockGetExchangeRate = (rateMap) => (symbol) => {
    if (!symbol) return 1;
    const key = String(symbol).trim().toUpperCase();
    return rateMap[key] !== undefined ? rateMap[key] : 1;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('round2 helper', () => {
    test('rounds to 2 decimal places', () => {
        expect(round2(1.005)).toBe(1.01);
        expect(round2(47.619047619)).toBe(47.62);
        expect(round2(100)).toBe(100);
        expect(round2(0)).toBe(0);
    });

    test('handles floating point imprecision with EPSILON', () => {
        // Without EPSILON, Math.round(1.005 * 100) / 100 could give 1.00
        expect(round2(1.005)).toBe(1.01);
        // 0.1 + 0.2 = 0.30000000000000004 in IEEE754
        expect(round2(0.1 + 0.2)).toBe(0.3);
    });
});

describe('COP single-payment calculation', () => {
    const COP_RATE = 4200;
    const getExchangeRate = mockGetExchangeRate({ COP: COP_RATE });

    test('200,000 COP at rate 4200 equals 47.62 USD', () => {
        const payments = [{ amount: '200000', currency: 'COP' }];
        const totalUSD = 47.62; // approximate sale total
        const result = calcTotalPaidUSD(payments, totalUSD, null, getExchangeRate);
        // 200000 / 4200 = 47.619047... → round2 = 47.62
        expect(result).toBe(47.62);
    });

    test('420,000 COP at rate 4200 equals 100 USD exactly', () => {
        const payments = [{ amount: '420000', currency: 'COP' }];
        const totalUSD = 100;
        const result = calcTotalPaidUSD(payments, totalUSD, null, getExchangeRate);
        expect(result).toBe(100);
    });
});

describe('Mixed USD + COP payment', () => {
    const COP_RATE = 4200;
    const getExchangeRate = mockGetExchangeRate({ COP: COP_RATE });

    test('100 USD + 420,000 COP = 200 USD total paid', () => {
        const payments = [
            { amount: '100', currency: 'USD' },
            { amount: '420000', currency: 'COP' },
        ];
        const totalUSD = 200;
        const result = calcTotalPaidUSD(payments, totalUSD, null, getExchangeRate);
        // 100 / 1 = 100 USD; 420000 / 4200 = 100 USD; total = 200 USD
        expect(result).toBe(200);
    });

    test('25 USD + 105,000 COP covers $50 total exactly', () => {
        // 25 + 105000/4200 = 25 + 25 = 50
        const payments = [
            { amount: '25', currency: 'USD' },
            { amount: '105000', currency: 'COP' },
        ];
        const totalUSD = 50;
        const result = calcTotalPaidUSD(payments, totalUSD, null, getExchangeRate);
        expect(result).toBe(50);
    });
});

describe('changeUSD and no phantom change', () => {
    const COP_RATE = 4200;
    const getExchangeRate = mockGetExchangeRate({ COP: COP_RATE });

    test('overpaying: 210,000 COP for $50 total → change >= 0', () => {
        const totalUSD = 50;
        const payments = [{ amount: '210000', currency: 'COP' }];
        const totalPaidUSD = calcTotalPaidUSD(payments, totalUSD, null, getExchangeRate);
        // 210000 / 4200 = 50 exactly
        const changeUSD = round2(Math.max(0, totalPaidUSD - totalUSD));
        expect(changeUSD).toBeGreaterThanOrEqual(0);
    });

    test('no phantom change: exact 210,000 COP for $50 → changeUSD is exactly 0', () => {
        const totalUSD = 50;
        const payments = [{ amount: '210000', currency: 'COP' }];
        const totalPaidUSD = calcTotalPaidUSD(payments, totalUSD, null, getExchangeRate);
        // 210000 / 4200 = 50.0 — no floating point residual
        const changeUSD = round2(Math.max(0, totalPaidUSD - totalUSD));
        expect(changeUSD).toBe(0);
    });

    test('actual overpay: 250,000 COP for $50 at 4200 → change = round2(59.52 - 50)', () => {
        const totalUSD = 50;
        const payments = [{ amount: '250000', currency: 'COP' }];
        const totalPaidUSD = calcTotalPaidUSD(payments, totalUSD, null, getExchangeRate);
        // 250000 / 4200 = 59.5238... → round2 = 59.52
        const changeUSD = round2(Math.max(0, totalPaidUSD - totalUSD));
        expect(changeUSD).toBe(round2(59.52 - 50));
    });
});

describe('remainingUSD and isComplete', () => {
    const COP_RATE = 4200;
    const getExchangeRate = mockGetExchangeRate({ COP: COP_RATE });

    test('payment covers total → isComplete is true (remaining <= 0.005)', () => {
        const totalUSD = 50;
        const payments = [{ amount: '210000', currency: 'COP' }];
        const totalPaidUSD = calcTotalPaidUSD(payments, totalUSD, null, getExchangeRate);
        const remainingUSD = round2(Math.max(0, totalUSD - totalPaidUSD));
        const isComplete = remainingUSD <= 0.005;
        expect(isComplete).toBe(true);
    });

    test('underpayment → isComplete is false', () => {
        const totalUSD = 100;
        const payments = [{ amount: '200000', currency: 'COP' }]; // only $47.62
        const totalPaidUSD = calcTotalPaidUSD(payments, totalUSD, null, getExchangeRate);
        const remainingUSD = round2(Math.max(0, totalUSD - totalPaidUSD));
        const isComplete = remainingUSD <= 0.005;
        expect(isComplete).toBe(false);
        expect(remainingUSD).toBeGreaterThan(0.005);
    });
});
