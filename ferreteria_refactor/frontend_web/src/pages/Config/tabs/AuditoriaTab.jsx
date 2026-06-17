import React, { useState, useEffect } from 'react';
import { ClipboardList, Filter, RefreshCw, Clock, ArrowRight, ChevronDown, ChevronUp, Shield } from 'lucide-react';
import auditService from '../../../services/auditService';
import { toast } from 'react-hot-toast';

const ACTION_STYLES = {
    CREATE: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'CREAR' },
    UPDATE: { bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500', label: 'EDITAR' },
    DELETE: { bg: 'bg-rose-100',    text: 'text-rose-700',    dot: 'bg-rose-500',    label: 'ELIMINAR' },
};

const TABLE_LABELS = {
    products:  'Productos',
    users:     'Usuarios',
    sales:     'Ventas',
    purchases: 'Compras',
    suppliers: 'Proveedores',
    customers: 'Clientes',
};

const fmtDate = (ts) => {
    const d = new Date(ts);
    return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })
        + ' · ' + d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
};

// ─── Card de cambios expandible ───────────────────────────────────────────────
const ChangesPanel = ({ changesStr }) => {
    if (!changesStr) return <span className="text-slate-400 text-xs italic">Sin detalles</span>;

    let changes;
    try { changes = JSON.parse(changesStr); }
    catch { return <span className="text-xs text-slate-500 break-all font-mono">{changesStr}</span>; }

    const entries = Object.entries(changes);
    if (entries.length === 0) return <span className="text-slate-400 text-xs italic">Sin cambios registrados</span>;

    return (
        <div className="space-y-1.5">
            {entries.map(([key, val]) => {
                const isOldNew = val && typeof val === 'object' && ('old' in val || 'new' in val);
                return (
                    <div key={key} className="flex flex-col gap-1 text-xs pb-2 border-b border-slate-100 last:border-0 last:pb-0">
                        <span className="font-black text-slate-500 shrink-0 min-w-[80px] pt-0.5">{key}</span>
                        {isOldNew ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded font-mono line-through break-all">
                                    {String(val.old ?? '—')}
                                </span>
                                <ArrowRight size={10} className="text-slate-400 shrink-0" />
                                <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-mono font-bold break-all">
                                    {String(val.new ?? '—')}
                                </span>
                            </div>
                        ) : (
                            <span className="text-slate-600 font-mono break-all">
                                {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// ─── Fila de log ──────────────────────────────────────────────────────────────
const LogRow = ({ log }) => {
    const [expanded, setExpanded] = useState(false);
    const style = ACTION_STYLES[log.action] || ACTION_STYLES.UPDATE;
    const userName = log.user?.username || `#${log.user_id}`;
    const userInitial = userName.charAt(0).toUpperCase();
    const tableLabel = TABLE_LABELS[log.table_name] || log.table_name;

    let changesCount = 0;
    try {
        const c = JSON.parse(log.changes || '{}');
        changesCount = Object.keys(c).length;
    } catch {}

    return (
        <div className={`bg-white rounded-lg border transition-all duration-200 overflow-hidden ${expanded ? 'border-indigo-200 shadow-sm' : 'border-slate-200 hover:border-indigo-200 hover:shadow-sm'}`}>
            {/* Header siempre visible */}
            <button
                onClick={() => setExpanded(e => !e)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
            >
                {/* Dot acción */}
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`} />

                {/* Badge acción */}
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md shrink-0 ${style.bg} ${style.text}`}>
                    {style.label}
                </span>

                {/* Tabla + ID */}
                <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md shrink-0">
                    <span className="text-xs font-bold text-slate-700">{tableLabel}</span>
                    <span className="text-[10px] text-slate-400 font-mono">#{log.record_id}</span>
                </div>

                {/* Usuario */}
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <div className="h-6 w-6 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-black flex items-center justify-center shrink-0">
                        {userInitial}
                    </div>
                    <span className="text-xs font-bold text-slate-600 truncate">{userName}</span>
                </div>

                {/* Fecha */}
                <div className="flex items-center gap-1 text-slate-400 shrink-0">
                    <Clock size={11} />
                    <span className="text-[11px] font-medium hidden sm:block">{fmtDate(log.timestamp)}</span>
                    <span className="text-[11px] font-medium sm:hidden">
                        {new Date(log.timestamp).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>

                {/* Contador cambios + chevron */}
                {changesCount > 0 && (
                    <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-md shrink-0">
                        {changesCount} campo{changesCount !== 1 ? 's' : ''}
                    </span>
                )}
                {expanded
                    ? <ChevronUp size={14} className="text-slate-400 shrink-0" />
                    : <ChevronDown size={14} className="text-slate-400 shrink-0" />
                }
            </button>

            {/* Detalle expandido */}
            {expanded && (
                <div className="px-4 pb-4 pt-1 border-t border-slate-100 bg-slate-50/50">
                    <ChangesPanel changesStr={log.changes} />
                </div>
            )}
        </div>
    );
};

// ─── Componente principal ─────────────────────────────────────────────────────
const AuditoriaTab = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ limit: 50, table_name: 'ALL' });

    useEffect(() => { fetchLogs(); }, [filters]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const data = await auditService.getLogs(filters);
            setLogs(data);
        } catch {
            toast.error('Error al cargar auditoría');
        } finally {
            setLoading(false);
        }
    };

    const stats = {
        total: logs.length,
        creates: logs.filter(l => l.action === 'CREATE').length,
        updates: logs.filter(l => l.action === 'UPDATE').length,
        deletes: logs.filter(l => l.action === 'DELETE').length,
    };

    return (
        <div className="space-y-5">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-indigo-50 rounded-md flex items-center justify-center">
                        <Shield size={20} className="text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="font-black text-slate-900 text-lg">Registro de Actividad</h2>
                        <p className="text-xs text-slate-400">Todos los cambios quedan registrados</p>
                    </div>
                </div>
                <button
                    onClick={fetchLogs}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-md text-sm font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm active:scale-95"
                >
                    <RefreshCw size={15} className={loading ? 'animate-spin text-indigo-500' : ''} />
                    Actualizar
                </button>
            </div>

            {/* Stats */}
            {!loading && logs.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: 'Total', value: stats.total, color: 'bg-slate-100 text-slate-700' },
                        { label: 'Creados', value: stats.creates, color: 'bg-emerald-100 text-emerald-700' },
                        { label: 'Editados', value: stats.updates, color: 'bg-indigo-100 text-indigo-700' },
                        { label: 'Eliminados', value: stats.deletes, color: 'bg-rose-100 text-rose-700' },
                    ].map(s => (
                        <div key={s.label} className={`${s.color} rounded-lg px-3 py-2.5 text-center`}>
                            <p className="text-xl font-black">{s.value}</p>
                            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">{s.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Filtro */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
                <Filter size={15} className="text-slate-400 shrink-0" />
                <span className="text-sm font-bold text-slate-500">Filtrar por tabla:</span>
                <select
                    value={filters.table_name}
                    onChange={e => setFilters({ ...filters, table_name: e.target.value })}
                    className="w-full sm:flex-1 bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
                >
                    <option value="ALL">Todas las tablas</option>
                    <option value="products">Productos</option>
                    <option value="users">Usuarios</option>
                    <option value="sales">Ventas</option>
                    <option value="purchases">Compras</option>
                    <option value="suppliers">Proveedores</option>
                    <option value="customers">Clientes</option>
                </select>
            </div>

            {/* Lista de logs */}
            <div className="space-y-2">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                        <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3" style={{ borderWidth: 3 }} />
                        <p className="text-sm font-bold">Cargando registros...</p>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-300">
                        <ClipboardList size={48} strokeWidth={1} />
                        <p className="text-sm font-bold mt-3 text-slate-400">Sin registros de auditoría</p>
                        <p className="text-xs text-slate-300 mt-1">Los cambios aparecerán aquí automáticamente</p>
                    </div>
                ) : (
                    logs.map(log => <LogRow key={log.id} log={log} />)
                )}
            </div>
        </div>
    );
};

export default AuditoriaTab;
