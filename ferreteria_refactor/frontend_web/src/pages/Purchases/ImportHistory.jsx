/**
 * ImportHistory.jsx — Herramienta 3: Importación masiva de historial
 * Permite cargar compras pasadas, cuentas por pagar y por cobrar desde Excel.
 */
import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import apiClient from '../../config/axios';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { toast } from 'react-hot-toast';
import {
    Upload, FileSpreadsheet, CheckCircle, XCircle,
    AlertCircle, Download, Loader, ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TEMPLATES = {
    compras: {
        label: 'Historial de Compras',
        icon: '📦',
        desc: 'Compras realizadas a proveedores con sus productos',
        columns: ['fecha', 'proveedor', 'nro_factura', 'producto', 'cantidad',
                  'costo_unitario', 'descuento_pct', 'tipo_pago', 'notas'],
        example: [
            { fecha: '2026-01-15', proveedor: 'Distribuidora ABC', nro_factura: 'F-0001',
              producto: 'Filtro Aceite Toyota', cantidad: 10, costo_unitario: 5.50,
              descuento_pct: 5, tipo_pago: 'CREDIT', notas: 'Compra inicial' },
            { fecha: '2026-01-20', proveedor: 'Distribuidora ABC', nro_factura: 'F-0001',
              producto: 'Bujía NGK', cantidad: 20, costo_unitario: 3.00,
              descuento_pct: 0, tipo_pago: 'CREDIT', notas: '' },
        ]
    },
    cuentas_pagar: {
        label: 'Cuentas por Pagar',
        icon: '💳',
        desc: 'Saldos pendientes con proveedores',
        columns: ['proveedor', 'nro_factura', 'fecha_factura', 'fecha_vencimiento',
                  'monto_total', 'monto_pagado', 'notas'],
        example: [
            { proveedor: 'Distribuidora ABC', nro_factura: 'F-0001',
              fecha_factura: '2026-01-15', fecha_vencimiento: '2026-02-15',
              monto_total: 550, monto_pagado: 200, notas: 'Abono inicial' },
        ]
    },
    cuentas_cobrar: {
        label: 'Cuentas por Cobrar',
        icon: '💰',
        desc: 'Saldos pendientes de clientes',
        columns: ['cliente', 'cedula_rif', 'nro_factura', 'fecha_factura',
                  'fecha_vencimiento', 'monto_total', 'monto_pagado', 'notas'],
        example: [
            { cliente: 'Juan Pérez', cedula_rif: 'V-12345678',
              nro_factura: 'VEN-001', fecha_factura: '2026-01-10',
              fecha_vencimiento: '2026-02-10', monto_total: 150,
              monto_pagado: 50, notas: 'Abono recibido en efectivo' },
        ]
    }
};

function downloadTemplate(type) {
    const tpl = TEMPLATES[type];
    const ws  = XLSX.utils.json_to_sheet(tpl.example);
    const wb  = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tpl.label);
    XLSX.writeFile(wb, `plantilla_${type}.xlsx`);
}

export default function ImportHistory() {
    const navigate  = useNavigate();
    const fileRef   = useRef();
    const [type, setType]     = useState('compras');
    const [rows, setRows]     = useState([]);
    const [errors, setErrors] = useState([]);
    const [loading, setLoading]   = useState(false);
    const [imported, setImported] = useState(0);
    const [step, setStep]         = useState(1); // 1=seleccionar 2=previsualizar 3=resultado

    const handleFile = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const wb   = XLSX.read(ev.target.result, { type: 'binary', cellDates: true });
            const ws   = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
            setRows(data);
            setErrors([]);
            setStep(2);
        };
        reader.readAsBinaryString(file);
    };

    const validate = () => {
        const tpl  = TEMPLATES[type];
        const errs = [];
        rows.forEach((row, i) => {
            const missing = tpl.columns.filter(col => !row[col] && row[col] !== 0);
            if (missing.length > 0) {
                errs.push(`Fila ${i + 2}: faltan columnas — ${missing.join(', ')}`);
            }
        });
        setErrors(errs);
        return errs.length === 0;
    };

    const handleImport = async () => {
        if (!validate()) return;
        setLoading(true);
        setImported(0);
        const errs = [];
        let count  = 0;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            try {
                if (type === 'compras') {
                    await apiClient.post('/purchases/import-row', { ...row, tipo: type });
                } else if (type === 'cuentas_pagar') {
                    await apiClient.post('/purchases/import-payable', row);
                } else {
                    await apiClient.post('/customers/import-receivable', row);
                }
                count++;
                setImported(count);
            } catch (e) {
                errs.push(`Fila ${i + 2}: ${getApiErrorMessage(e, 'No se pudo importar la fila')}`);
            }
        }

        setErrors(errs);
        setLoading(false);
        setStep(3);
        if (errs.length === 0) {
            toast.success(`✅ ${count} registros importados correctamente`);
        } else {
            toast.error(`⚠️ ${count} importados, ${errs.length} con errores`);
        }
    };

    const tpl = TEMPLATES[type];

    return (
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={() => navigate('/purchases')}
                    className="w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                    <ArrowLeft size={18} className="text-slate-600" />
                </button>
                <div>
                    <h1 className="text-xl font-black text-slate-900">Importar historial</h1>
                    <p className="text-sm text-slate-500">Carga masiva desde Excel de compras, cuentas por pagar y por cobrar</p>
                </div>
            </div>

            {/* Paso 1: Seleccionar tipo */}
            <div className="grid grid-cols-3 gap-3">
                {Object.entries(TEMPLATES).map(([key, t]) => (
                    <button key={key} onClick={() => { setType(key); setRows([]); setStep(1); }}
                        className={`p-4 rounded-2xl border-2 text-left transition-all
                            ${type === key
                                ? 'border-indigo-400 bg-indigo-50'
                                : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                        <span className="text-2xl block mb-1">{t.icon}</span>
                        <p className="text-sm font-black text-slate-800">{t.label}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{t.desc}</p>
                    </button>
                ))}
            </div>

            {/* Descargar plantilla */}
            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                <AlertCircle size={18} className="text-amber-600 shrink-0" />
                <div className="flex-1">
                    <p className="text-sm font-bold text-amber-800">Usa la plantilla correcta</p>
                    <p className="text-xs text-amber-700">El archivo debe tener exactamente las columnas indicadas.</p>
                </div>
                <button onClick={() => downloadTemplate(type)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all">
                    <Download size={14} /> Plantilla
                </button>
            </div>

            {/* Subir archivo */}
            {step === 1 && (
                <div
                    onClick={() => fileRef.current.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl p-10 text-center cursor-pointer transition-all hover:bg-indigo-50">
                    <FileSpreadsheet size={40} className="text-slate-300 mx-auto mb-3" />
                    <p className="font-bold text-slate-700">Haz clic para seleccionar el archivo Excel</p>
                    <p className="text-xs text-slate-400 mt-1">.xlsx o .xls</p>
                    <input ref={fileRef} type="file" accept=".xlsx,.xls"
                        className="hidden" onChange={handleFile} />
                </div>
            )}

            {/* Paso 2: Previsualización */}
            {step === 2 && rows.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-slate-700">
                            {rows.length} filas detectadas
                        </p>
                        <button onClick={() => { setRows([]); setStep(1); fileRef.current.value = ''; }}
                            className="text-xs text-slate-400 hover:text-slate-600">
                            Cambiar archivo
                        </button>
                    </div>

                    {/* Tabla previsualización */}
                    <div className="overflow-auto rounded-xl border border-slate-200 max-h-60">
                        <table className="text-xs w-full">
                            <thead className="bg-slate-50 sticky top-0">
                                <tr>
                                    {tpl.columns.map(col => (
                                        <th key={col} className="px-3 py-2 text-left font-bold text-slate-600 whitespace-nowrap">
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {rows.slice(0, 10).map((row, i) => (
                                    <tr key={i} className="hover:bg-slate-50">
                                        {tpl.columns.map(col => (
                                            <td key={col} className="px-3 py-2 text-slate-700 whitespace-nowrap">
                                                {String(row[col] ?? '')}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {rows.length > 10 && (
                            <p className="text-center text-xs text-slate-400 py-2">
                                ... y {rows.length - 10} filas más
                            </p>
                        )}
                    </div>

                    {/* Errores de validación */}
                    {errors.length > 0 && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-1">
                            {errors.map((e, i) => (
                                <p key={i} className="text-xs text-rose-700 flex items-start gap-1.5">
                                    <XCircle size={12} className="shrink-0 mt-0.5" />{e}
                                </p>
                            ))}
                        </div>
                    )}

                    <button onClick={handleImport} disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all disabled:opacity-60 shadow-lg shadow-indigo-200">
                        {loading
                            ? <><Loader size={18} className="animate-spin" /> Importando {imported}/{rows.length}...</>
                            : <><Upload size={18} /> Importar {rows.length} registros</>
                        }
                    </button>
                </div>
            )}

            {/* Paso 3: Resultado */}
            {step === 3 && (
                <div className="text-center py-8 space-y-4">
                    {errors.length === 0
                        ? <CheckCircle size={48} className="text-emerald-500 mx-auto" />
                        : <AlertCircle size={48} className="text-amber-500 mx-auto" />
                    }
                    <div>
                        <p className="text-xl font-black text-slate-800">
                            {errors.length === 0 ? '¡Importación exitosa!' : 'Importación parcial'}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                            {imported} de {rows.length} registros importados
                        </p>
                    </div>
                    {errors.length > 0 && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-left space-y-1 max-h-40 overflow-y-auto">
                            {errors.map((e, i) => (
                                <p key={i} className="text-xs text-rose-700 flex items-start gap-1.5">
                                    <XCircle size={12} className="shrink-0 mt-0.5" />{e}
                                </p>
                            ))}
                        </div>
                    )}
                    <div className="flex gap-3 justify-center">
                        <button onClick={() => { setStep(1); setRows([]); setErrors([]); setImported(0); }}
                            className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50">
                            Importar otro
                        </button>
                        <button onClick={() => navigate('/purchases')}
                            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold">
                            Ir a compras
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
