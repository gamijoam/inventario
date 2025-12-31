import React from 'react';
import { X, Calendar, Hash, DollarSign, TrendingUp, User, Package } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';

/**
 * InvoiceDetailModal Component
 * Shows detailed invoice information including products and conversion
 */
const InvoiceDetailModal = ({ isOpen, onClose, sale }) => {
    const { currencies } = useConfig();

    if (!isOpen || !sale) return null;

    // Get current exchange rates
    const localCurrency = currencies.find(c => c.code === 'VES' || c.code === 'BS') || null;

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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Hash className="text-indigo-600" size={24} />
                            Factura #{sale.id}
                        </h2>
                        <p className="text-sm text-slate-500 mt-1 flex items-center gap-2 font-medium">
                            <Calendar size={16} />
                            {formattedDate}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    {/* Customer Info */}
                    {sale.customer && (
                        <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-4">
                            <div className="bg-white p-2.5 rounded-lg text-slate-400 shadow-sm border border-slate-100">
                                <User size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Cliente</p>
                                <p className="text-lg font-bold text-slate-800">{sale.customer.name}</p>
                                <p className="text-sm text-slate-500 font-mono">{sale.customer.id_number || 'Sin ID'}</p>
                            </div>
                        </div>
                    )}

                    {/* Items Table */}
                    <div className="mb-6">
                        <h3 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wide flex items-center gap-2">
                            <Package size={16} /> Productos
                        </h3>
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <table className="w-full border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="text-left p-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Cant.</th>
                                        <th className="text-left p-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Producto</th>
                                        <th className="text-right p-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Precio Unit.</th>
                                        <th className="text-right p-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {sale.details && sale.details.length > 0 ? (
                                        sale.details.map((detail, index) => (
                                            <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-3 text-sm font-medium text-slate-600 text-center">
                                                    {parseFloat(detail.quantity)}
                                                </td>
                                                <td className="p-3 text-sm font-medium text-slate-800">
                                                    {detail.product?.name || 'Producto desconocido'}
                                                </td>
                                                <td className="p-3 text-sm font-medium text-slate-600 text-right">
                                                    ${parseFloat(detail.unit_price).toFixed(2)}
                                                </td>
                                                <td className="p-3 text-sm font-bold text-slate-800 text-right">
                                                    ${parseFloat(detail.subtotal).toFixed(2)}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="4" className="p-8 text-center text-slate-400">
                                                No hay productos en esta factura
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Total Section */}
                    <div className="flex flex-col items-end border-t border-slate-100 pt-6 mb-6">
                        <div className="text-right">
                            <span className="text-sm font-medium text-slate-500 block mb-1">Total Deuda (USD)</span>
                            <span className="text-4xl font-black text-slate-800 flex items-center justify-end gap-1 tracking-tight">
                                <span className="text-lg text-slate-400 font-bold self-start mt-2">$</span>
                                {parseFloat(sale.total_amount).toFixed(2)}
                            </span>
                        </div>
                    </div>

                    {/* Currency Conversion Section */}
                    {localCurrency && (
                        <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-100 relative overflow-hidden">
                            <div className="absolute right-0 top-0 p-4 opacity-5">
                                <TrendingUp size={100} />
                            </div>
                            <div className="relative z-10">
                                <h4 className="text-sm font-bold text-emerald-800 mb-4 flex items-center gap-2 uppercase tracking-wide">
                                    <TrendingUp size={18} />
                                    Conversión al Día
                                </h4>
                                <div className="flex justify-between items-end border-t border-emerald-200/50 pt-4">
                                    <div>
                                        <p className="text-xs font-medium text-emerald-600 mb-1">Tasa actual ({localCurrency.code})</p>
                                        <p className="text-sm font-bold text-emerald-700">{localCurrency.symbol} {parseFloat(currentLocalRate).toFixed(2)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-medium text-emerald-600 mb-1">Total en {localCurrency.name}</p>
                                        <p className="text-2xl font-black text-emerald-700 tracking-tight">
                                            {localCurrency.symbol} {totalInLocal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
                    >
                        Cerrar Detalle
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InvoiceDetailModal;
