/**
 * FacturaA4 — Genera e imprime una factura en formato A4/Carta.
 *
 * Uso:
 *   import { printFacturaA4 } from './FacturaA4';
 *   printFacturaA4(saleData, business);
 *
 * saleData: objeto lastSaleData del POS (cart, totalUSD, paymentData, saleId)
 * business: objeto del ConfigContext (name, document_id, address, phone, logo_url)
 */

function formatDate(dateStr) {
    if (!dateStr) return new Date().toLocaleDateString('es-VE');
    return new Date(dateStr).toLocaleDateString('es-VE');
}

function formatNum(val, decimals = 2) {
    const n = parseFloat(val);
    return isNaN(n) ? '0.00' : n.toFixed(decimals);
}

function padId(id) {
    return String(id || 0).padStart(6, '0');
}

function buildHTML(saleData, business) {
    const items = saleData.cart || [];
    const customer = saleData.paymentData?.customer || null;
    const saleId = saleData.saleId || saleData.paymentData?.saleId || '';
    const totalUSD = saleData.totalUSD || 0;
    const discountUSD = saleData.paymentData?.discountUSD || 0;
    const notes = saleData.notes || '';

    const biz = business || {};
    const bizName = biz.name || 'MI NEGOCIO';
    const bizRif = biz.document_id || '';
    const bizAddress = biz.address || '';
    const bizPhone = biz.phone || '';
    const bizLogo = biz.logo_url || '';

    const today = formatDate(null);

    const itemRows = items.map(item => {
        const qty = item.qty || item.quantity || 1;
        const unitPrice = parseFloat(item.unit_price_usd || item.price || 0);
        const subtotal = qty * unitPrice;
        const code = item.sku || item.code || item.product_id || '';
        return `
        <tr>
            <td class="code">${code}</td>
            <td class="desc">${item.name || ''}</td>
            <td class="center">${qty}</td>
            <td class="right">$${formatNum(unitPrice, 4)}</td>
            <td class="right">$${formatNum(subtotal)}</td>
        </tr>`;
    }).join('');

    // Fill empty rows up to at least 10 for cleaner look
    const emptyRows = Math.max(0, 10 - items.length);
    const blankRows = Array.from({ length: emptyRows }, () => `
        <tr class="empty-row">
            <td>&nbsp;</td><td></td><td></td><td></td><td></td>
        </tr>`).join('');

    const customerBlock = customer ? `
        <div><strong>Cliente:</strong> ${customer.name || ''}</div>
        ${customer.document_id || customer.rif ? `<div><strong>R.I.F:</strong> ${customer.document_id || customer.rif}</div>` : ''}
        ${customer.phone ? `<div><strong>Teléfono:</strong> ${customer.phone}</div>` : ''}
        ${customer.address ? `<div><strong>Dirección:</strong> ${customer.address}</div>` : ''}
    ` : `<div>Consumidor Final</div>`;

    const logoHTML = bizLogo
        ? `<img src="${bizLogo}" alt="Logo" style="max-height:60px;max-width:120px;object-fit:contain;">`
        : `<div style="width:80px;height:60px;background:#e5e7eb;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#9ca3af;">LOGO</div>`;

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Factura N° ${padId(saleId)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: #fff; }

  @page { size: A4; margin: 12mm 15mm; }

  .page { width: 100%; }

  /* HEADER */
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 8px; }
  .header-left { display: flex; align-items: flex-start; gap: 12px; }
  .biz-info { line-height: 1.5; }
  .biz-name { font-size: 15px; font-weight: bold; }
  .biz-sub { font-size: 10px; color: #444; }
  .invoice-id { text-align: right; }
  .invoice-id .label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
  .invoice-id .number { font-size: 20px; font-weight: bold; font-family: monospace; }

  /* DATOS CLIENTE / FECHAS */
  .meta { display: flex; gap: 0; margin-bottom: 8px; border: 1px solid #ccc; }
  .meta-left { flex: 1; padding: 8px 10px; border-right: 1px solid #ccc; line-height: 1.7; }
  .meta-right { width: 220px; padding: 8px 10px; line-height: 1.7; }
  .meta-left .section-title,
  .meta-right .section-title { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #666; margin-bottom: 4px; }

  /* TABLA ITEMS */
  table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
  thead th { background: #111; color: #fff; padding: 5px 6px; font-size: 10px; text-align: left; }
  thead th.center { text-align: center; }
  thead th.right { text-align: right; }
  tbody td { padding: 4px 6px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tbody tr:nth-child(even) { background: #f9fafb; }
  tbody tr.empty-row td { border-bottom: 1px solid #f3f4f6; color: transparent; }
  td.code { font-family: monospace; font-size: 10px; color: #555; white-space: nowrap; }
  td.desc { }
  td.center { text-align: center; }
  td.right { text-align: right; font-family: monospace; }

  /* TOTALES */
  .footer-area { display: flex; margin-top: 0; border: 1px solid #ccc; border-top: none; }
  .notes-area { flex: 1; padding: 8px 10px; border-right: 1px solid #ccc; }
  .notes-area .label { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #666; margin-bottom: 4px; }
  .notes-area .note-text { font-size: 10px; color: #333; min-height: 40px; }
  .totals-area { width: 220px; padding: 6px 10px; }
  .total-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 11px; }
  .total-row.grand { border-top: 1px solid #111; margin-top: 4px; font-weight: bold; font-size: 13px; padding-top: 4px; }
  .total-row .t-label { color: #444; }
  .total-row .t-val { font-family: monospace; }

  /* FIRMA */
  .signature { display: flex; gap: 20px; margin-top: 20px; padding-top: 10px; }
  .sig-field { flex: 1; text-align: center; }
  .sig-line { border-top: 1px solid #111; margin-bottom: 4px; padding-top: 4px; font-size: 10px; color: #555; }

  /* WATERMARK para facturas de prueba */
  .draft-mark { display: none; }
</style>
</head>
<body>
<div class="page">

  <!-- CABECERA -->
  <div class="header">
    <div class="header-left">
      ${logoHTML}
      <div class="biz-info">
        <div class="biz-name">${bizName}</div>
        ${bizRif ? `<div class="biz-sub">R.I.F: ${bizRif}</div>` : ''}
        ${bizAddress ? `<div class="biz-sub">${bizAddress}</div>` : ''}
        ${bizPhone ? `<div class="biz-sub">Tel: ${bizPhone}</div>` : ''}
      </div>
    </div>
    <div class="invoice-id">
      <div class="label">Factura N°</div>
      <div class="number">${padId(saleId)}</div>
    </div>
  </div>

  <!-- META: CLIENTE / FECHAS -->
  <div class="meta">
    <div class="meta-left">
      <div class="section-title">Factura a nombre de:</div>
      ${customerBlock}
    </div>
    <div class="meta-right">
      <div class="section-title">Detalles</div>
      <div><strong>Emisión:</strong> ${today}</div>
      <div><strong>Vencimiento:</strong> ${today}</div>
      <div><strong>Orden de Compra:</strong></div>
      <div>&nbsp;</div>
    </div>
  </div>

  <!-- TABLA DE ÍTEMS -->
  <table>
    <thead>
      <tr>
        <th style="width:80px;">Código</th>
        <th>Descripción</th>
        <th class="center" style="width:55px;">Cant.</th>
        <th class="right" style="width:85px;">Precio USD</th>
        <th class="right" style="width:85px;">Total USD</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      ${blankRows}
    </tbody>
  </table>

  <!-- PIE: NOTAS + TOTALES -->
  <div class="footer-area">
    <div class="notes-area">
      <div class="label">Notas / Observaciones:</div>
      <div class="note-text">${notes}</div>
    </div>
    <div class="totals-area">
      <div class="total-row">
        <span class="t-label">Subtotal:</span>
        <span class="t-val">$${formatNum(totalUSD + discountUSD)}</span>
      </div>
      ${discountUSD > 0 ? `
      <div class="total-row">
        <span class="t-label">Descuento:</span>
        <span class="t-val">-$${formatNum(discountUSD)}</span>
      </div>` : ''}
      <div class="total-row">
        <span class="t-label">Fletes:</span>
        <span class="t-val">$0.00</span>
      </div>
      <div class="total-row">
        <span class="t-label">Impuestos:</span>
        <span class="t-val">$0.00</span>
      </div>
      <div class="total-row grand">
        <span class="t-label">TOTAL:</span>
        <span class="t-val">$${formatNum(totalUSD)}</span>
      </div>
    </div>
  </div>

  <!-- FIRMA -->
  <div class="signature">
    <div class="sig-field">
      <div class="sig-line">Nombre y Apellido</div>
    </div>
    <div class="sig-field">
      <div class="sig-line">C.I. / R.I.F</div>
    </div>
    <div class="sig-field">
      <div class="sig-line">Firma</div>
    </div>
    <div class="sig-field">
      <div class="sig-line">Fecha</div>
    </div>
  </div>

</div>
</body>
</html>`;
}

function buildQuoteHTML(quote, business) {
    const items = quote.details || quote.items || [];
    const customer = quote.customer || null;
    const quoteId = quote.id || '';
    const totalUSD = parseFloat(quote.total_amount || 0);
    const notes = quote.notes || '';

    const biz = business || {};
    const bizName = biz.name || 'MI NEGOCIO';
    const bizRif = biz.document_id || '';
    const bizAddress = biz.address || '';
    const bizPhone = biz.phone || '';
    const bizLogo = biz.logo_url || '';

    const dateStr = quote.date ? new Date(quote.date).toLocaleDateString('es-VE') : new Date().toLocaleDateString('es-VE');

    const itemRows = items.map(item => {
        const qty = parseFloat(item.quantity || 1);
        const unitPrice = parseFloat(item.unit_price || 0);
        const subtotal = parseFloat(item.subtotal || qty * unitPrice);
        const code = item.product?.sku || item.product?.code || '';
        return `
        <tr>
            <td class="code">${code}</td>
            <td class="desc">${item.product?.name || item.description || ''}</td>
            <td class="center">${qty}</td>
            <td class="right">$${formatNum(unitPrice, 4)}</td>
            <td class="right">$${formatNum(subtotal)}</td>
        </tr>`;
    }).join('');

    const emptyRows = Math.max(0, 10 - items.length);
    const blankRows = Array.from({ length: emptyRows }, () => `
        <tr class="empty-row">
            <td>&nbsp;</td><td></td><td></td><td></td><td></td>
        </tr>`).join('');

    const customerBlock = customer ? `
        <div><strong>Cliente:</strong> ${customer.name || ''}</div>
        ${customer.id_number || customer.document_id ? `<div><strong>R.I.F/C.I.:</strong> ${customer.id_number || customer.document_id}</div>` : ''}
        ${customer.phone ? `<div><strong>Teléfono:</strong> ${customer.phone}</div>` : ''}
        ${customer.address ? `<div><strong>Dirección:</strong> ${customer.address}</div>` : ''}
    ` : `<div>Consumidor Final</div>`;

    const logoHTML = bizLogo
        ? `<img src="${bizLogo}" alt="Logo" style="max-height:60px;max-width:120px;object-fit:contain;">`
        : `<div style="width:80px;height:60px;background:#e5e7eb;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#9ca3af;">LOGO</div>`;

    // Reuse the same CSS as buildHTML
    const css = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: #fff; }
  @page { size: A4; margin: 12mm 15mm; }
  .page { width: 100%; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 8px; }
  .header-left { display: flex; align-items: flex-start; gap: 12px; }
  .biz-info { line-height: 1.5; }
  .biz-name { font-size: 15px; font-weight: bold; }
  .biz-sub { font-size: 10px; color: #444; }
  .invoice-id { text-align: right; }
  .invoice-id .label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
  .invoice-id .number { font-size: 20px; font-weight: bold; font-family: monospace; }
  .meta { display: flex; gap: 0; margin-bottom: 8px; border: 1px solid #ccc; }
  .meta-left { flex: 1; padding: 8px 10px; border-right: 1px solid #ccc; line-height: 1.7; }
  .meta-right { width: 220px; padding: 8px 10px; line-height: 1.7; }
  .meta-left .section-title, .meta-right .section-title { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #666; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
  thead th { background: #111; color: #fff; padding: 5px 6px; font-size: 10px; text-align: left; }
  thead th.center { text-align: center; }
  thead th.right { text-align: right; }
  tbody td { padding: 4px 6px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tbody tr:nth-child(even) { background: #f9fafb; }
  tbody tr.empty-row td { border-bottom: 1px solid #f3f4f6; color: transparent; }
  td.code { font-family: monospace; font-size: 10px; color: #555; white-space: nowrap; }
  td.center { text-align: center; }
  td.right { text-align: right; font-family: monospace; }
  .footer-area { display: flex; margin-top: 0; border: 1px solid #ccc; border-top: none; }
  .notes-area { flex: 1; padding: 8px 10px; border-right: 1px solid #ccc; }
  .notes-area .label { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #666; margin-bottom: 4px; }
  .notes-area .note-text { font-size: 10px; color: #333; min-height: 40px; }
  .totals-area { width: 220px; padding: 6px 10px; }
  .total-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 11px; }
  .total-row.grand { border-top: 1px solid #111; margin-top: 4px; font-weight: bold; font-size: 13px; padding-top: 4px; }
  .total-row .t-label { color: #444; }
  .total-row .t-val { font-family: monospace; }
  .signature { display: flex; gap: 20px; margin-top: 20px; padding-top: 10px; }
  .sig-field { flex: 1; text-align: center; }
  .sig-line { border-top: 1px solid #111; margin-bottom: 4px; padding-top: 4px; font-size: 10px; color: #555; }
  .no-fiscal { display:inline-block; font-size:9px; color:#666; border:1px solid #ccc; padding:1px 6px; border-radius:3px; margin-top:2px; }`;

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Cotización N° ${padId(quoteId)}</title>
<style>${css}</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="header-left">
      ${logoHTML}
      <div class="biz-info">
        <div class="biz-name">${bizName}</div>
        ${bizRif ? `<div class="biz-sub">R.I.F: ${bizRif}</div>` : ''}
        ${bizAddress ? `<div class="biz-sub">${bizAddress}</div>` : ''}
        ${bizPhone ? `<div class="biz-sub">Tel: ${bizPhone}</div>` : ''}
      </div>
    </div>
    <div class="invoice-id">
      <div class="label">Cotización N°</div>
      <div class="number">${padId(quoteId)}</div>
      <div class="no-fiscal">Documento no fiscal</div>
    </div>
  </div>
  <div class="meta">
    <div class="meta-left">
      <div class="section-title">Cotización a nombre de:</div>
      ${customerBlock}
    </div>
    <div class="meta-right">
      <div class="section-title">Detalles</div>
      <div><strong>Emisión:</strong> ${dateStr}</div>
      <div><strong>Válida hasta:</strong> ${dateStr}</div>
      <div><strong>Referencia:</strong></div>
      <div>&nbsp;</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:80px;">Código</th>
        <th>Descripción</th>
        <th class="center" style="width:55px;">Cant.</th>
        <th class="right" style="width:85px;">Precio USD</th>
        <th class="right" style="width:85px;">Total USD</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      ${blankRows}
    </tbody>
  </table>
  <div class="footer-area">
    <div class="notes-area">
      <div class="label">Notas / Observaciones:</div>
      <div class="note-text">${notes}</div>
    </div>
    <div class="totals-area">
      <div class="total-row grand">
        <span class="t-label">TOTAL:</span>
        <span class="t-val">$${formatNum(totalUSD)}</span>
      </div>
    </div>
  </div>
  <div class="signature">
    <div class="sig-field"><div class="sig-line">Nombre y Apellido</div></div>
    <div class="sig-field"><div class="sig-line">C.I. / R.I.F</div></div>
    <div class="sig-field"><div class="sig-line">Firma</div></div>
    <div class="sig-field"><div class="sig-line">Fecha</div></div>
  </div>
</div>
</body>
</html>`;
}

/**
 * Abre una ventana nueva con la cotización en A4 y lanza el diálogo de impresión.
 *
 * @param {object} quote - objeto completo de la cotización (desde GET /quotes/{id})
 * @param {object} business - objeto business del ConfigContext
 */
export function printCotizacionA4(quote, business) {
    const html = buildQuoteHTML(quote, business);
    const win = window.open('', '_blank', 'width=794,height=1123');
    if (!win) {
        alert('El navegador bloqueó la ventana emergente. Permita pop-ups para este sitio.');
        return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 300);
}

/**
 * Abre una ventana nueva con la factura A4 y lanza el diálogo de impresión.
 *
 * @param {object} saleData - lastSaleData del POS (cart, totalUSD, paymentData, saleId)
 * @param {object} business - objeto business del ConfigContext
 */
export function printFacturaA4(saleData, business) {
    const html = buildHTML(saleData, business);
    const win = window.open('', '_blank', 'width=794,height=1123');
    if (!win) {
        alert('El navegador bloqueó la ventana emergente. Permita pop-ups para este sitio.');
        return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    // Pequeño delay para que el browser termine de cargar el DOM antes de imprimir
    setTimeout(() => {
        win.print();
    }, 300);
}
