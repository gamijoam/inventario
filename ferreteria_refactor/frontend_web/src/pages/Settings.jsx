import { useState, useEffect } from 'react';
import { Building2, Coins, Receipt, Save, RefreshCw, Trash2, Plus, Edit, Check, X, Star, AlertCircle, Loader2, Globe, Printer, CreditCard, ChevronRight } from 'lucide-react';
import { useConfig } from '../context/ConfigContext';
import configService from '../services/configService';
import apiClient from '../config/axios';
import TicketConfig from './Settings/TicketConfig';
import PaymentMethodsConfig from './Settings/PaymentMethodsConfig';
import clsx from 'clsx';
import { toast } from 'react-hot-toast';

const PREDEFINED_CURRENCIES = [
    { code: 'USD', symbol: '$', name: 'Dólar Americano' },
    { code: 'VES', symbol: 'Bs', name: 'Bolívar Venezolano' },
    { code: 'COP', symbol: 'COP', name: 'Peso Colombiano' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'PEN', symbol: 'S/', name: 'Sol Peruano' },
    { code: 'CLP', symbol: 'CLP', name: 'Peso Chileno' },
    { code: 'ARS', symbol: 'ARS', name: 'Peso Argentino' },
    { code: 'BRL', symbol: 'R$', name: 'Real Brasileño' },
    { code: 'MXN', symbol: 'MXN', name: 'Peso Mexicano' }
];

const Settings = () => {
    const { business, refreshConfig } = useConfig();
    const [activeTab, setActiveTab] = useState('business');

    // Local Forms State
    const [bizForm, setBizForm] = useState({ name: '', document_id: '', address: '', phone: '' });

    // Exchange Rates State
    const [exchangeRates, setExchangeRates] = useState([]);
    const [selectedCurrency, setSelectedCurrency] = useState('USD');
    const [showAddRateModal, setShowAddRateModal] = useState(false);
    const [showAddCurrencyModal, setShowAddCurrencyModal] = useState(false);
    const [newRate, setNewRate] = useState({ name: '', rate: '' });
    const [newCurrency, setNewCurrency] = useState({ code: '', symbol: '' });
    const [isRatesLoading, setIsRatesLoading] = useState(false);
    const [ratesError, setRatesError] = useState(null);

    // Tax Settings State
    const [defaultTaxRate, setDefaultTaxRate] = useState('');
    const [isSavingTax, setIsSavingTax] = useState(false);

    useEffect(() => {
        if (business) {
            setBizForm({
                name: business.name || '',
                document_id: business.document_id || '',
                address: business.address || '',
                phone: business.phone || ''
            });
        }
    }, [business]);

    useEffect(() => {
        if (activeTab === 'currencies') {
            fetchExchangeRates();
        } else if (activeTab === 'taxes') {
            fetchDefaultTaxRate();
        }
    }, [activeTab]);

    const fetchDefaultTaxRate = async () => {
        try {
            const response = await apiClient.get('/config/tax-rate/default');
            setDefaultTaxRate(response.data.rate);
        } catch (error) {
            console.error('Error fetching tax rate:', error);
        }
    };

    const fetchExchangeRates = async () => {
        setIsRatesLoading(true);
        setRatesError(null);
        try {
            const response = await apiClient.get('/config/exchange-rates');

            if (!Array.isArray(response.data)) {
                setExchangeRates([]);
                setRatesError("La API no devolvió una lista válida.");
                return;
            }

            setExchangeRates(response.data);
        } catch (error) {
            console.error('Error fetching exchange rates:', error);
            setRatesError(error.response?.data?.detail || "Error de conexión con el servidor");
            toast.error("Error cargando tasas de cambio");
        } finally {
            setIsRatesLoading(false);
        }
    };

    const handleBizSave = async () => {
        try {
            await configService.updateBusinessInfo(bizForm);
            toast.success("Datos de negocio actualizados");
            refreshConfig();
        } catch (e) {
            console.error(e);
            toast.error("Error al guardar cambios");
        }
    };

    const handleSaveTaxRate = async () => {
        setIsSavingTax(true);
        try {
            await apiClient.put('/config/tax-rate/default', { rate: parseFloat(defaultTaxRate) });
            toast.success("Impuesto por defecto actualizado");
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar impuesto");
        } finally {
            setIsSavingTax(false);
        }
    };

    const handleAddRate = async () => {
        if (!newRate.name || !newRate.rate || !selectedCurrency) {
            toast.error('Por favor completa todos los campos');
            return;
        }

        try {
            let symbol = '$';
            const existingRate = exchangeRates.find(r => r.currency_code === selectedCurrency);
            if (existingRate) {
                symbol = existingRate.currency_symbol;
            } else {
                const predefined = PREDEFINED_CURRENCIES.find(c => c.code === selectedCurrency);
                if (predefined) symbol = predefined.symbol;
            }

            await apiClient.post('/config/exchange-rates', {
                name: newRate.name,
                currency_code: selectedCurrency,
                currency_symbol: symbol,
                rate: parseFloat(newRate.rate),
                is_default: false,
                is_active: true
            });

            setNewRate({ name: '', rate: '' });
            setShowAddRateModal(false);
            fetchExchangeRates();
            toast.success('Tasa agregada exitosamente');
        } catch (error) {
            console.error('Error adding rate:', error);
            toast.error('Error al agregar tasa: ' + (error.response?.data?.detail || "Error desconocido"));
        }
    };

    const handleUpdateRate = async (rateId, field, value) => {
        try {
            await apiClient.put(`/config/exchange-rates/${rateId}`, {
                [field]: value
            });
            fetchExchangeRates();
            if (field === 'is_default' && value === true) {
                toast.success('Tasa marcada como predeterminada');
            } else if (field === 'is_active') {
                toast.success(value ? 'Tasa activada' : 'Tasa desactivada');
            } else {
                toast.success('Tasa actualizada');
            }
        } catch (error) {
            console.error('Error updating rate:', error);
            toast.error('Error al actualizar tasa');
        }
    };

    const handleDeleteRate = async (rateId) => {
        if (!confirm('¿Eliminar esta tasa?')) return;

        try {
            await apiClient.delete(`/config/exchange-rates/${rateId}`);
            fetchExchangeRates();
            toast.success('Tasa eliminada');
        } catch (error) {
            console.error('Error deleting rate:', error);
            toast.error(error.response?.data?.detail || 'Error al eliminar tasa');
        }
    };

    const handleAddCustomCurrency = () => {
        if (!newCurrency.code || !newCurrency.symbol) {
            toast.error('Por favor indica código y símbolo');
            return;
        }
        const code = newCurrency.code.toUpperCase();
        setSelectedCurrency(code);
        setShowAddCurrencyModal(false);
        setNewCurrency({ code: '', symbol: '' });
    };

    // Group rates by currency
    const groupedRates = Array.isArray(exchangeRates) ? exchangeRates.reduce((acc, rate) => {
        if (!acc[rate.currency_code]) {
            acc[rate.currency_code] = [];
        }
        acc[rate.currency_code].push(rate);
        return acc;
    }, {}) : {};

    // Get final currency list: PREDEFINED + Any custom code from database
    const dbCurrencyCodes = Object.keys(groupedRates);
    const allCurrencyCodes = Array.from(new Set([...PREDEFINED_CURRENCIES.map(c => c.code), ...dbCurrencyCodes]));

    const uniqueCurrencies = allCurrencyCodes.map(code => {
        const rates = groupedRates[code] || [];
        const predefined = PREDEFINED_CURRENCIES.find(c => c.code === code);
        return {
            code,
            symbol: rates.length > 0 ? rates[0].currency_symbol : (predefined?.symbol || '?'),
            name: predefined?.name || 'Personalizada',
            rateCount: rates.length
        };
    });

    const selectedRates = selectedCurrency ? (groupedRates[selectedCurrency] || []) : [];
    const selectedCurrInfo = uniqueCurrencies.find(c => c.code === selectedCurrency);

    const TABS = [
        { id: 'business', label: 'Negocio', icon: Building2 },
        { id: 'currencies', label: 'Monedas y Tasas', icon: Coins },
        { id: 'tickets', label: 'Tickets', icon: Printer },
        { id: 'payments', label: 'Métodos de Pago', icon: CreditCard },
    ];

    return (
        <div className="p-6 max-w-[1600px] mx-auto min-h-screen">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Configuración del Sistema</h1>
                <p className="text-slate-500 font-medium mt-1">Administra los parámetros generales de tu ferretería</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar Navigation */}
                <div className="lg:w-64 flex-shrink-0">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden sticky top-6">
                        <div className="p-2 space-y-1">
                            {TABS.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={clsx(
                                        "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-bold text-sm",
                                        activeTab === tab.id
                                            ? "bg-indigo-50 text-indigo-700 shadow-sm"
                                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <tab.icon size={18} className={activeTab === tab.id ? "text-indigo-600" : "text-slate-400"} />
                                        {tab.label}
                                    </div>
                                    {activeTab === tab.id && <ChevronRight size={16} className="text-indigo-400" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 min-w-0">
                    {/* Business Tab */}
                    {activeTab === 'business' && (
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2 pb-4 border-b border-slate-100">
                                <Building2 className="text-indigo-600" size={24} /> Información del Negocio
                            </h2>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre del Negocio</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-700 transition-all"
                                        value={bizForm.name}
                                        onChange={e => setBizForm({ ...bizForm, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">RIF / Documento</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-700 transition-all"
                                        value={bizForm.document_id}
                                        onChange={e => setBizForm({ ...bizForm, document_id: e.target.value })}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Dirección Fiscal</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-700 transition-all"
                                        value={bizForm.address}
                                        onChange={e => setBizForm({ ...bizForm, address: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Teléfono</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-700 transition-all"
                                        value={bizForm.phone}
                                        onChange={e => setBizForm({ ...bizForm, phone: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                                <button
                                    onClick={handleBizSave}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                                >
                                    <Save size={18} /> Guardar Cambios
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Currencies Tab */}
                    {activeTab === 'currencies' && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px] animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">Gestión de Tasas de Cambio</h2>
                                    <p className="text-slate-500 text-sm font-medium">Administra múltiples tasas por moneda</p>
                                </div>
                                <button
                                    onClick={fetchExchangeRates}
                                    disabled={isRatesLoading}
                                    className="bg-white hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-xl border border-slate-200 font-bold flex items-center transition-all disabled:opacity-50 gap-2 shadow-sm"
                                >
                                    {isRatesLoading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                                    Actualizar
                                </button>
                            </div>

                            {ratesError && (
                                <div className="m-6 p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl flex items-center shadow-sm">
                                    <AlertCircle size={20} className="mr-3 flex-shrink-0" />
                                    <p className="font-medium">{ratesError}</p>
                                </div>
                            )}

                            {/* Base Currency Banner */}
                            <div className="mx-6 mt-6 mb-4 p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-emerald-100 text-emerald-600 p-3 rounded-xl">
                                            <Coins size={28} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-emerald-900 flex items-center gap-2">
                                                <span className="bg-emerald-600 text-white px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide">Base</span>
                                                Moneda del Sistema
                                            </h3>
                                            <p className="text-emerald-700/80 font-medium text-sm mt-0.5">
                                                Referencia base: <span className="font-bold text-emerald-800">USD (Dólar Americano)</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right bg-white/60 backdrop-blur-sm px-4 py-2 rounded-xl border border-emerald-100">
                                        <div className="text-2xl font-black text-emerald-600 font-mono tracking-tight">$1.00 USD</div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row h-full flex-1 min-h-[500px]">
                                {/* LEFT: Currency List */}
                                <div className="md:w-72 bg-slate-50 border-r border-slate-100 flex flex-col">
                                    <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Monedas</h3>
                                        <button
                                            onClick={() => setShowAddCurrencyModal(true)}
                                            className="p-1.5 hover:bg-slate-200 text-indigo-600 rounded-lg transition-colors"
                                            title="Agregar otra moneda"
                                        >
                                            <Plus size={18} />
                                        </button>
                                    </div>
                                    <div className="p-3 space-y-1 overflow-y-auto flex-1 custom-scrollbar">
                                        {uniqueCurrencies.map(curr => (
                                            <button
                                                key={curr.code}
                                                onClick={() => setSelectedCurrency(curr.code)}
                                                className={clsx(
                                                    "w-full text-left p-3 rounded-xl transition-all border group relative",
                                                    selectedCurrency === curr.code
                                                        ? 'bg-white border-indigo-200 shadow-md z-10'
                                                        : 'bg-transparent border-transparent hover:bg-white hover:border-slate-200'
                                                )}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-3">
                                                        <div className={clsx(
                                                            "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs transition-colors",
                                                            selectedCurrency === curr.code ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500 group-hover:bg-slate-300"
                                                        )}>
                                                            {curr.code.substring(0, 2)}
                                                        </div>
                                                        <div>
                                                            <div className={clsx("font-bold text-sm leading-none mb-0.5", selectedCurrency === curr.code ? "text-indigo-900" : "text-slate-700")}>{curr.code}</div>
                                                            <div className="text-[10px] text-slate-400 font-medium truncate max-w-[100px]">{curr.name}</div>
                                                        </div>
                                                    </div>
                                                    {curr.rateCount > 0 && (
                                                        <span className={clsx(
                                                            "px-2 py-0.5 rounded-full text-[10px] font-bold",
                                                            selectedCurrency === curr.code ? "bg-indigo-50 text-indigo-600" : "bg-slate-200 text-slate-500"
                                                        )}>
                                                            {curr.rateCount}
                                                        </span>
                                                    )}
                                                </div>
                                                {selectedCurrency === curr.code && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r-full"></div>}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* RIGHT: Rate Details */}
                                <div className="flex-1 p-6 bg-white overflow-y-auto">
                                    {selectedCurrency ? (
                                        <div className="space-y-6">
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                                <div>
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <span className="text-3xl font-black text-slate-800">{selectedCurrency}</span>
                                                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-xs font-bold border border-slate-200">
                                                            {selectedCurrInfo?.symbol}
                                                        </span>
                                                    </div>
                                                    <h3 className="text-sm font-medium text-slate-500">
                                                        {selectedCurrInfo?.name}
                                                    </h3>
                                                </div>
                                                <button
                                                    onClick={() => setShowAddRateModal(true)}
                                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5 active:scale-95 gap-2 text-sm"
                                                >
                                                    <Plus size={18} /> Nueva Tasa
                                                </button>
                                            </div>

                                            {/* Rates Table */}
                                            {selectedRates.length > 0 ? (
                                                <div className="bg-white border rounded-2xl overflow-hidden shadow-sm border-slate-200 flex flex-col h-full max-h-[600px]">
                                                    <div className="overflow-auto custom-scrollbar flex-1">
                                                        <table className="w-full min-w-[700px]">
                                                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                                                                <tr>
                                                                    <th className="text-left p-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider w-[30%]">Nombre del Perfil</th>
                                                                    <th className="text-left p-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider w-[30%]">Valor (1 USD =)</th>
                                                                    <th className="text-center p-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider w-[15%]">Predeterminada</th>
                                                                    <th className="text-center p-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider w-[10%]">Estado</th>
                                                                    <th className="text-center p-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider w-[15%]">Acciones</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {selectedRates.map((rate, idx) => (
                                                                    <tr key={rate.id} className={clsx("hover:bg-slate-50/50 transition-colors group", idx % 2 === 0 ? "bg-white" : "bg-slate-50/20")}>
                                                                        <td className="p-4">
                                                                            <div className="font-bold text-slate-700 text-sm">{rate.name}</div>
                                                                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {rate.id}</div>
                                                                        </td>
                                                                        <td className="p-4">
                                                                            <div className="relative w-full min-w-[160px]">
                                                                                <span className="absolute left-3 top-2.5 text-slate-400 text-xs font-bold">$1 =</span>
                                                                                <input
                                                                                    type="number"
                                                                                    step="0.01"
                                                                                    defaultValue={rate.rate}
                                                                                    onBlur={(e) => {
                                                                                        const val = parseFloat(e.target.value);
                                                                                        if (val !== rate.rate && val > 0) {
                                                                                            handleUpdateRate(rate.id, 'rate', val);
                                                                                        }
                                                                                    }}
                                                                                    className="pl-10 pr-9 border-slate-200 bg-white rounded-xl px-3 py-2 w-full font-mono font-bold text-slate-700 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm"
                                                                                />
                                                                                <span className="absolute right-3 top-2.5 text-slate-400 text-xs font-bold">{rate.currency_symbol}</span>
                                                                            </div>
                                                                        </td>
                                                                        <td className="p-4 text-center">
                                                                            <button
                                                                                onClick={() => !rate.is_default && handleUpdateRate(rate.id, 'is_default', true)}
                                                                                disabled={rate.is_default}
                                                                                className={clsx(
                                                                                    "p-2 rounded-lg transition-all",
                                                                                    rate.is_default
                                                                                        ? "bg-amber-100 text-amber-600 shadow-sm cursor-default"
                                                                                        : "text-slate-300 hover:text-amber-500 hover:bg-amber-50"
                                                                                )}
                                                                                title={rate.is_default ? "Tasa Predeterminada" : "Marcar como predeterminada"}
                                                                            >
                                                                                <Star size={18} fill={rate.is_default ? 'currentColor' : 'none'} />
                                                                            </button>
                                                                        </td>
                                                                        <td className="p-4 text-center">
                                                                            <button
                                                                                onClick={() => handleUpdateRate(rate.id, 'is_active', !rate.is_active)}
                                                                                className={clsx(
                                                                                    "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20",
                                                                                    rate.is_active ? 'bg-emerald-500' : 'bg-slate-200'
                                                                                )}
                                                                            >
                                                                                <span className={clsx(
                                                                                    "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200",
                                                                                    rate.is_active ? 'translate-x-4.5' : 'translate-x-1'
                                                                                )} />
                                                                            </button>
                                                                        </td>
                                                                        <td className="p-4 text-center">
                                                                            {!rate.is_default ? (
                                                                                <button
                                                                                    onClick={() => handleDeleteRate(rate.id)}
                                                                                    className="p-2 text-rose-300 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                                                    title="Eliminar"
                                                                                >
                                                                                    <Trash2 size={18} />
                                                                                </button>
                                                                            ) : (
                                                                                <div className="w-8 h-8 flex items-center justify-center mx-auto text-emerald-500 bg-emerald-50 rounded-lg opacity-50">
                                                                                    <Check size={16} />
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-center px-4">
                                                    <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                                                        <Coins size={32} className="text-slate-300" />
                                                    </div>
                                                    <h4 className="text-lg font-bold text-slate-700">Sin tasas configuradas</h4>
                                                    <p className="text-slate-500 mt-1 max-w-xs text-sm">
                                                        Para {selectedCurrInfo?.name} aún no tienes perfiles de tasa activos.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
                                            <Globe size={64} className="opacity-20" />
                                            <p className="font-medium text-sm">Selecciona una moneda para gestionar sus tasas</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tickets Tab */}
                    {activeTab === 'tickets' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <TicketConfig />
                        </div>
                    )}

                    {/* Payment Methods Tab */}
                    {activeTab === 'payments' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <PaymentMethodsConfig />
                        </div>
                    )}
                </div>
            </div>

            {/* Modal: Agregar Moneda Personalizada */}
            {showAddCurrencyModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform scale-100">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Globe className="text-indigo-600" size={24} /> Nueva Moneda
                            </h3>
                            <button onClick={() => setShowAddCurrencyModal(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-slate-500 text-sm mb-2 font-medium">Agrega un código de moneda personalizado (ISO 4217).</p>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Código (ISO)</label>
                                <input
                                    type="text"
                                    maxLength={3}
                                    value={newCurrency.code}
                                    onChange={e => setNewCurrency({ ...newCurrency, code: e.target.value.toUpperCase() })}
                                    className="w-full text-center p-3 text-2xl font-black text-slate-800 bg-slate-100 rounded-xl border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all uppercase placeholder:text-slate-300"
                                    placeholder="USD"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Símbolo</label>
                                <input
                                    type="text"
                                    value={newCurrency.symbol}
                                    onChange={e => setNewCurrency({ ...newCurrency, symbol: e.target.value })}
                                    className="w-full text-center p-3 text-2xl font-black text-slate-800 bg-slate-100 rounded-xl border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300"
                                    placeholder="$"
                                />
                            </div>
                        </div>
                        <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                            <button onClick={() => setShowAddCurrencyModal(false)} className="flex-1 py-2.5 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                            <button onClick={handleAddCustomCurrency} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all">Guardar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Agregar Tasa */}
            {showAddRateModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform scale-100">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                            <h3 className="text-xl font-bold text-slate-800">Nueva Tasa para {selectedCurrency}</h3>
                            <button
                                onClick={() => { setShowAddRateModal(false); setNewRate({ name: '', rate: '' }); }}
                                className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Nombre del Perfil
                                </label>
                                <input
                                    type="text"
                                    value={newRate.name}
                                    onChange={(e) => setNewRate({ ...newRate, name: e.target.value })}
                                    placeholder="Ej: BCV, Tasa Paralela, Mayorista"
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-700 placeholder:text-slate-300"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Tasa de Cambio (1 USD =)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3.5 text-slate-400 font-bold text-sm">{selectedCurrInfo?.symbol}</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={newRate.rate}
                                        onChange={(e) => setNewRate({ ...newRate, rate: e.target.value })}
                                        placeholder="0.00"
                                        className="w-full pl-10 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-bold text-slate-700 placeholder:text-slate-300"
                                    />
                                </div>
                            </div>

                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
                                <AlertCircle className="text-amber-500 flex-shrink-0" size={20} />
                                <p className="text-xs text-amber-800 font-medium leading-relaxed">
                                    Esta tasa se utilizará para convertir automaticamente los precios base (USD) al momento de facturar en {selectedCurrInfo?.name}.
                                </p>
                            </div>
                        </div>

                        <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                            <button
                                onClick={() => { setShowAddRateModal(false); setNewRate({ name: '', rate: '' }); }}
                                className="px-5 py-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 font-bold rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAddRate}
                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all hover:translate-y-[-1px] active:translate-y-[1px]"
                            >
                                Crear Tasa
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
