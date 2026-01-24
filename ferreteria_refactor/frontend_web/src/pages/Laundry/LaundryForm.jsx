import React, { useState, useEffect } from 'react';
import {
    Users, Shirt, Save,
    Search, Plus, CheckCircle
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';

const LaundryForm = () => {
    const [loading, setLoading] = useState(false);
    const [ticketNumber, setTicketNumber] = useState(null);

    // Customer Search
    const [customers, setCustomers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [showResults, setShowResults] = useState(false);

    // Laundry Form Data
    const [formData, setFormData] = useState({
        weight_kg: '',
        pieces: '',
        bag_color: '',
        wash_type: 'General', // Default valid value
        observations: ''
    });

    // Service Configuration (Smart Logic)
    const SERVICE_TYPES = {
        'General': { unit: 'KG', label: 'Lavado General' },
        'Lavado y Planchado': { unit: 'KG', label: 'Lavado + Planchado' },
        'Solo Planchado': { unit: 'PIECES', label: 'Solo Planchado' },
        'Solo Secado': { unit: 'KG', label: 'Solo Secado' },
        'Edredones': { unit: 'PIECES', label: 'Edredones' },
        'Delicado': { unit: 'KG', label: 'Delicado' },
        'Desmanchado': { unit: 'PIECES', label: 'Desmanchado' },
        'Teñido': { unit: 'PIECES', label: 'Teñido' }
    };

    const currentServiceConfig = SERVICE_TYPES[formData.wash_type] || SERVICE_TYPES['General'];

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
        if (!formData.bag_color || !formData.pieces) {
            toast.error('Complete los campos obligatorios (*).');
            return;
        }

        setLoading(true);
        try {
            // Construct Payload mapped to Backend ServiceOrder
            const payload = {
                customer_id: selectedCustomer.id,
                service_type: 'LAUNDRY',
                priority: 'NORMAL',

                // Mapped Fields
                device_type: 'ROPA',
                brand: 'GENERICA', // Dummy to satisfy constraint if any, or cleaner if model updated
                model: 'LAVANDERIA',

                // Flexible Metadata
                order_metadata: {
                    weight_kg: formData.weight_kg,
                    pieces: formData.pieces,
                    bag_color: formData.bag_color,
                    wash_type: formData.wash_type
                },

                // Notes
                problem_description: `Servicio: ${formData.wash_type}. Color Bolsa: ${formData.bag_color}. ${formData.observations || ''}`,
                physical_condition: `Piezas: ${formData.pieces}, Peso: ${formData.weight_kg}kg`
            };

            const res = await apiClient.post('/services/orders', payload);
            setTicketNumber(res.data.ticket_number);
            toast.success(`Orden de Lavandería ${res.data.ticket_number} creada!`);

            // Reset form
            setFormData({
                weight_kg: '',
                pieces: '',
                bag_color: '',
                wash_type: 'General',
                observations: ''
            });
            setSelectedCustomer(null);
            setSearchTerm('');

        } catch (error) {
            console.error("Error creating order:", error);
            // Show specific backend error if available
            const msg = error.response?.data?.detail || 'Error al crear la orden.';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    // Quick Create State
    const [showQuickCreate, setShowQuickCreate] = useState(false);
    const [quickCustomer, setQuickCustomer] = useState({
        name: '',
        id_number: '',
        phone: ''
    });

    const handleQuickCreate = async () => {
        if (!quickCustomer.name) {
            toast.error("Nombre es requerido");
            return;
        }
        try {
            const payload = {
                ...quickCustomer,
                id_number: quickCustomer.id_number || null, // Allow null if empty
                credit_limit: 100, // Default requested by user
                address: 'Dirección Pendiente',
                email: `temp_${Date.now()}@system.local`, // Dummy email to satisfy constraints if any
                type: 'INDIVIDUAL'
            };
            const res = await apiClient.post('/customers/', payload);
            toast.success("Cliente rápido creado");
            handleCustomerSelect(res.data);
            setShowQuickCreate(false);
            setQuickCustomer({ name: '', id_number: '', phone: '' });
        } catch (error) {
            console.error(error);
            toast.error("Error al crear cliente rápido");
        }
    };


    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Recepción de Lavandería</h1>
                    <p className="text-gray-500">Nueva Orden de Lavado</p>
                </div>
                {ticketNumber && (
                    <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg font-mono font-bold flex items-center gap-2">
                        <CheckCircle size={20} />
                        Ticket: {ticketNumber}
                    </div>
                )}
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* COLUMNA 1: CLIENTE */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 justify-between">
                            <span className="flex items-center gap-2"><Users className="text-teal-600" size={20} /> Datos del Cliente</span>
                            <button
                                type="button"
                                onClick={() => setShowQuickCreate(!showQuickCreate)}
                                className="text-xs text-teal-600 font-bold hover:underline flex items-center gap-1"
                            >
                                <Plus size={14} /> Nuevo Rápido
                            </button>
                        </h2>

                        {showQuickCreate ? (
                            <div className="bg-teal-50 p-4 rounded-xl border border-teal-100 space-y-3 animate-in fade-in slide-in-from-top-2">
                                <h3 className="text-xs font-bold text-teal-800 uppercase mb-2">Registro Rápido</h3>
                                <input
                                    placeholder="Nombre Completo *"
                                    className="w-full p-2 text-sm border rounded"
                                    value={quickCustomer.name}
                                    onChange={e => setQuickCustomer({ ...quickCustomer, name: e.target.value })}
                                />
                                <input
                                    placeholder="Cédula / RIF *"
                                    className="w-full p-2 text-sm border rounded"
                                    value={quickCustomer.id_number}
                                    onChange={e => setQuickCustomer({ ...quickCustomer, id_number: e.target.value })}
                                />
                                <input
                                    placeholder="Teléfono"
                                    className="w-full p-2 text-sm border rounded"
                                    value={quickCustomer.phone}
                                    onChange={e => setQuickCustomer({ ...quickCustomer, phone: e.target.value })}
                                />
                                <div className="flex justify-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowQuickCreate(false)}
                                        className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleQuickCreate}
                                        className="bg-teal-600 text-white text-xs px-3 py-1.5 rounded font-bold hover:bg-teal-700"
                                    >
                                        Crear y Usar
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="relative">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Cliente *</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Nombre o Cédula..."
                                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>

                                {showResults && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                        {customers.map(c => (
                                            <div
                                                key={c.id}
                                                onClick={() => handleCustomerSelect(c)}
                                                className="p-3 hover:bg-teal-50 cursor-pointer border-b last:border-0"
                                            >
                                                <div className="font-medium text-gray-800">{c.name}</div>
                                                <div className="text-xs text-gray-500">ID: {c.id_number}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {selectedCustomer && !showQuickCreate && (
                            <div className="mt-4 p-3 bg-teal-50 rounded-lg text-sm text-teal-800 border border-teal-100 flex justify-between items-center group">
                                <div>
                                    <p><strong>Cliente Seleccionado:</strong></p>
                                    <p>{selectedCustomer.name}</p>
                                </div>
                                <button type="button" onClick={() => setSelectedCustomer(null)} className="text-teal-400 hover:text-teal-600">
                                    <Users size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* COLUMNA 2: DETALLES DE LA ORDEN */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-full">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Shirt className="text-teal-600" size={20} />
                            Detalles del Servicio
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* Color Bolsa / ID */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Color de Bolsa / Identificador *</label>
                                <input
                                    name="bag_color"
                                    value={formData.bag_color}
                                    onChange={handleInputChange}
                                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                                    placeholder="Ej: Azul #12"
                                    required
                                />
                            </div>

                            {/* Tipo Servicio */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Servicio *</label>
                                <select
                                    name="wash_type"
                                    value={formData.wash_type}
                                    onChange={handleInputChange}
                                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                                >
                                    <option value="General">Lavado General</option>
                                    <option value="Lavado y Planchado">Lavado + Planchado</option>
                                    <option value="Solo Planchado">Solo Planchado</option>
                                    <option value="Solo Secado">Solo Secado</option>
                                    <option value="Edredones">Edredones</option>
                                    <option value="Delicado">Delicado</option>
                                    <option value="Desmanchado">Desmanchado</option>
                                    <option value="Teñido">Teñido</option>
                                </select>
                            </div>

                            {/* Peso (Conditional Highlight) */}
                            <div className={`transition-all duration-300 ${currentServiceConfig.unit === 'KG' ? 'opacity-100' : 'opacity-60'}`}>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Peso (Kg) {currentServiceConfig.unit === 'KG' && <span className="text-teal-600 font-bold">*</span>}
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    name="weight_kg"
                                    value={formData.weight_kg}
                                    onChange={handleInputChange}
                                    className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none font-mono ${currentServiceConfig.unit === 'KG' ? 'bg-white border-teal-200' : 'bg-gray-50'}`}
                                    placeholder="0.00"
                                    required={currentServiceConfig.unit === 'KG'}
                                />
                            </div>

                            {/* Piezas (Conditional Highlight) */}
                            <div className={`transition-all duration-300 ${currentServiceConfig.unit === 'PIECES' ? 'opacity-100' : 'opacity-80'}`}>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Cantidad de Piezas {currentServiceConfig.unit === 'PIECES' && <span className="text-teal-600 font-bold">*</span>}
                                </label>
                                <input
                                    type="number"
                                    name="pieces"
                                    value={formData.pieces}
                                    onChange={handleInputChange}
                                    className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none font-mono ${currentServiceConfig.unit === 'PIECES' ? 'bg-white border-teal-200 ring-2 ring-teal-50' : 'bg-white'}`}
                                    placeholder="0"
                                    required
                                />
                            </div>

                            {/* Observaciones (Full Width) */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones / Manchas / Daños</label>
                                <textarea
                                    name="observations"
                                    value={formData.observations}
                                    onChange={handleInputChange}
                                    rows={3}
                                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none resize-none"
                                    placeholder="Ej: Mancha en camisa blanca, cuidado con botones..."
                                />
                            </div>
                        </div>

                        <div className="border-t pt-6 mt-6 flex justify-end">
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-teal-200 flex items-center gap-2 disabled:opacity-50 transition-all"
                            >
                                {loading ? 'Procesando...' : (
                                    <>
                                        <Save size={20} />
                                        Crear Orden de Lavado
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

            </form>
        </div>
    );
};

export default LaundryForm;
