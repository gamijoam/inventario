import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ShieldCheck, Check, Clock, Info } from 'lucide-react';
import apiClient from '../../../config/axios';
import clsx from 'clsx';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
} from '../../../components/ui/sheet';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { toast } from 'react-hot-toast';
import WarrantyTemplateSelector from './WarrantyTemplateSelector';

const GarantiasConfigTab = () => {
    const [policies, setPolicies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingPolicy, setEditingPolicy] = useState(null);

    useEffect(() => {
        fetchPolicies();
    }, []);

    const fetchPolicies = async () => {
        try {
            const response = await apiClient.get('/warranties/policies');
            setPolicies(response.data);
        } catch (error) {
            console.error('Error fetching policies:', error);
            toast.error('Error al cargar las políticas de garantía');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`¿Eliminar la política "${name}"?`)) return;

        try {
            await apiClient.delete(`/warranties/policies/${id}`);
            toast.success('Política eliminada');
            fetchPolicies();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Error al eliminar política');
        }
    };

    const openCreateModal = () => {
        setEditingPolicy(null);
        setShowModal(true);
    };

    const openEditModal = (policy) => {
        setEditingPolicy(policy);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingPolicy(null);
    };

    const handleSuccess = () => {
        fetchPolicies();
        closeModal();
    };

    if (loading) return (
        <div className="p-12 text-center">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400">Cargando políticas de garantía...</p>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Selector visual de plantilla de PDF */}
            <WarrantyTemplateSelector />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <p className="text-slate-500 text-sm mt-1">Define las condiciones de garantía que aplicarán a tus productos.</p>
                </div>
                <Button onClick={openCreateModal} className="shadow-lg shadow-indigo-100">
                    <Plus size={18} />
                    Nueva Política
                </Button>
            </div>

            {/* Policies Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {policies.map((policy) => (
                    <div
                        key={policy.id}
                        className={clsx(
                            "bg-white rounded-2xl p-6 border transition-all hover:shadow-md group",
                            policy.is_active ? "border-slate-200" : "border-slate-100 opacity-60"
                        )}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className={clsx(
                                "p-3 rounded-xl",
                                policy.is_active ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-400"
                            )}>
                                <ShieldCheck size={24} />
                            </div>
                            <div className="flex gap-1 group-hover:opacity-100 opacity-0 transition-opacity">
                                <button
                                    onClick={() => openEditModal(policy)}
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="Editar"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    onClick={() => handleDelete(policy.id, policy.name)}
                                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                    title="Eliminar"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-slate-800">{policy.name}</h3>
                                {policy.is_default && (
                                    <span className="bg-amber-50 text-amber-600 text-[10px] px-2 py-0.5 rounded-full font-black border border-amber-100">
                                        DEFAULT
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-slate-500 line-clamp-2 h-10">
                                {policy.description || <span className="italic opacity-50">Sin descripción facilitada.</span>}
                            </p>
                        </div>

                        <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
                            <div className="flex items-center text-indigo-600 font-bold">
                                <Clock size={16} className="mr-2" />
                                <span>
                                    {policy.type === 'LIFETIME'
                                        ? 'De por vida'
                                        : `${policy.duration} ${policy.type === 'DAYS' ? 'Días' :
                                            policy.type === 'MONTHS' ? 'Meses' : 'Años'
                                        }`
                                    }
                                </span>
                            </div>
                            <span className={clsx(
                                "text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider",
                                policy.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                            )}>
                                {policy.is_active ? 'Activa' : 'Inactiva'}
                            </span>
                        </div>
                    </div>
                ))}

                {policies.length === 0 && (
                    <div className="col-span-full py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 text-center px-6">
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                            <ShieldCheck size={32} className="opacity-20" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-600 mb-1">No hay políticas configuradas</h3>
                        <p className="max-w-xs text-sm">Crea tu primera política de garantía para empezar a proteger las compras de tus clientes.</p>
                        <Button variant="outline" onClick={openCreateModal} className="mt-6">
                            Crear Política Ahora
                        </Button>
                    </div>
                )}
            </div>

            {showModal && (
                <PolicyModal
                    policy={editingPolicy}
                    onClose={closeModal}
                    onSuccess={handleSuccess}
                />
            )}
        </div>
    );
};

const PolicyModal = ({ policy, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        name: policy?.name || '',
        type: policy?.type || 'DAYS',
        duration: policy?.duration || '',
        description: policy?.description || '',
        is_default: policy?.is_default || false,
        is_active: policy?.is_active ?? true
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                ...formData,
                duration: formData.type === 'LIFETIME' ? null : parseInt(formData.duration)
            };

            if (policy) {
                await apiClient.put(`/warranties/policies/${policy.id}`, payload);
                toast.success('Política actualizada');
            } else {
                await apiClient.post('/warranties/policies', payload);
                toast.success('Política creada exitosamente');
            }

            onSuccess();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Error al guardar política');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Sheet open={true} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <ShieldCheck size={20} />
                        </div>
                        {policy ? 'Editar Política' : 'Nueva Política'}
                    </SheetTitle>
                    <SheetDescription>
                        Configura las reglas de garantía para tus productos.
                    </SheetDescription>
                </SheetHeader>

                <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="policy-name">Nombre de la Política</Label>
                            <Input
                                id="policy-name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Ej. Garantía Estándar 30 días"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="policy-type">Unidad de Tiempo</Label>
                                <select
                                    id="policy-type"
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full h-11 px-4 rounded-xl border-2 border-slate-200 bg-white focus:border-indigo-500 outline-none font-bold text-sm"
                                >
                                    <option value="DAYS">Días</option>
                                    <option value="MONTHS">Meses</option>
                                    <option value="YEARS">Años</option>
                                    <option value="LIFETIME">De por vida</option>
                                </select>
                            </div>

                            {formData.type !== 'LIFETIME' && (
                                <div className="space-y-2">
                                    <Label htmlFor="policy-duration">Duración</Label>
                                    <Input
                                        id="policy-duration"
                                        type="number"
                                        min="1"
                                        value={formData.duration}
                                        onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                                        placeholder="Cantidad"
                                        required
                                    />
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="policy-description">Descripción / Condiciones</Label>
                            <Textarea
                                id="policy-description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Detalla qué cubre esta garantía..."
                                rows={4}
                            />
                        </div>

                        <div className="space-y-4 pt-4 border-t border-slate-100">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Política por Defecto</Label>
                                    <p className="text-xs text-slate-500">Se asignará automáticamente a nuevos productos.</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={formData.is_default}
                                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Estado Activo</Label>
                                    <p className="text-xs text-slate-500">Determina si la política puede ser seleccionada.</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        <div className="bg-blue-50 p-4 rounded-xl flex gap-3">
                            <Info size={20} className="text-blue-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-blue-700 leading-relaxed font-medium">
                                Los cambios en las políticas solo afectarán a los productos vinculados a partir de este momento. Reclamos existentes mantendrán las condiciones originales del momento de la venta.
                            </p>
                        </div>
                    </div>

                    <SheetFooter className="gap-3">
                        <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading} className="flex-1">
                            {loading ? 'Guardando...' : <><Check size={18} /> Guardar</>}
                        </Button>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    );
};

export default GarantiasConfigTab;
