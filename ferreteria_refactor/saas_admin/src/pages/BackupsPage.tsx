
import React, { useEffect, useState } from 'react';
import { backupsApi, type BackupFile } from '../api/backups';
import {
    HardDrive, Download, Trash2, Plus, FileArchive,
    RefreshCw, AlertTriangle, Clock, Database,
    ChevronLeft, ChevronRight, Calendar, Zap
} from 'lucide-react';
import toast from 'react-hot-toast';

const PAGE_SIZE = 8;

const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('es-VE', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

const formatSize = (mb: number) => {
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb.toFixed(1)} MB`;
};

const BackupsPage: React.FC = () => {
    const [backups, setBackups] = useState<BackupFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [downloading, setDownloading] = useState<string | null>(null);
    const [page, setPage] = useState(0);

    const totalPages = Math.ceil(backups.length / PAGE_SIZE);
    const paginated = backups.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const totalSizeMb = backups.reduce((sum, b) => sum + b.size_mb, 0);
    const lastBackup = backups[0] ?? null;

    const fetchBackups = async () => {
        setLoading(true);
        try {
            const data = await backupsApi.list();
            setBackups(data);
            setPage(0);
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar respaldos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchBackups(); }, []);

    const handleCreateBackup = async () => {
        if (creating) return;
        setCreating(true);
        const toastId = toast.loading('Generando respaldo de base de datos...');
        try {
            await backupsApi.create();
            toast.success('Respaldo creado exitosamente', { id: toastId });
            fetchBackups();
        } catch (error: any) {
            const msg = error.response?.data?.detail || 'Error al generar respaldo';
            toast.error(msg, { id: toastId });
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (filename: string) => {
        if (!window.confirm('¿Eliminar este respaldo? Esta acción no se puede deshacer.')) return;
        setDeleting(filename);
        try {
            await backupsApi.delete(filename);
            toast.success('Respaldo eliminado');
            setBackups(prev => prev.filter(b => b.filename !== filename));
        } catch (error) {
            toast.error('Error al eliminar respaldo');
        } finally {
            setDeleting(null);
        }
    };

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
            toast.error('Error al descargar el respaldo');
        } finally {
            setDownloading(null);
        }
    };

    return (
        <div className="space-y-5 max-w-5xl">

            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <HardDrive className="h-7 w-7 text-blue-600" />
                        Copias de Seguridad
                    </h1>
                    <p className="text-slate-500 text-sm mt-0.5">PostgreSQL · Respaldo automático diario 02:00 UTC · Se conservan los últimos 7</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchBackups}
                        disabled={loading}
                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Refrescar"
                    >
                        <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={handleCreateBackup}
                        disabled={creating}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                        {creating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        {creating ? 'Generando...' : 'Generar Ahora'}
                    </button>
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                        <Database className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total respaldos</p>
                        <p className="text-2xl font-bold text-slate-800">{backups.length}</p>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 rounded-lg">
                        <Clock className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Último respaldo</p>
                        <p className="text-sm font-semibold text-slate-800 leading-tight">
                            {lastBackup ? formatDate(lastBackup.created_at) : '—'}
                        </p>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
                    <div className="p-2 bg-violet-50 rounded-lg">
                        <HardDrive className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Espacio total</p>
                        <p className="text-2xl font-bold text-slate-800">{formatSize(totalSizeMb)}</p>
                    </div>
                </div>
            </div>

            {/* Auto-backup info banner */}
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <Zap className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <p className="text-sm text-blue-700">
                    <strong>Respaldo automático activo:</strong> Se genera diariamente a las 02:00 UTC y se conservan automáticamente los últimos 7 respaldos.
                </p>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-700">
                    Estos respaldos contienen <strong>toda la base de datos</strong> (todos los tenants). Descárgalos y guárdalos en un lugar seguro.
                </p>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {loading && backups.length === 0 ? (
                    <div className="p-10 text-center text-slate-400">
                        <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-slate-300" />
                        Cargando respaldos...
                    </div>
                ) : backups.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center">
                        <FileArchive className="h-12 w-12 text-slate-200 mb-3" />
                        <p className="font-semibold text-slate-700">No hay respaldos aún</p>
                        <p className="text-sm text-slate-400 mt-1">El próximo respaldo automático será a las 02:00 UTC</p>
                    </div>
                ) : (
                    <>
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Archivo</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                        <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Fecha</span>
                                    </th>
                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tamaño</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {paginated.map((backup, idx) => {
                                    const isNewest = page === 0 && idx === 0;
                                    return (
                                        <tr key={backup.filename} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <FileArchive className="h-4 w-4 text-slate-400 shrink-0" />
                                                    <span className="text-sm font-mono text-slate-700 truncate max-w-[220px]" title={backup.filename}>
                                                        {backup.filename}
                                                    </span>
                                                    {isNewest && (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                                            RECIENTE
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                                                {formatDate(backup.created_at)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-600 rounded-md">
                                                    {formatSize(backup.size_mb)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => handleDownload(backup.filename)}
                                                        disabled={downloading === backup.filename}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                                                        title="Descargar"
                                                    >
                                                        {downloading === backup.filename
                                                            ? <RefreshCw className="h-4 w-4 animate-spin" />
                                                            : <Download className="h-4 w-4" />}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(backup.filename)}
                                                        disabled={deleting === backup.filename}
                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                        title="Eliminar"
                                                    >
                                                        {deleting === backup.filename
                                                            ? <RefreshCw className="h-4 w-4 animate-spin" />
                                                            : <Trash2 className="h-4 w-4" />}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
                                <p className="text-xs text-slate-500">
                                    Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, backups.length)} de {backups.length} respaldos
                                </p>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => setPage(p => Math.max(0, p - 1))}
                                        disabled={page === 0}
                                        className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-40 transition-colors"
                                    >
                                        <ChevronLeft className="h-4 w-4 text-slate-600" />
                                    </button>
                                    {Array.from({ length: totalPages }, (_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setPage(i)}
                                            className={`w-7 h-7 text-xs font-semibold rounded-lg transition-colors ${
                                                i === page
                                                    ? 'bg-blue-600 text-white'
                                                    : 'hover:bg-slate-200 text-slate-600'
                                            }`}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                        disabled={page === totalPages - 1}
                                        className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-40 transition-colors"
                                    >
                                        <ChevronRight className="h-4 w-4 text-slate-600" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default BackupsPage;
