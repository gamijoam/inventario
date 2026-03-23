/**
 * Tests: ProductCard — secondaryCurrencies[] muestra precio por cada moneda activa
 *
 * Fix: acepta secondaryCurrencies (array) → muestra badge de precio
 * para cada moneda no-USD activa cuando el toggle está ON.
 * El toggle del POS ahora muestra "Bs/COP OFF" en lugar de solo "Bs OFF".
 */

'use strict';

// ─── Setup ────────────────────────────────────────────────────────────────────

// getActiveCurrencies() mapea currency_symbol → symbol. Lo incluimos en fixtures.
const currencies = [
    { id: 1, currency_code: 'VES', currency_symbol: 'Bs', symbol: 'Bs', name: 'Bolívares', rate: 45.00, is_active: true, is_anchor: false },
    { id: 2, currency_code: 'COP', currency_symbol: 'COP', symbol: 'COP', name: 'Peso Colombiano', rate: 3710.76, is_active: true, is_anchor: false },
    { id: 3, currency_code: 'USD', currency_symbol: '$', symbol: '$', name: 'Dólar', rate: 1, is_active: true, is_anchor: true },
];

const secondaryCurrencies = currencies.filter(c => !c.is_anchor && c.currency_code !== 'USD');

/** Simula convertProductPrice del ConfigContext */
function convertProductPrice(product, targetCurrencyCode, currencies) {
    const productRate = currencies.find(r => r.id === product.exchange_rate_id);
    if (productRate && productRate.currency_code === targetCurrencyCode) {
        return product.price * productRate.rate;
    }
    const targetRate = currencies.find(c => c.currency_code === targetCurrencyCode);
    return product.price * (targetRate?.rate || 1);
}

/** Simula la lógica de secondaryPrices[] del ProductCard (fix) */
function buildSecondaryPrices(product, secondaryCurrencies, showSecondaryPrice, currencies) {
    if (!showSecondaryPrice || !secondaryCurrencies.length) return [];
    return secondaryCurrencies.map(curr => {
        const code = curr.currency_code || curr.symbol;
        const sym = curr.currency_symbol || curr.symbol;
        const price = convertProductPrice(product, code, currencies);
        return { code, sym, price };
    }).filter(p => p.price > 0);
}

/** Simula la etiqueta del botón toggle del POS */
function toggleLabel(secondaryCurrencies, showSecondaryPrice) {
    if (!secondaryCurrencies.length) return null;
    const symbols = secondaryCurrencies.map(c => c.symbol).join('/');
    return `${symbols} ${showSecondaryPrice ? 'ON' : 'OFF'}`;
}

// ─── Productos de prueba ──────────────────────────────────────────────────────

const copProduct = {
    id: 1,
    name: 'PRUEBA PESO',
    price: 10.00,             // USD base price
    exchange_rate_id: 2,      // COP rate
};

const vesProduct = {
    id: 2,
    name: 'Tornillo 2"',
    price: 5.00,
    exchange_rate_id: 1,      // VES rate
};

const noRateProduct = {
    id: 3,
    name: 'Arroz 1kg',
    price: 2.00,
    exchange_rate_id: null,   // no rate assigned
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('ProductCard — secondaryCurrencies[] multi-precio (fix)', () => {

    describe('Toggle OFF → ningún precio secundario', () => {
        test('secondaryPrices vacío cuando showSecondaryPrice = false', () => {
            const prices = buildSecondaryPrices(copProduct, secondaryCurrencies, false, currencies);
            expect(prices).toHaveLength(0);
        });

        test('secondaryPrices vacío con array vacío aunque toggle ON', () => {
            const prices = buildSecondaryPrices(copProduct, [], true, currencies);
            expect(prices).toHaveLength(0);
        });
    });

    describe('Toggle ON + producto COP-priced', () => {
        test('genera precio en VES Y COP (2 badges)', () => {
            const prices = buildSecondaryPrices(copProduct, secondaryCurrencies, true, currencies);
            expect(prices).toHaveLength(2);
        });

        test('precio COP: usa tasa asignada al producto (3710.76) → 37107.60', () => {
            const prices = buildSecondaryPrices(copProduct, secondaryCurrencies, true, currencies);
            const cop = prices.find(p => p.code === 'COP');
            expect(cop).toBeDefined();
            expect(cop.sym).toBe('COP');
            expect(cop.price).toBeCloseTo(37107.60, 0);
        });

        test('precio VES: usa tasa VES default (45) → 450', () => {
            const prices = buildSecondaryPrices(copProduct, secondaryCurrencies, true, currencies);
            const ves = prices.find(p => p.code === 'VES');
            expect(ves).toBeDefined();
            expect(ves.sym).toBe('Bs');
            expect(ves.price).toBeCloseTo(450.00, 1);
        });
    });

    describe('Toggle ON + producto VES-priced', () => {
        test('precio VES: usa tasa del producto (45) → 225', () => {
            const prices = buildSecondaryPrices(vesProduct, secondaryCurrencies, true, currencies);
            const ves = prices.find(p => p.code === 'VES');
            expect(ves.price).toBeCloseTo(225.00, 1);
        });

        test('precio COP: usa tasa COP default (3710.76) → 18553.80', () => {
            const prices = buildSecondaryPrices(vesProduct, secondaryCurrencies, true, currencies);
            const cop = prices.find(p => p.code === 'COP');
            expect(cop.price).toBeCloseTo(5 * 3710.76, 0);
        });
    });

    describe('Toggle ON + producto sin rate asignado', () => {
        test('usa tasa default de cada moneda para ambos precios', () => {
            const prices = buildSecondaryPrices(noRateProduct, secondaryCurrencies, true, currencies);
            expect(prices).toHaveLength(2);
            const ves = prices.find(p => p.code === 'VES');
            const cop = prices.find(p => p.code === 'COP');
            expect(ves.price).toBeCloseTo(2 * 45, 1);     // 90
            expect(cop.price).toBeCloseTo(2 * 3710.76, 0); // 7421.52
        });
    });

    describe('Solo una moneda activa no-USD', () => {
        const onlyVES = [currencies.find(c => c.currency_code === 'VES')];

        test('genera solo 1 badge', () => {
            const prices = buildSecondaryPrices(copProduct, onlyVES, true, currencies);
            expect(prices).toHaveLength(1);
        });

        test('badge tiene símbolo VES', () => {
            const prices = buildSecondaryPrices(copProduct, onlyVES, true, currencies);
            expect(prices[0].sym).toBe('Bs');
        });
    });

    describe('Botón toggle del POS — etiqueta multi-moneda', () => {
        test('toggle OFF muestra "Bs/COP OFF" con 2 monedas activas', () => {
            expect(toggleLabel(secondaryCurrencies, false)).toBe('Bs/COP OFF');
        });

        test('toggle ON muestra "Bs/COP ON"', () => {
            expect(toggleLabel(secondaryCurrencies, true)).toBe('Bs/COP ON');
        });

        test('solo VES activa → "Bs OFF"', () => {
            const onlyVES = [currencies.find(c => c.currency_code === 'VES')];
            expect(toggleLabel(onlyVES, false)).toBe('Bs OFF');
        });

        test('solo COP activa → "COP ON"', () => {
            const onlyCOP = [currencies.find(c => c.currency_code === 'COP')];
            expect(toggleLabel(onlyCOP, true)).toBe('COP ON');
        });

        test('sin monedas secundarias → null (botón no se muestra)', () => {
            expect(toggleLabel([], false)).toBeNull();
        });
    });

    describe('convertProductPrice — lógica correcta', () => {
        test('producto COP + target COP → usa tasa asignada al producto', () => {
            const price = convertProductPrice(copProduct, 'COP', currencies);
            expect(price).toBeCloseTo(10 * 3710.76, 0);
        });

        test('producto COP + target VES → usa tasa VES default', () => {
            const price = convertProductPrice(copProduct, 'VES', currencies);
            expect(price).toBeCloseTo(10 * 45, 1);
        });

        test('producto VES + target VES → usa tasa asignada al producto', () => {
            const price = convertProductPrice(vesProduct, 'VES', currencies);
            expect(price).toBeCloseTo(5 * 45, 1);
        });

        test('producto sin rate + target COP → usa tasa COP default', () => {
            const price = convertProductPrice(noRateProduct, 'COP', currencies);
            expect(price).toBeCloseTo(2 * 3710.76, 0);
        });
    });
});
