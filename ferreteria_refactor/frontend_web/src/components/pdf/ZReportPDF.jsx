import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

// ─────────────────────────────────────────────────────────────────────────────
// Safe number/date helpers — NO toLocaleString / Intl (not supported in PDF)
// ─────────────────────────────────────────────────────────────────────────────

const fmtNum = (value) => {
    const num = parseFloat(value || 0);
    const rounded = (Math.round(num * 100) / 100).toFixed(2);
    // Insert thousands separators manually
    const [intPart, decPart] = rounded.split('.');
    const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${withCommas}.${decPart}`;
};

const fmtUSD = (value) => `$ ${fmtNum(value)}`;
const fmtBs  = (value) => `Bs ${fmtNum(value)}`;
// Formatea con cualquier símbolo de moneda (COP, EUR, etc.)
const fmtCurrency = (value, symbol = '$') => {
    if (!symbol || symbol === '$' || symbol === 'USD') return fmtUSD(value);
    if (symbol === 'Bs' || symbol === 'VES') return fmtBs(value);
    return `${symbol} ${fmtNum(value)}`;
};

const PAD2 = (n) => String(n).padStart(2, '0');

const fmtDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return String(dateString);
        const day   = PAD2(d.getDate());
        const month = PAD2(d.getMonth() + 1);
        const year  = d.getFullYear();
        const hh    = PAD2(d.getHours());
        const mm    = PAD2(d.getMinutes());
        return `${day}/${month}/${year}  ${hh}:${mm}`;
    } catch {
        return String(dateString);
    }
};

const fmtNow = () => {
    try {
        const d = new Date();
        const day   = PAD2(d.getDate());
        const month = PAD2(d.getMonth() + 1);
        const year  = d.getFullYear();
        const hh    = PAD2(d.getHours());
        const mm    = PAD2(d.getMinutes());
        return `${day}/${month}/${year} ${hh}:${mm}`;
    } catch {
        return '';
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const C = {
    primary:   '#4F46E5',   // indigo-600
    primaryLt: '#EEF2FF',   // indigo-50
    gray:      '#6B7280',
    grayLt:    '#F9FAFB',
    border:    '#E5E7EB',
    dark:      '#111827',
    success:   '#059669',
    danger:    '#DC2626',
    white:     '#FFFFFF',
};

const styles = StyleSheet.create({
    page: {
        padding: 36,
        fontSize: 9,
        fontFamily: 'Helvetica',
        color: C.dark,
        backgroundColor: C.white,
    },

    // ── Header ──────────────────────────────────────────────────────────────
    header: {
        marginBottom: 18,
        borderBottomWidth: 2,
        borderBottomColor: C.primary,
        paddingBottom: 14,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    headerLeft: {},
    brandName: {
        fontSize: 20,
        fontFamily: 'Helvetica-Bold',
        color: C.primary,
        letterSpacing: 0.5,
    },
    businessName: {
        fontSize: 12,
        fontFamily: 'Helvetica-Bold',
        color: C.dark,
        marginTop: 2,
    },
    headerRight: {
        alignItems: 'flex-end',
    },
    reportTitle: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
        color: C.gray,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    sessionBadge: {
        marginTop: 4,
        fontSize: 8,
        color: C.gray,
    },

    // ── Section card ────────────────────────────────────────────────────────
    section: {
        marginBottom: 12,
        backgroundColor: C.grayLt,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: C.border,
        overflow: 'hidden',
    },
    sectionHeader: {
        backgroundColor: C.primary,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    sectionTitle: {
        fontSize: 8,
        fontFamily: 'Helvetica-Bold',
        color: C.white,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    sectionBody: {
        paddingHorizontal: 10,
        paddingVertical: 6,
    },

    // ── Row ─────────────────────────────────────────────────────────────────
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
        borderBottomWidth: 0.5,
        borderBottomColor: C.border,
    },
    rowLast: {
        borderBottomWidth: 0,
    },
    label: {
        fontSize: 8,
        color: C.gray,
        fontFamily: 'Helvetica-Bold',
        flex: 1,
    },
    value: {
        fontSize: 9,
        fontFamily: 'Helvetica-Bold',
        color: C.dark,
        textAlign: 'right',
    },

    // ── Table for payment methods ────────────────────────────────────────────
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: C.primaryLt,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    tableHeaderCell: {
        fontSize: 7,
        fontFamily: 'Helvetica-Bold',
        color: C.primary,
        textTransform: 'uppercase',
    },
    tableRow: {
        flexDirection: 'row',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderBottomWidth: 0.5,
        borderBottomColor: C.border,
    },
    tableRowAlt: {
        backgroundColor: C.grayLt,
    },
    colMethod: { flex: 2 },
    colAmountUSD: { flex: 1.2, textAlign: 'right' },
    colAmountBs:  { flex: 1.2, textAlign: 'right' },

    // ── Currency sub-card ────────────────────────────────────────────────────
    currencyCard: {
        marginBottom: 8,
        backgroundColor: C.white,
        borderRadius: 3,
        borderWidth: 1,
        borderColor: C.border,
        overflow: 'hidden',
    },
    currencyCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: C.primaryLt,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    currencySymbol: {
        fontSize: 9,
        fontFamily: 'Helvetica-Bold',
        color: C.primary,
    },
    currencyCardBody: {
        paddingHorizontal: 10,
        paddingVertical: 4,
    },

    // ── Total row ────────────────────────────────────────────────────────────
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 6,
        paddingTop: 6,
        borderTopWidth: 1.5,
        borderTopColor: C.primary,
        paddingHorizontal: 10,
        paddingBottom: 6,
    },
    totalLabel: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
        color: C.dark,
    },
    totalValue: {
        fontSize: 11,
        fontFamily: 'Helvetica-Bold',
        color: C.primary,
    },

    // ── Difference badges ───────────────────────────────────────────────────
    diffPositive: { color: C.success, fontFamily: 'Helvetica-Bold' },
    diffNegative: { color: C.danger,  fontFamily: 'Helvetica-Bold' },

    // ── Footer ──────────────────────────────────────────────────────────────
    footer: {
        position: 'absolute',
        bottom: 24,
        left: 36,
        right: 36,
        borderTopWidth: 1,
        borderTopColor: C.border,
        paddingTop: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    footerText: {
        fontSize: 7,
        color: C.gray,
    },
    footerBrand: {
        fontSize: 7,
        color: C.primary,
        fontFamily: 'Helvetica-Bold',
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const ZReportPDF = ({ session, business }) => {
    if (!session) {
        return (
            <Document>
                <Page size="A4" style={styles.page}>
                    <Text>Sin datos de sesión</Text>
                </Page>
            </Document>
        );
    }

    const cashierName = session.user?.full_name || session.user?.username || 'N/A';
    const registerName = session.register?.name || session.register?.code || null;

    // Compute totals from payment breakdown — group by currency
    const totalUSD = (session.payment_breakdown || [])
        .filter(p => p.currency === 'USD')
        .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    // Group non-USD payments by currency_code
    const localTotals = (session.payment_breakdown || [])
        .filter(p => p.currency !== 'USD')
        .reduce((acc, p) => {
            const key = p.currency || 'USD';
            acc[key] = (acc[key] || 0) + parseFloat(p.amount || 0);
            return acc;
        }, {});
    // Keep backward compat: totalBs = sum of all local (used in legacy sections)
    const totalBs = Object.values(localTotals).reduce((s, v) => s + v, 0);

    // Transaction count (number of sale movements, fallback to breakdown count)
    const txCount = session.sales_count || session.transaction_count
        || (session.payment_breakdown?.reduce((s, p) => s + (p.count || 0), 0))
        || null;

    // Initial fund, income, expense, balance from primary currency if available
    const anchorCurr = (session.currencies || []).find(c => c.is_anchor) || (session.currencies || [])[0];

    return (
        <Document>
            <Page size="A4" style={styles.page}>

                {/* ── HEADER ─────────────────────────────────────────────── */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.brandName}>Mi Inventario Facil</Text>
                        {business?.name ? (
                            <Text style={styles.businessName}>{business.name}</Text>
                        ) : null}
                    </View>
                    <View style={styles.headerRight}>
                        <Text style={styles.reportTitle}>Reporte de Cierre de Caja (Z)</Text>
                        <Text style={styles.sessionBadge}>Sesion #{session.id}</Text>
                    </View>
                </View>

                {/* ── INFORMACION DE SESION ──────────────────────────────── */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Informacion de la Sesion</Text>
                    </View>
                    <View style={styles.sectionBody}>
                        <View style={styles.row}>
                            <Text style={styles.label}>Fecha de Apertura</Text>
                            <Text style={styles.value}>{fmtDate(session.opened_at || session.start_time)}</Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>Fecha de Cierre</Text>
                            <Text style={styles.value}>{fmtDate(session.closed_at || session.end_time)}</Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>Cajero</Text>
                            <Text style={styles.value}>{cashierName}</Text>
                        </View>
                        {registerName && (
                            <View style={styles.row}>
                                <Text style={styles.label}>Caja / Terminal</Text>
                                <Text style={styles.value}>{registerName}</Text>
                            </View>
                        )}
                        <View style={[styles.row, styles.rowLast]}>
                            <Text style={styles.label}>Estado</Text>
                            <Text style={styles.value}>
                                {session.status === 'CLOSED' ? 'CERRADA' : 'ABIERTA'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* ── RESUMEN DE VENTAS ──────────────────────────────────── */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Resumen de Ventas</Text>
                    </View>
                    <View style={styles.sectionBody}>
                        {txCount !== null && (
                            <View style={styles.row}>
                                <Text style={styles.label}>Nro de Transacciones</Text>
                                <Text style={styles.value}>{String(txCount)}</Text>
                            </View>
                        )}
                        <View style={styles.row}>
                            <Text style={styles.label}>Total Ventas USD</Text>
                            <Text style={styles.value}>{fmtUSD(totalUSD)}</Text>
                        </View>
                        {Object.entries(localTotals).map(([cur, amt], idx, arr) =>
                            amt > 0 ? (
                                <View key={cur} style={idx === arr.length - 1 ? [styles.row, styles.rowLast] : styles.row}>
                                    <Text style={styles.label}>Total Ventas {cur}</Text>
                                    <Text style={styles.value}>{fmtCurrency(amt, cur)}</Text>
                                </View>
                            ) : null
                        )}
                    </View>
                </View>

                {/* ── METODOS DE PAGO ────────────────────────────────────── */}
                {session.payment_breakdown && session.payment_breakdown.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Detalle por Metodo de Pago</Text>
                        </View>
                        {/* Table header */}
                        <View style={styles.tableHeader}>
                            <Text style={[styles.tableHeaderCell, styles.colMethod]}>Metodo</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Moneda</Text>
                            <Text style={[styles.tableHeaderCell, styles.colAmountUSD, { textAlign: 'right' }]}>Monto</Text>
                        </View>
                        {session.payment_breakdown.map((item, idx) => (
                            <View
                                key={idx}
                                style={[
                                    styles.tableRow,
                                    idx % 2 !== 0 ? styles.tableRowAlt : null,
                                ]}
                            >
                                <Text style={[styles.label, styles.colMethod]}>{item.method}</Text>
                                <Text style={[styles.value, { flex: 1, textAlign: 'right' }]}>
                                    {item.currency || 'USD'}
                                </Text>
                                <Text style={[styles.value, styles.colAmountUSD]}>
                                    {fmtCurrency(item.amount, item.currency === 'USD' ? '$' : (item.currency || '$'))}
                                </Text>
                            </View>
                        ))}
                        {/* Totals row */}
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>TOTAL</Text>
                            <Text style={styles.totalValue}>
                                {fmtUSD(totalUSD)}
                                {Object.entries(localTotals).map(([cur, amt]) =>
                                    `  /  ${fmtCurrency(amt, cur)}`
                                ).join('')}
                            </Text>
                        </View>
                    </View>
                )}

                {/* ── DETALLE DE EFECTIVO (per currency) ─────────────────── */}
                {session.currencies && session.currencies.length > 0 ? (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Detalle de Efectivo</Text>
                        </View>
                        <View style={[styles.sectionBody, { paddingTop: 8 }]}>
                            {session.currencies.map((curr, idx) => {
                                const diff = parseFloat(curr.difference || 0);
                                const sym = curr.currency_symbol || '$';
                                const fmt = (v) => fmtCurrency(v, sym);
                                const initial  = parseFloat(curr.initial_amount || 0);
                                const expected = parseFloat(curr.final_expected  || 0);
                                const income   = expected - initial;

                                return (
                                    <View key={idx} style={styles.currencyCard}>
                                        <View style={styles.currencyCardHeader}>
                                            <Text style={styles.currencySymbol}>{sym}</Text>
                                        </View>
                                        <View style={styles.currencyCardBody}>
                                            <View style={styles.row}>
                                                <Text style={styles.label}>Fondo Inicial</Text>
                                                <Text style={styles.value}>{fmt(curr.initial_amount)}</Text>
                                            </View>
                                            <View style={styles.row}>
                                                <Text style={styles.label}>Total Ingresos (calculado)</Text>
                                                <Text style={styles.value}>{fmt(income > 0 ? income : 0)}</Text>
                                            </View>
                                            <View style={styles.row}>
                                                <Text style={styles.label}>Esperado en Caja</Text>
                                                <Text style={styles.value}>{fmt(curr.final_expected)}</Text>
                                            </View>
                                            <View style={styles.row}>
                                                <Text style={styles.label}>Balance Reportado</Text>
                                                <Text style={styles.value}>{fmt(curr.final_reported)}</Text>
                                            </View>
                                            {Math.abs(diff) >= 0.01 && (
                                                <View style={[styles.row, styles.rowLast]}>
                                                    <Text style={styles.label}>Diferencia</Text>
                                                    <Text style={[styles.value, diff > 0 ? styles.diffPositive : styles.diffNegative]}>
                                                        {diff > 0 ? '+' : ''}{fmt(diff)}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                ) : (
                    /* ── Fallback legacy fields ─────────────────────────── */
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Detalle de Efectivo</Text>
                        </View>
                        <View style={styles.sectionBody}>
                            {/* USD */}
                            <View style={styles.currencyCard}>
                                <View style={styles.currencyCardHeader}>
                                    <Text style={styles.currencySymbol}>USD ($)</Text>
                                </View>
                                <View style={styles.currencyCardBody}>
                                    <View style={styles.row}>
                                        <Text style={styles.label}>Fondo Inicial</Text>
                                        <Text style={styles.value}>{fmtUSD(session.initial_cash)}</Text>
                                    </View>
                                    <View style={styles.row}>
                                        <Text style={styles.label}>Total Ingresos</Text>
                                        <Text style={styles.value}>{fmtUSD(parseFloat(session.final_cash_expected || 0) - parseFloat(session.initial_cash || 0))}</Text>
                                    </View>
                                    <View style={styles.row}>
                                        <Text style={styles.label}>Esperado en Caja</Text>
                                        <Text style={styles.value}>{fmtUSD(session.final_cash_expected)}</Text>
                                    </View>
                                    <View style={styles.row}>
                                        <Text style={styles.label}>Balance Reportado</Text>
                                        <Text style={styles.value}>{fmtUSD(session.final_cash_reported)}</Text>
                                    </View>
                                    {Math.abs(parseFloat(session.difference || 0)) >= 0.01 && (
                                        <View style={[styles.row, styles.rowLast]}>
                                            <Text style={styles.label}>Diferencia</Text>
                                            <Text style={[
                                                styles.value,
                                                parseFloat(session.difference || 0) > 0 ? styles.diffPositive : styles.diffNegative,
                                            ]}>
                                                {parseFloat(session.difference || 0) > 0 ? '+' : ''}{fmtUSD(session.difference)}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                            {/* Bs (only if present) */}
                            {(parseFloat(session.initial_cash_bs || 0) > 0 ||
                              parseFloat(session.final_cash_expected_bs || 0) > 0) && (
                                <View style={[styles.currencyCard, { marginTop: 6 }]}>
                                    <View style={styles.currencyCardHeader}>
                                        <Text style={styles.currencySymbol}>Bolivares (Bs)</Text>
                                    </View>
                                    <View style={styles.currencyCardBody}>
                                        <View style={styles.row}>
                                            <Text style={styles.label}>Fondo Inicial</Text>
                                            <Text style={styles.value}>{fmtBs(session.initial_cash_bs)}</Text>
                                        </View>
                                        <View style={styles.row}>
                                            <Text style={styles.label}>Total Ingresos</Text>
                                            <Text style={styles.value}>{fmtBs(parseFloat(session.final_cash_expected_bs || 0) - parseFloat(session.initial_cash_bs || 0))}</Text>
                                        </View>
                                        <View style={styles.row}>
                                            <Text style={styles.label}>Esperado en Caja</Text>
                                            <Text style={styles.value}>{fmtBs(session.final_cash_expected_bs)}</Text>
                                        </View>
                                        <View style={[styles.row, styles.rowLast]}>
                                            <Text style={styles.label}>Balance Reportado</Text>
                                            <Text style={styles.value}>{fmtBs(session.final_cash_reported_bs)}</Text>
                                        </View>
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>
                )}

                {/* ── FOOTER ─────────────────────────────────────────────── */}
                <View style={styles.footer} fixed>
                    <Text style={styles.footerBrand}>Generado por Mi Inventario Facil  •  miinventariofacil.com</Text>
                    <Text style={styles.footerText}>Impreso: {fmtNow()}</Text>
                </View>

            </Page>
        </Document>
    );
};

export default ZReportPDF;
