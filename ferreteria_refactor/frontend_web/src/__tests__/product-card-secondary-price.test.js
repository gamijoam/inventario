/**
 * Tests: ProductCard secondary price — dynamic currency toggle + symbol
 *
 * Reproduces the pure logic from ProductCard.jsx for computing the secondary
 * (local-currency) price shown on product tiles. No React, no DOM.
 *
 * Bug fixed: ProductCard hardcoded `convertProductPrice(product, 'VES')`.
 * When the active local currency is COP (not VES/Bs), there was no VES rate
 * so getExchangeRate('VES') returned 1 → secondary price = price × 1 = wrong.
 *
 * Fix: secondary currency symbol is read dynamically from secondaryCurrency
 * context, so COP shops see COP prices and Bs shops see Bs prices.
 *
 * To run: npx jest src/__tests__/product-card-secondary-price.test.js
 */

// ---------------------------------------------------------------------------
// Pure helpers reproduced from ProductCard.jsx
// ---------------------------------------------------------------------------

/**
 * Resolves the currency code/symbol to pass to convertProductPrice.
 * Returns null if no valid currency is configured.
 */
const resolveSecondaryCode = (secondaryCurrency) => {
    if (!secondaryCurrency) return null;
    return secondaryCurrency.currency_code || secondaryCurrency.symbol || null;
};

/**
 * Compute the secondary price to show on the card.
 *
 * @param {object}   product              - product object with price_usd
 * @param {object}   secondaryCurrency    - from ConfigContext (null if none)
 * @param {boolean}  showSecondaryPrice   - toggle from localStorage/state
 * @param {function} convertProductPrice  - (product, currencyCode) => number
 * @returns {number} converted price or 0
 */
const calcSecondaryPrice = (product, secondaryCurrency, showSecondaryPrice, convertProductPrice) => {
    const secCode = resolveSecondaryCode(secondaryCurrency);
    if (!showSecondaryPrice || !secCode || !convertProductPrice) return 0;
    return convertProductPrice(product, secCode);
};

/**
 * OLD (buggy) behavior: always converts to 'VES' regardless of active currency.
 */
const calcSecondaryPrice_OLD = (product, _secondaryCurrency, showSecondaryPrice, convertProductPrice) => {
    if (!showSecondaryPrice || !convertProductPrice) return 0;
    return convertProductPrice(product, 'VES'); // hardcoded!
};

/**
 * Parse localStorage value for the secondary-price toggle.
 * @param {string|null} stored - value from localStorage.getItem(key)
 * @returns {boolean}
 */
const parseShowSecondaryPrice = (stored) => stored === 'true';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

const makeProduct = (priceUsd) => ({ id: 1, name: 'Product', price_usd: priceUsd });

/**
 * Build a mock convertProductPrice function backed by a static rate map.
 * Mimics: return product.price_usd * getExchangeRate(currencyCode)
 */
const mockConvertProductPrice = (rateMap) => (product, currencyCode) => {
    const code = String(currencyCode || '').trim().toUpperCase();
    const rate = rateMap[code] !== undefined ? rateMap[code] : 1;
    return product.price_usd * rate;
};

const makeCurrency = (symbol, currencyCode, opts = {}) => ({
    symbol,
    currency_code: currencyCode,
    currency_symbol: symbol,
    rate: opts.rate || 1,
    is_default: opts.is_default || false,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('calcSecondaryPrice — showSecondaryPrice = false', () => {
    const product = makeProduct(50);
    const cop = makeCurrency('COP', 'COP', { rate: 4200 });
    const convert = mockConvertProductPrice({ COP: 4200 });

    test('returns 0 when showSecondaryPrice is false, regardless of currency', () => {
        expect(calcSecondaryPrice(product, cop, false, convert)).toBe(0);
    });

    test('returns 0 when showSecondaryPrice is false and secondaryCurrency is null', () => {
        expect(calcSecondaryPrice(product, null, false, convert)).toBe(0);
    });

    test('returns 0 when showSecondaryPrice is false and convertProductPrice is null', () => {
        expect(calcSecondaryPrice(product, cop, false, null)).toBe(0);
    });
});

describe('calcSecondaryPrice — secondaryCurrency is null or missing', () => {
    const product = makeProduct(50);
    const convert = mockConvertProductPrice({ COP: 4200 });

    test('returns 0 when secondaryCurrency is null', () => {
        expect(calcSecondaryPrice(product, null, true, convert)).toBe(0);
    });

    test('returns 0 when secondaryCurrency is undefined', () => {
        expect(calcSecondaryPrice(product, undefined, true, convert)).toBe(0);
    });

    test('returns 0 when convertProductPrice is null', () => {
        const cop = makeCurrency('COP', 'COP');
        expect(calcSecondaryPrice(product, cop, true, null)).toBe(0);
    });
});

describe('calcSecondaryPrice — COP active', () => {
    const product = makeProduct(50);
    const cop = makeCurrency('COP', 'COP', { rate: 4200 });
    const convert = mockConvertProductPrice({ COP: 4200 });

    test('$50 product with COP at 4200 → secondary price = 210,000', () => {
        const result = calcSecondaryPrice(product, cop, true, convert);
        expect(result).toBe(210000);
    });

    test('currency code passed to converter is COP (not VES)', () => {
        let capturedCode = null;
        const spyConvert = (prod, code) => {
            capturedCode = code;
            return prod.price_usd * 4200;
        };
        calcSecondaryPrice(product, cop, true, spyConvert);
        expect(capturedCode).toBe('COP');
        expect(capturedCode).not.toBe('VES');
    });
});

describe('calcSecondaryPrice — Bs active', () => {
    const product = makeProduct(50);
    const bs = makeCurrency('Bs', 'VES', { rate: 40 });
    const convert = mockConvertProductPrice({ VES: 40 });

    test('$50 product with Bs at 40 → secondary price = 2000', () => {
        const result = calcSecondaryPrice(product, bs, true, convert);
        expect(result).toBe(2000);
    });

    test('currency code passed to converter is VES (currency_code of Bs)', () => {
        let capturedCode = null;
        const spyConvert = (prod, code) => {
            capturedCode = code;
            return prod.price_usd * 40;
        };
        calcSecondaryPrice(product, bs, true, spyConvert);
        expect(capturedCode).toBe('VES');
    });
});

describe('calcSecondaryPrice — symbol resolution (currency_code vs symbol fallback)', () => {
    const product = makeProduct(100);
    const convert = mockConvertProductPrice({ COP: 4200, BS: 40 });

    test('uses currency_code when present', () => {
        const curr = { currency_code: 'COP', symbol: 'WRONG' };
        const code = resolveSecondaryCode(curr);
        expect(code).toBe('COP');
    });

    test('falls back to symbol when currency_code is absent', () => {
        const curr = { symbol: 'COP' };
        const code = resolveSecondaryCode(curr);
        expect(code).toBe('COP');
    });

    test('returns null for null currency', () => {
        expect(resolveSecondaryCode(null)).toBeNull();
    });

    test('returns null when both currency_code and symbol are absent', () => {
        expect(resolveSecondaryCode({})).toBeNull();
    });
});

describe('OLD vs NEW — demonstrating the VES hardcode bug', () => {
    const product = makeProduct(50);
    const cop = makeCurrency('COP', 'COP', { rate: 4200 });

    test('OLD: no VES rate → returns price×1 = 50 (wrong, looks like USD price)', () => {
        // rateMap has no VES, so fallback = 1
        const convert = mockConvertProductPrice({ COP: 4200 }); // no VES entry
        const result = calcSecondaryPrice_OLD(product, cop, true, convert);
        expect(result).toBe(50); // $50 × 1 — completely wrong for a COP shop
    });

    test('NEW: COP rate used → returns 210,000 (correct local price)', () => {
        const convert = mockConvertProductPrice({ COP: 4200 });
        const result = calcSecondaryPrice(product, cop, true, convert);
        expect(result).toBe(210000);
    });

    test('difference is dramatic: OLD gives 50, NEW gives 210,000 for same inputs', () => {
        const convert = mockConvertProductPrice({ COP: 4200 });
        const oldResult = calcSecondaryPrice_OLD(product, cop, true, convert);
        const newResult = calcSecondaryPrice(product, cop, true, convert);
        expect(oldResult).toBe(50);
        expect(newResult).toBe(210000);
        expect(newResult).not.toBe(oldResult);
    });
});

describe('parseShowSecondaryPrice — localStorage parsing', () => {
    test('"true" string → true', () => {
        expect(parseShowSecondaryPrice('true')).toBe(true);
    });

    test('"false" string → false', () => {
        expect(parseShowSecondaryPrice('false')).toBe(false);
    });

    test('null (key not set) → false', () => {
        expect(parseShowSecondaryPrice(null)).toBe(false);
    });

    test('undefined → false', () => {
        expect(parseShowSecondaryPrice(undefined)).toBe(false);
    });

    test('"1" → false (only exact "true" is truthy)', () => {
        expect(parseShowSecondaryPrice('1')).toBe(false);
    });

    test('"" (empty string) → false', () => {
        expect(parseShowSecondaryPrice('')).toBe(false);
    });
});

describe('calcSecondaryPrice — additional price/rate combos', () => {
    test('$50 × COP 4200 → 210,000', () => {
        const product = makeProduct(50);
        const cop = makeCurrency('COP', 'COP');
        const convert = mockConvertProductPrice({ COP: 4200 });
        expect(calcSecondaryPrice(product, cop, true, convert)).toBe(210000);
    });

    test('$50 × Bs 40 → 2,000', () => {
        const product = makeProduct(50);
        const bs = makeCurrency('Bs', 'VES');
        const convert = mockConvertProductPrice({ VES: 40 });
        expect(calcSecondaryPrice(product, bs, true, convert)).toBe(2000);
    });

    test('$0 product → secondary price is 0 regardless of currency', () => {
        const product = makeProduct(0);
        const cop = makeCurrency('COP', 'COP');
        const convert = mockConvertProductPrice({ COP: 4200 });
        expect(calcSecondaryPrice(product, cop, true, convert)).toBe(0);
    });
});
