import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import { Printer, Download } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { API_ROOT_URL } from '../../../config/constants';
import { toast } from 'react-hot-toast';

const EstacionPOSTab = () => {
    const { user } = useAuth();

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
        <div className="space-y-6 animate-in fade-in duration-300">

            {/* HARDWARE BRIDGE - MANUAL CONFIGURATION GUIDE */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Printer className="h-5 w-5 text-indigo-600" />
                        Hardware Bridge (Puente de Impresión)
                    </CardTitle>
                    <CardDescription>
                        Sigue estos pasos para conectar tu impresora local:
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">

                    {/* STEP 1: DOWNLOAD */}
                    <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="h-8 w-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold shrink-0">1</div>
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
                                href="/downloads/ConexionImpresora.exe"
                                download
                                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm"
                            >
                                <Download size={16} />
                                Descargar ConexionImpresora.exe
                            </a>
                        </div>
                    </div>

                    {/* STEP 2: CONFIGURE */}
                    <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="h-8 w-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold shrink-0">2</div>
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
                                    <code className="flex-1 bg-white border border-slate-200 p-2 rounded text-sm font-mono text-slate-700">
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
                                        <code className="flex-1 bg-white border border-slate-200 p-2 rounded text-sm font-mono text-slate-700">
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
                                        <code className="flex-1 bg-white border border-slate-200 p-2 rounded text-sm font-mono text-slate-700">
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
                                    <code className="flex-1 bg-white border border-slate-200 p-2 rounded text-sm font-mono text-slate-700 break-all truncate">
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
                    <div className="flex items-start gap-4 p-4 bg-green-50 rounded-lg border border-green-100">
                        <div className="h-8 w-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold shrink-0">3</div>
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
