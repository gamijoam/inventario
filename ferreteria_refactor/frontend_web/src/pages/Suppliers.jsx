import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Building2, Phone, Mail, Search, Truck, MapPin, FileText, Check, X, CreditCard, ChevronRight } from 'lucide-react';
import { useWebSocket } from '../context/WebSocketContext';
import { useAuth } from '../context/AuthContext';
import apiClient from '../config/axios';
import clsx from 'clsx';
import { toast } from 'react-hot-toast';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
} from '../components/ui/sheet';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';

const Suppliers = () => {
    const { subscribe } = useWebSocket();
    const { user } = useAuth();
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

    const handleCreate = () => {
        setEditingSupplier(null);
        setShowModal(true);
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
        <div className="p-6 max-w-[1600px] mx-auto min-h-screen flex flex-col space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
                        <Truck className="text-indigo-600" size={32} /> Proveedores
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Gestión de proveedores, contactos y términos de crédito</p>
                </div>
                {['ADMIN', 'WAREHOUSE'].includes(user?.role) && (
                    <Button id="tour-suppliers-add-btn" onClick={handleCreate}>
                        <Plus size={20} className="mr-2" />
                        Nuevo Proveedor
                    </Button>
                )}
            </div>

            {/* Search Bar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
                <div className="relative flex-1 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
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
                    <thead className="bg-slate-50/50 border-b border-slate-200">
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
                                <tr key={supplier.id} className={clsx("hover:bg-indigo-50/30 transition-colors", idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30')}>
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
                                        <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl text-xs font-bold">
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
                                            {['ADMIN', 'WAREHOUSE'].includes(user?.role) && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleEdit(supplier)}
                                                    className="h-8 w-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                                                >
                                                    <Edit2 size={16} />
                                                </Button>
                                            )}
                                            {user?.role === 'ADMIN' && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDelete(supplier.id, supplier.name)}
                                                    className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                                                >
                                                    <Trash2 size={16} />
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                {suppliers?.length === 0 && !loading && (
                    <tr>
                        <td colSpan="10" className="py-16 text-center">
                            <div className="flex flex-col items-center gap-2 text-slate-400">
                                <span className="text-4xl">🏭</span>
                                <p className="font-semibold text-slate-600">No hay proveedores registrados</p>
                                <p className="text-sm">Agrega tu primer proveedor para comenzar</p>
                            </div>
                        </td>
                    </tr>
                )}
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
                                {['ADMIN', 'WAREHOUSE'].includes(user?.role) && (
                                    <Button
                                        variant="outline"
                                        onClick={() => handleEdit(supplier)}
                                        className="flex-1 text-indigo-600 border-indigo-100 hover:bg-indigo-50"
                                    >
                                        <Edit2 size={16} className="mr-2" /> Editar
                                    </Button>
                                )}
                                {user?.role === 'ADMIN' && (
                                    <Button
                                        variant="outline"
                                        onClick={() => handleDelete(supplier.id, supplier.name)}
                                        className="flex-1 text-rose-600 border-rose-100 hover:bg-rose-50"
                                    >
                                        <Trash2 size={16} className="mr-2" /> Eliminar
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Sheet for Create/Edit */}
            <Sheet open={showModal} onOpenChange={setShowModal}>
                <SheetContent
                    side="right"
                    className="w-full sm:max-w-md flex flex-col"
                >
                    <SheetHeader>
                        <SheetTitle className="flex items-center gap-2">
                            <Truck className="text-indigo-600" size={24} />
                            {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                        </SheetTitle>
                        <SheetDescription>
                            {editingSupplier ? 'Modifica los datos del proveedor' : 'Registra un nuevo proveedor en el sistema'}
                        </SheetDescription>
                    </SheetHeader>

                    {showModal && (
                        <SupplierForm
                            supplier={editingSupplier}
                            onClose={handleModalClose}
                            onSuccess={handleSuccess}
                        />
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
};

// Extracted Form Component for cleanliness
const SupplierForm = ({ supplier, onClose, onSuccess }) => {
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
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">

                {/* Basic Info */}
                <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100">
                        Información General
                    </h4>

                    <div className="space-y-2">
                        <Label htmlFor="s-name">Nombre del Proveedor <span className="text-rose-500">*</span></Label>
                        <Input
                            id="s-name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Ej: Distribuidora Ferretera C.A."
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="s-contact">Persona de Contacto</Label>
                        <div className="relative">
                            <Input
                                id="s-contact"
                                value={formData.contact_person}
                                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                                placeholder="Nombre del Vendedor"
                                className="pl-10"
                            />
                            <Building2 className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="s-phone">Teléfono</Label>
                            <div className="relative">
                                <Input
                                    id="s-phone"
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="+58 ..."
                                    className="pl-10"
                                />
                                <Phone className="absolute left-3 top-2.5 text-slate-400" size={18} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="s-email">Email</Label>
                            <div className="relative">
                                <Input
                                    id="s-email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="contacto@..."
                                    className="pl-10"
                                />
                                <Mail className="absolute left-3 top-2.5 text-slate-400" size={18} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="s-address">Dirección Fiscal</Label>
                        <div className="relative">
                            <Textarea
                                id="s-address"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                placeholder="Dirección completa..."
                                className="pl-10 min-h-[80px]"
                            />
                            <MapPin className="absolute left-3 top-3 text-slate-400" size={18} />
                        </div>
                    </div>
                </div>

                {/* Financial Info */}
                <div className="space-y-4 pt-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
                        <CreditCard size={14} /> Información Financiera
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="s-terms">Términos (Días)</Label>
                            <Input
                                id="s-terms"
                                type="number"
                                value={formData.payment_terms}
                                onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                                min="0"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="s-credit">Límite ($)</Label>
                            <Input
                                id="s-credit"
                                type="number"
                                step="0.01"
                                value={formData.credit_limit}
                                onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                    <Label htmlFor="s-notes">Notas Adicionales</Label>
                    <Textarea
                        id="s-notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Observaciones, horarios de entrega, etc..."
                        rows={3}
                    />
                </div>
            </div>

            <SheetFooter className="gap-3 border-t border-slate-100 p-6 bg-slate-50/50">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    className="flex-1"
                >
                    Cancelar
                </Button>
                <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1"
                >
                    {loading ? 'Guardando...' : (
                        <>
                            <Check size={18} className="mr-2" />
                            Guardar
                        </>
                    )}
                </Button>
            </SheetFooter>
        </form>
    );
};

export default Suppliers;
