import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    getTenants,
    deleteTenant,
    updateTenantStatus,
    updateTenant,
    impersonateTenant,
} from '../api/tenants';
import type { Tenant } from '../types/tenant';
import {
    Plus,
    Search,
    Building2,
    Trash2,
    Edit,
    Utensils,
    Shirt,
    Zap,
    ShoppingBag,
    Key,
    Scissors,
    Pill,
    Users,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    AlertTriangle,
    RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import CreateTenantModal from '../components/CreateTenantModal';
import EditTenantModal from '../components/EditTenantModal';
import Switch from '../components/ui/Switch';

// ─── Constants ────────────────────────────────────────────────────────────────

const CARDS_PER_PAGE = 12;

// ─── Module definitions ───────────────────────────────────────────────────────

interface ModuleDef {
    key: keyof Tenant;
    label: string;
    shortLabel: string;
    Icon: React.FC<{ size?: number; className?: string }>;
    activeColor: string;      // bg + text classes when active
    activeBorder: string;     // border class when active
    inactiveColor: string;
}

const MODULE_DEFS: ModuleDef[] = [
    {
        key: 'has_hardware_module',
        label: 'Ferretería / Retail',
        shortLabel: 'Retail',
        Icon: ShoppingBag,
        activeColor: 'bg-blue-50 text-blue-600',
        activeBorder: 'border-blue-200',
        inactiveColor: 'bg-slate-50 text-slate-300 border-slate-200',
    },
    {
        key: 'has_restaurant_module',
        label: 'Restaurante',
        shortLabel: 'Rest.',
        Icon: Utensils,
        activeColor: 'bg-orange-50 text-orange-600',
        activeBorder: 'border-orange-200',
        inactiveColor: 'bg-slate-50 text-slate-300 border-slate-200',
    },
    {
        key: 'has_laundry_module',
        label: 'Lavandería',
        shortLabel: 'Lavand.',
        Icon: Shirt,
        activeColor: 'bg-cyan-50 text-cyan-600',
        activeBorder: 'border-cyan-200',
        inactiveColor: 'bg-slate-50 text-slate-300 border-slate-200',
    },
    {
        key: 'has_services_module',
        label: 'Servicios',
        shortLabel: 'Servicios',
        Icon: Zap,
        activeColor: 'bg-purple-50 text-purple-600',
        activeBorder: 'border-purple-200',
        inactiveColor: 'bg-slate-50 text-slate-300 border-slate-200',
    },
    {
        key: 'has_barbershop_module',
        label: 'Barbería / Salón',
        shortLabel: 'Barbería',
        Icon: Scissors,
        activeColor: 'bg-emerald-50 text-emerald-600',
        activeBorder: 'border-emerald-200',
        inactiveColor: 'bg-slate-50 text-slate-300 border-slate-200',
    },
    {
        key: 'has_pharmacy_module',
        label: 'Farmacia',
        shortLabel: 'Farmacia',
        Icon: Pill,
        activeColor: 'bg-rose-50 text-rose-600',
        activeBorder: 'border-rose-200',
        inactiveColor: 'bg-slate-50 text-slate-300 border-slate-200',
    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generates a deterministic HSL background color from a string.
 * Returns Tailwind-compatible inline style values.
 */
function getAvatarStyle(name: string): React.CSSProperties {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return {
        backgroundColor: `hsl(${hue}, 55%, 88%)`,
        color: `hsl(${hue}, 45%, 30%)`,
    };
}

function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Returns days remaining until a given ISO date string.
 * Negative means expired.
 */
function calcDaysRemaining(isoDate: string | null): number | null {
    if (!isoDate) return null;
    const now = new Date();
    const exp = new Date(isoDate);
    return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SubscriptionBadgeProps {
    tenant: Tenant;
}

const SubscriptionBadge: React.FC<SubscriptionBadgeProps> = ({ tenant }) => {
    const expiryDate = tenant.subscription_expires_at ?? tenant.trial_ends_at;
    const daysLeft = tenant.days_remaining ?? calcDaysRemaining(expiryDate);

    if (tenant.license_type === 'lifetime') {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                Vitalicia
            </span>
        );
    }

    if (tenant.is_demo) {
        if (daysLeft === null) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                    Demo
                </span>
            );
        }
        if (daysLeft <= 0) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">
                    <AlertTriangle size={11} />
                    Demo vencida
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                Demo · {daysLeft}d
            </span>
        );
    }

    if (daysLeft === null) return null;

    if (daysLeft <= 0) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">
                <AlertTriangle size={11} />
                Vencida
            </span>
        );
    }
    if (daysLeft <= 14) {
        return (
            <div className="space-y-1">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-amber-600 font-medium">Vence en {daysLeft}d</span>
                    <span className="text-xs text-slate-400">{new Date(expiryDate!).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })}</span>
                </div>
                <div className="w-full bg-amber-100 rounded-full h-1.5">
                    <div
                        className="bg-amber-400 h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min((daysLeft / 14) * 100, 100)}%` }}
                    />
                </div>
            </div>
        );
    }
    return (
        <span className="text-xs text-slate-500">
            Vence: {new Date(expiryDate!).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
    );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const Tenants: React.FC = () => {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

    useEffect(() => {
        fetchTenants();
    }, []);

    // Reset to page 1 whenever search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    // ── Data fetching ──────────────────────────────────────────────────────────

    const fetchTenants = async () => {
        try {
            setIsLoading(true);
            const data = await getTenants();
            setTenants(data.tenants);
            setError(null);
        } catch (err) {
            console.error(err);
            setError('Error al cargar empresas');
            toast.error('No se pudieron cargar las empresas');
        } finally {
            setIsLoading(false);
        }
    };

    // ── Actions ────────────────────────────────────────────────────────────────

    const handleDelete = async (id: number, name: string) => {
        if (
            !window.confirm(
                `¿Estás seguro de eliminar la empresa "${name}"?\n\n⚠️ ESTA ACCIÓN ELIMINARÁ TODOS LOS DATOS Y ESQUEMAS DE BASE DE DATOS.\nNO SE PUEDE DESHACER.`
            )
        ) {
            return;
        }
        const toastId = toast.loading('Eliminando empresa...');
        try {
            await deleteTenant(id);
            setTenants(prev => prev.filter(t => t.id !== id));
            toast.success('Empresa eliminada correctamente', { id: toastId });
        } catch (error: any) {
            console.error(error);
            toast.error(error.response?.data?.detail || 'Error al eliminar empresa', { id: toastId });
        }
    };

    const handleStatusChange = async (id: number, currentStatus: boolean) => {
        const newStatus = !currentStatus;
        setTenants(prev => prev.map(t => (t.id === id ? { ...t, is_active: newStatus } : t)));
        try {
            await updateTenantStatus(id, newStatus);
            toast.success(`Empresa ${newStatus ? 'activada' : 'desactivada'}`);
        } catch (error: any) {
            console.error(error);
            setTenants(prev => prev.map(t => (t.id === id ? { ...t, is_active: currentStatus } : t)));
            toast.error('Error al actualizar estado');
        }
    };

    const handleModuleToggle = async (id: number, moduleKey: keyof Tenant, newValue: boolean) => {
        setTenants(prev => prev.map(t => (t.id === id ? { ...t, [moduleKey]: newValue } : t)));
        try {
            // @ts-ignore – dynamic key
            await updateTenant(id, { [moduleKey]: newValue });
            toast.success('Módulo actualizado');
        } catch (error) {
            console.error(error);
            setTenants(prev => prev.map(t => (t.id === id ? { ...t, [moduleKey]: !newValue } : t)));
            toast.error('Error al actualizar módulo');
        }
    };

    const handleImpersonate = async (id: number, tenantName: string) => {
        const toastId = toast.loading(`Generando acceso para ${tenantName}...`);
        try {
            const data = await impersonateTenant(id);
            const protocol = window.location.protocol;
            const apiUrl = import.meta.env.VITE_API_URL || '';
            let targetUrl = '';

            if (window.location.hostname.includes('localhost')) {
                targetUrl = 'http://localhost:5173/login';
            } else {
                const baseDomain = apiUrl.includes('api-qa')
                    ? 'qa.miinventariofacil.com'
                    : 'miinventariofacil.com';
                targetUrl = data.tenant_domain
                    ? `${protocol}//${data.tenant_domain}/login`
                    : `${protocol}//${data.tenant_schema}.${baseDomain}/login`;
            }

            targetUrl += `${targetUrl.includes('?') ? '&' : '?'}impersonate_token=${data.access_token}`;
            window.open(targetUrl, '_blank');
            toast.success('Acceso generado correctamente', { id: toastId });
        } catch (error: any) {
            console.error(error);
            toast.error(error.response?.data?.detail || 'Error al generar acceso', { id: toastId });
        }
    };

    const openEditModal = (tenant: Tenant) => {
        setSelectedTenant(tenant);
        setIsEditModalOpen(true);
    };

    // ── Derived data ───────────────────────────────────────────────────────────

    const filteredTenants = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return tenants;
        return tenants.filter(
            t =>
                t.name.toLowerCase().includes(q) ||
                (t.domain ?? '').toLowerCase().includes(q) ||
                t.schema_name.toLowerCase().includes(q) ||
                (t.owner_email ?? '').toLowerCase().includes(q)
        );
    }, [tenants, searchQuery]);

    const totalPages = Math.max(1, Math.ceil(filteredTenants.length / CARDS_PER_PAGE));
    const paginatedTenants = filteredTenants.slice(
        (currentPage - 1) * CARDS_PER_PAGE,
        currentPage * CARDS_PER_PAGE
    );

    const stats = useMemo(() => {
        const total = tenants.length;
        const active = tenants.filter(t => t.is_active).length;
        const inactive = total - active;
        return { total, active, inactive };
    }, [tenants]);

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

                {/* ── Page header ─────────────────────────────────────────── */}
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">

                    {/* Left: title + stats */}
                    <div className="space-y-3">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 tracking-tight"
                                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                                Empresas
                            </h1>
                            <p className="mt-1 text-sm text-slate-500">
                                {isLoading ? 'Cargando...' : `${stats.total} empresa${stats.total !== 1 ? 's' : ''} registrada${stats.total !== 1 ? 's' : ''}`}
                            </p>
                        </div>

                        {/* Quick stats */}
                        {!isLoading && !error && (
                            <div className="flex flex-wrap gap-2">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                    {stats.total} total
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    {stats.active} activa{stats.active !== 1 ? 's' : ''}
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200">
                                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                                    {stats.inactive} inactiva{stats.inactive !== 1 ? 's' : ''}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Right: search + new */}
                    <div className="flex flex-col sm:flex-row gap-3 lg:items-center">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Buscar por nombre, dominio o schema…"
                                className="w-full sm:w-72 pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl shadow-sm placeholder-slate-400 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
                            />
                        </div>
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
                        >
                            <Plus className="h-4 w-4" />
                            Nueva Empresa
                        </button>
                    </div>
                </div>

                {/* ── Content area ─────────────────────────────────────────── */}
                {isLoading ? (
                    <LoadingGrid />
                ) : error ? (
                    <ErrorState message={error} onRetry={fetchTenants} />
                ) : filteredTenants.length === 0 ? (
                    <EmptyState hasSearch={searchQuery.length > 0} onClear={() => setSearchQuery('')} onNew={() => setIsCreateModalOpen(true)} />
                ) : (
                    <>
                        {/* Cards grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                            {paginatedTenants.map(tenant => (
                                <TenantCard
                                    key={tenant.id}
                                    tenant={tenant}
                                    onStatusChange={handleStatusChange}
                                    onModuleToggle={handleModuleToggle}
                                    onImpersonate={handleImpersonate}
                                    onEdit={openEditModal}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <Pagination
                                current={currentPage}
                                total={totalPages}
                                filtered={filteredTenants.length}
                                perPage={CARDS_PER_PAGE}
                                onChange={setCurrentPage}
                            />
                        )}
                    </>
                )}
            </div>

            {/* ── Modals ────────────────────────────────────────────────────── */}
            <CreateTenantModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={fetchTenants}
            />
            <EditTenantModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSuccess={fetchTenants}
                tenant={selectedTenant}
            />
        </div>
    );
};

// ─── TenantCard ───────────────────────────────────────────────────────────────

interface TenantCardProps {
    tenant: Tenant;
    onStatusChange: (id: number, current: boolean) => void;
    onModuleToggle: (id: number, key: keyof Tenant, value: boolean) => void;
    onImpersonate: (id: number, name: string) => void;
    onEdit: (tenant: Tenant) => void;
    onDelete: (id: number, name: string) => void;
}

const TenantCard: React.FC<TenantCardProps> = ({
    tenant,
    onStatusChange,
    onModuleToggle,
    onImpersonate,
    onEdit,
    onDelete,
}) => {
    const activeModules = MODULE_DEFS.filter(m => tenant[m.key] as boolean);

    return (
        <div
            className={`group relative flex flex-col bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${
                tenant.is_active
                    ? 'border-slate-200 hover:border-emerald-300'
                    : 'border-slate-200 opacity-75 hover:opacity-100'
            }`}
        >
            {/* Active/inactive left accent bar */}
            <div
                className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl transition-colors ${
                    tenant.is_active ? 'bg-emerald-500' : 'bg-red-400'
                }`}
            />

            {/* ── Card header ─────────────────────────────────────────────── */}
            <div className="pl-5 pr-4 pt-5 pb-4 flex items-start gap-3">
                {/* Avatar */}
                <div
                    className="flex-shrink-0 h-12 w-12 rounded-xl flex items-center justify-center text-base font-bold shadow-sm"
                    style={getAvatarStyle(tenant.name)}
                >
                    {getInitials(tenant.name)}
                </div>

                {/* Name + domain */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <Link
                            to={`/dashboard/tenants/${tenant.id}`}
                            className="text-base font-semibold text-slate-900 hover:text-emerald-600 transition-colors leading-tight truncate"
                            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                            title={tenant.name}
                        >
                            {tenant.name}
                        </Link>
                        {/* Status badge */}
                        <span
                            className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                tenant.is_active
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-red-50 text-red-600'
                            }`}
                        >
                            {tenant.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                    </div>

                    {/* Domain */}
                    <p className="mt-0.5 text-xs text-slate-500 truncate" title={tenant.domain ?? tenant.schema_name}>
                        {tenant.domain || (
                            <span className="font-mono">{tenant.schema_name}</span>
                        )}
                    </p>

                    {/* Email del admin */}
                    {tenant.owner_email && (
                        <p className="text-xs text-slate-400 truncate flex items-center gap-1 mt-0.5" title={tenant.owner_email}>
                            <span>✉</span>
                            <span className="font-mono">{tenant.owner_email}</span>
                        </p>
                    )}

                    {/* Schema (shown separately when domain exists) */}
                    {tenant.domain && (
                        <code className="mt-1 inline-block text-xs font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                            {tenant.schema_name}
                        </code>
                    )}
                </div>
            </div>

            {/* ── Subscription info ────────────────────────────────────────── */}
            <div className="px-5 pb-3">
                <SubscriptionBadge tenant={tenant} />
            </div>

            {/* ── Modules ─────────────────────────────────────────────────── */}
            <div className="px-5 pb-4">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Módulos</p>
                <div className="flex flex-wrap gap-1.5">
                    {MODULE_DEFS.map(mod => {
                        const isActive = tenant[mod.key] as boolean;
                        return (
                            <button
                                key={mod.key as string}
                                onClick={() => onModuleToggle(tenant.id, mod.key, !isActive)}
                                title={`${mod.label} — clic para ${isActive ? 'desactivar' : 'activar'}`}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition-all duration-150 ${
                                    isActive
                                        ? `${mod.activeColor} ${mod.activeBorder} shadow-sm hover:opacity-80`
                                        : `${mod.inactiveColor} hover:bg-slate-100 hover:text-slate-500`
                                }`}
                            >
                                <mod.Icon size={11} />
                                {mod.shortLabel}
                            </button>
                        );
                    })}
                </div>
                {activeModules.length === 0 && (
                    <p className="text-xs text-slate-400 italic">Sin módulos activos</p>
                )}
            </div>

            {/* ── Card footer ─────────────────────────────────────────────── */}
            <div className="mt-auto border-t border-slate-100 px-5 py-3 flex items-center justify-between gap-3">
                {/* Meta info */}
                <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                        <Users size={12} />
                        {tenant.user_count ?? 0} usuario{tenant.user_count !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1">
                        <CalendarDays size={12} />
                        {new Date(tenant.created_at).toLocaleDateString('es-VE', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                        })}
                    </span>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1">
                    {/* Toggle status inline */}
                    <Switch
                        checked={tenant.is_active}
                        onChange={() => onStatusChange(tenant.id, tenant.is_active)}
                    />
                    <span className="w-px h-4 bg-slate-200 mx-1" />
                    <button
                        onClick={() => onImpersonate(tenant.id, tenant.name)}
                        className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                        title="Acceder como Administrador"
                    >
                        <Key size={15} />
                    </button>
                    <button
                        onClick={() => onEdit(tenant)}
                        className="p-1.5 rounded-lg text-indigo-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                        title="Editar empresa"
                    >
                        <Edit size={15} />
                    </button>
                    <button
                        onClick={() => onDelete(tenant.id, tenant.name)}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Eliminar empresa"
                    >
                        <Trash2 size={15} />
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Pagination ───────────────────────────────────────────────────────────────

interface PaginationProps {
    current: number;
    total: number;
    filtered: number;
    perPage: number;
    onChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ current, total, filtered, perPage, onChange }) => {
    const from = (current - 1) * perPage + 1;
    const to = Math.min(current * perPage, filtered);

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <p className="text-sm text-slate-500">
                Mostrando <span className="font-medium text-slate-700">{from}–{to}</span> de{' '}
                <span className="font-medium text-slate-700">{filtered}</span> empresa{filtered !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => onChange(current - 1)}
                    disabled={current === 1}
                    className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                    <ChevronLeft size={16} />
                </button>

                {Array.from({ length: total }, (_, i) => i + 1).map(page => {
                    const isActive = page === current;
                    const showPage =
                        page === 1 ||
                        page === total ||
                        Math.abs(page - current) <= 1;

                    if (!showPage) {
                        // Show ellipsis only once between gaps
                        const prevShown =
                            page - 1 === 1 ||
                            page - 1 === total ||
                            Math.abs(page - 1 - current) <= 1;
                        if (!prevShown) return null;
                        return (
                            <span key={`ellipsis-${page}`} className="px-1 text-slate-400 text-sm select-none">
                                …
                            </span>
                        );
                    }

                    return (
                        <button
                            key={page}
                            onClick={() => onChange(page)}
                            className={`min-w-[32px] h-8 px-2 rounded-lg text-sm font-medium transition-colors ${
                                isActive
                                    ? 'bg-emerald-500 text-white shadow-sm'
                                    : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            {page}
                        </button>
                    );
                })}

                <button
                    onClick={() => onChange(current + 1)}
                    disabled={current === total}
                    className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
    );
};

// ─── Loading state ────────────────────────────────────────────────────────────

const LoadingGrid: React.FC = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3 animate-pulse">
                <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-slate-100" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-100 rounded w-2/3" />
                        <div className="h-3 bg-slate-100 rounded w-1/3" />
                    </div>
                </div>
                <div className="h-3 bg-slate-100 rounded w-full" />
                <div className="flex gap-1.5">
                    {Array.from({ length: 4 }).map((_, j) => (
                        <div key={j} className="h-6 w-14 bg-slate-100 rounded-lg" />
                    ))}
                </div>
                <div className="border-t border-slate-100 pt-3 flex justify-between">
                    <div className="h-3 bg-slate-100 rounded w-1/4" />
                    <div className="flex gap-1">
                        {Array.from({ length: 3 }).map((_, j) => (
                            <div key={j} className="h-6 w-6 bg-slate-100 rounded-lg" />
                        ))}
                    </div>
                </div>
            </div>
        ))}
    </div>
);

// ─── Error state ──────────────────────────────────────────────────────────────

const ErrorState: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
    <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
            <AlertTriangle className="h-7 w-7 text-red-400" />
        </div>
        <p className="text-base font-semibold text-slate-700 mb-1">{message}</p>
        <p className="text-sm text-slate-400 mb-5">Verifica tu conexión e intenta de nuevo.</p>
        <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
        >
            <RefreshCw size={14} />
            Reintentar
        </button>
    </div>
);

// ─── Empty state ──────────────────────────────────────────────────────────────

const EmptyState: React.FC<{ hasSearch: boolean; onClear: () => void; onNew: () => void }> = ({
    hasSearch,
    onClear,
    onNew,
}) => (
    <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-5">
            <Building2 className="h-8 w-8 text-slate-300" />
        </div>
        {hasSearch ? (
            <>
                <p className="text-base font-semibold text-slate-700 mb-1">Sin resultados</p>
                <p className="text-sm text-slate-400 mb-5">No hay empresas que coincidan con tu búsqueda.</p>
                <button
                    onClick={onClear}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                >
                    Limpiar búsqueda
                </button>
            </>
        ) : (
            <>
                <p className="text-base font-semibold text-slate-700 mb-1">No hay empresas aún</p>
                <p className="text-sm text-slate-400 mb-5">Crea la primera empresa para empezar.</p>
                <button
                    onClick={onNew}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 transition-colors shadow-sm"
                >
                    <Plus size={15} />
                    Nueva Empresa
                </button>
            </>
        )}
    </div>
);

export default Tenants;
