import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';

const fmt   = (n) => `$${Number(n || 0).toFixed(2)}`;
const fmtBs = (n, rate) => rate ? `Bs ${(Number(n || 0) * rate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}` : '';

const generateAndPrint = (products, exchangeRate, tenantName) => {
    const date = new Date().toLocaleDateString('es-VE', {
        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const totalProductos = products.length;
    const conLista = products.filter(p => p.prices && p.prices.length > 0).length;

    let rows = '';
    products.forEach((p, idx) => {
        const even = idx % 2 === 0;
        const bg = even ? '#ffffff' : '#f8fafc';

        // Listas de precios
        const listas = (p.prices || []).map(pp =>
            `<div style="display:inline-flex;flex-direction:column;align-items:center;
                background:#eef2ff;border:1px solid #c7d2fe;border-radius:6px;
                padding:3px 8px;margin:2px;min-width:70px;">
                <span style="font-size:11px;font-weight:900;color:#4338ca;">${fmt(pp.price)}</span>
                <span style="font-size:8px;font-weight:700;color:#6366f1;text-transform:uppercase;
                    letter-spacing:0.5px;margin-top:1px;">${pp.price_list?.name || 'Lista'}</span>
             </div>`
        ).join('');

        rows += `
        <tr style="background:${bg};">
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0;
                font-size:11px;font-weight:700;color:#1e293b;width:5%;text-align:center;">${idx + 1}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0;width:30%;">
                <div style="font-weight:800;font-size:12px;color:#1e293b;line-height:1.3;">${p.name}</div>
                ${p.sku ? `<div style="font-size:9px;color:#94a3b8;font-family:monospace;margin-top:1px;">SKU: ${p.sku}</div>` : ''}
            </td>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0;
                text-align:right;width:13%;">
                <div style="font-size:13px;font-weight:900;color:#0f172a;">${fmt(p.price)}</div>
                ${exchangeRate ? `<div style="font-size:9px;color:#94a3b8;margin-top:1px;">${fmtBs(p.price, exchangeRate)}</div>` : ''}
            </td>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0;
                text-align:right;width:13%;">
                <div style="font-size:13px;font-weight:900;color:#7c3aed;">${fmt(p.cost_price)}</div>
                ${exchangeRate ? `<div style="font-size:9px;color:#94a3b8;margin-top:1px;">${fmtBs(p.cost_price, exchangeRate)}</div>` : ''}
            </td>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;width:39%;">
                <div style="display:flex;flex-wrap:wrap;gap:2px;">
                    ${listas || '<span style="font-size:10px;color:#cbd5e1;font-style:italic;">Sin listas</span>'}
                </div>
            </td>
        </tr>`;
    });

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Catálogo de Equipos - ${tenantName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#1e293b; background:#fff; }
  @media print {
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .no-print { display:none !important; }
    tr { page-break-inside:avoid; }
  }
  @page { margin:12mm 10mm; size:A4 landscape; }
</style>
</head>
<body>
<div style="padding:20px;">

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;
       margin-bottom:18px;padding-bottom:14px;border-bottom:3px solid #4f46e5;">
    <div>
      <div style="font-size:20px;font-weight:900;color:#4f46e5;">📱 Catálogo de Equipos y Precios</div>
      <div style="font-size:11px;color:#64748b;margin-top:3px;">Generado: ${date}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;">Empresa</div>
      <div style="font-size:14px;font-weight:800;color:#1e293b;">${tenantName || ''}</div>
      ${exchangeRate ? `<div style="font-size:10px;color:#64748b;margin-top:2px;">Tasa: Bs ${exchangeRate}/USD</div>` : ''}
    </div>
  </div>

  <!-- Stats -->
  <div style="display:flex;gap:10px;margin-bottom:16px;">
    <div style="flex:1;background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;padding:10px;text-align:center;">
      <div style="font-size:24px;font-weight:900;color:#4338ca;">${totalProductos}</div>
      <div style="font-size:9px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:1px;">Productos</div>
    </div>
    <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;text-align:center;">
      <div style="font-size:24px;font-weight:900;color:#16a34a;">${conLista}</div>
      <div style="font-size:9px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:1px;">Con lista de precios</div>
    </div>
    <div style="flex:1;background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:10px;text-align:center;">
      <div style="font-size:24px;font-weight:900;color:#7c3aed;">${totalProductos - conLista}</div>
      <div style="font-size:9px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:1px;">Sin lista asignada</div>
    </div>
  </div>

  <!-- Tabla -->
  <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:11px;">
    <thead>
      <tr style="background:linear-gradient(135deg,#4f46e5,#6366f1);">
        <th style="padding:9px 10px;color:#fff;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.7px;text-align:center;width:5%;">#</th>
        <th style="padding:9px 10px;color:#fff;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.7px;text-align:left;width:30%;">Producto</th>
        <th style="padding:9px 10px;color:#fff;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.7px;text-align:right;width:13%;">Precio Base</th>
        <th style="padding:9px 10px;color:#fff;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.7px;text-align:right;width:13%;">Costo</th>
        <th style="padding:9px 10px;color:#fff;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.7px;text-align:left;width:39%;">Listas de Precios</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="5" style="padding:20px;text-align:center;color:#94a3b8;">Sin productos</td></tr>'}
    </tbody>
  </table>

  <!-- Footer -->
  <div style="margin-top:16px;padding-top:10px;border-top:1px solid #e2e8f0;
       display:flex;justify-content:space-between;">
    <div style="font-size:9px;color:#94a3b8;">Mi Inventario Fácil — Documento interno</div>
    <div style="font-size:9px;color:#94a3b8;">${totalProductos} productos registrados</div>
  </div>

</div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=1100,height=750');
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
};

// ─── Componente botón ─────────────────────────────────────────────────────────
const SerializedReportPDF = ({ tenantName }) => {
    const [loading, setLoading] = useState(false);

    const handleGenerate = async () => {
        setLoading(true);
        const toastId = toast.loading('Generando catálogo PDF...');
        try {
            const [prodRes, rateRes] = await Promise.all([
                apiClient.get('/products/', { params: { limit: 2000, has_imei: true } }),
                apiClient.get('/config/exchange-rates', { params: { is_active: true } }).catch(() => ({ data: [] })),
            ]);

            const products = (Array.isArray(prodRes.data) ? prodRes.data : []).filter(p => p.has_imei);
            const rates    = Array.isArray(rateRes.data) ? rateRes.data : [];
            const rate     = rates.length > 0 ? Number(rates[0].rate) : null;

            if (products.length === 0) {
                toast.error('No hay equipos serializados registrados', { id: toastId });
                return;
            }

            toast.success(`PDF listo — ${products.length} productos`, { id: toastId });
            generateAndPrint(products, rate, tenantName);
        } catch (err) {
            console.error(err);
            toast.error('Error generando PDF', { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50
                       text-white font-bold rounded-xl text-sm shadow-md shadow-rose-200
                       hover:-translate-y-0.5 transition-all"
        >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
            {loading ? 'Generando...' : 'PDF Catálogo'}
        </button>
    );
};

export default SerializedReportPDF;
