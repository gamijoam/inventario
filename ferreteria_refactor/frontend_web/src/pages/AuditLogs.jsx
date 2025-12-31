import React, { useState, useEffect } from 'react';
import { ClipboardList, Filter, RefreshCw, Search, Clock, User, Database } from 'lucide-react';
import auditService from '../services/auditService';

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
        } finally {
            setLoading(false);
        }
    };

    const formatChanges = (changesStr) => {
        if (!changesStr) return <span className="text-gray-400 italic">Sin detalles</span>;

        try {
            // 1. Try to parse JSON
            const changes = JSON.parse(changesStr);

            // 2. Render JSON object
            return (
                <div className="text-xs font-mono space-y-1">
                    {Object.entries(changes).map(([key, val]) => {
                        // Check if it's a Diff object (has old/new keys)
                        if (val && typeof val === 'object' && ('old' in val || 'new' in val)) {
                            return (
                                <div key={key} className="flex gap-2">
                                    <span className="font-bold text-gray-600">{key}:</span>
                                    <span className="text-red-500 line-through">{String(val.old)}</span>
                                    <span>→</span>
                                    <span className="text-green-600 font-bold">{String(val.new)}</span>
                                </div>
                            );
                        }
                        // Fallback for flat Key-Value pairs (e.g. Config changes)
                        return (
                            <div key={key} className="flex gap-2">
                                <span className="font-bold text-gray-600">{key}:</span>
                                <span className="text-gray-700">{val !== null && typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                            </div>
                        );
                    })}
                </div>
            );
        } catch (e) {
            // 3. Fallback: If not JSON, display as plain text
            return <span className="text-gray-600 text-xs">{changesStr}</span>;
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <ClipboardList className="text-blue-600" size={32} />
                        Auditoría del Sistema
                    </h1>
                    <p className="text-gray-500 mt-1">Registro de cambios y actividades críticas</p>
                </div>
                <button
                    onClick={fetchLogs}
                    className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
                >
                    <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                    Actualizar
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex gap-4 items-center">
                <Filter className="text-gray-400" size={20} />
                <select
                    className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={filters.table_name}
                    onChange={e => setFilters({ ...filters, table_name: e.target.value })}
                >
                    <option value="ALL">Todas las Tablas</option>
                    <option value="products">Productos</option>
                    <option value="users">Usuarios</option>
                    <option value="sales">Ventas</option>
                </select>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                                <th className="px-6 py-4">Fecha/Hora</th>
                                <th className="px-6 py-4">Usuario</th>
                                <th className="px-6 py-4">Acción</th>
                                <th className="px-6 py-4">Entidad</th>
                                <th className="px-6 py-4">Cambios</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-400">
                                        Cargando registros...
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-400">
                                        No se encontraron registros de auditoría reciente.
                                    </td>
                                </tr>
                            ) : (
                                logs.map(log => (
                                    <tr key={log.id} className="hover:bg-blue-50/30 transition-colors cursor-default">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            <div className="flex items-center gap-2">
                                                <Clock size={14} className="text-gray-400" />
                                                {new Date(log.timestamp).toLocaleString('es-VE')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">
                                                    {log.user ? log.user.username.charAt(0).toUpperCase() : (log.user_id || '?')}
                                                </div>
                                                <span className="text-sm font-medium text-gray-700">
                                                    {log.user ? log.user.username : `Usuario #${log.user_id}`}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${log.action === 'CREATE' ? 'bg-green-100 text-green-700' :
                                                log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                                                    log.action === 'DELETE' ? 'bg-red-100 text-red-700' :
                                                        'bg-gray-100 text-gray-700'
                                                }`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <div className="flex items-center gap-2">
                                                <Database size={14} />
                                                {log.table_name} <span className="text-gray-300">#{log.record_id}</span>
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
