import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Package } from 'lucide-react';
import apiClient from '../../config/axios';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';

const InventoryValuationCard = () => {
    const { user } = useAuth();
    const { formatCurrency, getExchangeRate } = useConfig();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    // Only allow ADMIN to see this component
    if (user?.role !== 'ADMIN') {
        return null;
    }

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Get current exchange rate
                const rate = getExchangeRate('USD', 'Bs');
                const response = await apiClient.get('/reports/inventory-valuation', {
                    params: { exchange_rate: rate }
                });
                setData(response.data);
            } catch (error) {
                console.error("Error fetching valuation:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [getExchangeRate]);

    if (loading) return null;
    if (!data) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 animate-fade-in-up">
            {/* CARD 1: Total Cost (Investment) */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Inversión Total (Costo)</p>
                    <h3 className="text-2xl font-bold text-gray-800">
                        ${data.total_cost_usd.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                        Costo de mercancía en stock
                    </p>
                </div>
                <div className="bg-blue-50 p-3 rounded-full text-blue-600">
                    <Package size={24} />
                </div>
            </div>

            {/* CARD 2: Potential Revenue (Sales Value) */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Valor de Venta Realizable</p>
                    <h3 className="text-2xl font-bold text-gray-800">
                        ${data.total_revenue_usd.toLocaleString('es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                    <p className="text-xs text-green-600 font-medium mt-1 flex items-center">
                        <TrendingUp size={12} className="mr-1" />
                        Ganancia pot.: ${data.potential_profit_usd.toLocaleString('es-US', { minimumFractionDigits: 2 })}
                    </p>
                </div>
                <div className="bg-green-50 p-3 rounded-full text-green-600">
                    <DollarSign size={24} />
                </div>
            </div>

            {/* CARD 3: Margin */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Margen Global Estimado</p>
                    <h3 className="text-2xl font-bold text-gray-800">
                        {data.margin_percent.toFixed(1)}%
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                        Rentabilidad promedio del inventario
                    </p>
                </div>
                <div className="bg-purple-50 p-3 rounded-full text-purple-600">
                    <TrendingUp size={24} />
                </div>
            </div>
        </div>
    );
};

export default InventoryValuationCard;
