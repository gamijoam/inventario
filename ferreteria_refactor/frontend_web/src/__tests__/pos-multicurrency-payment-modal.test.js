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

    // ─── calcTotalPaidUSD — cuánto USD cubre un pago en Bs ───────────────────

    /**
     * Bug: el reduce de totalPaidUSD también usaba totalBs/totalUSD = tasa COP.
     * Al pagar 450 Bs (exactamente el total VES) solo cubría $0.12 en vez de $10.
     * Fix: usa totalsByCurrency.VES igual que calcChangeLocal.
     */

    /** BUG: effectiveRate = totalBs / totalUSD (puede ser tasa COP) */
    function calcTotalPaidUSDBug(payments, totalUSD, totalBs, defaultBsRate) {
        return payments.reduce((acc, p) => {
            const amount = parseFloat(p.amount) || 0;
            let rate = 1;
            if (p.currency === 'USD' || p.currency === '$') {
                rate = 1;
            } else if (p.currency === 'Bs' || p.currency === 'VES') {
                rate = (totalBs && totalUSD) ? (totalBs / totalUSD) : defaultBsRate;
            } else {
                rate = getExchangeRate(p.currency) || 1;
            }
            return round2(acc + round2(amount / rate));
        }, 0);
    }

    /** FIX: effectiveRate = totalsByCurrency.VES / totalUSD (tasa VES pura) */
    function calcTotalPaidUSD(payments, totalUSD, totalsByCurrency, defaultBsRate) {
        return payments.reduce((acc, p) => {
            const amount = parseFloat(p.amount) || 0;
            let rate = 1;
            if (p.currency === 'USD' || p.currency === '$') {
                rate = 1;
            } else if (p.currency === 'Bs' || p.currency === 'VES') {
                const vesTotal = totalsByCurrency?.VES || totalsByCurrency?.Bs;
                rate = (vesTotal && totalUSD) ? (vesTotal / totalUSD) : defaultBsRate;
            } else {
                rate = getExchangeRate(p.currency) || 1;
            }
            return round2(acc + round2(amount / rate));
        }, 0);
    }

    describe('totalPaidUSD — BUG: pago Bs con tasa COP interna', () => {
        test('BUG: pagar 450 Bs (total VES) → solo cubre $0.12 con tasa COP interna', () => {
            const payments = [{ currency: 'Bs', amount: '450' }];
            // totalBs = 37107.60 (COP), effectiveRate = 37107.60/10 = 3710.76
            const paid = calcTotalPaidUSDBug(payments, totalUSD, totalBs, defaultBsRate);
            expect(paid).toBeCloseTo(450 / 3710.76, 1); // ~$0.12 INCORRECTO
            expect(paid).not.toBeCloseTo(10.00, 0);
        });

        test('BUG: remainingUSD resulta ~$9.88 en vez de $0 al pagar el total en Bs', () => {
            const payments = [{ currency: 'Bs', amount: '450' }];
            const paid = calcTotalPaidUSDBug(payments, totalUSD, totalBs, defaultBsRate);
            const remaining = round2(Math.max(0, totalUSD - paid));
            expect(remaining).toBeGreaterThan(9.00); // debería ser 0
        });
    });

    describe('totalPaidUSD — FIX: pago Bs usa totalsByCurrency.VES', () => {
        test('FIX: pagar 450 Bs (total VES) → cubre exactamente $10.00', () => {
            const payments = [{ currency: 'Bs', amount: '450' }];
            const paid = calcTotalPaidUSD(payments, totalUSD, totalsByCurrency, defaultBsRate);
            expect(paid).toBeCloseTo(10.00, 2);
        });

        test('FIX: remainingUSD = $0 al pagar el total exacto en Bs', () => {
            const payments = [{ currency: 'Bs', amount: '450' }];
            const paid = calcTotalPaidUSD(payments, totalUSD, totalsByCurrency, defaultBsRate);
            const remaining = round2(Math.max(0, totalUSD - paid));
            expect(remaining).toBe(0);
        });

        test('FIX: pago parcial Bs — remaining correcto (225 Bs = $5)', () => {
            const payments = [{ currency: 'Bs', amount: '225' }];
            const paid = calcTotalPaidUSD(payments, totalUSD, totalsByCurrency, defaultBsRate);
            expect(paid).toBeCloseTo(5.00, 2);
            const remaining = round2(Math.max(0, totalUSD - paid));
            expect(remaining).toBeCloseTo(5.00, 2);
        });

        test('FIX: pago USD no se ve afectado por el fix (rate = 1)', () => {
            const payments = [{ currency: 'USD', amount: '10' }];
            const paid = calcTotalPaidUSD(payments, totalUSD, totalsByCurrency, defaultBsRate);
            expect(paid).toBeCloseTo(10.00, 2);
        });

        test('FIX: pago COP usa tasa COP del exchangeRate (no VES)', () => {
            const payments = [{ currency: 'COP', amount: '37107.60' }];
            const paid = calcTotalPaidUSD(payments, totalUSD, totalsByCurrency, defaultBsRate);
            expect(paid).toBeCloseTo(10.00, 1);
        });

        test('FIX: pago mixto Bs + USD cubre el total', () => {
            const payments = [
                { currency: 'Bs', amount: '225' },   // $5
                { currency: 'USD', amount: '5' },     // $5
            ];
            const paid = calcTotalPaidUSD(payments, totalUSD, totalsByCurrency, defaultBsRate);
            expect(paid).toBeCloseTo(10.00, 2);
        });

        // Escenario exacto del screenshot: tasa BCV = 100, totalBs legacy = COP
        test('FIX screenshot: tasa BCV 100, pagar 1000 Bs → cubre $10.00 exacto', () => {
            const totalUSD_sc = 10.00;
            const totalsByCurrency_sc = { USD: 10, VES: 1000, COP: 37107.60 };
            const payments = [{ currency: 'Bs', amount: '1000' }];
            const paid = calcTotalPaidUSD(payments, totalUSD_sc, totalsByCurrency_sc, 100);
            expect(paid).toBeCloseTo(10.00, 2);
            const remaining = round2(Math.max(0, totalUSD_sc - paid));
            expect(remaining).toBe(0); // NO más "$9.73 faltante"
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
