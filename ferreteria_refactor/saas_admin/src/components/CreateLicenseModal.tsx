import React, { useState } from 'react';
import { X, Monitor } from 'lucide-react';
import toast from 'react-hot-toast';
import { createLicense } from '../api/desktopLicenses';
import type { CreateLicenseDTO } from '../api/desktopLicenses';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const PLANS = [
    { value: 'basic',      label: 'Básico (POS + Inventario)' },
    { value: 'restaurant', label: 'Restaurante' },
    { value: 'barbershop', label: 'Barbería / Estética' },
    { value: 'laundry',    label: 'Lavandería' },
    { value: 'full',       label: 'Full (todos los módulos)' },
];

const DEFAULT_MODULES_FOR_PLAN: Record<string, Partial<CreateLicenseDTO>> = {
    basic:      { has_hardware_module: true },
    restaurant: { has_restaurant_module: true, has_hardware_module: true },
    barbershop: { has_barbershop_module: true, has_hardware_module: true },
    laundry:    { has_laundry_module: true, has_hardware_module: true },
    full: {
        has_restaurant_module: true, has_laundry_module: true,
        has_hardware_module: true, has_services_module: true,
        has_barbershop_module: true,
    },
};

const CreateLicenseModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState<CreateLicenseDTO>({
        customer_name: '',
        customer_email: '',
        plan_name: 'basic',
        has_restaurant_module: false,
        has_laundry_module: false,
        has_hardware_module: true,
        has_services_module: false,
        has_barbershop_module: false,
        max_devices: 1,
        expires_at: null,
        notes: '',
    });

    const handlePlanChange = (plan: string) => {
        const defaults = DEFAULT_MODULES_FOR_PLAN[plan] || {};
        setForm(f => ({
            ...f,
            plan_name: plan,
            has_restaurant_module: false,
            has_laundry_module: false,
            has_hardware_module: false,
            has_services_module: false,
            has_barbershop_module: false,
            ...defaults,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.customer_name.trim()) {
            toast.error('El nombre del cliente es requerido');
            return;
        }
        setLoading(true);
        try {
            const payload: CreateLicenseDTO = {
                ...form,
                customer_email: form.customer_email?.trim() || undefined,
                notes: form.notes?.trim() || undefined,
                expires_at: form.expires_at || null,
            };
            await createLicense(payload);
            toast.success('Licencia creada correctamente');
            onSuccess();
            onClose();
            // Reset
            setForm({
                customer_name: '', customer_email: '', plan_name: 'basic',
                has_restaurant_module: false, has_laundry_module: false,
                has_hardware_module: true, has_services_module: false,
                has_barbershop_module: false, max_devices: 1, expires_at: null, notes: '',
            });
        } catch (err: any) {
            toast.error(err.response?.data?.detail || 'Error al crear licencia');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <Monitor className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Nueva Licencia Desktop</h2>
                            <p className="text-xs text-gray-500">La clave se genera automáticamente</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Cliente */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Nombre del cliente <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.customer_name}
                                onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                                placeholder="Ej: Ferretería González"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email del cliente</label>
                            <input
                                type="email"
                                value={form.customer_email || ''}
                                onChange={e => setForm(f => ({ ...f, customer_email: e.target.value }))}
                                placeholder="cliente@email.com"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    {/* Plan */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Plan</label>
                        <div className="grid grid-cols-2 gap-2">
                            {PLANS.map(p => (
                                <label key={p.value} className={`flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer text-sm transition-colors ${
                                    form.plan_name === p.value
                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                }`}>
                                    <input
                                        type="radio"
                                        name="plan"
                                        value={p.value}
                                        checked={form.plan_name === p.value}
                                        onChange={() => handlePlanChange(p.value)}
                                        className="sr-only"
                                    />
                                    {p.label}
                                </label>
                            ))}
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
                            ] as [keyof CreateLicenseDTO, string][]).map(([key, label]) => (
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

                    {/* Dispositivos y vencimiento */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Máx. dispositivos</label>
                            <input
                                type="number"
                                min={1}
                                max={20}
                                value={form.max_devices}
                                onChange={e => setForm(f => ({ ...f, max_devices: parseInt(e.target.value) || 1 }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Vence el <span className="text-gray-400 font-normal">(vacío = perpetua)</span>
                            </label>
                            <input
                                type="date"
                                value={form.expires_at ? form.expires_at.slice(0, 10) : ''}
                                onChange={e => setForm(f => ({ ...f, expires_at: e.target.value ? `${e.target.value}T23:59:59` : null }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    {/* Notas */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notas internas</label>
                        <textarea
                            rows={2}
                            value={form.notes || ''}
                            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                            placeholder="Referencia de pago, número de contrato, etc."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        />
                    </div>

                    {/* Footer */}
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
                            className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors"
                        >
                            {loading ? 'Creando...' : 'Crear Licencia'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateLicenseModal;
