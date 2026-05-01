import { useState } from 'react';
import { TrendingUp, Loader2 } from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';

const fmt    = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtBs  = (n, rate) => rate ? `Bs ${(Number(n || 0) * rate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}` : '';
const pct    = (ganancia, inversion) => inversion > 0 ? ((ganancia / inversion) * 100).toFixed(1) + '%' : '—';

const generateAndPrint = (products, instances, exchangeRate, tenantName) => {
    const date = new Date().toLocaleDateString('es-VE', {
        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    // Agrupar instancias por producto
    const instMap = {};
    instances.forEach(inst => {
        if (!instMap[inst.product_id]) instMap[inst.product_id] = [];
        instMap[inst.product_id].push(inst);
    });

    // Calcular por producto
    const data = products
        .map(p => {
            const insts = instMap[p.id] || [];
            const disponibles = insts.filter(i => i.status === 'AVAILABLE').length;
            const vendidos    = insts.filter(i => i.status === 'SOLD').length;
            // Excluir si no hay instancias AVAILABLE O si el stock del producto es 0
            if (disponibles === 0 || Number(p.stock || 0) === 0) return null;

            const costo         = Number(p.cost_price || 0);
            const precio        = Number(p.price || 0);
            const inversion     = costo * disponibles;
            const ventaPotencial = precio * disponibles;
            const ganancia      = (precio - costo) * disponibles;

            return { ...p, disponibles, vendidos, costo, precio, inversion, ventaPotencial, ganancia };
        })
        .filter(Boolean)
        .sort((a, b) => b.inversion - a.inversion);

    // Totales
    const totalInversion      = data.reduce((s, r) => s + r.inversion, 0);
    const totalVentaPotencial = data.reduce((s, r) => s + r.ventaPotencial, 0);
    const totalGanancia       = data.reduce((s, r) => s + r.ganancia, 0);
    const totalDisponibles    = data.reduce((s, r) => s + r.disponibles, 0);

    // Filas
    let rows = '';
    data.forEach((r, idx) => {
        const even = idx % 2 === 0;
        const bg = even ? '#ffffff' : '#f8fafc';
        const gananciaColor = r.ganancia > 0 ? '#16a34a' : r.ganancia < 0 ? '#dc2626' : '#64748b';
        const margen = pct(r.ganancia, r.inversion);

        rows += `
        <tr style="background:${bg};">
            <td style="padding:7px 8px;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0;
                font-size:10px;font-weight:700;color:#64748b;text-align:center;">${idx + 1}</td>
            <td style="padding:7px 8px;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
                <div style="font-weight:800;font-size:11px;color:#1e293b;line-height:1.3;">${r.name}</div>
                ${r.sku ? `<div style="font-size:8px;color:#94a3b8;font-family:monospace;">SKU: ${r.sku}</div>` : ''}
            </td>
            <td style="padding:7px 8px;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0;text-align:center;">
                <span style="display:inline-block;background:#eef2ff;border:1px solid #c7d2fe;color:#4338ca;
                    border-radius:20px;padding:2px 10px;font-size:11px;font-weight:900;">${r.disponibles}</span>
            </td>
            <td style="padding:7px 8px;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0;text-align:right;">
                <div style="font-size:10px;font-weight:600;color:#64748b;">${fmt(r.costo)}</div>
            </td>
            <td style="padding:7px 8px;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0;text-align:right;">
                <div style="font-size:12px;font-weight:900;color:#dc2626;">${fmt(r.inversion)}</div>
                ${exchangeRate ? `<div style="font-size:8px;color:#94a3b8;">${fmtBs(r.inversion, exchangeRate)}</div>` : ''}
            </td>
            <td style="padding:7px 8px;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0;text-align:right;">
                <div style="font-size:12px;font-weight:900;color:#0f172a;">${fmt(r.ventaPotencial)}</div>
                ${exchangeRate ? `<div style="font-size:8px;color:#94a3b8;">${fmtBs(r.ventaPotencial, exchangeRate)}</div>` : ''}
            </td>
            <td style="padding:7px 8px;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0;text-align:right;">
                <div style="font-size:12px;font-weight:900;color:${gananciaColor};">${fmt(r.ganancia)}</div>
                ${exchangeRate ? `<div style="font-size:8px;color:#94a3b8;">${fmtBs(r.ganancia, exchangeRate)}</div>` : ''}
            </td>
            <td style="padding:7px 8px;border-bottom:1px solid #e2e8f0;text-align:center;">
                <span style="display:inline-block;background:${r.ganancia > 0 ? '#f0fdf4' : '#fff1f2'};
                    border:1px solid ${r.ganancia > 0 ? '#bbf7d0' : '#fecdd3'};
                    color:${gananciaColor};border-radius:6px;padding:2px 8px;
                    font-size:10px;font-weight:800;">${margen}</span>
            </td>
        </tr>`;
    });

    // Fila de totales
    const totalMargen = pct(totalGanancia, totalInversion);
    rows += `
    <tr style="background:linear-gradient(135deg,#1e293b,#334155);">
        <td colspan="2" style="padding:10px 12px;color:#fff;font-size:12px;font-weight:900;">
            TOTALES GENERALES
        </td>
        <td style="padding:10px 8px;text-align:center;color:#a5b4fc;font-size:13px;font-weight:900;">${totalDisponibles}</td>
        <td style="padding:10px 8px;text-align:right;color:#94a3b8;font-size:10px;">—</td>
        <td style="padding:10px 8px;text-align:right;">
            <div style="font-size:13px;font-weight:900;color:#fca5a5;">${fmt(totalInversion)}</div>
            ${exchangeRate ? `<div style="font-size:8px;color:#94a3b8;">${fmtBs(totalInversion, exchangeRate)}</div>` : ''}
        </td>
        <td style="padding:10px 8px;text-align:right;">
            <div style="font-size:13px;font-weight:900;color:#fff;">${fmt(totalVentaPotencial)}</div>
            ${exchangeRate ? `<div style="font-size:8px;color:#94a3b8;">${fmtBs(totalVentaPotencial, exchangeRate)}</div>` : ''}
        </td>
        <td style="padding:10px 8px;text-align:right;">
            <div style="font-size:13px;font-weight:900;color:#86efac;">${fmt(totalGanancia)}</div>
            ${exchangeRate ? `<div style="font-size:8px;color:#94a3b8;">${fmtBs(totalGanancia, exchangeRate)}</div>` : ''}
        </td>
        <td style="padding:10px 8px;text-align:center;">
            <span style="background:#16a34a;color:#fff;border-radius:6px;padding:3px 10px;
                font-size:11px;font-weight:900;">${totalMargen}</span>
        </td>
    </tr>`;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Análisis de Inversión - ${tenantName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#1e293b; background:#fff; }
  @media print {
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    tr { page-break-inside:avoid; }
  }
  @page { margin:12mm 10mm; size:A4 landscape; }
</style>
</head>
<body>
<div style="padding:20px;">

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;
       margin-bottom:18px;padding-bottom:14px;border-bottom:3px solid #16a34a;">
    <div>
      <div style="font-size:20px;font-weight:900;color:#15803d;">💰 Análisis de Inversión — Equipos en Stock</div>
      <div style="font-size:11px;color:#64748b;margin-top:3px;">Solo equipos disponibles (AVAILABLE) · Generado: ${date}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;">Empresa</div>
      <div style="font-size:14px;font-weight:800;color:#1e293b;">${tenantName || ''}</div>
      ${exchangeRate ? `<div style="font-size:10px;color:#64748b;margin-top:2px;">Tasa: Bs ${exchangeRate}/USD</div>` : ''}
    </div>
  </div>

  <!-- KPIs -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px;">
    <div style="background:#fff1f2;border:2px solid #fecdd3;border-radius:10px;padding:12px;text-align:center;">
      <div style="font-size:10px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">💸 Total Invertido</div>
      <div style="font-size:18px;font-weight:900;color:#dc2626;">${fmt(totalInversion)}</div>
      ${exchangeRate ? `<div style="font-size:9px;color:#f87171;margin-top:2px;">${fmtBs(totalInversion, exchangeRate)}</div>` : ''}
    </div>
    <div style="background:#f0f9ff;border:2px solid #bae6fd;border-radius:10px;padding:12px;text-align:center;">
      <div style="font-size:10px;font-weight:700;color:#0284c7;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">📦 Si Vende Todo</div>
      <div style="font-size:18px;font-weight:900;color:#0284c7;">${fmt(totalVentaPotencial)}</div>
      ${exchangeRate ? `<div style="font-size:9px;color:#7dd3fc;margin-top:2px;">${fmtBs(totalVentaPotencial, exchangeRate)}</div>` : ''}
    </div>
    <div style="background:#f0fdf4;border:2px solid #bbf7d0;border-radius:10px;padding:12px;text-align:center;">
      <div style="font-size:10px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">✅ Ganancia Potencial</div>
      <div style="font-size:18px;font-weight:900;color:#16a34a;">${fmt(totalGanancia)}</div>
      ${exchangeRate ? `<div style="font-size:9px;color:#86efac;margin-top:2px;">${fmtBs(totalGanancia, exchangeRate)}</div>` : ''}
    </div>
    <div style="background:#fefce8;border:2px solid #fde68a;border-radius:10px;padding:12px;text-align:center;">
      <div style="font-size:10px;font-weight:700;color:#ca8a04;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">📊 Margen Promedio</div>
      <div style="font-size:18px;font-weight:900;color:#ca8a04;">${totalMargen}</div>
      <div style="font-size:9px;color:#a16207;margin-top:2px;">${totalDisponibles} equipos en stock</div>
    </div>
  </div>

  <!-- Tabla -->
  <table style="width:100%;border-collapse:collapse;font-size:11px;">
    <thead>
      <tr style="background:linear-gradient(135deg,#1e293b,#334155);">
        <th style="padding:9px 8px;color:#94a3b8;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;text-align:center;width:4%;">#</th>
        <th style="padding:9px 8px;color:#fff;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;text-align:left;width:26%;">Equipo</th>
        <th style="padding:9px 8px;color:#a5b4fc;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;text-align:center;width:8%;">Uds.</th>
        <th style="padding:9px 8px;color:#94a3b8;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;text-align:right;width:10%;">Costo Unit.</th>
        <th style="padding:9px 8px;color:#fca5a5;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;text-align:right;width:14%;">Total Invertido</th>
        <th style="padding:9px 8px;color:#93c5fd;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;text-align:right;width:14%;">Venta Potencial</th>
        <th style="padding:9px 8px;color:#86efac;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;text-align:right;width:14%;">Ganancia Est.</th>
        <th style="padding:9px 8px;color:#fde68a;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;text-align:center;width:10%;">Margen</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <!-- Footer -->
  <div style="margin-top:14px;padding-top:10px;border-top:1px solid #e2e8f0;
       display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:9px;color:#94a3b8;">Mi Inventario Fácil · Documento confidencial interno</div>
    <div style="font-size:9px;color:#94a3b8;">* Ganancia estimada basada en precio de venta base × unidades disponibles</div>
  </div>

</div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=1200,height=800');
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
};

// ─── Componente botón ─────────────────────────────────────────────────────────
const InversionReportPDF = ({ tenantName }) => {
    const [loading, setLoading] = useState(false);

    const handleGenerate = async () => {
        setLoading(true);
        const toastId = toast.loading('Calculando inversión...');
        try {
            const [prodRes, instRes, rateRes] = await Promise.all([
                apiClient.get('/products/', { params: { limit: 2000, has_imei: true } }),
                apiClient.get('/inventory/serialized-instances'),
                apiClient.get('/config/exchange-rates', { params: { is_active: true } }).catch(() => ({ data: [] })),
            ]);

            const products  = (Array.isArray(prodRes.data) ? prodRes.data : []).filter(p => p.has_imei);
            const instances = Array.isArray(instRes.data) ? instRes.data : [];
            const rates     = Array.isArray(rateRes.data) ? rateRes.data : [];
            const rate      = rates.length > 0 ? Number(rates[0].rate) : null;

            if (products.length === 0) {
                toast.error('No hay equipos serializados', { id: toastId });
                return;
            }

            toast.success('Abriendo reporte...', { id: toastId });
            generateAndPrint(products, instances, rate, tenantName);
        } catch (err) {
            console.error(err);
            toast.error('Error generando reporte', { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50
                       text-white font-bold rounded-xl text-sm shadow-md shadow-emerald-200
                       hover:-translate-y-0.5 transition-all"
        >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <TrendingUp size={15} />}
            {loading ? 'Calculando...' : 'PDF Inversión'}
        </button>
    );
};

export default InversionReportPDF;
