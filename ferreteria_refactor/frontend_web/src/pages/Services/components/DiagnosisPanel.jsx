import React, { useState } from 'react';
import { Edit2, Save, X } from 'lucide-react';
import apiClient from '../../../config/axios';
import { toast } from 'react-hot-toast';

const DiagnosisPanel = ({ orderId, initialDiagnosis = '', onSave }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [diagnosis, setDiagnosis] = useState(initialDiagnosis);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!diagnosis.trim()) {
            toast.error('El diagnóstico no puede estar vacío');
            return;
        }

        setSaving(true);
        try {
            await apiClient.patch(`/services/orders/${orderId}`, {
                problem_description: diagnosis,
            });
            setIsEditing(false);
            onSave?.(diagnosis);
            toast.success('Diagnóstico actualizado');
        } catch (err) {
            toast.error('Error al guardar diagnóstico');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="text-2xl">⚠️</div>
                    <h3 className="font-bold text-yellow-900 text-lg">Diagnóstico</h3>
                </div>
                {!isEditing && (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="p-2 text-yellow-600 hover:bg-yellow-100 rounded-lg transition-colors"
                        title="Editar diagnóstico"
                    >
                        <Edit2 size={18} />
                    </button>
                )}
            </div>

            {!isEditing ? (
                <div className="space-y-3">
                    {diagnosis ? (
                        <>
                            <p className="text-yellow-900 leading-relaxed whitespace-pre-wrap">{diagnosis}</p>
                            <p className="text-xs text-yellow-700 mt-2">
                                {diagnosis.length} caracteres
                            </p>
                        </>
                    ) : (
                        <div className="text-center py-6 text-yellow-600">
                            <p className="font-semibold mb-2">Sin diagnóstico</p>
                            <p className="text-sm">Haz click en el botón de editar para agregar uno</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    <textarea
                        value={diagnosis}
                        onChange={(e) => setDiagnosis(e.target.value)}
                        placeholder="Describe los síntomas y problemas reportados por el cliente..."
                        className="w-full px-4 py-3 border-2 border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none resize-none"
                        rows={6}
                        autoFocus
                    />
                    <div className="flex items-center justify-between">
                        <p className="text-xs text-yellow-700">
                            {diagnosis.length}/500 caracteres
                        </p>
                        {diagnosis.length > 500 && (
                            <p className="text-xs text-red-600 font-semibold">Excedido límite</p>
                        )}
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={handleSave}
                            disabled={saving || diagnosis.length > 500}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 transition-colors disabled:opacity-50"
                        >
                            <Save size={18} /> Guardar
                        </button>
                        <button
                            onClick={() => {
                                setDiagnosis(initialDiagnosis);
                                setIsEditing(false);
                            }}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition-colors"
                        >
                            <X size={18} /> Cancelar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DiagnosisPanel;
