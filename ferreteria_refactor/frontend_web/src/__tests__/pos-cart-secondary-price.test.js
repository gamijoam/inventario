/**
 * Tests: POSCart secondary price — dynamic currency support
 *
 * Reproduces the pure logic from POSCart.jsx for computing secondary
 * (local-currency) subtotals and totals shown in the cart. No React, no DOM.
 *
 * Bug fixed: POSCart used `subtotal_bs` (hardcoded VES). When the active local
 * currency is COP, the wrong field was read, producing incorrect secondary
 * prices.
 *
 * Fix: secondary amounts are calculated dynamically using `subtotal_usd` ×
 * `secondaryCurrency.rate`, so COP shops see COP totals and Bs shops see Bs.
 *
 * To run: npx jest src/__tests__/pos-cart-secondary-price.test.js
 */

// ---------------------------------------------------------------------------
// Pure helpers reproduced from POSCart.jsx
// ---------------------------------------------------------------------------

/**
 * Calculates secondary (local-currency) price for a single cart item.
 * POSCart.jsx line ~343.
 */
const calcItemSecondary = (item, secondaryCurrency) => {
    if (!secondaryCurrency) return null;
    return item.subtotal_usd * parseFloat(secondaryCurrency.rate || 1);
};

/**
 * Calculates secondary (local-currency) total for the whole cart.
 * POSCart.jsx line ~451.
 */
const calcTotalSecondary = (totalUSD, secondaryCurrency) => {
    if (!secondaryCurrency) return null;
    return totalUSD * parseFloat(secondaryCurrency.rate || 1);
};

/**
 * Returns the primary active non-USD, non-anchor currency.
 * Prefers the one with is_default = true; falls back to first in array.
 */
const getPrimaryLocalCurrency = (currencies) => {
    const active = currencies.filter(
        (c) => c.is_active && !c.is_anchor && c.currency_code !== 'USD' && c.currency_symbol !== '$'
    );
    return active.find((c) => c.is_default) || active[0] || null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeItem = (subtotalUsd) => ({ id: 1, name: 'Item', subtotal_usd: subtotalUsd });

const makeCurrency = (code, symbol, rate, opts = {}) => ({
    currency_code: code,
    currency_symbol: symbol,
    rate,
    is_active: opts.is_active !== undefined ? opts.is_active : true,
    is_anchor: opts.is_anchor || false,
    is_default: opts.is_default || false,
});

// ---------------------------------------------------------------------------
// calcItemSecondary — Bs (VES, rate=40)
// ---------------------------------------------------------------------------

describe('calcItemSecondary — Bs at rate 40', () => {
    const bs = makeCurrency('VES', 'Bs', 40);

    test('item subtotal $50 with Bs rate 40 → 2,000 Bs', () => {
        expect(calcItemSecondary(makeItem(50), bs)).toBe(2000);
    });

    test('item subtotal $100 with Bs rate 40 → 4,000 Bs', () => {
        expect(calcItemSecondary(makeItem(100), bs)).toBe(4000);
    });

    test('item subtotal $0 with Bs rate 40 → 0 Bs', () => {
        expect(calcItemSecondary(makeItem(0), bs)).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// calcItemSecondary — COP (rate=4200)
// ---------------------------------------------------------------------------

describe('calcItemSecondary — COP at rate 4200', () => {
    const cop = makeCurrency('COP', 'COP', 4200);

    test('item subtotal $50 with COP rate 4200 → 210,000 COP', () => {
        expect(calcItemSecondary(makeItem(50), cop)).toBe(210000);
    });

    test('item subtotal $100 with COP rate 4200 → 420,000 COP', () => {
        expect(calcItemSecondary(makeItem(100), cop)).toBe(420000);
    });
});

// ---------------------------------------------------------------------------
// calcItemSecondary — null / undefined secondaryCurrency
// ---------------------------------------------------------------------------

describe('calcItemSecondary — no secondary currency', () => {
    test('secondaryCurrency = null → returns null (nothing to display)', () => {
        expect(calcItemSecondary(makeItem(50), null)).toBeNull();
    });

    test('secondaryCurrency = undefined → returns null', () => {
        expect(calcItemSecondary(makeItem(50), undefined)).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// calcItemSecondary — rate edge cases
// ---------------------------------------------------------------------------

describe('calcItemSecondary — rate edge cases', () => {
    test('rate as string "40" is parsed via parseFloat → 2,000', () => {
        const bs = makeCurrency('VES', 'Bs', '40');
        expect(calcItemSecondary(makeItem(50), bs)).toBe(2000);
    });

    test('rate = 0 falls back to 1 via (rate || 1) → secondary equals USD', () => {
        const zero = makeCurrency('XYZ', 'XYZ', 0);
        // rate=0 is falsy → parseFloat(0 || 1) = 1
        expect(calcItemSecondary(makeItem(50), zero)).toBe(50);
    });

    test('rate = 1 (USD-equivalent) → secondary price equals USD price', () => {
        const usdLike = makeCurrency('USD2', '$', 1);
        expect(calcItemSecondary(makeItem(75), usdLike)).toBe(75);
    });

    test('EUR at rate 0.93: $100 → 93 EUR (approx)', () => {
        const eur = makeCurrency('EUR', 'EUR', 0.93);
        expect(calcItemSecondary(makeItem(100), eur)).toBeCloseTo(93, 5);
    });
});

// ---------------------------------------------------------------------------
// calcTotalSecondary — Bs and COP
// ---------------------------------------------------------------------------

describe('calcTotalSecondary — Bs and COP', () => {
    test('total $200 with Bs rate 40 → 8,000 Bs', () => {
        const bs = makeCurrency('VES', 'Bs', 40);
        expect(calcTotalSecondary(200, bs)).toBe(8000);
    });

    test('total $200 with COP rate 4200 → 840,000 COP', () => {
        const cop = makeCurrency('COP', 'COP', 4200);
        expect(calcTotalSecondary(200, cop)).toBe(840000);
    });

    test('total $0 → secondary total is 0 regardless of rate', () => {
        const bs = makeCurrency('VES', 'Bs', 40);
        expect(calcTotalSecondary(0, bs)).toBe(0);
    });

    test('total $100 with EUR rate 0.93 → ~93 EUR', () => {
        const eur = makeCurrency('EUR', 'EUR', 0.93);
        expect(calcTotalSecondary(100, eur)).toBeCloseTo(93, 5);
    });
});

// ---------------------------------------------------------------------------
// calcTotalSecondary — null currency
// ---------------------------------------------------------------------------

describe('calcTotalSecondary — no secondary currency', () => {
    test('secondaryCurrency = null → returns null', () => {
        expect(calcTotalSecondary(200, null)).toBeNull();
    });

    test('secondaryCurrency = undefined → returns null', () => {
        expect(calcTotalSecondary(200, undefined)).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Consistency: sum of item secondaries === calcTotalSecondary
// ---------------------------------------------------------------------------

describe('consistency — sum of item secondaries equals total secondary', () => {
    test('Bs: sum of 3 items matches total', () => {
        const bs = makeCurrency('VES', 'Bs', 40);
        const items = [makeItem(10), makeItem(20), makeItem(30)];
        const totalUSD = 60;

        const sumItems = items.reduce((acc, it) => acc + calcItemSecondary(it, bs), 0);
        const totalSec = calcTotalSecondary(totalUSD, bs);

        expect(sumItems).toBe(totalSec);
    });

    test('COP: sum of 3 items matches total', () => {
        const cop = makeCurrency('COP', 'COP', 4200);
        const items = [makeItem(50), makeItem(100), makeItem(25)];
        const totalUSD = 175;

        const sumItems = items.reduce((acc, it) => acc + calcItemSecondary(it, cop), 0);
        const totalSec = calcTotalSecondary(totalUSD, cop);

        expect(sumItems).toBe(totalSec);
    });
});

// ---------------------------------------------------------------------------
// BUG DEMO: old subtotal_bs approach gives wrong result for COP shops
// ---------------------------------------------------------------------------

describe('BUG DEMO — old hardcoded subtotal_bs approach', () => {
    /**
     * OLD behavior: POSCart read item.subtotal_bs directly.
     * For COP shops that field is absent (or zero), so the displayed amount was wrong.
     */
    const calcItemSecondary_OLD = (item) => item.subtotal_bs || 0;

    test('OLD: item with only subtotal_usd, no subtotal_bs → returns 0 (wrong)', () => {
        const item = { subtotal_usd: 50 }; // no subtotal_bs field
        expect(calcItemSecondary_OLD(item)).toBe(0); // wrong for COP shop
    });

    test('NEW: same item with COP secondaryCurrency → 210,000 (correct)', () => {
        const cop = makeCurrency('COP', 'COP', 4200);
        const item = { subtotal_usd: 50 };
        expect(calcItemSecondary(item, cop)).toBe(210000);
    });
});

// ---------------------------------------------------------------------------
// getPrimaryLocalCurrency
// ---------------------------------------------------------------------------

describe('getPrimaryLocalCurrency — single currency scenarios', () => {
    test('only VES active → returns VES', () => {
        const currencies = [
            makeCurrency('VES', 'Bs', 40, { is_active: true, is_default: true }),
        ];
        const result = getPrimaryLocalCurrency(currencies);
        expect(result).not.toBeNull();
        expect(result.currency_code).toBe('VES');
    });

    test('only USD active (anchor) → returns null', () => {
        const currencies = [
            makeCurrency('USD', '$', 1, { is_active: true, is_anchor: true }),
        ];
        expect(getPrimaryLocalCurrency(currencies)).toBeNull();
    });

    test('empty array → returns null', () => {
        expect(getPrimaryLocalCurrency([])).toBeNull();
    });

    test('all currencies inactive → returns null', () => {
        const currencies = [
            makeCurrency('VES', 'Bs', 40, { is_active: false }),
            makeCurrency('COP', 'COP', 4200, { is_active: false }),
        ];
        expect(getPrimaryLocalCurrency(currencies)).toBeNull();
    });
});

describe('getPrimaryLocalCurrency — is_default selection when both VES and COP active', () => {
    test('VES is_default=true → returns VES (not COP)', () => {
        const currencies = [
            makeCurrency('VES', 'Bs', 40, { is_active: true, is_default: true }),
            makeCurrency('COP', 'COP', 4200, { is_active: true, is_default: false }),
        ];
        const result = getPrimaryLocalCurrency(currencies);
        expect(result.currency_code).toBe('VES');
    });

    test('CRITICAL — COP is_default=true → returns COP, NOT VES', () => {
        const currencies = [
            makeCurrency('VES', 'Bs', 40, { is_active: true, is_default: false }),
            makeCurrency('COP', 'COP', 4200, { is_active: true, is_default: true }),
        ];
        const result = getPrimaryLocalCurrency(currencies);
        expect(result.currency_code).toBe('COP');
        expect(result.currency_code).not.toBe('VES');
    });

    test('neither is_default → returns first in filtered array (VES if VES is first)', () => {
        const currencies = [
            makeCurrency('VES', 'Bs', 40, { is_active: true, is_default: false }),
            makeCurrency('COP', 'COP', 4200, { is_active: true, is_default: false }),
        ];
        const result = getPrimaryLocalCurrency(currencies);
        // No is_default set → falls back to active[0]
        expect(result).not.toBeNull();
        expect(result.currency_code).toBe('VES');
    });

    test('USD among currencies is ignored even if is_default', () => {
        const currencies = [
            makeCurrency('USD', '$', 1, { is_active: true, is_anchor: true }),
            makeCurrency('VES', 'Bs', 40, { is_active: true, is_default: false }),
        ];
        const result = getPrimaryLocalCurrency(currencies);
        expect(result.currency_code).toBe('VES');
    });
});
