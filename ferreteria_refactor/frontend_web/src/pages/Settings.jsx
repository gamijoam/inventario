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
    const [editingRate, setEditingRate] = useState(null); // New state for editing
    const [newCurrency, setNewCurrency] = useState({ code: '', symbol: '' });
    const [isRatesLoading, setIsRatesLoading] = useState(false);
    const [ratesError, setRatesError] = useState(null);

    // ... (keep existing code up to handleAddRate) ...

    const handleAddRate = async () => {
        if (!newRate.name || !newRate.rate || !selectedCurrency) {
            toast.error('Por favor completa todos los campos');
            return;
        }

        try {
            if (editingRate) {
                // UPDATE EXISTING RATE
                await apiClient.put(`/config/exchange-rates/${editingRate.id}`, {
                    name: newRate.name,
                    rate: parseFloat(newRate.rate),
                    is_active: newRate.is_active // Include is_active status
                });
                toast.success('Tasa actualizada exitosamente');
            } else {
                // CREATE NEW RATE
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
                    is_active: newRate.is_active !== undefined ? newRate.is_active : true
                });
                toast.success('Tasa agregada exitosamente');
            }

            setNewRate({ name: '', rate: '' });
            setEditingRate(null);
            setShowAddRateModal(false);
            fetchExchangeRates();
            refreshConfig();
        } catch (error) {
            console.error('Error saving rate:', error);
            toast.error('Error al guardar tasa: ' + (error.response?.data?.detail || "Error desconocido"));
        }
    };

    // ... (keep handleUpdateRate, handleDeleteRate, etc.) ...

    // ... (Inside the render loop for rates) ...


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

                    {/* Currencies Tab (REDESIGNED) */}
                    {activeTab === 'currencies' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                            {/* Header & Actions */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Monedas y Tasas de Cambio</h2>
                                    <p className="text-slate-500 font-medium mt-1">Configura las monedas aceptadas y sus tasas de conversión diarias.</p>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={fetchExchangeRates}
                                        disabled={isRatesLoading}
                                        className="bg-white hover:bg-slate-50 text-slate-600 px-4 py-3 rounded-xl border-2 border-slate-100 font-bold flex items-center transition-all disabled:opacity-50 gap-2 shadow-sm active:scale-95"
                                    >
                                        {isRatesLoading ? <Loader2 size={20} className="animate-spin" /> : <RefreshCw size={20} />}
                                        <span className="hidden sm:inline">Actualizar</span>
                                    </button>
                                    <button
                                        onClick={() => setShowAddCurrencyModal(true)}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl font-bold flex items-center shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5 active:scale-95 gap-2"
                                    >
                                        <Plus size={20} />
                                        <span>Nueva Moneda</span>
                                    </button>
                                </div>
                            </div>

                            {ratesError && (
                                <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl flex items-center shadow-sm">
                                    <AlertCircle size={24} className="mr-3 flex-shrink-0" />
                                    <p className="font-bold">{ratesError}</p>
                                </div>
                            )}

                            {/* Base Currency Card */}
                            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 text-white shadow-xl shadow-emerald-200 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                                    <div className="flex items-center gap-5">
                                        <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
                                            <Coins size={32} className="text-white" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="bg-emerald-400/30 text-emerald-50 border border-emerald-400/50 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">
                                                    Base del Sistema
                                                </span>
                                            </div>
                                            <h3 className="text-2xl font-black tracking-tight">Dólar Americano (USD)</h3>
                                            <p className="text-emerald-50 font-medium opacity-90">Todas las operaciones se calculan en base a esta moneda.</p>
                                        </div>
                                    </div>
                                    <div className="text-center md:text-right bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/20">
                                        <div className="text-xs font-bold text-emerald-100 uppercase tracking-widest mb-1">Tasa Base</div>
                                        <div className="text-3xl font-black font-mono tracking-tight text-white">$ 1.00</div>
                                    </div>
                                </div>
                            </div>

                            {/* Currency Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {uniqueCurrencies.filter(c => c.code !== 'USD').map(curr => {
                                    const rates = groupedRates[curr.code] || [];
                                    const defaultRate = rates.find(r => r.is_default);

                                    return (
                                        <div key={curr.code} className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col h-full overflow-hidden group">
                                            {/* Card Header */}
                                            <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-xl font-bold text-slate-700">
                                                        {curr.symbol}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {defaultRate && (
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Tasa Actual</span>
                                                                <span className="font-mono font-bold text-slate-800 text-lg">
                                                                    {parseFloat(defaultRate.rate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} {curr.symbol}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div>
                                                    <h3 className="text-xl font-black text-slate-800 tracking-tight">{curr.name}</h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase tracking-wider border border-slate-200">
                                                            {curr.code}
                                                        </span>
                                                        <span className="text-xs font-medium text-slate-400">
                                                            {rates.length} {rates.length === 1 ? 'tasa configurada' : 'tasas configuradas'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Rates List (Mini Table) */}
                                            <div className="flex-1 p-0">
                                                {rates.length > 0 ? (
                                                    <div className="divide-y divide-slate-50">
                                                        {rates.map(rate => (
                                                            <div key={rate.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group/item">
                                                                <div className="flex flex-col gap-0.5">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={clsx("font-bold text-sm", !rate.is_active && "text-slate-400 line-through decoration-slate-300")}>{rate.name}</span>
                                                                        {rate.is_default && (
                                                                            <Star size={12} className="text-amber-500 fill-amber-500" />
                                                                        )}
                                                                        {!rate.is_active && (
                                                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded ml-1">INACTIVA</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-xs font-mono text-slate-400">
                                                                        1 USD = {parseFloat(rate.rate).toLocaleString()}
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 transition-opacity">
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingRate(rate);
                                                                            setNewRate({ name: rate.name, rate: rate.rate, is_active: rate.is_active });
                                                                            setShowAddRateModal(true);
                                                                        }}
                                                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                                        title="Editar Tasa"
                                                                    >
                                                                        <Edit size={16} />
                                                                    </button>

                                                                    <button
                                                                        onClick={() => handleUpdateRate(rate.id, 'is_active', !rate.is_active)}
                                                                        className={clsx(
                                                                            "p-2 rounded-lg transition-colors",
                                                                            rate.is_active
                                                                                ? "text-emerald-500 hover:bg-emerald-50"
                                                                                : "text-slate-300 hover:text-emerald-500 hover:bg-emerald-50"
                                                                        )}
                                                                        title={rate.is_active ? "Desactivar" : "Activar"}
                                                                    >
                                                                        <Check size={16} className={clsx(rate.is_active ? "opacity-100" : "opacity-50")} />
                                                                    </button>

                                                                    {!rate.is_default && (
                                                                        <button
                                                                            onClick={() => handleUpdateRate(rate.id, 'is_default', true)}
                                                                            className="p-2 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-lg"
                                                                            title="Hacer Predeterminada"
                                                                        >
                                                                            <Star size={18} />
                                                                        </button>
                                                                    )}

                                                                    <button
                                                                        onClick={() => handleDeleteRate(rate.id)}
                                                                        disabled={rate.is_default}
                                                                        className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg disabled:opacity-0"
                                                                        title="Eliminar"
                                                                    >
                                                                        <Trash2 size={18} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="p-8 text-center">
                                                        <p className="text-slate-400 text-sm font-medium">No hay tasas creadas.</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Card Footer */}
                                            <div className="p-4 border-t border-slate-50 bg-white">
                                                <button
                                                    onClick={() => {
                                                        setSelectedCurrency(curr.code);
                                                        setShowAddRateModal(true);
                                                    }}
                                                    className="w-full py-3 rounded-xl border-2 border-dashed border-slate-200 text-slate-500 font-bold hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 group/btn"
                                                >
                                                    <Plus size={18} className="group-hover/btn:scale-110 transition-transform" />
                                                    Agregar Tasa
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Add Currency "Ghost" Card */}
                                <button
                                    onClick={() => setShowAddCurrencyModal(true)}
                                    className="bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-8 text-slate-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all group min-h-[300px]"
                                >
                                    <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                                        <Plus size={32} />
                                    </div>
                                    <h3 className="text-lg font-bold">Agregar Otra Moneda</h3>
                                    <p className="text-sm font-medium mt-1 opacity-70">Ej: Euro, Peso Chileno...</p>
                                </button>
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
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden transform scale-100 ring-4 ring-white/50">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Globe className="text-indigo-600" size={24} /> Nueva Moneda
                            </h3>
                            <button onClick={() => setShowAddCurrencyModal(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            <p className="text-slate-500 text-sm font-medium leading-relaxed">Agrega un código de moneda internacional para empezar a gestionar sus tasas.</p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 pl-1">Código ISO 4217</label>
                                    <input
                                        type="text"
                                        maxLength={3}
                                        value={newCurrency.code}
                                        onChange={e => setNewCurrency({ ...newCurrency, code: e.target.value.toUpperCase() })}
                                        className="w-full text-center p-4 text-3xl font-black text-slate-800 bg-slate-50/50 rounded-2xl border-2 border-slate-100 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all uppercase placeholder:text-slate-300"
                                        placeholder="EUR"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 pl-1">Símbolo Visual</label>
                                    <input
                                        type="text"
                                        value={newCurrency.symbol}
                                        onChange={e => setNewCurrency({ ...newCurrency, symbol: e.target.value })}
                                        className="w-full text-center p-4 text-xl font-bold text-slate-800 bg-slate-50/50 rounded-2xl border-2 border-slate-100 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-slate-300"
                                        placeholder="€"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                            <button onClick={() => setShowAddCurrencyModal(false)} className="flex-1 py-3.5 font-bold text-slate-500 hover:bg-white hover:shadow-sm rounded-xl transition-all">Cancelar</button>
                            <button onClick={handleAddCustomCurrency} className="flex-1 py-3.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all">Guardar Moneda</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Agregar Tasa */}
            {showAddRateModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform scale-100 ring-4 ring-white/50">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">{editingRate ? 'Editar Tasa' : 'Nueva Tasa'}</h3>
                                <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider mt-0.5">Para {selectedCurrInfo?.name}</p>
                            </div>
                            <button
                                onClick={() => { setShowAddRateModal(false); setNewRate({ name: '', rate: '' }); setEditingRate(null); }}
                                className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 pl-1">
                                    Nombre del Perfil
                                </label>
                                <input
                                    type="text"
                                    value={newRate.name}
                                    onChange={(e) => setNewRate({ ...newRate, name: e.target.value })}
                                    placeholder="Ej: Banco Central, Paralelo, Mayorista"
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-slate-700 placeholder:text-slate-300 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 pl-1">
                                    Valor de la Tasa
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <span className="text-slate-400 font-bold text-sm">1 USD =</span>
                                    </div>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={newRate.rate}
                                        onChange={(e) => setNewRate({ ...newRate, rate: e.target.value })}
                                        placeholder="0.00"
                                        className="w-full pl-20 pr-12 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-mono text-xl font-bold text-slate-800 placeholder:text-slate-300 transition-all"
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                                        <span className="text-slate-400 font-bold text-sm">{selectedCurrInfo?.symbol}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={newRate.is_active !== false} // Default to true if undefined
                                        onChange={(e) => setNewRate({ ...newRate, is_active: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                                <div>
                                    <span className="block text-sm font-bold text-slate-700">Tasa Activa</span>
                                    <span className="block text-xs text-slate-500">Si se desactiva, no aparecerá en el POS o facturación.</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                            <button
                                onClick={() => { setShowAddRateModal(false); setNewRate({ name: '', rate: '' }); setEditingRate(null); }}
                                className="px-6 py-3 text-slate-500 hover:bg-white hover:text-slate-700 hover:shadow-sm font-bold rounded-xl transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAddRate}
                                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5 active:scale-95 flex items-center gap-2"
                            >
                                <Save size={18} /> {editingRate ? 'Actualizar' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
