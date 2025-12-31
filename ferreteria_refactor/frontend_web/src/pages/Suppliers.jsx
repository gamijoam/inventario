import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Building2, Phone, Mail, Search, Truck, MapPin, FileText, CheckCircle, X, CreditCard } from 'lucide-react';
import { useWebSocket } from '../context/WebSocketContext';
import apiClient from '../config/axios';
import clsx from 'clsx';
import { toast } from 'react-hot-toast';

const Suppliers = () => {
    const { subscribe } = useWebSocket();
    const [suppliers, setSuppliers] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchSuppliers();

        const unsubCreate = subscribe('supplier:created', (newSupplier) => {
            setSuppliers(prev => [newSupplier, ...prev]);
            toast.success(`Proveedor "${newSupplier.name}" creado`);
        });

        const unsubUpdate = subscribe('supplier:updated', (updatedSupplier) => {
            setSuppliers(prev => prev.map(s => s.id === updatedSupplier.id ? { ...s, ...updatedSupplier } : s));
            toast.success(`Proveedor "${updatedSupplier.name}" actualizado`);
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
            toast.error('Error cargando proveedores');
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
            toast.success('Proveedor eliminado');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Error al eliminar proveedor');
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

    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.contact_person?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-6 max-w-[1600px] mx-auto min-h-screen flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
                        <Truck className="text-indigo-600" size={32} /> Proveedores
                    </h1>
                    <p className="text-slate-500 font-medium">Gestión de proveedores, contactos y términos de crédito</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="w-full md:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5 transition-all"
                >
                    <Plus size={20} />
                    Nuevo Proveedor
                </button>
            </div>

            {/* Search Bar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 flex items-center gap-4">
                <div className="relative flex-1 group">
                    <Search className="absolute left-3 top-3 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar proveedor por nombre o contacto..."
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-700 bg-slate-50 focus:bg-white transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="hidden md:flex items-center gap-2 text-sm text-slate-500 font-medium px-4 border-l border-slate-100">
                    <Building2 size={16} />
                    {filteredSuppliers.length} Proveedores
                </div>
            </div>

            {/* Suppliers Table (Desktop) */}
            <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Proveedor</th>
                            <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Contacto Principal</th>
                            <th className="text-center py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Términos Pago</th>
                            <th className="text-right py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Límite Crédito</th>
                            <th className="text-right py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Deuda Actual</th>
                            <th className="text-right py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan="6" className="text-center py-16 text-slate-400">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                                    Cargando...
                                </td>
                            </tr>
                        ) : filteredSuppliers.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="text-center py-16 text-slate-400">
                                    <Truck size={48} className="mx-auto mb-3 opacity-20" />
                                    <p className="font-medium">No se encontraron proveedores</p>
                                </td>
                            </tr>
                        ) : (
                            filteredSuppliers.map((supplier, idx) => (
                                <tr key={supplier.id} className={clsx("hover:bg-slate-50/80 transition-colors", idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30')}>
                                    <td className="py-4 px-6">
                                        <div className="font-bold text-slate-800">{supplier.name}</div>
                                        {supplier.email && (
                                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                <Mail size={12} /> {supplier.email}
                                            </div>
                                        )}
                                    </td>
                                    <td className="py-4 px-6">
                                        <div className="text-sm">
                                            {supplier.contact_person ? (
                                                <div className="text-slate-700 font-medium flex items-center gap-1.5">
                                                    <Building2 size={14} className="text-slate-400" /> {supplier.contact_person}
                                                </div>
                                            ) : <span className="text-slate-400 italic">No registrado</span>}
                                            {supplier.phone && (
                                                <div className="text-slate-500 text-xs mt-0.5 flex items-center gap-1">
                                                    <Phone size={12} /> {supplier.phone}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-4 px-6 text-center">
                                        <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-xs font-bold">
                                            {supplier.payment_terms || 0} días
                                        </span>
                                    </td>
                                    <td className="py-4 px-6 text-right font-medium text-slate-600">
                                        {supplier.credit_limit ? `$${Number(supplier.credit_limit).toLocaleString()}` : <span className="text-slate-300">-</span>}
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        <span className={clsx("font-bold px-2 py-1 rounded-lg text-sm",
                                            supplier.current_balance > 0 ? 'bg-rose-50 text-rose-600' : 'text-emerald-600'
                                        )}>
                                            ${Number(supplier.current_balance || 0).toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleEdit(supplier)}
                                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="Editar"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(supplier.id, supplier.name)}
                                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={16} />
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
            <div className="md:hidden grid grid-cols-1 gap-4">
                {loading ? (
                    <div className="text-center p-8 text-slate-500">Cargando...</div>
                ) : filteredSuppliers.length === 0 ? (
                    <div className="text-center p-8 text-slate-500 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                        No se encontraron proveedores
                    </div>
                ) : (
                    filteredSuppliers.map(supplier => (
                        <div key={supplier.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-slate-800 text-lg">{supplier.name}</h3>
                                    {supplier.contact_person && (
                                        <div className="text-sm text-slate-500 font-medium flex items-center gap-1.5 mt-1">
                                            <Building2 size={14} /> {supplier.contact_person}
                                        </div>
                                    )}
                                </div>
                                <div className="text-right">
                                    <div className={clsx("font-black text-lg", supplier.current_balance > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                                        ${Number(supplier.current_balance || 0).toLocaleString()}
                                    </div>
                                    <div className="text-[10px] uppercase font-bold text-slate-400">Deuda Actual</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <div>
                                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Teléfono</div>
                                    <div className="font-medium text-slate-700 text-sm truncate">{supplier.phone || '-'}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Email</div>
                                    <div className="font-medium text-slate-700 text-sm truncate">{supplier.email || '-'}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Crédito</div>
                                    <div className="font-medium text-slate-700 text-sm">{supplier.credit_limit ? `$${Number(supplier.credit_limit).toLocaleString()}` : '-'}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Plazo</div>
                                    <div className="font-medium text-slate-700 text-sm">{supplier.payment_terms || 0} días</div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    onClick={() => handleEdit(supplier)}
                                    className="flex-1 flex items-center justify-center text-indigo-700 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 py-2.5 rounded-xl font-bold text-sm transition-colors"
                                >
                                    <Edit2 size={16} className="mr-2" /> Editar
                                </button>
                                <button
                                    onClick={() => handleDelete(supplier.id, supplier.name)}
                                    className="flex-1 flex items-center justify-center text-rose-700 bg-rose-50 border border-rose-100 hover:bg-rose-100 py-2.5 rounded-xl font-bold text-sm transition-colors"
                                >
                                    <Trash2 size={16} className="mr-2" /> Eliminar
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

            toast.success('Proveedor guardado exitosamente');
            onSuccess();
        } catch (error) {
            console.error('Error saving supplier:', error);
            toast.error(error.response?.data?.detail || 'Error al guardar proveedor');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden transform transition-all scale-100">
                <div className="p-5 border-b border-slate-100 bg-white sticky top-0 z-10 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Truck className="text-indigo-600" size={24} />
                        {supplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 pb-1 border-b border-slate-100">Información General</h4>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                Nombre del Proveedor *
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-700"
                                placeholder="Ej: Distribuidora Ferretera C.A."
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ">
                                Persona de Contacto
                            </label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-3 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    value={formData.contact_person}
                                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-700"
                                    placeholder="Nombre del Vendedor"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                Teléfono
                            </label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-3 text-slate-400" size={18} />
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-700"
                                    placeholder="+58 ..."
                                />
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-700"
                                    placeholder="contacto@proveedor.com"
                                />
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                Dirección Fiscal
                            </label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-3 text-slate-400" size={18} />
                                <textarea
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none font-medium text-slate-700"
                                    rows="2"
                                    placeholder="Dirección completa..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Financial Info */}
                    <div className="border-t border-slate-100 pt-6">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 pb-1 flex items-center gap-2">
                            <CreditCard size={16} />
                            Información Financiera
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    Términos de Pago
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={formData.payment_terms}
                                        onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                                        className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-bold text-slate-700"
                                        min="0"
                                    />
                                    <span className="absolute right-4 top-3 text-slate-400 text-sm font-medium">días</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    Límite de Crédito
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-3 text-slate-400 font-bold">$</span>
                                    <input
                                        type="number"
                                        value={formData.credit_limit}
                                        onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                                        className="w-full pl-8 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-bold text-slate-700"
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            Notas Adicionales
                        </label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-3 text-slate-400" size={18} />
                            <textarea
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none text-sm text-slate-700"
                                rows="3"
                                placeholder="Observaciones, horarios de entrega, etc..."
                            />
                        </div>
                    </div>
                </form>

                <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 rounded-b-2xl sticky bottom-0 z-10">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 font-bold rounded-xl transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
                    >
                        <CheckCircle size={18} />
                        {loading ? 'Guardando...' : 'Guardar Proveedor'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Suppliers;
