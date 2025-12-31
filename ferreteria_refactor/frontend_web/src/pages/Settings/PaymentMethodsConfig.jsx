import { useState, useEffect } from 'react';
import { Plus, Trash2, CreditCard, Check, X, AlertCircle, Wallet } from 'lucide-react';
import apiClient from '../../config/axios';
import { useConfig } from '../../context/ConfigContext';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';

const PaymentMethodsConfig = () => {
    const { refreshConfig } = useConfig(); // Refresh context after changes
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
            toast.error('Error al cargar métodos de pago');
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
            toast.success(`Método ${!method.is_active ? 'activado' : 'desactivado'}`);
        } catch (error) {
            console.error('Error updating status:', error);
            fetchMethods(); // Revert on error
            toast.error('Error al actualizar estado');
        }
    };

    const handleDelete = async (method) => {
        if (!confirm(`¿Estás seguro de eliminar el método "${method.name}"?`)) return;

        try {
            await apiClient.delete(`/payment-methods/${method.id}`);
            setMethods(methods.filter(m => m.id !== method.id));
            refreshConfig(); // Refresh global context
            toast.success('Método eliminado');
        } catch (error) {
            console.error('Error deleting method:', error);
            toast.error(error.response?.data?.detail || 'Error al eliminar');
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
            toast.success('Método de pago agregado');
        } catch (error) {
            console.error('Error adding method:', error);
            toast.error(error.response?.data?.detail || 'Error al crear método');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Wallet className="text-indigo-600" size={24} /> Métodos de Pago
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Administra las opciones de pago disponibles en el punto de venta</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-200 font-bold flex items-center transition-all active:scale-95"
                >
                    <Plus size={20} className="mr-2" />
                    Nuevo Método
                </button>
            </div>

            <div className="p-6 flex-1 bg-slate-50/30">
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
                        <p>Cargando métodos...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {methods.map(method => (
                            <div
                                key={method.id}
                                className={clsx(
                                    "border rounded-2xl p-5 transition-all relative overflow-hidden group hover:shadow-md",
                                    method.is_active
                                        ? 'bg-white border-slate-200'
                                        : 'bg-slate-50 border-slate-200 opacity-75'
                                )}
                            >
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div className={clsx(
                                        "p-3 rounded-xl transition-colors",
                                        method.is_active ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-400"
                                    )}>
                                        <CreditCard size={24} />
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={method.is_active}
                                                onChange={() => handleToggleActive(method)}
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                        </label>

                                        {!method.is_system && (
                                            <button
                                                onClick={() => handleDelete(method)}
                                                className="text-slate-400 hover:text-rose-500 p-1.5 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="relative z-10">
                                    <h3 className={clsx("font-bold text-lg mb-2", method.is_active ? "text-slate-800" : "text-slate-500")}>
                                        {method.name}
                                    </h3>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {method.is_system ? (
                                            <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 px-2.5 py-1 rounded-md border border-slate-200">
                                                Sistema
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-md border border-indigo-100">
                                                Personalizado
                                            </span>
                                        )}
                                        {method.is_active ? (
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Activo
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Inactivo
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
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Plus className="text-indigo-600" size={24} />
                                Nuevo Método
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Nombre</label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-800 transition-all placeholder:text-slate-400"
                                        placeholder="Ej. Zelle, Binance, Bitcoin..."
                                        autoFocus
                                        value={newMethodName}
                                        onChange={e => setNewMethodName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddMethod()}
                                    />
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex gap-3 text-xs text-slate-500">
                                    <AlertCircle size={16} className="text-indigo-500 shrink-0 mt-0.5" />
                                    <p>Este método aparecerá habilitado inmediatamente en la pantalla de cobro del POS.</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-50 p-4 flex gap-3 border-t border-slate-100">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 py-2.5 font-bold text-slate-600 hover:bg-slate-200 hover:text-slate-800 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAddMethod}
                                disabled={!newMethodName.trim() || processing}
                                className="flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200 active:scale-95"
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
