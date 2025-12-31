import React from 'react';
import { X, Calendar, Hash, DollarSign, TrendingUp } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';

/**
 * InvoiceDetailModal Component
 * Shows detailed invoice information including products and currency conversion
 */
const InvoiceDetailModal = ({ isOpen, onClose, sale }) => {
    const { currencies } = useConfig();

    if (!isOpen || !sale) return null;

    // Get current exchange rates
    const anchorCurrency = currencies.find(c => c.is_anchor) || { symbol: '$', code: 'USD' };
    const localCurrency = currencies.find(c => c.code === 'BS') || null;

    // Calculate conversion to local currency with CURRENT rate
    const currentLocalRate = localCurrency?.rate || 1;
    const totalInLocal = sale.total_amount * currentLocalRate;

    // Format date
    const saleDate = new Date(sale.date);
    const formattedDate = saleDate.toLocaleDateString('es-VE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <Hash className="text-blue-600" size={24} />
                            Factura #{sale.id}
                        </h2>
                        <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                            <Calendar size={16} />
                            {formattedDate}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/50 rounded-full transition-colors text-gray-600 hover:text-gray-800"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {/* Customer Info */}
                    {sale.customer && (
                        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-600">Cliente</p>
                            <p className="text-lg font-semibold text-gray-800">{sale.customer.name}</p>
                        </div>
                    )}

                    {/* Items Table */}
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">Productos</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-100 border-b-2 border-gray-300">
                                        <th className="text-left p-3 text-sm font-semibold text-gray-700">Cant.</th>
                                        <th className="text-left p-3 text-sm font-semibold text-gray-700">Producto</th>
                                        <th className="text-right p-3 text-sm font-semibold text-gray-700">Precio Unit.</th>
                                        <th className="text-right p-3 text-sm font-semibold text-gray-700">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sale.details && sale.details.length > 0 ? (
                                        sale.details.map((detail, index) => (
                                            <tr key={index} className="border-b hover:bg-gray-50">
                                                <td className="p-3 text-sm text-gray-800">
                                                    {parseFloat(detail.quantity).toFixed(2)}
                                                </td>
                                                <td className="p-3 text-sm text-gray-800">
                                                    {detail.product?.name || 'Producto desconocido'}
                                                </td>
                                                <td className="p-3 text-sm text-gray-800 text-right">
                                                    ${parseFloat(detail.unit_price).toFixed(2)}
                                                </td>
                                                <td className="p-3 text-sm font-medium text-gray-800 text-right">
                                                    ${parseFloat(detail.subtotal).toFixed(2)}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="4" className="p-6 text-center text-gray-500">
                                                No hay productos en esta factura
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Total Section */}
                    <div className="border-t-2 border-gray-300 pt-4 mb-6">
                        <div className="flex justify-between items-center">
                            <span className="text-xl font-semibold text-gray-700">Total Deuda:</span>
                            <span className="text-3xl font-bold text-blue-600 flex items-center gap-2">
                                <DollarSign size={28} />
                                {parseFloat(sale.total_amount).toFixed(2)} USD
                            </span>
                        </div>
                    </div>

                    {/* Currency Conversion Section */}
                    {localCurrency && (
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-5 border border-green-200">
                            <h4 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                                <TrendingUp size={18} />
                                Conversión al Día
                            </h4>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-700">
                                        Tasa actual ({localCurrency.code}):
                                    </span>
                                    <span className="text-sm font-semibold text-gray-800">
                                        {localCurrency.symbol} {parseFloat(currentLocalRate).toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-green-200">
                                    <span className="text-base font-semibold text-gray-800">
                                        Total en {localCurrency.name}:
                                    </span>
                                    <span className="text-2xl font-bold text-green-700">
                                        {localCurrency.symbol} {totalInLocal.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs text-green-700 mt-3 italic">
                                * Conversión con tasa de cambio actual, no la histórica de la venta
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InvoiceDetailModal;
