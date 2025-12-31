import { useState, useEffect } from 'react';
import { useCash } from '../context/CashContext';
import { useConfig } from '../context/ConfigContext';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, DollarSign, AlertCircle, TrendingUp, CreditCard } from 'lucide-react';
import apiClient from '../config/axios';

const CashClose = () => {
    const { isSessionOpen, session, closeSession } = useCash();
    const { getActiveCurrencies } = useConfig();
    const navigate = useNavigate();

    const [sessionData, setSessionData] = useState(null);
    const [physicalCounts, setPhysicalCounts] = useState({});
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isSessionOpen && session?.id) {
            // Only fetch if first load or session different from loaded data
            if (!sessionData || sessionData.id !== session.id) {
                fetchSessionData();
            }
        }
    }, [isSessionOpen, session?.id]);

    const fetchSessionData = async () => {
        try {
            // Get session details with calculations
            const response = await apiClient.get(`/cash/sessions/${session.id}/details`);
            setSessionData(response.data);

            // Initialize physical counts to 0
            const initialCounts = {};
            session.currencies?.forEach(curr => {
                initialCounts[curr.currency_symbol] = '';
            });
            setPhysicalCounts(initialCounts);
        } catch (error) {
            console.error('Error fetching session data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isSessionOpen) {
        return (
            <div className="p-10 text-center">
                <h2 className="text-xl">Caja Cerrada</h2>
                <button
                    onClick={() => navigate('/pos')}
                    className="mt-4 text-blue-600 underline"
                >
                    Ir a Abrir Caja en POS
                </button>
            </div>
        );
    }

    if (loading || !sessionData) {
        return <div className="p-10 text-center">Cargando datos de sesión...</div>;
    }

    const { expected_by_currency = {}, details = {} } = sessionData;
    const { cash_by_currency = {}, transfers_by_currency = {} } = details;

    const handleClose = async () => {
        // Validate all currencies have been counted
        const allCounted = session.currencies?.every(curr =>
            physicalCounts[curr.currency_symbol] !== ''
        );

        if (!allCounted) {
            return alert("Por favor ingresa el conteo para todas las monedas");
        }

        if (window.confirm("¿Seguro que deseas cerrar el turno? Esto generará el Reporte Z.")) {
            // Build currencies array with correct format
            const currenciesData = session.currencies?.map(curr => ({
                currency_symbol: curr.currency_symbol,
                final_reported: parseFloat(physicalCounts[curr.currency_symbol]) || 0
            })) || [];

            const closeData = {
                final_cash_reported: parseFloat(physicalCounts['USD']) || 0,
                final_cash_reported_bs: parseFloat(physicalCounts['Bs']) || 0,
                currencies: currenciesData
            };

            console.log('Closing session with data:', closeData);

            const success = await closeSession(closeData);
            if (success) {
                alert("Caja Cerrada Exitosamente");
                navigate('/');
            }
        }
    };

    const getDifference = (symbol) => {
        const expected = expected_by_currency[symbol] || 0;
        const counted = parseFloat(physicalCounts[symbol]) || 0;
        return counted - expected;
    };

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="flex items-center space-x-3 mb-8">
                <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                    <ClipboardCheck size={32} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Cierre de Caja (Arqueo)</h1>
                    <p className="text-gray-500">Verifica los montos antes de generar el Reporte Z</p>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
                {/* EFECTIVO - Physical Cash Count */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center mb-4 border-b pb-2">
                        <DollarSign className="mr-2 text-green-600" />
                        <h3 className="text-lg font-bold text-gray-700">EFECTIVO (Caja Física)</h3>
                    </div>

                    <div className="space-y-4">
                        {session.currencies?.map(curr => {
                            const expected = expected_by_currency[curr.currency_symbol] || 0;
                            const counted = physicalCounts[curr.currency_symbol];
                            const diff = counted !== '' ? getDifference(curr.currency_symbol) : null;

                            return (
                                <div key={curr.currency_symbol} className="border rounded-lg p-4 bg-gray-50">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-bold text-gray-800">{curr.currency_symbol}</span>
                                        <span className="text-sm text-gray-600">
                                            Esperado: {Number(expected).toFixed(2)}
                                        </span>
                                    </div>

                                    <div className="relative mb-2">
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full p-3 border-2 border-blue-100 focus:border-blue-500 rounded-lg text-xl font-bold text-gray-800 outline-none"
                                            value={counted}
                                            onChange={(e) => setPhysicalCounts({
                                                ...physicalCounts,
                                                [curr.currency_symbol]: e.target.value
                                            })}
                                            placeholder="Contado..."
                                        />
                                    </div>

                                    {diff !== null && (
                                        <div className={`text-sm font-medium ${Math.abs(diff) < 0.01 ? 'text-green-600' :
                                            diff > 0 ? 'text-blue-600' : 'text-red-600'
                                            }`}>
                                            Diferencia: {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                                            {Math.abs(diff) < 0.01 ? ' ✓ Cuadra' :
                                                diff > 0 ? ' (Sobra)' : ' (Falta)'}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* TRANSFERENCIAS - Informational Only */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center mb-4 border-b pb-2">
                        <CreditCard className="mr-2 text-blue-600" />
                        <h3 className="text-lg font-bold text-gray-700">TRANSFERENCIAS (Informativo)</h3>
                    </div>

                    <p className="text-sm text-gray-500 mb-4">
                        Estos montos no requieren conteo físico, solo se muestran para tu información.
                    </p>

                    <div className="space-y-3">
                        {Object.keys(transfers_by_currency).length === 0 ? (
                            <p className="text-gray-400 italic">No hay transferencias registradas</p>
                        ) : (
                            Object.entries(transfers_by_currency).map(([currency, methods]) => (
                                <div key={currency} className="border-l-4 border-blue-400 pl-3">
                                    <div className="font-bold text-gray-700 mb-2">{currency}</div>
                                    {Object.entries(methods).map(([method, amount]) => (
                                        <div key={method} className="flex justify-between text-sm mb-1">
                                            <span className="text-gray-600">{method}</span>
                                            <span className="font-medium">{Number(amount).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Notes and Close Button */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notas del Cierre</label>
                    <textarea
                        className="w-full border rounded p-2"
                        rows="2"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Observaciones o comentarios sobre el cierre..."
                    ></textarea>
                </div>

                <button
                    onClick={handleClose}
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-lg shadow transition-colors"
                >
                    Cerrar Turno e Imprimir Reporte Z
                </button>
            </div>
        </div>
    );
};

export default CashClose;
