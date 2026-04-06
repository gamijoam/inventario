/**
 * CreditoCelularModal.jsx
 * Modal completo para registrar una venta a crédito de celular.
 *
 * Flujo:
 *  Paso 1 → Calculadora (CalculadoraCredito)
 *  Paso 2 → Confirmación: resumen + código BLC generado
 *
 * Props:
 *   isOpen          — bool
 *   onClose         — fn() → cierra la calculadora sin registrar
 *   producto        — item del carrito {product_id, id, name, price, serial_numbers, has_imei}
 *   cliente         — {id, name, phone} | null
 *   sessionId       — ID de la sesión de caja abierta (del CashContext)
 *   exchangeRate    — tasa Bs/USD actual (del ConfigContext)
 *   onVentaExitosa  — fn() → llamado cuando la venta se registró OK; cierra TODO y limpia carrito
 */

import { useState } from 'react';
import { X, CheckCircle2, Smartphone, Download, Copy, AlertTriangle } from 'lucide-react';
import CalculadoraCredito from './CalculadoraCredito';
import { toast } from 'react-hot-toast';
import apiClient from '../../config/axios';

export default function CreditoCelularModal({
  isOpen, onClose, producto, cliente,
  sessionId    = null,
  exchangeRate = 1,
  onVentaExitosa,
}) {
  const [paso,      setPaso]      = useState(1);
  const [datosCalc, setDatosCalc] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [cargando,  setCargando]  = useState(false);
  const [errMsg,    setErrMsg]    = useState('');

  if (!isOpen) return null;

  // ── Paso 1: Calculadora → registrar venta ──────────────────────────────────
  const handleUsarEnVenta = async (datos) => {
    // Verificar caja abierta antes de intentar
    if (!sessionId) {
      setErrMsg('No hay una caja abierta. Abre la caja desde el menú de Caja antes de registrar una venta a crédito.');
      return;
    }
    setErrMsg('');
    setDatosCalc(datos);
    setCargando(true);

    const precioUSD = parseFloat(datos.precio)     || 0;
    const tasaBs    = parseFloat(exchangeRate)      || 1;

    try {
      const r = await apiClient.post('/products/sales/', {
        items: [{
          product_id     : parseInt(producto.product_id || producto.id, 10),
          quantity       : 1,
          unit_price     : precioUSD,
          discount       : 0,
          subtotal       : precioUSD,
          serial_numbers : producto.serial_numbers || [],
        }],
        payment_method           : 'Credito',
        currency                 : 'USD',
        exchange_rate_used       : tasaBs,
        total_amount             : precioUSD,
        total_amount_bs          : precioUSD * tasaBs,
        total_discount_usd       : 0,
        change_amount            : 0,
        change_currency          : 'VES',
        is_credit                : true,
        customer_id              : cliente?.id ? parseInt(cliente.id, 10) : null,
        exchange_rate            : tasaBs,
        session_id               : sessionId,
        // Datos del plan de crédito
        credit_down_payment      : parseFloat(datos.enganche)   || 0,
        credit_installments      : parseInt(datos.cuotas, 10)   || 1,
        credit_interest_rate     : parseFloat(datos.tasa)       || 0,
        credit_frequency         : datos.frecuencia,
        credit_installment_amount: parseFloat(datos.cuotaMonto) || 0,
      });

      setResultado(r.data);
      setPaso(2);

      // Intentar obtener estado de BloqueCelular (no bloqueante)
      const saleId = r.data?.sale_id || r.data?.id;
      if (saleId) {
        setTimeout(async () => {
          const est = await apiClient.get(`/bloqueo/sales/${saleId}/estado`).catch(() => null);
          if (est?.data) setResultado(prev => ({ ...prev, bloqueo: est.data }));
        }, 1500);
      }

    } catch (e) {
      const errData = e.response?.data?.detail;
      let msg = 'Error al registrar la venta a crédito';
      if (typeof errData === 'string')                msg = errData;
      else if (Array.isArray(errData) && errData[0]) msg = errData[0]?.msg || JSON.stringify(errData[0]);
      setErrMsg(msg);
      toast.error(msg);
    } finally {
      setCargando(false);
    }
  };

  const handleCerrar = () => {
    setPaso(1);
    setDatosCalc(null);
    setResultado(null);
    setErrMsg('');
    onClose?.();
  };

  const copiarCodigo = async (codigo) => {
    try {
      await navigator.clipboard.writeText(codigo);
      toast.success('Código copiado');
    } catch { toast.error('No se pudo copiar'); }
  };

  // ── PASO 2: Confirmación ────────────────────────────────────────────────────
  if (paso === 2) {
    const bloqueo = resultado?.bloqueo;
    const saleId  = resultado?.sale_id || resultado?.id;
    const codigo  = bloqueo?.codigo_activacion;
    const apkUrl  = 'https://bloqueo.miinventariofacil.com/app/bloqueo.apk';

    return (
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

          {/* Header éxito */}
          <div className="bg-emerald-600 px-6 py-5 text-white flex items-center gap-3">
            <CheckCircle2 size={28} />
            <div>
              <p className="font-black text-lg">¡Crédito registrado!</p>
              <p className="text-emerald-100 text-sm">
                Factura #{saleId} · {cliente?.name || 'Sin cliente'}
              </p>
            </div>
          </div>

          <div className="p-6 space-y-4">

            {/* Resumen compacto */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-4 text-sm">
              {[
                { l: 'Precio equipo',  v: `$${(datosCalc?.precio     ||0).toFixed(2)}` },
                { l: 'Enganche',       v: `$${(datosCalc?.enganche   ||0).toFixed(2)}` },
                { l: 'Interés',        v: `${datosCalc?.tasa||0}%`                      },
                { l: 'Total a pagar',  v: `$${(datosCalc?.totalCliente||0).toFixed(2)}` },
                { l: `${datosCalc?.cuotas||0} cuotas`, v: `$${(datosCalc?.cuotaMonto||0).toFixed(2)} ${datosCalc?.frecuencia||''}` },
                { l: 'Financia',       v: `$${(datosCalc?.financiado ||0).toFixed(2)}` },
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
                  🔒 Código de Activación BloqueCelular
                </p>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 bg-white border-2 border-indigo-300 rounded-xl px-4 py-2.5 text-center">
                    <p className="text-2xl font-black text-indigo-700 tracking-widest font-mono">{codigo}</p>
                  </div>
                  <button onClick={() => copiarCodigo(codigo)}
                    className="p-2.5 bg-indigo-100 hover:bg-indigo-200 rounded-xl transition-colors">
                    <Copy size={18} className="text-indigo-600" />
                  </button>
                </div>
                <ol className="space-y-1 text-xs text-indigo-700 list-decimal list-inside">
                  <li>Descarga e instala la app en el celular del cliente</li>
                  <li>Abre la app e ingresa el código: <strong>{codigo}</strong></li>
                  <li>El equipo quedará vinculado al sistema de bloqueo</li>
                </ol>
                <a href={apkUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors">
                  <Download size={13} /> Descargar APK de BloqueCelular
                </a>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                ⚠️ Integración de BloqueCelular no configurada o sin respuesta.
                La venta quedó registrada. Puedes configurar la integración en Configuración → Integraciones.
              </div>
            )}

            {/* Botón Listo — cierra TODO y limpia el carrito */}
            <button
              onClick={() => {
                handleCerrar();
                onVentaExitosa?.(); // limpia carrito + cierra PaymentModal
              }}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors"
            >
              ✅ Listo — Volver al POS
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── PASO 1: Calculadora ─────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden">

        {/* Barra de info del producto */}
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Smartphone size={16} className="text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 text-sm truncate">{producto?.name}</p>
            <p className="text-xs text-slate-400">
              {cliente?.name ? `Cliente: ${cliente.name}` : '⚠️ Sin cliente — selecciona un cliente antes'}
              {cliente?.phone ? ` · ${cliente.phone}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {cargando && (
              <span className="text-xs text-indigo-500 font-medium animate-pulse">Registrando...</span>
            )}
            {!sessionId && (
              <span className="text-xs text-red-500 font-bold">⚠️ Sin caja abierta</span>
            )}
            <button onClick={handleCerrar}
              className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors">
              <X size={16} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Error visible si hay problema */}
        {errMsg && (
          <div className="mx-4 mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 shrink-0">
            <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">No se pudo registrar</p>
              <p className="text-xs mt-0.5">{errMsg}</p>
            </div>
            <button onClick={() => setErrMsg('')} className="ml-auto text-red-400 hover:text-red-600">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Aviso de caja cerrada */}
        {!sessionId && (
          <div className="mx-4 mt-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 shrink-0">
            <AlertTriangle size={16} className="text-amber-500 shrink-0" />
            <p><strong>Abre la caja</strong> antes de registrar una venta a crédito. Ve a Caja → Abrir Caja.</p>
          </div>
        )}

        {/* Calculadora */}
        <div className="flex-1 overflow-hidden min-h-0">
          <CalculadoraCredito
            precioInicial={producto?.price || producto?.unit_price_usd || 0}
            onUsarEnVenta={handleUsarEnVenta}
            onCerrar={handleCerrar}
            disabled={cargando}
          />
        </div>
      </div>
    </div>
  );
}
