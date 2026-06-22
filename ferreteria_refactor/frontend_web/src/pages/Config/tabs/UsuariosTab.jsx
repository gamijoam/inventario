import { useEffect, useMemo, useState } from 'react';
import {
    Activity,
    AlertTriangle,
    BadgeCheck,
    Check,
    Edit,
    Filter,
    Key,
    Lock,
    Mail,
    Plus,
    RotateCcw,
    Save,
    Search,
    ShieldCheck,
    SlidersHorizontal,
    Trash2,
    UserCog,
    UserRound,
    Users,
    X,
} from 'lucide-react';
import apiClient from '../../../config/axios';
import { useAuth } from '../../../context/AuthContext';
import SetPinModal from '../../../components/users/SetPinModal';
import { useConfig } from '../../../context/ConfigContext';
import userService from '../../../services/userService';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../../../utils/apiErrors';

const ROLE_META = {
    ADMIN: { label: 'Administrador', tone: 'bg-indigo-50 text-indigo-700 border-indigo-200', hint: 'Acceso total y configuracion' },
    CASHIER: { label: 'Cajero', tone: 'bg-blue-50 text-blue-700 border-blue-200', hint: 'Ventas, caja y POS' },
    WAREHOUSE: { label: 'Almacen', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200', hint: 'Inventario y recepcion' },
    WAITER: { label: 'Mesero', tone: 'bg-amber-50 text-amber-700 border-amber-200', hint: 'Comandas y mesas' },
    KITCHEN: { label: 'Cocina', tone: 'bg-rose-50 text-rose-700 border-rose-200', hint: 'Pantalla de cocina' },
};

const MODULE_META = {
    dashboard: { label: 'Resumen', accent: 'bg-sky-500' },
    pos: { label: 'Punto de Venta', accent: 'bg-indigo-500' },
    cash: { label: 'Caja', accent: 'bg-emerald-500' },
    inventory: { label: 'Inventario', accent: 'bg-blue-500' },
    sales: { label: 'Ventas', accent: 'bg-violet-500' },
    purchases: { label: 'Compras', accent: 'bg-teal-500' },
    reports: { label: 'Reportes', accent: 'bg-cyan-500' },
    accounting: { label: 'Contabilidad', accent: 'bg-indigo-600' },
    config: { label: 'Configuracion', accent: 'bg-slate-600' },
    support: { label: 'Soporte', accent: 'bg-fuchsia-500' },
    organization: { label: 'Organizacion', accent: 'bg-purple-500' },
    services: { label: 'Servicios', accent: 'bg-orange-500' },
    restaurant: { label: 'Restaurante', accent: 'bg-amber-500' },
};

const PERMISSION_PRESETS = [
    {
        id: 'cashier_basic',
        name: 'Cajero base',
        hint: 'Vender, abrir/cerrar caja y reimprimir ticket.',
        codes: ['pos.access', 'pos.sell', 'pos.reprint.ticket', 'cash.view', 'cash.open', 'cash.close.blind', 'cash.movements.create', 'sales.customers.manage', 'sales.quotes.view', 'support.chat.use'],
    },
    {
        id: 'cashier_plus',
        name: 'Cajero supervisor',
        hint: 'Caja, anulaciones, garantias y creditos.',
        codes: ['pos.access', 'pos.sell', 'pos.discount.apply', 'pos.reprint.ticket', 'pos.reprint.warranty', 'pos.void_sale', 'cash.view', 'cash.open', 'cash.close.blind', 'cash.movements.create', 'cash.audit.view', 'sales.customers.manage', 'sales.returns.create', 'sales.returns.exchange', 'sales.credits.view', 'sales.credits.pay', 'sales.warranties.view', 'support.chat.use'],
    },
    {
        id: 'warehouse',
        name: 'Inventario',
        hint: 'Productos, seriales, compras y traslados.',
        codes: ['inventory.products.view', 'inventory.products.create', 'inventory.products.edit', 'inventory.stock.adjust', 'inventory.serials.view', 'inventory.serials.receive', 'inventory.kardex.view', 'inventory.categories.manage', 'inventory.warehouses.manage', 'inventory.transfers.export', 'inventory.transfers.import', 'purchases.view', 'purchases.create', 'purchases.suppliers.manage', 'reports.inventory.view', 'support.chat.use'],
    },
    {
        id: 'accounting_auditor',
        name: 'Contador / auditor',
        hint: 'Libro contable, arqueos y exportacion sin operar ventas.',
        codes: ['reports.view', 'cash.audit.view', 'accounting.ledger.view', 'accounting.ledger.export'],
    },
    {
        id: 'manager',
        name: 'Encargado',
        hint: 'Operacion amplia sin configuracion critica.',
        codes: ['dashboard.view', 'dashboard.financials.view', 'pos.access', 'pos.sell', 'pos.discount.apply', 'pos.reprint.ticket', 'pos.reprint.warranty', 'cash.view', 'cash.open', 'cash.close.blind', 'cash.movements.create', 'cash.audit.view', 'inventory.products.view', 'inventory.products.create', 'inventory.products.edit', 'inventory.stock.adjust', 'inventory.serials.view', 'inventory.serials.receive', 'inventory.kardex.view', 'sales.quotes.view', 'sales.quotes.manage', 'sales.customers.manage', 'sales.returns.create', 'sales.returns.exchange', 'sales.credits.view', 'sales.credits.pay', 'purchases.view', 'purchases.create', 'purchases.pay', 'reports.view', 'reports.sales.view', 'reports.inventory.view', 'accounting.ledger.view', 'accounting.ledger.export', 'support.chat.use'],
    },
];

const emptyForm = {
    username: '',
    email: '',
    password: '',
    full_name: '',
    role: 'CASHIER',
    commission_percentage: 0,
};

const inputClass = 'h-12 w-full rounded-md border border-slate-200 bg-white pl-10 pr-3 text-sm font-bold text-slate-800 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50 disabled:text-slate-400';
const normalize = (value) => String(value || '').toLowerCase().trim();

const UsuariosTab = () => {
    const { user: currentUser } = useAuth();
    const { modules = {} } = useConfig();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [selectedUser, setSelectedUser] = useState(null);
    const [showPermissionsModal, setShowPermissionsModal] = useState(false);
    const [permissionsUser, setPermissionsUser] = useState(null);
    const [permissionDetails, setPermissionDetails] = useState(null);
    const [permissionDraft, setPermissionDraft] = useState({ allow: [], deny: [] });
    const [permissionSearch, setPermissionSearch] = useState('');
    const [selectedPermissionModule, setSelectedPermissionModule] = useState('all');
    const [showOnlyChanges, setShowOnlyChanges] = useState(false);
    const [permissionsLoading, setPermissionsLoading] = useState(false);
    const [showPinModal, setShowPinModal] = useState(false);
    const [selectedUserForPin, setSelectedUserForPin] = useState(null);
    const [userSearch, setUserSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('active');
    const [formData, setFormData] = useState(emptyForm);

    useEffect(() => {
        fetchUsers();
    }, []);

    const availableRoles = useMemo(() => {
        const roles = ['ADMIN', 'CASHIER', 'WAREHOUSE'];
        if (modules.restaurant) roles.push('WAITER', 'KITCHEN');
        return roles;
    }, [modules.restaurant]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/users');
            setUsers(response.data || []);
        } catch (error) {
            console.error('Error fetching users:', error);
            toast.error(getApiErrorMessage(error, 'No se pudieron cargar los usuarios'));
        } finally {
            setLoading(false);
        }
    };

    const userStats = useMemo(() => {
        const active = users.filter((item) => item.is_active).length;
        const inactive = users.length - active;
        const admins = users.filter((item) => item.role === 'ADMIN').length;
        const withPin = users.filter((item) => item.pin).length;
        return { total: users.length, active, inactive, admins, withPin };
    }, [users]);

    const filteredUsers = useMemo(() => {
        const query = normalize(userSearch);
        return users.filter((item) => {
            const matchesQuery = !query || [item.username, item.full_name, item.email, item.role]
                .some((value) => normalize(value).includes(query));
            const matchesRole = roleFilter === 'all' || item.role === roleFilter;
            const matchesStatus = statusFilter === 'all'
                || (statusFilter === 'active' && item.is_active)
                || (statusFilter === 'inactive' && !item.is_active);
            return matchesQuery && matchesRole && matchesStatus;
        });
    }, [users, userSearch, roleFilter, statusFilter]);

    const handleOpenModal = (mode, user = null) => {
        setModalMode(mode);
        setSelectedUser(user);
        if (mode === 'create') {
            setFormData(emptyForm);
        } else if (mode === 'edit' && user) {
            setFormData({
                username: user.username || '',
                email: user.email || '',
                password: '',
                full_name: user.full_name || '',
                role: user.role || 'CASHIER',
                commission_percentage: user.commission_percentage || 0,
            });
        } else if (mode === 'password' && user) {
            setFormData({ ...emptyForm, username: user.username || '', password: '' });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedUser(null);
        setFormData(emptyForm);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        try {
            if (modalMode === 'create') {
                await apiClient.post('/users', {
                    username: formData.username,
                    email: formData.email || null,
                    password: formData.password,
                    full_name: formData.full_name,
                    role: formData.role,
                    commission_percentage: parseFloat(formData.commission_percentage || 0),
                });
                toast.success('Usuario creado exitosamente');
            } else if (modalMode === 'edit') {
                const updateData = {
                    role: formData.role,
                    email: formData.email || null,
                    full_name: formData.full_name,
                    commission_percentage: parseFloat(formData.commission_percentage || 0),
                };
                if (formData.password) updateData.password = formData.password;
                await apiClient.put(`/users/${selectedUser.id}`, updateData);
                toast.success('Usuario actualizado exitosamente');
            } else if (modalMode === 'password') {
                await apiClient.put(`/users/${selectedUser.id}`, { password: formData.password });
                toast.success('Contraseña actualizada exitosamente');
            }
            handleCloseModal();
            fetchUsers();
        } catch (error) {
            console.error('Error saving user:', error);
            toast.error(getApiErrorMessage(error, modalMode === 'create' ? 'No se pudo crear el usuario' : modalMode === 'password' ? 'No se pudo actualizar la contrasena' : 'No se pudo actualizar el usuario'));
        }
    };

    const handleDeactivate = async (userId) => {
        if (!confirm('¿Estas seguro de desactivar este usuario?')) return;
        try {
            await apiClient.delete(`/users/${userId}`);
            toast.success('Usuario desactivado');
            fetchUsers();
        } catch (error) {
            console.error('Error deactivating user:', error);
            toast.error(getApiErrorMessage(error, 'No se pudo desactivar el usuario'));
        }
    };

    const getRoleBadge = (role) => {
        const meta = ROLE_META[role] || { label: role, tone: 'bg-slate-100 text-slate-700 border-slate-200' };
        return <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-black ${meta.tone}`}>{meta.label}</span>;
    };

    const getUserInitials = (user) => {
        const source = user?.full_name || user?.username || 'U';
        return source.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
    };

    const handleOpenPinModal = (user) => {
        setSelectedUserForPin(user);
        setShowPinModal(true);
    };

    const handlePinUpdate = async (userId, pin) => {
        await userService.updatePin(userId, pin);
        toast.success('PIN establecido exitosamente');
        setShowPinModal(false);
        setSelectedUserForPin(null);
        fetchUsers();
    };

    const handleOpenPermissionsModal = async (user) => {
        setPermissionsUser(user);
        setShowPermissionsModal(true);
        setPermissionSearch('');
        setSelectedPermissionModule('all');
        setShowOnlyChanges(false);
        setPermissionsLoading(true);
        try {
            const response = await apiClient.get(`/users/${user.id}/permissions`);
            const details = response.data;
            const allow = [];
            const deny = [];
            (details.overrides || []).forEach((override) => {
                if (override.effect === 'allow') allow.push(override.permission_code);
                if (override.effect === 'deny') deny.push(override.permission_code);
            });
            setPermissionDetails(details);
            setPermissionDraft({ allow, deny });
        } catch (error) {
            console.error('Error loading permissions:', error);
            toast.error(getApiErrorMessage(error, 'No se pudieron cargar los permisos'));
            setShowPermissionsModal(false);
        } finally {
            setPermissionsLoading(false);
        }
    };

    const closePermissionsModal = () => {
        setShowPermissionsModal(false);
        setPermissionsUser(null);
        setPermissionDetails(null);
        setPermissionDraft({ allow: [], deny: [] });
        setPermissionSearch('');
        setSelectedPermissionModule('all');
        setShowOnlyChanges(false);
    };

    const allPermissionCodes = useMemo(() => (
        (permissionDetails?.tree || []).flatMap((group) => (group.permissions || []).map((permission) => permission.code))
    ), [permissionDetails]);

    const getPermissionState = (permissionCode) => {
        const base = new Set(permissionDetails?.base_permissions || []);
        const allow = new Set(permissionDraft.allow || []);
        const deny = new Set(permissionDraft.deny || []);
        const isBase = base.has(permissionCode);
        const isAllowed = allow.has(permissionCode) || (isBase && !deny.has(permissionCode));
        return { isBase, isAllowed, isDenied: deny.has(permissionCode), isCustomAllow: allow.has(permissionCode) };
    };

    const togglePermission = (permissionCode) => {
        if (!permissionDetails) return;
        const state = getPermissionState(permissionCode);
        setPermissionDraft((current) => {
            const allow = new Set(current.allow || []);
            const deny = new Set(current.deny || []);
            if (state.isAllowed) {
                allow.delete(permissionCode);
                if (state.isBase) deny.add(permissionCode);
            } else {
                deny.delete(permissionCode);
                if (!state.isBase) allow.add(permissionCode);
            }
            return { allow: Array.from(allow).sort(), deny: Array.from(deny).sort() };
        });
    };

    const setPermissionCodes = (codes, enabled) => {
        const base = new Set(permissionDetails?.base_permissions || []);
        setPermissionDraft((current) => {
            const allow = new Set(current.allow || []);
            const deny = new Set(current.deny || []);
            codes.forEach((code) => {
                if (enabled) {
                    deny.delete(code);
                    if (!base.has(code)) allow.add(code);
                } else {
                    allow.delete(code);
                    if (base.has(code)) deny.add(code);
                }
            });
            return { allow: Array.from(allow).sort(), deny: Array.from(deny).sort() };
        });
    };

    const applyPreset = (preset) => {
        if (!permissionDetails) return;
        if (!confirm(`Aplicar preset "${preset.name}" a ${permissionsUser?.username}?`)) return;
        const desired = new Set(preset.codes.filter((code) => allPermissionCodes.includes(code)));
        const base = new Set(permissionDetails.base_permissions || []);
        const allow = [];
        const deny = [];
        allPermissionCodes.forEach((code) => {
            if (desired.has(code) && !base.has(code)) allow.push(code);
            if (!desired.has(code) && base.has(code)) deny.push(code);
        });
        setPermissionDraft({ allow: allow.sort(), deny: deny.sort() });
        toast.success(`Preset ${preset.name} aplicado`);
    };

    const resetPermissionOverrides = () => {
        setPermissionDraft({ allow: [], deny: [] });
    };

    const savePermissionOverrides = async () => {
        if (!permissionsUser) return;
        setPermissionsLoading(true);
        try {
            const response = await apiClient.put(`/users/${permissionsUser.id}/permissions`, permissionDraft);
            const details = response.data;
            setPermissionDetails({ ...details, tree: permissionDetails?.tree || [] });
            toast.success('Permisos actualizados');
            closePermissionsModal();
        } catch (error) {
            console.error('Error saving permissions:', error);
            toast.error(getApiErrorMessage(error, 'No se pudieron guardar los permisos'));
        } finally {
            setPermissionsLoading(false);
        }
    };

    const permissionSummary = useMemo(() => {
        const active = allPermissionCodes.filter((code) => getPermissionState(code).isAllowed).length;
        const critical = (permissionDetails?.tree || []).flatMap((group) => group.permissions || [])
            .filter((permission) => permission.risk_level === 'critical' && getPermissionState(permission.code).isAllowed).length;
        return {
            active,
            total: allPermissionCodes.length,
            changes: (permissionDraft.allow?.length || 0) + (permissionDraft.deny?.length || 0),
            critical,
        };
    }, [allPermissionCodes, permissionDetails, permissionDraft]);

    const permissionModules = useMemo(() => (
        (permissionDetails?.tree || []).map((group) => ({
            module: group.module,
            label: MODULE_META[group.module]?.label || group.label || group.module,
            count: group.permissions?.length || 0,
        }))
    ), [permissionDetails]);

    const filteredPermissionTree = (permissionDetails?.tree || [])
        .map((group) => {
            const query = permissionSearch.trim().toLowerCase();
            const permissions = (group.permissions || []).filter((permission) => {
                const state = getPermissionState(permission.code);
                const matchesModule = selectedPermissionModule === 'all' || group.module === selectedPermissionModule;
                const matchesQuery = !query || [permission.code, permission.label, permission.description, group.label, MODULE_META[group.module]?.label]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(query));
                const matchesChanges = !showOnlyChanges || state.isCustomAllow || state.isDenied;
                return matchesModule && matchesQuery && matchesChanges;
            });
            return { ...group, permissions };
        })
        .filter((group) => group.permissions.length > 0);

    const roleHint = ROLE_META[formData.role]?.hint || '';

    return (
        <div className="space-y-5">
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-5 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm"><Users size={24} /></div>
                        <div>
                            <p className="text-sm font-black text-slate-400">Accesos del sistema</p>
                            <h2 className="text-2xl font-black text-slate-950">Usuarios y permisos</h2>
                            <p className="mt-1 text-sm font-semibold text-slate-500">Gestiona cuentas, roles, PIN y permisos modulares por usuario.</p>
                        </div>
                    </div>
                    <button id="tour-users-add-btn" onClick={() => handleOpenModal('create')} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-black text-white shadow-sm transition-colors hover:bg-indigo-700 active:scale-[0.99]"><Plus size={18} />Nuevo usuario</button>
                </div>

                <div className="grid gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard icon={UserRound} label="Usuarios" value={userStats.total} helper={`${userStats.active} activos`} tone="indigo" />
                    <MetricCard icon={ShieldCheck} label="Administradores" value={userStats.admins} helper="Acceso sensible" tone="blue" />
                    <MetricCard icon={Lock} label="Con PIN" value={userStats.withPin} helper="Autorizaciones rapidas" tone="emerald" />
                    <MetricCard icon={Activity} label="Inactivos" value={userStats.inactive} helper="Fuera de operacion" tone="slate" />
                </div>

                <div className="grid gap-3 p-4 lg:grid-cols-[1fr_170px_170px]">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                        <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} className="h-11 w-full rounded-md border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-700 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" placeholder="Buscar usuario, correo, nombre o rol" />
                    </div>
                    <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20">
                        <option value="all">Todos los roles</option>
                        {availableRoles.map((role) => <option key={role} value={role}>{ROLE_META[role]?.label || role}</option>)}
                    </select>
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20">
                        <option value="active">Activos</option>
                        <option value="inactive">Inactivos</option>
                        <option value="all">Todos</option>
                    </select>
                </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div><h3 className="text-lg font-black text-slate-950">Personal registrado</h3><p className="text-sm font-semibold text-slate-500">{filteredUsers.length} en vista</p></div>
                    <div className="hidden items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-500 sm:flex"><Filter size={16} />{roleFilter === 'all' ? 'Sin rol fijo' : ROLE_META[roleFilter]?.label || roleFilter}</div>
                </div>

                <div className="block space-y-3 bg-slate-50/60 p-4 lg:hidden">
                    {renderUserEmptyState(loading, filteredUsers.length)}
                    {!loading && filteredUsers.map((item) => (
                        <UserMobileCard key={item.id} user={item} currentUser={currentUser} getUserInitials={getUserInitials} getRoleBadge={getRoleBadge} onEdit={() => handleOpenModal('edit', item)} onPin={() => handleOpenPinModal(item)} onPermissions={() => handleOpenPermissionsModal(item)} onPassword={() => handleOpenModal('password', item)} onDeactivate={() => handleDeactivate(item.id)} />
                    ))}
                </div>

                <div className="hidden overflow-x-auto lg:block">
                    <table className="w-full min-w-[980px]">
                        <thead><tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-black text-slate-400"><th className="px-5 py-3">Usuario</th><th className="px-5 py-3">Rol</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3">Seguridad</th><th className="px-5 py-3 text-right">Acciones</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan="5" className="p-12 text-center text-sm font-bold text-slate-400">Cargando usuarios...</td></tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr><td colSpan="5" className="p-12 text-center text-sm font-bold text-slate-400">No hay usuarios con esos filtros.</td></tr>
                            ) : filteredUsers.map((item) => (
                                <tr key={item.id} className="transition-colors hover:bg-indigo-50/40">
                                    <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-600 text-sm font-black text-white shadow-sm">{getUserInitials(item)}</div><div className="min-w-0"><p className="truncate text-sm font-black text-slate-950">{item.full_name || item.username}</p><div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500"><span>@{item.username}</span>{item.email && <span className="inline-flex items-center gap-1"><Mail size={13} />{item.email}</span>}</div></div></div></td>
                                    <td className="px-5 py-4">{getRoleBadge(item.role)}</td>
                                    <td className="px-5 py-4"><StatusPill active={item.is_active} /></td>
                                    <td className="px-5 py-4"><div className="flex flex-wrap gap-2"><span className={`rounded-md border px-2 py-1 text-xs font-black ${item.pin ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>{item.pin ? 'PIN activo' : 'Sin PIN'}</span>{item.id === currentUser?.id && <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">Tu cuenta</span>}</div></td>
                                    <td className="px-5 py-4"><UserActions user={item} currentUser={currentUser} onEdit={() => handleOpenModal('edit', item)} onPin={() => handleOpenPinModal(item)} onPermissions={() => handleOpenPermissionsModal(item)} onPassword={() => handleOpenModal('password', item)} onDeactivate={() => handleDeactivate(item.id)} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {showModal && <UserFormModal modalMode={modalMode} formData={formData} setFormData={setFormData} selectedUser={selectedUser} availableRoles={availableRoles} roleHint={roleHint} modules={modules} onClose={handleCloseModal} onSubmit={handleSubmit} />}

            {showPermissionsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-sm">
                    <div className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
                        <header className="flex flex-col gap-4 border-b border-slate-200 bg-white p-5 xl:flex-row xl:items-center xl:justify-between">
                            <div className="flex items-start gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm"><ShieldCheck size={24} /></div><div><p className="text-sm font-black text-slate-400">Editor modular</p><h3 className="text-2xl font-black text-slate-950">{permissionsUser?.full_name || permissionsUser?.username}</h3><div className="mt-2 flex flex-wrap items-center gap-2">{permissionsUser && getRoleBadge(permissionsUser.role)}<span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-black text-slate-500">@{permissionsUser?.username}</span></div></div></div>
                            <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={resetPermissionOverrides} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-black text-slate-600 transition-colors hover:bg-slate-50"><RotateCcw size={16} />Restaurar rol base</button><button type="button" onClick={closePermissionsModal} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-black text-slate-600 transition-colors hover:bg-slate-50"><X size={16} />Cancelar</button><button type="button" onClick={savePermissionOverrides} disabled={permissionsLoading} className="inline-flex h-10 items-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-black text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-60"><Save size={16} />Guardar permisos</button></div>
                        </header>

                        <div className="grid min-h-0 flex-1 bg-slate-50 xl:grid-cols-[340px_1fr]">
                            <aside className="border-b border-slate-200 bg-white p-5 xl:border-b-0 xl:border-r">
                                <div className="grid grid-cols-2 gap-3"><PermissionMetric label="Activos" value={`${permissionSummary.active}/${permissionSummary.total}`} tone="indigo" /><PermissionMetric label="Cambios" value={permissionSummary.changes} tone="blue" /><PermissionMetric label="Extras" value={permissionDraft.allow?.length || 0} tone="emerald" /><PermissionMetric label="Bloqueados" value={permissionDraft.deny?.length || 0} tone="rose" /></div>
                                {permissionSummary.critical > 0 && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800"><div className="flex items-center gap-2"><AlertTriangle size={16} />{permissionSummary.critical} permisos criticos activos</div></div>}
                                <div className="mt-5"><p className="mb-2 text-sm font-black text-slate-500">Presets rapidos</p><div className="space-y-2">{PERMISSION_PRESETS.map((preset) => <button key={preset.id} type="button" onClick={() => applyPreset(preset)} className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left transition-colors hover:border-indigo-200 hover:bg-indigo-50/50"><p className="text-sm font-black text-slate-900">{preset.name}</p><p className="mt-1 text-xs font-semibold text-slate-500">{preset.hint}</p></button>)}</div></div>
                                <div className="mt-5"><p className="mb-2 text-sm font-black text-slate-500">Modulos</p><div className="max-h-64 space-y-1 overflow-y-auto pr-1"><button type="button" onClick={() => setSelectedPermissionModule('all')} className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-black ${selectedPermissionModule === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>Todos <span>{allPermissionCodes.length}</span></button>{permissionModules.map((module) => <button key={module.module} type="button" onClick={() => setSelectedPermissionModule(module.module)} className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-black ${selectedPermissionModule === module.module ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{module.label} <span>{module.count}</span></button>)}</div></div>
                            </aside>

                            <section className="min-h-0 overflow-y-auto p-5">
                                <div className="sticky top-0 z-10 mb-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><div className="grid gap-3 lg:grid-cols-[1fr_auto]"><div className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={18} /><input value={permissionSearch} onChange={(event) => setPermissionSearch(event.target.value)} className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-semibold outline-none transition-colors focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20" placeholder="Buscar permiso, codigo o modulo" /></div><button type="button" onClick={() => setShowOnlyChanges((value) => !value)} className={`h-11 rounded-md border px-3 text-sm font-black transition-colors ${showOnlyChanges ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>Solo cambios</button></div></div>
                                {permissionsLoading && !permissionDetails ? <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-sm font-bold text-slate-400">Cargando permisos...</div> : filteredPermissionTree.length === 0 ? <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-sm font-bold text-slate-400">No hay permisos con esos filtros.</div> : (
                                    <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                                        {filteredPermissionTree.map((group) => {
                                            const moduleMeta = MODULE_META[group.module] || { label: group.label, accent: 'bg-indigo-500' };
                                            const groupCodes = group.permissions.map((permission) => permission.code);
                                            const enabledCount = groupCodes.filter((code) => getPermissionState(code).isAllowed).length;
                                            return <PermissionGroup key={group.module} group={group} moduleMeta={moduleMeta} enabledCount={enabledCount} groupCodes={groupCodes} getPermissionState={getPermissionState} togglePermission={togglePermission} setPermissionCodes={setPermissionCodes} />;
                                        })}
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>
                </div>
            )}

            <SetPinModal isOpen={showPinModal} onClose={() => { setShowPinModal(false); setSelectedUserForPin(null); }} user={selectedUserForPin} onSuccess={handlePinUpdate} />
        </div>
    );
};

const PermissionGroup = ({ group, moduleMeta, enabledCount, groupCodes, getPermissionState, togglePermission, setPermissionCodes }) => (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className={`h-9 w-1 rounded-full ${moduleMeta.accent}`} /><div><h4 className="text-base font-black text-slate-950">{moduleMeta.label}</h4><p className="text-xs font-bold text-slate-500">{enabledCount}/{group.permissions.length} activos</p></div></div><div className="flex gap-2"><button type="button" onClick={() => setPermissionCodes(groupCodes, true)} className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-black text-emerald-700 hover:bg-emerald-100">Activar</button><button type="button" onClick={() => setPermissionCodes(groupCodes, false)} className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-100">Bloquear</button></div></div>
        <div className="divide-y divide-slate-100">
            {group.permissions.map((permission) => {
                const state = getPermissionState(permission.code);
                return <button key={permission.code} type="button" onClick={() => togglePermission(permission.code)} className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-indigo-50/60"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-black text-slate-900">{permission.label}</p><RiskBadge risk={permission.risk_level} />{state.isCustomAllow && <StateBadge tone="emerald" label="Extra" />}{state.isDenied && <StateBadge tone="rose" label="Bloqueado" />}{state.isBase && !state.isDenied && !state.isCustomAllow && <StateBadge tone="slate" label="Base" />}</div><p className="mt-1 truncate font-mono text-xs font-bold text-slate-400">{permission.code}</p></div><span className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${state.isAllowed ? 'bg-indigo-600' : 'bg-slate-300'}`} aria-pressed={state.isAllowed}><span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${state.isAllowed ? 'translate-x-5' : 'translate-x-1'}`} /></span></button>;
            })}
        </div>
    </article>
);

const MetricCard = ({ icon: Icon, label, value, helper, tone }) => {
    const tones = { indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100', blue: 'bg-blue-50 text-blue-700 border-blue-100', emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100', slate: 'bg-slate-100 text-slate-700 border-slate-200' };
    return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-sm font-black text-slate-400">{label}</p><p className="mt-1 text-2xl font-black text-slate-950">{value}</p></div><div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${tones[tone] || tones.indigo}`}><Icon size={20} /></div></div><p className="mt-2 text-xs font-bold text-slate-500">{helper}</p></div>;
};

const PermissionMetric = ({ label, value, tone }) => {
    const tones = { indigo: 'text-indigo-700 bg-indigo-50 border-indigo-100', blue: 'text-blue-700 bg-blue-50 border-blue-100', emerald: 'text-emerald-700 bg-emerald-50 border-emerald-100', rose: 'text-rose-700 bg-rose-50 border-rose-100' };
    return <div className={`rounded-lg border p-3 ${tones[tone] || tones.indigo}`}><p className="text-xs font-black opacity-80">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>;
};

const StatusPill = ({ active }) => <span className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-black ${active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}><span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-rose-500'}`} />{active ? 'Activo' : 'Inactivo'}</span>;

const UserActions = ({ user, currentUser, onEdit, onPin, onPermissions, onPassword, onDeactivate }) => <div className="flex justify-end gap-2"><ActionButton label="Editar" icon={Edit} onClick={onEdit} /><ActionButton label="PIN" icon={Lock} onClick={onPin} /><ActionButton label="Permisos" icon={SlidersHorizontal} onClick={onPermissions} /><ActionButton label="Clave" icon={Key} onClick={onPassword} />{user.id !== currentUser?.id && <ActionButton label="Desactivar" icon={Trash2} onClick={onDeactivate} danger />}</div>;

const ActionButton = ({ label, icon: Icon, onClick, danger = false }) => <button type="button" title={label} onClick={onClick} className={`inline-flex h-9 w-9 items-center justify-center rounded-md border shadow-sm transition-colors ${danger ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700'}`}><Icon size={16} /></button>;

const UserMobileCard = ({ user, currentUser, getUserInitials, getRoleBadge, onEdit, onPin, onPermissions, onPassword, onDeactivate }) => <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-sm font-black text-white shadow-sm">{getUserInitials(user)}</div><div className="min-w-0"><p className="truncate text-base font-black text-slate-950">{user.full_name || user.username}</p><p className="truncate text-xs font-bold text-slate-500">@{user.username}{user.email ? ` · ${user.email}` : ''}</p></div></div><StatusPill active={user.is_active} /></div><div className="mt-3 flex flex-wrap gap-2">{getRoleBadge(user.role)}<span className={`rounded-md border px-2 py-1 text-xs font-black ${user.pin ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>{user.pin ? 'PIN activo' : 'Sin PIN'}</span></div><div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3"><ActionButton label="Editar" icon={Edit} onClick={onEdit} /><ActionButton label="PIN" icon={Lock} onClick={onPin} /><ActionButton label="Permisos" icon={SlidersHorizontal} onClick={onPermissions} /><ActionButton label="Clave" icon={Key} onClick={onPassword} />{user.id !== currentUser?.id && <ActionButton label="Desactivar" icon={Trash2} onClick={onDeactivate} danger />}</div></article>;

const renderUserEmptyState = (loading, count) => {
    if (loading) return <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-400">Cargando usuarios...</div>;
    if (count === 0) return <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-400">No hay usuarios con esos filtros.</div>;
    return null;
};

const UserFormModal = ({ modalMode, formData, setFormData, selectedUser, availableRoles, roleHint, modules, onClose, onSubmit }) => {
    const title = modalMode === 'create' ? 'Nuevo usuario' : modalMode === 'password' ? 'Cambiar contraseña' : 'Editar usuario';
    const subtitle = modalMode === 'password' ? selectedUser?.username : 'Cuenta, rol operativo y datos de contacto';
    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"><div className="w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-100 p-5"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">{modalMode === 'password' ? <Key size={22} /> : <UserCog size={22} />}</div><div><h3 className="text-xl font-black text-slate-950">{title}</h3><p className="text-sm font-semibold text-slate-500">{subtitle}</p></div></div><button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"><X size={18} /></button></header><form onSubmit={onSubmit} className="max-h-[75vh] overflow-y-auto p-5">{modalMode !== 'password' && <div className="grid gap-4 md:grid-cols-2"><Field label="Usuario" icon={UserRound} required><input type="text" value={formData.username} onChange={(event) => setFormData({ ...formData, username: event.target.value })} disabled={modalMode === 'edit'} className={inputClass} placeholder="usuario" required /></Field><Field label="Correo" icon={Mail}><input type="email" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} className={inputClass} placeholder="correo@empresa.com" /></Field><Field label="Nombre completo" icon={BadgeCheck}><input type="text" value={formData.full_name} onChange={(event) => setFormData({ ...formData, full_name: event.target.value })} className={inputClass} placeholder="Nombre del empleado" /></Field><div><label className="mb-2 block text-sm font-black text-slate-500">Rol base</label><select value={formData.role} onChange={(event) => setFormData({ ...formData, role: event.target.value })} className="h-12 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" required>{availableRoles.map((role) => <option key={role} value={role}>{ROLE_META[role]?.label || role}</option>)}</select><p className="mt-2 text-xs font-semibold text-slate-500">{roleHint}</p></div>{modules.services && <Field label="Comision servicios (%)" icon={Check}><input type="number" step="0.01" min="0" max="100" value={formData.commission_percentage} onChange={(event) => setFormData({ ...formData, commission_percentage: event.target.value })} className={inputClass} placeholder="0.00" /></Field>}</div>}{(modalMode === 'create' || modalMode === 'password') && <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 p-4"><Field label={`Contraseña ${modalMode === 'create' ? '*' : ''}`} icon={Lock}><input type="password" value={formData.password} onChange={(event) => setFormData({ ...formData, password: event.target.value })} className={`${inputClass} border-indigo-200`} required={modalMode === 'create'} placeholder="••••••••" minLength={6} /></Field><p className="mt-2 text-xs font-semibold text-indigo-500">Minimo 6 caracteres.</p></div>}<div className="sticky bottom-0 -mx-5 -mb-5 mt-5 flex flex-col gap-3 border-t border-slate-100 bg-white p-5 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="h-11 rounded-md border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 hover:bg-slate-50">Cancelar</button><button type="submit" className="h-11 rounded-md bg-indigo-600 px-5 text-sm font-black text-white shadow-sm hover:bg-indigo-700">{modalMode === 'create' && 'Crear usuario'}{modalMode === 'edit' && 'Guardar cambios'}{modalMode === 'password' && 'Actualizar clave'}</button></div></form></div></div>;
};

const Field = ({ label, icon: Icon, children, required = false }) => <label className="block"><span className="mb-2 block text-sm font-black text-slate-500">{label}{required && <span className="text-rose-500"> *</span>}</span><div className="relative"><Icon className="absolute left-3 top-3 text-slate-400" size={18} />{children}</div></label>;

const RiskBadge = ({ risk }) => {
    if (risk === 'critical') return <StateBadge tone="rose" label="Critico" />;
    if (risk === 'sensitive') return <StateBadge tone="amber" label="Sensible" />;
    return <StateBadge tone="slate" label="Basico" />;
};

const StateBadge = ({ tone, label }) => {
    const tones = { emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100', rose: 'bg-rose-50 text-rose-700 border-rose-100', amber: 'bg-amber-50 text-amber-700 border-amber-100', slate: 'bg-slate-100 text-slate-600 border-slate-200' };
    return <span className={`rounded-md border px-2 py-0.5 text-xs font-black ${tones[tone] || tones.slate}`}>{label}</span>;
};

export default UsuariosTab;
