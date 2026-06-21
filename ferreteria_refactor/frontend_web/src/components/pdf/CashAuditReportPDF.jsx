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
    service_payment: 'Servicio'
};

const bucketLabel = {
    cash_sales: 'Venta efectivo',
    digital_sales: 'Venta no efectivo',
    debt_cash: 'Abono CxC',
    manual_in: 'Entrada manual',
    manual_out: 'Salida manual',
    returns: 'Devolucion',
    cash_advances: 'Avance efectivo',
    change_given: 'Vuelto',
    purchase_cash: 'Pago proveedor',
    digital_advance_incoming: 'Contraparte digital',
    digital_or_movement_backed_debt: 'CxC conciliado'
};

const C = {
    ink: '#0F172A',
    muted: '#64748B',
    faint: '#94A3B8',
    line: '#DCE4F0',
    soft: '#F8FAFC',
    softer: '#EEF2FF',
    primary: '#4F46E5',
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
        fontSize: 13,
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
    const generatedAt = fmtDate(new Date().toISOString());

    return (
        <Document>
            <Page size="A4" style={styles.page} wrap>
                <View style={styles.header} fixed>
                    <View>
                        <Text style={styles.title}>Auditoria de Arqueo de Caja</Text>
                        <Text style={styles.subtitle}>{business?.name || 'Mi Inventario'} - Sesion #{session.id || 'N/A'}</Text>
                    </View>
                    <Text style={styles.badge}>{report.schema_version || 'cash-audit'}</Text>
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
                        <Text style={styles.cardLabel}>Transacciones</Text>
                        <Text style={styles.cardValue}>{summary.transaction_count || 0}</Text>
                    </View>
                    <View style={styles.card}>
                        <Text style={styles.cardLabel}>Metodos</Text>
                        <Text style={styles.cardValue}>{summary.payment_method_count || 0}</Text>
                    </View>
                    <View style={styles.card}>
                        <Text style={styles.cardLabel}>Esperado</Text>
                        <Text style={styles.cardValue}>{fmtCurrency(summary.cash_expected_total_display_only, 'USD')}</Text>
                    </View>
                    <View style={styles.card}>
                        <Text style={styles.cardLabel}>Diferencia</Text>
                        <Text style={[styles.cardValue, Math.abs(Number(summary.cash_difference_total_display_only || 0)) > 0.01 ? styles.red : styles.green]}>
                            {fmtCurrency(summary.cash_difference_total_display_only, 'USD')}
                        </Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Datos de la sesion</Text>
                    <View style={styles.sectionBody}>
                        <InfoRow label="Apertura" value={fmtDate(session.start_time)} />
                        <InfoRow label="Cierre" value={fmtDate(session.end_time)} />
                        <InfoRow label="Estado" value={session.status || 'N/A'} />
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
                        <Text style={[styles.th, styles.right, { flex: 1 }]}>Ventas</Text>
                        <Text style={[styles.th, styles.right, { flex: 1 }]}>Entradas</Text>
                        <Text style={[styles.th, styles.right, { flex: 1 }]}>Salidas</Text>
                        <Text style={[styles.th, styles.right, { flex: 1 }]}>Esperado</Text>
                        <Text style={[styles.th, styles.right, { flex: 1 }]}>Reportado</Text>
                        <Text style={[styles.th, styles.right, { flex: 1 }]}>Dif.</Text>
                    </View>
                    {cashRows.map((row) => {
                        const outflows = Number(row.manual_out || 0) + Number(row.purchase_cash || 0) + Number(row.returns || 0) + Number(row.cash_advances || 0) + Number(row.change_given || 0);
                        const inflows = Number(row.manual_in || 0) + Number(row.debt_cash || 0);
                        const diff = Number(row.difference || 0);
                        return (
                            <View key={row.currency} style={styles.tr} wrap={false}>
                                <Text style={[styles.td, styles.bold, { flex: 0.7 }]}>{row.currency}</Text>
                                <Text style={[styles.td, styles.right, { flex: 1 }]}>{fmtCurrency(row.initial, row.currency)}</Text>
                                <Text style={[styles.td, styles.right, { flex: 1 }]}>{fmtCurrency(row.cash_sales, row.currency)}</Text>
                                <Text style={[styles.td, styles.right, { flex: 1 }]}>{fmtCurrency(inflows, row.currency)}</Text>
                                <Text style={[styles.td, styles.right, { flex: 1 }]}>{fmtCurrency(outflows, row.currency)}</Text>
                                <Text style={[styles.td, styles.right, styles.bold, { flex: 1 }]}>{fmtCurrency(row.expected, row.currency)}</Text>
                                <Text style={[styles.td, styles.right, { flex: 1 }]}>{fmtCurrency(row.reported, row.currency)}</Text>
                                <Text style={[styles.td, styles.right, styles.bold, diff < -0.01 ? styles.red : diff > 0.01 ? styles.green : null, { flex: 1 }]}>{fmtCurrency(diff, row.currency)}</Text>
                            </View>
                        );
                    })}
                </View>

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

                <View style={styles.footer} fixed>
                    <Text style={styles.footerText}>Mi Inventario Facil - Informe de auditoria de caja</Text>
                    <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} de ${totalPages}`} />
                </View>
            </Page>
        </Document>
    );
};

const InfoRow = ({ label, value, last }) => (
    <View style={[styles.infoRow, last ? { borderBottomWidth: 0 } : null]}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
    </View>
);

export default CashAuditReportPDF;
