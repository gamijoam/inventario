import React from "react";

function formatDate(dateStr) {
    if (!dateStr) return new Date().toLocaleDateString("es-VE");
    return new Date(dateStr).toLocaleDateString("es-VE");
}

function formatNum(val, decimals = 2) {
    const n = parseFloat(val);
    return isNaN(n) ? "0.00" : n.toFixed(decimals);
}

function padId(id) {
    return String(id || 0).padStart(6, "0");
}

function buildHTML(saleData, business) {
    const items = saleData.cart || [];
    const customer = saleData.paymentData?.customer || null;
    const saleId = saleData.saleId || saleData.paymentData?.saleId || "";
    const totalUSD = saleData.totalUSD || 0;
    const notes = saleData.notes || "";

    const biz = business || {};
    const bizName = biz.name || "MI NEGOCIO";
    const bizRif = biz.document_id || "";
    const bizAddress = biz.address || "";
    const bizPhone = biz.phone || "";
    const bizLogo = biz.logo_url || "";

    const today = formatDate(null);

    // Identificar items con garantía
    const warrantyItems = items.filter(i => i.warranty_policy || i.product?.warranty_policy);

    const itemRows = items.map(item => {
        const qty = item.qty || item.quantity || 1;
        const unitPrice = parseFloat(item.unit_price_usd || item.price || 0);
        const subtotal = qty * unitPrice;
        const code = item.sku || item.code || item.product_id || "";
        return `
        <tr>
            <td class="code">${code}</td>
            <td class="desc">${item.name || ""}</td>
            <td class="center">${qty}</td>
            <td class="right">$${formatNum(unitPrice, 4)}</td>
            <td class="right">$${formatNum(subtotal)}</td>
        </tr>`;
    }).join("");

    const emptyRows = Math.max(0, 8 - items.length);
    const blankRows = Array.from({ length: emptyRows }, () => `
        <tr class="empty-row"><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>
    `).join("");

    const customerBlock = customer ? `
        <div><strong>Cliente:</strong> ${customer.name || ""}</div>
        ${customer.document_id || customer.rif ? `<div><strong>R.I.F:</strong> ${customer.document_id || customer.rif}</div>` : ""}
        ${customer.phone ? `<div><strong>Teléfono:</strong> ${customer.phone}</div>` : ""}
        ${customer.address ? `<div><strong>Dirección:</strong> ${customer.address}</div>` : ""}
    ` : `<div>Consumidor Final</div>`;

    const logoHTML = bizLogo
        ? `<img src="${bizLogo}" alt="Logo" style="max-height:60px;max-width:150px;object-fit:contain;">`
        : `<div style="width:80px;height:60px;background:#f3f4f6;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#9ca3af;font-weight:bold;">LOGO</div>`;

    // Generar certificados de garantía si existen
    const warrantyHTML = warrantyItems.length > 0 ? `
        <div style="page-break-before: always; padding-top: 30px;">
            <div style="border: 4px double #111; padding: 30px; border-radius: 10px;">
                <center>
                    <h1 style="font-size: 24px; text-transform: uppercase; margin-bottom: 5px;">Certificado de Garantía</h1>
                    <p style="font-size: 10px; color: #666;">Factura Asociada: #${padId(saleId)} | Fecha: ${today}</p>
                </center>
                
                <div style="margin-top: 30px;">
                    <p style="font-size: 12px; line-height: 1.6; text-align: justify;">
                        Por medio del presente documento, <strong>${bizName}</strong> certifica que los productos listados a continuación cuentan con cobertura de garantía bajo los términos y condiciones estipulados.
                    </p>
                </div>

                <table style="margin-top: 20px; border: 1px solid #111;">
                    <thead>
                        <tr style="background: #f3f4f6; color: #111;">
                            <th style="padding: 10px; border: 1px solid #111;">Producto</th>
                            <th style="padding: 10px; border: 1px solid #111;">Serial / IMEI</th>
                            <th style="padding: 10px; border: 1px solid #111;">Vigencia</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${warrantyItems.map(wi => `
                            <tr>
                                <td style="padding: 10px; border: 1px solid #111; font-weight: bold;">${wi.name}</td>
                                <td style="padding: 10px; border: 1px solid #111; font-family: monospace;">${wi.serial_numbers?.join(", ") || "---"}</td>
                                <td style="padding: 10px; border: 1px solid #111;">${wi.warranty_policy?.name || "Garantía Estándar"}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>

                <div style="margin-top: 30px;">
                    <h3 style="font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #111; padding-bottom: 5px;">Términos y Condiciones</h3>
                    <div style="font-size: 10px; line-height: 1.5; margin-top: 10px; color: #333; text-align: justify;">
                        ${warrantyItems[0].warranty_policy?.description || "Consulte los términos de garantía con su vendedor."}
                    </div>
                </div>

                <div style="margin-top: 50px; display: flex; justify-content: space-between;">
                    <div style="width: 200px; text-align: center; border-top: 1px solid #111; padding-top: 10px; font-size: 10px;">Firma del Cliente</div>
                    <div style="width: 200px; text-align: center; border-top: 1px solid #111; padding-top: 10px; font-size: 10px;">Sello y Firma Autorizada</div>
                </div>
            </div>
        </div>
    ` : "";

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: sans-serif; font-size: 11px; color: #111; background: #fff; }
  @page { size: A4; margin: 12mm 15mm; }
  .header { display: flex; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 10px; }
  .biz-name { font-size: 16px; font-weight: bold; }
  .invoice-id { text-align: right; }
  .invoice-id .number { font-size: 22px; font-weight: bold; font-family: monospace; }
  .meta { display: flex; border: 1px solid #ccc; margin-bottom: 10px; }
  .meta-left { flex: 1; padding: 10px; border-right: 1px solid #ccc; }
  .meta-right { width: 200px; padding: 10px; }
  table { width: 100%; border-collapse: collapse; }
  thead th { background: #111; color: #fff; padding: 6px; text-align: left; }
  tbody td { padding: 6px; border-bottom: 1px solid #eee; }
  .totals { display: flex; border: 1px solid #ccc; border-top: none; }
  .totals-left { flex: 1; padding: 10px; }
  .totals-right { width: 200px; padding: 10px; font-weight: bold; font-size: 14px; text-align: right; border-left: 1px solid #ccc; }
  .no-fiscal { font-size: 8px; color: #888; border: 1px solid #eee; padding: 2px 4px; border-radius: 4px; }
</style>
</head>
<body>
<div class="header">
    <div style="display: flex; gap: 15px;">
        ${logoHTML}
        <div>
            <div class="biz-name">${bizName}</div>
            <div style="font-size: 10px; color: #444;">R.I.F: ${bizRif}</div>
            <div style="font-size: 10px; color: #444;">${bizAddress}</div>
            <div style="font-size: 10px; color: #444;">Tel: ${bizPhone}</div>
        </div>
    </div>
    <div class="invoice-id">
        <div style="font-size: 10px; color: #666; font-weight: bold;">FACTURA N°</div>
        <div class="number">${padId(saleId)}</div>
        <div class="no-fiscal">DOCUMENTO NO FISCAL</div>
    </div>
</div>

<div class="meta">
    <div class="meta-left">
        <div style="font-size: 9px; font-weight: bold; color: #666; margin-bottom: 5px; text-transform: uppercase;">Cliente:</div>
        ${customerBlock}
    </div>
    <div class="meta-right">
        <div><strong>Emisión:</strong> ${today}</div>
        <div><strong>Vence:</strong> ${today}</div>
    </div>
</div>

<table>
    <thead>
        <tr>
            <th>Código</th>
            <th>Descripción</th>
            <th style="text-align: center;">Cant</th>
            <th style="text-align: right;">Precio USD</th>
            <th style="text-align: right;">Total USD</th>
        </tr>
    </thead>
    <tbody>
        ${itemRows}
        ${blankRows}
    </tbody>
</table>

<div class="totals">
    <div class="totals-left">
        <div style="font-size: 9px; font-weight: bold; color: #666; margin-bottom: 5px; text-transform: uppercase;">Notas:</div>
        <div style="font-size: 10px;">${notes || "Gracias por su compra."}</div>
    </div>
    <div class="totals-right">
        TOTAL: $${formatNum(totalUSD)}
    </div>
</div>

${warrantyHTML}

</body>
</html>`;
}

export function printFacturaA4(saleData, business) {
    const html = buildHTML(saleData, business);
    const win = window.open("", "_blank", "width=800,height=1000");
    if (!win) {
        alert("Pop-ups bloqueados");
        return;
    }
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.print(); }, 500);
}

export function printCotizacionA4(quote, business) {
    // Implementación similar para cotizaciones si se requiere
}
