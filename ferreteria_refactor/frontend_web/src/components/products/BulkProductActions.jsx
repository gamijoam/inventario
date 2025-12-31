import { useState } from 'react';
import apiClient from '../../config/axios';
import { Download, Upload, FileSpreadsheet, FileText, AlertCircle, CheckCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';

const BulkProductActions = ({ onImportComplete }) => {
    const [uploading, setUploading] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importResult, setImportResult] = useState(null);

    const downloadTemplate = async () => {
        try {
            const response = await apiClient.get('/products/template', {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'plantilla_productos.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            toast.success('Plantilla descargada correctamente');
        } catch (error) {
            console.error('Error downloading template:', error);
            toast.error('Error al descargar plantilla');
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.xlsx')) {
            toast.error('Solo se permiten archivos .xlsx');
            return;
        }

        setUploading(true);
        setImportResult(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await apiClient.post('/products/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setImportResult(response.data);

            if (response.data.success) {
                toast.success(`✅ ${response.data.created} productos creados exitosamente`);
                if (onImportComplete) {
                    onImportComplete();
                }
                setTimeout(() => setShowImportModal(false), 2000);
            } else {
                toast.error(`❌ Error: ${response.data.errors.length} errores encontrados`);
            }
        } catch (error) {
            console.error('Error importing products:', error);
            toast.error(error.response?.data?.detail || 'Error al importar productos');
            setImportResult({
                success: false,
                created: 0,
                errors: [error.response?.data?.detail || 'Error desconocido']
            });
        } finally {
            setUploading(false);
            event.target.value = '';
        }
    };

    const exportToExcel = async () => {
        try {
            toast.loading('Generando archivo Excel...');

            const response = await apiClient.get('/products/export/excel', {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const filename = `inventario_${new Date().toISOString().split('T')[0]}.xlsx`;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            toast.dismiss();
            toast.success('Inventario exportado a Excel');
        } catch (error) {
            toast.dismiss();
            console.error('Error exporting to Excel:', error);
            toast.error('Error al exportar a Excel');
        }
    };

    const exportToPDF = async () => {
        try {
            toast.loading('Generando archivo PDF...');

            const response = await apiClient.get('/products/export/pdf', {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const filename = `inventario_${new Date().toISOString().split('T')[0]}.pdf`;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            toast.dismiss();
            toast.success('Inventario exportado a PDF');
        } catch (error) {
            toast.dismiss();
            console.error('Error exporting to PDF:', error);
            toast.error('Error al exportar a PDF');
        }
    };

    return (
        <>
            {/* Compact Header Buttons */}
            <div className="flex items-center gap-2">
                {/* Download Template */}
                <button
                    onClick={downloadTemplate}
                    className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
                    title="Descargar plantilla Excel"
                >
                    <Download size={16} />
                    <span className="hidden md:inline">Plantilla</span>
                </button>

                {/* Import */}
                <button
                    onClick={() => setShowImportModal(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                    title="Importar productos desde Excel"
                >
                    <Upload size={16} />
                    <span className="hidden md:inline">Importar</span>
                </button>

                {/* Export Excel */}
                <button
                    onClick={exportToExcel}
                    className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm transition-colors"
                    title="Exportar a Excel"
                >
                    <FileSpreadsheet size={16} />
                    <span className="hidden md:inline">Excel</span>
                </button>

                {/* Export PDF */}
                <button
                    onClick={exportToPDF}
                    className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                    title="Exportar a PDF"
                >
                    <FileText size={16} />
                    <span className="hidden md:inline">PDF</span>
                </button>
            </div>

            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                <Upload size={20} className="text-blue-600" />
                                Importar Productos
                            </h3>
                            <button
                                onClick={() => {
                                    setShowImportModal(false);
                                    setImportResult(null);
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            <div className="bg-blue-50 border-l-4 border-blue-400 p-3 text-sm">
                                <p className="font-semibold text-blue-800 mb-1">Pasos:</p>
                                <ol className="list-decimal list-inside text-blue-700 space-y-1">
                                    <li>Descargar plantilla Excel</li>
                                    <li>Completar con sus datos</li>
                                    <li>Subir archivo completado</li>
                                </ol>
                            </div>

                            <input
                                type="file"
                                accept=".xlsx"
                                onChange={handleFileUpload}
                                disabled={uploading}
                                className="hidden"
                                id="file-upload-modal"
                            />
                            <label
                                htmlFor="file-upload-modal"
                                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors cursor-pointer ${uploading
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                                    }`}
                            >
                                <Upload size={18} />
                                {uploading ? 'Subiendo...' : 'Seleccionar Archivo Excel'}
                            </label>

                            {/* Import Result */}
                            {importResult && (
                                <div className={`p-3 rounded-lg ${importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                                    }`}>
                                    <div className="flex items-start gap-2">
                                        {importResult.success ? (
                                            <CheckCircle size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                                        ) : (
                                            <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                                        )}
                                        <div className="flex-1">
                                            <p className={`font-semibold ${importResult.success ? 'text-green-800' : 'text-red-800'}`}>
                                                {importResult.success
                                                    ? `✅ ${importResult.created} productos creados`
                                                    : `❌ ${importResult.errors.length} errores encontrados`
                                                }
                                            </p>
                                            {!importResult.success && importResult.errors.length > 0 && (
                                                <div className="mt-2 max-h-40 overflow-y-auto">
                                                    <ul className="text-sm text-red-700 space-y-1">
                                                        {importResult.errors.slice(0, 5).map((error, idx) => (
                                                            <li key={idx} className="flex items-start gap-1">
                                                                <span className="text-red-500">•</span>
                                                                <span>{error}</span>
                                                            </li>
                                                        ))}
                                                        {importResult.errors.length > 5 && (
                                                            <li className="text-red-600 font-semibold">
                                                                ... y {importResult.errors.length - 5} errores más
                                                            </li>
                                                        )}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default BulkProductActions;
