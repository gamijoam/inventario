import { useState, useEffect } from 'react';
import { Users, Plus, Edit, Trash2, Key, Shield, X, Check, Lock } from 'lucide-react';
import apiClient from '../../config/axios';
import { useAuth } from '../../context/AuthContext';
import SetPinModal from '../../components/users/SetPinModal';
import userService from '../../services/userService';

const UsersManager = () => {
    const { user: currentUser } = useAuth();
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
        password: '',
        full_name: '',
        role: 'CASHIER'
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
                password: '',
                full_name: '',
                role: 'CASHIER'
            });
        } else if (mode === 'edit' && user) {
            setFormData({
                username: user.username,
                password: '',
                full_name: user.full_name || '',
                role: user.role
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
                    password: formData.password,
                    full_name: formData.full_name,
                    role: formData.role
                });
                alert('✅ Usuario creado exitosamente');
            } else if (modalMode === 'edit') {
                // Update user
                const updateData = {
                    role: formData.role,
                    full_name: formData.full_name
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
            ADMIN: 'bg-purple-100 text-purple-800 border-purple-200',
            CASHIER: 'bg-blue-100 text-blue-800 border-blue-200',
            WAREHOUSE: 'bg-green-100 text-green-800 border-green-200'
        };

        const labels = {
            ADMIN: 'Administrador',
            CASHIER: 'Cajero',
            WAREHOUSE: 'Almacén'
        };

        return (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${badges[role] || 'bg-gray-100 text-gray-800'}`}>
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
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Users className="text-blue-600" />
                        Gestión de Usuarios
                    </h1>
                    <p className="text-gray-600 mt-1">Administra usuarios y asigna roles</p>
                </div>

                <button
                    onClick={() => handleOpenModal('create')}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                    <Plus size={20} />
                    Nuevo Usuario
                </button>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="text-left p-4 font-semibold text-gray-700">Usuario</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Nombre Completo</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Rol</th>
                            <th className="text-center p-4 font-semibold text-gray-700">Estado</th>
                            <th className="text-center p-4 font-semibold text-gray-700">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            <tr>
                                <td colSpan="5" className="text-center p-8 text-gray-500">
                                    Cargando usuarios...
                                </td>
                            </tr>
                        ) : users.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="text-center p-8 text-gray-500">
                                    No hay usuarios registrados
                                </td>
                            </tr>
                        ) : (
                            users.map(user => (
                                <tr key={user.id} className="hover:bg-gray-50">
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-blue-100 rounded-full p-2">
                                                <Users size={16} className="text-blue-600" />
                                            </div>
                                            <span className="font-medium text-gray-800">{user.username}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-gray-700">
                                        {user.full_name || <span className="text-gray-400 italic">Sin nombre</span>}
                                    </td>
                                    <td className="p-4">
                                        {getRoleBadge(user.role)}
                                    </td>
                                    <td className="p-4 text-center">
                                        {user.is_active ? (
                                            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold flex items-center gap-1 justify-center w-fit mx-auto">
                                                <Check size={14} />
                                                Activo
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold flex items-center gap-1 justify-center w-fit mx-auto">
                                                <X size={14} />
                                                Inactivo
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => handleOpenModal('edit', user)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Editar usuario"
                                            >
                                                <Edit size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleOpenPinModal(user)}
                                                className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                                title="Establecer PIN de seguridad"
                                            >
                                                <Lock size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleOpenModal('password', user)}
                                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                title="Cambiar contraseña"
                                            >
                                                <Key size={18} />
                                            </button>
                                            {user.id !== currentUser?.id && (
                                                <button
                                                    onClick={() => handleDeactivate(user.id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Desactivar usuario"
                                                >
                                                    <Trash2 size={18} />
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                        {/* Modal Header */}
                        <div className="p-6 border-b flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                    {modalMode === 'create' && <><Plus size={24} /> Nuevo Usuario</>}
                                    {modalMode === 'edit' && <><Edit size={24} /> Editar Usuario</>}
                                    {modalMode === 'password' && <><Key size={24} /> Cambiar Contraseña</>}
                                </h3>
                                {selectedUser && (
                                    <p className="text-sm text-gray-600 mt-1">
                                        {selectedUser.username}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={handleCloseModal}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {modalMode !== 'password' && (
                                <>
                                    {modalMode === 'create' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Usuario *
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.username}
                                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                                required
                                                placeholder="nombre.usuario"
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Nombre Completo
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.full_name}
                                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="Juan Pérez"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                            <Shield size={16} />
                                            Rol *
                                        </label>
                                        <select
                                            value={formData.role}
                                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            required
                                        >
                                            <option value="ADMIN">Administrador</option>
                                            <option value="CASHIER">Cajero</option>
                                            <option value="WAREHOUSE">Almacén</option>
                                        </select>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {formData.role === 'ADMIN' && '✓ Acceso completo al sistema'}
                                            {formData.role === 'CASHIER' && '✓ Acceso a ventas y POS'}
                                            {formData.role === 'WAREHOUSE' && '✓ Acceso a inventario y productos'}
                                        </p>
                                    </div>
                                </>
                            )}

                            {(modalMode === 'create' || modalMode === 'password') && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Contraseña {modalMode === 'create' && '*'}
                                    </label>
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        required={modalMode === 'create'}
                                        placeholder="••••••••"
                                        minLength={6}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Mínimo 6 caracteres
                                    </p>
                                </div>
                            )}

                            {/* Modal Footer */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                                >
                                    {modalMode === 'create' && 'Crear Usuario'}
                                    {modalMode === 'edit' && 'Guardar Cambios'}
                                    {modalMode === 'password' && 'Cambiar Contraseña'}
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
