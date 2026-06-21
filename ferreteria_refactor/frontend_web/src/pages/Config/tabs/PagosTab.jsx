import { useState, useEffect } from 'react';
import { Plus, Trash2, CreditCard, AlertCircle, Wallet } from 'lucide-react';
import apiClient from '../../../config/axios';
import { useConfig } from '../../../context/ConfigContext';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';
import { getApiErrorMessage } from '../../../utils/apiErrors';

const CURRENCY_OPTIONS = [
    { value: 'FLEX', label: 'Flexible' },
    { value: 'USD', label: 'USD' },
    { value: 'VES', label: 'Bs / VES' },
];

const PagosTab = () => {
    const { refreshConfig } = useConfig();
    const [methods, setMethods] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newMethodName, setNewMethodName] = useState('');
    const [newMethodRequiresReference, setNewMethodRequiresReference] = useState(false);
    const [newMethodCurrencyCode, setNewMethodCurrencyCode] = useState('FLEX');
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
            toast.error(getApiErrorMessage(error, 'No se pudieron cargar los metodos de pago'));
        } finally {
            setLoading(false);
        }
    };

    const handleToggleActive = async (method) => {
        try {
            const updatedMethods = methods.map(m =>
                m.id === method.id ? { ...m, is_active: !m.is_active } : m
            );
            setMethods(updatedMethods);

            await apiClient.put(`/payment-methods/${method.id}`, {
                is_active: !method.is_active
            });
            refreshConfig();
            toast.success(`Método ${!method.is_active ? 'activado' : 'desactivado'}`);
        } catch (error) {
            console.error('Error toggling method:', error);
            fetchMethods();
            toast.error(getApiErrorMessage(error, 'No se pudo actualizar el metodo de pago'));
        }
    };

    const handleToggleRequiresReference = async (method) => {
        try {
            const updatedMethods = methods.map(m =>
                m.id === method.id ? { ...m, requires_reference: !m.requires_reference } : m
            );
            setMethods(updatedMethods);
            await apiClient.put(`/payment-methods/${method.id}`, {
                requires_reference: !method.requires_reference
            });
            refreshConfig();
            toast.success(`Referencia ${!method.requires_reference ? 'activada' : 'desactivada'}`);
        } catch (error) {
            console.error('Error updating reference requirement:', error);
            fetchMethods();
            toast.error(getApiErrorMessage(error, 'No se pudo actualizar la configuracion del metodo'));
        }
    };

    const handleToggleExternalFinancer = async (method) => {
        try {
            const updatedMethods = methods.map(m =>
                m.id === method.id ? { ...m, is_external_financer: !m.is_external_financer } : m
            );
            setMethods(updatedMethods);
            await apiClient.put(`/payment-methods/${method.id}`, {
                is_external_financer: !method.is_external_financer
            });
            refreshConfig();
            toast.success(`Financiadora externa ${!method.is_external_financer ? 'activada' : 'desactivada'}`);
        } catch (error) {
            console.error('Error updating external financer:', error);
            fetchMethods();
            toast.error(getApiErrorMessage(error, 'No se pudo actualizar la configuracion del metodo'));
        }
    };

    const handleChangeCurrency = async (method, currencyCode) => {
        try {
            setMethods(prev => prev.map(m => m.id === method.id ? { ...m, currency_code: currencyCode, currency: currencyCode } : m));
            await apiClient.put(`/payment-methods/${method.id}`, { currency_code: currencyCode });
            refreshConfig();
            toast.success('Moneda del metodo actualizada');
        } catch (error) {
            fetchMethods();
            toast.error(getApiErrorMessage(error, 'No se pudo actualizar la moneda del metodo'));
        }
    };

    const handleDelete = async (method) => {
        if (!confirm(`¿Eliminar el método "${method.name}"?`)) return;
        try {
            await apiClient.delete(`/payment-methods/${method.id}`);
            fetchMethods();
            refreshConfig();
            toast.success('Método eliminado');
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'No se pudo eliminar el metodo de pago'));
        }
    };

    const handleAddMethod = async () => {
        if (!newMethodName.trim()) return;

        setProcessing(true);
        try {
            const response = await apiClient.post('/payment-methods', {
                name: newMethodName.trim(),
                is_active: true,
                requires_reference: newMethodRequiresReference,
                currency_code: newMethodCurrencyCode
            });
            setMethods([...methods, response.data]);
            setNewMethodName('');
            setNewMethodRequiresReference(false);
            setNewMethodCurrencyCode('FLEX');
            setShowAddModal(false);
            refreshConfig();
            toast.success('Método de pago agregado');
        } catch (error) {
            console.error('Error adding method:', error);
            toast.error(getApiErrorMessage(error, 'No se pudo crear el metodo de pago'));
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 bg-white p-5 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
                        <Wallet className="text-indigo-600" size={22} /> Métodos de Pago
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">Administra las formas de cobro disponibles en el POS</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 active:scale-[0.98]"
                >
                    <Plus size={18} />
                    Nuevo Método
                </button>
            </div>

            <div className="bg-slate-50/50 p-4 sm:p-5">
                {loading ? (
                    <div className="flex h-64 flex-col items-center justify-center text-slate-400">
                        <div className="mb-4 h-9 w-9 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
                        <p className="text-sm font-medium">Cargando métodos...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                        {methods.map(method => (
                            <div
                                key={method.id}
                                className={clsx(
                                    "group rounded-lg border bg-white p-4 shadow-sm transition-colors hover:border-indigo-200",
                                    method.is_active ? 'border-slate-200' : 'border-slate-200 opacity-70'
                                )}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={clsx(
                                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
                                        method.is_active ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-400"
                                    )}>
                                        <CreditCard size={20} />
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className={clsx("truncate text-base font-black", method.is_active ? "text-slate-900" : "text-slate-500")}>
                                                {method.name}
                                            </h3>
                                            {method.is_system ? (
                                                <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                                                    Sistema
                                                </span>
                                            ) : (
                                                <span className="rounded-md border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-600">
                                                    Personalizado
                                                </span>
                                            )}
                                        </div>

                                        <div className="mt-3 grid gap-2 sm:grid-cols-4">
                                            <label className="flex h-9 items-center justify-between gap-2 rounded-md border border-indigo-100 bg-indigo-50/50 px-3">
                                                <span className="text-xs font-bold text-indigo-700">Moneda POS</span>
                                                <select
                                                    value={method.currency_code || method.currency || 'FLEX'}
                                                    onChange={(e) => handleChangeCurrency(method, e.target.value)}
                                                    className="max-w-[92px] bg-transparent text-xs font-black text-indigo-700 outline-none"
                                                >
                                                    {CURRENCY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                </select>
                                            </label>

                                            <label className="flex h-9 cursor-pointer items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 transition-colors hover:bg-slate-50">
                                                <span className="text-xs font-bold text-slate-600">Activo</span>
                                                <span className="relative inline-flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={method.is_active}
                                                        onChange={() => handleToggleActive(method)}
                                                    />
                                                    <span className="h-5 w-9 rounded-full bg-slate-200 transition-colors peer-checked:bg-indigo-600" />
                                                    <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full border border-slate-300 bg-white transition-transform peer-checked:translate-x-4 peer-checked:border-white" />
                                                </span>
                                            </label>

                                            <label className="flex h-9 cursor-pointer items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 transition-colors hover:bg-slate-50">
                                                <span className={clsx("text-xs font-bold", method.requires_reference ? "text-emerald-700" : "text-slate-500")}>
                                                    Referencia
                                                </span>
                                                <span className="relative inline-flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={method.requires_reference || false}
                                                        onChange={() => handleToggleRequiresReference(method)}
                                                    />
                                                    <span className="h-5 w-9 rounded-full bg-slate-200 transition-colors peer-checked:bg-emerald-500" />
                                                    <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full border border-slate-300 bg-white transition-transform peer-checked:translate-x-4 peer-checked:border-white" />
                                                </span>
                                            </label>

                                            <label className="flex h-9 cursor-pointer items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 transition-colors hover:bg-slate-50">
                                                <span className={clsx("text-xs font-bold", method.is_external_financer ? "text-indigo-700" : "text-slate-500")}>
                                                    Financiadora
                                                </span>
                                                <span className="relative inline-flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={method.is_external_financer || false}
                                                        onChange={() => handleToggleExternalFinancer(method)}
                                                    />
                                                    <span className="h-5 w-9 rounded-full bg-slate-200 transition-colors peer-checked:bg-indigo-500" />
                                                    <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full border border-slate-300 bg-white transition-transform peer-checked:translate-x-4 peer-checked:border-white" />
                                                </span>
                                            </label>
                                        </div>
                                    </div>

                                    {!method.is_system && (
                                        <button
                                            onClick={() => handleDelete(method)}
                                            className="rounded-md p-2 text-slate-400 opacity-100 transition-colors hover:bg-rose-50 hover:text-rose-600 md:opacity-0 md:group-hover:opacity-100"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={17} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal Agregar */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-xl animate-in zoom-in-95 duration-200">
                        <div className="p-5">
                            <h3 className="mb-4 flex items-center gap-2 text-xl font-black text-slate-900">
                                <Plus className="text-indigo-600" size={22} />
                                Nuevo Método
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="mb-1 block text-sm font-bold text-slate-700">Nombre</label>
                                    <input
                                        type="text"
                                        className="h-11 w-full rounded-md border border-slate-200 px-3 font-medium text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                        placeholder="Ej. Zelle, Binance, Bitcoin..."
                                        autoFocus
                                        value={newMethodName}
                                        onChange={e => setNewMethodName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddMethod()}
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-bold text-slate-700">Moneda del método</label>
                                    <select
                                        value={newMethodCurrencyCode}
                                        onChange={e => setNewMethodCurrencyCode(e.target.value)}
                                        className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                    >
                                        {CURRENCY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                    </select>
                                    <p className="mt-1 text-xs text-slate-400">Flexible acepta USD y Bs. Usa USD/VES para filtrar en el POS.</p>
                                </div>

                                <label className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 transition-colors hover:border-indigo-200 hover:bg-white">
                                    <input
                                        type="checkbox"
                                        className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        checked={newMethodRequiresReference}
                                        onChange={e => setNewMethodRequiresReference(e.target.checked)}
                                    />
                                    <div>
                                        <div className="text-sm font-bold text-slate-700">Exigir Referencia</div>
                                        <div className="text-xs text-slate-400">El cajero debe ingresar número de comprobante</div>
                                    </div>
                                </label>

                                <div className="flex gap-3 rounded-md border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-700">
                                    <AlertCircle size={16} className="mt-0.5 shrink-0 text-indigo-500" />
                                    <p>Este método aparecerá habilitado inmediatamente en la pantalla de cobro.</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 border-t border-slate-100 bg-slate-50 p-4">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 rounded-md py-2.5 font-bold text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-800"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAddMethod}
                                disabled={!newMethodName.trim() || processing}
                                className="flex-1 rounded-md bg-indigo-600 py-2.5 font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
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

export default PagosTab;
