import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Plus, Smartphone, Tablet, Monitor, Save, ShieldCheck } from 'lucide-react';
import apiClient from '../../../config/axios';
import { toast } from 'react-hot-toast';
import { useConfig } from '../../../context/ConfigContext';
import printerService from '../../../services/printerService';
import QuickCustomerModal from '../../../components/pos/QuickCustomerModal';

const DEVICE_TYPES = [
    { id: 'SMARTPHONE', label: 'Celular', icon: Smartphone },
    { id: 'TABLET', label: 'Tablet', icon: Tablet },
    { id: 'LAPTOP', label: 'Laptop', icon: Monitor },
    { id: 'OTHER', label: 'Otro', icon: Monitor },
];

const NewOrderModal = ({ isOpen, onClose, onCreated }) => {
    const { business } = useConfig();
    const paperWidth = business?.paper_width || '80';
    const [loading, setLoading] = useState(false);

    // Customer Search
    const [customers, setCustomers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [showResults, setShowResults] = useState(false);

    // Quick Customer Modal
    const [isQuickCustomerModalOpen, setIsQuickCustomerModalOpen] = useState(false);

    // Warranty Policies
    const [warrantyPolicies, setWarrantyPolicies] = useState([]);
    const [selectedWarrantyId, setSelectedWarrantyId] = useState('');

    // Form Data
    const [formData, setFormData] = useState({
        device_type: 'SMARTPHONE',
        brand: '',
        model: '',
        serial_imei: '',
        passcode_pattern: '',
        problem_description: '',
        physical_condition: '',
    });

    // Load warranty policies on mount
    useEffect(() => {
        if (!isOpen) return;
        apiClient.get('/warranties/policies').then(res => {
            setWarrantyPolicies(res.data || []);
            const def = (res.data || []).find(p => p.is_default);
            if (def) setSelectedWarrantyId(String(def.id));
        }).catch(() => {});
    }, [isOpen]);

    // Search Customers (debounced 400ms)
    useEffect(() => {
        if (!isOpen) return;
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.length > 2) {
                try {
                    const res = await apiClient.get(`/customers/?q=${searchTerm}`);
                    setCustomers(res.data.items || []);
                    setShowResults(true);
                } catch (error) {
                    console.error('Error searching customers:', error);
                }
            } else {
                setCustomers([]);
                setShowResults(false);
            }
        }, 400);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, isOpen]);

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setFormData({
                device_type: 'SMARTPHONE',
                brand: '',
                model: '',
                serial_imei: '',
                passcode_pattern: '',
                problem_description: '',
                physical_condition: '',
            });
            setSelectedCustomer(null);
            setSearchTerm('');
            setCustomers([]);
            setShowResults(false);
            setSelectedWarrantyId('');
        }
    }, [isOpen]);

    const handleCustomerSelect = (customer) => {
        setSelectedCustomer(customer);
        setSearchTerm(`${customer.name} (${customer.id_number || 'N/A'})`);
        setShowResults(false);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedCustomer) {
            toast.error('Debe seleccionar un cliente.');
            return;
        }
        if (!formData.brand || !formData.model || !formData.problem_description) {
            toast.error('Complete los campos obligatorios (*).');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                customer_id: selectedCustomer.id,
                service_type: 'REPAIR',
                ...formData,
                warranty_policy_id: selectedWarrantyId ? parseInt(selectedWarrantyId) : null,
                items: [],
                payments: [],
            };

            const res = await apiClient.post('/services/orders', payload);
            toast.success(`Orden ${res.data.ticket_number} creada exitosamente!`);

            // Auto-print reception ticket (non-blocking)
            apiClient.get(`/services/orders/${res.data.id}/print/thermal?width=${paperWidth}`)
                .then(printRes => printerService.printRaw(printRes.data))
                .catch(() => toast('Sin impresora conectada', { icon: '🖨️' }));

            onCreated(res.data);
            onClose();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Error al crear la orden.');
        } finally {
            setLoading(false);
        }
    };

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 sm:inset-auto sm:relative bg-white sm:rounded-2xl sm:max-w-2xl sm:w-full sm:mx-4 sm:max-h-[90vh] flex flex-col shadow-2xl z-10">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Nueva Orden de Servicio</h2>
                        <p className="text-sm text-gray-500">Recepcion de equipo</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body — scrollable */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                    {/* Customer Search */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between items-center">
                            <span>Cliente *</span>
                            <button
                                type="button"
                                onClick={() => setIsQuickCustomerModalOpen(true)}
                                className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100 font-bold flex items-center gap-1"
                            >
                                <Plus size={14} /> Nuevo
                            </button>
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Nombre o Cedula..."
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setSelectedCustomer(null); }}
                            />

                            {showResults && (
                                <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                    {customers.map(c => (
                                        <div
                                            key={c.id}
                                            onClick={() => handleCustomerSelect(c)}
                                            className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-0"
                                        >
                                            <div className="font-medium text-gray-800 text-sm">{c.name}</div>
                                            <div className="text-xs text-gray-500">ID: {c.id_number} | Tel: {c.phone || 'N/A'}</div>
                                        </div>
                                    ))}
                                    {customers.length === 0 && (
                                        <div className="p-3 text-sm text-gray-500 text-center">No encontrado</div>
                                    )}
                                </div>
                            )}
                        </div>

                        {selectedCustomer && (
                            <div className="mt-2 p-2.5 bg-blue-50 rounded-lg text-sm text-blue-800 border border-blue-100 flex items-center justify-between">
                                <span><strong>{selectedCustomer.name}</strong> — Tel: {selectedCustomer.phone || 'N/A'}</span>
                                <button
                                    type="button"
                                    onClick={() => { setSelectedCustomer(null); setSearchTerm(''); }}
                                    className="text-blue-400 hover:text-blue-600"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Device Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Dispositivo</label>
                        <div className="grid grid-cols-4 gap-2">
                            {DEVICE_TYPES.map(vt => (
                                <button
                                    key={vt.id}
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, device_type: vt.id }))}
                                    className={`p-2 text-sm rounded-lg border flex flex-col items-center gap-1 transition-all
                                        ${formData.device_type === vt.id
                                            ? 'bg-purple-50 border-purple-500 text-purple-700 ring-1 ring-purple-500'
                                            : 'hover:bg-gray-50 border-gray-300 text-gray-600'
                                        }`}
                                >
                                    <vt.icon size={18} />
                                    {vt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Brand & Model */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Marca *</label>
                            <input
                                name="brand"
                                value={formData.brand}
                                onChange={handleInputChange}
                                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                placeholder="Ej: Samsung"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Modelo *</label>
                            <input
                                name="model"
                                value={formData.model}
                                onChange={handleInputChange}
                                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                placeholder="Ej: A52"
                                required
                            />
                        </div>
                    </div>

                    {/* Serial / IMEI */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Serial / IMEI (Opcional)</label>
                        <input
                            name="serial_imei"
                            value={formData.serial_imei}
                            onChange={handleInputChange}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm"
                            placeholder="Ingrese Serial o IMEI"
                        />
                    </div>

                    {/* Problem Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion del Problema *</label>
                        <textarea
                            name="problem_description"
                            value={formData.problem_description}
                            onChange={handleInputChange}
                            rows={3}
                            className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none resize-none"
                            placeholder="Ej: No carga, se calienta mucho..."
                            required
                        />
                    </div>

                    {/* Physical Condition */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Estado Fisico del Equipo</label>
                        <textarea
                            name="physical_condition"
                            value={formData.physical_condition}
                            onChange={handleInputChange}
                            rows={2}
                            className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none resize-none text-sm"
                            placeholder="Ej: Pantalla estrellada, rayones..."
                        />
                    </div>

                    {/* Passcode / PIN */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Patron de Desbloqueo / PIN</label>
                        <input
                            name="passcode_pattern"
                            value={formData.passcode_pattern}
                            onChange={handleInputChange}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                            placeholder="Ej: 1234 o 'L' desde arriba izq"
                        />
                        <p className="text-xs text-gray-500 mt-1">Indispensable para pruebas del equipo.</p>
                    </div>

                    {/* Warranty Policy */}
                    {warrantyPolicies.length > 0 && (
                        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                            <h3 className="font-semibold text-indigo-800 flex items-center gap-2 mb-2 text-sm">
                                <ShieldCheck size={16} className="text-indigo-600" />
                                Politica de Garantia
                            </h3>
                            <select
                                value={selectedWarrantyId}
                                onChange={e => setSelectedWarrantyId(e.target.value)}
                                className="w-full p-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm"
                            >
                                <option value="">— Sin garantia —</option>
                                {warrantyPolicies.map(p => (
                                    <option key={p.id} value={String(p.id)}>
                                        {p.name}{p.is_default ? ' (predeterminada)' : ''}
                                        {p.duration ? ` — ${p.duration} ${p.type === 'DAYS' ? 'dias' : p.type === 'MONTHS' ? 'meses' : 'anos'}` : p.type === 'LIFETIME' ? ' — Vitalicia' : ''}
                                    </option>
                                ))}
                            </select>
                            {selectedWarrantyId && (
                                <p className="text-xs text-indigo-600 mt-1 flex items-center gap-1">
                                    <ShieldCheck size={12} />
                                    Se imprimira en el ticket del cliente
                                </p>
                            )}
                        </div>
                    )}
                </form>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        onClick={handleSubmit}
                        className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-200 flex items-center gap-2 disabled:opacity-50 transition-all"
                    >
                        {loading ? 'Procesando...' : (
                            <>
                                <Save size={18} />
                                Generar Orden
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Quick Customer Modal */}
            <QuickCustomerModal
                isOpen={isQuickCustomerModalOpen}
                onClose={() => setIsQuickCustomerModalOpen(false)}
                onSuccess={handleCustomerSelect}
            />
        </div>,
        document.body
    );
};

export default NewOrderModal;
