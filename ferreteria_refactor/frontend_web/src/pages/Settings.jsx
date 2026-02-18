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
import CurrencyConfig from './Settings/CurrencyConfig';
import POSConfig from './Settings/POSConfig';
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
        if (activeTab === 'taxes') {
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
                                                activeTab === 'taxes' ? 'Impuestos' :
                                                    activeTab === 'tickets' ? 'Impresoras' :
                                                        activeTab === 'payments' ? 'Métodos de Pago' :
                                                            activeTab === 'pos' ? 'Estación POS' : 'Configuración'}
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
                        {activeTab === 'currencies' && <CurrencyConfig />}

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
                        {activeTab === 'pos' && <POSConfig />}

                    </div>
                </ScrollArea>
            </main>
        </div>
    );
};

export default Settings;
