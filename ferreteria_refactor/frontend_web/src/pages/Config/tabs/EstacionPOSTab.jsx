import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { Download, Monitor, ReceiptText, Server, BadgeDollarSign, Copy, CheckCircle2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { API_ROOT_URL } from '../../../config/constants';
import { toast } from 'react-hot-toast';
import apiClient from '../../../config/axios';
import { getApiErrorMessage } from '../../../utils/apiErrors';

const SettingSection = ({ icon: Icon, title, description, children, action }) => (
    <Card className="overflow-hidden rounded-lg border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
                        <Icon className="h-5 w-5" />
                    </div>
                    <div>
                        <CardTitle className="text-lg font-black text-slate-900">{title}</CardTitle>
                        <CardDescription className="mt-1 text-xs font-medium text-slate-500">{description}</CardDescription>
                    </div>
                </div>
                {action}
            </div>
        </CardHeader>
        <CardContent className="p-5">{children}</CardContent>
    </Card>
);

const ToggleSwitch = ({ active, disabled, onClick, activeClass = 'bg-indigo-600' }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`relative h-6 w-12 rounded-full transition-all duration-300 focus:outline-none disabled:opacity-50 ${active ? activeClass : 'bg-slate-300'}`}
    >
        <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ${active ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
);

const StatusPill = ({ tone = 'slate', children }) => {
    const tones = {
        emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
        amber: 'border-amber-200 bg-amber-50 text-amber-700',
        slate: 'border-slate-200 bg-slate-50 text-slate-600',
    };
    return (
        <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${tones[tone] || tones.slate}`}>
            {children}
        </span>
    );
};

const CopyField = ({ label, value, onCopy, buttonLabel = 'Copiar', mono = true }) => (
    <div className="grid gap-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</label>
        <div className="flex gap-2">
            <code className={`min-w-0 flex-1 truncate rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 ${mono ? 'font-mono' : 'font-semibold'}`}>
                {value}
            </code>
            <Button variant="outline" size="sm" onClick={onCopy} className="shrink-0 gap-1.5">
                <Copy size={13} /> {buttonLabel}
            </Button>
        </div>
    </div>
);

const EstacionPOSTab = () => {
    const { user } = useAuth();
    const [autoPrint, setAutoPrint] = useState(false);
    const [loadingAutoPrint, setLoadingAutoPrint] = useState(true);
    const [savingAutoPrint, setSavingAutoPrint] = useState(false);
    const [priceLists, setPriceLists] = useState([]);
    const [defaultPriceListId, setDefaultPriceListId] = useState('');
    const [baseCurrencyCode, setBaseCurrencyCode] = useState('FLEX');
    const [basePaymentPolicy, setBasePaymentPolicy] = useState('flexible');
    const [showBs, setShowBs] = useState(true);
    const [savingPricing, setSavingPricing] = useState(false);

    useEffect(() => {
        apiClient.get('/price-lists/', { params: { active_only: true } })
            .then(r => setPriceLists(r.data || []))
            .catch(() => {});
        apiClient.get('/config/pos_default_price_list_id')
            .then(r => setDefaultPriceListId(r.data?.value || ''))
            .catch(() => setDefaultPriceListId(''));
        apiClient.get('/config/pos_base_currency_code')
            .then(r => setBaseCurrencyCode(r.data?.value || 'FLEX'))
            .catch(() => setBaseCurrencyCode('FLEX'));
        apiClient.get('/config/pos_base_payment_policy')
            .then(r => setBasePaymentPolicy(r.data?.value || 'flexible'))
            .catch(() => setBasePaymentPolicy('flexible'));
        apiClient.get('/config/pos_show_bs')
            .then(r => setShowBs(r.data?.value !== 'false'))
            .catch(() => setShowBs(true));
        apiClient.get('/config/pos/auto-print-ticket')
            .then(r => setAutoPrint(r.data.auto_print_ticket))
            .catch(() => {})
            .finally(() => setLoadingAutoPrint(false));
    }, []);

    const saveDefaultPriceList = async (value) => {
        setSavingPricing(true);
        setDefaultPriceListId(value);
        try {
            await apiClient.put('/config/pos_default_price_list_id', { key: 'pos_default_price_list_id', value: value || '' });
            toast.success(value
                ? `Lista predeterminada: ${priceLists.find(l => String(l.id) === String(value))?.name || value}`
                : 'Precio base predeterminado');
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'No se pudo guardar la lista predeterminada'));
        } finally {
            setSavingPricing(false);
        }
    };

    const saveBasePricePolicy = async (patch) => {
        const nextCurrency = patch.currency_code ?? baseCurrencyCode;
        let nextPolicy = patch.payment_policy ?? basePaymentPolicy;
        if (nextCurrency === 'FLEX') nextPolicy = 'flexible';

        setSavingPricing(true);
        setBaseCurrencyCode(nextCurrency);
        setBasePaymentPolicy(nextPolicy);
        try {
            await Promise.all([
                apiClient.put('/config/pos_base_currency_code', { key: 'pos_base_currency_code', value: nextCurrency }),
                apiClient.put('/config/pos_base_payment_policy', { key: 'pos_base_payment_policy', value: nextPolicy }),
            ]);
            toast.success(nextPolicy === 'strict'
                ? `Precio base limitado a ${nextCurrency}`
                : 'Precio base flexible para cobrar');
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'No se pudo guardar la regla del precio base'));
        } finally {
            setSavingPricing(false);
        }
    };

    const toggleShowBs = async () => {
        const next = !showBs;
        setShowBs(next);
        try {
            await apiClient.put('/config/pos_show_bs', { key: 'pos_show_bs', value: next ? 'true' : 'false' });
            toast.success(next ? 'Mostrando equivalente en Bs' : 'Bs oculto en el POS');
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'No se pudo guardar la preferencia de Bs'));
        }
    };

    const toggleAutoPrint = async () => {
        setSavingAutoPrint(true);
        try {
            const next = !autoPrint;
            const res = await apiClient.post('/config/pos/auto-print-ticket', { enabled: next });
            setAutoPrint(res.data.auto_print_ticket);
            toast.success(res.data.auto_print_ticket
                ? 'Impresión automática activada'
                : 'Impresión automática desactivada');
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'No se pudo guardar la configuracion de impresion'));
        } finally {
            setSavingAutoPrint(false);
        }
    };

    const getWebSocketHost = () => {
        let host = API_ROOT_URL;
        if (host.startsWith('https://')) host = host.replace('https://', 'wss://');
        else if (host.startsWith('http://')) host = host.replace('http://', 'ws://');
        if (host.includes('localhost')) host = host.replace('localhost', '127.0.0.1');
        return host;
    };

    const getTenantId = () => {
        if (user?.tenant_id && user.tenant_id !== 'public') return user.tenant_id;
        const hostname = window.location.hostname;
        const parts = hostname.split('.');
        if (parts.length >= 3 && !hostname.includes('localhost')) {
            const subdomain = parts[0];
            if (!['www', 'api', 'app', 'dashboard', 'qa'].includes(subdomain)) return subdomain;
        }
        return localStorage.getItem('selected_tenant') || 'public';
    };

    const getMagicLink = () => {
        let token = localStorage.getItem('token') || '';
        token = token.replace(/^"|"$/g, '');
        const params = new URLSearchParams({ token, tenant: getTenantId(), host: getWebSocketHost() });
        return `miinventariofacil://config?${params.toString()}`;
    };

    const wsHost = getWebSocketHost();
    const tenantId = getTenantId();
    const tokenPreview = `${localStorage.getItem('token')?.replace(/^"|"$/g, '').substring(0, 20) || '...'}...`;
    const baseIsStrict = basePaymentPolicy === 'strict' && baseCurrencyCode !== 'FLEX';

    return (
        <div className="space-y-5 animate-in fade-in duration-300">
            <div className="rounded-lg border border-indigo-100 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-white shadow-sm">
                            <Monitor size={22} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ventas y POS</p>
                            <h2 className="text-xl font-black text-slate-900">Punto de Venta</h2>
                            <p className="mt-1 text-sm text-slate-500">
                                Reglas de precio, moneda visible e impresión de la estación de caja.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <StatusPill tone={baseIsStrict ? 'indigo' : 'emerald'}>
                            Base {baseIsStrict ? `solo ${baseCurrencyCode}` : 'flexible'}
                        </StatusPill>
                        <StatusPill tone={showBs ? 'emerald' : 'slate'}>
                            Bs {showBs ? 'visible' : 'oculto'}
                        </StatusPill>
                        <StatusPill tone={autoPrint ? 'indigo' : 'slate'}>
                            Auto ticket {autoPrint ? 'activo' : 'manual'}
                        </StatusPill>
                    </div>
                </div>
            </div>

            {user?.role === 'ADMIN' && (
                <SettingSection
                    icon={BadgeDollarSign}
                    title="Precios del POS"
                    description="Define qué precio se aplica al carrito y cómo se comporta el precio base al cobrar."
                >
                    <div className="grid gap-4 xl:grid-cols-[1.1fr_1.4fr]">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-black text-slate-800">Lista predeterminada</p>
                                    <p className="mt-1 text-xs font-medium text-slate-500">
                                        Se aplica al agregar productos al carrito.
                                    </p>
                                </div>
                                <StatusPill tone={defaultPriceListId ? 'indigo' : 'slate'}>
                                    {defaultPriceListId ? 'Lista' : 'Base'}
                                </StatusPill>
                            </div>
                            <select
                                value={defaultPriceListId}
                                onChange={e => saveDefaultPriceList(e.target.value)}
                                disabled={savingPricing}
                                className="mt-3 w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
                            >
                                <option value="">Precio base</option>
                                {priceLists.map(l => (
                                    <option key={l.id} value={l.id}>{l.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="rounded-lg border border-indigo-100 bg-white p-4 shadow-sm">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <p className="text-sm font-black text-slate-800">Regla del precio base</p>
                                    <p className="mt-1 text-xs font-medium text-slate-500">
                                        Controla si el precio normal puede cobrarse en cualquier moneda o solo en una.
                                    </p>
                                </div>
                                <StatusPill tone={baseIsStrict ? 'indigo' : 'emerald'}>
                                    {baseIsStrict ? `Solo ${baseCurrencyCode}` : 'Flexible'}
                                </StatusPill>
                            </div>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <label className="space-y-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Moneda base</span>
                                    <select
                                        value={baseCurrencyCode}
                                        onChange={e => saveBasePricePolicy({ currency_code: e.target.value })}
                                        disabled={savingPricing}
                                        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
                                    >
                                        <option value="FLEX">Flexible</option>
                                        <option value="USD">USD</option>
                                        <option value="VES">Bs / VES</option>
                                    </select>
                                </label>
                                <label className="space-y-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cobro</span>
                                    <select
                                        value={basePaymentPolicy}
                                        onChange={e => saveBasePricePolicy({ payment_policy: e.target.value })}
                                        disabled={savingPricing || baseCurrencyCode === 'FLEX'}
                                        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
                                    >
                                        <option value="flexible">Cobro flexible</option>
                                        <option value="strict">Solo su moneda</option>
                                    </select>
                                </label>
                            </div>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 xl:col-span-2">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-black text-slate-800">Mostrar equivalente en Bolívares</p>
                                    <p className="mt-1 text-xs font-medium text-slate-500">
                                        {showBs ? 'El POS muestra precio en divisa y equivalente en Bs.' : 'El POS oculta el equivalente en Bs.'}
                                    </p>
                                </div>
                                <ToggleSwitch active={showBs} onClick={toggleShowBs} activeClass="bg-emerald-600" />
                            </div>
                        </div>
                    </div>
                </SettingSection>
            )}

            {user?.role === 'ADMIN' && (
                <SettingSection
                    icon={ReceiptText}
                    title="Impresión al vender"
                    description="Controla si el ticket térmico sale automáticamente al confirmar el pago."
                    action={<StatusPill tone={autoPrint ? 'indigo' : 'slate'}>{autoPrint ? 'Automático' : 'Manual'}</StatusPill>}
                >
                    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <div>
                            <p className="text-sm font-black text-slate-800">Imprimir ticket al confirmar pago</p>
                            <p className="mt-1 text-xs font-medium text-slate-500">
                                {autoPrint ? 'Activo: el ticket se envía al bridge al finalizar la venta.' : 'Inactivo: el cajero decide cuándo imprimir.'}
                            </p>
                        </div>
                        <ToggleSwitch
                            active={autoPrint}
                            onClick={toggleAutoPrint}
                            disabled={loadingAutoPrint || savingAutoPrint}
                        />
                    </div>
                    <div className="mt-3 rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700">
                        Requiere una caja con impresora asignada y Hardware Bridge conectado.
                    </div>
                </SettingSection>
            )}

            <SettingSection
                icon={Server}
                title="Hardware Bridge"
                description="Conecta la computadora de caja con la impresora térmica local."
                action={
                    <a href={getMagicLink()} className="inline-flex h-9 items-center rounded-md border border-indigo-200 bg-indigo-50 px-3 text-xs font-black text-indigo-700 hover:bg-indigo-100">
                        Abrir configurador
                    </a>
                }
            >
                <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-sm font-black text-indigo-600">1</div>
                            <div>
                                <h4 className="font-black text-slate-800">Instalador local</h4>
                                <p className="mt-1 text-sm text-slate-600">
                                    Descarga el puente de impresión y mantenlo abierto en la computadora de caja.
                                </p>
                                <a
                                    href="/downloads/ConexionImpresora.zip"
                                    download
                                    className="mt-3 inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-indigo-600"
                                >
                                    <Download size={16} /> Descargar ConexionImpresora.zip
                                </a>
                            </div>
                        </div>

                        <div className="mt-4 flex items-start gap-3 rounded-md border border-emerald-100 bg-emerald-50 p-3">
                            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                            <p className="text-xs font-bold leading-relaxed text-emerald-800">
                                Recomendado: activar inicio con Windows y usar un Client ID distinto por caja.
                            </p>
                        </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                                <h4 className="font-black text-slate-800">Datos de conexión</h4>
                                <p className="text-xs font-medium text-slate-500">Copia estos valores en la app local.</p>
                            </div>
                            <StatusPill tone="indigo">Bridge</StatusPill>
                        </div>
                        <div className="grid gap-3">
                            <CopyField
                                label="Servidor WebSocket"
                                value={wsHost}
                                onCopy={() => {
                                    navigator.clipboard.writeText(wsHost);
                                    toast.success('URL del servidor copiada');
                                }}
                            />
                            <div className="grid gap-3 md:grid-cols-2">
                                <CopyField
                                    label="Tenant ID"
                                    value={tenantId}
                                    onCopy={() => {
                                        navigator.clipboard.writeText(tenantId);
                                        toast.success('Tenant ID copiado');
                                    }}
                                />
                                <CopyField
                                    label="Client ID"
                                    value="caja-1"
                                    onCopy={() => {
                                        navigator.clipboard.writeText('caja-1');
                                        toast.success('Client ID copiado');
                                    }}
                                />
                            </div>
                            <CopyField
                                label="Token de acceso"
                                value={tokenPreview}
                                buttonLabel="Copiar token"
                                onCopy={() => {
                                    const token = localStorage.getItem('token')?.replace(/^"|"$/g, '') || '';
                                    navigator.clipboard.writeText(token);
                                    toast.success('Token completo copiado');
                                }}
                            />
                        </div>
                    </div>
                </div>
            </SettingSection>
        </div>
    );
};

export default EstacionPOSTab;
