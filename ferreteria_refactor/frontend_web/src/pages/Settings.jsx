import { useState, useEffect } from 'react';
import {
    Building2, Coins, Receipt, Save, RefreshCw, Trash2, Plus,
    Edit, Check, X, Star, AlertCircle, Loader2, Globe, Printer,
    CreditCard, ChevronRight, DollarSign, Users, FileText
} from 'lucide-react';
import { useLocation, Link, useSearchParams } from 'react-router-dom';
import { useConfig } from '../context/ConfigContext';
import configService from '../services/configService';
import apiClient from '../config/axios';
import TicketConfig from './Settings/TicketConfig';
import PaymentMethodsConfig from './Settings/PaymentMethodsConfig';
import clsx from 'clsx';
import { toast } from 'react-hot-toast';

// Shadcn UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
// import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'; // Optional if used for logo
import { ScrollArea } from '../components/ui/scroll-area';

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
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'business';
    const { business, refreshConfig } = useConfig();

    // Local Forms State
    const [bizForm, setBizForm] = useState({ name: '', document_id: '', address: '', phone: '', email: '' });
    const [defaultTaxRate, setDefaultTaxRate] = useState('');
    const [isSavingTax, setIsSavingTax] = useState(false);

    // Exchange Rates State
    const [exchangeRates, setExchangeRates] = useState([]);
    const [selectedCurrency, setSelectedCurrency] = useState('USD');
    const [showAddRateModal, setShowAddRateModal] = useState(false);
    const [showAddCurrencyModal, setShowAddCurrencyModal] = useState(false);
    const [newRate, setNewRate] = useState({ name: '', rate: '' });
    const [newCurrency, setNewCurrency] = useState({ code: '', symbol: '' });
    const [isRatesLoading, setIsRatesLoading] = useState(false);
    const [ratesError, setRatesError] = useState(null);

    useEffect(() => {
        if (business) {
            setBizForm({
                name: business.name || '',
                document_id: business.document_id || '',
                address: business.address || '',
                phone: business.phone || '',
                email: business.email || ''
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

    // Exchange Rate Handlers (Simplified for brevity, same logic as before)
    const handleAddRate = async () => {
        if (!newRate.name || !newRate.rate || !selectedCurrency) {
            toast.error('Por favor completa todos los campos');
            return;
        }
        try {
            let symbol = '$';
            const existingRate = exchangeRates.find(r => r.currency_code === selectedCurrency);
            if (existingRate) symbol = existingRate.currency_symbol;
            else {
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
            refreshConfig();
            toast.success('Tasa agregada exitosamente');
        } catch (error) {
            toast.error('Error al agregar tasa');
        }
    };

    const handleUpdateRate = async (rateId, field, value) => {
        try {
            await apiClient.put(`/config/exchange-rates/${rateId}`, { [field]: value });
            fetchExchangeRates();
            refreshConfig();
            if (field === 'is_default' && value) toast.success('Tasa marcada como predeterminada');
            else toast.success('Tasa actualizada');
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
            toast.error('Error al eliminar tasa');
        }
    };

    const handleAddCustomCurrency = () => {
        if (!newCurrency.code || !newCurrency.symbol) return toast.error('Datos incompletos');
        const code = newCurrency.code.toUpperCase();
        setSelectedCurrency(code);
        setShowAddCurrencyModal(false);
        setNewCurrency({ code: '', symbol: '' });
    };

    // Derived State for Currencies
    const groupedRates = Array.isArray(exchangeRates) ? exchangeRates.reduce((acc, rate) => {
        if (!acc[rate.currency_code]) acc[rate.currency_code] = [];
        acc[rate.currency_code].push(rate);
        return acc;
    }, {}) : {};

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

        <div className="flex h-[calc(100vh-theme(spacing.16))] bg-white overflow-hidden">
            {/* Main Content */}
            <main className="flex-1 bg-slate-50/30 overflow-hidden flex flex-col">
                <ScrollArea className="flex-1">
                    <div className="max-w-4xl mx-auto p-8 w-full">

                        {/* HEADER */}
                        <div className="mb-8">
                            <h1 className="text-2xl font-bold text-slate-800">
                                {activeTab === 'business' ? 'General' :
                                    activeTab === 'currencies' ? 'Monedas' :
                                        activeTab === 'taxes' ? 'Impuestos' :
                                            activeTab === 'tickets' ? 'Impresoras' :
                                                activeTab === 'payments' ? 'Métodos de Pago' : 'Configuración'}
                            </h1>
                            <p className="text-slate-500">Administra los parámetros de tu sistema</p>
                        </div>

                        {/* BUSINESS (GENERAL) FORM */}
                        {activeTab === 'business' && (
                            <div className="space-y-6">
                                {/* Identity Card */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Identidad del Negocio</CardTitle>
                                        <CardDescription>Información visible en tickets y reportes</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="bizName">Nombre Comercial</Label>
                                            <Input
                                                id="bizName"
                                                value={bizForm.name}
                                                onChange={e => setBizForm({ ...bizForm, name: e.target.value })}
                                                placeholder="Ej: Ferretería El Roble"
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="bizSlogan">Eslogan / Descripción</Label>
                                            <Input placeholder="Tu aliado en construcción..." />
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Fiscal Data Card */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Datos Fiscales y Contacto</CardTitle>
                                        <CardDescription>Información legal para facturación</CardDescription>
                                    </CardHeader>
                                    <CardContent className="grid md:grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="bizId">RIF / Documento Identidad</Label>
                                            <Input
                                                id="bizId"
                                                value={bizForm.document_id}
                                                onChange={e => setBizForm({ ...bizForm, document_id: e.target.value })}
                                                placeholder="J-12345678-9"
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="bizPhone">Teléfono Principal</Label>
                                            <Input
                                                id="bizPhone"
                                                value={bizForm.phone}
                                                onChange={e => setBizForm({ ...bizForm, phone: e.target.value })}
                                                placeholder="+58 412 1234567"
                                            />
                                        </div>
                                        <div className="grid gap-2 md:col-span-2">
                                            <Label htmlFor="bizEmail">Correo Electrónico</Label>
                                            <Input
                                                id="bizEmail"
                                                value={bizForm.email}
                                                onChange={e => setBizForm({ ...bizForm, email: e.target.value })}
                                                placeholder="contacto@empresa.com"
                                            />
                                        </div>
                                        <div className="grid gap-2 md:col-span-2">
                                            <Label htmlFor="bizAddr">Dirección Fiscal</Label>
                                            <Input
                                                id="bizAddr"
                                                value={bizForm.address}
                                                onChange={e => setBizForm({ ...bizForm, address: e.target.value })}
                                                placeholder="Av. Principal, Edif. A, Local 1"
                                            />
                                        </div>
                                    </CardContent>
                                </Card>

                                <div className="flex justify-end pt-4">
                                    <Button onClick={handleBizSave} size="lg" className="bg-indigo-600 hover:bg-indigo-700">
                                        <Save className="mr-2 h-4 w-4" /> Guardar Cambios
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* CURRENCIES TAB */}
                        {activeTab === 'currencies' && (
                            <Card className="border-slate-200">
                                <CardContent className="p-0">
                                    <div className="bg-white rounded-xl overflow-hidden min-h-[500px] flex flex-col md:flex-row">
                                        {/* Currency Sidebar */}
                                        <div className="md:w-64 bg-slate-50 border-r border-slate-200 flex flex-col">
                                            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                                                <span className="font-bold text-xs uppercase text-slate-500">Monedas</span>
                                                <Button variant="ghost" size="icon" onClick={() => setShowAddCurrencyModal(true)}>
                                                    <Plus className="h-4 w-4 text-indigo-600" />
                                                </Button>
                                            </div>
                                            <ScrollArea className="flex-1 h-[400px]">
                                                {uniqueCurrencies.map(curr => (
                                                    <button
                                                        key={curr.code}
                                                        onClick={() => setSelectedCurrency(curr.code)}
                                                        className={clsx(
                                                            "w-full text-left px-4 py-3 border-b border-slate-100 transition-colors flex items-center justify-between group",
                                                            selectedCurrency === curr.code ? "bg-white border-l-4 border-l-indigo-600" : "hover:bg-slate-100 border-l-4 border-l-transparent"
                                                        )}
                                                    >
                                                        <div>
                                                            <div className="font-bold text-slate-700">{curr.code}</div>
                                                            <div className="text-xs text-slate-500">{curr.name}</div>
                                                        </div>
                                                        {curr.rateCount > 0 && (
                                                            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                                                                {curr.rateCount}
                                                            </span>
                                                        )}
                                                    </button>
                                                ))}
                                            </ScrollArea>
                                        </div>

                                        {/* Rate Content */}
                                        <div className="flex-1 p-6 bg-white flex flex-col">
                                            <div className="flex justify-between items-center mb-6">
                                                <div>
                                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                                        {selectedCurrency} <span className="text-slate-400 font-normal">({selectedCurrInfo?.name})</span>
                                                    </h3>
                                                    <p className="text-sm text-slate-500">1 USD = ??? {selectedCurrency}</p>
                                                </div>
                                                <Button onClick={() => setShowAddRateModal(true)} className="bg-indigo-600 hover:bg-indigo-700">
                                                    <Plus className="mr-2 h-4 w-4" /> Nueva Tasa
                                                </Button>
                                            </div>

                                            <ScrollArea className="flex-1 h-[400px]">
                                                {selectedRates.length > 0 ? (
                                                    <div className="grid gap-4">
                                                        {selectedRates.map(rate => (
                                                            <div key={rate.id} className="border rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center bg-slate-50/50 hover:bg-white hover:shadow-md transition-all">
                                                                <div className="flex-1 w-full">
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <span className="font-bold text-lg">{rate.name}</span>
                                                                        {rate.is_default && <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Star size={10} fill="currentColor" /> Default</span>}
                                                                        {!rate.is_active && <span className="bg-slate-200 text-slate-500 text-xs px-2 py-0.5 rounded-full">Inactivo</span>}
                                                                    </div>

                                                                    {/* Improved Input Layout */}
                                                                    <div className="flex items-center gap-2 max-w-md">
                                                                        <div className="flex-1 flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500">
                                                                            <span className="px-3 py-2 bg-slate-50 text-slate-500 text-sm font-medium border-r">$1 =</span>
                                                                            <input
                                                                                type="number"
                                                                                step="0.0001"
                                                                                defaultValue={rate.rate}
                                                                                onBlur={(e) => {
                                                                                    const val = parseFloat(e.target.value);
                                                                                    if (!isNaN(val) && val !== rate.rate && val >= 0) {
                                                                                        handleUpdateRate(rate.id, 'rate', val);
                                                                                    } else {
                                                                                        e.target.value = rate.rate;
                                                                                    }
                                                                                }}
                                                                                className="flex-1 px-3 py-2 outline-none font-bold text-slate-800"
                                                                            />
                                                                            <span className="px-3 py-2 bg-slate-50 text-slate-500 text-sm font-medium border-l">{rate.currency_symbol}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => handleUpdateRate(rate.id, 'is_active', !rate.is_active)}
                                                                        className={rate.is_active ? "text-emerald-600 border-emerald-200 bg-emerald-50" : "text-slate-400"}
                                                                    >
                                                                        {rate.is_active ? 'Activo' : 'Inactivo'}
                                                                    </Button>
                                                                    {!rate.is_default && (
                                                                        <>
                                                                            <Button variant="ghost" size="sm" onClick={() => handleUpdateRate(rate.id, 'is_default', true)}>
                                                                                <Star className="h-4 w-4" />
                                                                            </Button>
                                                                            <Button variant="ghost" size="sm" onClick={() => handleDeleteRate(rate.id)} className="text-rose-500 hover:text-rose-600 hover:bg-rose-50">
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 border-2 border-dashed border-slate-200 rounded-xl">
                                                        <Coins size={48} className="mb-4 opacity-20" />
                                                        <p>No hay tasas configuradas para {selectedCurrency}</p>
                                                        <Button variant="link" onClick={() => setShowAddRateModal(true)}>Crear una ahora</Button>
                                                    </div>
                                                )}
                                            </ScrollArea>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* TAXES TAB */}
                        {activeTab === 'taxes' && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Configuración de Impuestos</CardTitle>
                                    <CardDescription>Define el IVA por defecto para nuevos productos</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="max-w-xs">
                                        <Label>Impuesto General (%)</Label>
                                        <div className="flex gap-2 mt-2">
                                            <Input
                                                type="number"
                                                value={defaultTaxRate}
                                                onChange={e => setDefaultTaxRate(e.target.value)}
                                                placeholder="16.00"
                                            />
                                            <Button onClick={handleSaveTaxRate} disabled={isSavingTax}>
                                                {isSavingTax ? <Loader2 className="animate-spin" /> : <Save size={16} />}
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {activeTab === 'tickets' && <TicketConfig />}
                        {activeTab === 'payments' && <PaymentMethodsConfig />}

                    </div>
                </ScrollArea>
            </main>

            {/* KEEP EXISTING MODALS (Simplified Structure) */}
            {/* Modal: New Currency */}
            {showAddCurrencyModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-sm">
                        <CardHeader>
                            <CardTitle>Nueva Moneda</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Código ISO</Label>
                                <Input value={newCurrency.code} onChange={e => setNewCurrency({ ...newCurrency, code: e.target.value.toUpperCase() })} placeholder="USD" maxLength={3} />
                            </div>
                            <div>
                                <Label>Símbolo</Label>
                                <Input value={newCurrency.symbol} onChange={e => setNewCurrency({ ...newCurrency, symbol: e.target.value })} placeholder="$" />
                            </div>
                        </CardContent>
                        <CardFooter className="justify-end gap-2">
                            <Button variant="ghost" onClick={() => setShowAddCurrencyModal(false)}>Cancelar</Button>
                            <Button onClick={handleAddCustomCurrency}>Guardar</Button>
                        </CardFooter>
                    </Card>
                </div>
            )}

            {/* Modal: New Rate */}
            {showAddRateModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle>Nueva Tasa para {selectedCurrency}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Nombre</Label>
                                <Input value={newRate.name} onChange={e => setNewRate({ ...newRate, name: e.target.value })} placeholder="Ej: BCV" />
                            </div>
                            <div>
                                <Label>Tasa ({selectedCurrency}) por 1 USD</Label>
                                <Input type="number" step="0.0001" value={newRate.rate} onChange={e => setNewRate({ ...newRate, rate: e.target.value })} placeholder="0.0000" />
                            </div>
                        </CardContent>
                        <CardFooter className="justify-end gap-2">
                            <Button variant="ghost" onClick={() => setShowAddRateModal(false)}>Cancelar</Button>
                            <Button onClick={handleAddRate}>Guardar</Button>
                        </CardFooter>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default Settings;
