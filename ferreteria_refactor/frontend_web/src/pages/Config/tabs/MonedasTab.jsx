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
            toast.success(`"${targetRate.name}" actualizada a ${bcvValue.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${selectedCurrency}`);
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
        <div className="space-y-5">
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-4 border-b border-slate-100 p-5 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0">
                        <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
                            <Coins className="text-indigo-600" size={22} /> Monedas y Tasas
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">Controla la tasa usada para precios, POS y reportes</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {PREDEFINED_CURRENCIES.filter(c => c.code !== 'USD').map(curr => (
                            <button
                                key={curr.code}
                                onClick={() => setSelectedCurrency(curr.code)}
                                className={cn(
                                    "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-black transition-colors",
                                    selectedCurrency === curr.code
                                        ? "border-indigo-600 bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                                        : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                                )}
                            >
                                <Globe size={15} />
                                {curr.code}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid gap-4 bg-slate-50/50 p-4 sm:p-5 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
                    <div className="space-y-4">
                        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tasa activa</p>
                                    <p className="text-sm font-bold text-slate-600">{selectedCurrency} / USD</p>
                                </div>
                                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
                                    <Coins size={20} />
                                </div>
                            </div>
                            <div className="rounded-md border border-slate-100 bg-slate-50 p-4">
                                <div className="flex items-end gap-2">
                                    <span className="text-3xl font-black tabular-nums text-slate-900">
                                        {defaultRate ? parseFloat(Number(defaultRate.rate).toFixed(4)).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '---'}
                                    </span>
                                    <span className="pb-1 text-sm font-black text-slate-500">{selectedCurrency}</span>
                                </div>
                                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                                    <div className="rounded-md bg-white px-3 py-2 font-bold text-slate-600 shadow-sm">
                                        Fuente: <span className="text-indigo-700">{defaultRate?.name || 'Ninguna'}</span>
                                    </div>
                                    <div className="rounded-md bg-white px-3 py-2 font-bold text-slate-600 shadow-sm">
                                        Cambio: <span className="text-slate-800">{formatDate(defaultRate?.updated_at)}</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAddRateModal(true)}
                                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-indigo-600 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700"
                            >
                                <Plus size={17} /> Nueva Tasa Manual
                            </button>
                        </div>

                        <div className="overflow-hidden rounded-lg border border-amber-200 bg-white shadow-sm">
                            <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50 px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <Landmark size={16} className="text-amber-600" />
                                    <span className="text-xs font-black uppercase tracking-wide text-amber-800">Tasa BCV</span>
                                </div>
                                <button
                                    onClick={fetchBcvRates}
                                    disabled={bcvLoading}
                                    title="Actualizar desde BCV"
                                    className="rounded-md border border-amber-200 bg-white p-1.5 text-amber-600 transition-colors hover:bg-amber-100 disabled:opacity-40"
                                >
                                    <RefreshCw size={14} className={bcvLoading ? 'animate-spin' : ''} />
                                </button>
                            </div>

                            {bcvLoading ? (
                                <div className="flex items-center justify-center gap-2 px-4 py-6 text-xs font-bold text-amber-700">
                                    <RefreshCw className="animate-spin text-amber-500" size={18} /> Consultando BCV...
                                </div>
                            ) : bcvRates ? (
                                <div className="space-y-2 p-3">
                                    {bcvRates.usd_ves && (
                                        <div className="flex items-center justify-between rounded-md border border-amber-100 bg-white px-3 py-2 shadow-sm">
                                            <div>
                                                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Dólar USD</span>
                                                <span className="text-base font-black text-slate-900">{bcvRates.usd_ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
                                                <span className="ml-1 text-xs text-slate-500">Bs</span>
                                            </div>
                                            <button
                                                onClick={() => handleApplyBcvRate(bcvRates.usd_ves, 'USD')}
                                                disabled={bcvApplying}
                                                className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-black text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
                                            >
                                                Aplicar
                                            </button>
                                        </div>
                                    )}
                                    {bcvRates.eur_ves && (
                                        <div className="flex items-center justify-between rounded-md border border-amber-100 bg-white px-3 py-2 shadow-sm">
                                            <div>
                                                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Euro EUR</span>
                                                <span className="text-base font-black text-slate-900">{bcvRates.eur_ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
                                                <span className="ml-1 text-xs text-slate-500">Bs</span>
                                            </div>
                                            <button
                                                onClick={() => handleApplyBcvRate(bcvRates.eur_ves, 'EUR')}
                                                disabled={bcvApplying}
                                                className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-black text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
                                            >
                                                Aplicar
                                            </button>
                                        </div>
                                    )}
                                    <p className="pt-1 text-center text-[10px] text-slate-400">
                                        Consultado a las {new Date(bcvRates.fetched_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })} - <a href="https://www.bcv.org.ve/" target="_blank" rel="noreferrer" className="underline hover:text-amber-600">bcv.org.ve</a>
                                    </p>
                                </div>
                            ) : (
                                <div className="p-4 text-center">
                                    <p className="mb-3 text-xs text-amber-700">Obtén las tasas oficiales del BCV en un clic.</p>
                                    <button
                                        onClick={fetchBcvRates}
                                        className="inline-flex h-9 items-center gap-2 rounded-md bg-amber-500 px-4 text-xs font-black text-white transition-colors hover:bg-amber-600"
                                    >
                                        <Landmark size={14} /> Consultar BCV
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Opciones de Conversión</h3>
                                <p className="text-xs text-slate-400">Tasas configuradas para {selectedCurrency}</p>
                            </div>
                        </div>

                        <div className="p-4">
                            {loading ? (
                                <div className="flex h-64 flex-col items-center justify-center text-slate-400">
                                    <RefreshCw className="mb-4 animate-spin text-indigo-600" size={28} />
                                    <p className="text-sm font-bold">Sincronizando tasas...</p>
                                </div>
                            ) : activeCurrencyRates.length === 0 ? (
                                <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-center">
                                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-white text-slate-300 shadow-sm">
                                        <Coins size={26} />
                                    </div>
                                    <h4 className="text-base font-black text-slate-900">Sin tasas configuradas</h4>
                                    <p className="mt-1 max-w-xs text-sm text-slate-500">Agrega el valor oficial o paralelo para calcular precios automáticamente.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {activeCurrencyRates.sort((a, b) => b.is_default - a.is_default).map(rate => (
                                        <div
                                            key={rate.id}
                                            className={cn(
                                                "rounded-lg border bg-white p-4 shadow-sm transition-colors hover:border-indigo-200",
                                                rate.is_default ? "border-indigo-300 ring-1 ring-indigo-100" : "border-slate-200"
                                            )}
                                        >
                                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                                                <div className="min-w-0 flex-1">
                                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                                        <span className={cn("h-2 w-2 rounded-full", rate.is_active ? "bg-emerald-500" : "bg-slate-300")} />
                                                        <span className="font-black text-slate-900">{rate.name}</span>
                                                        {rate.is_default && (
                                                            <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">Activa</span>
                                                        )}
                                                        <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                                                            <Clock size={13} /> {formatDate(rate.updated_at)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center rounded-md border border-slate-200 bg-slate-50 px-3 py-2 transition-colors focus-within:border-indigo-300 focus-within:bg-white">
                                                        <span className="border-r border-slate-200 pr-3 text-sm font-black text-slate-500">1 USD</span>
                                                        <ArrowRight className="mx-3 text-slate-300" size={17} />
                                                        <input
                                                            type="number"
                                                            step="0.0001"
                                                            defaultValue={parseFloat(Number(rate.rate).toFixed(4))}
                                                            onBlur={(e) => {
                                                                const val = parseFloat(e.target.value);
                                                                if (!isNaN(val) && val !== rate.rate) handleUpdateRate(rate.id, 'rate', val);
                                                            }}
                                                            className="min-w-0 flex-1 border-none bg-transparent text-lg font-black text-slate-900 outline-none"
                                                        />
                                                        <span className="ml-2 text-sm font-black text-slate-400">{selectedCurrency}</span>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 lg:w-36">
                                                    <button
                                                        onClick={() => handleUpdateRate(rate.id, 'is_active', !rate.is_active)}
                                                        className={cn(
                                                            "rounded-md border px-3 py-2 text-xs font-black uppercase transition-colors",
                                                            rate.is_active ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-400"
                                                        )}
                                                    >
                                                        {rate.is_active ? 'On' : 'Off'}
                                                    </button>

                                                    {!rate.is_default ? (
                                                        <>
                                                            <button
                                                                onClick={() => handleUpdateRate(rate.id, 'is_default', true)}
                                                                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-400 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                                                                title="Establecer como preferida"
                                                            >
                                                                <Star size={16} className="mx-auto" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteRate(rate.id)}
                                                                className="col-span-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-400 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                                                            >
                                                                <Trash2 size={16} className="mx-auto" />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <div className="rounded-md border border-indigo-100 bg-indigo-50 px-3 py-2 text-center text-[10px] font-black uppercase text-indigo-700">
                                                            Sistema
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {showAddRateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <Card className="w-full max-w-md rounded-lg bg-white shadow-xl animate-in zoom-in-95 duration-200">
                        <CardHeader className="p-5 pb-2">
                            <CardTitle className="text-xl font-black">Nueva Tasa {selectedCurrency}</CardTitle>
                            <CardDescription>Configura un nuevo valor de referencia para cálculos</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 p-5 pt-3">
                            <div className="space-y-2">
                                <label className="px-1 text-xs font-black uppercase tracking-widest text-slate-400">Identificador</label>
                                <input
                                    className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 font-bold text-slate-800 outline-none transition-colors placeholder:text-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                    value={newRate.name}
                                    onChange={e => setNewRate({ ...newRate, name: e.target.value })}
                                    placeholder="Ej: Paralelo, BCV, Promedio..."
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="px-1 text-xs font-black uppercase tracking-widest text-slate-400">Valor por 1 USD</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.00000001"
                                        className="h-12 w-full rounded-md border border-slate-200 bg-slate-50 py-3 pl-3 pr-12 text-xl font-black text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                        value={newRate.rate}
                                        onChange={e => setNewRate({ ...newRate, rate: e.target.value })}
                                        placeholder="0.00"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">{selectedCurrency}</span>
                                </div>
                            </div>

                            <div className="flex gap-2 rounded-md border border-indigo-100 bg-indigo-50 p-3">
                                <AlertCircle size={18} className="shrink-0 text-indigo-500" />
                                <p className="text-[11px] leading-tight text-indigo-700">
                                    Esta tasa quedará disponible para selección manual y cálculo automático en el punto de venta.
                                </p>
                            </div>
                        </CardContent>
                        <CardFooter className="flex gap-3 p-5 pt-0">
                            <button
                                onClick={() => setShowAddRateModal(false)}
                                className="flex-1 rounded-md border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAddRate}
                                disabled={processing}
                                className="flex-1 rounded-md bg-indigo-600 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
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
