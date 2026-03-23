/**
 * Tests: PaymentModal currency list — buildCurrencies deduplication
 *
 * Reproduces the pure logic from PaymentModal.jsx (lines 34-39) that builds
 * the list of selectable currencies at checkout. No React, no DOM.
 *
 * Bug fixed: modal only showed USD + first non-USD currency (used `find`).
 * Fix: modal shows USD + ALL active currencies (uses `map` over full array).
 *
 * To run: npx jest src/__tests__/payment-modal-currencies.test.js
 */

// ---------------------------------------------------------------------------
// Pure helpers reproduced from PaymentModal.jsx (lines 34-39)
// ---------------------------------------------------------------------------

const USD_BASE = { id: 'base', symbol: 'USD', name: 'Dólar', rate: 1, is_anchor: true };

/**
 * Builds the deduplicated currency array shown in the modal.
 * Always prepends USD anchor; deduplicates by symbol.
 *
 * @param {Array} activeCurrencies - from ConfigContext.getActiveCurrencies()
 * @returns {Array} currencies to display in modal
 */
const buildCurrencies = (activeCurrencies) => {
    const all = [USD_BASE, ...activeCurrencies];
    return all.filter(
        (curr, index, self) => index === self.findIndex((c) => c.symbol === curr.symbol)
    );
};

/**
 * OLD (buggy) behavior: only prepended USD + found the first non-USD currency.
 * This is what caused COP to be omitted when Bs was also active.
 */
const buildCurrencies_OLD = (activeCurrencies) => {
    const firstNonUsd = activeCurrencies.find((c) => c.symbol !== 'USD');
    if (!firstNonUsd) return [USD_BASE];
    return [USD_BASE, firstNonUsd];
};

/**
 * Resolve the default currency to pre-select in the modal.
 * Prefers is_default non-USD, falls back to first non-USD, finally USD.
 */
const resolveDefaultCurrency = (currencies) => {
    return (
        currencies.find((c) => c.symbol !== 'USD' && c.is_default) ||
        currencies.find((c) => c.symbol !== 'USD') ||
        currencies[0] ||
        null
    );
};

// ---------------------------------------------------------------------------
// Mock data helpers
// ---------------------------------------------------------------------------

const makeCurrency = (symbol, opts = {}) => ({
    id: opts.id || symbol,
    symbol,
    name: opts.name || symbol,
    rate: opts.rate || 1,
    is_anchor: opts.is_anchor || false,
    is_default: opts.is_default || false,
    is_active: opts.is_active !== undefined ? opts.is_active : true,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildCurrencies — basic cases', () => {
    test('empty activeCurrencies → only USD in list', () => {
        const result = buildCurrencies([]);
        expect(result.map((c) => c.symbol)).toEqual(['USD']);
    });

    test('activeCurrencies with only USD already included → deduplicated to single USD', () => {
        const active = [makeCurrency('USD', { is_anchor: true })];
        const result = buildCurrencies(active);
        expect(result.map((c) => c.symbol)).toEqual(['USD']);
    });

    test('USD + Bs → [USD, Bs]', () => {
        const active = [makeCurrency('Bs', { rate: 40 })];
        const result = buildCurrencies(active);
        expect(result.map((c) => c.symbol)).toEqual(['USD', 'Bs']);
    });

    test('USD + Bs + COP → [USD, Bs, COP] (the bug was only showing USD + Bs)', () => {
        const active = [makeCurrency('Bs', { rate: 40 }), makeCurrency('COP', { rate: 4200 })];
        const result = buildCurrencies(active);
        expect(result.map((c) => c.symbol)).toEqual(['USD', 'Bs', 'COP']);
    });

    test('USD + Bs + COP + EUR → all 4 currencies present', () => {
        const active = [
            makeCurrency('Bs', { rate: 40 }),
            makeCurrency('COP', { rate: 4200 }),
            makeCurrency('EUR', { rate: 1.1 }),
        ];
        const result = buildCurrencies(active);
        expect(result.map((c) => c.symbol)).toEqual(['USD', 'Bs', 'COP', 'EUR']);
    });
});

describe('buildCurrencies — deduplication', () => {
    test('two Bs entries (BCV and Paralelo, same symbol) → only one Bs in list', () => {
        const active = [
            makeCurrency('Bs', { id: 'bs-bcv', rate: 40, name: 'Bolívar BCV' }),
            makeCurrency('Bs', { id: 'bs-paralelo', rate: 42, name: 'Bolívar Paralelo' }),
        ];
        const result = buildCurrencies(active);
        expect(result.filter((c) => c.symbol === 'Bs').length).toBe(1);
        expect(result.map((c) => c.symbol)).toEqual(['USD', 'Bs']);
    });

    test('deduplication keeps the first occurrence (BCV rate, not Paralelo)', () => {
        const active = [
            makeCurrency('Bs', { id: 'bs-bcv', rate: 40 }),
            makeCurrency('Bs', { id: 'bs-paralelo', rate: 42 }),
        ];
        const result = buildCurrencies(active);
        const bs = result.find((c) => c.symbol === 'Bs');
        expect(bs.rate).toBe(40); // first one wins
    });
});

describe('OLD vs NEW behavior — demonstrating the bug', () => {
    const active = [makeCurrency('Bs', { rate: 40 }), makeCurrency('COP', { rate: 4200 })];

    test('OLD buildCurrencies with [USD, Bs, COP] only returns [USD, Bs] — BUG', () => {
        const result = buildCurrencies_OLD(active);
        expect(result.map((c) => c.symbol)).toEqual(['USD', 'Bs']);
        expect(result.map((c) => c.symbol)).not.toContain('COP'); // COP omitted
    });

    test('NEW buildCurrencies with [USD, Bs, COP] returns [USD, Bs, COP] — CORRECT', () => {
        const result = buildCurrencies(active);
        expect(result.map((c) => c.symbol)).toEqual(['USD', 'Bs', 'COP']);
        expect(result.map((c) => c.symbol)).toContain('COP'); // COP present
    });

    test('difference: OLD returns 2 items, NEW returns 3 items for [Bs, COP] active', () => {
        expect(buildCurrencies_OLD(active).length).toBe(2);
        expect(buildCurrencies(active).length).toBe(3);
    });
});

describe('resolveDefaultCurrency — modal pre-selection', () => {
    test('with is_default non-USD → selects it', () => {
        const currencies = [
            USD_BASE,
            makeCurrency('Bs', { rate: 40, is_default: true }),
            makeCurrency('COP', { rate: 4200 }),
        ];
        const def = resolveDefaultCurrency(currencies);
        expect(def.symbol).toBe('Bs');
    });

    test('no is_default set → falls back to first non-USD', () => {
        const currencies = [
            USD_BASE,
            makeCurrency('Bs', { rate: 40 }),
            makeCurrency('COP', { rate: 4200 }),
        ];
        const def = resolveDefaultCurrency(currencies);
        expect(def.symbol).toBe('Bs');
    });

    test('only USD active → resolveDefaultCurrency returns USD (last resort)', () => {
        const currencies = [USD_BASE];
        const def = resolveDefaultCurrency(currencies);
        expect(def.symbol).toBe('USD');
    });
});

describe('buildCurrencies — solo USD activo (no local currency button)', () => {
    test('only USD → list has length 1', () => {
        const result = buildCurrencies([]);
        expect(result.length).toBe(1);
    });

    test('only USD → no non-USD entry in list', () => {
        const result = buildCurrencies([]);
        const nonUsd = result.filter((c) => c.symbol !== 'USD');
        expect(nonUsd.length).toBe(0);
    });
});

describe('buildCurrencies — result items preserve rate and metadata', () => {
    test('Bs entry in result has correct rate', () => {
        const active = [makeCurrency('Bs', { rate: 40.5 })];
        const result = buildCurrencies(active);
        const bs = result.find((c) => c.symbol === 'Bs');
        expect(bs.rate).toBe(40.5);
    });

    test('COP entry in result has correct rate', () => {
        const active = [makeCurrency('Bs', { rate: 40 }), makeCurrency('COP', { rate: 4200 })];
        const result = buildCurrencies(active);
        const cop = result.find((c) => c.symbol === 'COP');
        expect(cop.rate).toBe(4200);
    });

    test('USD base entry always has rate 1', () => {
        const result = buildCurrencies([makeCurrency('Bs', { rate: 40 })]);
        const usd = result.find((c) => c.symbol === 'USD');
        expect(usd.rate).toBe(1);
    });
});
