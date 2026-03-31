import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Search, Plus, Save } from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import printerService from '../../services/printerService';
import { useConfig } from '../../context/ConfigContext';
import QuickCustomerModal from '../../components/pos/QuickCustomerModal';

const DEVICE_TYPES = [
    { id: 'SMARTPHONE', label: 'Celular', icon: '📱' },
    { id: 'TABLET', label: 'Tablet', icon: '📱' },
    { id: 'LAPTOP', label: 'Laptop', icon: '💻' },
    { id: 'OTHER', label: 'Otro', icon: '🖥️' },
];

const PHYSICAL_CONDITIONS = [
    { id: 'EXCELLENT', label: 'Excelente', stars: 5 },
    { id: 'GOOD', label: 'Bueno', stars: 4 },
    { id: 'FAIR', label: 'Regular', stars: 3 },
    { id: 'POOR', label: 'Pobre', stars: 1 },
];

const COMMON_ISSUES = [
    'Cambio de pantalla',
    'Batería muerta',
    'No enciende',
    'Se apaga solo',
    'Lento/Lag',
    'Botones rotos',
    'Agua/Humedad',
    'Otro problema',
];

const ServiceOrderWizard = ({ isOpen, onClose, onSuccess }) => {
    const { business } = useConfig();
    const paperWidth = business?.paper_width || '80';
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [isQuickCustomerOpen, setIsQuickCustomerOpen] = useState(false);

    // Warranty policies
    const [warrantyPolicies, setWarrantyPolicies] = useState([]);
    const [selectedWarrantyId, setSelectedWarrantyId] = useState('');

    // Search
    const [customers, setCustomers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showResults, setShowResults] = useState(false);

    // Form data
    const [formData, setFormData] = useState({
        customer: null,
        device_type: 'SMARTPHONE',
        brand: '',
        model: '',
        serial_imei: '',
        passcode_pattern: '',
        passcode_enabled: false,
        problem_description: '',
        physical_condition: 'GOOD',
    });

    // Load warranties
    useEffect(() => {
        if (isOpen) {
            apiClient.get('/warranties/policies').then(res => {
                setWarrantyPolicies(res.data || []);
                const def = (res.data || []).find(p => p.is_default);
                if (def) setSelectedWarrantyId(String(def.id));
            }).catch(() => {});
        }
    }, [isOpen]);

    // Customer search
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.length > 2) {
                try {
                    const res = await apiClient.get(`/customers/?q=${searchTerm}`);
                    setCustomers(res.data.items || []);
                    setShowResults(true);
                } catch (error) {
                    console.error("Error searching customers:", error);
                }
            } else {
                setCustomers([]);
                setShowResults(false);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    const handleCustomerSelect = (customer) => {
        setFormData(prev => ({ ...prev, customer }));
        setSearchTerm(`${customer.name} (${customer.id_number || 'N/A'})`);
        setShowResults(false);
    };

    const handleNextStep = () => {
        // Validaciones por paso
        if (currentStep === 0 && !formData.customer) {
            toast.error('Selecciona un cliente');
            return;
        }
        if (currentStep === 1 && (!formData.brand || !formData.model)) {
            toast.error('Marca y Modelo son obligatorios');
            return;
        }
        if (currentStep === 2 && !formData.problem_description) {
            toast.error('Describe el problema');
            return;
        }
        setCurrentStep(prev => prev + 1);
    };

    const handlePrevStep = () => {
        setCurrentStep(prev => prev - 1);
    };

    const handleSubmit = async () => {
        if (!formData.customer) {
            toast.error('Falta seleccionar cliente');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                customer_id: formData.customer.id,
                service_type: 'REPAIR',
                device_type: formData.device_type,
                brand: formData.brand,
                model: formData.model,
                serial_imei: formData.serial_imei,
                passcode_pattern: formData.passcode_enabled ? formData.passcode_pattern : null,
                problem_description: formData.problem_description,
                physical_condition: formData.physical_condition,
                warranty_policy_id: selectedWarrantyId ? parseInt(selectedWarrantyId) : null,
                items: [],
                payments: [],
            };

            const res = await apiClient.post('/services/orders', payload);
            toast.success(`Orden ${res.data.ticket_number} creada`);

            // Auto-print
            try {
                const printRes = await apiClient.get(`/services/orders/${res.data.id}/print/thermal?width=${paperWidth}`);
                await printerService.printRaw(printRes.data);
            } catch (printErr) {
                console.warn('Print error:', printErr);
                toast('Ticket no impreso', { icon: '🖨️' });
            }

            // Reset
            setCurrentStep(0);
            setFormData({
                customer: null,
                device_type: 'SMARTPHONE',
                brand: '',
                model: '',
                serial_imei: '',
                passcode_pattern: '',
                passcode_enabled: false,
                problem_description: '',
                physical_condition: 'GOOD',
            });
            setSearchTerm('');

            if (onSuccess) onSuccess(res.data);
            onClose();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Error al crear orden');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const steps = ['CLIENTE', 'EQUIPO', 'DIAGNÓSTICO', 'CONFIRMACIÓN'];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 border-b">
                    <h2 className="text-2xl font-bold mb-2">Crear Orden de Servicio</h2>
                    <div className="flex gap-2">
                        {steps.map((step, idx) => (
                            <div key={step} className="flex items-center">
                                <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm
                                        ${idx <= currentStep
                                            ? 'bg-white text-blue-600'
                                            : 'bg-blue-400 text-white'
                                        }`}
                                >
                                    {idx < currentStep ? '✓' : idx + 1}
                                </div>
                                {idx < steps.length - 1 && (
                                    <div className={`w-8 h-0.5 ${idx < currentStep ? 'bg-white' : 'bg-blue-400'}`} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="p-8">
                    {/* PASO 1: CLIENTE */}
                    {currentStep === 0 && (
                        <div className="space-y-6">
                            <h3 className="text-xl font-bold text-gray-800">Paso 1 de 4: CLIENTE</h3>
                            <p className="text-gray-600">¿Cuál es el cliente?</p>

                            {/* Búsqueda */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Buscar cliente existente *
                                </label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Nombre o Cédula..."
                                        className="w-full pl-10 pr-4 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>

                                {showResults && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border-2 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                        {customers.map(c => (
                                            <div
                                                key={c.id}
                                                onClick={() => handleCustomerSelect(c)}
                                                className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-0"
                                            >
                                                <div className="font-semibold text-gray-800">{c.name}</div>
                                                <div className="text-xs text-gray-500">ID: {c.id_number} • Tel: {c.phone || 'N/A'}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {formData.customer && (
                                <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                                    <p className="font-semibold text-blue-900">Cliente seleccionado:</p>
                                    <p className="text-blue-800">{formData.customer.name}</p>
                                    <p className="text-sm text-blue-600">Tel: {formData.customer.phone || 'Sin teléfono'}</p>
                                </div>
                            )}

                            {/* O crear nuevo */}
                            <div className="border-t pt-6">
                                <button
                                    onClick={() => setIsQuickCustomerOpen(true)}
                                    className="w-full py-3 bg-indigo-50 text-indigo-600 rounded-lg font-semibold hover:bg-indigo-100 flex items-center justify-center gap-2 transition-colors"
                                >
                                    <Plus size={18} /> O crear nuevo cliente
                                </button>
                            </div>
                        </div>
                    )}

                    {/* PASO 2: EQUIPO */}
                    {currentStep === 1 && (
                        <div className="space-y-6">
                            <h3 className="text-xl font-bold text-gray-800">Paso 2 de 4: EQUIPO</h3>
                            <p className="text-gray-600">¿Qué dispositivo se llevó?</p>

                            {/* Tipo de dispositivo */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-3">Tipo de Dispositivo</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {DEVICE_TYPES.map(dt => (
                                        <button
                                            key={dt.id}
                                            onClick={() => setFormData(prev => ({ ...prev, device_type: dt.id }))}
                                            className={`p-4 rounded-lg border-2 font-semibold transition-all
                                                ${formData.device_type === dt.id
                                                    ? 'bg-purple-100 border-purple-500 text-purple-700'
                                                    : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
                                                }`}
                                        >
                                            <div className="text-2xl mb-1">{dt.icon}</div>
                                            {dt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Marca y Modelo */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Marca *</label>
                                    <input
                                        type="text"
                                        value={formData.brand}
                                        onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                                        placeholder="Ej: Samsung"
                                        className="w-full p-2 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Modelo *</label>
                                    <input
                                        type="text"
                                        value={formData.model}
                                        onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                                        placeholder="Ej: A52"
                                        className="w-full p-2 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Serial */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Serial / IMEI (Opcional)</label>
                                <input
                                    type="text"
                                    value={formData.serial_imei}
                                    onChange={(e) => setFormData(prev => ({ ...prev, serial_imei: e.target.value }))}
                                    placeholder="IMEI o Serial"
                                    className="w-full p-2 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm"
                                />
                            </div>

                            {/* Patrón de desbloqueo */}
                            <div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.passcode_enabled}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            passcode_enabled: e.target.checked
                                        }))}
                                        className="w-5 h-5"
                                    />
                                    <span className="font-semibold text-gray-700">¿Tiene patrón de desbloqueo?</span>
                                </label>
                                {formData.passcode_enabled && (
                                    <input
                                        type="text"
                                        value={formData.passcode_pattern}
                                        onChange={(e) => setFormData(prev => ({ ...prev, passcode_pattern: e.target.value }))}
                                        placeholder="Ej: 1-2-3-4 o L desde arriba izq"
                                        className="w-full mt-2 p-2 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                    />
                                )}
                            </div>

                            {/* Estado Físico */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-3">Estado Físico del Equipo</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {PHYSICAL_CONDITIONS.map(pc => (
                                        <button
                                            key={pc.id}
                                            onClick={() => setFormData(prev => ({ ...prev, physical_condition: pc.id }))}
                                            className={`p-3 rounded-lg border-2 font-semibold transition-all text-center
                                                ${formData.physical_condition === pc.id
                                                    ? 'bg-amber-100 border-amber-500 text-amber-700'
                                                    : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
                                                }`}
                                        >
                                            {'⭐'.repeat(pc.stars)}
                                            <div className="text-sm mt-1">{pc.label}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PASO 3: DIAGNÓSTICO */}
                    {currentStep === 2 && (
                        <div className="space-y-6">
                            <h3 className="text-xl font-bold text-gray-800">Paso 3 de 4: DIAGNÓSTICO</h3>
                            <p className="text-gray-600">¿Cuál es el problema reportado?</p>

                            {/* Descripción */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Descripción del Problema *</label>
                                <textarea
                                    value={formData.problem_description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, problem_description: e.target.value }))}
                                    rows={4}
                                    placeholder="El cliente reporta que..."
                                    className="w-full p-3 border-2 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none resize-none"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    {formData.problem_description.length}/500
                                </p>
                            </div>

                            {/* Plantillas */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-3">O seleccionar de una plantilla:</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {COMMON_ISSUES.map(issue => (
                                        <button
                                            key={issue}
                                            onClick={() => setFormData(prev => ({
                                                ...prev,
                                                problem_description: issue
                                            }))}
                                            className="p-2 rounded-lg bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 text-sm text-gray-700 hover:text-blue-700 transition-all"
                                        >
                                            {issue}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Garantía */}
                            {warrantyPolicies.length > 0 && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Política de Garantía</label>
                                    <select
                                        value={selectedWarrantyId}
                                        onChange={(e) => setSelectedWarrantyId(e.target.value)}
                                        className="w-full p-2 border-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                    >
                                        <option value="">— Sin garantía —</option>
                                        {warrantyPolicies.map(p => (
                                            <option key={p.id} value={String(p.id)}>
                                                {p.name}{p.is_default ? ' (predeterminada)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}

                    {/* PASO 4: CONFIRMACIÓN */}
                    {currentStep === 3 && (
                        <div className="space-y-6">
                            <h3 className="text-xl font-bold text-gray-800">Paso 4 de 4: CONFIRMACIÓN</h3>
                            <p className="text-gray-600 mb-6">Revisa los datos antes de crear la orden</p>

                            {/* Resumen Cliente */}
                            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                                <h4 className="font-bold text-blue-900 mb-2">👤 CLIENTE</h4>
                                <p className="text-blue-800">{formData.customer?.name}</p>
                                <p className="text-sm text-blue-600">Tel: {formData.customer?.phone || 'N/A'}</p>
                            </div>

                            {/* Resumen Equipo */}
                            <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
                                <h4 className="font-bold text-purple-900 mb-2">📱 EQUIPO</h4>
                                <p className="text-purple-800">{formData.brand} {formData.model}</p>
                                {formData.serial_imei && (
                                    <p className="text-sm text-purple-600 font-mono">Serial: {formData.serial_imei}</p>
                                )}
                                <p className="text-sm text-purple-600">Estado: {PHYSICAL_CONDITIONS.find(pc => pc.id === formData.physical_condition)?.label}</p>
                            </div>

                            {/* Resumen Problema */}
                            <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
                                <h4 className="font-bold text-orange-900 mb-2">⚠️ PROBLEMA REPORTADO</h4>
                                <p className="text-orange-800">{formData.problem_description}</p>
                            </div>

                            {/* Resumen Garantía */}
                            {selectedWarrantyId && (
                                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                                    <h4 className="font-bold text-green-900 mb-2">🛡️ GARANTÍA</h4>
                                    <p className="text-green-800">
                                        {warrantyPolicies.find(p => String(p.id) === selectedWarrantyId)?.name}
                                    </p>
                                </div>
                            )}

                            <p className="text-sm text-gray-600">✓ Verifica los datos. Si hay cambios, usa "Atrás"</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t bg-gray-50 p-6 flex justify-between gap-4">
                    <button
                        onClick={currentStep === 0 ? onClose : handlePrevStep}
                        className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                    >
                        {currentStep === 0 ? 'Cancelar' : 'Atrás'}
                    </button>

                    {currentStep < 3 ? (
                        <button
                            onClick={handleNextStep}
                            className="px-8 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                            Siguiente <ChevronRight size={18} />
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="px-8 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            {loading ? 'Creando...' : (
                                <>
                                    <Save size={18} /> Crear orden
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            <QuickCustomerModal
                isOpen={isQuickCustomerOpen}
                onClose={() => setIsQuickCustomerOpen(false)}
                onSuccess={handleCustomerSelect}
            />
        </div>
    );
};

export default ServiceOrderWizard;
