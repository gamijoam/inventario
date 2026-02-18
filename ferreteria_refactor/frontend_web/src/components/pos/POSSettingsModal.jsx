import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { POS_THEMES, DEFAULT_THEME } from '../../constants/posThemes';
import { X, Check, Palette, Printer, Monitor, Download } from 'lucide-react';
import { Button } from '../ui/button';
import { API_ROOT_URL } from '../../config/constants';

const POSSettingsModal = ({ isOpen, onClose }) => {
    const { user, updateUserPreferences } = useAuth();

    // Safety check if user has preferences loaded
    const currentThemeId = user?.preferences?.pos_theme?.id || 'default';
    const [selectedThemeId, setSelectedThemeId] = useState(currentThemeId);
    const [activeTab, setActiveTab] = useState('THEME'); // 'THEME' | 'HARDWARE'

    // Update local state if user pref changes externally or on re-open
    useEffect(() => {
        if (isOpen) {
            setSelectedThemeId(currentThemeId);
        }
    }, [isOpen, currentThemeId]);

    const handleSave = () => {
        const themeToSave = POS_THEMES.find(t => t.id === selectedThemeId) || DEFAULT_THEME;

        updateUserPreferences({
            pos_theme: themeToSave
        });
        onClose();
    };

    const getMagicLink = () => {
        const token = localStorage.getItem('token');
        const tenant = localStorage.getItem('selected_tenant') || 'public';

        // Convert HTTP to WS
        let wsHost = API_ROOT_URL.replace('http://', 'ws://').replace('https://', 'wss://');

        // Construct URI
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
                        <button
                            onClick={() => setActiveTab('THEME')}
                            className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2
                                ${activeTab === 'THEME' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}
                            `}
                        >
                            <Palette size={16} /> Diseño y Colores
                        </button>
                        <button
                            onClick={() => setActiveTab('HARDWARE')}
                            className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2
                                ${activeTab === 'HARDWARE' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}
                            `}
                        >
                            <Printer size={16} /> Hardware / Puente
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto min-h-[400px]">

                    {/* TAB: THEMES */}
                    {activeTab === 'THEME' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <p className="text-sm text-slate-500 mb-4">Elige el tema visual que prefieras para tu estación de trabajo. (Clic en "Guardar" para aplicar).</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {POS_THEMES.map((theme) => {
                                    const isSelected = selectedThemeId === theme.id;
                                    return (
                                        <button
                                            key={theme.id}
                                            onClick={() => setSelectedThemeId(theme.id)}
                                            className={`relative group flex flex-col items-start text-left rounded-xl border-2 transition-all overflow-hidden shadow-sm hover:shadow-md
                                                ${isSelected ? 'border-indigo-600 ring-2 ring-indigo-50' : 'border-slate-200 hover:border-slate-300'}
                                            `}
                                        >
                                            <div className="h-16 w-full flex">
                                                <div className={`w-1/2 h-full ${theme.left_bg} border-r border-white/20`}></div>
                                                <div className={`w-1/2 h-full ${theme.right_bg}`}></div>
                                            </div>
                                            <div className="p-2 w-full bg-white text-xs font-bold text-slate-700 flex justify-between items-center">
                                                {theme.name}
                                                {isSelected && <Check size={14} className="text-indigo-600" />}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* TAB: HARDWARE */}
                    {activeTab === 'HARDWARE' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col items-center justify-center h-full text-center py-8">
                            <div className="bg-blue-50 p-4 rounded-full mb-4">
                                <Printer size={40} className="text-blue-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Conectar Impresora Local</h3>
                            <p className="text-slate-500 max-w-md mb-8">
                                Para imprimir tickets directamente sin diálogos del navegador, necesitas tener instalado el programa <b>"ConexionImpresora.exe"</b>.
                            </p>

                            <div className="flex flex-col gap-4 w-full max-w-xs">
                                <Button
                                    onClick={() => window.location.href = getMagicLink()}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 shadow-lg shadow-blue-500/30"
                                >
                                    🚀 Conectar Ahora
                                </Button>

                                <a
                                    href="/downloads/ConexionImpresora.exe"
                                    download
                                    className="flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-slate-600 mt-2"
                                >
                                    <Download size={14} /> Descargar Programa
                                </a>
                            </div>

                            <div className="mt-8 p-4 bg-yellow-50 rounded-lg border border-yellow-100 text-left w-full max-w-md">
                                <p className="text-xs text-yellow-700 font-semibold mb-1">Nota Importante:</p>
                                <p className="text-xs text-yellow-600">
                                    Debes abrir el programa en tu computadora antes de presionar "Conectar". Si no pasa nada, verifica que el programa esté ejecutándose en la bandeja del sistema.
                                </p>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    <Button variant="ghost" onClick={onClose} className="text-slate-600 hover:bg-slate-200">
                        Cancelar
                    </Button>
                    {activeTab === 'THEME' && (
                        <Button
                            onClick={handleSave}
                            className="bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700"
                        >
                            Guardar Cambios
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default POSSettingsModal;
