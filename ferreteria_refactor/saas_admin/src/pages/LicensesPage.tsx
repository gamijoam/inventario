import React, { useEffect, useRef, useState } from 'react';
import {
    Key,
    Search,
    RefreshCw,
    ChevronDown,
    AlertTriangle,
    CheckCircle,
    Clock,
    Ban,
    Infinity,
    ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getTenants } from '../api/tenants';
import {
    grantTrial,
    extendMonthly,
    extendAnnual,
    grantLifetime,
    revokeLicense,
    reactivateLicense,
} from '../api/licenses';
import type { Tenant, LicenseType } from '../types/tenant';

// ─── helpers ─────────────────────────────────────────────────────────────────

function calcDaysRemaining(dateStr: string | null): number | null {
    if (!dateStr) return null;
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-VE', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── derived status type ──────────────────────────────────────────────────────

type LicenseStatus = 'suspended' | 'expired' | 'lifetime' | 'trial' | 'active';

interface TenantLicenseInfo {
    tenant: Tenant;
    status: LicenseStatus;
    daysRemaining: number | null;
    expiryDate: string | null;
}

function resolveLicenseInfo(tenant: Tenant): TenantLicenseInfo {
    // Suspended takes priority
    if (!tenant.is_active || tenant.license_blocked_reason) {
        return { tenant, status: 'suspended', daysRemaining: null, expiryDate: null };
    }

    if (tenant.license_type === 'lifetime') {
        return { tenant, status: 'lifetime', daysRemaining: null, expiryDate: null };
    }

    if (tenant.license_type === 'trial') {
        const days = calcDaysRemaining(tenant.trial_ends_at);
        if (days !== null && days < 0) {
            return { tenant, status: 'expired', daysRemaining: days, expiryDate: tenant.trial_ends_at };
        }
        return { tenant, status: 'trial', daysRemaining: days, expiryDate: tenant.trial_ends_at };
    }

    // monthly / annual
    const days = calcDaysRemaining(tenant.subscription_expires_at);
    if (days !== null && days < 0) {
        return { tenant, status: 'expired', daysRemaining: days, expiryDate: tenant.subscription_expires_at };
    }
    return { tenant, status: 'active', daysRemaining: days, expiryDate: tenant.subscription_expires_at };
}

// ─── badge component ──────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ info: TenantLicenseInfo }> = ({ info }) => {
    const { status, daysRemaining } = info;

    switch (status) {
        case 'lifetime':
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <Infinity className="w-3.5 h-3.5" />
                    Lifetime
                </span>
            );
        case 'trial':
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                    <Clock className="w-3.5 h-3.5" />
                    Trial {daysRemaining !== null ? `(${daysRemaining}d)` : ''}
                </span>
            );
        case 'active':
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Activo {daysRemaining !== null && daysRemaining <= 15 ? `(${daysRemaining}d)` : ''}
                </span>
            );
        case 'expired':
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Vencido
                </span>
            );
        case 'suspended':
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-700 border border-gray-300">
                    <Ban className="w-3.5 h-3.5" />
                    Suspendido
                </span>
            );
    }
};

const PlanBadge: React.FC<{ type: LicenseType }> = ({ type }) => {
    const map: Record<LicenseType, string> = {
        trial: 'bg-blue-50 text-blue-700 border-blue-100',
        monthly: 'bg-indigo-50 text-indigo-700 border-indigo-100',
        annual: 'bg-purple-50 text-purple-700 border-purple-100',
        lifetime: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    };
    const label: Record<LicenseType, string> = {
        trial: 'Trial',
        monthly: 'Mensual',
        annual: 'Anual',
        lifetime: 'Lifetime',
    };
    return (
        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded border ${map[type]}`}>
            {label[type]}
        </span>
    );
};

// ─── actions dropdown ─────────────────────────────────────────────────────────

interface ActionsMenuProps {
    info: TenantLicenseInfo;
    onAction: (tenantId: number, action: ActionType, extra?: number) => void;
}

type ActionType = 'grant_trial' | 'monthly' | 'annual' | 'lifetime' | 'revoke' | 'reactivate';

const ActionsMenu: React.FC<ActionsMenuProps> = ({ info, onAction }) => {
    const [open, setOpen] = useState(false);
    const [trialDays, setTrialDays] = useState(30);
    const [showTrialInput, setShowTrialInput] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpen(false);
                setShowTrialInput(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const { tenant, status } = info;

    const handleAction = (action: ActionType) => {
        if (action === 'grant_trial') {
            setShowTrialInput(true);
            return;
        }
        onAction(tenant.id, action);
        setOpen(false);
    };

    const submitTrial = () => {
        if (trialDays < 1 || trialDays > 365) {
            toast.error('Los días de trial deben estar entre 1 y 365');
            return;
        }
        onAction(tenant.id, 'grant_trial', trialDays);
        setOpen(false);
        setShowTrialInput(false);
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => { setOpen(prev => !prev); setShowTrialInput(false); }}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
                Acciones <ChevronDown className="w-4 h-4" />
            </button>

            {open && (
                <div className="absolute right-0 z-50 mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                    {!showTrialInput ? (
                        <>
                            <button
                                onClick={() => handleAction('grant_trial')}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                                Extender Trial
                            </button>
                            <button
                                onClick={() => handleAction('monthly')}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                                Activar Mensual (+30 días)
                            </button>
                            <button
                                onClick={() => handleAction('annual')}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                                Activar Anual (+365 días)
                            </button>
                            <button
                                onClick={() => handleAction('lifetime')}
                                className="w-full text-left px-4 py-2 text-sm text-emerald-700 hover:bg-emerald-50"
                            >
                                Lifetime (sin vencimiento)
                            </button>
                            <hr className="my-1 border-gray-100" />
                            {status === 'suspended' ? (
                                <button
                                    onClick={() => handleAction('reactivate')}
                                    className="w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-green-50"
                                >
                                    Reactivar
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleAction('revoke')}
                                    className="w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                                >
                                    Suspender
                                </button>
                            )}
                        </>
                    ) : (
                        <div className="px-4 py-3">
                            <p className="text-xs font-medium text-gray-700 mb-2">Días de trial</p>
                            <input
                                type="number"
                                min={1}
                                max={365}
                                value={trialDays}
                                onChange={e => setTrialDays(Number(e.target.value))}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 mb-2"
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={submitTrial}
                                    className="flex-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                    Aplicar
                                </button>
                                <button
                                    onClick={() => setShowTrialInput(false)}
                                    className="flex-1 px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── stats summary bar ────────────────────────────────────────────────────────

interface StatsBarProps {
    infos: TenantLicenseInfo[];
}

const StatsBar: React.FC<StatsBarProps> = ({ infos }) => {
    const counts = {
        active: infos.filter(i => i.status === 'active').length,
        trial: infos.filter(i => i.status === 'trial').length,
        lifetime: infos.filter(i => i.status === 'lifetime').length,
        expired: infos.filter(i => i.status === 'expired').length,
        suspended: infos.filter(i => i.status === 'suspended').length,
    };

    const cards = [
        { label: 'Activos', value: counts.active, icon: ShieldCheck, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' },
        { label: 'En Trial', value: counts.trial, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
        { label: 'Lifetime', value: counts.lifetime, icon: Infinity, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
        { label: 'Vencidos', value: counts.expired, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
        { label: 'Suspendidos', value: counts.suspended, icon: Ban, color: 'text-gray-600', bg: 'bg-gray-100', border: 'border-gray-200' },
    ];

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {cards.map(card => {
                const Icon = card.icon;
                return (
                    <div key={card.label} className={`${card.bg} border ${card.border} rounded-xl p-4 flex items-center gap-3`}>
                        <div className={`p-2 rounded-lg bg-white shadow-sm`}>
                            <Icon className={`w-5 h-5 ${card.color}`} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                            <p className="text-xs text-gray-500">{card.label}</p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// ─── confirm suspend modal ────────────────────────────────────────────────────

interface ConfirmSuspendModalProps {
    tenantName: string;
    onConfirm: () => void;
    onCancel: () => void;
}

const ConfirmSuspendModal: React.FC<ConfirmSuspendModalProps> = ({ tenantName, onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-4 mb-4">
                <div className="p-2 bg-red-100 rounded-full">
                    <Ban className="w-6 h-6 text-red-600" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">Suspender empresa</h2>
                    <p className="text-sm text-gray-600 mt-1">
                        ¿Confirmas la suspensión de <strong>{tenantName}</strong>? El tenant perderá acceso al sistema inmediatamente.
                    </p>
                </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
                <button
                    onClick={onCancel}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                    Cancelar
                </button>
                <button
                    onClick={onConfirm}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                    Sí, suspender
                </button>
            </div>
        </div>
    </div>
);

// ─── main page ────────────────────────────────────────────────────────────────

const LicensesPage: React.FC = () => {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<LicenseStatus | 'all'>('all');

    // Pending suspend confirmation
    const [pendingSuspend, setPendingSuspend] = useState<{ id: number; name: string } | null>(null);
    const [isActing, setIsActing] = useState<number | null>(null); // tenantId being mutated

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

    useEffect(() => {
        fetchTenants();
    }, []);

    // Resolve license info for every tenant
    const allInfos: TenantLicenseInfo[] = tenants.map(resolveLicenseInfo);

    // Filter
    const filtered = allInfos.filter(info => {
        const matchSearch =
            info.tenant.name.toLowerCase().includes(search.toLowerCase()) ||
            info.tenant.schema_name.toLowerCase().includes(search.toLowerCase());
        const matchStatus = filterStatus === 'all' || info.status === filterStatus;
        return matchSearch && matchStatus;
    });

    const handleAction = async (tenantId: number, action: ActionType, extra?: number) => {
        // Suspend needs confirmation
        if (action === 'revoke') {
            const tenant = tenants.find(t => t.id === tenantId);
            if (tenant) {
                setPendingSuspend({ id: tenantId, name: tenant.name });
            }
            return;
        }

        await executeAction(tenantId, action, extra);
    };

    const executeAction = async (tenantId: number, action: ActionType, extra?: number) => {
        const tenant = tenants.find(t => t.id === tenantId);
        if (!tenant) return;

        setIsActing(tenantId);
        const toastId = toast.loading('Aplicando cambio...');

        try {
            let updated: Tenant;

            switch (action) {
                case 'grant_trial':
                    updated = await grantTrial(tenantId, extra ?? 30);
                    toast.success(`Trial de ${extra ?? 30} días asignado`, { id: toastId });
                    break;
                case 'monthly':
                    updated = await extendMonthly(tenantId, tenant.subscription_expires_at);
                    toast.success('Suscripción mensual extendida +30 días', { id: toastId });
                    break;
                case 'annual':
                    updated = await extendAnnual(tenantId, tenant.subscription_expires_at);
                    toast.success('Suscripción anual extendida +365 días', { id: toastId });
                    break;
                case 'lifetime':
                    updated = await grantLifetime(tenantId);
                    toast.success('Licencia Lifetime asignada', { id: toastId });
                    break;
                case 'revoke':
                    updated = await revokeLicense(tenantId);
                    toast.success('Empresa suspendida', { id: toastId });
                    break;
                case 'reactivate':
                    updated = await reactivateLicense(tenantId);
                    toast.success('Empresa reactivada', { id: toastId });
                    break;
                default:
                    toast.dismiss(toastId);
                    return;
            }

            // Optimistic update: replace tenant in local state
            setTenants(prev => prev.map(t => t.id === tenantId ? updated : t));
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
                'Error al aplicar el cambio';
            toast.error(msg, { id: toastId });
        } finally {
            setIsActing(null);
        }
    };

    const confirmSuspend = async () => {
        if (!pendingSuspend) return;
        const { id } = pendingSuspend;
        setPendingSuspend(null);
        await executeAction(id, 'revoke');
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestión de Licencias</h1>
                    <p className="text-sm text-gray-500 mt-1">Administra los planes y estados de acceso de cada empresa.</p>
                </div>
                <button
                    onClick={fetchTenants}
                    disabled={isLoading}
                    className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Actualizar
                </button>
            </div>

            {/* Stats */}
            {!isLoading && !error && <StatsBar infos={allInfos} />}

            {/* Table card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Toolbar */}
                <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-3">
                    {/* Search */}
                    <div className="relative flex-1 max-w-md">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar empresa o esquema..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    {/* Status filter */}
                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value as LicenseStatus | 'all')}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                        <option value="all">Todos los estados</option>
                        <option value="active">Activos</option>
                        <option value="trial">En Trial</option>
                        <option value="lifetime">Lifetime</option>
                        <option value="expired">Vencidos</option>
                        <option value="suspended">Suspendidos</option>
                    </select>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="p-12 flex justify-center text-gray-400">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
                    </div>
                ) : error ? (
                    <div className="p-12 text-center text-red-500">
                        {error}
                        <button onClick={fetchTenants} className="ml-2 text-blue-600 underline">
                            Reintentar
                        </button>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <Key className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                        <p>{tenants.length === 0 ? 'No hay empresas registradas aún.' : 'Ninguna empresa coincide con los filtros.'}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Empresa
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Plan
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Vence
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Estado
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filtered.map(info => {
                                    const { tenant } = info;
                                    const acting = isActing === tenant.id;
                                    return (
                                        <tr
                                            key={tenant.id}
                                            className={`hover:bg-gray-50 transition-colors ${acting ? 'opacity-60 pointer-events-none' : ''}`}
                                        >
                                            {/* Company */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-shrink-0 h-9 w-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-sm font-bold">
                                                        {tenant.name.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">{tenant.name}</p>
                                                        <code className="text-xs text-gray-400">{tenant.schema_name}</code>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Plan */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <PlanBadge type={tenant.license_type} />
                                            </td>

                                            {/* Expiry */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {tenant.license_type === 'lifetime' ? (
                                                    <span className="text-sm text-emerald-600 font-medium">Sin vencimiento</span>
                                                ) : (
                                                    <div>
                                                        <p className="text-sm text-gray-700">
                                                            {formatDate(info.expiryDate)}
                                                        </p>
                                                        {info.daysRemaining !== null && (
                                                            <p className={`text-xs ${info.daysRemaining < 0 ? 'text-red-500' : info.daysRemaining <= 7 ? 'text-amber-500' : 'text-gray-400'}`}>
                                                                {info.daysRemaining < 0
                                                                    ? `Venció hace ${Math.abs(info.daysRemaining)} día${Math.abs(info.daysRemaining) !== 1 ? 's' : ''}`
                                                                    : `${info.daysRemaining} día${info.daysRemaining !== 1 ? 's' : ''} restante${info.daysRemaining !== 1 ? 's' : ''}`}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Status */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <StatusBadge info={info} />
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                {acting ? (
                                                    <div className="inline-flex items-center justify-end">
                                                        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent animate-spin rounded-full" />
                                                    </div>
                                                ) : (
                                                    <ActionsMenu info={info} onAction={handleAction} />
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* Footer row count */}
                        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
                            {filtered.length} de {allInfos.length} empresa{allInfos.length !== 1 ? 's' : ''}
                        </div>
                    </div>
                )}
            </div>

            {/* Confirm suspend dialog */}
            {pendingSuspend && (
                <ConfirmSuspendModal
                    tenantName={pendingSuspend.name}
                    onConfirm={confirmSuspend}
                    onCancel={() => setPendingSuspend(null)}
                />
            )}
        </div>
    );
};

export default LicensesPage;
