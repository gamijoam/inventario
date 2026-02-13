
import React, { useEffect, useState } from 'react';
import { backupsApi, type BackupFile } from '../api/backups';
import { HardDrive, Download, Trash2, Plus, FileArchive, RefreshCw, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const BackupsPage: React.FC = () => {
    const [backups, setBackups] = useState<BackupFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);

    const fetchBackups = async () => {
        setLoading(true);
        try {
            const data = await backupsApi.list();
            setBackups(data);
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar respaldos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBackups();
    }, []);

    const handleCreateBackup = async () => {
        if (creating) return;
        setCreating(true);
        const toastId = toast.loading('Generando respaldo de base de datos...');

        try {
            await backupsApi.create();
            toast.success('Respaldo creado exitosamente', { id: toastId });
            fetchBackups();
        } catch (error: any) {
            console.error(error);
            const msg = error.response?.data?.detail || 'Error al generar respaldo';
            toast.error(msg, { id: toastId });
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (filename: string) => {
        if (!window.confirm('¿Estás seguro de eliminar este respaldo? Esta acción no se puede deshacer.')) return;

        setDeleting(filename);
        try {
            await backupsApi.delete(filename);
            toast.success('Respaldo eliminado');
            // Optimistic update or refetch
            setBackups(prev => prev.filter(b => b.filename !== filename));
        } catch (error) {
            console.error(error);
            toast.error('Error al eliminar respaldo');
        } finally {
            setDeleting(null);
        }
    };

    const [downloading, setDownloading] = useState<string | null>(null);

    const handleDownload = async (filename: string) => {
        setDownloading(filename);
        try {
            const blob = await backupsApi.downloadBlob(filename);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error(error);
            toast.error('Error al descargar el respaldo');
        } finally {
            setDownloading(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <HardDrive className="h-8 w-8 text-blue-600" />
                        Copias de Seguridad
                    </h1>
                    <p className="text-slate-500 mt-1">Gestión de respaldos de base de datos (PostgreSQL)</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => fetchBackups()}
                        className="p-2 text-slate-500 hover:text-blue-600 transition-colors"
                        title="Refrescar lista"
                    >
                        <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={handleCreateBackup}
                        disabled={creating}
                        className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ${creating ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {creating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        {creating ? 'Generando...' : 'Generar Respaldo'}
                    </button>
                </div>
            </div>

            {/* Warning Banner */}
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r shadow-sm">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
                    </div>
                    <div className="ml-3">
                        <p className="text-sm text-amber-700">
                            Estos respaldos contienen <strong>toda la base de datos</strong> (todos los tenants).
                            Descárgalos y guárdalos en un lugar seguro.
                        </p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {loading && backups.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">Cargando respaldos...</div>
                ) : backups.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                        <FileArchive className="h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">No hay respaldos</h3>
                        <p className="max-w-sm mx-auto mt-1">Genera el primer respaldo manual para asegurar los datos.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Archivo</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha Creación</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tamaño</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {backups.map((backup) => (
                                    <tr key={backup.filename} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <FileArchive className="h-5 w-5 text-slate-400 mr-3" />
                                                <span className="text-sm font-medium text-slate-900 font-mono">{backup.filename}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500">
                                            {new Date(backup.created_at).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500">
                                            <span className="px-2 py-1 bg-slate-100 rounded text-xs font-semibold">
                                                {backup.size_mb.toFixed(2)} MB
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            <button
                                                onClick={() => handleDownload(backup.filename)}
                                                disabled={downloading === backup.filename}
                                                className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors"
                                                title="Descargar"
                                            >
                                                {downloading === backup.filename ? (
                                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Download className="h-4 w-4" />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(backup.filename)}
                                                disabled={deleting === backup.filename}
                                                className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                                                title="Eliminar"
                                            >
                                                {deleting === backup.filename ? (
                                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-4 w-4" />
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BackupsPage;
