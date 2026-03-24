import React, { useState, useEffect } from 'react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import {
    Plus, Pencil, Trash2, Users, Search, X, Save
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const EmployeeManager = () => {
    const { user } = useAuth();
    const [employees, setEmployees] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        document_id: '',
        phone: '',
        base_commission_percentage: '50.00',
        status: 'ACTIVE'
    });

    const [editId, setEditId] = useState(null);

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            setIsLoading(true);
            const res = await apiClient.get('/employees');
            setEmployees(res.data);
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar empleados');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = (employee = null) => {
        if (employee) {
            setFormData({
                name: employee.name,
                document_id: employee.document_id || '',
                phone: employee.phone || '',
                base_commission_percentage: employee.base_commission_percentage,
                status: employee.status
            });
            setEditId(employee.id);
            setIsEditing(true);
        } else {
            setFormData({
                name: '',
                document_id: '',
                phone: '',
                base_commission_percentage: '50.00',
                status: 'ACTIVE'
            });
            setEditId(null);
            setIsEditing(false);
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                base_commission_percentage: parseFloat(formData.base_commission_percentage)
            };

            if (isEditing) {
                await apiClient.put(`/employees/${editId}`, payload);
                toast.success('Empleado actualizado');
            } else {
                await apiClient.post('/employees', payload);
                toast.success('Empleado creado exitosamente');
            }
            setIsModalOpen(false);
            fetchEmployees();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.detail || 'Error al guardar empleado');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Desactivar este empleado?')) return;
        try {
            await apiClient.delete(`/employees/${id}`);
            toast.success('Empleado desactivado');
            fetchEmployees();
        } catch (error) {
            console.error(error);
            toast.error('Error al desactivar empleado');
        }
    };

    const filtered = employees.filter(e =>
        e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.document_id && e.document_id.includes(searchTerm))
    );

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Barberos y Estilistas</h1>
                        <p className="text-slate-500 text-sm mt-1">Gestión de personal y comisiones base</p>
                    </div>
                </div>
                {user?.role === 'ADMIN' && (
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-sm hover:shadow-indigo-200 hover:shadow-lg font-medium"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Nuevo Personal</span>
                    </button>
                )}
            </div>

            {/* Content list */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="relative w-full sm:w-96">
                        <Search className="w-5 h-5 absolute left-3 top-2.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o documento..."
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow bg-slate-50 focus:bg-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-600 text-sm border-b border-slate-100">
                                <th className="p-4 font-semibold uppercase tracking-wider text-xs">Nombre</th>
                                <th className="p-4 font-semibold uppercase tracking-wider text-xs">Documento/Teléfono</th>
                                <th className="p-4 font-semibold uppercase tracking-wider text-xs text-right">Comisión Base</th>
                                <th className="p-4 font-semibold uppercase tracking-wider text-xs text-center">Estado</th>
                                <th className="p-4 font-semibold uppercase tracking-wider text-xs text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-slate-500">
                                        <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                                        Cargando...
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-slate-500">
                                        No hay personal registrado
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(emp => (
                                    <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 font-medium text-slate-800">{emp.name}</td>
                                        <td className="p-4 text-slate-600 text-sm">
                                            {emp.document_id && <span className="block">{emp.document_id}</span>}
                                            {emp.phone && <span className="block text-slate-500">{emp.phone}</span>}
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className="inline-block bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-sm font-semibold border border-emerald-100">
                                                {parseFloat(emp.base_commission_percentage).toFixed(2)}%
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            {emp.status === 'ACTIVE'
                                                ? <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">ACTIVO</span>
                                                : <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-full">INACTIVO</span>
                                            }
                                        </td>
                                        <td className="p-4 text-right space-x-2">
                                            {user?.role === 'ADMIN' && (
                                                <button
                                                    onClick={() => handleOpenModal(emp)}
                                                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                                                    title="Editar"
                                                >
                                                    <Pencil className="w-5 h-5" />
                                                </button>
                                            )}
                                            {user?.role === 'ADMIN' && emp.status === 'ACTIVE' && (
                                                <button
                                                    onClick={() => handleDelete(emp.id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                                    title="Desactivar"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && user?.role === 'ADMIN' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-xl font-bold text-slate-800">
                                {isEditing ? 'Editar Personal' : 'Nuevo Personal'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo *</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Ej. Juan Pérez"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Documento (Opcional)</label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                                        value={formData.document_id}
                                        onChange={e => setFormData({ ...formData, document_id: e.target.value })}
                                        placeholder="V-12345678"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono (Opcional)</label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="0414-0000000"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Comisión Base % *</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="100"
                                        required
                                        className="w-full border border-slate-200 rounded-xl pl-4 pr-10 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow font-semibold text-emerald-700"
                                        value={formData.base_commission_percentage}
                                        onChange={e => setFormData({ ...formData, base_commission_percentage: e.target.value })}
                                    />
                                    <span className="absolute right-4 top-2.5 text-slate-400 font-bold">%</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Se aplicará por defecto si el servicio no tiene una comisión explícita.</p>
                            </div>

                            {isEditing && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
                                    <select
                                        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        <option value="ACTIVE">Activo</option>
                                        <option value="INACTIVE">Inactivo</option>
                                    </select>
                                </div>
                            )}

                            <div className="pt-4 flex justify-end gap-3 mt-6 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-5 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-all shadow-sm hover:shadow-indigo-200 hover:shadow-lg flex items-center gap-2"
                                >
                                    <Save className="w-5 h-5" />
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeeManager;
