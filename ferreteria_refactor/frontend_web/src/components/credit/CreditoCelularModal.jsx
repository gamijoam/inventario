/**
 * CreditoCelularModal.jsx
 * Modal completo para registrar una venta a crédito de un celular.
 *
 * Flujo:
 *  Paso 1 → Calculadora de crédito (copiar de BloqueCelular)
 *  Paso 2 → Confirmación: resumen del crédito + código BLC generado
 *
 * El modal se abre desde el POS al confirmar una venta a crédito
 * de un producto con has_imei=True.
 *
 * Props:
 *   isOpen        — bool
 *   onClose       — fn()
 *   producto      — { id, name, price, has_imei }
 *   cliente       — { id, name, phone }
 *   onConfirmar   — fn(datosCredito) → llama al endpoint de crear venta
 */

import { useState } from 'react';
import { X, CheckCircle2, Smartphone, Lock, Download, Copy } from 'lucide-react';
import CalculadoraCredito from './CalculadoraCredito';
import { toast } from 'react-hot-toast';
import apiClient from '../../config/axios';

export default function CreditoCelularModal({
  isOpen, onClose, producto, cliente, onConfirmar
}) {
  const [paso,        setPaso]        = useState(1); // 1=calc, 2=confirmado
  const [datosCalc,   setDatosCalc]   = useState(null);
  const [resultado,   setResultado]   = useState(null); // respuesta del API
  const [cargando,    setCargando]    = useState(false);

  if (!isOpen) return null;

  // ── Paso 1: Usuario usó la calculadora → pasar al paso 2 ─────────────────
  const handleUsarEnVenta = async (datos) => {
    setDatosCalc(datos);
    setCargando(true);
    try {
      // Llamar al endpoint de crear venta con datos de crédito
      const r = await apiClient.post('/products/sales/', {
        items: [{
          product_id : producto.id,
          quantity   : 1,
          unit_price : datos.precio,
          discount   : 0,
          subtotal   : datos.precio,
        }],
        payment_method           : 'Credito',
        currency                 : 'USD',
        exchange_rate_used       : 1.0,
        total_amount             : datos.precio,
        total_amount_bs          : datos.precio,
        total_discount_usd       : 0,
        change_amount            : 0,
        change_currency          : 'VES',
        is_credit                : true,
        customer_id              : cliente?.id || null,
        exchange_rate            : 1.0,
        // Datos del crédito — guardados en BD, usados para balance_pending y BloqueCelular
        credit_down_payment      : datos.enganche,
        credit_installments      : datos.cuotas,
        credit_interest_rate     : datos.tasa,
        credit_frequency         : datos.frecuencia,
        credit_installment_amount: datos.cuotaMonto,
      });

      setResultado(r.data);

      // Esperar un momento para que el hook de BloqueCelular procese
      setTimeout(async () => {
        if (r.data?.sale_id || r.data?.id) {
          const saleId = r.data?.sale_id || r.data?.id;
          const est = await apiClient.get(`/bloqueo/sales/${saleId}/estado`).catch(() => null);
          setResultado(prev => ({ ...prev, bloqueo: est?.data }));
        }
      }, 1500);

      setPaso(2);
      onConfirmar?.(datos);
    } catch (e) {
      const errData = e.response?.data?.detail;
      let errMsg = 'Error registrando la venta a crédito';
      if (typeof errData === 'string') errMsg = errData;
      else if (Array.isArray(errData) && errData.length > 0) {
        // Error de validación Pydantic — mostrar el primer mensaje
        errMsg = errData[0]?.msg || errData[0]?.message || JSON.stringify(errData[0]);
      }
      toast.error(errMsg);
    } finally {
      setCargando(false);
    }
  };

  const handleCerrar = () => {
    setPaso(1);
    setDatosCalc(null);
    setResultado(null);
    onClose?.();
  };

  const copiarCodigo = async (codigo) => {
    try {
      await navigator.clipboard.writeText(codigo);
      toast.success('Código copiado al portapapeles');
    } catch { toast.error('No se pudo copiar'); }
  };

  // ── PASO 2: Confirmación ──────────────────────────────────────────────────
  if (paso === 2) {
    const bloqueo = resultado?.bloqueo;
    const saleId  = resultado?.sale_id || resultado?.id;
    const codigo  = bloqueo?.codigo_activacion;
    const apkUrl  = 'https://bloqueo.miinventariofacil.com/app/bloqueo.apk';

    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">

          {/* Header éxito */}
          <div className="bg-emerald-600 rounded-t-2xl px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={28} />
              <div>
                <p className="font-black text-lg">¡Crédito registrado!</p>
                <p className="text-emerald-100 text-sm">
                  Factura #{saleId} · {cliente?.name || 'Cliente'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">

            {/* Resumen del crédito */}
            <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
              {[
                { l: 'Precio equipo',    v: `$${(datosCalc?.precio||0).toFixed(2)}`       },
                { l: 'Enganche',         v: `$${(datosCalc?.enganche||0).toFixed(2)}`      },
                { l: 'Tasa interés',     v: `${datosCalc?.tasa||0}%`                       },
                { l: 'Total a pagar',    v: `$${(datosCalc?.totalCliente||0).toFixed(2)}`  },
                { l: `${datosCalc?.cuotas||0} cuotas de`, v: `$${(datosCalc?.cuotaMonto||0).toFixed(2)} ${datosCalc?.frecuencia||''}` },
                { l: 'Financia',         v: `$${(datosCalc?.financiado||0).toFixed(2)}`    },
              ].map(row => (
                <div key={row.l}>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">{row.l}</p>
                  <p className="font-black text-slate-800">{row.v}</p>
                </div>
              ))}
            </div>

            {/* Código BLC */}
            {codigo ? (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3">
                  🔒 Código de Activación del Bloqueo
                </p>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 bg-white border-2 border-indigo-300 rounded-xl px-4 py-2.5 text-center">
                    <p className="text-2xl font-black text-indigo-700 tracking-widest font-mono">
                      {codigo}
                    </p>
                  </div>
                  <button
                    onClick={() => copiarCodigo(codigo)}
                    className="p-2.5 bg-indigo-100 hover:bg-indigo-200 rounded-xl transition-colors"
                  >
                    <Copy size={18} className="text-indigo-600" />
                  </button>
                </div>
                <div className="space-y-1.5 text-xs text-indigo-700">
                  {[
                    `1. Descarga e instala la app en el celular del cliente`,
                    `2. Abre la app e ingresa el código: ${codigo}`,
                    `3. El equipo quedará vinculado al sistema de bloqueo`,
                  ].map((s,i) => <p key={i}>{s}</p>)}
                </div>
                <a href={apkUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors">
                  <Download size={13} /> Descargar APK
                </a>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                ⚠️ El sistema de bloqueo no está configurado. Ve a Configuración → Integraciones para activarlo.
              </div>
            )}

            <button
              onClick={handleCerrar}
              className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Listo
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── PASO 1: Calculadora ───────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] sm:h-auto sm:max-h-[88vh] flex flex-col overflow-hidden">

        {/* Info del producto arriba */}
        <div className="flex items-center gap-3 px-6 py-3 bg-slate-50 border-b border-slate-100 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Smartphone size={16} className="text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 text-sm truncate">{producto?.name}</p>
            <p className="text-xs text-slate-400">
              {cliente?.name ? `Cliente: ${cliente.name}` : 'Sin cliente seleccionado'}
              {cliente?.phone ? ` · ${cliente.phone}` : ''}
            </p>
          </div>
          {cargando && (
            <span className="text-xs text-indigo-500 font-medium animate-pulse">
              Registrando...
            </span>
          )}
        </div>

        {/* Calculadora */}
        <div className="flex-1 overflow-hidden">
          <CalculadoraCredito
            precioInicial={producto?.price || 0}
            onUsarEnVenta={handleUsarEnVenta}
            onCerrar={handleCerrar}
          />
        </div>
      </div>
    </div>
  );
}
