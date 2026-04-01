import { useState, useEffect } from 'react';
import { Plus, Trash2, Coins, Star, RefreshCw, AlertCircle, Clock, Globe, ArrowRight, Landmark } from 'lucide-react';
import apiClient from '../../../config/axios';
import { useConfig } from '../../../context/ConfigContext';
import { toast } from 'react-hot-toast';
import { cn } from '../../../lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../../../components/ui/card';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const PREDEFINED_CURRENCIES = [
    { code: 'USD', symbol: '$', name: 'Dólar Americano' },
    { code: 'VES', symbol: 'Bs', name: 'Bolívares' },
    { code: 'COP', symbol: 'COP', name: 'Peso Colombiano' },
    { code: 'EUR', symbol: '€', name: 'Euro' }
];

const MonedasTab = () => {
    const { refreshConfig } = useConfig();
    const [exchangeRates, setExchangeRates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedCurrency, setSelectedCurrency] = useState('VES');
    const [showAddRateModal, setShowAddRateModal] = useState(false);
    const [newRate, setNewRate] = useState({ name: '', rate: '', source: 'Manual' });
    const [processing, setProcessing] = useState(false);
    const [bcvRates, setBcvRates] = useState(null);
    const [bcvLoading, setBcvLoading] = useState(false);
    const [bcvApplying, setBcvApplying] = useState(false);

    useEffect(() => {
        fetchExchangeRates();
    }, []);

    const fetchExchangeRates = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/config/exchange-rates');
            setExchangeRates(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching exchange rates:', error);
            toast.error('Error al cargar tasas de cambio');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateRate = async (rateId, field, value) => {
        try {
            await apiClient.put(`/config/exchange-rates/${rateId}`, { [field]: value });
            fetchExchangeRates();
            refreshConfig();
            toast.success('Tasa actualizada');
        } catch (error) {
            toast.error('Error al actualizar tasa');
        }
    };

    const handleDeleteRate = async (rateId) => {
        if (!confirm('¿Eliminar esta tasa?')) return;
        try {
            await apiClient.delete(`/config/exchange-rates/${rateId}`);
            fetchExchangeRates();
            refreshConfig();
            toast.success('Tasa eliminada');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Error al eliminar tasa');
        }
    };

    const handleAddRate = async () => {
        if (!newRate.name || !newRate.rate) {
            toast.error('Completa los campos obligatorios');
            return;
        }
        setProcessing(true);
        try {
            const predefined = PREDEFINED_CURRENCIES.find(c => c.code === selectedCurrency);
            await apiClient.post('/config/exchange-rates', {
                name: newRate.name,
                currency_code: selectedCurrency,
                currency_symbol: predefined?.symbol || 'Bs',
                rate: parseFloat(newRate.rate),
                is_default: false,
                is_active: true
            });
            setShowAddRateModal(false);
            setNewRate({ name: '', rate: '', source: 'Manual' });
            fetchExchangeRates();
            refreshConfig();
            toast.success('Nueva tasa registrada');
        } catch (error) {
            toast.error('Error al crear tasa');
        } finally {
            setProcessing(false);
        }
    };

    const fetchBcvRates = async () => {
        setBcvLoading(true);
        try {
            const res = await apiClient.get('/config/exchange-rates/bcv');
            setBcvRates(res.data);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'No se pudo consultar el BCV. Intenta más tarde.');
        } finally {
            setBcvLoading(false);
        }
    };

    const handleApplyBcvRate = async (bcvValue, label) => {
        if (!bcvValue) {
            toast.error(`Tasa ${label} no disponible del BCV`);
            return;
        }
        const targetRate = activeCurrencyRates.find(r => r.is_default) || activeCurrencyRates[0];
        if (!targetRate) {
            toast.error(`No hay tasas en ${selectedCurrency}. Crea una primero.`);
            return;
        }
        setBcvApplying(true);
        try {
            await apiClient.put(`/config/exchange-rates/${targetRate.id}`, { rate: bcvValue });
            await fetchExchangeRates();
            refreshConfig();
            toast.success(`"${targetRate.name}" actualizada a ${bcvValue.toLocaleString('es-VE', { minimumFractionDigits: 4 })} ${selectedCurrency}`);
        } catch {
            toast.error('Error al aplicar la tasa');
        } finally {
            setBcvApplying(false);
        }
    };

    const groupedRates = exchangeRates.reduce((acc, rate) => {
        if (!acc[rate.currency_code]) acc[rate.currency_code] = [];
        acc[rate.currency_code].push(rate);
        return acc;
    }, {});

    const activeCurrencyRates = groupedRates[selectedCurrency] || [];
    const defaultRate = activeCurrencyRates.find(r => r.is_default);

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        try {
            return format(new Date(dateStr), "d 'de' MMMM, HH:mm", { locale: es });
        } catch (e) {
            return dateStr;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Currency Selector Bar */}
            <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-fit">
                {PREDEFINED_CURRENCIES.filter(c => c.code !== 'USD').map(curr => (
                    <button
                        key={curr.code}
                        onClick={() => setSelectedCurrency(curr.code)}
                        className={cn(
                            "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                            selectedCurrency === curr.code
                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100"
                                : "text-slate-500 hover:bg-slate-50"
                        )}
                    >
                        <Globe size={16} />
                        {curr.code}
                    </button>
                ))}
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Status & Quick Info */}
                <Card className="lg:col-span-1 border-slate-200 shadow-sm overflow-hidden h-fit sticky top-20">
                    <div className="p-1 bg-indigo-600"></div>
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                                <Coins size={24} />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Tasa Activa</CardTitle>
                                <CardDescription>{selectedCurrency} / USD</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 text-center">
                            <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2">Valor activo</p>
                            <div className="flex items-center justify-center gap-3">
                                <span className="text-3xl font-black text-slate-900">
                                    {defaultRate ? parseFloat(defaultRate.rate).toLocaleString('es-VE') : '---'}
                                </span>
                                <span className="text-sm font-bold text-slate-500">{selectedCurrency}</span>
                            </div>
                            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-indigo-600 font-bold bg-white py-2 rounded-lg shadow-sm">
                                <Globe size={12} />
                                Fuente: {defaultRate?.name || 'Ninguna'}
                            </div>
                        </div>

                        <div className="flex justify-between text-xs">
                            <span className="text-slate-400 font-bold">Último cambio</span>
                            <span className="text-slate-700 font-bold">{formatDate(defaultRate?.updated_at)}</span>
                        </div>

                        {/* Panel Tasa Automática BCV */}
                        <div className="border border-amber-200 rounded-2xl overflow-hidden">
                            <div className="px-4 py-3 flex items-center justify-between bg-amber-50 border-b border-amber-100">
                                <div className="flex items-center gap-2">
                                    <Landmark size={15} className="text-amber-600" />
                                    <span className="text-xs font-black text-amber-800 uppercase tracking-wide">Tasa Automática BCV</span>
                                </div>
                                <button
                                    onClick={fetchBcvRates}
                                    disabled={bcvLoading}
                                    title="Actualizar desde BCV"
                                    className="p-1.5 rounded-lg bg-white text-amber-600 border border-amber-200 hover:bg-amber-100 transition-all disabled:opacity-40"
                                >
                                    <RefreshCw size={13} className={bcvLoading ? 'animate-spin' : ''} />
                                </button>
                            </div>

                            {bcvLoading ? (
                                <div className="py-6 flex flex-col items-center gap-2">
                                    <RefreshCw className="animate-spin text-amber-500" size={20} />
                                    <p className="text-xs text-amber-700 font-bold">Consultando BCV…</p>
                                </div>
                            ) : bcvRates ? (
                                <div className="p-3 space-y-2">
                                    {bcvRates.usd_ves && (
                                        <div className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-amber-100 shadow-sm">
                                            <div>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Dólar USD</span>
                                                <span className="text-base font-black text-slate-900">
                                                    {bcvRates.usd_ves.toLocaleString('es-VE', { minimumFractionDigits: 4 })}
                                                </span>
                                                <span className="text-xs text-slate-500 ml-1">Bs</span>
                                            </div>
                                            <button
                                                onClick={() => handleApplyBcvRate(bcvRates.usd_ves, 'USD')}
                                                disabled={bcvApplying}
                                                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-black px-3 py-1.5 rounded-lg transition-all shadow-sm"
                                            >
                                                Aplicar
                                            </button>
                                        </div>
                                    )}

                                    {bcvRates.eur_ves && (
                                        <div className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-amber-100 shadow-sm">
                                            <div>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Euro EUR</span>
                                                <span className="text-base font-black text-slate-900">
                                                    {bcvRates.eur_ves.toLocaleString('es-VE', { minimumFractionDigits: 4 })}
                                                </span>
                                                <span className="text-xs text-slate-500 ml-1">Bs</span>
                                            </div>
                                            <button
                                                onClick={() => handleApplyBcvRate(bcvRates.eur_ves, 'EUR')}
                                                disabled={bcvApplying}
                                                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-black px-3 py-1.5 rounded-lg transition-all shadow-sm"
                                            >
                                                Aplicar
                                            </button>
                                        </div>
                                    )}

                                    <p className="text-[10px] text-slate-400 text-center pt-1">
                                        Consultado a las{' '}
                                        {new Date(bcvRates.fetched_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                                        {' '}· <a href="https://www.bcv.org.ve/" target="_blank" rel="noreferrer" className="underline hover:text-amber-600">bcv.org.ve</a>
                                    </p>
                                </div>
                            ) : (
                                <div className="py-5 px-4 flex flex-col items-center gap-3 text-center">
                                    <p className="text-xs text-amber-700">Obtén las tasas oficiales del BCV en un clic.</p>
                                    <button
                                        onClick={fetchBcvRates}
                                        className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-black px-4 py-2 rounded-lg transition-all shadow-sm flex items-center gap-2"
                                    >
                                        <Landmark size={14} /> Consultar BCV
                                    </button>
                                </div>
                            )}
                        </div>
                    </CardContent>
                    <CardFooter className="pt-0">
                        <button
                            onClick={() => setShowAddRateModal(true)}
                            className="w-full bg-slate-900 border border-slate-900 text-white rounded-xl py-3 text-sm font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus size={18} /> Nueva Tasa Manual
                        </button>
                    </CardFooter>
                </Card>

                {/* Rates List */}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest px-1">Opciones de Conversión</h3>

                    {loading ? (
                        <div className="bg-white rounded-2xl p-20 border border-slate-100 flex flex-col items-center justify-center">
                            <RefreshCw className="animate-spin text-indigo-600 mb-4" size={32} />
                            <p className="text-slate-500 font-bold">Sincronizando tasas...</p>
                        </div>
                    ) : activeCurrencyRates.length === 0 ? (
                        <div className="bg-white rounded-2xl p-12 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-4">
                                <Coins size={32} />
                            </div>
                            <h4 className="text-slate-900 font-bold text-lg">Sin tasas configuradas</h4>
                            <p className="text-slate-500 text-sm max-w-xs mt-2">Agrega el valor de cambio oficial o paralelo para poder realizar cálculos automáticos.</p>
                        </div>
                    ) : (
                        activeCurrencyRates.sort((a, b) => b.is_default - a.is_default).map(rate => (
                            <div
                                key={rate.id}
                                className={cn(
                                    "group bg-white rounded-2xl border transition-all duration-300 overflow-hidden",
                                    rate.is_default ? "border-indigo-500 shadow-lg shadow-indigo-50" : "border-slate-200 hover:border-slate-300 shadow-sm"
                                )}
                            >
                                <div className="p-5 flex flex-col md:flex-row gap-6 items-center">
                                    <div className="flex-1 w-full space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className={cn(
                                                    "w-2 h-2 rounded-full",
                                                    rate.is_active ? "bg-emerald-500" : "bg-slate-300"
                                                )}></div>
                                                <span className="font-black text-slate-800 tracking-tight">{rate.name}</span>
                                                {rate.is_default && (
                                                    <span className="text-[10px] font-black uppercase bg-indigo-600 text-white px-2 py-0.5 rounded-lg tracking-tighter ring-4 ring-indigo-50">ACTIVA</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Clock size={14} className="text-slate-400" />
                                                <span className="text-[11px] font-bold text-slate-400">{formatDate(rate.updated_at)}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="flex-1 flex items-center bg-slate-50 rounded-xl px-4 py-3 border border-slate-100 group-hover:bg-white transition-all group-hover:border-indigo-200 group-hover:shadow-sm">
                                                <span className="text-slate-400 font-bold text-lg pr-4 border-r border-slate-200 leading-none">1 USD</span>
                                                <ArrowRight className="mx-4 text-slate-300 group-hover:text-indigo-400 transition-colors" size={18} />
                                                <input
                                                    type="number"
                                                    step="0.00000001"
                                                    defaultValue={rate.rate}
                                                    onBlur={(e) => {
                                                        const val = parseFloat(e.target.value);
                                                        if (!isNaN(val) && val !== rate.rate) handleUpdateRate(rate.id, 'rate', val);
                                                    }}
                                                    className="bg-transparent border-none outline-none font-black text-xl text-slate-900 w-full"
                                                />
                                                <span className="text-slate-400 font-bold ml-2">{selectedCurrency}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex md:flex-col gap-2 w-full md:w-auto shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
                                        <button
                                            onClick={() => handleUpdateRate(rate.id, 'is_active', !rate.is_active)}
                                            className={cn(
                                                "flex-1 md:w-32 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                                                rate.is_active ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-slate-50 text-slate-400 border border-slate-100"
                                            )}
                                        >
                                            {rate.is_active ? 'Habilitado' : 'Deshabilitado'}
                                        </button>

                                        {!rate.is_default ? (
                                            <div className="flex gap-2 flex-1 md:w-32">
                                                <button
                                                    onClick={() => handleUpdateRate(rate.id, 'is_default', true)}
                                                    className="flex-1 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 py-2 rounded-lg transition-all flex items-center justify-center"
                                                    title="Establecer como preferida"
                                                >
                                                    <Star size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteRate(rate.id)}
                                                    className="flex-1 bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 py-2 rounded-lg transition-all flex items-center justify-center"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center gap-1.5 p-2 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase transition-all ring-1 ring-indigo-200">
                                                <RefreshCw size={12} className="shrink-0" /> Sistema Auto
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Modal Addition */}
            {showAddRateModal && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <Card className="w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300 bg-white">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xl font-black">Nueva Tasa {selectedCurrency}</CardTitle>
                            <CardDescription>Configura un nuevo valor de referencia para cálculos</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Identificador</label>
                                <input
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-300"
                                    value={newRate.name}
                                    onChange={e => setNewRate({ ...newRate, name: e.target.value })}
                                    placeholder="Ej: Paralelo, BCV, Promedio..."
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Valor por 1 USD</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.00000001"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-12 py-3 font-black text-xl text-slate-900 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                        value={newRate.rate}
                                        onChange={e => setNewRate({ ...newRate, rate: e.target.value })}
                                        placeholder="0.00"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">{selectedCurrency}</span>
                                </div>
                            </div>

                            <div className="flex gap-2 p-3 bg-indigo-50 rounded-xl border border-indigo-100 mt-2">
                                <AlertCircle size={20} className="text-indigo-400 shrink-0" />
                                <p className="text-[11px] text-indigo-700 leading-tight">
                                    Esta tasa quedará disponible para la selección manual en productos y el cálculo automático en el punto de venta.
                                </p>
                            </div>
                        </CardContent>
                        <CardFooter className="flex gap-3 pt-6">
                            <button
                                onClick={() => setShowAddRateModal(false)}
                                className="flex-1 bg-white border border-slate-200 text-slate-600 py-3 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAddRate}
                                disabled={processing}
                                className="flex-1 bg-indigo-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all disabled:opacity-50"
                            >
                                {processing ? 'Registrando...' : 'Confirmar Tasa'}
                            </button>
                        </CardFooter>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default MonedasTab;
