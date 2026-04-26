import { useState, useEffect, useMemo } from "react";
import { CheckCircle, Printer, FileText, X, ShieldCheck, ArrowRight, Download } from "lucide-react";
import printerService from "../../services/printerService";
import apiClient from "../../config/axios";
import toast from "react-hot-toast";
import { useConfig } from "../../context/ConfigContext";
import { printFacturaA4 } from "./FacturaA4";

const SaleSuccessModal = ({ isOpen, onClose, saleData }) => {
    const [printing, setPrinting] = useState(false);
    const [warrantyUrl, setWarrantyUrl] = useState("");
import { useState } from 'react';
import { CheckCircle, Printer, FileText, Shield } from 'lucide-react';
import printerService from '../../services/printerService';
import toast from 'react-hot-toast';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { useConfig } from '../../context/ConfigContext';
import { printFacturaA4 } from './FacturaA4';
import apiClient from '../../config/axios';

const SaleSuccessModal = ({ isOpen, onClose, saleData }) => {
    const [printing, setPrinting] = useState(false);
    const [printStatus, setPrintStatus] = useState(null); // 'success' | 'error'
    const [printingWarranty, setPrintingWarranty] = useState(false);
    const facturaA4Active = useFeatureFlag('impresion_factura_a4');
    const warrantyPdfActive = useFeatureFlag('impresion_garantia_pdf');
    const { business } = useConfig();

    useEffect(() => {
        if (isOpen) {
            // Refrescar info del negocio para obtener la URL de garantia mas reciente
            apiClient.get("/config/business").then(res => {
                // El campo esta directamente en res.data segun el esquema BusinessInfo
                const url = res.data.warranty_format_url;
                console.log("URL de Garantia detectada:", url);
                setWarrantyUrl(url || "");
            }).catch(err => console.error("Error cargando config:", err));
        }
    }, [isOpen]);

    const hasImeiItems = useMemo(() => {
        if (!saleData || !saleData.cart) return false;
        // Solo mostrar si al menos un item tiene seriales asignados
        return saleData.cart.some(item => 
            item.serial_numbers && 
            Array.isArray(item.serial_numbers) && 
            item.serial_numbers.length > 0
        );
    }, [saleData]);

    if (!isOpen || !saleData) return null;

    const handlePrintTicket = async () => {
    // Check if sale has IMEI products
    const hasImeiProducts = saleData.items?.some(item => item.has_imei || (item.serial_numbers && item.serial_numbers.length > 0));

    const handlePrint = async () => {
        setPrinting(true);
        try {
            await printerService.printTicket(saleData.saleId);
            toast.success("Ticket enviado");
        } catch (error) {
            toast.error("Error: " + error.message);
        } finally {
            setPrinting(false);
        }
    };

            const handlePrintWarranty = async () => {
        try {
            const res = await apiClient.get("/config/business");
            const warrantyUrl = res.data.warranty_format_url;
            
            if (!warrantyUrl) {
                alert("No se ha detectado el formato en la base de datos. Por favor, súbelo de nuevo en Configuración.");
                return;
            }

            const baseUrl = import.meta.env.VITE_API_URL.replace(/\/api\/v1\/?$/, "");
            const fullUrl = warrantyUrl.startsWith("http") ? warrantyUrl : `${baseUrl}${warrantyUrl}`;
            
            window.open(fullUrl, "_blank");
        } catch (error) {
            alert("Error al conectar con el servidor para obtener el formato.");
        }
    };

    const handlePrintA4 = () => {
        printFacturaA4(saleData, business);
    };

    const handlePrintWarranty = async () => {
        if (!saleData.saleId) {
            toast.error("No se encontró ID de venta");
            return;
        }
        setPrintingWarranty(true);
        try {
            const response = await apiClient.get(`/warranties/print/${saleData.saleId}`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `garantia_venta_${saleData.saleId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Garantía descargada. Ábrela e imprímela desde tu visor de PDF.');
        } catch (error) {
            const detail = error.response?.data?.detail || 'Error al generar la garantía';
            toast.error(detail);
        } finally {
            setPrintingWarranty(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md">
            <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                <div className="p-8 bg-slate-900 text-white text-center relative overflow-hidden">
                    <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/50">
                        <CheckCircle size={32} />
                    </div>
                    <h2 className="text-2xl font-black uppercase tracking-tight">Venta Exitosa</h2>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Factura #{saleData.saleId}</p>
                </div>

                <div className="p-10 space-y-6">
                    {hasImeiItems && (
                        <div className="bg-amber-100 border-2 border-amber-300 p-6 rounded-[2rem] flex flex-col items-center text-center gap-3">
                            <ShieldCheck size={32} className="text-amber-600" />
                            <div>
                                <p className="font-black text-amber-900 uppercase text-xs">Venta con Serial / IMEI detectada</p>
                                <p className="text-[10px] text-amber-700 font-bold mt-1">Haga clic abajo para imprimir su formato corporativo</p>
                            </div>
                            <button 
                                onClick={handlePrintWarranty}
                                className="mt-2 w-full py-3 bg-amber-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg shadow-amber-200 flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
                            >
                                <Download size={14} /> Imprimir Garantía Corporativa
                            </button>
                        </div>
                <div className="space-y-3">
                    <button
                        onClick={handlePrint}
                        disabled={printing}
                        className={`w-full py-3 px-4 rounded-lg shadow font-bold flex items-center justify-center transition-colors ${printStatus === 'success' ? 'bg-gray-800 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                    >
                        <Printer size={20} className="mr-2" />
                        {printing ? 'Enviando...' : (printStatus === 'success' ? 'Re-imprimir Ticket' : 'Imprimir Ticket')}
                    </button>

                    {printStatus === 'success' && (
                        <p className="text-xs text-green-600 font-medium">Ticket enviado a cola de impresión.</p>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={handlePrintTicket} disabled={printing} className="flex flex-col items-center gap-3 p-6 bg-slate-50 border-2 border-transparent hover:border-indigo-600 rounded-[2.5rem] transition-all">
                            <Printer className="text-indigo-600" size={24} />
                            <span className="font-black text-[10px] uppercase">Ticket Térmico</span>
                        </button>
                        <button onClick={handlePrintA4} className="flex flex-col items-center gap-3 p-6 bg-slate-50 border-2 border-transparent hover:border-slate-900 rounded-[2.5rem] transition-all">
                            <FileText className="text-slate-900" size={24} />
                            <span className="font-black text-[10px] uppercase">Factura A4</span>
                        </button>
                    </div>

                    <button onClick={onClose} className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-xs flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl">
                        Nueva Venta <ArrowRight size={18} />
                    {warrantyPdfActive && hasImeiProducts && (
                        <button
                            onClick={handlePrintWarranty}
                            disabled={printingWarranty}
                            className="w-full py-3 px-4 rounded-lg shadow font-bold flex items-center justify-center transition-colors bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                        >
                            <Shield size={20} className="mr-2" />
                            {printingWarranty ? 'Generando...' : 'Imprimir Garantía'}
                        </button>
                    )}

                    <button
                        onClick={onClose}
                        className="w-full bg-white border-2 border-gray-200 text-gray-600 hover:bg-gray-50 font-bold py-3 px-4 rounded-lg transition-colors"
                    >
                        Cerrar y Nueva Venta
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SaleSuccessModal;
