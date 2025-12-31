import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';

// Register fonts if needed (using default Helvetica for now to ensure compatibility)
// Font.register({ family: 'Roboto', src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/Roboto-Regular.ttf' });

const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontSize: 10,
        fontFamily: 'Helvetica',
        color: '#333'
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 20
    },
    headerLeft: {
        flexDirection: 'column',
    },
    logo: {
        marginBottom: 10,
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2563EB' // Blue-600
    },
    businessInfo: {
        fontSize: 9,
        color: '#666',
        lineHeight: 1.5
    },
    invoiceTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        color: '#111',
        marginBottom: 5
    },
    invoiceMeta: {
        fontSize: 10,
        color: '#666',
        textAlign: 'right'
    },
    section: {
        marginBottom: 20
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#111',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 4
    },
    row: {
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderBottomColor: '#eee',
        paddingVertical: 6,
        alignItems: 'center'
    },
    headerRow: {
        backgroundColor: '#F9FAFB',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
        fontWeight: 'bold'
    },
    colDesc: { width: '45%' },
    colQty: { width: '15%', textAlign: 'center' },
    colPrice: { width: '20%', textAlign: 'right' },
    colTotal: { width: '20%', textAlign: 'right' },

    totalSection: {
        marginTop: 20,
        alignItems: 'flex-end'
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingVertical: 4,
        width: '50%'
    },
    totalLabel: {
        width: '40%',
        textAlign: 'right',
        paddingRight: 10,
        fontWeight: 'bold',
        color: '#666'
    },
    totalValue: {
        width: '60%',
        textAlign: 'right',
        fontWeight: 'bold',
        color: '#111'
    },
    largeTotal: {
        fontSize: 14,
        color: '#2563EB',
        borderTopWidth: 1,
        borderTopColor: '#ddd',
        marginTop: 4,
        paddingTop: 4
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
    },
    statusBadge: {
        padding: '4 8',
        backgroundColor: '#DEF7EC',
        color: '#03543F',
        borderRadius: 4,
        fontSize: 9,
        position: 'absolute',
        top: 0,
        right: 0
    }
});

const InvoicePDF = ({ sale, business, currencyCode = "USD" }) => {
    // Safety check
    if (!sale) return <Document><Page><Text>No data</Text></Page></Document>;

    const formatDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('es-VE', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount || 0);
    };

    // Calculate conversion if needed
    // sale.exchange_rate_used is stored in sale.
    const rate = sale.exchange_rate_used || 1;
    const currency = sale.currency || "USD";

    // Calculate total in Local Currency (if sale was in USD but we want to show BS, or vice versa)
    // Actually the sale object has total_amount_bs usually.
    const totalBs = sale.total_amount * rate;

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.logo}>{business?.name || "FERRETERÍA"}</Text>
                        <Text style={styles.businessInfo}>{business?.address || "Dirección del Negocio"}</Text>
                        <Text style={styles.businessInfo}>{business?.document_id || "RIF: J-00000000-0"}</Text>
                        <Text style={styles.businessInfo}>{business?.phone || "Tel: 0000-0000000"}</Text>
                    </View>
                    <View>
                        <Text style={styles.invoiceTitle}>NOTA DE ENTREGA</Text>
                        <Text style={styles.invoiceMeta}>#{String(sale.id).padStart(6, '0')}</Text>
                        <Text style={styles.invoiceMeta}>{formatDate(sale.date)}</Text>
                        <Text style={[styles.invoiceMeta, { marginTop: 5, color: sale.paid ? 'green' : 'orange' }]}>
                            {sale.paid ? "PAGADO" : "PENDIENTE"}
                        </Text>
                    </View>
                </View>

                {/* Customer Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>DATOS DEL CLIENTE</Text>
                    <Text style={styles.businessInfo}>Nombre: {sale.customer?.name || "Contado (Cliente General)"}</Text>
                    <Text style={styles.businessInfo}>Doc/RIF: {sale.customer?.id_number || "N/A"}</Text>
                    {sale.customer?.address && <Text style={styles.businessInfo}>Dirección: {sale.customer.address}</Text>}
                    {sale.customer?.phone && <Text style={styles.businessInfo}>Teléfono: {sale.customer.phone}</Text>}
                </View>

                {/* Items Table Header */}
                <View style={[styles.row, styles.headerRow]}>
                    <Text style={styles.colDesc}>Descripción</Text>
                    <Text style={styles.colQty}>Cant.</Text>
                    <Text style={styles.colPrice}>Precio Unit.</Text>
                    <Text style={styles.colTotal}>Total</Text>
                </View>

                {/* Items */}
                {sale.details?.map((item, index) => (
                    <View key={index} style={styles.row}>
                        <Text style={styles.colDesc}>{item.product?.name || "Producto"}</Text>
                        <Text style={styles.colQty}>{item.quantity}</Text>
                        <Text style={styles.colPrice}>{formatCurrency(item.unit_price)}</Text>
                        <Text style={styles.colTotal}>{formatCurrency(item.subtotal)}</Text>
                    </View>
                ))}

                {/* Totals */}
                <View style={styles.totalSection}>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Subtotal:</Text>
                        <Text style={styles.totalValue}>{formatCurrency(sale.total_amount)}</Text>
                    </View>
                    {/* Add discount row here if available */}

                    <View style={[styles.totalRow, { marginTop: 10 }]}>
                        <Text style={[styles.totalLabel, styles.largeTotal]}>TOTAL USD:</Text>
                        <Text style={[styles.totalValue, styles.largeTotal]}>{formatCurrency(sale.total_amount)}</Text>
                    </View>

                    {/* Currency Conversion Display */}
                    {sale.currency !== 'USD' || rate > 1 ? (
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Tasa de Cambio:</Text>
                            <Text style={styles.totalValue}>{rate} {currency === 'USD' ? 'Bs/USD' : ''}</Text>
                        </View>
                    ) : null}

                    {(rate > 1) && (
                        <View style={styles.totalRow}>
                            <Text style={[styles.totalLabel, { color: '#4B5563' }]}>Equivalente en Bs:</Text>
                            <Text style={[styles.totalValue, { color: '#4B5563' }]}>
                                {new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'VES' }).format(totalBs)}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Footer */}
                <Text style={styles.footer}>
                    Gracias por su compra. Documento no fiscal generado por el sistema interno.
                </Text>
            </Page>
        </Document>
    );
};

export default InvoicePDF;
