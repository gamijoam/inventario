import React, { useState, useEffect } from 'react';
import { X, DollarSign, Save, RefreshCw } from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import { useConfig } from '../../context/ConfigContext';

const ExchangeRateUpdateModal = ({ isOpen, onClose }) => {
    const { currencies, refreshConfig } = useConfig();
    const [rates, setRates] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && currencies.length > 0) {
            // Filter only active non-anchor currencies (usually the ones we update against USD)
            setRates(currencies.filter(c => !c.is_anchor && c.is_active));
        }
    }, [isOpen, currencies]);

    const handleRateChange = (id, value) => {
        setRates(prev => prev.map(r => r.id === id ? { ...r, rate: value } : r));
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            // Update each changed rate
            // In a real app, maybe a batch endpoint is better, but loop is fine for 1-2 items.
            for (const rate of rates) {
                // Find original to compare? Or just update all? Just update.
                await apiClient.put(`/config/exchange-rates/${rate.id}`, {
                    rate: parseFloat(rate.rate)
                });
            }
            toast.success("Tasas actualizadas");
            refreshConfig(); // Refresh context
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar tasas");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <RefreshCw size={18} className="text-indigo-600" />
                        Actualizar Tasas de Cambio
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-rose-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-500 mb-2">
                        Ingrese el nuevo valor para las monedas secundarias respecto a la moneda base (USD).
                    </p>

                    {rates.map(currency => (
                        <div key={currency.id} className="space-y-1">
                            <label className="text-xs font-bold text-gray-700 uppercase">
                                Tasa {currency.symbol} ({currency.name})
                            </label>
                            <div className="relative">
                                <DollarSign size={16} className="absolute left-3 top-3 text-gray-400" />
                                <input
                                    type="number"
                                    step="0.01"
                                    className="w-full pl-9 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-lg font-bold text-gray-800"
                                    value={currency.rate}
                                    onChange={(e) => handleRateChange(currency.id, e.target.value)}
                                />
                            </div>
                        </div>
                    ))}

                    {rates.length === 0 && (
                        <div className="text-center py-4 text-gray-400 italic">
                            No hay tasas configurables disponibles.
                        </div>
                    )}
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-bold transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-all"
                    >
                        {loading ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                        Guardar Cambios
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExchangeRateUpdateModal;
