import React, { useState, useRef } from 'react';
import apiClient from '../../../config/axios';
import { toast } from 'react-hot-toast';
import { UploadCloud, CheckCircle, AlertOctagon, FileJson, ArrowRight, RefreshCw } from 'lucide-react';

const ExternalTransferIn = () => {
    const fileInputRef = useRef(null);
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const selected = e.target.files[0];
            if (selected.type !== 'application/json') {
                toast.error("Solo se permiten archivos JSON");
                return;
            }
            setFile(selected);
            setResult(null);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            setUploading(true);
            const loadingToast = toast.loading("Procesando paquete de inventario...");

            const response = await apiClient.post('/inventory/transfer/import', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            setResult(response.data);
            toast.dismiss(loadingToast);

            if (response.data.failure_count === 0) {
                toast.success("Importación completada con éxito perfecto");
            } else if (response.data.success_count > 0) {
                toast('Importación parcial completada', { icon: '⚠️' });
            } else {
                toast.error("Falló la importación de todos los items");
            }

        } catch (error) {
            console.error("Import failed:", error);
            const msg = error.response?.data?.detail || "Error al procesar el archivo";
            toast.error(msg);
        } finally {
            setUploading(false);
        }
    };

    const resetProcess = () => {
        setFile(null);
        setResult(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <div className="flex h-screen bg-slate-50 items-center justify-center p-6">
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row min-h-[500px]">

                {/* Left Panel: Upload Area */}
                <div className="w-full md:w-1/2 p-8 flex flex-col border-r border-slate-100">
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Importar Inventario</h2>
                    <p className="text-slate-500 mb-8 text-sm">Carga el archivo JSON generado por la otra sucursal para actualizar tu stock.</p>

                    {!result ? (
                        <div className="flex-1 flex flex-col">
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all ${file ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'}`}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept=".json"
                                    className="hidden"
                                />
                                {file ? (
                                    <div className="text-center p-4">
                                        <FileJson size={48} className="text-emerald-500 mx-auto mb-3" />
                                        <p className="font-bold text-slate-700 break-all">{file.name}</p>
                                        <p className="text-xs text-slate-500 mt-1">Ready to upload</p>
                                    </div>
                                ) : (
                                    <div className="text-center p-4">
                                        <UploadCloud size={48} className="text-slate-300 mx-auto mb-3" />
                                        <p className="font-bold text-slate-600">Click para seleccionar</p>
                                        <p className="text-xs text-slate-400 mt-1">Solo archivos JSON</p>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleUpload}
                                disabled={!file || uploading}
                                className="mt-6 w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {uploading ? 'Procesando...' : 'Procesar Archivo'}
                            </button>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center">
                            <div className="bg-slate-100 p-4 rounded-full mb-4">
                                <CheckCircle size={40} className="text-slate-400" />
                            </div>
                            <h3 className="font-bold text-slate-700 text-lg">Proceso Finalizado</h3>
                            <p className="text-slate-500 text-sm mb-6">Revisa el resumen a la derecha</p>

                            <button
                                onClick={resetProcess}
                                className="flex items-center gap-2 text-indigo-600 font-bold hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors"
                            >
                                <RefreshCw size={18} />
                                Importar Otro
                            </button>
                        </div>
                    )}
                </div>

                {/* Right Panel: Results */}
                <div className="w-full md:w-1/2 p-8 bg-slate-50 flex flex-col">
                    <h3 className="text-lg font-bold text-slate-700 mb-6">Resultados</h3>

                    {result ? (
                        <div className="space-y-6 animate-fadeIn">
                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                                    <div className="text-3xl font-black text-emerald-500 mb-1">{result.success_count}</div>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Exitosos</div>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                                    <div className={`text-3xl font-black mb-1 ${result.failure_count > 0 ? 'text-red-500' : 'text-slate-300'}`}>{result.failure_count}</div>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Fallidos</div>
                                </div>
                            </div>

                            {/* Error Log */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col">
                                <div className="bg-slate-100 px-4 py-2 text-xs font-bold text-slate-500 uppercase border-b border-slate-200">
                                    Log de Errores
                                </div>
                                <div className="p-4 overflow-y-auto max-h-[200px] text-sm">
                                    {result.errors.length > 0 ? (
                                        <ul className="space-y-2">
                                            {result.errors.map((err, idx) => (
                                                <li key={idx} className="text-red-600 flex gap-2 items-start">
                                                    <AlertOctagon size={16} className="mt-0.5 flex-shrink-0" />
                                                    <span>{err}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="text-center text-slate-400 py-8 flex flex-col items-center">
                                            <CheckCircle size={32} className="mb-2 opacity-50" />
                                            <p>Ningún error reportado</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center opacity-40">
                            <div className="text-center">
                                <ArrowRight size={48} className="mx-auto mb-4" />
                                <p>Los resultados aparecerán aquí</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExternalTransferIn;
