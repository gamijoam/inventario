import { useState } from 'react';
import { CheckCircle, Printer, FileText } from 'lucide-react';
import printerService from '../../services/printerService';
import toast from 'react-hot-toast';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { useConfig } from '../../context/ConfigContext';
import { printFacturaA4 } from './FacturaA4';

const SaleSuccessModal = ({ isOpen, onClose, saleData }) => {
    const [printing, setPrinting] = useState(false);
    const [printStatus, setPrintStatus] = useState(null); // 'success' | 'error'
    const facturaA4Active = useFeatureFlag('impresion_factura_a4');
    const { business } = useConfig();

    if (!isOpen || !saleData) return null;

    const handlePrint = async () => {
        setPrinting(true);
        setPrintStatus(null);
        try {
            if (!saleData.saleId) {
                throw new Error("No se encontró ID de venta para imprimir");
            }
            const result = await printerService.printTicket(saleData.saleId);
            setPrintStatus('success');
        } catch (error) {
            setPrintStatus('error');
            toast.error(error.message);
        } finally {
            setPrinting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8 text-center animate-in fade-in zoom-in duration-200">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle size={48} className="text-green-600" />
                </div>

                <h2 className="text-3xl font-bold text-gray-800 mb-2">¡Venta Exitosa!</h2>
                <p className="text-gray-500 mb-8">La transacción se ha registrado correctamente.</p>

                <div className="bg-gray-50 p-4 rounded-lg mb-8 border border-gray-200">
                    <div className="flex justify-between mb-2">
                        <span className="text-gray-600">Total Pagado:</span>
                        {/* Dynamic Currency Display */}
                        {(() => {
                            const payments = saleData.paymentData?.payments || [];
                            const isMixed = payments.length > 1;
                            // Check if single payment in alternate currency (e.g. Bs aka VES)
                            const singlePayment = !isMixed && payments[0];
                            const currencySymbol = singlePayment ? (singlePayment.currency === "USD" ? "$" : singlePayment.currency) : "$";

                            // If single payment in Bs, show that amount. Else show Total USD.
                            let displayAmount = saleData.totalUSD;
                            if (singlePayment && singlePayment.currency !== "USD" && singlePayment.currency !== "$") {
                                // Assuming singlePayment.amount is the amount in that currency
                                displayAmount = singlePayment.amount;
                            }

                            return (
                                <span className="font-bold text-gray-800">
                                    {isMixed ? "Mixto (Ver Detalle)" : `${currencySymbol}${Number(displayAmount).toFixed(2)}`}
                                    {isMixed && <span className="block text-xs text-right text-gray-500">${saleData.totalUSD.toFixed(2)}</span>}
                                </span>
                            );
                        })()}
                    </div>
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

                    {facturaA4Active && (
                        <button
                            onClick={() => printFacturaA4(saleData, business)}
                            className="w-full py-3 px-4 rounded-lg shadow font-bold flex items-center justify-center transition-colors bg-orange-500 hover:bg-orange-600 text-white"
                        >
                            <FileText size={20} className="mr-2" />
                            Imprimir Factura A4
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
