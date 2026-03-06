import { useState, useEffect } from 'react';
import { Users, Plus, Edit, Trash2, Key, Shield, X, Check, Lock } from 'lucide-react';
import apiClient from '../../config/axios';
import { useAuth } from '../../context/AuthContext';
import SetPinModal from '../../components/users/SetPinModal';
import { useConfig } from '../../context/ConfigContext';
import userService from '../../services/userService';

const UsersManager = () => {
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
        commission_percentage: 0 // NEW
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
            alert('Error al cargar usuarios');
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
                commission_percentage: user.commission_percentage || 0 // NEW
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
                // Create new user
                await apiClient.post('/users', {
                    username: formData.username,
                    email: formData.email || null,
                    password: formData.password,
                    full_name: formData.full_name,
                    role: formData.role,
                    commission_percentage: parseFloat(formData.commission_percentage || 0) // NEW
                });
                alert('✅ Usuario creado exitosamente');
            } else if (modalMode === 'edit') {
                // Update user
                const updateData = {
                    role: formData.role,
                    email: formData.email || null,
                    full_name: formData.full_name,
                    commission_percentage: parseFloat(formData.commission_percentage || 0) // NEW
                };

                // Only include password if it was changed
                if (formData.password) {
                    updateData.password = formData.password;
                }

                await apiClient.put(`/users/${selectedUser.id}`, updateData);
                alert('✅ Usuario actualizado exitosamente');
            } else if (modalMode === 'password') {
                // Change password
                await apiClient.put(`/users/${selectedUser.id}`, {
                    password: formData.password
                });
                alert('✅ Contraseña actualizada exitosamente');
            }

            handleCloseModal();
            fetchUsers();
        } catch (error) {
            console.error('Error saving user:', error);
            alert('❌ Error: ' + (error.response?.data?.detail || error.message));
        }
    };

    const handleDeactivate = async (userId) => {
        if (!confirm('¿Estás seguro de desactivar este usuario?')) return;

        try {
            await apiClient.delete(`/users/${userId}`);
            alert('✅ Usuario desactivado');
            fetchUsers();
        } catch (error) {
            console.error('Error deactivating user:', error);
            alert('❌ Error al desactivar usuario');
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
            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${badges[role] || 'bg-slate-100 text-slate-800'}`}>
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
            alert('✅ PIN establecido exitosamente');
            setShowPinModal(false);
            setSelectedUserForPin(null);
        } catch (error) {
            throw error; // Let SetPinModal handle the error
        }
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                        <div className="p-2.5 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/30">
                            <Users className="text-white" size={28} />
                        </div>
                        Gestión de Usuarios
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">Controle los accesos y roles del personal técnico y ventas</p>
                </div>

                <button
                    id="tour-users-add-btn"
                    onClick={() => handleOpenModal('create')}
                    className="group flex items-center gap-2 bg-slate-900 hover:bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-slate-200 active:scale-95"
                >
                    <Plus size={22} className="group-hover:rotate-90 transition-transform" />
                    <span>Nuevo Usuario</span>
                </button>
            </div>

            {/* Users List: Mobile Cards / Desktop Table */}
            <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                {/* Mobile View: Cards */}
                <div className="block md:hidden p-4 space-y-4 bg-slate-50/50">
                    {loading ? (
                        <div className="text-center p-8 text-slate-400 font-medium">Cargando usuarios...</div>
                    ) : users.length === 0 ? (
                        <div className="text-center p-8 text-slate-400 font-medium italic">No hay usuarios registrados</div>
                    ) : (
                        users.map(user => (
                            <div key={user.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-12 -mt-12 group-hover:bg-blue-100 transition-colors" />

                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-2.5 shadow-md">
                                            <Users size={20} className="text-white" />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-slate-800 text-lg leading-tight tracking-tight">{user.username}</h3>
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

                                <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-slate-50 relative z-10">
                                    <button
                                        onClick={() => handleOpenModal('edit', user)}
                                        className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-slate-50 text-slate-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95"
                                    >
                                        <Edit size={18} />
                                        <span className="text-[10px] font-black uppercase">Editar</span>
                                    </button>
                                    <button
                                        onClick={() => handleOpenPinModal(user)}
                                        className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-slate-50 text-slate-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95"
                                    >
                                        <Lock size={18} />
                                        <span className="text-[10px] font-black uppercase">PIN</span>
                                    </button>
                                    <button
                                        onClick={() => handleOpenModal('password', user)}
                                        className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-slate-50 text-slate-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-95"
                                    >
                                        <Key size={18} />
                                        <span className="text-[10px] font-black uppercase">Clave</span>
                                    </button>
                                    {user.id !== currentUser?.id && (
                                        <button
                                            onClick={() => handleDeactivate(user.id)}
                                            className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-slate-50 text-slate-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm active:scale-95"
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
                        <tr className="bg-slate-50/80 border-b border-slate-100">
                            <th className="text-left p-6 text-xs font-black uppercase tracking-widest text-slate-400">Usuario</th>
                            <th className="text-left p-6 text-xs font-black uppercase tracking-widest text-slate-400">Nombre Completo</th>
                            <th className="text-left p-6 text-xs font-black uppercase tracking-widest text-slate-400">Rol</th>
                            <th className="text-center p-6 text-xs font-black uppercase tracking-widest text-slate-400">Estado</th>
                            <th className="text-center p-6 text-xs font-black uppercase tracking-widest text-slate-400">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
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
                                <tr key={user.id} className="hover:bg-blue-50/30 transition-colors group">
                                    <td className="p-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                                                <Users size={18} />
                                            </div>
                                            <span className="font-black text-slate-800 tracking-tight">{user.username}</span>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <span className="text-sm font-bold text-slate-600">
                                            {user.full_name || <span className="text-slate-300 font-normal italic">N/A</span>}
                                        </span>
                                    </td>
                                    <td className="p-6">
                                        {getRoleBadge(user.role)}
                                    </td>
                                    <td className="p-6 text-center">
                                        {user.is_active ? (
                                            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-tighter flex items-center gap-1.5 justify-center w-fit mx-auto border border-emerald-100">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                Activo
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1.5 bg-rose-50 text-rose-700 rounded-xl text-[10px] font-black uppercase tracking-tighter flex items-center gap-1.5 justify-center w-fit mx-auto border border-rose-100">
                                                <X size={12} />
                                                Inactivo
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => handleOpenModal('edit', user)}
                                                className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all hover:shadow-lg active:scale-90"
                                                title="Editar perfil"
                                            >
                                                <Edit size={20} />
                                            </button>
                                            <button
                                                onClick={() => handleOpenPinModal(user)}
                                                className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all hover:shadow-lg active:scale-90"
                                                title="Configurar PIN"
                                            >
                                                <Lock size={20} />
                                            </button>
                                            <button
                                                onClick={() => handleOpenModal('password', user)}
                                                className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-white rounded-xl transition-all hover:shadow-lg active:scale-90"
                                                title="Nueva contraseña"
                                            >
                                                <Key size={20} />
                                            </button>
                                            {user.id !== currentUser?.id && (
                                                <button
                                                    onClick={() => handleDeactivate(user.id)}
                                                    className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-xl transition-all hover:shadow-lg active:scale-90"
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
                <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white flex justify-between items-center shadow-lg">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-lg">
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
                                        <p className="text-blue-100 text-sm mt-0.5">
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
                        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[80vh] bg-slate-50/30">
                            {modalMode !== 'password' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {modalMode === 'create' && (
                                        <div className="md:col-span-1">
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                                Usuario *
                                            </label>
                                            <div className="relative group">
                                                <div className="absolute left-3 top-3.5 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                                                    <Users size={18} />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={formData.username}
                                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none transition-all"
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
                                            <div className="absolute left-3 top-3.5 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                                                <Edit size={18} className="rotate-12" />
                                            </div>
                                            <input
                                                type="email"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none transition-all"
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
                                            <div className="absolute left-3 top-3.5 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                                                <Users size={18} />
                                            </div>
                                            <input
                                                type="text"
                                                value={formData.full_name}
                                                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none transition-all"
                                                placeholder="Juan Pérez"
                                            />
                                        </div>
                                    </div>

                                    <div className="md:col-span-1">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                            Rol de Usuario *
                                        </label>
                                        <div className="relative group">
                                            <div className="absolute left-3 top-3.5 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                                                <Shield size={18} />
                                            </div>
                                            <select
                                                value={formData.role}
                                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none transition-all appearance-none cursor-pointer"
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
                                            {formData.role === 'ADMIN' && '✨ Acceso completo al sistema'}
                                            {formData.role === 'CASHIER' && '💰 Acceso a ventas y POS'}
                                            {formData.role === 'WAREHOUSE' && '📦 Acceso a inventario y productos'}
                                            {modules.restaurant && formData.role === 'WAITER' && '🍽️ Acceso a comandera móvil'}
                                            {modules.restaurant && formData.role === 'KITCHEN' && '🍳 Acceso a pantalla de cocina'}
                                        </p>
                                    </div>

                                    {modules.services && (
                                        <div className="md:col-span-1">
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                                % Comisión (Servicios)
                                            </label>
                                            <div className="relative group">
                                                <div className="absolute left-3 top-3.5 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                                                    <Check size={18} />
                                                </div>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                    value={formData.commission_percentage}
                                                    onChange={(e) => setFormData({ ...formData, commission_percentage: e.target.value })}
                                                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none transition-all"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {(modalMode === 'create' || modalMode === 'password') && (
                                <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                                    <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">
                                        Contraseña {modalMode === 'create' && '*'}
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute left-3 top-3.5 text-blue-400 group-focus-within:text-blue-600 transition-colors">
                                            <Lock size={18} />
                                        </div>
                                        <input
                                            type="password"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            className="w-full pl-10 pr-4 py-3 bg-white border border-blue-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none transition-all placeholder:text-blue-200"
                                            required={modalMode === 'create'}
                                            placeholder="••••••••"
                                            minLength={6}
                                        />
                                    </div>
                                    <p className="text-[10px] text-blue-400 mt-2 ml-1 font-medium italic">
                                        Mínimo 6 caracteres para mayor seguridad
                                    </p>
                                </div>
                            )}

                            {/* Modal Footer */}
                            <div className="flex flex-col sm:flex-row gap-3 pt-4 sticky bottom-0 bg-slate-50/10 backdrop-blur-sm -mx-6 -mb-6 p-6 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black transition-all shadow-lg shadow-blue-500/30 active:scale-95 disabled:opacity-50"
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

export default UsersManager;
