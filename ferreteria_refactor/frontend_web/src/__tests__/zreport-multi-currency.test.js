/**
 * Tests: ZReport PDF — multi-currency formatting and local payment totals
 *
 * Reproduces the pure logic from ZReportPDF.jsx for number formatting and
 * grouping of non-USD payments by currency code. No React, no DOM.
 *
 * Bug fixed: ZReportPDF only supported Bs / VES as the "local" currency.
 * When the shop used COP (or EUR), payments were either displayed with the
 * wrong symbol or collapsed into a single unnamed bucket.
 *
 * Fix: `fmtCurrency` now handles any symbol generically, and `buildLocalTotals`
 * groups payments by `currency_code` so COP and Bs are always kept separate.
 *
 * To run: npx jest src/__tests__/zreport-multi-currency.test.js
 */

// ---------------------------------------------------------------------------
// Pure helpers reproduced from ZReportPDF.jsx
// ---------------------------------------------------------------------------

/**
 * Format a number with comma-separated thousands and two decimal places.
 * ZReportPDF fmtNum helper.
 */
const fmtNum = (value) => {
    const n = Number(value) || 0;
    const [intPart, decPart = '00'] = n.toFixed(2).split('.');
    const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${withCommas}.${decPart}`;
};

/** Format as USD. */
const fmtUSD = (value) => `$ ${fmtNum(value)}`;

/** Format as Bolivares. */
const fmtBs = (value) => `Bs ${fmtNum(value)}`;

/**
 * Format with an arbitrary currency symbol.
 * Handles USD variants, Bs/VES, and any other symbol generically.
 * ZReportPDF.jsx fmtCurrency.
 */
const fmtCurrency = (value, symbol = '$') => {
    if (!symbol || symbol === '$' || symbol === 'USD') return fmtUSD(value);
    if (symbol === 'Bs' || symbol === 'VES') return fmtBs(value);
    return `${symbol} ${fmtNum(value)}`;
};

/**
 * Groups non-USD payments by currency code, summing amounts.
 * ZReportPDF.jsx buildLocalTotals (line ~297).
 *
 * @param {Array} paymentBreakdown - array of { currency, amount, ... }
 * @returns {Object} { [currency_code]: totalAmount }
 */
const buildLocalTotals = (paymentBreakdown) => {
    return (paymentBreakdown || [])
        .filter((p) => p.currency !== 'USD')
        .reduce((acc, p) => {
            const key = p.currency || 'LOCAL';
            acc[key] = (acc[key] || 0) + parseFloat(p.amount || 0);
            return acc;
        }, {});
};

// ---------------------------------------------------------------------------
// Tests — fmtNum
// ---------------------------------------------------------------------------

describe('fmtNum — number formatting', () => {
    test('100 → "100.00"', () => {
        expect(fmtNum(100)).toBe('100.00');
    });

    test('1234.56 → "1,234.56"', () => {
        expect(fmtNum(1234.56)).toBe('1,234.56');
    });

    test('4200 → "4,200.00"', () => {
        expect(fmtNum(4200)).toBe('4,200.00');
    });

    test('0 → "0.00"', () => {
        expect(fmtNum(0)).toBe('0.00');
    });

    test('null → "0.00" (no crash)', () => {
        expect(fmtNum(null)).toBe('0.00');
    });

    test('undefined → "0.00" (no crash)', () => {
        expect(fmtNum(undefined)).toBe('0.00');
    });

    test('1000000 → "1,000,000.00"', () => {
        expect(fmtNum(1000000)).toBe('1,000,000.00');
    });
});

// ---------------------------------------------------------------------------
// Tests — fmtUSD
// ---------------------------------------------------------------------------

describe('fmtUSD — USD formatting', () => {
    test('fmtUSD(100) → "$ 100.00"', () => {
        expect(fmtUSD(100)).toBe('$ 100.00');
    });

    test('fmtUSD(1234.56) → "$ 1,234.56"', () => {
        expect(fmtUSD(1234.56)).toBe('$ 1,234.56');
    });

    test('fmtUSD(0) → "$ 0.00"', () => {
        expect(fmtUSD(0)).toBe('$ 0.00');
    });
});

// ---------------------------------------------------------------------------
// Tests — fmtBs
// ---------------------------------------------------------------------------

describe('fmtBs — Bolivares formatting', () => {
    test('fmtBs(4200) → "Bs 4,200.00"', () => {
        expect(fmtBs(4200)).toBe('Bs 4,200.00');
    });

    test('fmtBs(0) → "Bs 0.00"', () => {
        expect(fmtBs(0)).toBe('Bs 0.00');
    });
});

// ---------------------------------------------------------------------------
// Tests — fmtCurrency — USD variants
// ---------------------------------------------------------------------------

describe('fmtCurrency — USD and dollar variants', () => {
    test('fmtCurrency(100, "$") → "$ 100.00"', () => {
        expect(fmtCurrency(100, '$')).toBe('$ 100.00');
    });

    test('fmtCurrency(100, "USD") → "$ 100.00"', () => {
        expect(fmtCurrency(100, 'USD')).toBe('$ 100.00');
    });

    test('fmtCurrency(100) — default symbol is "$" → "$ 100.00"', () => {
        expect(fmtCurrency(100)).toBe('$ 100.00');
    });

    test('fmtCurrency(null, "$") → "$ 0.00" (no crash on null)', () => {
        expect(fmtCurrency(null, '$')).toBe('$ 0.00');
    });

    test('fmtCurrency(undefined, "$") → "$ 0.00" (no crash on undefined)', () => {
        expect(fmtCurrency(undefined, '$')).toBe('$ 0.00');
    });
});

// ---------------------------------------------------------------------------
// Tests — fmtCurrency — Bs / VES
// ---------------------------------------------------------------------------

describe('fmtCurrency — Bs and VES', () => {
    test('fmtCurrency(4200, "Bs") → "Bs 4,200.00"', () => {
        expect(fmtCurrency(4200, 'Bs')).toBe('Bs 4,200.00');
    });

    test('fmtCurrency(100, "VES") → "Bs 100.00" (VES treated as Bs)', () => {
        expect(fmtCurrency(100, 'VES')).toBe('Bs 100.00');
    });
});

// ---------------------------------------------------------------------------
// Tests — fmtCurrency — generic symbols (NEW FIX)
// ---------------------------------------------------------------------------

describe('fmtCurrency — generic / new-fix symbols', () => {
    test('fmtCurrency(210000, "COP") → "COP 210,000.00"', () => {
        expect(fmtCurrency(210000, 'COP')).toBe('COP 210,000.00');
    });

    test('fmtCurrency(93, "EUR") → "EUR 93.00"', () => {
        expect(fmtCurrency(93, 'EUR')).toBe('EUR 93.00');
    });

    test('fmtCurrency(840000, "COP") → "COP 840,000.00"', () => {
        expect(fmtCurrency(840000, 'COP')).toBe('COP 840,000.00');
    });

    test('fmtCurrency(0, "COP") → "COP 0.00"', () => {
        expect(fmtCurrency(0, 'COP')).toBe('COP 0.00');
    });
});

// ---------------------------------------------------------------------------
// Tests — buildLocalTotals — filtering
// ---------------------------------------------------------------------------

describe('buildLocalTotals — USD payments are excluded', () => {
    test('only USD payments → returns empty object', () => {
        const payments = [
            { currency: 'USD', amount: 100 },
            { currency: 'USD', amount: 50 },
        ];
        expect(buildLocalTotals(payments)).toEqual({});
    });

    test('undefined / null paymentBreakdown → returns empty object (no crash)', () => {
        expect(buildLocalTotals(null)).toEqual({});
        expect(buildLocalTotals(undefined)).toEqual({});
    });

    test('empty array → returns empty object', () => {
        expect(buildLocalTotals([])).toEqual({});
    });
});

// ---------------------------------------------------------------------------
// Tests — buildLocalTotals — single local currency
// ---------------------------------------------------------------------------

describe('buildLocalTotals — single local currency', () => {
    test('Bs payments only → { Bs: total }', () => {
        const payments = [
            { currency: 'Bs', amount: 2000 },
            { currency: 'Bs', amount: 1000 },
        ];
        expect(buildLocalTotals(payments)).toEqual({ Bs: 3000 });
    });

    test('COP payments only → { COP: total }', () => {
        const payments = [
            { currency: 'COP', amount: 100000 },
            { currency: 'COP', amount: 110000 },
        ];
        expect(buildLocalTotals(payments)).toEqual({ COP: 210000 });
    });

    test('amount as string "1234.50" → parseFloat parses correctly', () => {
        const payments = [{ currency: 'Bs', amount: '1234.50' }];
        expect(buildLocalTotals(payments)).toEqual({ Bs: 1234.5 });
    });

    test('amount = undefined → treated as 0 (does not crash)', () => {
        const payments = [{ currency: 'Bs', amount: undefined }];
        expect(buildLocalTotals(payments)).toEqual({ Bs: 0 });
    });

    test('amount = null → treated as 0', () => {
        const payments = [{ currency: 'COP', amount: null }];
        expect(buildLocalTotals(payments)).toEqual({ COP: 0 });
    });
});

// ---------------------------------------------------------------------------
// Tests — buildLocalTotals — mixed currencies
// ---------------------------------------------------------------------------

describe('buildLocalTotals — Bs and COP are kept separate (NEW FIX)', () => {
    test('Bs + COP payments → { Bs: X, COP: Y } — not collapsed', () => {
        const payments = [
            { currency: 'Bs', amount: 2000 },
            { currency: 'COP', amount: 100000 },
            { currency: 'Bs', amount: 500 },
        ];
        const result = buildLocalTotals(payments);
        expect(result).toEqual({ Bs: 2500, COP: 100000 });
    });

    test('BUG DEMO — naive sum without grouping mixes Bs and COP', () => {
        // Old approach: filter non-USD then reduce all into a single sum
        const naiveSumNonUSD = (payments) =>
            (payments || [])
                .filter((p) => p.currency !== 'USD')
                .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

        const payments = [
            { currency: 'Bs', amount: 2000 },
            { currency: 'COP', amount: 100000 },
        ];

        // Wrong: 102,000 — meaningless mix of two currencies
        expect(naiveSumNonUSD(payments)).toBe(102000);

        // Correct: separate totals
        const result = buildLocalTotals(payments);
        expect(result.Bs).toBe(2000);
        expect(result.COP).toBe(100000);
        expect(Object.keys(result)).toHaveLength(2);
    });

    test('USD mixed in with Bs and COP → USD excluded, others grouped correctly', () => {
        const payments = [
            { currency: 'USD', amount: 200 },
            { currency: 'Bs', amount: 3000 },
            { currency: 'COP', amount: 50000 },
            { currency: 'USD', amount: 50 },
        ];
        const result = buildLocalTotals(payments);
        expect(result).toEqual({ Bs: 3000, COP: 50000 });
        expect(result.USD).toBeUndefined();
    });

    test('multiple payments same currency summed correctly (Bs × 3)', () => {
        const payments = [
            { currency: 'Bs', amount: 1000 },
            { currency: 'Bs', amount: 2000 },
            { currency: 'Bs', amount: 500 },
        ];
        expect(buildLocalTotals(payments)).toEqual({ Bs: 3500 });
    });
});

// ---------------------------------------------------------------------------
// Tests — ZReport totals row: USD + each local currency separately
// ---------------------------------------------------------------------------

describe('ZReport totals row — USD and per-currency local totals', () => {
    test('total row shows separate USD, Bs, and COP values', () => {
        const payments = [
            { currency: 'USD', amount: 300 },
            { currency: 'Bs', amount: 8000 },
            { currency: 'COP', amount: 420000 },
        ];

        const usdTotal = payments
            .filter((p) => p.currency === 'USD')
            .reduce((sum, p) => sum + parseFloat(p.amount), 0);

        const localTotals = buildLocalTotals(payments);

        expect(fmtUSD(usdTotal)).toBe('$ 300.00');
        expect(fmtCurrency(localTotals.Bs, 'Bs')).toBe('Bs 8,000.00');
        expect(fmtCurrency(localTotals.COP, 'COP')).toBe('COP 420,000.00');
    });
});
