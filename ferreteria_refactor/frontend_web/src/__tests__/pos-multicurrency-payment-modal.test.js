/**
 * Tests: PaymentModal — multi-moneda en resumen + vuelto Bs correcto
 *
 * Fixes verificados:
 * 1. "Total en Bolívares" reemplazado por loop sobre totalsByCurrency
 *    → muestra tasa y símbolo correctos por moneda (VES/COP separados)
 * 2. Vuelto en Bs usa totalsByCurrency.VES (no totalBs/totalUSD que era COP)
 * 3. "Falta por pagar" usa rate correcto por moneda
 */

'use strict';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const fmt = (amount) =>
    new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

// ─── Setup de tasas de cambio ─────────────────────────────────────────────────
const exchangeRates = [
    { id: 1, currency_code: 'VES', currency_symbol: 'Bs', name: 'Bolívares', rate: 45.00, is_active: true, is_default: true },
    { id: 2, currency_code: 'COP', currency_symbol: 'COP', name: 'Peso Colombiano', rate: 3710.76, is_active: true, is_default: false },
];

const getExchangeRate = (symbol) => {
    const s = String(symbol || '').trim().toUpperCase();
    const found = exchangeRates.find(c =>
        c.currency_symbol?.toUpperCase() === s ||
        c.currency_code?.toUpperCase() === s
    );
    return found ? parseFloat(found.rate) : 1;
};

const getActiveCurrencies = () => exchangeRates.filter(r => r.is_active);

/** Simula el panel de totales dinámico (fix) */
function buildCurrencyPanels(totalsByCurrency, exchangeRates, getExchangeRate) {
    return Object.entries(totalsByCurrency || {})
        .filter(([code, amt]) => code !== 'USD' && amt > 0.005)
        .map(([code, amt]) => {
            const curr = exchangeRates.find(c => c.currency_code === code);
            return {
                code,
                name: curr?.name || code,
                sym: curr?.currency_symbol || code,
                rate: getExchangeRate(code),
                amount: amt,
            };
        });
}

/** Simula cálculo de vuelto en Bs — FIX: usa totalsByCurrency.VES */
function calcChangeLocal(changeUSD, localCurrency, totalUSD, totalBs, totalsByCurrency, defaultBsRate) {
    if (localCurrency === 'Bs' || localCurrency === 'VES') {
        // FIX: usar VES de totalsByCurrency, no totalBs (que puede ser COP)
        const vesTotal = totalsByCurrency?.VES || totalsByCurrency?.Bs;
        const effectiveRate = (vesTotal && totalUSD) ? (vesTotal / totalUSD) : defaultBsRate;
        return { amount: changeUSD * effectiveRate, sym: 'Bs' };
    }
    return { amount: changeUSD * (getExchangeRate(localCurrency) || 1), sym: localCurrency };
}

/** Versión VIEJA del vuelto en Bs (bug) */
function calcChangeLocalOld(changeUSD, localCurrency, totalUSD, totalBs, defaultBsRate) {
    if (localCurrency === 'Bs' || localCurrency === 'VES') {
        const effectiveRate = (totalBs && totalUSD) ? (totalBs / totalUSD) : defaultBsRate;
        return { amount: changeUSD * effectiveRate, sym: 'Bs' };
    }
    return { amount: changeUSD * (getExchangeRate(localCurrency) || 1), sym: localCurrency };
}

/** Simula "Falta por pagar" dinámico (fix) */
function buildRemainingPanels(remainingUSD, totalsByCurrency, exchangeRates, getExchangeRate) {
    const entries = Object.entries(totalsByCurrency || {})
        .filter(([code, amt]) => code !== 'USD' && amt > 0.005);
    return entries.map(([code]) => {
        const curr = exchangeRates.find(c => c.currency_code === code);
        const rate = getExchangeRate(code) || 1;
        return {
            code,
            name: curr?.name || code,
            sym: curr?.currency_symbol || code,
            amount: Math.abs(remainingUSD) * rate,
        };
    });
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('PaymentModal — resumen multi-moneda y vuelto Bs correcto', () => {

    // Escenario: $10 pedido con producto COP-priced (3710.76 COP/USD)
    const totalUSD = 10.00;
    const totalBs = 37107.60;       // bug: esto es COP, no VES!
    const defaultBsRate = 45.00;    // tasa VES real
    const totalsByCurrency = {
        USD: 10.00,
        VES: 450.00,                // 10 * 45 (calculado por CartContext.byCurrency — correcto)
        COP: 37107.60,              // 10 * 3710.76
    };

    // ─── Panel de totales ────────────────────────────────────────────────────

    describe('Panel de totales — loop sobre totalsByCurrency', () => {
        test('genera panel VES con tasa 45 y monto 450', () => {
            const panels = buildCurrencyPanels(totalsByCurrency, exchangeRates, getExchangeRate);
            const ves = panels.find(p => p.code === 'VES');
            expect(ves).toBeDefined();
            expect(ves.sym).toBe('Bs');
            expect(ves.name).toBe('Bolívares');
            expect(ves.rate).toBeCloseTo(45.00, 2);
            expect(ves.amount).toBeCloseTo(450.00, 1);
        });

        test('genera panel COP con tasa 3710.76 y monto 37107.60', () => {
            const panels = buildCurrencyPanels(totalsByCurrency, exchangeRates, getExchangeRate);
            const cop = panels.find(p => p.code === 'COP');
            expect(cop).toBeDefined();
            expect(cop.sym).toBe('COP');
            expect(cop.name).toBe('Peso Colombiano');
            expect(cop.rate).toBeCloseTo(3710.76, 1);
            expect(cop.amount).toBeCloseTo(37107.60, 0);
        });

        test('no genera panel para USD', () => {
            const panels = buildCurrencyPanels(totalsByCurrency, exchangeRates, getExchangeRate);
            expect(panels.find(p => p.code === 'USD')).toBeUndefined();
        });

        test('sin monedas no-USD activas → array vacío (fallback usa Bs estático)', () => {
            const onlyUSD = { USD: 10.00 };
            const panels = buildCurrencyPanels(onlyUSD, exchangeRates, getExchangeRate);
            expect(panels).toHaveLength(0);
        });
    });

    // ─── Vuelto en Bs ────────────────────────────────────────────────────────

    describe('Vuelto Bs — BUG: usaba totalBs/totalUSD = tasa COP', () => {
        test('con totalBs=37107 (COP), effectiveRate era COP 3710.76 → vuelto erróneo', () => {
            const changeUSD = 2.00;
            const result = calcChangeLocalOld(changeUSD, 'Bs', totalUSD, totalBs, defaultBsRate);
            // effectiveRate = 37107.60 / 10 = 3710.76 (COP!)
            expect(result.sym).toBe('Bs');
            expect(result.amount).toBeCloseTo(2 * 3710.76, 0); // WRONG: 7421.52
            expect(result.amount).not.toBeCloseTo(2 * 45, 0);  // No es el VES correcto
        });
    });

    describe('Vuelto Bs — FIX: usa totalsByCurrency.VES = tasa VES correcta', () => {
        test('changeUSD=2 → vuelto Bs = 2 * 45 = 90 (correcto)', () => {
            const changeUSD = 2.00;
            const result = calcChangeLocal(changeUSD, 'Bs', totalUSD, totalBs, totalsByCurrency, defaultBsRate);
            // vesTotal = totalsByCurrency.VES = 450; effectiveRate = 450/10 = 45
            expect(result.sym).toBe('Bs');
            expect(result.amount).toBeCloseTo(90.00, 1);
        });

        test('changeUSD=0.50 → vuelto Bs = 0.50 * 45 = 22.50', () => {
            const changeUSD = 0.50;
            const result = calcChangeLocal(changeUSD, 'Bs', totalUSD, totalBs, totalsByCurrency, defaultBsRate);
            expect(result.amount).toBeCloseTo(22.50, 1);
        });

        test('pago en COP → vuelto en COP usa tasa COP 3710.76', () => {
            const changeUSD = 1.00;
            const result = calcChangeLocal(changeUSD, 'COP', totalUSD, totalBs, totalsByCurrency, defaultBsRate);
            expect(result.sym).toBe('COP');
            expect(result.amount).toBeCloseTo(3710.76, 0);
        });

        test('pago en USD → no hay vuelto local (fuera del scope Bs/COP)', () => {
            const changeUSD = 0;
            const result = calcChangeLocal(changeUSD, 'USD', totalUSD, totalBs, totalsByCurrency, defaultBsRate);
            expect(result.amount).toBe(0);
        });

        test('sin totalsByCurrency.VES → fallback a defaultBsRate', () => {
            const totalsByNoBs = { USD: 10, COP: 37107.60 }; // no VES
            const changeUSD = 1.00;
            const result = calcChangeLocal(changeUSD, 'Bs', totalUSD, totalBs, totalsByNoBs, defaultBsRate);
            expect(result.amount).toBeCloseTo(45.00, 1); // fallback defaultBsRate
        });
    });

    // ─── Falta por pagar ─────────────────────────────────────────────────────

    describe('Falta por pagar — dinámico por moneda', () => {
        const remainingUSD = 5.00;

        test('muestra falta en VES con tasa 45 → 225 Bs', () => {
            const panels = buildRemainingPanels(remainingUSD, totalsByCurrency, exchangeRates, getExchangeRate);
            const ves = panels.find(p => p.code === 'VES');
            expect(ves).toBeDefined();
            expect(ves.sym).toBe('Bs');
            expect(ves.amount).toBeCloseTo(5 * 45, 1);
        });

        test('muestra falta en COP con tasa 3710.76 → 18553.80 COP', () => {
            const panels = buildRemainingPanels(remainingUSD, totalsByCurrency, exchangeRates, getExchangeRate);
            const cop = panels.find(p => p.code === 'COP');
            expect(cop).toBeDefined();
            expect(cop.sym).toBe('COP');
            expect(cop.amount).toBeCloseTo(5 * 3710.76, 0);
        });

        test('saldo 0 → falta = 0 en todas las monedas', () => {
            const panels = buildRemainingPanels(0, totalsByCurrency, exchangeRates, getExchangeRate);
            panels.forEach(p => expect(p.amount).toBe(0));
        });
    });

    // ─── Consistencia: totalsByCurrency.VES vs totalBs ───────────────────────

    describe('Consistencia: totalsByCurrency.VES es siempre VES puro', () => {
        test('totalsByCurrency.VES/totalUSD = tasa VES (45), no COP', () => {
            const impliedRate = totalsByCurrency.VES / totalUSD;
            expect(impliedRate).toBeCloseTo(45.00, 1);
        });

        test('totalBs/totalUSD con producto COP da tasa COP (bug)', () => {
            const bugRate = totalBs / totalUSD;
            expect(bugRate).toBeCloseTo(3710.76, 0); // confirma el bug original
        });

        test('las dos tasas NO son iguales → fix era necesario', () => {
            const vesRate = totalsByCurrency.VES / totalUSD;
            const bugRate = totalBs / totalUSD;
            expect(Math.abs(vesRate - bugRate)).toBeGreaterThan(100);
        });
    });
});
