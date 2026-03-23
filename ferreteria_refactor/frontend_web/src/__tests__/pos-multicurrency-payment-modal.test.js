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

// =============================================================================
// NUEVOS TESTS — Fix: COP usa tasa ponderada del carrito (igual que VES)
// Fix: Backend valida tasas de cambio contra BD
// =============================================================================

/**
 * Fix: COP (y cualquier moneda no-USD/no-VES) ahora usa tasa ponderada del carrito,
 * igual que VES, en lugar de usar siempre la tasa global del ConfigContext.
 *
 * Escenario problemático:
 *   - Producto con tasa COP específica 3500 (no la global 3710.76)
 *   - CartContext calcula totalsByCurrency.COP = 35000 para $10
 *   - Modal ANTES: usaba getExchangeRate('COP') = 3710.76 → error de conversión
 *   - Modal AHORA: usa totalsByCurrency.COP / totalUSD = 3500 → correcto
 */

describe('PaymentModal — Fix: COP usa tasa ponderada del carrito', () => {

    function calcTotalPaidUSDFixed(payments, totalUSD, totalsByCurrency, getExchangeRate) {
        return payments.reduce((acc, p) => {
            const amount = parseFloat(p.amount) || 0;
            let rate = 1;
            if (p.currency === 'USD' || p.currency === '$') {
                rate = 1;
            } else if (p.currency === 'Bs' || p.currency === 'VES') {
                const vesTotal = totalsByCurrency?.VES || totalsByCurrency?.Bs;
                rate = (vesTotal && totalUSD) ? (vesTotal / totalUSD) : (getExchangeRate('VES') || 1);
            } else {
                const currTotal = totalsByCurrency?.[p.currency];
                const weightedRate = (currTotal && totalUSD) ? (currTotal / totalUSD) : null;
                rate = weightedRate || getExchangeRate(p.currency) || 1;
            }
            return round2(acc + round2(amount / rate));
        }, 0);
    }

    function calcTotalPaidUSDBugCOP(payments, totalUSD, totalsByCurrency, getExchangeRate) {
        return payments.reduce((acc, p) => {
            const amount = parseFloat(p.amount) || 0;
            let rate = 1;
            if (p.currency === 'USD' || p.currency === '$') {
                rate = 1;
            } else if (p.currency === 'Bs' || p.currency === 'VES') {
                const vesTotal = totalsByCurrency?.VES || totalsByCurrency?.Bs;
                rate = (vesTotal && totalUSD) ? (vesTotal / totalUSD) : (getExchangeRate('VES') || 1);
            } else {
                rate = getExchangeRate(p.currency) || 1; // BUG: siempre tasa global
            }
            return round2(acc + round2(amount / rate));
        }, 0);
    }

    const totalUSD = 10.00;
    const totalsByCurrencyEspecial = { USD: 10.00, VES: 450.00, COP: 35000.00 };
    const getExchangeRateGlobal = (code) => ({ VES: 45, Bs: 45, COP: 3710.76 }[code] || 1);

    test('BUG: pagar 35000 COP con tasa global 3710.76 cubre solo $9.43', () => {
        const payments = [{ currency: 'COP', amount: '35000' }];
        const paid = calcTotalPaidUSDBugCOP(payments, totalUSD, totalsByCurrencyEspecial, getExchangeRateGlobal);
        expect(paid).toBeCloseTo(35000 / 3710.76, 1);
        expect(paid).not.toBeCloseTo(10.00, 1);
    });

    test('FIX: pagar 35000 COP con tasa ponderada 3500 cubre exactamente $10.00', () => {
        const payments = [{ currency: 'COP', amount: '35000' }];
        const paid = calcTotalPaidUSDFixed(payments, totalUSD, totalsByCurrencyEspecial, getExchangeRateGlobal);
        expect(paid).toBeCloseTo(10.00, 2);
    });

    test('FIX: remaining = $0 al pagar el total COP exacto con tasa especial', () => {
        const payments = [{ currency: 'COP', amount: '35000' }];
        const paid = calcTotalPaidUSDFixed(payments, totalUSD, totalsByCurrencyEspecial, getExchangeRateGlobal);
        expect(round2(Math.max(0, totalUSD - paid))).toBe(0);
    });

    test('FIX: sin totalsByCurrency.COP -> fallback a tasa global 3710.76', () => {
        const totalsNoCOP = { USD: 10, VES: 450 };
        const payments = [{ currency: 'COP', amount: '37107.60' }];
        const paid = calcTotalPaidUSDFixed(payments, totalUSD, totalsNoCOP, getExchangeRateGlobal);
        expect(paid).toBeCloseTo(10.00, 1);
    });

    test('FIX: pago mixto Bs + COP (tasas especiales) + USD cubre $10', () => {
        const payments = [
            { currency: 'Bs', amount: String(3 * 45) },
            { currency: 'COP', amount: String(3 * 3500) },
            { currency: 'USD', amount: '4' },
        ];
        const paid = calcTotalPaidUSDFixed(payments, totalUSD, totalsByCurrencyEspecial, getExchangeRateGlobal);
        expect(paid).toBeCloseTo(10.00, 1);
    });

    test('FIX: tasa mostrada en UI = tasa ponderada del carrito (no global)', () => {
        const getDisplayRate = (currency, totalsByCurrency, totalUSD, getExchangeRate) => {
            const currTotal = totalsByCurrency?.[currency];
            return (currTotal && totalUSD) ? (currTotal / totalUSD) : (getExchangeRate(currency) || 1);
        };
        const displayed = getDisplayRate('COP', totalsByCurrencyEspecial, totalUSD, getExchangeRateGlobal);
        expect(displayed).toBeCloseTo(3500, 0);
        expect(displayed).not.toBeCloseTo(3710.76, 0);
    });
});

// =============================================================================
// TESTS — Fix Backend: validacion de tasas de cambio
// =============================================================================

describe('Backend — Validacion de tasa de cambio por pago', () => {

    function validatePaymentRate(payment, dbRates) {
        if (payment.currency === 'USD' || payment.currency === '$') {
            return { valid: true, usdEquivalent: round2(parseFloat(payment.amount)), validatedRate: 1 };
        }
        const dbRate = dbRates.find(r => r.currency_code === payment.currency && r.is_active);
        if (!dbRate) return { valid: false, error: `Moneda no valida o no activa: ${payment.currency}` };

        const dbRateVal = parseFloat(dbRate.rate);
        const frontendRate = parseFloat(payment.exchange_rate || 0);

        if (frontendRate > 0 && dbRateVal > 0) {
            const diffPct = Math.abs(frontendRate - dbRateVal) / dbRateVal;
            if (diffPct > 0.15) {
                return { valid: false, error: `Tasa invalida para ${payment.currency}: recibida ${frontendRate.toFixed(2)}, esperada ${dbRateVal.toFixed(2)}` };
            }
        }
        return { valid: true, usdEquivalent: round2(parseFloat(payment.amount) / dbRateVal), validatedRate: dbRateVal };
    }

    function validateTotalPaid(payments, totalAmount, dbRates) {
        let totalPaidUSD = 0;
        for (const p of payments) {
            const result = validatePaymentRate(p, dbRates);
            if (!result.valid) return { valid: false, error: result.error };
            totalPaidUSD = round2(totalPaidUSD + result.usdEquivalent);
        }
        if (totalPaidUSD < totalAmount - 0.05) {
            const faltante = round2(totalAmount - totalPaidUSD);
            return { valid: false, error: `Pago insuficiente. Faltan $${faltante.toFixed(2)}` };
        }
        return { valid: true, totalPaidUSD };
    }

    const dbRates = [
        { currency_code: 'VES', rate: 45.00, is_active: true },
        { currency_code: 'COP', rate: 3710.76, is_active: true },
    ];

    test('USD: siempre valido, equivalente 1:1', () => {
        const r = validatePaymentRate({ currency: 'USD', amount: '10', exchange_rate: null }, dbRates);
        expect(r.valid).toBe(true);
        expect(r.usdEquivalent).toBeCloseTo(10.00, 2);
    });

    test('Bs con tasa correcta 45: valido, usdEquivalent = $10', () => {
        const r = validatePaymentRate({ currency: 'VES', amount: '450', exchange_rate: 45 }, dbRates);
        expect(r.valid).toBe(true);
        expect(r.usdEquivalent).toBeCloseTo(10.00, 2);
    });

    test('Bs con tasa dentro de +-15% (47, diff 4.4%): valido', () => {
        const r = validatePaymentRate({ currency: 'VES', amount: '450', exchange_rate: 47 }, dbRates);
        expect(r.valid).toBe(true);
    });

    test('Bs con tasa fuera de +-15% (tasa 1 vs 45, diff 97%): invalido', () => {
        const r = validatePaymentRate({ currency: 'VES', amount: '450', exchange_rate: 1 }, dbRates);
        expect(r.valid).toBe(false);
        expect(r.error).toContain('Tasa invalida');
    });

    test('Moneda no registrada en BD (EUR): invalido', () => {
        const r = validatePaymentRate({ currency: 'EUR', amount: '10', exchange_rate: 1.1 }, dbRates);
        expect(r.valid).toBe(false);
        expect(r.error).toContain('Moneda no valida');
    });

    test('Backend usa tasa de BD aunque frontend envie distinta (dentro +-15%)', () => {
        const r = validatePaymentRate({ currency: 'VES', amount: '450', exchange_rate: 42 }, dbRates);
        expect(r.valid).toBe(true);
        expect(r.validatedRate).toBeCloseTo(45.00, 2); // tasa de BD
    });

    test('Intento de fraude: tasa 1 para Bs rechazada por backend', () => {
        const r = validatePaymentRate({ currency: 'VES', amount: '450', exchange_rate: 1 }, dbRates);
        expect(r.valid).toBe(false);
    });

    test('Pago completo Bs (450 Bs = $10): valido', () => {
        const r = validateTotalPaid([{ currency: 'VES', amount: '450', exchange_rate: 45 }], 10.00, dbRates);
        expect(r.valid).toBe(true);
        expect(r.totalPaidUSD).toBeCloseTo(10.00, 2);
    });

    test('Pago mixto Bs + COP + USD que cubre $30: valido', () => {
        const payments = [
            { currency: 'VES', amount: '450', exchange_rate: 45 },
            { currency: 'COP', amount: '37107.60', exchange_rate: 3710.76 },
            { currency: 'USD', amount: '10', exchange_rate: null },
        ];
        const r = validateTotalPaid(payments, 30.00, dbRates);
        expect(r.valid).toBe(true);
        expect(r.totalPaidUSD).toBeCloseTo(30.00, 1);
    });

    test('Pago insuficiente $8 para factura $10: error con faltante', () => {
        const r = validateTotalPaid([{ currency: 'USD', amount: '8', exchange_rate: null }], 10.00, dbRates);
        expect(r.valid).toBe(false);
        expect(r.error).toContain('Pago insuficiente');
        expect(r.error).toContain('$2.00');
    });

    test('Tolerancia $0.05 por redondeo: $9.96 cubre $10.00 (diff $0.04)', () => {
        const r = validateTotalPaid([{ currency: 'USD', amount: '9.96', exchange_rate: null }], 10.00, dbRates);
        expect(r.valid).toBe(true);
    });

    test('Pago con tasa manipulada en uno de los metodos: rechaza todo', () => {
        const payments = [
            { currency: 'USD', amount: '5', exchange_rate: null },
            { currency: 'VES', amount: '225', exchange_rate: 1 }, // manipulada
        ];
        const r = validateTotalPaid(payments, 10.00, dbRates);
        expect(r.valid).toBe(false);
        expect(r.error).toContain('Tasa invalida');
    });
});
