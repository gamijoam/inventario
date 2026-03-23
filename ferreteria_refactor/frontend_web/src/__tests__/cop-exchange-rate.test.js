/**
 * Tests: getExchangeRate, getPrimaryLocalCurrency, and convertPrice logic
 *
 * These are pure functions extracted from ConfigContext.jsx (lines 172-220).
 * No React context, no HTTP calls — a mock `currencies` array is used directly.
 *
 * To run (once Jest is installed):
 *   npx jest src/__tests__/cop-exchange-rate.test.js
 */

// ---------------------------------------------------------------------------
// Pure helper factory — reproduces ConfigContext.jsx logic without React state
// ---------------------------------------------------------------------------

/**
 * Build the three ConfigContext helpers bound to a static currencies array.
 * Mirrors ConfigContext.jsx lines 172-220.
 */
const buildHelpers = (currencies) => {
    const getExchangeRate = (symbol) => {
        if (!symbol) return 1;
        const normalize = (s) => String(s).trim().toUpperCase();
        const target = normalize(symbol);

        const curr = currencies.find(
            (c) =>
                normalize(c.symbol) === target ||
                normalize(c.currency_symbol) === target ||
                normalize(c.currency_code) === target
        );
        return curr ? parseFloat(curr.rate) : 1;
    };

    const getActiveCurrencies = () => {
        if (!Array.isArray(currencies)) return [];
        const activeCurrencies = currencies.filter((c) => c.is_active);
        return activeCurrencies.map((curr) => {
            const code = (curr.currency_code || curr.symbol || '').trim().toUpperCase();
            return {
                id: curr.id,
                name: curr.name || code,
                symbol: (curr.currency_symbol || curr.symbol || '').trim(),
                currency_code: code,
                currency_symbol: (curr.currency_symbol || curr.symbol || '').trim(),
                rate: curr.rate,
                is_active: curr.is_active,
                is_default: curr.is_default,
                is_anchor: curr.is_anchor,
            };
        });
    };

    const getPrimaryLocalCurrency = () => {
        const active = getActiveCurrencies();
        return (
            active.find(
                (c) => c.currency_code !== 'USD' && c.currency_symbol !== '$' && c.is_default
            ) ||
            active.find(
                (c) => c.currency_code !== 'USD' && c.currency_symbol !== '$'
            ) ||
            null
        );
    };

    const convertPrice = (priceInAnchor, targetSymbol) => {
        const rate = getExchangeRate(targetSymbol);
        return priceInAnchor * rate;
    };

    return { getExchangeRate, getActiveCurrencies, getPrimaryLocalCurrency, convertPrice };
};

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

/** Typical multi-currency setup: USD anchor + COP as default local currency */
const MOCK_CURRENCIES_USD_COP = [
    {
        id: 1,
        name: 'US Dollar',
        symbol: 'USD',
        currency_code: 'USD',
        currency_symbol: '$',
        rate: 1,
        is_active: true,
        is_default: false,
        is_anchor: true,
    },
    {
        id: 2,
        name: 'Peso Colombiano',
        symbol: 'COP',
        currency_code: 'COP',
        currency_symbol: 'COP',
        rate: 4200,
        is_active: true,
        is_default: true,
        is_anchor: false,
    },
];

/** Setup with only USD active (no local currency) */
const MOCK_CURRENCIES_USD_ONLY = [
    {
        id: 1,
        name: 'US Dollar',
        symbol: 'USD',
        currency_code: 'USD',
        currency_symbol: '$',
        rate: 1,
        is_active: true,
        is_default: true,
        is_anchor: true,
    },
];

/** Setup with USD + inactive COP */
const MOCK_CURRENCIES_COP_INACTIVE = [
    {
        id: 1,
        name: 'US Dollar',
        symbol: 'USD',
        currency_code: 'USD',
        currency_symbol: '$',
        rate: 1,
        is_active: true,
        is_default: true,
        is_anchor: true,
    },
    {
        id: 2,
        name: 'Peso Colombiano',
        symbol: 'COP',
        currency_code: 'COP',
        currency_symbol: 'COP',
        rate: 4200,
        is_active: false,  // inactive!
        is_default: false,
        is_anchor: false,
    },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getExchangeRate — USD + COP setup', () => {
    const { getExchangeRate } = buildHelpers(MOCK_CURRENCIES_USD_COP);

    test('getExchangeRate("COP") returns 4200', () => {
        expect(getExchangeRate('COP')).toBe(4200);
    });

    test('getExchangeRate is case-insensitive: "cop" returns 4200', () => {
        expect(getExchangeRate('cop')).toBe(4200);
    });

    test('getExchangeRate("Cop") (mixed case) returns 4200', () => {
        expect(getExchangeRate('Cop')).toBe(4200);
    });

    test('getExchangeRate("USD") returns 1', () => {
        expect(getExchangeRate('USD')).toBe(1);
    });

    test('getExchangeRate("$") resolves via currency_symbol → 1', () => {
        expect(getExchangeRate('$')).toBe(1);
    });

    test('getExchangeRate("UNKNOWN") returns 1 (fallback)', () => {
        expect(getExchangeRate('UNKNOWN')).toBe(1);
    });

    test('getExchangeRate(null) returns 1', () => {
        expect(getExchangeRate(null)).toBe(1);
    });
});

describe('getPrimaryLocalCurrency — USD + COP setup', () => {
    const { getPrimaryLocalCurrency } = buildHelpers(MOCK_CURRENCIES_USD_COP);

    test('returns the COP entry', () => {
        const primary = getPrimaryLocalCurrency();
        expect(primary).not.toBeNull();
        expect(primary.currency_code).toBe('COP');
    });

    test('returned entry has correct rate', () => {
        const primary = getPrimaryLocalCurrency();
        expect(primary.rate).toBe(4200);
    });

    test('returned entry is_default = true', () => {
        const primary = getPrimaryLocalCurrency();
        expect(primary.is_default).toBe(true);
    });

    test('returned entry is not the USD anchor', () => {
        const primary = getPrimaryLocalCurrency();
        expect(primary.currency_code).not.toBe('USD');
        expect(primary.currency_symbol).not.toBe('$');
    });
});

describe('getPrimaryLocalCurrency — USD only', () => {
    const { getPrimaryLocalCurrency } = buildHelpers(MOCK_CURRENCIES_USD_ONLY);

    test('returns null when only USD is active', () => {
        expect(getPrimaryLocalCurrency()).toBeNull();
    });
});

describe('getPrimaryLocalCurrency — COP inactive', () => {
    const { getPrimaryLocalCurrency } = buildHelpers(MOCK_CURRENCIES_COP_INACTIVE);

    test('returns null when COP is inactive', () => {
        // inactive currencies are excluded by getActiveCurrencies
        expect(getPrimaryLocalCurrency()).toBeNull();
    });
});

describe('getActiveCurrencies filtering', () => {
    const { getActiveCurrencies } = buildHelpers(MOCK_CURRENCIES_COP_INACTIVE);

    test('inactive COP is excluded from active currencies list', () => {
        const active = getActiveCurrencies();
        const cop = active.find((c) => c.currency_code === 'COP');
        expect(cop).toBeUndefined();
    });

    test('active USD is included', () => {
        const active = getActiveCurrencies();
        const usd = active.find((c) => c.currency_code === 'USD');
        expect(usd).toBeDefined();
    });
});

describe('convertPrice — USD + COP setup', () => {
    const { convertPrice } = buildHelpers(MOCK_CURRENCIES_USD_COP);

    test('convertPrice(100, "COP") = 420,000', () => {
        expect(convertPrice(100, 'COP')).toBe(420000);
    });

    test('convertPrice(1, "COP") = 4200', () => {
        expect(convertPrice(1, 'COP')).toBe(4200);
    });

    test('convertPrice(0, "COP") = 0', () => {
        expect(convertPrice(0, 'COP')).toBe(0);
    });

    test('convertPrice(50, "USD") = 50 (anchor rate = 1)', () => {
        expect(convertPrice(50, 'USD')).toBe(50);
    });

    test('convertPrice(50, "UNKNOWN") = 50 (fallback rate = 1)', () => {
        expect(convertPrice(50, 'UNKNOWN')).toBe(50);
    });

    test('convertPrice is case-insensitive: convertPrice(100, "cop") = 420,000', () => {
        expect(convertPrice(100, 'cop')).toBe(420000);
    });
});

describe('getExchangeRate — rate normalised to float', () => {
    // Rate comes from API as string sometimes; parseFloat must handle it
    const currencies = [
        {
            id: 2,
            name: 'Peso Colombiano',
            symbol: 'COP',
            currency_code: 'COP',
            currency_symbol: 'COP',
            rate: '4200.00',   // string from API
            is_active: true,
            is_default: true,
            is_anchor: false,
        },
    ];
    const { getExchangeRate } = buildHelpers(currencies);

    test('rate returned as a number even when stored as string', () => {
        const rate = getExchangeRate('COP');
        expect(typeof rate).toBe('number');
        expect(rate).toBe(4200);
    });
});
