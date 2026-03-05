import React, { useEffect, useState } from 'react';
import {
    Monitor, Plus, Copy, Check, Pencil, Power, RefreshCw,
    ShieldCheck, ShieldOff, CalendarClock, Users, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getLicenses, deactivateLicense, updateLicense } from '../api/desktopLicenses';
import type { DesktopLicense } from '../api/desktopLicenses';
import CreateLicenseModal from '../components/CreateLicenseModal';
import EditLicenseModal from '../components/EditLicenseModal';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (iso: string | null) => {
    if (!iso) return <span className="text-gray-400 text-xs italic">Perpetua</span>;
    return new Date(iso).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
};

const isExpired = (iso: string | null) => {
    if (!iso) return false;
    return new Date(iso) < new Date();
};

const MODULE_BADGES: { key: keyof DesktopLicense; label: string; color: string }[] = [
    { key: 'has_hardware_module',   label: 'HW',   color: 'bg-slate-100 text-slate-600' },
    { key: 'has_restaurant_module', label: 'REST', color: 'bg-orange-100 text-orange-700' },
    { key: 'has_barbershop_module', label: 'BARB', color: 'bg-purple-100 text-purple-700' },
    { key: 'has_laundry_module',    label: 'LAVD', color: 'bg-blue-100 text-blue-700' },
    { key: 'has_services_module',   label: 'SERV', color: 'bg-teal-100 text-teal-700' },
];

// ── Componente de copia de clave ──────────────────────────────────────────────

const CopyKey: React.FC<{ value: string }> = ({ value }) => {
    const [copied, setCopied] = useState(false);

    const copy = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success('Clave copiada');
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={copy}
            className="group flex items-center gap-2 font-mono text-sm text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
        >
            {value}
            {copied
                ? <Check className="w-3.5 h-3.5 text-green-600" />
                : <Copy className="w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-600" />
            }
        </button>
    );
};

// ── Página principal ──────────────────────────────────────────────────────────

const DesktopLicenses: React.FC = () => {
    const [licenses, setLicenses] = useState<DesktopLicense[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    const [createOpen, setCreateOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<DesktopLicense | null>(null);

    const fetch = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getLicenses();
            setLicenses(data);
        } catch {
            setError('No se pudieron cargar las licencias');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetch(); }, []);

    const handleToggleActive = async (lic: DesktopLicense) => {
        if (lic.is_active) {
            if (!window.confirm(`¿Desactivar la licencia de "${lic.customer_name}"?\nEl cliente no podrá activar ni usar Invensoft Desktop.`)) return;
            const id = toast.loading('Desactivando...');
            try {
                await deactivateLicense(lic.id);
                setLicenses(prev => prev.map(l => l.id === lic.id ? { ...l, is_active: false } : l));
                toast.success('Licencia desactivada', { id });
            } catch {
                toast.error('Error al desactivar', { id });
            }
        } else {
            const id = toast.loading('Reactivando...');
            try {
                const updated = await updateLicense(lic.id, { is_active: true });
                setLicenses(prev => prev.map(l => l.id === lic.id ? updated : l));
                toast.success('Licencia reactivada', { id });
            } catch {
                toast.error('Error al reactivar', { id });
            }
        }
    };

    const filtered = licenses.filter(l =>
        !search ||
        l.license_key.includes(search.toUpperCase()) ||
        l.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        l.customer_email?.toLowerCase().includes(search.toLowerCase())
    );

    // Stats
    const total = licenses.length;
    const active = licenses.filter(l => l.is_active && !isExpired(l.expires_at)).length;
    const expired = licenses.filter(l => isExpired(l.expires_at)).length;
    const inactive = licenses.filter(l => !l.is_active).length;

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-xl">
                        <Monitor className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Licencias Desktop</h1>
                        <p className="text-sm text-gray-500">Invensoft Desktop (Tauri) — gestión de claves</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetch}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Actualizar"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setCreateOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        Nueva Licencia
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Total', value: total, icon: Monitor, color: 'bg-slate-50 text-slate-700 border-slate-200' },
                    { label: 'Activas', value: active, icon: ShieldCheck, color: 'bg-green-50 text-green-700 border-green-200' },
                    { label: 'Vencidas', value: expired, icon: CalendarClock, color: 'bg-amber-50 text-amber-700 border-amber-200' },
                    { label: 'Suspendidas', value: inactive, icon: ShieldOff, color: 'bg-red-50 text-red-700 border-red-200' },
                ].map(s => (
                    <div key={s.label} className={`flex items-center gap-3 p-4 rounded-xl border ${s.color}`}>
                        <s.icon className="w-5 h-5 opacity-70" />
                        <div>
                            <p className="text-2xl font-bold">{s.value}</p>
                            <p className="text-xs font-medium opacity-70">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Buscar por clave, cliente o email..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full max-w-sm px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-3"></div>
                        <span className="text-gray-500">Cargando licencias...</span>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-16 text-red-500">
                        <AlertCircle className="w-8 h-8 mb-2" />
                        <p>{error}</p>
                        <button onClick={fetch} className="mt-3 text-sm text-red-600 underline">Reintentar</button>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                        <Monitor className="w-10 h-10 mb-3 opacity-30" />
                        <p className="font-medium">
                            {search ? 'Sin resultados para la búsqueda' : 'No hay licencias creadas aún'}
                        </p>
                        {!search && (
                            <button
                                onClick={() => setCreateOpen(true)}
                                className="mt-3 text-sm text-indigo-600 underline"
                            >
                                Crear primera licencia
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <th className="px-4 py-3 text-left">Clave</th>
                                    <th className="px-4 py-3 text-left">Cliente</th>
                                    <th className="px-4 py-3 text-left">Módulos</th>
                                    <th className="px-4 py-3 text-center">Dispositivos</th>
                                    <th className="px-4 py-3 text-left">Vence</th>
                                    <th className="px-4 py-3 text-center">Estado</th>
                                    <th className="px-4 py-3 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filtered.map(lic => {
                                    const expired_flag = isExpired(lic.expires_at);
                                    const statusBadge = !lic.is_active
                                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><ShieldOff className="w-3 h-3"/>Suspendida</span>
                                        : expired_flag
                                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><CalendarClock className="w-3 h-3"/>Vencida</span>
                                            : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><ShieldCheck className="w-3 h-3"/>Activa</span>;

                                    return (
                                        <tr key={lic.id} className={`hover:bg-gray-50 transition-colors ${!lic.is_active ? 'opacity-60' : ''}`}>
                                            <td className="px-4 py-3">
                                                <CopyKey value={lic.license_key} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-gray-900">{lic.customer_name || <span className="text-gray-400 italic">Sin nombre</span>}</p>
                                                {lic.customer_email && <p className="text-xs text-gray-400">{lic.customer_email}</p>}
                                                {lic.notes && <p className="text-xs text-gray-400 italic truncate max-w-[160px]" title={lic.notes}>{lic.notes}</p>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {MODULE_BADGES.map(m => lic[m.key] ? (
                                                        <span key={m.key} className={`px-1.5 py-0.5 rounded text-xs font-semibold ${m.color}`}>
                                                            {m.label}
                                                        </span>
                                                    ) : null)}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <Users className="w-3.5 h-3.5 text-gray-400" />
                                                    <span className={`font-medium ${lic.activations_count >= lic.max_devices ? 'text-amber-600' : 'text-gray-700'}`}>
                                                        {lic.activations_count}/{lic.max_devices}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                <span className={expired_flag ? 'text-amber-600 font-medium' : ''}>
                                                    {fmtDate(lic.expires_at)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {statusBadge}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => setEditTarget(lic)}
                                                        className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleActive(lic)}
                                                        className={`p-1.5 rounded-lg transition-colors ${
                                                            lic.is_active
                                                                ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                                                                : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                                                        }`}
                                                        title={lic.is_active ? 'Suspender' : 'Reactivar'}
                                                    >
                                                        <Power className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modals */}
            <CreateLicenseModal
                isOpen={createOpen}
                onClose={() => setCreateOpen(false)}
                onSuccess={fetch}
            />
            <EditLicenseModal
                isOpen={!!editTarget}
                onClose={() => setEditTarget(null)}
                onSuccess={fetch}
                license={editTarget}
            />
        </div>
    );
};

export default DesktopLicenses;
