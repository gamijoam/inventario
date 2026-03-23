import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
// import { POS_THEMES, DEFAULT_THEME } from '../../constants/posThemes'; // TAB TEMAS — comentado
import { X, Printer, Monitor, Download, Eye, EyeOff, DollarSign } from 'lucide-react';
import { Button } from '../ui/button';
import { API_ROOT_URL } from '../../config/constants';

const POSSettingsModal = ({
    isOpen,
    onClose,
    secondaryCurrencies = [],
    isCurrencyVisible,
    onToggleCurrency,
}) => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('HARDWARE'); // default HARDWARE (TAB TEMAS comentado)

    const getMagicLink = () => {
        const token = localStorage.getItem('token');
        const tenant = localStorage.getItem('selected_tenant') || 'public';
        let wsHost = API_ROOT_URL.replace('http://', 'ws://').replace('https://', 'wss://');
        return `miinventariofacil://config?token=${token}&tenant=${tenant}&host=${wsHost}`;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-[#0f172a]/70 flex items-center justify-center z-[60] backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header & Tabs */}
                <div className="bg-slate-50 border-b border-slate-100 p-0">
                    <div className="flex justify-between items-center p-4 pb-2">
                        <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                            <Monitor size={20} className="text-slate-500" />
                            Configuración de estación
                        </h2>
                        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8 text-slate-400">
                            <X size={20} />
                        </Button>
                    </div>

                    {/* TABS */}
                    <div className="flex px-4 gap-6">
                        {/* TAB TEMAS — comentado por ahora
                        <button
                            onClick={() => setActiveTab('THEME')}
                            className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2
                                ${activeTab === 'THEME' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}
                            `}
                        >
                            <Palette size={16} /> Diseño y Colores
                        </button>
                        */}

                        <button
                            onClick={() => setActiveTab('HARDWARE')}
                            className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2
                                ${activeTab === 'HARDWARE' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}
                            `}
                        >
                            <Printer size={16} /> Hardware / Puente
                        </button>

                        {secondaryCurrencies.length > 0 && (
                            <button
                                onClick={() => setActiveTab('DISPLAY')}
                                className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2
                                    ${activeTab === 'DISPLAY' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}
                                `}
                            >
                                <Eye size={16} /> Visualización
                            </button>
                        )}
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto min-h-[400px]">

                    {/* TAB: TEMAS — comentado
                    {activeTab === 'THEME' && ( ... )}
                    */}

                    {/* TAB: HARDWARE */}
                    {activeTab === 'HARDWARE' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">

                            {/* Sección impresora */}
                            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="bg-blue-100 p-3 rounded-xl">
                                        <Printer size={24} className="text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-slate-800">Impresora de Tickets</h3>
                                        <p className="text-xs text-slate-500">Impresión directa sin diálogos del navegador</p>
                                    </div>
                                </div>

                                <p className="text-sm text-slate-600 mb-5 leading-relaxed">
                                    Para imprimir recibos directamente en tu impresora térmica ESC/POS, necesitas instalar el puente local{' '}
                                    <span className="font-bold text-slate-800">"ConexionImpresora.exe"</span>.
                                    Una vez instalado, el sistema se conectará automáticamente.
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Button
                                        onClick={() => window.location.href = getMagicLink()}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 shadow-lg shadow-blue-500/20"
                                    >
                                        🚀 Conectar Ahora
                                    </Button>
                                    <a
                                        href="/downloads/ConexionImpresora.exe"
                                        download
                                        className="flex items-center justify-center gap-2 h-11 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                                    >
                                        <Download size={16} /> Descargar Programa
                                    </a>
                                </div>

                                <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                                    <p className="text-xs font-semibold text-amber-800 mb-1">Nota importante</p>
                                    <p className="text-xs text-amber-700 leading-relaxed">
                                        Abre el programa en tu computadora <b>antes</b> de presionar "Conectar".
                                        Si no responde, verifica que aparezca en la bandeja del sistema (esquina inferior derecha).
                                    </p>
                                </div>
                            </div>

                            {/* Info de sesión */}
                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Información de la sesión</p>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-white rounded-lg p-2.5 border border-slate-100">
                                        <span className="text-slate-400 block mb-0.5">Usuario</span>
                                        <span className="font-bold text-slate-700">{user?.username || '—'}</span>
                                    </div>
                                    <div className="bg-white rounded-lg p-2.5 border border-slate-100">
                                        <span className="text-slate-400 block mb-0.5">Tenant</span>
                                        <span className="font-bold text-slate-700">{localStorage.getItem('selected_tenant') || '—'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: VISUALIZACIÓN DE PRECIOS */}
                    {activeTab === 'DISPLAY' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">

                            <div>
                                <p className="text-sm text-slate-500 mb-1">
                                    Activa o desactiva qué monedas se muestran en las tarjetas de productos del catálogo.
                                </p>
                                <p className="text-xs text-slate-400">Los cambios aplican inmediatamente.</p>
                            </div>

                            <div className="space-y-3">
                                {secondaryCurrencies.map(curr => {
                                    const visible = isCurrencyVisible ? isCurrencyVisible(curr.currency_code) : true;
                                    return (
                                        <div
                                            key={curr.currency_code}
                                            className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                                                visible
                                                    ? 'border-emerald-200 bg-emerald-50'
                                                    : 'border-slate-200 bg-white'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${
                                                    visible ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                                                }`}>
                                                    {curr.currency_symbol}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 text-sm">{curr.name || curr.currency_code}</p>
                                                    <p className="text-xs text-slate-400">{curr.currency_code} · Tasa: {parseFloat(curr.rate).toFixed(2)}</p>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => onToggleCurrency && onToggleCurrency(curr.currency_code)}
                                                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                                                    visible
                                                        ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm shadow-emerald-200'
                                                        : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                                                }`}
                                            >
                                                {visible
                                                    ? <><Eye size={14} /> Visible</>
                                                    : <><EyeOff size={14} /> Oculto</>
                                                }
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                                <p className="text-xs text-blue-600 leading-relaxed">
                                    <span className="font-bold">Tip:</span> También puedes activar/desactivar cada moneda directamente desde los pills{' '}
                                    en la barra superior del POS.
                                </p>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <Button variant="ghost" onClick={onClose} className="text-slate-600 hover:bg-slate-200">
                        Cerrar
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default POSSettingsModal;
