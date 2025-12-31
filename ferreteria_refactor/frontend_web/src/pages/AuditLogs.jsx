import React, { useState, useEffect } from 'react';
import { ClipboardList, Filter, RefreshCw, Search, Clock, User, Database, ArrowRight } from 'lucide-react';
import auditService from '../services/auditService';
import clsx from 'clsx';
import { toast } from 'react-hot-toast';

const AuditLogs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        limit: 50,
        table_name: 'ALL'
    });

    useEffect(() => {
        fetchLogs();
    }, [filters]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const data = await auditService.getLogs(filters);
            setLogs(data);
        } catch (error) {
            console.error("Error fetching audit logs", error);
            toast.error("Error al cargar auditoría");
        } finally {
            setLoading(false);
        }
    };

    const formatChanges = (changesStr) => {
        if (!changesStr) return <span className="text-slate-400 italic text-xs">Sin detalles</span>;

        try {
            const changes = JSON.parse(changesStr);
            return (
                <div className="text-xs font-mono space-y-1.5 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    {Object.entries(changes).map(([key, val]) => {
                        if (val && typeof val === 'object' && ('old' in val || 'new' in val)) {
                            return (
                                <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 border-b border-slate-100 last:border-0 pb-1 last:pb-0">
                                    <span className="font-bold text-slate-600 min-w-[80px]">{key}:</span>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-rose-500 line-through opacity-70 bg-rose-50 px-1 rounded">{String(val.old)}</span>
                                        <ArrowRight size={10} className="text-slate-400" />
                                        <span className="text-emerald-600 font-bold bg-emerald-50 px-1 rounded">{String(val.new)}</span>
                                    </div>
                                </div>
                            );
                        }
                        return (
                            <div key={key} className="flex gap-2 items-start">
                                <span className="font-bold text-slate-600">{key}:</span>
                                <span className="text-slate-700 break-all">{val !== null && typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                            </div>
                        );
                    })}
                </div>
            );
        } catch (e) {
            return <span className="text-slate-600 text-xs break-all">{changesStr}</span>;
        }
    };

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col bg-slate-50 p-6 overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                            <ClipboardList size={24} />
                        </div>
                        Auditoría del Sistema
                    </h1>
                    <p className="text-slate-500 font-medium ml-12">Log de cambios y seguridad</p>
                </div>
                <button
                    onClick={fetchLogs}
                    className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm hover:bg-slate-50 text-slate-600 font-bold transition-all active:scale-95"
                >
                    <RefreshCw size={18} className={clsx(loading && "animate-spin")} />
                    Actualizar
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 flex gap-4 items-center flex-shrink-0">
                <div className="flex items-center gap-2 text-slate-500 font-medium">
                    <Filter size={20} />
                    <span>Filtrar por:</span>
                </div>
                <select
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all cursor-pointer"
                    value={filters.table_name}
                    onChange={e => setFilters({ ...filters, table_name: e.target.value })}
                >
                    <option value="ALL">Todas las Tablas</option>
                    <option value="products">Productos</option>
                    <option value="users">Usuarios</option>
                    <option value="sales">Ventas</option>
                    <option value="purchases">Compras</option>
                    <option value="suppliers">Proveedores</option>
                    <option value="customers">Clientes</option>
                </select>
            </div>

            {/* Table */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="overflow-y-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha/Hora</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Usuario</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Acción</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Entidad</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-1/2">Cambios</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-20 text-center text-slate-400">
                                        <div className="flex flex-col items-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
                                            Cargando registros...
                                        </div>
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-20 text-center text-slate-400 opacity-60">
                                        <Database size={48} className="mx-auto mb-2" />
                                        No se encontraron registros recientes.
                                    </td>
                                </tr>
                            ) : (
                                logs.map(log => (
                                    <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                                            <div className="flex items-center gap-2">
                                                <Clock size={14} className="text-slate-400" />
                                                {new Date(log.timestamp).toLocaleString('es-VE')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 text-xs font-black ring-2 ring-white shadow-sm">
                                                    {log.user ? log.user.username.charAt(0).toUpperCase() : (log.user_id || '?')}
                                                </div>
                                                <span className="text-sm font-bold text-slate-700">
                                                    {log.user ? log.user.username : `User #${log.user_id}`}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={clsx(
                                                "px-2.5 py-1 rounded-lg text-xs font-bold border",
                                                log.action === 'CREATE' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                                    log.action === 'UPDATE' ? "bg-blue-50 text-blue-700 border-blue-100" :
                                                        log.action === 'DELETE' ? "bg-rose-50 text-rose-700 border-rose-100" :
                                                            "bg-slate-100 text-slate-700 border-slate-200"
                                            )}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                            <div className="flex items-center gap-2 font-mono bg-slate-100 px-2 py-1 rounded w-fit">
                                                <Database size={12} className="text-slate-400" />
                                                <span className="font-bold">{log.table_name}</span>
                                                <span className="text-slate-400">#{log.record_id}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            {formatChanges(log.changes)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AuditLogs;
