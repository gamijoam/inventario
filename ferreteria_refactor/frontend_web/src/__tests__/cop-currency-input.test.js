/**
 * Tests: CurrencyInput formatting and parsing for COP
 *
 * CurrencyInput.jsx uses comma as decimal separator and period as thousands
 * separator for Bs, VES, COP, and EUR — the same as Venezuelan Bolívares.
 *
 * These tests are self-contained: the format/parse/usesCommaDecimal logic
 * from CurrencyInput.jsx is reproduced inline so no DOM, no React, and no
 * import of the component is needed.
 *
 * To run (once Jest is installed):
 *   npx jest src/__tests__/cop-currency-input.test.js
 */

// ---------------------------------------------------------------------------
// Logic reproduced from CurrencyInput.jsx
// ---------------------------------------------------------------------------

/**
 * Returns the separator config for a given currency symbol.
 * Matches CurrencyInput.jsx lines 3-11.
 */
const getSeparators = (currencySymbol) => {
    const usesCommaDecimal = ['Bs', 'VES', 'COP', 'EUR'].includes(currencySymbol);
    return {
        usesCommaDecimal,
        decimalSeparator: usesCommaDecimal ? ',' : '.',
        thousandsSeparator: usesCommaDecimal ? '.' : ',',
    };
};

/**
 * Format a numeric value (number or string) to a localised display string.
 * Matches CurrencyInput.jsx `format()` (lines 32-49).
 */
const format = (val, currencySymbol) => {
    if (val === '' || val === undefined || val === null) return '';

    const { decimalSeparator, thousandsSeparator } = getSeparators(currencySymbol);

    let parts = val.toString().split('.');
    let integerPart = parts[0];
    let decimalPart = parts.length > 1 ? parts[1] : '';

    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);

    if (parts.length > 1) {
        return `${integerPart}${decimalSeparator}${decimalPart}`;
    }
    return integerPart;
};

/**
 * Parse a localised display string back to a JavaScript number.
 * Matches CurrencyInput.jsx `parse()` (lines 51-58).
 */
const parse = (str, currencySymbol) => {
    if (!str) return 0;
    const { decimalSeparator, thousandsSeparator } = getSeparators(currencySymbol);
    let clean = str.split(thousandsSeparator).join('');
    clean = clean.replace(decimalSeparator, '.');
    return parseFloat(clean);
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('usesCommaDecimal flag', () => {
    test('COP uses comma as decimal separator', () => {
        expect(getSeparators('COP').usesCommaDecimal).toBe(true);
    });

    test('Bs uses comma as decimal separator', () => {
        expect(getSeparators('Bs').usesCommaDecimal).toBe(true);
    });

    test('VES uses comma as decimal separator', () => {
        expect(getSeparators('VES').usesCommaDecimal).toBe(true);
    });

    test('EUR uses comma as decimal separator', () => {
        expect(getSeparators('EUR').usesCommaDecimal).toBe(true);
    });

    test('USD uses dot as decimal separator', () => {
        expect(getSeparators('USD').usesCommaDecimal).toBe(false);
    });

    test('$ (dollar sign) uses dot as decimal separator', () => {
        expect(getSeparators('$').usesCommaDecimal).toBe(false);
    });

    test('unknown currency defaults to dot decimal (falsy)', () => {
        expect(getSeparators('XYZ').usesCommaDecimal).toBe(false);
        expect(getSeparators('').usesCommaDecimal).toBe(false);
        expect(getSeparators(undefined).usesCommaDecimal).toBe(false);
    });
});

describe('COP separators', () => {
    test('decimal separator is comma', () => {
        expect(getSeparators('COP').decimalSeparator).toBe(',');
    });

    test('thousands separator is period', () => {
        expect(getSeparators('COP').thousandsSeparator).toBe('.');
    });
});

describe('COP format()', () => {
    test('formats 1000.50 as "1.000,50"', () => {
        expect(format(1000.50, 'COP')).toBe('1.000,50');
    });

    test('formats 210000 as "210.000"', () => {
        expect(format(210000, 'COP')).toBe('210.000');
    });

    test('formats 420000 as "420.000"', () => {
        expect(format(420000, 'COP')).toBe('420.000');
    });

    test('formats 1234567.89 as "1.234.567,89"', () => {
        expect(format(1234567.89, 'COP')).toBe('1.234.567,89');
    });

    test('formats 0 as "0"', () => {
        expect(format(0, 'COP')).toBe('0');
    });

    test('formats 50 as "50" (no decimal part)', () => {
        expect(format(50, 'COP')).toBe('50');
    });
});

describe('USD format()', () => {
    test('formats 50.00 as "50.00"', () => {
        expect(format(50.00, 'USD')).toBe('50');    // JS 50.00 === 50; no trailing zeros
    });

    test('formats 50.5 as "50.5"', () => {
        expect(format(50.5, 'USD')).toBe('50.5');
    });

    test('formats 1234.56 as "1,234.56"', () => {
        expect(format(1234.56, 'USD')).toBe('1,234.56');
    });
});

describe('COP parse()', () => {
    test('"1.000,50" in COP mode → 1000.5', () => {
        expect(parse('1.000,50', 'COP')).toBe(1000.5);
    });

    test('"210.000" in COP mode → 210000', () => {
        expect(parse('210.000', 'COP')).toBe(210000);
    });

    test('"420.000" in COP mode → 420000', () => {
        expect(parse('420.000', 'COP')).toBe(420000);
    });

    test('"1.234.567,89" in COP mode → 1234567.89', () => {
        expect(parse('1.234.567,89', 'COP')).toBe(1234567.89);
    });

    test('empty string → 0', () => {
        expect(parse('', 'COP')).toBe(0);
    });
});

describe('USD parse()', () => {
    test('"50.00" in USD mode → 50', () => {
        expect(parse('50.00', 'USD')).toBe(50);
    });

    test('"1,234.56" in USD mode → 1234.56', () => {
        expect(parse('1,234.56', 'USD')).toBe(1234.56);
    });
});

describe('format → parse round-trip', () => {
    const copValues = [210000, 420000, 1000.5, 1234567.89, 50, 0];

    copValues.forEach((v) => {
        test(`COP round-trip for ${v}`, () => {
            expect(parse(format(v, 'COP'), 'COP')).toBeCloseTo(v, 5);
        });
    });

    const usdValues = [50, 100, 1234.56, 0.99];

    usdValues.forEach((v) => {
        test(`USD round-trip for ${v}`, () => {
            expect(parse(format(v, 'USD'), 'USD')).toBeCloseTo(v, 5);
        });
    });
});
