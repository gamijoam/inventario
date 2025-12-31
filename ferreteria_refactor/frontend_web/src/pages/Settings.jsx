import { useState, useEffect } from 'react';
import { Building2, Coins, Receipt, Save, RefreshCw, Trash2, Plus, Edit, Check, X, Star, AlertCircle, Loader2, Globe, Printer, CreditCard } from 'lucide-react';
import { useConfig } from '../context/ConfigContext';
import configService from '../services/configService';
import apiClient from '../config/axios';
import TicketConfig from './Settings/TicketConfig';  // NEW
import PaymentMethodsConfig from './Settings/PaymentMethodsConfig'; // NEW

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
        console.log("🛠️ FETCHING EXCHANGE RATES...");
        try {
            const response = await apiClient.get('/config/exchange-rates');
            console.log("✅ EXCHANGE RATES LOADED:", response.data);

            if (!Array.isArray(response.data)) {
                console.error("❌ API returned non-array data:", response.data);
                setExchangeRates([]);
                setRatesError("La API no devolvió una lista válida.");
                return;
            }

            setExchangeRates(response.data);
        } catch (error) {
            console.error('❌ Error fetching exchange rates:', error);
            setRatesError(error.response?.data?.detail || "Error de conexión con el servidor");
        } finally {
            setIsRatesLoading(false);
        }
    };

    const handleBizSave = async () => {
        try {
            await configService.updateBusinessInfo(bizForm);
            alert("✅ Datos de negocio actualizados");
            refreshConfig();
        } catch (e) { console.error(e); alert("❌ Error al guardar"); }
    };

    const handleSaveTaxRate = async () => {
        setIsSavingTax(true);
        try {
            await apiClient.put('/config/tax-rate/default', { rate: parseFloat(defaultTaxRate) });
            alert("✅ Impuesto por defecto actualizado");
        } catch (error) {
            console.error(error);
            alert("❌ Error al guardar impuesto");
        } finally {
            setIsSavingTax(false);
        }
    };

    const handleAddRate = async () => {
        if (!newRate.name || !newRate.rate || !selectedCurrency) {
            alert('Por favor completa todos los campos');
            return;
        }

        try {
            // Find symbol from existing rates or predefined list
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
            alert('✅ Tasa agregada exitosamente');
        } catch (error) {
            console.error('Error adding rate:', error);
            alert('❌ Error al agregar tasa: ' + (error.response?.data?.detail || "Error desconocido"));
        }
    };

    const handleUpdateRate = async (rateId, field, value) => {
        try {
            await apiClient.put(`/config/exchange-rates/${rateId}`, {
                [field]: value
            });
            fetchExchangeRates();
        } catch (error) {
            console.error('Error updating rate:', error);
            alert('❌ Error al actualizar tasa');
        }
    };

    const handleDeleteRate = async (rateId) => {
        if (!confirm('¿Eliminar esta tasa?')) return;

        try {
            await apiClient.delete(`/config/exchange-rates/${rateId}`);
            fetchExchangeRates();
            alert('✅ Tasa eliminada');
        } catch (error) {
            console.error('Error deleting rate:', error);
            alert(error.response?.data?.detail || '❌ Error al eliminar tasa');
        }
    };

    const handleAddCustomCurrency = () => {
        if (!newCurrency.code || !newCurrency.symbol) {
            alert('Por favor indica código y símbolo');
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

    return (
        <div className="container mx-auto p-4 max-w-7xl animate-fade-in">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Configuración</h1>

            {/* Tabs Header */}
            <div className="flex border-b mb-6 overflow-x-auto scrollbar-hide">
                <button
                    onClick={() => setActiveTab('business')}
                    className={`px-6 py-3 font-medium flex items-center whitespace-nowrap transition-all ${activeTab === 'business' ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                    <Building2 className="mr-2" size={20} /> Negocio
                </button>
                <button
                    onClick={() => setActiveTab('currencies')}
                    className={`px-6 py-3 font-medium flex items-center whitespace-nowrap transition-all ${activeTab === 'currencies' ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                    <Coins className="mr-2" size={20} /> Monedas y Tasas
                </button>
                {/* <button
                    onClick={() => setActiveTab('taxes')}
                    className={`px-6 py-3 font-medium flex items-center whitespace-nowrap transition-all ${activeTab === 'taxes' ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                    <Receipt className="mr-2" size={20} /> Impuestos
                </button> */}
                <button
                    onClick={() => setActiveTab('tickets')}
                    className={`px-6 py-3 font-medium flex items-center whitespace-nowrap transition-all ${activeTab === 'tickets' ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                    <Printer className="mr-2" size={20} /> Tickets
                </button>
                <button
                    onClick={() => setActiveTab('payments')}
                    className={`px-6 py-3 font-medium flex items-center whitespace-nowrap transition-all ${activeTab === 'payments' ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                    <CreditCard className="mr-2" size={20} /> Métodos de Pago
                </button>
            </div>

            {/* Business Tab */}
            {activeTab === 'business' && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Nombre del Negocio</label>
                            <input type="text" className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={bizForm.name} onChange={e => setBizForm({ ...bizForm, name: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">RIF / Documento</label>
                            <input type="text" className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={bizForm.document_id} onChange={e => setBizForm({ ...bizForm, document_id: e.target.value })} />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Dirección</label>
                            <input type="text" className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={bizForm.address} onChange={e => setBizForm({ ...bizForm, address: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Teléfono</label>
                            <input type="text" className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={bizForm.phone} onChange={e => setBizForm({ ...bizForm, phone: e.target.value })} />
                        </div>
                    </div>
                    <button onClick={handleBizSave} className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium flex items-center transition-shadow hover:shadow-lg">
                        <Save className="mr-2" size={18} /> Guardar Cambios
                    </button>
                </div>
            )}

            {/* Currencies Tab - Master-Detail */}
            {activeTab === 'currencies' && (
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden min-h-[600px]">
                    <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">Gestión de Tasas de Cambio</h2>
                            <p className="text-gray-500 text-sm">Administra múltiples tasas por moneda (BCV, Paralelo, etc.)</p>
                        </div>
                        <button
                            onClick={fetchExchangeRates}
                            disabled={isRatesLoading}
                            className="bg-white hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-lg border shadow-sm font-medium flex items-center transition-all disabled:opacity-50"
                        >
                            {isRatesLoading ? <Loader2 size={18} className="mr-2 animate-spin" /> : <RefreshCw size={18} className="mr-2" />}
                            Actualizar
                        </button>
                    </div>

                    {ratesError && (
                        <div className="m-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center">
                            <AlertCircle size={20} className="mr-3 flex-shrink-0" />
                            <p>{ratesError}</p>
                        </div>
                    )}

                    {/* ANCHOR CURRENCY BANNER */}
                    <div className="mx-6 mt-6 mb-4 p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="bg-emerald-500 p-3 rounded-xl shadow-md">
                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-emerald-900 flex items-center gap-2">
                                        <span className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-sm font-bold shadow">ANCLA</span>
                                        Moneda Base del Sistema
                                    </h3>
                                    <p className="text-emerald-700 font-medium mt-1">
                                        Todas las tasas están ancladas a: <span className="font-black text-emerald-900">USD (Dólar Americano)</span>
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="bg-white px-6 py-3 rounded-xl shadow-md border-2 border-emerald-300">
                                    <div className="text-5xl font-black text-emerald-600">$</div>
                                    <div className="text-xs text-emerald-700 font-bold mt-1">1.00 USD</div>
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-emerald-200">
                            <p className="text-xs text-emerald-600 flex items-center gap-2">
                                <AlertCircle size={14} />
                                <span>Todos los precios de productos se almacenan en USD. Las tasas de cambio convierten automáticamente a otras monedas.</span>
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-12 h-full min-h-[500px]">
                        {/* LEFT: Currency List */}
                        <div className="col-span-12 md:col-span-3 border-r bg-gray-50/30 overflow-y-auto border-b md:border-b-0">
                            <div className="p-4 bg-white/50 border-b flex justify-between items-center">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Monedas</h3>
                                <button
                                    onClick={() => setShowAddCurrencyModal(true)}
                                    className="p-1 hover:bg-blue-100 text-blue-600 rounded-md transition-colors"
                                    title="Agregar otra moneda"
                                >
                                    <Plus size={18} />
                                </button>
                            </div>
                            <div className="p-3 space-y-2">
                                {uniqueCurrencies.map(curr => (
                                    <button
                                        key={curr.code}
                                        onClick={() => setSelectedCurrency(curr.code)}
                                        className={`w-full text-left p-3 rounded-xl transition-all border ${selectedCurrency === curr.code
                                            ? 'bg-blue-600 text-white shadow-md border-blue-600 transform scale-[1.02]'
                                            : 'bg-white hover:bg-blue-50 text-gray-800 border-gray-100 hover:border-blue-200'
                                            }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${selectedCurrency === curr.code ? 'bg-white/20' : 'bg-blue-50 text-blue-600'}`}>
                                                    <Globe size={18} />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-md leading-none mb-1">{curr.code}</div>
                                                    <div className={`text-[10px] ${selectedCurrency === curr.code ? 'text-blue-100' : 'text-gray-400'}`}>{curr.name}</div>
                                                </div>
                                            </div>
                                            {curr.rateCount > 0 && (
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${selectedCurrency === curr.code ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>
                                                    {curr.rateCount}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* RIGHT: Rate Details */}
                        <div className="col-span-12 md:col-span-9 p-6 overflow-y-auto bg-white">
                            {selectedCurrency ? (
                                <div className="space-y-6">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-6">
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <span className="text-3xl font-black text-gray-800">{selectedCurrency}</span>
                                                <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg shadow-blue-200">
                                                    {selectedCurrInfo?.symbol}
                                                </span>
                                            </div>
                                            <h3 className="text-lg font-medium text-gray-500">
                                                {selectedCurrInfo?.name} - Gestión de Tasas
                                            </h3>
                                        </div>
                                        <button
                                            onClick={() => setShowAddRateModal(true)}
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center shadow-xl shadow-blue-100 transition-all hover:-translate-y-1 active:scale-95"
                                        >
                                            <Plus size={22} className="mr-2" /> Agregar Tasa Adicional
                                        </button>
                                    </div>

                                    {/* Rates Table */}
                                    {selectedRates.length > 0 ? (
                                        <div className="bg-white border rounded-2xl overflow-hidden shadow-sm border-gray-100">
                                            <table className="w-full">
                                                <thead className="bg-gray-50/80 border-b">
                                                    <tr>
                                                        <th className="text-left p-4 font-bold text-gray-500 uppercase text-xs tracking-wider">Nombre del Perfil</th>
                                                        <th className="text-left p-4 font-bold text-gray-500 uppercase text-xs tracking-wider">Valor (1 USD =)</th>
                                                        <th className="text-center p-4 font-bold text-gray-500 uppercase text-xs tracking-wider">Default</th>
                                                        <th className="text-center p-4 font-bold text-gray-500 uppercase text-xs tracking-wider">Estado</th>
                                                        <th className="text-center p-4 font-bold text-gray-500 uppercase text-xs tracking-wider">Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {selectedRates.map(rate => (
                                                        <tr key={rate.id} className="hover:bg-blue-50/20 transition-colors group">
                                                            <td className="p-4">
                                                                <div className="font-bold text-gray-700">{rate.name}</div>
                                                                <div className="text-[10px] text-gray-400 font-mono tracking-tighter">REF: #{rate.id.toString().padStart(4, '0')}</div>
                                                            </td>
                                                            <td className="p-4">
                                                                <div className="relative w-48">
                                                                    <span className="absolute left-3 top-2.5 text-emerald-600 text-sm font-bold">1 USD =</span>
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
                                                                        className="pl-24 pr-12 border-gray-100 bg-gray-50/50 rounded-xl px-3 py-2.5 w-full font-mono font-bold text-gray-700 focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                                                                    />
                                                                    <span className="absolute right-3 top-2.5 text-blue-600 text-sm font-bold">{rate.currency_symbol}</span>
                                                                </div>
                                                            </td>
                                                            <td className="p-4 text-center">
                                                                <button
                                                                    onClick={() => !rate.is_default && handleUpdateRate(rate.id, 'is_default', true)}
                                                                    className={`p-2.5 rounded-xl transition-all ${rate.is_default
                                                                        ? 'bg-amber-100 text-amber-600 shadow-md shadow-amber-100 border border-amber-200'
                                                                        : 'bg-gray-50 text-gray-300 hover:text-amber-400 border border-gray-100'
                                                                        }`}
                                                                >
                                                                    <Star size={20} fill={rate.is_default ? 'currentColor' : 'none'} />
                                                                </button>
                                                            </td>
                                                            <td className="p-4 text-center">
                                                                <button
                                                                    onClick={() => handleUpdateRate(rate.id, 'is_active', !rate.is_active)}
                                                                    className={`relative inline-flex h-6 w-12 items-center rounded-full transition-all ${rate.is_active ? 'bg-green-500 shadow-inner' : 'bg-gray-200'
                                                                        }`}
                                                                >
                                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-all ${rate.is_active ? 'translate-x-7' : 'translate-x-1'
                                                                        }`} />
                                                                </button>
                                                            </td>
                                                            <td className="p-4 text-center">
                                                                {!rate.is_default ? (
                                                                    <button
                                                                        onClick={() => handleDeleteRate(rate.id)}
                                                                        className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                                                    >
                                                                        <Trash2 size={20} />
                                                                    </button>
                                                                ) : (
                                                                    <Check className="mx-auto text-green-500" size={20} />
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-20 bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-200">
                                            <div className="bg-white p-6 rounded-full shadow-xl mb-4">
                                                <AlertCircle size={48} className="text-blue-500 animate-pulse" />
                                            </div>
                                            <h4 className="text-xl font-bold text-gray-700">Sin tasas configuradas</h4>
                                            <p className="text-gray-500 mt-2 max-w-xs text-center">
                                                Para {selectedCurrInfo?.name} aún no tienes perfiles de tasa activos. Pulsa el botón de arriba para agregar el primero.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-gray-400 space-y-6 h-full">
                                    <div className="bg-blue-50 p-10 rounded-full">
                                        <Globe size={84} className="text-blue-200 opacity-50" />
                                    </div>
                                    <div className="text-center">
                                        <h4 className="text-2xl font-bold text-gray-700">Explora tus Monedas</h4>
                                        <p className="text-md max-w-sm mx-auto mt-2 leading-relaxed">
                                            Selecciona un país o código de moneda a la izquierda para ver y ajustar sus tasas de cambio activas.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Agregar Moneda Personalizada */}
            {showAddCurrencyModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[60] p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm border-t-8 border-blue-600 overflow-hidden">
                        <div className="p-8">
                            <h3 className="text-2xl font-black text-gray-800 mb-2">Nueva Moneda</h3>
                            <p className="text-gray-500 text-sm mb-6">Agrega un código de moneda que no esté en la lista predeterminada.</p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-400 mb-1 ml-1">Código (ISO)</label>
                                    <input
                                        type="text"
                                        maxLength={3}
                                        value={newCurrency.code}
                                        onChange={e => setNewCurrency({ ...newCurrency, code: e.target.value.toUpperCase() })}
                                        className="w-full p-4 bg-gray-100 rounded-2xl border-none outline-none focus:ring-4 focus:ring-blue-100 font-black text-2xl tracking-tighter transition-all"
                                        placeholder="EX: CLP"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-400 mb-1 ml-1">Símbolo</label>
                                    <input
                                        type="text"
                                        value={newCurrency.symbol}
                                        onChange={e => setNewCurrency({ ...newCurrency, symbol: e.target.value })}
                                        className="w-full p-4 bg-gray-100 rounded-2xl border-none outline-none focus:ring-4 focus:ring-blue-100 font-black text-xl transition-all"
                                        placeholder="EX: $"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 flex gap-2">
                            <button onClick={() => setShowAddCurrencyModal(false)} className="flex-1 py-4 font-bold text-gray-400 hover:text-gray-600 transition-colors">Cerrar</button>
                            <button onClick={handleAddCustomCurrency} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 active:scale-95 transition-all">Activar Código</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Agregar Tasa */}
            {showAddRateModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border overflow-hidden">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-xl font-bold text-gray-800">Nueva Tasa para {selectedCurrency}</h3>
                            <button
                                onClick={() => {
                                    setShowAddRateModal(false);
                                    setNewRate({ name: '', rate: '' });
                                }}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Nombre descriptivo (Perfil)
                                </label>
                                <input
                                    type="text"
                                    value={newRate.name}
                                    onChange={(e) => setNewRate({ ...newRate, name: e.target.value })}
                                    placeholder="Ej: BCV, Tasa Paralela, Mayorista"
                                    className="w-full p-3 border border-gray-200 bg-gray-50 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-medium"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Valor de la tasa (1 USD =)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3.5 text-gray-400 font-bold">{selectedCurrInfo?.symbol}</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={newRate.rate}
                                        onChange={(e) => setNewRate({ ...newRate, rate: e.target.value })}
                                        placeholder="0.00"
                                        className="w-full pl-10 p-3 border border-gray-200 bg-gray-50 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-mono font-bold"
                                    />
                                </div>
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                                <AlertCircle className="text-amber-500 flex-shrink-0" size={20} />
                                <p className="text-xs text-amber-800 leading-relaxed font-medium">
                                    Importante: Esta tasa se utilizará para convertir los precios base en USD del sistema a {selectedCurrInfo?.name}.
                                </p>
                            </div>
                        </div>

                        <div className="p-6 bg-gray-50 border-t flex gap-3">
                            <button
                                onClick={() => {
                                    setShowAddRateModal(false);
                                    setNewRate({ name: '', rate: '' });
                                }}
                                className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-100 font-bold transition-all shadow-sm"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAddRate}
                                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 transition-all hover:-translate-y-1"
                            >
                                Crear Perfil
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Taxes Tab - HIDDEN */}
            {/* {activeTab === 'taxes' && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 max-w-2xl mx-auto">
                    <div className="text-center mb-8">
                        <div className="bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Receipt className="text-orange-600" size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800">Configuración de Impuestos</h2>
                        <p className="text-gray-500">Define el impuesto por defecto para nuevos productos.</p>
                    </div>

                    <div className="bg-orange-50 rounded-xl p-8 border border-orange-200">
                        <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">
                            Tasa de Impuesto General (Default)
                        </label>

                        <div className="flex items-center gap-4">
                            <div className="relative flex-1">
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    value={defaultTaxRate}
                                    onChange={(e) => setDefaultTaxRate(e.target.value)}
                                    className="w-full pl-5 pr-12 py-4 text-3xl font-black text-gray-800 bg-white border-2 border-orange-200 rounded-xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none transition-all placeholder-gray-300"
                                    placeholder="0.00"
                                />
                                <span className="absolute right-6 top-1/2 transform -translate-y-1/2 text-xl font-bold text-gray-400">%</span>
                            </div>

                            <button
                                onClick={handleSaveTaxRate}
                                disabled={isSavingTax}
                                className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-orange-200 transition-all hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                            >
                                {isSavingTax ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />}
                                <span className="ml-2">Guardar</span>
                            </button>
                        </div>

                        <p className="mt-4 text-sm text-orange-700 font-medium flex items-start">
                            <AlertCircle size={16} className="mr-2 mt-0.5 flex-shrink-0" />
                            Este valor se aplicará automáticamente a los nuevos productos que crees. Puedes anularlo manualmente en cada producto.
                        </p>
                    </div>
                </div>
            )} */}

            {/* Tickets Tab - NEW */}
            {activeTab === 'tickets' && (
                <TicketConfig />
            )}

            {/* Payment Methods Tab - NEW */}
            {activeTab === 'payments' && (
                <PaymentMethodsConfig />
            )}
        </div>
    );
};

export default Settings;
