import { useState } from 'react';
import { FileText, Loader2, Download } from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';

// ─── Generador de PDF puro en el browser (sin librerías externas) ─────────────

const STATUS_LABEL = {
    AVAILABLE: 'Disponible',
    SOLD:      'Vendido',
    RESERVED:  'Reservado',
    DAMAGED:   'Dañado',
};

const STATUS_COLOR = {
    AVAILABLE: '#16a34a',
    SOLD:      '#dc2626',
    RESERVED:  '#d97706',
    DAMAGED:   '#64748b',
};

const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;

// Genera el HTML del reporte y lo convierte a PDF usando window.print()
const generateAndPrint = (products, instances, tenant) => {
    // Agrupar instancias por producto
    const instMap = {};
    instances.forEach(inst => {
        if (!instMap[inst.product_id]) instMap[inst.product_id] = [];
        instMap[inst.product_id].push(inst);
    });

    const date = new Date().toLocaleDateString('es-VE', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    const totalDisp  = instances.filter(i => i.status === 'AVAILABLE').length;
    const totalVend  = instances.filter(i => i.status === 'SOLD').length;
    const totalUnits = instances.length;

    // Construir filas de la tabla
    let rows = '';
    let rowIndex = 0;

    products.forEach(product => {
        const insts = instMap[product.id] || [];
        if (insts.length === 0) return;

        // Construir precios especiales
        const priceLists = (product.prices || []).map(pp =>
            `<span style="display:inline-block;background:#eef2ff;border:1px solid #c7d2fe;color:#4338ca;
             border-radius:4px;padding:1px 6px;font-size:10px;font-weight:700;margin:1px;">
             ${pp.price_list?.name || 'Lista'}: ${fmt(pp.price)}
             </span>`
        ).join(' ');

        insts.forEach((inst, idx) => {
            const even = rowIndex % 2 === 0;
            const bg = even ? '#ffffff' : '#f8fafc';
            const statusColor = STATUS_COLOR[inst.status] || '#64748b';
            const statusLabel = STATUS_LABEL[inst.status] || inst.status;

            rows += `
            <tr style="background:${bg};">
                ${idx === 0 ? `
                <td rowspan="${insts.length}" style="padding:8px 10px;border-bottom:1px solid #e2e8f0;
                    border-right:1px solid #e2e8f0;vertical-align:top;">
                    <div style="font-weight:800;font-size:12px;color:#1e293b;line-height:1.3;">${product.name}</div>
                    ${product.sku ? `<div style="font-size:10px;color:#94a3b8;font-family:monospace;margin-top:2px;">${product.sku}</div>` : ''}
                    <div style="margin-top:6px;">
                        <div style="font-size:10px;color:#64748b;margin-bottom:2px;">Precio base:
                            <strong style="color:#0f172a;">${fmt(product.price)}</strong>
                        </div>
                        <div style="font-size:10px;color:#64748b;margin-bottom:4px;">Costo:
                            <strong style="color:#7c3aed;">${fmt(product.cost_price)}</strong>
                        </div>
                        <div>${priceLists}</div>
                    </div>
                </td>` : ''}
                <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0;
                    font-family:monospace;font-size:11px;font-weight:700;color:#334155;letter-spacing:0.5px;">
                    ${inst.serial_number}
                </td>
                <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;text-align:center;">
                    <span style="display:inline-block;background:${statusColor}18;border:1px solid ${statusColor}44;
                        color:${statusColor};border-radius:20px;padding:2px 10px;font-size:10px;font-weight:800;">
                        ${statusLabel}
                    </span>
                </td>
            </tr>`;
            rowIndex++;
        });
    });

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte de Equipos Serializados</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#1e293b; background:#fff; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display:none !important; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
  }
  @page { margin: 15mm 12mm; size: A4 portrait; }
</style>
</head>
<body>
<div style="padding:24px;">

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;
       padding-bottom:16px;border-bottom:2px solid #4f46e5;">
    <div>
      <div style="font-size:22px;font-weight:900;color:#4f46e5;letter-spacing:-0.5px;">
        📱 Reporte de Equipos Serializados
      </div>
      <div style="font-size:12px;color:#64748b;margin-top:4px;">Generado: ${date}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Tenant</div>
      <div style="font-size:15px;font-weight:800;color:#1e293b;">${tenant || ''}</div>
    </div>
  </div>

  <!-- Stats -->
  <div style="display:flex;gap:12px;margin-bottom:20px;">
    <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;text-align:center;">
      <div style="font-size:28px;font-weight:900;color:#16a34a;">${totalDisp}</div>
      <div style="font-size:10px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:1px;">Disponibles</div>
    </div>
    <div style="flex:1;background:#fff1f2;border:1px solid #fecdd3;border-radius:10px;padding:12px;text-align:center;">
      <div style="font-size:28px;font-weight:900;color:#dc2626;">${totalVend}</div>
      <div style="font-size:10px;font-weight:700;color:#b91c1c;text-transform:uppercase;letter-spacing:1px;">Vendidos</div>
    </div>
    <div style="flex:1;background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:12px;text-align:center;">
      <div style="font-size:28px;font-weight:900;color:#4338ca;">${products.length}</div>
      <div style="font-size:10px;font-weight:700;color:#4338ca;text-transform:uppercase;letter-spacing:1px;">Modelos</div>
    </div>
    <div style="flex:1;background:#fafafa;border:1px solid #e2e8f0;border-radius:10px;padding:12px;text-align:center;">
      <div style="font-size:28px;font-weight:900;color:#0f172a;">${totalUnits}</div>
      <div style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px;">Total unidades</div>
    </div>
  </div>

  <!-- Tabla -->
  <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
    <thead>
      <tr style="background:linear-gradient(135deg,#4f46e5,#6366f1);">
        <th style="padding:10px 12px;text-align:left;color:#fff;font-size:11px;font-weight:800;
            text-transform:uppercase;letter-spacing:0.8px;width:40%;">Producto / Precios</th>
        <th style="padding:10px 12px;text-align:left;color:#fff;font-size:11px;font-weight:800;
            text-transform:uppercase;letter-spacing:0.8px;width:40%;">IMEI / Serial</th>
        <th style="padding:10px 12px;text-align:center;color:#fff;font-size:11px;font-weight:800;
            text-transform:uppercase;letter-spacing:0.8px;width:20%;">Estado</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="3" style="padding:20px;text-align:center;color:#94a3b8;">Sin datos</td></tr>'}
    </tbody>
  </table>

  <!-- Footer -->
  <div style="margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;
       display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:10px;color:#94a3b8;">Mi Inventario Fácil — Reporte interno</div>
    <div style="font-size:10px;color:#94a3b8;">${totalUnits} equipos registrados</div>
  </div>

</div>
</body>
</html>`;

    // Abrir ventana de impresión/PDF
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
};

// ─── Componente botón ─────────────────────────────────────────────────────────

const SerializedReportPDF = ({ tenantName }) => {
    const [loading, setLoading] = useState(false);

    const handleGenerate = async () => {
        setLoading(true);
        const toastId = toast.loading('Generando reporte PDF...');
        try {
            // Traer productos serializados con sus precios y listas
            const [prodRes, instRes] = await Promise.all([
                apiClient.get('/products/', { params: { limit: 2000, has_imei: true } }),
                apiClient.get('/inventory/serialized-instances'),
            ]);

            const products  = (Array.isArray(prodRes.data) ? prodRes.data : []).filter(p => p.has_imei);
            const instances = Array.isArray(instRes.data) ? instRes.data : [];

            if (products.length === 0) {
                toast.error('No hay productos serializados registrados', { id: toastId });
                return;
            }

            toast.success('Abriendo PDF...', { id: toastId });
            generateAndPrint(products, instances, tenantName);
        } catch (err) {
            console.error(err);
            toast.error('Error generando el reporte', { id: toastId });
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
            {loading
                ? <Loader2 size={15} className="animate-spin" />
                : <FileText size={15} />
            }
            {loading ? 'Generando...' : 'PDF Seriales'}
        </button>
    );
};

export default SerializedReportPDF;
