import { useState, useEffect } from 'react';
import { Plus, Trash2, CreditCard, Check, X, AlertCircle } from 'lucide-react';
import apiClient from '../../config/axios';
import { useConfig } from '../../context/ConfigContext';

const PaymentMethodsConfig = () => {
    const { paymentMethods, refreshConfig } = useConfig(); // Refresh context after changes
    const [methods, setMethods] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newMethodName, setNewMethodName] = useState('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        fetchMethods();
    }, []);

    const fetchMethods = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/payment-methods');
            setMethods(response.data);
        } catch (error) {
            console.error('Error fetching payment methods:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleActive = async (method) => {
        try {
            // Optimistic update
            const updatedMethods = methods.map(m =>
                m.id === method.id ? { ...m, is_active: !m.is_active } : m
            );
            setMethods(updatedMethods);

            await apiClient.put(`/payment-methods/${method.id}`, {
                is_active: !method.is_active
            });
            refreshConfig(); // Refresh global context
        } catch (error) {
            console.error('Error updating status:', error);
            fetchMethods(); // Revert on error
            alert('Error al actualizar estado');
        }
    };

    const handleDelete = async (method) => {
        if (!confirm(`¿Estás seguro de eliminar el método "${method.name}"?`)) return;

        try {
            await apiClient.delete(`/payment-methods/${method.id}`);
            setMethods(methods.filter(m => m.id !== method.id));
            refreshConfig(); // Refresh global context
        } catch (error) {
            console.error('Error deleting method:', error);
            alert(error.response?.data?.detail || 'Error al eliminar');
        }
    };

    const handleAddMethod = async () => {
        if (!newMethodName.trim()) return;

        setProcessing(true);
        try {
            const response = await apiClient.post('/payment-methods', {
                name: newMethodName.trim(),
                is_active: true
            });
            setMethods([...methods, response.data]);
            setNewMethodName('');
            setShowAddModal(false);
            refreshConfig(); // Refresh global context
        } catch (error) {
            console.error('Error adding method:', error);
            alert(error.response?.data?.detail || 'Error al crear método');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden min-h-[600px] animate-fade-in">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Métodos de Pago</h2>
                    <p className="text-gray-500 text-sm">Administra los métodos de pago disponibles en caja.</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-sm font-medium flex items-center transition-all"
                >
                    <Plus size={18} className="mr-2" />
                    Nuevo Método
                </button>
            </div>

            <div className="p-6">
                {loading ? (
                    <div className="text-center py-10 text-gray-400">Cargando métodos...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {methods.map(method => (
                            <div
                                key={method.id}
                                className={`border rounded-xl p-4 transition-all ${method.is_active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200 opacity-70'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="bg-blue-50 p-2.5 rounded-lg text-blue-600">
                                        <CreditCard size={24} />
                                    </div>
                                    <div className="flex gap-2">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={method.is_active}
                                                onChange={() => handleToggleActive(method)}
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>

                                        {!method.is_system && (
                                            <button
                                                onClick={() => handleDelete(method)}
                                                className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <h3 className="font-bold text-gray-800 text-lg mb-1">{method.name}</h3>
                                    <div className="flex items-center gap-2">
                                        {method.is_system ? (
                                            <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Sistema</span>
                                        ) : (
                                            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 px-2 py-0.5 rounded">Personalizado</span>
                                        )}
                                        {method.is_active ? (
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Activo
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span> Inactivo
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal Agregar */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-gray-800 mb-4">Nuevo Método de Pago</h3>
                            <input
                                type="text"
                                className="w-full border p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                                placeholder="Nombre (ej. Binance)"
                                autoFocus
                                value={newMethodName}
                                onChange={e => setNewMethodName(e.target.value)}
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                Este método aparecerá inmediatamente en las opciones de pago.
                            </p>
                        </div>
                        <div className="bg-gray-50 p-4 flex gap-3">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 py-2.5 font-bold text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAddMethod}
                                disabled={!newMethodName.trim() || processing}
                                className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                                {processing ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaymentMethodsConfig;
