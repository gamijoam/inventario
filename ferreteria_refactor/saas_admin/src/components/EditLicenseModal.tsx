import React, { useState, useEffect } from 'react';
import { X, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { updateLicense } from '../api/desktopLicenses';
import type { DesktopLicense, UpdateLicenseDTO } from '../api/desktopLicenses';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    license: DesktopLicense | null;
}

const EditLicenseModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, license }) => {
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState<UpdateLicenseDTO>({});

    useEffect(() => {
        if (license) {
            setForm({
                customer_name: license.customer_name || '',
                customer_email: license.customer_email || '',
                plan_name: license.plan_name,
                has_restaurant_module: license.has_restaurant_module,
                has_laundry_module: license.has_laundry_module,
                has_hardware_module: license.has_hardware_module,
                has_services_module: license.has_services_module,
                has_barbershop_module: license.has_barbershop_module,
                max_devices: license.max_devices,
                expires_at: license.expires_at || null,
                is_active: license.is_active,
                notes: license.notes || '',
            });
        }
    }, [license]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!license) return;
        setLoading(true);
        try {
            const payload: UpdateLicenseDTO = {
                ...form,
                customer_email: (form.customer_email as string)?.trim() || undefined,
                notes: (form.notes as string)?.trim() || undefined,
                expires_at: form.expires_at || null,
            };
            await updateLicense(license.id, payload);
            toast.success('Licencia actualizada');
            onSuccess();
            onClose();
        } catch (err: any) {
            toast.error(err.response?.data?.detail || 'Error al actualizar');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !license) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <Pencil className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Editar Licencia</h2>
                            <p className="text-xs font-mono text-gray-400">{license.license_key}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del cliente</label>
                            <input
                                type="text"
                                value={(form.customer_name as string) || ''}
                                onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email del cliente</label>
                            <input
                                type="email"
                                value={(form.customer_email as string) || ''}
                                onChange={e => setForm(f => ({ ...f, customer_email: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>
                    </div>

                    {/* Módulos */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Módulos habilitados</label>
                        <div className="grid grid-cols-2 gap-2">
                            {([
                                ['has_hardware_module',   '🖨️ Hardware/Impresoras'],
                                ['has_restaurant_module', '🍽️ Restaurante'],
                                ['has_barbershop_module', '✂️ Barbería'],
                                ['has_laundry_module',    '👕 Lavandería'],
                                ['has_services_module',   '🔧 Servicios Técnicos'],
                            ] as [keyof UpdateLicenseDTO, string][]).map(([key, label]) => (
                                <label key={key} className={`flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer text-sm transition-colors ${
                                    form[key]
                                        ? 'border-green-400 bg-green-50 text-green-700'
                                        : 'border-gray-200 text-gray-500'
                                }`}>
                                    <input
                                        type="checkbox"
                                        checked={!!form[key]}
                                        onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                                        className="w-4 h-4 accent-green-600"
                                    />
                                    {label}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Máx. dispositivos</label>
                            <input
                                type="number"
                                min={1}
                                max={20}
                                value={form.max_devices as number || 1}
                                onChange={e => setForm(f => ({ ...f, max_devices: parseInt(e.target.value) || 1 }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Vence el <span className="text-gray-400 font-normal">(vacío = perpetua)</span>
                            </label>
                            <input
                                type="date"
                                value={form.expires_at ? (form.expires_at as string).slice(0, 10) : ''}
                                onChange={e => setForm(f => ({ ...f, expires_at: e.target.value ? `${e.target.value}T23:59:59` : null }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>
                    </div>

                    {/* Estado */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                            <p className="text-sm font-medium text-gray-700">Estado de la licencia</p>
                            <p className="text-xs text-gray-500">Desactivar bloquea la activación y el login</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                form.is_active ? 'bg-green-500' : 'bg-gray-300'
                            }`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
                                form.is_active ? 'translate-x-6' : 'translate-x-1'
                            }`} />
                        </button>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notas internas</label>
                        <textarea
                            rows={2}
                            value={(form.notes as string) || ''}
                            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 text-sm font-medium transition-colors"
                        >
                            {loading ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditLicenseModal;
