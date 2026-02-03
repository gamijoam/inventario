import { useState, useEffect } from 'react';
import { Building2, Coins, Receipt, Save, RefreshCw, Trash2, Plus, Edit, Check, X, Star, AlertCircle, Loader2, Globe, Printer, CreditCard, ChevronRight, DollarSign } from 'lucide-react';
import { useLocation } from 'react-router-dom';
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
    // Responsive Settings Module - Updated for Mobile
    const location = useLocation();
    const { business, refreshConfig } = useConfig();
    const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'business');

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
            refreshConfig(); // Force global update
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
            refreshConfig(); // Force global update
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
            refreshConfig(); // Force global update
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
                {/* Responsive Navigation: Sidebar (Desktop) / TabBar (Mobile) */}
                <div className="lg:w-64 flex-shrink-0">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 sticky top-6 overflow-hidden">
                        <div className="flex lg:flex-col overflow-x-auto lg:overflow-visible p-2 gap-2 lg:gap-1 custom-scrollbar">
                            {TABS.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={clsx(
                                        "flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm whitespace-nowrap",
                                        activeTab === tab.id
                                            ? "bg-indigo-50 text-indigo-700 shadow-sm"
                                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                                    )}
                                >
                                    <tab.icon size={18} className={activeTab === tab.id ? "text-indigo-600" : "text-slate-400"} />
                                    <span>{tab.label}</span>
                                    {activeTab === tab.id && <ChevronRight size={16} className="text-indigo-400 ml-auto hidden lg:block" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 min-w-0">
                    {/* Business Tab */}
                    {activeTab === 'business' && (
                        <div className="bg-white p-4 md:p-8 rounded-2xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                        <div className="bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px] md:min-h-[600px] animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col">
                            {/* Header */}
                            <div className="p-6 border-b border-slate-200/60 flex justify-between items-center bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-xl shadow-lg shadow-indigo-200">
                                            <Coins size={24} className="text-white" />
                                        </div>
                                        Gestión de Monedas
                                    </h2>
                                    <p className="text-slate-500 text-sm font-medium mt-1 ml-1">Administra tasas de cambio y monedas del sistema</p>
                                </div>
                                <button
                                    onClick={fetchExchangeRates}
                                    disabled={isRatesLoading}
                                    className="bg-white hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-xl border border-slate-200 font-bold flex items-center transition-all disabled:opacity-50 gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95"
                                >
                                    {isRatesLoading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                                    Actualizar
                                </button>
                            </div>

                            {ratesError && (
                                <div className="m-6 p-4 bg-gradient-to-r from-rose-50 to-red-50 border border-rose-200 text-rose-700 rounded-xl flex items-center shadow-sm">
                                    <AlertCircle size={20} className="mr-3 flex-shrink-0" />
                                    <p className="font-medium">{ratesError}</p>
                                </div>
                            )}

                            {/* Base Currency Banner */}
                            <div className="mx-4 md:mx-6 mt-4 md:mt-6 mb-3 md:mb-4 p-4 md:p-6 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 rounded-2xl shadow-lg relative overflow-hidden">
                                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>
                                <div className="relative flex flex-col sm:flex-row items-center sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 md:gap-4">
                                        <div className="bg-white/20 backdrop-blur-sm text-white p-3 md:p-4 rounded-2xl shadow-lg">
                                            <DollarSign size={28} className="md:w-8 md:h-8" strokeWidth={2.5} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="bg-white/90 text-emerald-700 px-2 md:px-3 py-1 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-wide shadow-sm">Moneda Base</span>
                                            </div>
                                            <h3 className="text-lg md:text-2xl font-black text-white drop-shadow-sm">
                                                USD - Dólar Americano
                                            </h3>
                                            <p className="text-emerald-50 font-medium text-xs md:text-sm mt-1 hidden sm:block">
                                                Todas las tasas se calculan en relación a esta moneda
                                            </p>
                                        </div>
                                    </div>
                                    <div className="bg-white/90 backdrop-blur-sm px-4 md:px-6 py-3 md:py-4 rounded-2xl shadow-lg">
                                        <div className="text-2xl md:text-4xl font-black text-emerald-600 font-mono tracking-tight">$1.00</div>
                                        <div className="text-xs text-emerald-600/70 font-bold text-center mt-1">USD</div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col flex-1">
                                {/* Mobile: Currency Dropdown */}
                                <div className="block md:hidden px-4 py-3 border-b border-slate-200 bg-white/50">
                                    <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">Seleccionar Moneda</label>
                                    <select
                                        value={selectedCurrency}
                                        onChange={(e) => setSelectedCurrency(e.target.value)}
                                        className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold text-slate-700 bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                    >
                                        {uniqueCurrencies.map(curr => (
                                            <option key={curr.code} value={curr.code}>
                                                {curr.symbol} {curr.code} - {curr.name} {curr.rateCount > 0 ? `(${curr.rateCount})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Desktop/Mobile Layout Container */}
                                <div className="flex flex-col md:flex-row flex-1">
                                    {/* Desktop: Currency Sidebar */}
                                    <div className="hidden md:flex md:w-72 bg-gradient-to-b from-slate-50 to-slate-100/50 border-r border-slate-200 flex-col">
                                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                                            <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider">Monedas Activas</h3>
                                            <button
                                                onClick={() => setShowAddCurrencyModal(true)}
                                                className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-xl transition-all hover:scale-110 active:scale-95 shadow-sm"
                                                title="Agregar otra moneda"
                                            >
                                                <Plus size={18} strokeWidth={2.5} />
                                            </button>
                                        </div>
                                        <div className="p-3 space-y-2 overflow-y-auto flex-1 custom-scrollbar">
                                            {uniqueCurrencies.map(curr => (
                                                <button
                                                    key={curr.code}
                                                    onClick={() => setSelectedCurrency(curr.code)}
                                                    className={clsx(
                                                        "w-full text-left p-4 rounded-xl transition-all border-2 group relative overflow-hidden",
                                                        selectedCurrency === curr.code
                                                            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 border-indigo-400 shadow-lg shadow-indigo-200 scale-105'
                                                            : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-md hover:scale-102'
                                                    )}
                                                >
                                                    <div className="flex justify-between items-center relative z-10">
                                                        <div className="flex items-center gap-3">
                                                            <div className={clsx(
                                                                "w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm transition-all shadow-sm",
                                                                selectedCurrency === curr.code
                                                                    ? "bg-white/20 backdrop-blur-sm text-white border-2 border-white/30"
                                                                    : "bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 border-2 border-slate-200"
                                                            )}>
                                                                {curr.code.substring(0, 2)}
                                                            </div>
                                                            <div>
                                                                <div className={clsx(
                                                                    "font-black text-base leading-none mb-1",
                                                                    selectedCurrency === curr.code ? "text-white" : "text-slate-800"
                                                                )}>
                                                                    {curr.code}
                                                                </div>
                                                                <div className={clsx(
                                                                    "text-xs font-medium truncate max-w-[100px]",
                                                                    selectedCurrency === curr.code ? "text-white/80" : "text-slate-500"
                                                                )}>
                                                                    {curr.name}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {curr.rateCount > 0 && (
                                                            <span className={clsx(
                                                                "px-2.5 py-1 rounded-lg text-xs font-black shadow-sm",
                                                                selectedCurrency === curr.code
                                                                    ? "bg-white/20 backdrop-blur-sm text-white border border-white/30"
                                                                    : "bg-indigo-50 text-indigo-600 border border-indigo-100"
                                                            )}>
                                                                {curr.rateCount}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {selectedCurrency === curr.code && (
                                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-white rounded-r-full shadow-lg"></div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* RIGHT: Rate Details */}
                                    <div className="flex-1 p-4 md:p-6 bg-white/50 overflow-y-auto">
                                        {selectedCurrency ? (
                                            <div className="space-y-4 md:space-y-6">
                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4 pb-3 md:pb-4 border-b border-slate-200">
                                                    <div>
                                                        <div className="flex items-center gap-2 md:gap-3 mb-2">
                                                            <span className="text-2xl md:text-4xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                                                {selectedCurrency}
                                                            </span>
                                                            <span className="bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 px-2 md:px-3 py-1 md:py-1.5 rounded-xl text-xs md:text-sm font-black border-2 border-slate-200 shadow-sm">
                                                                {selectedCurrInfo?.symbol}
                                                            </span>
                                                        </div>
                                                        <h3 className="text-sm md:text-base font-bold text-slate-600">
                                                            {selectedCurrInfo?.name}
                                                        </h3>
                                                    </div>
                                                    <button
                                                        onClick={() => setShowAddRateModal(true)}
                                                        className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-black flex items-center justify-center shadow-lg shadow-indigo-200 transition-all hover:-translate-y-1 hover:shadow-xl active:scale-95 gap-2 text-sm"
                                                    >
                                                        <Plus size={20} strokeWidth={2.5} /> Nueva Tasa
                                                    </button>
                                                </div>

                                                {/* Rates Cards Grid */}
                                                {selectedRates.length > 0 ? (
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
                                                        {selectedRates.map((rate, idx) => (
                                                            <div
                                                                key={rate.id}
                                                                className="group relative bg-white border-2 border-slate-200 rounded-2xl p-5 hover:border-indigo-300 hover:shadow-lg transition-all duration-300 overflow-hidden"
                                                            >
                                                                {/* Gradient Accent */}
                                                                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

                                                                {/* Header */}
                                                                <div className="flex justify-between items-start mb-4">
                                                                    <div className="flex-1">
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <h4 className="font-black text-slate-800 text-lg">{rate.name}</h4>
                                                                            {rate.is_default && (
                                                                                <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-white px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wide shadow-sm flex items-center gap-1">
                                                                                    <Star size={10} fill="currentColor" /> Default
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-xs text-slate-400 font-mono">ID: {rate.id}</p>
                                                                    </div>

                                                                    {/* Status Toggle */}
                                                                    <button
                                                                        onClick={() => handleUpdateRate(rate.id, 'is_active', !rate.is_active)}
                                                                        className={clsx(
                                                                            "relative inline-flex h-7 w-12 items-center rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-inner",
                                                                            rate.is_active ? 'bg-gradient-to-r from-emerald-400 to-green-500' : 'bg-slate-300'
                                                                        )}
                                                                        title={rate.is_active ? "Activa" : "Inactiva"}
                                                                    >
                                                                        <span className={clsx(
                                                                            "inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200",
                                                                            rate.is_active ? 'translate-x-6' : 'translate-x-1'
                                                                        )} />
                                                                    </button>
                                                                </div>

                                                                {/* Rate Input */}
                                                                <div className="mb-4">
                                                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Valor de Cambio</label>
                                                                    <div className="relative">
                                                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                                                                            $1 USD =
                                                                        </div>
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
                                                                            className="w-full pl-24 pr-16 py-3 border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white rounded-xl font-mono font-black text-slate-800 text-xl focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-sm"
                                                                        />
                                                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-600 font-black text-sm">
                                                                            {rate.currency_symbol}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Actions */}
                                                                <div className="flex gap-2 pt-3 border-t border-slate-100">
                                                                    <button
                                                                        onClick={() => !rate.is_default && handleUpdateRate(rate.id, 'is_default', true)}
                                                                        disabled={rate.is_default}
                                                                        className={clsx(
                                                                            "flex-1 py-2 px-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2",
                                                                            rate.is_default
                                                                                ? "bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 cursor-default border-2 border-amber-200"
                                                                                : "bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 border-2 border-transparent"
                                                                        )}
                                                                        title={rate.is_default ? "Tasa Predeterminada" : "Marcar como predeterminada"}
                                                                    >
                                                                        <Star size={16} fill={rate.is_default ? 'currentColor' : 'none'} strokeWidth={2.5} />
                                                                        {rate.is_default ? 'Predeterminada' : 'Marcar'}
                                                                    </button>

                                                                    {!rate.is_default && (
                                                                        <button
                                                                            onClick={() => handleDeleteRate(rate.id)}
                                                                            className="px-3 py-2 text-rose-500 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all border-2 border-transparent hover:border-rose-200"
                                                                            title="Eliminar"
                                                                        >
                                                                            <Trash2 size={18} strokeWidth={2.5} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center py-20 bg-gradient-to-br from-slate-50 to-indigo-50/30 rounded-2xl border-2 border-dashed border-slate-300 text-center px-4">
                                                        <div className="bg-white p-6 rounded-2xl shadow-lg mb-4">
                                                            <Coins size={48} className="text-slate-300" strokeWidth={1.5} />
                                                        </div>
                                                        <h4 className="text-xl font-black text-slate-700 mb-2">Sin tasas configuradas</h4>
                                                        <p className="text-slate-500 max-w-xs text-sm font-medium">
                                                            Para {selectedCurrInfo?.name} aún no tienes perfiles de tasa activos.
                                                        </p>
                                                        <button
                                                            onClick={() => setShowAddRateModal(true)}
                                                            className="mt-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-black flex items-center shadow-lg shadow-indigo-200 transition-all hover:-translate-y-1 active:scale-95 gap-2"
                                                        >
                                                            <Plus size={20} strokeWidth={2.5} /> Crear Primera Tasa
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4 py-20">
                                                <div className="bg-slate-100 p-8 rounded-full">
                                                    <Globe size={64} className="opacity-30" strokeWidth={1.5} />
                                                </div>
                                                <p className="font-bold text-lg text-slate-500">Selecciona una moneda</p>
                                                <p className="text-sm text-slate-400 max-w-xs text-center">Elige una moneda de la lista para gestionar sus tasas de cambio</p>
                                            </div>
                                        )}
                                    </div>
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

