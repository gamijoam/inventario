import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Building2, Phone, Mail, CreditCard } from 'lucide-react';
import { useWebSocket } from '../context/WebSocketContext';
import apiClient from '../config/axios';

const Suppliers = () => {
    const { subscribe } = useWebSocket();
    const [suppliers, setSuppliers] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSuppliers();

        // WebSocket subscriptions for real-time updates
        const unsubCreate = subscribe('supplier:created', (newSupplier) => {
            setSuppliers(prev => [newSupplier, ...prev]);
        });

        const unsubUpdate = subscribe('supplier:updated', (updatedSupplier) => {
            setSuppliers(prev => prev.map(s => s.id === updatedSupplier.id ? { ...s, ...updatedSupplier } : s));
        });

        return () => {
            unsubCreate();
            unsubUpdate();
        };
    }, [subscribe]);

    const fetchSuppliers = async () => {
        try {
            const response = await apiClient.get('/suppliers');
            setSuppliers(response.data);
        } catch (error) {
            console.error('Error fetching suppliers:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (supplier) => {
        setEditingSupplier(supplier);
        setShowModal(true);
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`¿Eliminar proveedor "${name}"?`)) return;

        try {
            await apiClient.delete(`/suppliers/${id}`);
            fetchSuppliers();
        } catch (error) {
            alert(error.response?.data?.detail || 'Error al eliminar proveedor');
        }
    };

    const handleModalClose = () => {
        setShowModal(false);
        setEditingSupplier(null);
    };

    const handleSuccess = () => {
        fetchSuppliers();
        handleModalClose();
    };

    return (
        <div className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Proveedores</h1>
                    <p className="text-gray-600">Gestión de proveedores y términos de crédito</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="w-full md:w-auto flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow transition-colors"
                >
                    <Plus size={20} className="mr-2" />
                    Nuevo Proveedor
                </button>
            </div>

            {/* Suppliers Table (Desktop) */}
            <div className="hidden md:block bg-white rounded-lg shadow">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="text-left p-4 font-semibold text-gray-700">Proveedor</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Contacto</th>
                            <th className="text-center p-4 font-semibold text-gray-700">Términos Pago</th>
                            <th className="text-right p-4 font-semibold text-gray-700">Límite Crédito</th>
                            <th className="text-right p-4 font-semibold text-gray-700">Deuda Actual</th>
                            <th className="text-right p-4 font-semibold text-gray-700">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            <tr>
                                <td colSpan="6" className="text-center p-8 text-gray-500">
                                    Cargando...
                                </td>
                            </tr>
                        ) : suppliers.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="text-center p-8 text-gray-500">
                                    No hay proveedores registrados
                                </td>
                            </tr>
                        ) : (
                            suppliers.map(supplier => (
                                <tr key={supplier.id} className="hover:bg-gray-50">
                                    <td className="p-4">
                                        <div className="font-medium text-gray-800">{supplier.name}</div>
                                        {supplier.email && (
                                            <div className="text-xs text-gray-500">{supplier.email}</div>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="text-sm">
                                            {supplier.contact_person && (
                                                <div className="text-gray-700">{supplier.contact_person}</div>
                                            )}
                                            {supplier.phone && (
                                                <div className="text-gray-500">{supplier.phone}</div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                                            {supplier.payment_terms || 0} días
                                        </span>
                                    </td>
                                    <td className="p-4 text-right font-medium">
                                        {supplier.credit_limit ? `$${Number(supplier.credit_limit).toFixed(2)}` : '-'}
                                    </td>
                                    <td className="p-4 text-right">
                                        <span className={`font-bold ${supplier.current_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            ${Number(supplier.current_balance || 0).toFixed(2)}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleEdit(supplier)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                title="Editar"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(supplier.id, supplier.name)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {loading ? (
                    <div className="text-center p-8 text-gray-500">Cargando...</div>
                ) : suppliers.length === 0 ? (
                    <div className="text-center p-8 text-gray-500">No hay proveedores registrados</div>
                ) : (
                    suppliers.map(supplier => (
                        <div key={supplier.id} className="bg-white p-4 rounded-lg shadow border border-gray-100 flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-gray-800 text-lg">{supplier.name}</h3>
                                    {supplier.contact_person && (
                                        <div className="text-sm text-gray-600 flex items-center mt-1">
                                            <Building2 size={14} className="mr-1" /> {supplier.contact_person}
                                        </div>
                                    )}
                                </div>
                                <div className="text-right">
                                    <div className={`font-bold text-lg ${supplier.current_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        ${Number(supplier.current_balance || 0).toFixed(2)}
                                    </div>
                                    <div className="text-xs text-gray-500">Deuda Actual</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm border-t border-b border-gray-100 py-2">
                                <div>
                                    <div className="text-gray-500 text-xs">Teléfono</div>
                                    <div className="font-medium">{supplier.phone || '-'}</div>
                                </div>
                                <div>
                                    <div className="text-gray-500 text-xs">Email</div>
                                    <div className="font-medium truncate">{supplier.email || '-'}</div>
                                </div>
                                <div>
                                    <div className="text-gray-500 text-xs">Crédito</div>
                                    <div className="font-medium">{supplier.credit_limit ? `$${Number(supplier.credit_limit).toFixed(2)}` : '-'}</div>
                                </div>
                                <div>
                                    <div className="text-gray-500 text-xs">Plazo</div>
                                    <div className="font-medium">{supplier.payment_terms || 0} días</div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    onClick={() => handleEdit(supplier)}
                                    className="flex items-center text-blue-600 bg-blue-50 px-3 py-2 rounded-lg font-medium text-sm"
                                >
                                    <Edit2 size={16} className="mr-1" /> Editar
                                </button>
                                <button
                                    onClick={() => handleDelete(supplier.id, supplier.name)}
                                    className="flex items-center text-red-600 bg-red-50 px-3 py-2 rounded-lg font-medium text-sm"
                                >
                                    <Trash2 size={16} className="mr-1" /> Eliminar
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <SupplierModal
                    supplier={editingSupplier}
                    onClose={handleModalClose}
                    onSuccess={handleSuccess}
                />
            )}
        </div>
    );
};

// Supplier Modal Component
const SupplierModal = ({ supplier, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        name: supplier?.name || '',
        contact_person: supplier?.contact_person || '',
        phone: supplier?.phone || '',
        email: supplier?.email || '',
        address: supplier?.address || '',
        payment_terms: supplier?.payment_terms || 30,
        credit_limit: supplier?.credit_limit || '',
        notes: supplier?.notes || ''
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                ...formData,
                credit_limit: formData.credit_limit ? parseFloat(formData.credit_limit) : null,
                payment_terms: parseInt(formData.payment_terms) || 30
            };

            if (supplier) {
                await apiClient.put(`/suppliers/${supplier.id}`, payload);
            } else {
                await apiClient.post('/suppliers', payload);
            }

            alert('Proveedor guardado exitosamente');
            onSuccess();
        } catch (error) {
            console.error('Error saving supplier:', error);
            alert(error.response?.data?.detail || 'Error al guardar proveedor');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b bg-gray-50">
                    <h3 className="text-xl font-bold text-gray-800">
                        {supplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                    </h3>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Nombre del Proveedor *
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Persona de Contacto
                            </label>
                            <input
                                type="text"
                                value={formData.contact_person}
                                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Teléfono
                            </label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Email
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Dirección
                            </label>
                            <textarea
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                rows="2"
                            />
                        </div>
                    </div>

                    {/* Financial Info */}
                    <div className="border-t pt-4">
                        <h4 className="text-md font-bold text-gray-700 mb-3 flex items-center">
                            <CreditCard size={18} className="mr-2" />
                            Información Financiera
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Términos de Pago (días)
                                </label>
                                <input
                                    type="number"
                                    value={formData.payment_terms}
                                    onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    min="0"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Ej: 15, 30, 60 días de crédito
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Límite de Crédito ($)
                                </label>
                                <input
                                    type="number"
                                    value={formData.credit_limit}
                                    onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    min="0"
                                    step="0.01"
                                    placeholder="Opcional"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Monto máximo de deuda permitido
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Notas
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            rows="3"
                            placeholder="Observaciones adicionales..."
                        />
                    </div>
                </form>

                <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Guardando...' : 'Guardar Proveedor'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Suppliers;
