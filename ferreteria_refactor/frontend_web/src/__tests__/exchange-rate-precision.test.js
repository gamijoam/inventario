/**
 * Tests: Exchange rate precision — Numeric(20,8) vs Numeric(14,4)
 *
 * These tests demonstrate why storing exchange rates with only 4 decimal places
 * (Numeric 14,4) causes data loss for micro-unit rates like COP→USD (0.000269).
 * The fix uses Numeric(20,8), which preserves all 8 significant decimals.
 *
 * No React, no imports — functions reproduced inline.
 *
 * To run: npx jest src/__tests__/exchange-rate-precision.test.js
 */

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Round to N decimal places using EPSILON trick to avoid IEEE-754 drift */
const roundN = (num, decimals) => {
    const factor = Math.pow(10, decimals);
    return Math.round((num + Number.EPSILON) * factor) / factor;
};

/** Round to 4 decimal places — simulates old Numeric(14,4) storage */
const round4 = (num) => roundN(num, 4);

/** Round to 8 decimal places — simulates new Numeric(20,8) storage */
const round8 = (num) => roundN(num, 8);

/**
 * Simulate storing a rate in the DB and reading it back.
 * @param {number} rate      - original rate
 * @param {number} decimals  - column precision (4 or 8)
 * @returns {number}         - stored rate (truncated to `decimals` places)
 */
const storeRate = (rate, decimals) => roundN(rate, decimals);

/**
 * Convert an amount in USD to local currency using stored rate.
 * rate_local_per_usd = how many local units per 1 USD
 */
const usdToLocal = (amountUSD, rateLocalPerUSD) => amountUSD * rateLocalPerUSD;

/**
 * Convert an amount in local currency back to USD using stored rate.
 * rate_local_per_usd = how many local units per 1 USD
 */
const localToUsd = (amountLocal, rateLocalPerUSD) => amountLocal / rateLocalPerUSD;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('round8 helper — basic precision', () => {
    test('round8(0.000269) is 0.000269 (not truncated to 0.0003)', () => {
        expect(round8(0.000269)).toBe(0.000269);
    });

    test('round8(0.00026904) is 0.00026904', () => {
        expect(round8(0.00026904)).toBe(0.00026904);
    });

    test('round8(0.000234) is 0.000234', () => {
        expect(round8(0.000234)).toBe(0.000234);
    });

    test('round8(0.0004567) is 0.0004567', () => {
        expect(round8(0.0004567)).toBe(0.0004567);
    });

    test('round8(0.00123456) is 0.00123456', () => {
        expect(round8(0.00123456)).toBe(0.00123456);
    });

    test('round8(1) is 1 (whole numbers unaffected)', () => {
        expect(round8(1)).toBe(1);
    });
});

describe('round4 helper — demonstrates the old bug', () => {
    test('round4(0.000269) truncates to 0.0003 — this is the bug', () => {
        // Numeric(14,4) can only store 4 decimal places.
        // 0.000269 rounded to 4 places = 0.0003 (3 in the 4th decimal position).
        expect(round4(0.000269)).toBe(0.0003);
    });

    test('round4(0.00026904) also truncates to 0.0003', () => {
        expect(round4(0.00026904)).toBe(0.0003);
    });

    test('round4(0.000234) truncates to 0.0002', () => {
        expect(round4(0.000234)).toBe(0.0002);
    });

    test('round4(0.0004567) rounds to 0.0005', () => {
        expect(round4(0.0004567)).toBe(0.0005);
    });
});

describe('Numeric(14,4) vs Numeric(20,8) — storage comparison', () => {
    // 1 USD = 4200 COP  →  1 COP = 1/4200 ≈ 0.00023809...
    const RATE_COP_PER_USD = 4200;
    const RATE_USD_PER_COP_EXACT = 1 / RATE_COP_PER_USD; // 0.000238095238...

    test('exact inverse rate for COP has more than 4 significant decimals', () => {
        // The exact value starts at the 4th decimal: 0.0002...
        // With Numeric(14,4) we can only store 0.0002, losing all remaining precision.
        expect(RATE_USD_PER_COP_EXACT).toBeLessThan(0.00024);
        expect(RATE_USD_PER_COP_EXACT).toBeGreaterThan(0.00023);
    });

    test('Numeric(14,4) stores 1/4200 as 0.0002 — loses 16% of the value', () => {
        const stored4 = storeRate(RATE_USD_PER_COP_EXACT, 4);
        expect(stored4).toBe(0.0002);
        // 0.0002 vs 0.000238 = ~16% error
        const errorPercent = Math.abs(stored4 - RATE_USD_PER_COP_EXACT) / RATE_USD_PER_COP_EXACT * 100;
        expect(errorPercent).toBeGreaterThan(15);
    });

    test('Numeric(20,8) stores 1/4200 as 0.00023810 — preserves 8 decimal places', () => {
        const stored8 = storeRate(RATE_USD_PER_COP_EXACT, 8);
        expect(stored8).toBe(0.0002381); // 0.000238095... rounds to 0.0002381 at 7th place
        // Error is tiny (sub-0.1%)
        const errorPercent = Math.abs(stored8 - RATE_USD_PER_COP_EXACT) / RATE_USD_PER_COP_EXACT * 100;
        expect(errorPercent).toBeLessThan(0.01);
    });

    test('rate 0.000269 — Numeric(14,4) stores 0.0003, Numeric(20,8) stores 0.000269', () => {
        const rate = 0.000269;
        expect(storeRate(rate, 4)).toBe(0.0003);   // wrong
        expect(storeRate(rate, 8)).toBe(0.000269); // correct
    });
});

describe('Conversion with micro-unit rate (0.000269)', () => {
    // Imagine a micro-currency where 1 USD = 3717 units, so 1 unit = 0.000269 USD
    const MICRO_RATE = 0.000269; // USD per 1 unit of micro-currency

    test('500 USD × 0.000269 rate = 0.1345 (product price in micro-currency)', () => {
        // If the product costs $500 USD and we want to express it in micro-currency units:
        // This is unusual — normally rate goes local→USD for payment.
        // Here we show the direct multiplication used in some conversions.
        const result = round8(500 * MICRO_RATE);
        expect(result).toBe(0.1345);
    });

    test('0.1345 / 0.000269 round-trips back to ~500 USD', () => {
        const amountLocal = 0.1345;
        const backToUsd = amountLocal / MICRO_RATE;
        expect(Math.abs(backToUsd - 500)).toBeLessThan(0.01);
    });
});

describe('Round-trip conversion accuracy (amount_cop / rate → amount_usd → cop)', () => {
    // 1 USD = 4200 COP — simulate paying in COP and confirming USD equivalent
    const COP_RATE = 4200; // COP per 1 USD

    test('210,000 COP / 4200 = 50 USD exactly', () => {
        const amountCOP = 210000;
        const amountUSD = amountCOP / COP_RATE;
        expect(amountUSD).toBe(50);
    });

    test('round-trip: 50 USD → COP → USD stays within ±0.01', () => {
        const originalUSD = 50;
        const amountCOP = originalUSD * COP_RATE; // 210000
        const backToUSD = amountCOP / COP_RATE;   // 50
        expect(Math.abs(backToUSD - originalUSD)).toBeLessThan(0.01);
    });

    test('round-trip with imprecise rate: 1/4200 stored at 8 decimals stays within ±0.01', () => {
        const originalUSD = 75;
        const storedRate = storeRate(1 / COP_RATE, 8); // 0.0002381 USD per COP
        const amountCOP = originalUSD * COP_RATE;      // 315000 COP
        const backToUSD = round8(amountCOP * storedRate);
        expect(Math.abs(backToUSD - originalUSD)).toBeLessThan(0.01);
    });

    test('round-trip with rate stored at 4 decimals fails the ±0.01 tolerance', () => {
        const originalUSD = 75;
        const storedRate4 = storeRate(1 / COP_RATE, 4); // 0.0002 USD per COP (truncated)
        const amountCOP = originalUSD * COP_RATE;       // 315000 COP
        const backToUSD = amountCOP * storedRate4;      // 315000 * 0.0002 = 63 (wrong!)
        expect(Math.abs(backToUSD - originalUSD)).toBeGreaterThan(0.01);
    });
});

describe('Multiple micro-unit rates with 6+ decimal places', () => {
    const microRates = [
        { symbol: 'MCA', rate: 0.000234 },
        { symbol: 'MCB', rate: 0.0004567 },
        { symbol: 'MCC', rate: 0.00123456 },
    ];

    microRates.forEach(({ symbol, rate }) => {
        test(`${symbol}: round8(${rate}) === ${rate} (preserved exactly)`, () => {
            expect(round8(rate)).toBe(rate);
        });

        test(`${symbol}: round4(${rate}) !== ${rate} (truncated — bug)`, () => {
            expect(round4(rate)).not.toBe(rate);
        });
    });
});
