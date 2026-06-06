import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { Printer, Download, Zap } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { API_ROOT_URL } from '../../../config/constants';
import { toast } from 'react-hot-toast';
import apiClient from '../../../config/axios';

const EstacionPOSTab = () => {
    const { user } = useAuth();
    const [autoPrint, setAutoPrint] = useState(false);
    const [loadingAutoPrint, setLoadingAutoPrint] = useState(true);
    const [savingAutoPrint, setSavingAutoPrint] = useState(false);

    // ── Lista de precio predeterminada + visibilidad Bs (por tenant) ──
    const [priceLists, setPriceLists] = useState([]);
    const [defaultPriceListId, setDefaultPriceListId] = useState('');  // '' = Precio Base
    const [showBs, setShowBs] = useState(true);
    const [savingPricing, setSavingPricing] = useState(false);

    useEffect(() => {
        // Cargar listas de precio activas
        apiClient.get('/price-lists/', { params: { active_only: true } })
            .then(r => setPriceLists(r.data || []))
            .catch(() => {});
        // Cargar config actual (manejar 404 si no existe la key)
        apiClient.get('/config/pos_default_price_list_id')
            .then(r => setDefaultPriceListId(r.data?.value || ''))
            .catch(() => setDefaultPriceListId(''));
        apiClient.get('/config/pos_show_bs')
            .then(r => setShowBs(r.data?.value !== 'false'))
            .catch(() => setShowBs(true));
    }, []);

    const saveDefaultPriceList = async (value) => {
        setSavingPricing(true);
        setDefaultPriceListId(value);
        try {
            await apiClient.put('/config/pos_default_price_list_id', { key: 'pos_default_price_list_id', value: value || '' });
            toast.success(value
                ? `Lista predeterminada: ${priceLists.find(l => String(l.id) === String(value))?.name || value}`
                : 'Precio base predeterminado');
        } catch {
            toast.error('Error guardando lista predeterminada');
        } finally { setSavingPricing(false); }
    };

    const toggleShowBs = async () => {
        const next = !showBs;
        setShowBs(next);
        try {
            await apiClient.put('/config/pos_show_bs', { key: 'pos_show_bs', value: next ? 'true' : 'false' });
            toast.success(next ? 'Mostrando equivalente en Bs' : 'Bs oculto en el POS');
        } catch {
            toast.error('Error guardando preferencia de Bs');
        }
    };

    useEffect(() => {
        apiClient.get('/config/pos/auto-print-ticket')
            .then(r => setAutoPrint(r.data.auto_print_ticket))
            .catch(() => {})
            .finally(() => setLoadingAutoPrint(false));
    }, []);

    const toggleAutoPrint = async () => {
        setSavingAutoPrint(true);
        try {
            const newValue = !autoPrint;
            const res = await apiClient.post('/config/pos/auto-print-ticket', { enabled: newValue });
            setAutoPrint(res.data.auto_print_ticket);
            toast.success(res.data.auto_print_ticket
                ? '✅ Impresión automática activada'
                : 'Impresión automática desactivada');
        } catch (err) {
            console.error('Error guardando auto-print:', err);
            toast.error('Error guardando configuración');
        } finally {
            setSavingAutoPrint(false);
        }
    };

    const getMagicLink = () => {
        let token = localStorage.getItem('token') || '';
        token = token.replace(/^"|"$/g, '');

        const tenant = localStorage.getItem('selected_tenant') || 'public';

        let wsHost = API_ROOT_URL;

        if (wsHost.startsWith('https://')) {
            wsHost = wsHost.replace('https://', 'wss://');
        } else if (wsHost.startsWith('http://')) {
            wsHost = wsHost.replace('http://', 'ws://');
        }

        if (wsHost.includes('localhost')) {
            const port = wsHost.split(':')[2] || '8000';
            wsHost = `ws://127.0.0.1:${port}`;
        }

        const params = new URLSearchParams({
            token: token,
            tenant: tenant,
            host: wsHost
        });

        return `miinventariofacil://config?${params.toString()}`;
    };

    return (
        <div className="space-y-5 animate-in fade-in duration-300">

            {/* ── Precios en el POS — Solo ADMIN ──────────────────────────────── */}
            {user?.role === 'ADMIN' && (
                <Card className="rounded-lg border-slate-200 shadow-sm">
                    <CardHeader className="p-5 pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg font-black text-slate-900">
                            <Zap className="h-5 w-5 text-emerald-600" />
                            Precios en el Punto de Venta
                        </CardTitle>
                        <CardDescription className="text-xs font-medium text-slate-500">
                            Configura qué lista de precios se aplica por defecto al agregar
                            productos al carrito, y si se muestra el equivalente en Bolívares.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 p-5 pt-0">
                        {/* Lista de precio predeterminada */}
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <p className="font-bold text-slate-800 text-sm mb-1">Lista de precio predeterminada</p>
                            <p className="text-xs text-slate-500 mb-3">
                                Se aplica automáticamente al agregar cada producto al carrito.
                            </p>
                            <select
                                value={defaultPriceListId}
                                onChange={e => saveDefaultPriceList(e.target.value)}
                                disabled={savingPricing}
                                className="w-full px-3 py-2.5 rounded-md border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
                            >
                                <option value="">Precio Base (divisa)</option>
                                {priceLists.map(l => (
                                    <option key={l.id} value={l.id}>{l.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Toggle mostrar Bs */}
                        <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <div>
                                <p className="font-bold text-slate-800 text-sm">Mostrar equivalente en Bolívares</p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {showBs
                                        ? 'Activo: mostrando precios en $ y Bs'
                                        : 'Inactivo: solo divisa ($), sin Bs'}
                                </p>
                            </div>
                            <button
                                onClick={toggleShowBs}
                                className={`relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none ${
                                    showBs ? 'bg-emerald-600' : 'bg-slate-300'
                                }`}
                            >
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${
                                    showBs ? 'translate-x-6' : 'translate-x-0'
                                }`} />
                            </button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Auto Print Ticket — Solo ADMIN ──────────────────────────────── */}
            {user?.role === 'ADMIN' && (
                <Card className="rounded-lg border-slate-200 shadow-sm">
                    <CardHeader className="p-5 pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg font-black text-slate-900">
                            <Zap className="h-5 w-5 text-indigo-600" />
                            Impresión Automática de Ticket
                        </CardTitle>
                        <CardDescription className="text-xs font-medium text-slate-500">
                            Cuando está activo, el ticket se imprime automáticamente al confirmar el pago, sin necesidad de presionar "Imprimir Ticket".
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-5 pt-0">
                        <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <div>
                                <p className="font-bold text-slate-800 text-sm">Imprimir ticket al confirmar pago</p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {autoPrint
                                        ? 'Activo: el ticket se imprime automaticamente'
                                        : 'Inactivo: flujo normal, requiere confirmar impresion'}
                                </p>
                            </div>
                            <button
                                onClick={toggleAutoPrint}
                                disabled={loadingAutoPrint || savingAutoPrint}
                                className={`relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none disabled:opacity-50 ${
                                    autoPrint ? 'bg-indigo-600' : 'bg-slate-300'
                                }`}
                            >
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${
                                    autoPrint ? 'translate-x-6' : 'translate-x-0'
                                }`} />
                            </button>
                        </div>
                        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mt-3 flex items-center gap-1.5">
                            Requiere que la impresora este configurada y el Hardware Bridge este activo.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* HARDWARE BRIDGE - MANUAL CONFIGURATION GUIDE */}
            <Card className="rounded-lg border-slate-200 shadow-sm">
                <CardHeader className="p-5 pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg font-black text-slate-900">
                        <Printer className="h-5 w-5 text-indigo-600" />
                        Hardware Bridge (Puente de Impresión)
                    </CardTitle>
                    <CardDescription className="text-xs font-medium text-slate-500">
                        Sigue estos pasos para conectar tu impresora local:
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-5 pt-0">

                    {/* STEP 1: DOWNLOAD */}
                    <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="h-8 w-8 bg-indigo-50 text-indigo-600 rounded-md flex items-center justify-center font-black shrink-0">1</div>
                        <div className="flex-1">
                            <h4 className="font-bold text-slate-800">Descargar e Instalar</h4>
                            <p className="text-sm text-slate-600 mb-3">
                                Descarga <b>ConexionImpresora.exe</b>. Al ejecutarlo:
                                <ul className="list-disc pl-5 mt-1 space-y-1">
                                    <li>Se abrirá una ventana negra con registros.</li>
                                    <li>Puedes minimizarla y quedará en la <b>barra de tareas</b> (junto al reloj).</li>
                                    <li><b>Importante:</b> El programa debe estar siempre abierto para imprimir.</li>
                                    <li>Recomendamos marcar la opción <b>"Iniciar con Windows"</b> en el programa.</li>
                                </ul>
                            </p>
                            <a
                                href="/downloads/ConexionImpresora.zip"
                                download
                                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-md text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-sm"
                            >
                                <Download size={16} />
                                Descargar ConexionImpresora.zip
                            </a>
                        </div>
                    </div>

                    {/* STEP 2: CONFIGURE */}
                    <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="h-8 w-8 bg-indigo-50 text-indigo-600 rounded-md flex items-center justify-center font-black shrink-0">2</div>
                        <div className="flex-1 space-y-4">
                            <div>
                                <h4 className="font-bold text-slate-800">Configuración Manual</h4>
                                <p className="text-sm text-slate-600">
                                    Abre la app, ve a <b>Configuración Manual</b> y copia estos datos exactos:
                                </p>
                            </div>

                            {/* DATA: HOST (DYNAMIC CLOUD URL) */}
                            <div className="grid gap-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Servidor WebSocket (Host)</label>
                                <div className="flex gap-2">
                                    <code className="flex-1 bg-white border border-slate-200 p-2 rounded-md text-sm font-mono text-slate-700">
                                        {(() => {
                                            let host = API_ROOT_URL;
                                            if (host.startsWith('https://')) host = host.replace('https://', 'wss://');
                                            else if (host.startsWith('http://')) host = host.replace('http://', 'ws://');
                                            if (host.includes('localhost')) host = host.replace('localhost', '127.0.0.1');
                                            return host;
                                        })()}
                                    </code>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            let host = API_ROOT_URL;
                                            if (host.startsWith('https://')) host = host.replace('https://', 'wss://');
                                            else if (host.startsWith('http://')) host = host.replace('http://', 'ws://');
                                            if (host.includes('localhost')) host = host.replace('localhost', '127.0.0.1');

                                            navigator.clipboard.writeText(host);
                                            toast.success("URL del Servidor copiada");
                                        }}
                                    >
                                        Copiar
                                    </Button>
                                </div>
                                <p className="text-[10px] text-slate-400">
                                    * Esta URL conecta tu PC con nuestro servidor en la nube ({import.meta.env.VITE_API_URL || 'Producción'}).
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* DATA: TENANT */}
                                <div className="grid gap-2">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Tenant ID (Empresa)</label>
                                    <div className="flex gap-2">
                                        <code className="flex-1 bg-white border border-slate-200 p-2 rounded-md text-sm font-mono text-slate-700">
                                            {(() => {
                                                if (user?.tenant_id && user.tenant_id !== 'public') {
                                                    return user.tenant_id;
                                                }

                                                const hostname = window.location.hostname;
                                                const parts = hostname.split('.');
                                                let tenantId = null;

                                                if (parts.length >= 3 && !hostname.includes('localhost')) {
                                                    const subdomain = parts[0];
                                                    if (!['www', 'api', 'app', 'dashboard', 'qa'].includes(subdomain)) {
                                                        tenantId = subdomain;
                                                    }
                                                }

                                                if (!tenantId) {
                                                    tenantId = localStorage.getItem('selected_tenant');
                                                }

                                                return tenantId || 'public';
                                            })()}
                                        </code>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                const hostname = window.location.hostname;
                                                const parts = hostname.split('.');
                                                let tenantId = null;

                                                if (parts.length >= 3 && !hostname.includes('localhost')) {
                                                    const subdomain = parts[0];
                                                    if (!['www', 'api', 'app', 'dashboard', 'qa'].includes(subdomain)) {
                                                        tenantId = subdomain;
                                                    }
                                                }

                                                if (!tenantId) {
                                                    tenantId = localStorage.getItem('selected_tenant');
                                                }

                                                const finalTenant = tenantId || 'public';
                                                navigator.clipboard.writeText(finalTenant);
                                                toast.success("Tenant ID copiado");
                                            }}
                                        >
                                            Copiar
                                        </Button>
                                    </div>
                                </div>

                                {/* DATA: CLIENT ID */}
                                <div className="grid gap-2">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Client ID (Nombre Caja)</label>
                                    <div className="flex gap-2">
                                        <code className="flex-1 bg-white border border-slate-200 p-2 rounded-md text-sm font-mono text-slate-700">
                                            caja-1
                                        </code>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                navigator.clipboard.writeText("caja-1");
                                                toast.success("Client ID copiado");
                                            }}
                                        >
                                            Copiar
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* DATA: TOKEN */}
                            <div className="grid gap-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Tu Token de Acceso</label>
                                <div className="flex gap-2">
                                    <code className="flex-1 bg-white border border-slate-200 p-2 rounded-md text-sm font-mono text-slate-700 break-all truncate">
                                        {localStorage.getItem('token')?.replace(/^"|"$/g, '').substring(0, 20) || '...'}...
                                    </code>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            const token = localStorage.getItem('token')?.replace(/^"|"$/g, '') || '';
                                            navigator.clipboard.writeText(token);
                                            toast.success("Token completo copiado");
                                        }}
                                    >
                                        Copiar Token
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* STEP 3: CONNECT */}
                    <div className="flex items-start gap-4 p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                        <div className="h-8 w-8 bg-emerald-100 text-emerald-600 rounded-md flex items-center justify-center font-black shrink-0">3</div>
                        <div>
                            <h4 className="font-bold text-slate-800">Conectar</h4>
                            <p className="text-sm text-slate-600">
                                Dale clic a <b>"Guardar y Conectar"</b> en el programa. Deberías ver un mensaje verde de "Conectado".
                            </p>
                        </div>
                    </div>

                </CardContent>
            </Card>
        </div>
    );
};

export default EstacionPOSTab;
