import { useState, useEffect } from 'react';
import { Users, Plus, Edit, Trash2, Key, Shield, X, Check, Lock } from 'lucide-react';
import apiClient from '../../../config/axios';
import { useAuth } from '../../../context/AuthContext';
import SetPinModal from '../../../components/users/SetPinModal';
import { useConfig } from '../../../context/ConfigContext';
import userService from '../../../services/userService';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../../../utils/apiErrors';

const UsuariosTab = () => {
    const { user: currentUser } = useAuth();
    const { modules } = useConfig();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('create'); // 'create', 'edit', 'password'
    const [selectedUser, setSelectedUser] = useState(null);

    // PIN Modal state
    const [showPinModal, setShowPinModal] = useState(false);
    const [selectedUserForPin, setSelectedUserForPin] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        full_name: '',
        role: 'CASHIER',
        commission_percentage: 0
    });

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/users');
            setUsers(response.data);
        } catch (error) {
            console.error('Error fetching users:', error);
            toast.error(getApiErrorMessage(error, 'No se pudieron cargar los usuarios'));
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (mode, user = null) => {
        setModalMode(mode);
        setSelectedUser(user);

        if (mode === 'create') {
            setFormData({
                username: '',
                email: '',
                password: '',
                full_name: '',
                role: 'CASHIER'
            });
        } else if (mode === 'edit' && user) {
            setFormData({
                username: user.username,
                email: user.email || '',
                password: '',
                full_name: user.full_name || '',
                role: user.role,
                commission_percentage: user.commission_percentage || 0
            });
        } else if (mode === 'password' && user) {
            setFormData({
                ...formData,
                password: ''
            });
        }

        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedUser(null);
        setFormData({
            username: '',
            email: '',
            password: '',
            full_name: '',
            role: 'CASHIER'
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            if (modalMode === 'create') {
                await apiClient.post('/users', {
                    username: formData.username,
                    email: formData.email || null,
                    password: formData.password,
                    full_name: formData.full_name,
                    role: formData.role,
                    commission_percentage: parseFloat(formData.commission_percentage || 0)
                });
                toast.success('Usuario creado exitosamente');
            } else if (modalMode === 'edit') {
                const updateData = {
                    role: formData.role,
                    email: formData.email || null,
                    full_name: formData.full_name,
                    commission_percentage: parseFloat(formData.commission_percentage || 0)
                };

                if (formData.password) {
                    updateData.password = formData.password;
                }

                await apiClient.put(`/users/${selectedUser.id}`, updateData);
                toast.success('Usuario actualizado exitosamente');
            } else if (modalMode === 'password') {
                await apiClient.put(`/users/${selectedUser.id}`, {
                    password: formData.password
                });
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
        if (!confirm('¿Estás seguro de desactivar este usuario?')) return;

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
        const badges = {
            ADMIN: 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm',
            CASHIER: 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm',
            WAREHOUSE: 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm',
            WAITER: 'bg-amber-50 text-amber-700 border-amber-200 shadow-sm',
            KITCHEN: 'bg-rose-50 text-rose-700 border-rose-200 shadow-sm'
        };

        const labels = {
            ADMIN: 'Administrador',
            CASHIER: 'Cajero',
            WAREHOUSE: 'Almacén',
            WAITER: 'Mesero',
            KITCHEN: 'Cocina'
        };

        return (
            <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${badges[role] || 'bg-slate-100 text-slate-800'}`}>
                {labels[role] || role}
            </span>
        );
    };

    const handleOpenPinModal = (user) => {
        setSelectedUserForPin(user);
        setShowPinModal(true);
    };

    const handlePinUpdate = async (userId, pin) => {
        try {
            await userService.updatePin(userId, pin);
            toast.success('PIN establecido exitosamente');
            setShowPinModal(false);
            setSelectedUserForPin(null);
        } catch (error) {
            throw error;
        }
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="flex items-center gap-2 text-xl font-black text-slate-900">
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-indigo-600 text-white shadow-sm">
                            <Users className="text-white" size={21} />
                        </div>
                        Gestión de Usuarios
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">Controle los accesos y roles del personal técnico y ventas</p>
                </div>

                <button
                    id="tour-users-add-btn"
                    onClick={() => handleOpenModal('create')}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 active:scale-[0.98]"
                >
                    <Plus size={18} />
                    <span>Nuevo Usuario</span>
                </button>
            </div>

            {/* Users List: Mobile Cards / Desktop Table */}
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                {/* Mobile View: Cards */}
                <div className="block space-y-3 bg-slate-50/50 p-4 md:hidden">
                    {loading ? (
                        <div className="text-center p-8 text-slate-400 font-medium">Cargando usuarios...</div>
                    ) : users.length === 0 ? (
                        <div className="text-center p-8 text-slate-400 font-medium italic">No hay usuarios registrados</div>
                    ) : (
                        users.map(user => (
                            <div key={user.id} className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-indigo-200">
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-indigo-600 text-white shadow-sm">
                                            <Users size={18} className="text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-black leading-tight text-slate-900">{user.username}</h3>
                                            <p className="text-slate-400 text-xs font-bold uppercase mt-1">{user.full_name || 'Sin nombre asignado'}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        {getRoleBadge(user.role)}
                                        {user.is_active ? (
                                            <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-tighter text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">ACTIVO</span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-tighter text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">INACTIVO</span>
                                        )}
                                    </div>
                                </div>

                                <div className="relative z-10 mt-4 grid grid-cols-4 gap-2 border-t border-slate-100 pt-4">
                                    <button
                                        onClick={() => handleOpenModal('edit', user)}
                                        className="flex flex-col items-center gap-1.5 p-2.5 rounded-md bg-slate-50 text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                                    >
                                        <Edit size={18} />
                                        <span className="text-[10px] font-black uppercase">Editar</span>
                                    </button>
                                    <button
                                        onClick={() => handleOpenPinModal(user)}
                                        className="flex flex-col items-center gap-1.5 p-2.5 rounded-md bg-slate-50 text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                                    >
                                        <Lock size={18} />
                                        <span className="text-[10px] font-black uppercase">PIN</span>
                                    </button>
                                    <button
                                        onClick={() => handleOpenModal('password', user)}
                                        className="flex flex-col items-center gap-1.5 p-2.5 rounded-md bg-slate-50 text-slate-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
                                    >
                                        <Key size={18} />
                                        <span className="text-[10px] font-black uppercase">Clave</span>
                                    </button>
                                    {user.id !== currentUser?.id && (
                                        <button
                                            onClick={() => handleDeactivate(user.id)}
                                            className="flex flex-col items-center gap-1.5 p-2.5 rounded-md bg-slate-50 text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
                                        >
                                            <Trash2 size={18} />
                                            <span className="text-[10px] font-black uppercase">Borrar</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Desktop View: Table */}
                <table className="w-full hidden md:table">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/80">
                            <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-slate-400">Usuario</th>
                            <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-slate-400">Nombre Completo</th>
                            <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-slate-400">Rol</th>
                            <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest text-slate-400">Estado</th>
                            <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest text-slate-400">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan="5" className="text-center p-12 text-slate-400 font-medium">
                                    Cargando base de datos...
                                </td>
                            </tr>
                        ) : users.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="text-center p-12 text-slate-400 font-medium italic">
                                    No hay registros disponibles
                                </td>
                            </tr>
                        ) : (
                            users.map(user => (
                                <tr key={user.id} className="group transition-colors hover:bg-indigo-50/30">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-400 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                                                <Users size={18} />
                                            </div>
                                            <span className="font-black text-slate-800 tracking-tight">{user.username}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-sm font-bold text-slate-600">
                                            {user.full_name || <span className="text-slate-300 font-normal italic">N/A</span>}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {getRoleBadge(user.role)}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {user.is_active ? (
                                            <span className="mx-auto flex w-fit items-center justify-center gap-1.5 rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                Activo
                                            </span>
                                        ) : (
                                            <span className="mx-auto flex w-fit items-center justify-center gap-1.5 rounded-md border border-rose-100 bg-rose-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-rose-700">
                                                <X size={12} />
                                                Inactivo
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => handleOpenModal('edit', user)}
                                                className="rounded-md p-2 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                                                title="Editar perfil"
                                            >
                                                <Edit size={20} />
                                            </button>
                                            <button
                                                onClick={() => handleOpenPinModal(user)}
                                                className="rounded-md p-2 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                                                title="Configurar PIN"
                                            >
                                                <Lock size={20} />
                                            </button>
                                            <button
                                                onClick={() => handleOpenModal('password', user)}
                                                className="rounded-md p-2 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
                                                title="Nueva contraseña"
                                            >
                                                <Key size={20} />
                                            </button>
                                            {user.id !== currentUser?.id && (
                                                <button
                                                    onClick={() => handleDeactivate(user.id)}
                                                    className="rounded-md p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-700"
                                                    title="Eliminar acceso"
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between bg-indigo-600 p-5 text-white">
                            <div className="flex items-center gap-3">
                                <div className="rounded-md bg-white/15 p-2">
                                    {modalMode === 'create' && <Plus size={24} />}
                                    {modalMode === 'edit' && <Edit size={24} />}
                                    {modalMode === 'password' && <Key size={24} />}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">
                                        {modalMode === 'create' && 'Nuevo Usuario'}
                                        {modalMode === 'edit' && 'Editar Usuario'}
                                        {modalMode === 'password' && 'Cambiar Contraseña'}
                                    </h3>
                                    {selectedUser && (
                                        <p className="text-indigo-100 text-sm mt-0.5">
                                            {selectedUser.username}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={handleCloseModal}
                                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSubmit} className="max-h-[80vh] space-y-5 overflow-y-auto bg-slate-50/30 p-5">
                            {modalMode !== 'password' && (
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    {modalMode === 'create' && (
                                        <div className="md:col-span-1">
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                                Usuario *
                                            </label>
                                            <div className="relative group">
                                                <div className="absolute left-3 top-3.5 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                                                    <Users size={18} />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={formData.username}
                                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-md outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                                    required
                                                    placeholder="ej. perez.juan"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className={modalMode === 'create' ? "md:col-span-1" : "md:col-span-2"}>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                            Correo Electrónico *
                                        </label>
                                        <div className="relative group">
                                            <div className="absolute left-3 top-3.5 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                                                <Edit size={18} className="rotate-12" />
                                            </div>
                                            <input
                                                type="email"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-md outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                                placeholder="ejemplo@correo.com"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                            Nombre Completo
                                        </label>
                                        <div className="relative group">
                                            <div className="absolute left-3 top-3.5 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                                                <Users size={18} />
                                            </div>
                                            <input
                                                type="text"
                                                value={formData.full_name}
                                                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-md outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                                placeholder="Juan Pérez"
                                            />
                                        </div>
                                    </div>

                                    <div className="md:col-span-1">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                            Rol de Usuario *
                                        </label>
                                        <div className="relative group">
                                            <div className="absolute left-3 top-3.5 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                                                <Shield size={18} />
                                            </div>
                                            <select
                                                value={formData.role}
                                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-md outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer"
                                                required
                                            >
                                                <option value="ADMIN">Administrador</option>
                                                <option value="CASHIER">Cajero</option>
                                                <option value="WAREHOUSE">Almacén</option>
                                                {modules.restaurant && (
                                                    <>
                                                        <option value="WAITER">Mesero</option>
                                                        <option value="KITCHEN">Cocina</option>
                                                    </>
                                                )}
                                            </select>
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-2 ml-1 italic font-medium">
                                            {formData.role === 'ADMIN' && 'Acceso completo al sistema'}
                                            {formData.role === 'CASHIER' && 'Acceso a ventas y POS'}
                                            {formData.role === 'WAREHOUSE' && 'Acceso a inventario y productos'}
                                            {modules.restaurant && formData.role === 'WAITER' && 'Acceso a comandera móvil'}
                                            {modules.restaurant && formData.role === 'KITCHEN' && 'Acceso a pantalla de cocina'}
                                        </p>
                                    </div>

                                    {modules.services && (
                                        <div className="md:col-span-1">
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                                % Comisión (Servicios)
                                            </label>
                                            <div className="relative group">
                                                <div className="absolute left-3 top-3.5 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                                                    <Check size={18} />
                                                </div>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                    value={formData.commission_percentage}
                                                    onChange={(e) => setFormData({ ...formData, commission_percentage: e.target.value })}
                                                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-md outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {(modalMode === 'create' || modalMode === 'password') && (
                                <div className="bg-indigo-50/50 p-4 rounded-lg border border-indigo-100">
                                    <label className="block text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">
                                        Contraseña {modalMode === 'create' && '*'}
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute left-3 top-3.5 text-indigo-400 group-focus-within:text-indigo-600 transition-colors">
                                            <Lock size={18} />
                                        </div>
                                        <input
                                            type="password"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            className="w-full pl-10 pr-4 py-3 bg-white border border-indigo-200 rounded-md outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-indigo-200"
                                            required={modalMode === 'create'}
                                            placeholder="••••••••"
                                            minLength={6}
                                        />
                                    </div>
                                    <p className="text-[10px] text-indigo-400 mt-2 ml-1 font-medium italic">
                                        Mínimo 6 caracteres para mayor seguridad
                                    </p>
                                </div>
                            )}

                            {/* Modal Footer */}
                            <div className="flex flex-col sm:flex-row gap-3 pt-4 sticky bottom-0 -mx-5 -mb-5 border-t border-slate-100 bg-white p-5">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-md text-slate-600 font-bold transition-colors hover:bg-slate-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-black transition-colors shadow-sm disabled:opacity-50"
                                >
                                    {modalMode === 'create' && 'Crear Usuario'}
                                    {modalMode === 'edit' && 'Guardar Cambios'}
                                    {modalMode === 'password' && 'Actualizar Clave'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* PIN Modal */}
            <SetPinModal
                isOpen={showPinModal}
                onClose={() => {
                    setShowPinModal(false);
                    setSelectedUserForPin(null);
                }}
                user={selectedUserForPin}
                onSuccess={handlePinUpdate}
            />
        </div>
    );
};

export default UsuariosTab;
