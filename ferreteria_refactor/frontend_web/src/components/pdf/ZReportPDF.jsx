import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontSize: 10,
        fontFamily: 'Helvetica',
        color: '#333'
    },
    header: {
        marginBottom: 20,
        borderBottomWidth: 2,
        borderBottomColor: '#2563EB',
        paddingBottom: 15
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#2563EB',
        marginBottom: 5
    },
    subtitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 3
    },
    meta: {
        fontSize: 9,
        color: '#666',
        marginTop: 2
    },
    section: {
        marginBottom: 15,
        padding: 10,
        backgroundColor: '#F9FAFB',
        borderRadius: 4
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#111',
        textTransform: 'uppercase',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
        paddingBottom: 4
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
        borderBottomWidth: 0.5,
        borderBottomColor: '#eee'
    },
    label: {
        fontSize: 9,
        color: '#666',
        fontWeight: 'bold'
    },
    value: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#111'
    },
    currencySection: {
        marginBottom: 12,
        padding: 8,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 4
    },
    currencyTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 6,
        color: '#2563EB'
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
        marginTop: 8,
        borderTopWidth: 2,
        borderTopColor: '#2563EB'
    },
    totalLabel: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#111'
    },
    totalValue: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#2563EB'
    },
    differencePositive: {
        color: '#059669',
        fontWeight: 'bold'
    },
    differenceNegative: {
        color: '#DC2626',
        fontWeight: 'bold'
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 40,
        right: 40,
        textAlign: 'center',
        fontSize: 8,
        color: '#999',
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingTop: 10
    }
});

const ZReportPDF = ({ session, business }) => {
    if (!session) return <Document><Page><Text>No data</Text></Page></Document>;

    const formatCurrency = (amount, symbol = '$') => {
        const num = parseFloat(amount || 0);
        return `${symbol} ${num.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString('es-VE', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>{business?.name || "InvenSoft"}</Text>
                    <Text style={styles.subtitle}>REPORTE Z - CORTE DE CAJA</Text>
                    <Text style={styles.meta}>Sesión #{session.id}</Text>
                    <Text style={styles.meta}>Cajero: {session.user?.full_name || session.user?.username || 'N/A'}</Text>
                </View>

                {/* Session Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Información de Sesión</Text>
                    <View style={styles.row}>
                        <Text style={styles.label}>Apertura:</Text>
                        <Text style={styles.value}>{formatDate(session.opened_at || session.start_time)}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Cierre:</Text>
                        <Text style={styles.value}>{formatDate(session.closed_at || session.end_time)}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Estado:</Text>
                        <Text style={styles.value}>{session.status === 'CLOSED' ? 'CERRADA' : 'ABIERTA'}</Text>
                    </View>
                </View>

                {/* Currency Breakdown */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Detalle por Moneda</Text>
                    {(session.currencies || []).map((curr, index) => {
                        const diff = parseFloat(curr.difference || 0);
                        const symbol = curr.currency_symbol === 'USD' ? '$' : curr.currency_symbol;

                        return (
                            <View key={index} style={styles.currencySection}>
                                <Text style={styles.currencyTitle}>{curr.currency_symbol}</Text>
                                <View style={styles.row}>
                                    <Text style={styles.label}>Fondo Inicial:</Text>
                                    <Text style={styles.value}>{formatCurrency(curr.initial_amount, symbol)}</Text>
                                </View>
                                <View style={styles.row}>
                                    <Text style={styles.label}>Esperado (Calculado):</Text>
                                    <Text style={styles.value}>{formatCurrency(curr.final_expected, symbol)}</Text>
                                </View>
                                <View style={styles.row}>
                                    <Text style={styles.label}>Reportado (Físico):</Text>
                                    <Text style={styles.value}>{formatCurrency(curr.final_reported, symbol)}</Text>
                                </View>
                                {Math.abs(diff) >= 0.01 && (
                                    <View style={styles.row}>
                                        <Text style={styles.label}>Diferencia:</Text>
                                        <Text style={[styles.value, diff > 0 ? styles.differencePositive : styles.differenceNegative]}>
                                            {diff > 0 ? '+' : ''}{formatCurrency(diff, symbol)}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>

                {/* Legacy USD/Bs Summary (if no currencies array) */}
                {(!session.currencies || session.currencies.length === 0) && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Resumen</Text>
                        <View style={styles.currencySection}>
                            <Text style={styles.currencyTitle}>USD ($)</Text>
                            <View style={styles.row}>
                                <Text style={styles.label}>Inicial:</Text>
                                <Text style={styles.value}>{formatCurrency(session.initial_cash)}</Text>
                            </View>
                            <View style={styles.row}>
                                <Text style={styles.label}>Esperado:</Text>
                                <Text style={styles.value}>{formatCurrency(session.final_cash_expected)}</Text>
                            </View>
                            <View style={styles.row}>
                                <Text style={styles.label}>Reportado:</Text>
                                <Text style={styles.value}>{formatCurrency(session.final_cash_reported)}</Text>
                            </View>
                            <View style={styles.row}>
                                <Text style={styles.label}>Diferencia:</Text>
                                <Text style={[styles.value, parseFloat(session.difference || 0) > 0 ? styles.differencePositive : styles.differenceNegative]}>
                                    {formatCurrency(session.difference)}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.currencySection}>
                            <Text style={styles.currencyTitle}>Bolívares (Bs)</Text>
                            <View style={styles.row}>
                                <Text style={styles.label}>Inicial:</Text>
                                <Text style={styles.value}>{formatCurrency(session.initial_cash_bs, 'Bs')}</Text>
                            </View>
                            <View style={styles.row}>
                                <Text style={styles.label}>Esperado:</Text>
                                <Text style={styles.value}>{formatCurrency(session.final_cash_expected_bs, 'Bs')}</Text>
                            </View>
                            <View style={styles.row}>
                                <Text style={styles.label}>Reportado:</Text>
                                <Text style={styles.value}>{formatCurrency(session.final_cash_reported_bs, 'Bs')}</Text>
                            </View>
                            <View style={styles.row}>
                                <Text style={styles.label}>Diferencia:</Text>
                                <Text style={[styles.value, parseFloat(session.difference_bs || 0) > 0 ? styles.differencePositive : styles.differenceNegative]}>
                                    {formatCurrency(session.difference_bs, 'Bs')}
                                </Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Footer */}
                <Text style={styles.footer}>
                    Documento generado por InvenSoft - {new Date().toLocaleString('es-VE')}
                </Text>
            </Page>
        </Document>
    );
};

export default ZReportPDF;
