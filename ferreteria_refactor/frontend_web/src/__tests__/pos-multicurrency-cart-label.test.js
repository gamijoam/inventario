/**
 * Tests: POSCart — etiqueta correcta por moneda real del ítem
 *
 * Fix: el carrito ya no muestra "Bs 450" para un ítem COP-priced.
 * Resuelve item.exchange_rate_id → currency_symbol real del ítem.
 * Footer muestra totalsByCurrency (todas las monedas no-USD activas).
 */

'use strict';

const fmt = (amount) =>
    new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

// ─── Simular la lógica del POSCart per-item ───────────────────────────────────
//
// Antes (bug):
//   localSym = secondaryCurrency.symbol   → siempre "Bs"
//   amount   = item.subtotal_usd * secondaryCurrency.rate  → 10 * 45 = 450 Bs (WRONG for COP item)
//
// Después (fix):
//   rateObj = currencies.find(r => r.id === item.exchange_rate_id)
//   localSym = rateObj?.currency_symbol || secondaryCurrency.symbol
//   amount   = item.subtotal_bs   → 10 * 3710.76 = 37107.60 (CORRECT COP)
// ─────────────────────────────────────────────────────────────────────────────

// getActiveCurrencies() agrega .symbol = currency_symbol → lo incluimos en los fixtures
const currencies = [
    { id: 1, currency_code: 'VES', currency_symbol: 'Bs', symbol: 'Bs', rate: 45.00, is_active: true, is_default: true, is_anchor: false },
    { id: 2, currency_code: 'COP', currency_symbol: 'COP', symbol: 'COP', rate: 3710.76, is_active: true, is_default: false, is_anchor: false },
    { id: 3, currency_code: 'USD', currency_symbol: '$', symbol: '$', rate: 1, is_active: true, is_default: false, is_anchor: true },
];

const secondaryCurrencyVES = currencies.find(c => c.currency_code === 'VES');

/** Simula la lógica del carrito (fix) para derivar el símbolo y monto locales */
function itemLocalDisplay(item, currencies, secondaryCurrency) {
    if (!secondaryCurrency) return null;
    if (!item.subtotal_bs || item.subtotal_bs <= 0) return null;
    const rateObj = currencies.find(r => r.id === item.exchange_rate_id);
    const localSym = rateObj?.currency_symbol || rateObj?.currency_code || secondaryCurrency.symbol;
    return { sym: localSym, amount: item.subtotal_bs };
}

/** Simula la lógica ANTIGUA (bug) */
function itemLocalDisplayOld(item, secondaryCurrency) {
    if (!secondaryCurrency) return null;
    const amount = item.subtotal_usd * parseFloat(secondaryCurrency.rate || 1);
    return { sym: secondaryCurrency.symbol, amount };
}

/** Simula footer totalsByCurrency */
function footerEntries(totalsByCurrency, currencies) {
    return Object.entries(totalsByCurrency)
        .filter(([code, amt]) => code !== 'USD' && amt > 0.005)
        .map(([code, amt]) => {
            const curr = currencies.find(c => c.currency_code === code && c.is_active);
            return { code, sym: curr?.currency_symbol || code, amount: amt };
        });
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('POSCart — etiqueta moneda real del ítem (fix multi-moneda)', () => {

    // Ítem "PRUEBA PESO" — tiene exchange_rate_id = 2 (COP rate)
    const copItem = {
        id: 'prueba_peso_Unidad',
        name: 'PRUEBA PESO',
        exchange_rate_id: 2,   // COP rate
        subtotal_usd: 10.00,
        subtotal_bs: 10.00 * 3710.76,  // 37107.60 — calculado con tasa COP
    };

    // Ítem con tasa VES
    const vesItem = {
        id: 'tornillo_Unidad',
        name: 'Tornillo 2"',
        exchange_rate_id: 1,   // VES rate
        subtotal_usd: 5.00,
        subtotal_bs: 5.00 * 45.00,     // 225.00
    };

    // Ítem sin exchange_rate_id (fallback)
    const unknownItem = {
        id: 'arroz_Unidad',
        name: 'Arroz 1kg',
        exchange_rate_id: null,
        subtotal_usd: 2.00,
        subtotal_bs: 2.00 * 45.00,     // 90.00 — calculado por fallback VES
    };

    describe('BUG anterior: todo mostraba símbolo VES', () => {
        test('ítem COP mostraba "Bs" con valor VES (450 en vez de 37107)', () => {
            const display = itemLocalDisplayOld(copItem, secondaryCurrencyVES);
            expect(display.sym).toBe('Bs');
            expect(display.amount).toBeCloseTo(450.00, 1); // 10 * 45 = 450 (WRONG)
        });

        test('ítem VES mostraba "Bs" con valor correcto (coincidencia accidental)', () => {
            const display = itemLocalDisplayOld(vesItem, secondaryCurrencyVES);
            expect(display.sym).toBe('Bs');
            expect(display.amount).toBeCloseTo(225.00, 1); // 5 * 45 = 225 (ok by coincidence)
        });
    });

    describe('FIX: símbolo deriva de exchange_rate_id real del ítem', () => {
        test('ítem COP muestra "COP" con valor correcto 37107.60', () => {
            const display = itemLocalDisplay(copItem, currencies, secondaryCurrencyVES);
            expect(display).not.toBeNull();
            expect(display.sym).toBe('COP');
            expect(display.amount).toBeCloseTo(37107.60, 0);
        });

        test('ítem VES muestra "Bs" con valor correcto 225.00', () => {
            const display = itemLocalDisplay(vesItem, currencies, secondaryCurrencyVES);
            expect(display.sym).toBe('Bs');
            expect(display.amount).toBeCloseTo(225.00, 1);
        });

        test('ítem sin exchange_rate_id hace fallback al símbolo de secondaryCurrency', () => {
            const display = itemLocalDisplay(unknownItem, currencies, secondaryCurrencyVES);
            expect(display.sym).toBe('Bs'); // fallback correcto
            expect(display.amount).toBeCloseTo(90.00, 1);
        });

        test('sin secondaryCurrency retorna null', () => {
            const display = itemLocalDisplay(copItem, currencies, null);
            expect(display).toBeNull();
        });

        test('subtotal_bs = 0 retorna null (no mostrar badge vacío)', () => {
            const itemZero = { ...copItem, subtotal_bs: 0 };
            const display = itemLocalDisplay(itemZero, currencies, secondaryCurrencyVES);
            expect(display).toBeNull();
        });
    });

    describe('Footer totalsByCurrency — todas las monedas no-USD', () => {
        const totalsByCurrency = {
            USD: 20.00,
            VES: 900.00,   // 20 USD * 45 VES
            COP: 74215.20, // 20 USD * 3710.76 COP
        };

        test('devuelve entradas para VES y COP (no USD)', () => {
            const entries = footerEntries(totalsByCurrency, currencies);
            const codes = entries.map(e => e.code);
            expect(codes).not.toContain('USD');
            expect(codes).toContain('VES');
            expect(codes).toContain('COP');
        });

        test('símbolo VES es "Bs"', () => {
            const entries = footerEntries(totalsByCurrency, currencies);
            const ves = entries.find(e => e.code === 'VES');
            expect(ves.sym).toBe('Bs');
            expect(ves.amount).toBeCloseTo(900.00, 1);
        });

        test('símbolo COP es "COP"', () => {
            const entries = footerEntries(totalsByCurrency, currencies);
            const cop = entries.find(e => e.code === 'COP');
            expect(cop.sym).toBe('COP');
            expect(cop.amount).toBeCloseTo(74215.20, 0);
        });

        test('monedas con monto ≤ 0.005 se filtran', () => {
            const sparseTotal = { USD: 10, VES: 0.001, COP: 37107.60 };
            const entries = footerEntries(sparseTotal, currencies);
            const codes = entries.map(e => e.code);
            expect(codes).not.toContain('VES');
            expect(codes).toContain('COP');
        });

        test('solo USD activo → array vacío', () => {
            const onlyUSD = { USD: 10.00 };
            const entries = footerEntries(onlyUSD, currencies);
            expect(entries).toHaveLength(0);
        });

        test('sin totalsByCurrency (prop no pasado) → array vacío', () => {
            const entries = footerEntries({}, currencies);
            expect(entries).toHaveLength(0);
        });
    });

    describe('Cálculo de formato de moneda en carrito', () => {
        test('fmt: COP 37107.60 → "37.107,60"', () => {
            expect(fmt(37107.60)).toBe('37.107,60');
        });

        test('fmt: VES 900.00 → "900,00"', () => {
            expect(fmt(900.00)).toBe('900,00');
        });

        test('fmt: USD 10.00 → "10,00"', () => {
            expect(fmt(10.00)).toBe('10,00');
        });
    });
});
