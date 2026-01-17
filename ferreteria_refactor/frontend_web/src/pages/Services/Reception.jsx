import React, { useState, useEffect } from 'react';
import {
    Users, Smartphone, Tablet, Monitor, Save,
    Search, Plus, CheckCircle, AlertTriangle
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';

const DEVICE_TYPES = [
    { id: 'SMARTPHONE', label: 'Celular', icon: Smartphone },
    { id: 'TABLET', label: 'Tablet', icon: Tablet },
    { id: 'LAPTOP', label: 'Laptop', icon: Monitor },
    { id: 'OTHER', label: 'Otro', icon: Monitor },
];

const Reception = () => {
    const [loading, setLoading] = useState(false);
    const [ticketNumber, setTicketNumber] = useState(null);

    // Customer Search
    const [customers, setCustomers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [showResults, setShowResults] = useState(false);

    // Form Data
    const [formData, setFormData] = useState({
        device_type: 'SMARTPHONE',
        brand: '',
        model: '',
        serial_imei: '',
        passcode_pattern: '',
        problem_description: '',
        physical_condition: '',
        diagnosis_notes: '',
    });

    // Search Customers
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.length > 2) {
                try {
                    const res = await apiClient.get(`/customers/?search=${searchTerm}`);
                    setCustomers(res.data);
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
                ...formData
            };

            const res = await apiClient.post('/services/orders', payload);
            setTicketNumber(res.data.ticket_number);
            toast.success(`Orden ${res.data.ticket_number} creada exitosamente!`);

            // Optional: Prompt print
            if (window.confirm(`Orden Creada: ${res.data.ticket_number}\n¿Desea imprimir el recibo de recepción?`)) {
                // TODO: Call printer service
                toast("Impresión enviada (Simulación)");
            }

            // Reset form
            setFormData({
                device_type: 'SMARTPHONE',
                brand: '',
                model: '',
                serial_imei: '',
                passcode_pattern: '',
                problem_description: '',
                physical_condition: '',
                diagnosis_notes: '',
            });
            setSelectedCustomer(null);
            setSearchTerm('');

        } catch (error) {
            console.error("Error creating order:", error);
            toast.error('Error al crear la orden. Verifique los datos.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Recepción de Equipos</h1>
                    <p className="text-gray-500">Crear nueva Orden de Servicio</p>
                </div>
                {ticketNumber && (
                    <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg font-mono font-bold flex items-center gap-2">
                        <CheckCircle size={20} />
                        Último Ticket: {ticketNumber}
                    </div>
                )}
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* COLUMNA 1: CLIENTE & EQUIPO */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Card Cliente */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Users className="text-blue-600" size={20} />
                            Datos del Cliente
                        </h2>

                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Cliente *</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Nombre o Cédula..."
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            {/* Resultados de Búsqueda */}
                            {showResults && (
                                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                    {customers.map(c => (
                                        <div
                                            key={c.id}
                                            onClick={() => handleCustomerSelect(c)}
                                            className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-0"
                                        >
                                            <div className="font-medium text-gray-800">{c.name}</div>
                                            <div className="text-xs text-gray-500">ID: {c.id_number}</div>
                                        </div>
                                    ))}
                                    {customers.length === 0 && (
                                        <div className="p-3 text-sm text-gray-500 text-center">No encontrado</div>
                                    )}
                                </div>
                            )}
                        </div>

                        {selectedCustomer && (
                            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800 border border-blue-100">
                                <p><strong>Cliente Seleccionado:</strong></p>
                                <p>{selectedCustomer.name}</p>
                                <p>Tel: {selectedCustomer.phone || 'Sin teléfono'}</p>
                            </div>
                        )}
                    </div>

                    {/* Card Equipo */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Smartphone className="text-purple-600" size={20} />
                            Datos del Equipo
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Dispositivo</label>
                                <div className="grid grid-cols-2 gap-2">
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

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Serial / IMEI (Opcional)</label>
                                <input
                                    name="serial_imei"
                                    value={formData.serial_imei}
                                    onChange={handleInputChange}
                                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm"
                                    placeholder="Ingrese Serial (Opcional)"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* COLUMNA 2: ESTADO Y FALLA (Más ancha) */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-full">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <AlertTriangle className="text-orange-600" size={20} />
                            Diagnóstico Inicial
                        </h2>

                        <div className="space-y-6">

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Descripción del Problema (Falla Reportada) *
                                </label>
                                <textarea
                                    name="problem_description"
                                    value={formData.problem_description}
                                    onChange={handleInputChange}
                                    rows={4}
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none resize-none"
                                    placeholder="Ej: El cliente reporta que no carga y se calienta mucho..."
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Patrón de Desbloqueo / PIN
                                    </label>
                                    <input
                                        name="passcode_pattern"
                                        value={formData.passcode_pattern}
                                        onChange={handleInputChange}
                                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                        placeholder="Ej: 1234 o 'L' desde arriba izq"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Indispensable para pruebas.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Estado Físico del Equipo
                                    </label>
                                    <textarea
                                        name="physical_condition"
                                        value={formData.physical_condition}
                                        onChange={handleInputChange}
                                        rows={3}
                                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                                        placeholder="Ej: Pantalla estrellada, rayones en tapa trasera..."
                                    />
                                </div>
                            </div>

                            <div className="border-t pt-6 mt-6 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-blue-200 flex items-center gap-2 disabled:opacity-50 transition-all"
                                >
                                    {loading ? 'Procesando...' : (
                                        <>
                                            <Save size={20} />
                                            Generar Orden de Servicio
                                        </>
                                    )}
                                </button>
                            </div>

                        </div>
                    </div>
                </div>

            </form>
        </div>
    );
};

export default Reception;
