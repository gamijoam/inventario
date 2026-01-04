import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Wrench, Save, CheckCircle, Clock, AlertTriangle,
    Search, Plus, User, FileText, ArrowLeft, Package
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '../../utils/currency';

const STATUS_COLORS = {
    RECEIVED: 'bg-gray-100 text-gray-800',
    DIAGNOSING: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-blue-100 text-blue-800',
    IN_PROGRESS: 'bg-purple-100 text-purple-800',
    READY: 'bg-green-100 text-green-800',
    DELIVERED: 'bg-teal-100 text-teal-800',
    CANCELLED: 'bg-red-100 text-red-800',
};

const ServiceManager = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);

    // Work Area State
    const [diagnosisNotes, setDiagnosisNotes] = useState('');

    // Item Addition State
    const [showProductSearch, setShowProductSearch] = useState(false);
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [products, setProducts] = useState([]); // Catalog subset
    const [technicians, setTechnicians] = useState([]);

    // New Item Form
    const [newItem, setNewItem] = useState({
        product: null,
        quantity: 1,
        price: 0,
        technician_id: ''
    });

    // Fetch Order & Technicians
    useEffect(() => {
        fetchOrder();
        fetchTechnicians();
    }, [id]);

    const fetchOrder = async () => {
        try {
            const res = await apiClient.get(`/services/orders/${id}`);
            setOrder(res.data);
            setDiagnosisNotes(res.data.diagnosis_notes || '');
        } catch (error) {
            toast.error("Error al cargar la orden");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchTechnicians = async () => {
        try {
            const res = await apiClient.get('/users');
            setTechnicians(res.data);
        } catch (error) {
            console.error("Error fetching technicians", error);
        }
    };

    // Product Search
    useEffect(() => {
        if (productSearchTerm.length > 2) {
            const timeoutId = setTimeout(async () => {
                try {
                    const res = await apiClient.get(`/products/?search=${productSearchTerm}`);
                    setProducts(res.data);
                } catch (error) {
                    console.error(error);
                }
            }, 500);
            return () => clearTimeout(timeoutId);
        } else {
            setProducts([]);
        }
    }, [productSearchTerm]);

    // Actions
    const handleUpdateStatus = async (newStatus) => {
        try {
            await apiClient.patch(`/services/orders/${id}/status`, null, {
                params: { status: newStatus, notes: diagnosisNotes }
            });
            toast.success(`Estado actualizado a ${newStatus}`);
            fetchOrder();
        } catch (error) {
            toast.error("Error al actualizar estado");
        }
    };

    const handleAddItem = async () => {
        // Validation: Must have tech, and either product OR description
        const isValid = newItem.technician_id && (newItem.product || newItem.description);

        if (!isValid) {
            toast.error("Complete los campos requeridos (Producto/Descripción y Técnico)");
            return;
        }

        try {
            await apiClient.post(`/services/orders/${id}/items`, {
                product_id: newItem.product?.id, // Optional
                description: newItem.description, // Optional
                quantity: newItem.quantity,
                unit_price: newItem.price,
                technician_id: newItem.technician_id
            });
            toast.success("Ítem agregado");
            setNewItem({ product: null, quantity: 1, price: 0, technician_id: '' });
            setShowProductSearch(false);
            fetchOrder();
        } catch (error) {
            toast.error("Error al agregar ítem");
        }
    };

    const handleSaveNotes = async () => {
        try {
            await apiClient.patch(`/services/orders/${id}/status`, null, {
                params: { status: order.status, notes: diagnosisNotes } // Preserve status
            });
            toast.success("Notas guardadas");
        } catch (error) {
            toast.error("Error al guardar notas");
        }
    }

    if (loading) return <div>Cargando...</div>;
    if (!order) return <div>Orden no encontrada</div>;

    return (
        <div className="h-[calc(100vh-theme(spacing.32))] flex flex-col">
            {/* HEADER */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            Orden #{order.ticket_number}
                            <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[order.status]}`}>
                                {order.status}
                            </span>
                        </h1>
                        <p className="text-gray-500 text-sm">Created: {new Date(order.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleSaveNotes} className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700">
                        <Save size={18} /> Guardar Notas
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6 h-full overflow-hidden">

                {/* LEFT COLUMN: INFO (Read Only) */}
                <div className="col-span-3 bg-white p-4 rounded-xl shadow-sm border border-gray-200 overflow-y-auto">
                    <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <User size={18} /> Cliente
                    </h2>
                    <div className="space-y-2 text-sm mb-6">
                        <p className="font-medium">{order.customer?.name}</p>
                        <p className="text-gray-500">{order.customer?.phone}</p>
                        <p className="text-gray-500">{order.customer?.email}</p>
                    </div>

                    <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <Wrench size={18} /> Equipo
                    </h2>
                    <div className="space-y-3 text-sm">
                        <div className="bg-gray-50 p-3 rounded-lg">
                            <span className="block text-xs text-gray-500">Modelo</span>
                            {order.brand} {order.model}
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg">
                            <span className="block text-xs text-gray-500">Serial / IMEI</span>
                            <span className="font-mono">{order.serial_imei}</span>
                        </div>
                        <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                            <span className="block text-xs text-orange-500 font-bold flex items-center gap-1">
                                <AlertTriangle size={10} /> Falla Reportada
                            </span>
                            {order.problem_description}
                        </div>
                        {order.passcode_pattern && (
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                <span className="block text-xs text-blue-500 font-bold">Patrón / PIN</span>
                                {order.passcode_pattern}
                            </div>
                        )}
                    </div>
                </div>

                {/* CENTER COLUMN: WORKSPACE */}
                <div className="col-span-6 flex flex-col gap-6 overflow-hidden">

                    {/* Diagnosis Section */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex-shrink-0">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Diagnóstico Técnico & Notas</label>
                        <textarea
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono bg-yellow-50"
                            rows={6}
                            value={diagnosisNotes}
                            onChange={(e) => setDiagnosisNotes(e.target.value)}
                            placeholder="Escriba aquí los hallazgos técnicos..."
                        />
                    </div>

                    {/* Items / Parts Section */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold text-gray-800">Repuestos y Mano de Obra</h3>
                            <button
                                onClick={() => {
                                    setShowProductSearch(true);
                                    setNewItem({ product: null, description: '', quantity: 1, price: 0, technician_id: newItem.technician_id || '' });
                                }}
                                className="p-1 px-3 bg-blue-50 text-blue-600 rounded-lg text-sm hover:bg-blue-100 flex items-center gap-1"
                            >
                                <Plus size={16} /> Agregar
                            </button>
                        </div>

                        {/* ADD ITEM FORM */}
                        {showProductSearch && (
                            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200 animate-in fade-in slide-in-from-top-2">
                                {/* TABS */}
                                <div className="flex gap-4 border-b mb-3">
                                    <button
                                        className={`pb-2 text-sm font-medium ${!newItem.is_manual ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
                                        onClick={() => setNewItem({ ...newItem, is_manual: false, description: '' })}
                                    >
                                        Inventario / Repuesto
                                    </button>
                                    <button
                                        className={`pb-2 text-sm font-medium ${newItem.is_manual ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
                                        onClick={() => setNewItem({ ...newItem, is_manual: true, product: null })}
                                    >
                                        Servicio Manual
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {/* INPUT AREA */}
                                    {!newItem.is_manual ? (
                                        // PRODUCT SEARCH MODE
                                        !newItem.product ? (
                                            <div className="relative">
                                                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                                <input
                                                    autoFocus
                                                    placeholder="Buscar repuesto..."
                                                    className="w-full pl-9 p-2 border rounded-lg text-sm"
                                                    value={productSearchTerm}
                                                    onChange={e => setProductSearchTerm(e.target.value)}
                                                />
                                                {products.length > 0 && (
                                                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-xl max-h-40 overflow-y-auto">
                                                        {products.map(p => (
                                                            <div
                                                                key={p.id}
                                                                onClick={() => setNewItem({ ...newItem, product: p, price: p.price_usd })}
                                                                className="p-2 hover:bg-blue-50 cursor-pointer text-sm"
                                                            >
                                                                <div className="font-medium">{p.name}</div>
                                                                <div className="text-xs text-gray-500 justify-between flex">
                                                                    <span>Price: ${p.price_usd}</span>
                                                                    <span>Stock: {p.stock}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between bg-white p-2 border rounded-lg">
                                                <span className="font-medium text-sm truncate flex-1">{newItem.product.name}</span>
                                                <button onClick={() => setNewItem({ ...newItem, product: null })} className="text-red-500 text-xs hover:underline ml-2">Cambiar</button>
                                            </div>
                                        )
                                    ) : (
                                        // MANUAL SERVICE MODE
                                        <div>
                                            <label className="text-xs text-gray-500">Descripción del Servicio</label>
                                            <input
                                                autoFocus
                                                placeholder="Ej: Instalación de Software, Limpieza..."
                                                className="w-full p-2 border rounded-lg text-sm"
                                                value={newItem.description}
                                                onChange={e => setNewItem({ ...newItem, description: e.target.value })}
                                            />
                                        </div>
                                    )}

                                    {/* COMMON DETAILS ROW */}
                                    <div className="flex gap-2">
                                        <div className="w-20">
                                            <label className="text-xs text-gray-500">Cant.</label>
                                            <input
                                                type="number"
                                                min="1"
                                                className="w-full p-2 border rounded-lg text-sm"
                                                value={newItem.quantity}
                                                onChange={e => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) })}
                                            />
                                        </div>
                                        <div className="w-28">
                                            <label className="text-xs text-gray-500">Precio ($)</label>
                                            <input
                                                type="number"
                                                className="w-full p-2 border rounded-lg text-sm"
                                                value={newItem.price}
                                                onChange={e => setNewItem({ ...newItem, price: parseFloat(e.target.value) })}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-xs text-gray-500">Técnico (Comisión)</label>
                                            <select
                                                className="w-full p-2 border rounded-lg text-sm"
                                                value={newItem.technician_id}
                                                onChange={e => setNewItem({ ...newItem, technician_id: e.target.value })}
                                            >
                                                <option value="">Seleccionar...</option>
                                                {technicians.map(t => (
                                                    <option key={t.id} value={t.id}>{t.username}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-2 pt-2">
                                        <button onClick={() => setShowProductSearch(false)} className="px-3 py-1 text-sm text-gray-500">Cancelar</button>
                                        <button onClick={handleAddItem} className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm shadow-sm">
                                            Agregar Item
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ITEMS LIST */}
                        <div className="overflow-y-auto flex-1">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500">
                                    <tr>
                                        <th className="text-left p-2">Descripción</th>
                                        <th className="text-right p-2">Cant</th>
                                        <th className="text-right p-2">Precio</th>
                                        <th className="text-right p-2">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {order.details.map(detail => (
                                        <tr key={detail.id} className="hover:bg-gray-50">
                                            <td className="p-2">
                                                <div className="flex items-center gap-2">
                                                    {detail.is_manual && <span className="bg-purple-100 text-purple-700 text-[10px] px-1 rounded border border-purple-200">MANUAL</span>}
                                                    <span className="font-medium">
                                                        {detail.description || detail.product?.name || 'Item'}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    Tech: {technicians.find(t => t.id === detail.technician?.id)?.username || detail.technician?.username || '-'}
                                                </div>
                                            </td>
                                            <td className="text-right p-2">{detail.quantity}</td>
                                            <td className="text-right p-2">{formatCurrency(detail.unit_price)}</td>
                                            <td className="text-right p-2 font-medium">{formatCurrency(detail.quantity * detail.unit_price)}</td>
                                        </tr>
                                    ))}
                                    {order.details.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="text-center p-4 text-gray-400 italic">No hay repuestos o servicios cargados.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: ACTIONS */}
                <div className="col-span-3 space-y-4">
                    {/* Status Card */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                        <h3 className="font-semibold text-gray-800 mb-4">Estado del Servicio</h3>

                        <div className="space-y-2">
                            {['DIAGNOSING', 'IN_PROGRESS', 'READY', 'DELIVERED'].map(statusStep => (
                                <button
                                    key={statusStep}
                                    onClick={() => handleUpdateStatus(statusStep)}
                                    className={`w-full py-3 px-4 rounded-lg text-left text-sm font-medium transition-all flex justify-between items-center
                                ${order.status === statusStep
                                            ? 'bg-blue-600 text-white shadow-md transform scale-105'
                                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                        }`}
                                >
                                    {statusStep.replace('_', ' ')}
                                    {order.status === statusStep && <CheckCircle size={16} />}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-500 text-sm">Total Estimado</span>
                            <span className="font-bold text-xl text-green-700">
                                {formatCurrency(order.details.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0))}
                            </span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ServiceManager;
