import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { POS_THEMES, DEFAULT_THEME } from '../../constants/posThemes';
import { X, Check, Palette } from 'lucide-react';

const POSSettingsModal = ({ isOpen, onClose }) => {
    const { user, updateUserPreferences } = useAuth();

    // Safety check if user has preferences loaded
    const currentThemeId = user?.preferences?.pos_theme?.id || 'default';
    const [selectedThemeId, setSelectedThemeId] = useState(currentThemeId);

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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-[#0f172a]/70 flex items-center justify-center z-[60] backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="bg-slate-50 border-b border-slate-100 p-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="bg-indigo-100 p-2 rounded-lg">
                            <Palette size={20} className="text-indigo-600" />
                        </div>
                        <h2 className="font-bold text-slate-800 text-lg">Personalizar Diseño POS</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto">
                    <p className="text-sm text-slate-500 mb-4">Elige el tema visual que prefieras para tu estación de trabajo.</p>

                    <div className="grid grid-cols-2 gap-4">
                        {POS_THEMES.map((theme) => {
                            const isSelected = selectedThemeId === theme.id;

                            return (
                                <button
                                    key={theme.id}
                                    onClick={() => setSelectedThemeId(theme.id)}
                                    className={`relative group flex flex-col items-start text-left rounded-xl border-2 transition-all overflow-hidden
                                        ${isSelected ? 'border-indigo-600 ring-4 ring-indigo-50' : 'border-slate-200 hover:border-slate-300'}
                                    `}
                                >
                                    {/* Preview Split */}
                                    <div className="h-20 w-full flex">
                                        <div className={`w-1/2 h-full ${theme.left_bg} border-r border-slate-100/20`}></div>
                                        <div className={`w-1/2 h-full ${theme.right_bg}`}></div>
                                    </div>

                                    {/* Content */}
                                    <div className="p-3 w-full bg-white text-sm font-medium text-slate-700 flex justify-between items-center">
                                        {theme.name}
                                        {isSelected && <Check size={16} className="text-indigo-600" />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all"
                    >
                        Guardar Cambios
                    </button>
                </div>
            </div>
        </div>
    );
};

export default POSSettingsModal;
