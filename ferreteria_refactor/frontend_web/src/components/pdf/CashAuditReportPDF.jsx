import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const fmtNum = (value) => {
    const num = Number(value || 0);
    const rounded = (Math.round(num * 100) / 100).toFixed(2);
    const [intPart, decPart] = rounded.split('.');
    return `${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${decPart}`;
};

const fmtCurrency = (value, currency = 'USD') => {
    const symbol = currency === 'Bs' || currency === 'VES' ? 'Bs' : currency === 'USD' || currency === '$' ? '$' : currency;
    return `${symbol} ${fmtNum(value)}`;
};

const fmtCashRows = (rows = [], field) => {
    const visibleRows = rows.filter((row) => row?.currency);
    if (visibleRows.length === 0) return fmtCurrency(0, 'USD');
    return visibleRows.map((row) => fmtCurrency(row[field], row.currency)).join(' / ');
};

const hasCashDifference = (rows = []) => rows.some((row) => Math.abs(Number(row?.difference || 0)) > 0.01);

const pad2 = (value) => String(value).padStart(2, '0');

const fmtDate = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

const sourceLabel = {
    sale_payment: 'Venta',
    debt_payment: 'CxC',
    cash_movement: 'Movimiento',
    cash_advance_incoming: 'Avance digital',
    sale_change: 'Vuelto',
    purchase_payment: 'Proveedor',
    service_payment: 'Servicio',
    layaway_payment: 'Apartado',
    external_financing_payment: 'Financiadora'
};

const bucketLabel = {
    cash_sales: 'Venta efectivo',
    digital_sales: 'Venta no efectivo',
    debt_cash: 'Abono CxC / servicio',
    service_cash: 'Servicio efectivo',
    layaway_cash: 'Abono apartado',
    manual_in: 'Entrada manual',
    manual_out: 'Salida manual',
    returns: 'Devolucion',
    cash_advances: 'Avance efectivo',
    change_given: 'Vuelto',
    purchase_cash: 'Pago proveedor',
    digital_advance_incoming: 'Contraparte digital',
    digital_or_movement_backed_debt: 'CxC conciliado',
    non_cash_purchase_payment: 'Pago proveedor no efectivo',
    non_cash_service_payment: 'Servicio no efectivo',
    non_cash_layaway_payment: 'Apartado no efectivo',
    external_financing_cash: 'Pago financiadora',
    non_cash_external_financing_payment: 'Financiadora no caja'
};

const C = {
    ink: '#0F172A',
    muted: '#64748B',
    faint: '#94A3B8',
    line: '#DCE4F0',
    soft: '#F8FAFC',
    softer: '#EEF2FF',
    primary: '#4F46E5',
    blue: '#2563EB',
    green: '#047857',
    greenBg: '#ECFDF5',
    red: '#BE123C',
    redBg: '#FFF1F2',
    amber: '#B45309',
    amberBg: '#FFFBEB',
    white: '#FFFFFF'
};

const styles = StyleSheet.create({
    page: {
        paddingTop: 28,
        paddingBottom: 34,
        paddingHorizontal: 30,
        fontFamily: 'Helvetica',
        fontSize: 8.5,
        color: C.ink,
        backgroundColor: C.white
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingBottom: 12,
        marginBottom: 12,
        borderBottomWidth: 2,
        borderBottomColor: C.primary
    },
    title: {
        fontSize: 17,
        fontFamily: 'Helvetica-Bold',
        color: C.ink
    },
    subtitle: {
        marginTop: 3,
        fontSize: 8,
        color: C.muted,
        fontFamily: 'Helvetica-Bold'
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        backgroundColor: C.softer,
        color: C.primary,
        fontSize: 8,
        fontFamily: 'Helvetica-Bold'
    },
    diagnostic: {
        marginBottom: 10,
        borderWidth: 1,
        borderColor: C.line,
        borderRadius: 6,
        padding: 9,
        backgroundColor: C.soft
    },
    diagnosticTitle: {
        fontSize: 11,
        fontFamily: 'Helvetica-Bold',
        color: C.ink
    },
    diagnosticText: {
        marginTop: 4,
        fontSize: 8,
        color: C.muted,
        lineHeight: 1.35
    },
    grid2: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10
    },
    grid4: {
        flexDirection: 'row',
        gap: 7,
        marginBottom: 10
    },
    card: {
        flex: 1,
        borderWidth: 1,
        borderColor: C.line,
        borderRadius: 5,
        padding: 8,
        backgroundColor: C.soft
    },
    cardLabel: {
        fontSize: 7,
        color: C.faint,
        fontFamily: 'Helvetica-Bold',
        textTransform: 'uppercase'
    },
    cardValue: {
        marginTop: 4,
        fontSize: 12,
        fontFamily: 'Helvetica-Bold',
        color: C.ink
    },
    section: {
        marginBottom: 10,
        borderWidth: 1,
        borderColor: C.line,
        borderRadius: 5,
        overflow: 'hidden'
    },
    sectionTitle: {
        paddingHorizontal: 9,
        paddingVertical: 5,
        backgroundColor: C.softer,
        color: C.primary,
        fontSize: 8,
        fontFamily: 'Helvetica-Bold',
        textTransform: 'uppercase'
    },
    sectionBody: {
        padding: 8
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 3,
        borderBottomWidth: 0.5,
        borderBottomColor: C.line
    },
    infoLabel: {
        color: C.muted,
        fontFamily: 'Helvetica-Bold'
    },
    infoValue: {
        fontFamily: 'Helvetica-Bold',
        textAlign: 'right'
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: C.soft,
        borderBottomWidth: 1,
        borderBottomColor: C.line
    },
    th: {
        padding: 5,
        fontSize: 7,
        color: C.muted,
        fontFamily: 'Helvetica-Bold',
        textTransform: 'uppercase'
    },
    tr: {
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderBottomColor: C.line,
        minHeight: 22
    },
    td: {
        padding: 5,
        fontSize: 7.5
    },
    right: { textAlign: 'right' },
    center: { textAlign: 'center' },
    bold: { fontFamily: 'Helvetica-Bold' },
    green: { color: C.green },
    red: { color: C.red },
    blue: { color: C.blue },
    alertBox: {
        marginBottom: 6,
        padding: 7,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#FCD34D',
        backgroundColor: C.amberBg,
        color: C.amber,
        fontSize: 8,
        fontFamily: 'Helvetica-Bold'
    },
    signatureWrap: {
        flexDirection: 'row',
        gap: 18,
        marginTop: 16,
        marginBottom: 8
    },
    signature: {
        flex: 1,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: C.ink,
        textAlign: 'center',
        fontSize: 8,
        color: C.muted,
        fontFamily: 'Helvetica-Bold'
    },
    footer: {
        position: 'absolute',
        left: 30,
        right: 30,
        bottom: 18,
        paddingTop: 6,
        borderTopWidth: 1,
        borderTopColor: C.line,
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    footerText: {
        fontSize: 7,
        color: C.faint
    }
});

const CashAuditReportPDF = ({ report, business }) => {
    if (!report) {
        return (
            <Document>
                <Page size="A4" style={styles.page}>
                    <Text>Sin datos de auditoria</Text>
                </Page>
            </Document>
        );
    }

    const session = report.session || {};
    const summary = report.summary || {};
    const cashRows = report.cash_by_currency || [];
    const methods = report.payment_methods || [];
    const transactions = report.transactions || [];
    const alerts = report.alerts || [];
    const credits = report.credits || {};
    const externalFinancing = report.external_financing || {};
    const externalRecords = externalFinancing.records || [];
    const generatedAt = fmtDate(new Date().toISOString());
    const diagnostic = buildDiagnostic(summary, cashRows);

    return (
        <Document>
            <Page size="A4" style={styles.page} wrap>
                <View style={styles.header} fixed>
                    <View>
                        <Text style={styles.title}>Informe de Arqueo de Caja</Text>
                        <Text style={styles.subtitle}>{business?.name || 'Mi Inventario'} - Sesion #{session.id || 'N/A'}</Text>
                    </View>
                    <Text style={styles.badge}>{report.schema_version || 'cash-audit'}</Text>
                </View>

                <View style={[styles.diagnostic, diagnostic.style]}>
                    <Text style={[styles.diagnosticTitle, diagnostic.textStyle]}>{diagnostic.title}</Text>
                    <Text style={styles.diagnosticText}>{diagnostic.description}</Text>
                </View>

                <View style={styles.grid2}>
                    <View style={styles.card}>
                        <Text style={styles.cardLabel}>Cajero</Text>
                        <Text style={styles.cardValue}>{session.user?.full_name || session.user?.username || 'N/A'}</Text>
                    </View>
                    <View style={styles.card}>
                        <Text style={styles.cardLabel}>Caja / Terminal</Text>
                        <Text style={styles.cardValue}>{session.register?.code || ''} {session.register?.name || ''}</Text>
                    </View>
                </View>

                <View style={styles.grid4}>
                    <View style={styles.card}>
                        <Text style={styles.cardLabel}>Esperado</Text>
                        <Text style={styles.cardValue}>{fmtCashRows(cashRows, 'expected')}</Text>
                    </View>
                    <View style={styles.card}>
                        <Text style={styles.cardLabel}>Declarado</Text>
                        <Text style={styles.cardValue}>{fmtCashRows(cashRows, 'reported')}</Text>
                    </View>
                    <View style={styles.card}>
                        <Text style={styles.cardLabel}>Diferencia</Text>
                        <Text style={[styles.cardValue, hasCashDifference(cashRows) ? styles.red : styles.green]}>
                            {fmtCashRows(cashRows, 'difference')}
                        </Text>
                    </View>
                    <View style={styles.card}>
                        <Text style={styles.cardLabel}>Alertas</Text>
                        <Text style={[styles.cardValue, Number(summary.alert_count || 0) > 0 ? styles.red : styles.green]}>{summary.alert_count || 0}</Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Datos de la sesion</Text>
                    <View style={styles.sectionBody}>
                        <InfoRow label="Apertura" value={fmtDate(session.start_time)} />
                        <InfoRow label="Cierre" value={fmtDate(session.end_time)} />
                        <InfoRow label="Estado" value={session.status || 'N/A'} />
                        <InfoRow label="Transacciones" value={summary.transaction_count || 0} />
                        <InfoRow label="Metodos de pago" value={summary.payment_method_count || 0} />
                        <InfoRow label="Generado" value={generatedAt} last />
                    </View>
                </View>

                {alerts.length > 0 && (
                    <View style={styles.section} wrap={false}>
                        <Text style={styles.sectionTitle}>Alertas</Text>
                        <View style={styles.sectionBody}>
                            {alerts.map((alert, index) => (
                                <Text key={`${alert.code}-${index}`} style={styles.alertBox}>{alert.message}</Text>
                            ))}
                        </View>
                    </View>
                )}

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Caja por moneda</Text>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.th, { flex: 0.7 }]}>Moneda</Text>
                        <Text style={[styles.th, styles.right, { flex: 1 }]}>Inicial</Text>
                        <Text style={[styles.th, styles.right, { flex: 1 }]}>Cobros</Text>
                        <Text style={[styles.th, styles.right, { flex: 1 }]}>Entradas</Text>
                        <Text style={[styles.th, styles.right, { flex: 1 }]}>Salidas</Text>
                        <Text style={[styles.th, styles.right, { flex: 1 }]}>Esperado</Text>
                        <Text style={[styles.th, styles.right, { flex: 1 }]}>Declarado</Text>
                        <Text style={[styles.th, styles.right, { flex: 1 }]}>Dif.</Text>
                    </View>
                    {cashRows.map((row) => {
                        const inflows = Number(row.cash_sales || 0) + Number(row.debt_cash || 0) + Number(row.layaway_cash || 0) + Number(row.external_financing_cash || 0) + Number(row.manual_in || 0);
                        const outflows = Number(row.manual_out || 0) + Number(row.purchase_cash || 0) + Number(row.returns || 0) + Number(row.cash_advances || 0) + Number(row.change_given || 0);
                        const diff = Number(row.difference || 0);
                        return (
                            <View key={row.currency} style={styles.tr} wrap={false}>
                                <Text style={[styles.td, styles.bold, { flex: 0.7 }]}>{row.currency}</Text>
                                <Text style={[styles.td, styles.right, { flex: 1 }]}>{fmtCurrency(row.initial, row.currency)}</Text>
                                <Text style={[styles.td, styles.right, { flex: 1 }]}>{fmtCurrency(row.cash_sales, row.currency)}</Text>
                                <Text style={[styles.td, styles.right, { flex: 1 }]}>{fmtCurrency(inflows - Number(row.cash_sales || 0), row.currency)}</Text>
                                <Text style={[styles.td, styles.right, { flex: 1 }]}>{fmtCurrency(outflows, row.currency)}</Text>
                                <Text style={[styles.td, styles.right, styles.bold, { flex: 1 }]}>{fmtCurrency(row.expected, row.currency)}</Text>
                                <Text style={[styles.td, styles.right, { flex: 1 }]}>{fmtCurrency(row.reported, row.currency)}</Text>
                                <Text style={[styles.td, styles.right, styles.bold, diff < -0.01 ? styles.red : diff > 0.01 ? styles.blue : styles.green, { flex: 1 }]}>{fmtCurrency(diff, row.currency)}</Text>
                            </View>
                        );
                    })}
                </View>

                <View style={styles.section} wrap={false}>
                    <Text style={styles.sectionTitle}>Creditos y cuentas por cobrar</Text>
                    <View style={styles.sectionBody}>
                        <InfoRow label="Creditos abiertos en el turno" value={`${credits.opened_count || 0} / ${fmtCurrency(credits.opened_amount || 0, 'USD')}`} />
                        <InfoRow label="Creditos pendientes" value={`${credits.pending_count || 0} / ${fmtCurrency(credits.pending_amount || 0, 'USD')}`} />
                        <InfoRow label="Creditos pagados" value={credits.paid_count || 0} last />
                    </View>
                </View>

                {(Number(externalFinancing.count || 0) > 0 || Number(externalFinancing.payment_count || 0) > 0) && (
                    <View style={styles.section} wrap={false}>
                        <Text style={styles.sectionTitle}>Financiamiento externo</Text>
                        <View style={styles.sectionBody}>
                            <InfoRow label="Ventas financiadas" value={externalFinancing.count || 0} />
                            <InfoRow label="Total vendido" value={fmtCurrency(externalFinancing.total_price || 0, 'USD')} />
                            <InfoRow label="Inicial cobrado equivalente" value={fmtCurrency(externalFinancing.initial_collected_usd || 0, 'USD')} />
                            <InfoRow label="Pendiente por financiadora" value={fmtCurrency(externalFinancing.pending_from_financer_usd || 0, 'USD')} />
                            <InfoRow label="Recibido de financiadoras en esta caja" value={fmtCurrency(externalFinancing.received_in_session_usd || 0, 'USD')} />
                            {externalRecords.slice(0, 5).map((record, index) => (
                                <InfoRow
                                    key={record.id}
                                    label={`Venta #${record.sale_id} ${record.financer_name}`}
                                    value={`${fmtCurrency(record.pending_amount_usd || 0, 'USD')} pendiente`}
                                    last={index === Math.min(externalRecords.length, 5) - 1}
                                />
                            ))}
                        </View>
                    </View>
                )}

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Metodos de pago</Text>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.th, { flex: 2.2 }]}>Metodo</Text>
                        <Text style={[styles.th, styles.center, { flex: 0.7 }]}>Cant.</Text>
                        <Text style={[styles.th, styles.center, { flex: 0.8 }]}>Moneda</Text>
                        <Text style={[styles.th, styles.right, { flex: 1.1 }]}>Monto</Text>
                    </View>
                    {methods.map((item, index) => (
                        <View key={`${item.method}-${item.currency}-${index}`} style={styles.tr} wrap={false}>
                            <Text style={[styles.td, styles.bold, { flex: 2.2 }]}>{item.method}</Text>
                            <Text style={[styles.td, styles.center, { flex: 0.7 }]}>{item.count || 0}</Text>
                            <Text style={[styles.td, styles.center, { flex: 0.8 }]}>{item.currency || 'USD'}</Text>
                            <Text style={[styles.td, styles.right, styles.bold, { flex: 1.1 }]}>{fmtCurrency(item.amount, item.currency)}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Libro de transacciones</Text>
                    <View style={styles.tableHeader} fixed>
                        <Text style={[styles.th, { flex: 0.9 }]}>Fecha</Text>
                        <Text style={[styles.th, { flex: 0.8 }]}>Origen</Text>
                        <Text style={[styles.th, { flex: 2.3 }]}>Referencia / detalle</Text>
                        <Text style={[styles.th, { flex: 1.1 }]}>Metodo</Text>
                        <Text style={[styles.th, styles.right, { flex: 0.9 }]}>Entrada</Text>
                        <Text style={[styles.th, styles.right, { flex: 0.9 }]}>Salida</Text>
                        <Text style={[styles.th, styles.center, { flex: 0.6 }]}>Caja</Text>
                    </View>
                    {transactions.map((row) => (
                        <View key={row.id} style={styles.tr} wrap={false}>
                            <Text style={[styles.td, { flex: 0.9 }]}>{fmtDate(row.occurred_at)}</Text>
                            <Text style={[styles.td, styles.bold, { flex: 0.8 }]}>{sourceLabel[row.source_type] || row.source_type}</Text>
                            <View style={[styles.td, { flex: 2.3 }]}>
                                <Text style={styles.bold}>{row.reference || 'Sin referencia'}</Text>
                                <Text>{row.description || bucketLabel[row.cash_bucket] || row.cash_bucket || ''}</Text>
                            </View>
                            <Text style={[styles.td, { flex: 1.1 }]}>{row.method || '-'}</Text>
                            <Text style={[styles.td, styles.right, row.inflow ? styles.green : null, { flex: 0.9 }]}>{Number(row.inflow || 0) > 0 ? fmtCurrency(row.inflow, row.currency) : '-'}</Text>
                            <Text style={[styles.td, styles.right, row.outflow ? styles.red : null, { flex: 0.9 }]}>{Number(row.outflow || 0) > 0 ? fmtCurrency(row.outflow, row.currency) : '-'}</Text>
                            <Text style={[styles.td, styles.center, styles.bold, { flex: 0.6 }]}>{row.affects_cash ? 'Si' : 'No'}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.signatureWrap} wrap={false}>
                    <Text style={styles.signature}>Firma cajero</Text>
                    <Text style={styles.signature}>Firma supervisor</Text>
                </View>

                <View style={styles.footer} fixed>
                    <Text style={styles.footerText}>Mi Inventario Facil - Informe de auditoria de caja</Text>
                    <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} de ${totalPages}`} />
                </View>
            </Page>
        </Document>
    );
};

const buildDiagnostic = (summary, cashRows = []) => {
    const alertCount = Number(summary.alert_count || 0);
    const differences = cashRows.map((row) => Number(row?.difference || 0)).filter((value) => Math.abs(value) > 0.01);
    const hasShortage = differences.some((value) => value < 0);
    const hasOverage = differences.some((value) => value > 0);

    if (differences.length === 0 && alertCount === 0) {
        return {
            title: 'Caja cuadrada sin alertas',
            description: 'El efectivo declarado coincide con el calculo del sistema y no hay advertencias operativas en esta sesion.',
            style: { borderColor: '#A7F3D0', backgroundColor: C.greenBg },
            textStyle: { color: C.green }
        };
    }
    if (differences.length > 0) {
        if (hasShortage && hasOverage) {
            return {
                title: 'Diferencias por moneda',
                description: 'Hay monedas con faltante y otras con sobrante. Revisa la tabla Caja por moneda; no se suman monedas distintas en un solo total.',
                style: { borderColor: '#FCD34D', backgroundColor: C.amberBg },
                textStyle: { color: C.amber }
            };
        }
        return {
            title: hasShortage ? 'Faltante detectado' : 'Sobrante detectado',
            description: hasShortage
                ? 'El cajero declaro menos efectivo que el esperado. Revisar salidas, devoluciones, avances, vuelto y pagos en efectivo.'
                : 'El cajero declaro mas efectivo que el esperado. Revisar entradas manuales, abonos CxC y cobros que pudieron quedar sin registrar.',
            style: { borderColor: hasShortage ? '#FDA4AF' : '#93C5FD', backgroundColor: hasShortage ? C.redBg : '#EFF6FF' },
            textStyle: { color: hasShortage ? C.red : C.blue }
        };
    }
    return {
        title: 'Caja cuadrada con alertas',
        description: 'El efectivo cuadra, pero existen movimientos que conviene revisar antes de archivar el cierre.',
        style: { borderColor: '#FCD34D', backgroundColor: C.amberBg },
        textStyle: { color: C.amber }
    };
};

const InfoRow = ({ label, value, last }) => (
    <View style={[styles.infoRow, last ? { borderBottomWidth: 0 } : null]}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
    </View>
);

export default CashAuditReportPDF;
