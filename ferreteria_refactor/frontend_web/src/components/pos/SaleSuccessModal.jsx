import { useState, useEffect, useMemo, useRef } from "react";
import { CheckCircle, Printer, FileText, ShieldCheck, ArrowRight, MessageCircle, Building2 } from "lucide-react";
import printerService from "../../services/printerService";
import apiClient from "../../config/axios";
import toast from "react-hot-toast";
import { useConfig } from "../../context/ConfigContext";
import { printFacturaA4 } from "./FacturaA4";
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

const SaleSuccessModal = ({ isOpen, onClose, saleData }) => {
    const [printing, setPrinting] = useState(false);
    const [printingWarranty, setPrintingWarranty] = useState(false);
    const [sendingWarrantyWa, setSendingWarrantyWa] = useState(false);

    const facturaA4Active = useFeatureFlag('impresion_factura_a4');
    const { business, autoPrintTicket } = useConfig();
    const autoPrintedSaleRef = useRef(null);

    // Extraer saleId de manera robusta
    const saleId = saleData?.saleId
        || saleData?.paymentData?.saleId
        || saleData?.sale_id;

    // Detectar si es venta con financiamiento
    const isFinancing = saleData?.paymentData?.isFinancing || false;
    const financingData = saleData?.paymentData?.financingData || null;

    // Auto-print solo una vez por venta. El modal puede re-renderizarse mientras
    // carga configuracion/contexto, pero el ticket no debe salir duplicado.
    useEffect(() => {
        if (!isOpen || !autoPrintTicket || !saleId || autoPrintedSaleRef.current === saleId) return;
        autoPrintedSaleRef.current = saleId;
        printerService.printTicket(saleId).catch(() => {});
    }, [isOpen, autoPrintTicket, saleId]);

    const hasImeiItems = useMemo(() => {
        if (!saleData?.cart) {
            return saleData?.items?.some(item =>
                item.has_imei || (item.serial_numbers && item.serial_numbers.length > 0) || item.warranty_policy_id
            );
        }
        return saleData.cart.some(item =>
            (item.serial_numbers && Array.isArray(item.serial_numbers) && item.serial_numbers.length > 0) ||
            item.has_imei || item.warranty_policy_id
        );
    }, [saleData]);

    if (!isOpen || !saleData) return null;

    const handlePrintTicket = async () => {
        if (!saleId) {
            toast.error("No se encontró el ID de la venta para imprimir");
            return;
        }
        setPrinting(true);
        try {
            await printerService.printTicket(saleId);
            toast.success("Ticket enviado a la impresora");
        } catch (error) {
            toast.error("Error: " + error.message);
        } finally {
            setPrinting(false);
        }
    };

    const handlePrintA4 = () => {
        printFacturaA4(saleData, business);
    };

    const handlePrintWarranty = async () => {
        if (!saleId) { toast.error("No se encontró ID de venta"); return; }
        setPrintingWarranty(true);
        try {
            const response = await apiClient.get(`/warranties/print/${saleId}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            const printWindow = window.open(url, '_blank');
            if (printWindow) {
                printWindow.addEventListener('load', () => { printWindow.focus(); printWindow.print(); });
            }
            window.URL.revokeObjectURL(url);
            toast.success('Abriendo garantía para imprimir...');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Error al generar la garantía');
        } finally {
            setPrintingWarranty(false);
        }
    };

    const handleSendWarrantyWhatsApp = async () => {
        if (!saleId) { toast.error("No se encontró ID de venta"); return; }
        setSendingWarrantyWa(true);
        try {
            const res = await apiClient.post(`/warranties/send-whatsapp/${saleId}`);
            toast.success(`Garantía enviada a ${res.data.customer} por WhatsApp`);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al enviar por WhatsApp');
        } finally {
            setSendingWarrantyWa(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md">
            <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">

                {/* Header */}
                <div className="p-8 bg-slate-900 text-white text-center relative overflow-hidden">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg ${isFinancing ? 'bg-emerald-600 shadow-emerald-500/50' : 'bg-indigo-600 shadow-indigo-500/50'}`}>
                        {isFinancing ? <Building2 size={32} /> : <CheckCircle size={32} />}
                    </div>
                    <h2 className="text-2xl font-black uppercase tracking-tight">Venta Exitosa</h2>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
                        Factura #{saleId || '—'}
                    </p>
                    {isFinancing && (
                        <div className="mt-3 bg-emerald-600/20 border border-emerald-500/30 rounded-2xl px-4 py-2">
                            <p className="text-emerald-300 text-xs font-bold">
                                🏦 Financiado por {financingData?.financer_name}
                            </p>
                        </div>
                    )}
                </div>

                <div className="p-8 space-y-5">

                    {/* Resumen de financiamiento */}
                    {isFinancing && financingData && (
                        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-5 space-y-3">
                            <p className="font-black text-emerald-800 text-xs uppercase tracking-wide flex items-center gap-2">
                                <Building2 size={14} /> Resumen del Financiamiento
                            </p>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Total de la venta</span>
                                    <span className="font-bold">${(financingData.total_price || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-emerald-700">
                                    <span className="font-semibold">✓ Inicial cobrado (en caja)</span>
                                    <span className="font-black">${(financingData.initial_payment || 0).toFixed(2)}</span>
                                </div>
                                <div className="h-px bg-emerald-200" />
                                <div className="flex justify-between text-indigo-700">
                                    <span className="font-semibold">Monto financiado por {financingData.financer_name}</span>
                                    <span className="font-black">${(financingData.financed_amount || 0).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Garantía IMEI */}
                    {hasImeiItems && (
                        <div className="bg-amber-100 border-2 border-amber-300 p-5 rounded-2xl flex flex-col items-center text-center gap-3">
                            <ShieldCheck size={28} className="text-amber-600" />
                            <div>
                                <p className="font-black text-amber-900 uppercase text-xs">Venta con Serial / IMEI detectada</p>
                                <p className="text-[10px] text-amber-700 font-bold mt-1">Imprime o envía la garantía al cliente</p>
                            </div>
                            <div className="flex gap-2 w-full">
                                <button onClick={handlePrintWarranty} disabled={printingWarranty}
                                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform disabled:opacity-50">
                                    <Printer size={14} /> {printingWarranty ? 'Generando...' : 'Imprimir Garantía'}
                                </button>
                                <button onClick={handleSendWarrantyWhatsApp} disabled={sendingWarrantyWa}
                                    className="flex-1 py-3 bg-green-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform disabled:opacity-50">
                                    <MessageCircle size={14} /> {sendingWarrantyWa ? 'Enviando...' : 'WhatsApp'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Botones de impresión */}
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={handlePrintTicket} disabled={printing || !saleId}
                            className="flex flex-col items-center gap-3 p-6 bg-slate-50 border-2 border-transparent hover:border-indigo-600 rounded-[2rem] transition-all disabled:opacity-40">
                            <Printer className={printing ? 'text-slate-400 animate-pulse' : 'text-indigo-600'} size={24} />
                            <span className="font-black text-[10px] uppercase">
                                {printing ? 'Imprimiendo...' : 'Ticket Térmico'}
                            </span>
                        </button>
                        {facturaA4Active && (
                            <button onClick={handlePrintA4}
                                className="flex flex-col items-center gap-3 p-6 bg-slate-50 border-2 border-transparent hover:border-slate-900 rounded-[2rem] transition-all">
                                <FileText className="text-slate-900" size={24} />
                                <span className="font-black text-[10px] uppercase">Factura A4</span>
                            </button>
                        )}
                    </div>

                    <button onClick={onClose}
                        className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-xs flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl">
                        Nueva Venta <ArrowRight size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SaleSuccessModal;
