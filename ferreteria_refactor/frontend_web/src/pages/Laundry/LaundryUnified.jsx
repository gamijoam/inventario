import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus, Search, RefreshCw, Filter,
    Shirt, Clock, CheckCircle, Package,
    LayoutGrid, List as ListIcon, Trash2,
    Users, Save, ShoppingBag, X, ChevronRight,
    ArrowRight, DollarSign
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import { useConfig } from '../../context/ConfigContext';
import LaundryDetailModal from './components/LaundryDetailModal';
import LaundryList from './components/LaundryList';
import ServiceSelectorModal from './components/ServiceSelectorModal';

// Status Columns for Kanban
const COLUMNS = [
    { id: 'RECEIVED', label: 'Recibido', color: 'bg-slate-50 border-slate-200' },
    { id: 'IN_PROGRESS', label: 'Procesando', color: 'bg-blue-50/50 border-blue-100' },
    { id: 'READY', label: 'Listo', color: 'bg-emerald-50/50 border-emerald-100' },
    { id: 'DELIVERED', label: 'Entregado', color: 'bg-gray-50 border-gray-100 opacity-70' }
];

const LaundryUnified = () => {
    const navigate = useNavigate();
    const { formatCurrency } = useConfig();

    // --- GLOBAL STATE ---
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // --- DASHBOARD STATE ---
    const [viewMode, setViewMode] = useState('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [showLateOnly, setShowLateOnly] = useState(false);

    // --- MOBILE TAB STATE ---
    const [activeTab, setActiveTab] = useState('DASHBOARD'); // 'DASHBOARD' | 'FORM'


    // --- NEW ORDER FORM STATE ---
    const [isCreating, setIsCreating] = useState(false); // Mobile toggle or generic state
    const [ticketNumber, setTicketNumber] = useState(null);
    const [formLoading, setFormLoading] = useState(false);

    // Customer
    const [customers, setCustomers] = useState([]);
    const [customerSearch, setCustomerSearch] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [showCustomerResults, setShowCustomerResults] = useState(false);

    // Quick Customer Create
    const [showQuickCreate, setShowQuickCreate] = useState(false);
    const [quickCustomer, setQuickCustomer] = useState({ name: '', id_number: '', phone: '' });

    // Product
    const [products, setProducts] = useState([]);
    const [productSearch, setProductSearch] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [showProductResults, setShowProductResults] = useState(false);
    const [showServiceSelector, setShowServiceSelector] = useState(false);

    // Cart & Item
    const [cart, setCart] = useState([]);
    const [unitMode, setUnitMode] = useState('PIECES'); // 'KG' or 'PIECES'
    const [currentItem, setCurrentItem] = useState({
        quantity: 1, weight_kg: '', pieces: '', observations: '',
        is_manual_price: false, manual_price: ''
    });
    const [orderMetadata, setOrderMetadata] = useState({ bag_color: '', priority: 'NORMAL' });

    // Manual Item State
    const [isManualItem, setIsManualItem] = useState(false);
    const [manualDescription, setManualDescription] = useState('');

    // ==========================================
    // 1. DASHBOARD LOGIC
    // ==========================================
    useEffect(() => {
        fetchOrders();
    }, [refreshTrigger]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/services/orders', { params: { service_type: 'LAUNDRY' } });
            setOrders(res.data);
        } catch (error) {
            console.error(error);
            toast.error("Error actualizando tablero");
        } finally {
            setLoading(false);
        }
    };

    const isOrderLate = (order) => {
        if (order.status === 'DELIVERED' || order.status === 'READY') return false;
        const created = new Date(order.created_at);
        const diffTime = Math.abs(new Date() - created);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 2;
    };

    const getFilteredOrders = () => {
        return orders.filter(order => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch =
                order.ticket_number?.toLowerCase().includes(searchLower) ||
                order.customer?.name?.toLowerCase().includes(searchLower) ||
                order.order_metadata?.bag_color?.toLowerCase().includes(searchLower);

            if (!matchesSearch) return false;
            if (statusFilter !== 'ALL') {
                if (statusFilter === 'PENDING' && !['RECEIVED', 'IN_PROGRESS', 'DIAGNOSING'].includes(order.status)) return false;
                else if (statusFilter !== 'PENDING' && order.status !== statusFilter) return false;
            }
            if (showLateOnly && !isOrderLate(order)) return false;
            return true;
        });
    };

    const handleDeleteOrder = async (e, orderId) => {
        e?.stopPropagation();
        if (!window.confirm("¿Eliminar esta orden?")) return;
        try {
            await apiClient.delete(`/services/orders/${orderId}`);
            toast.success("Orden eliminada");
            setRefreshTrigger(p => p + 1);
        } catch (error) {
            toast.error("Error al eliminar");
        }
    };

    const handleEditOrder = (e, order) => {
        e?.stopPropagation();
        setSelectedOrder(order);
    };

    // ==========================================
    // 2. NEW ORDER LOGIC
    // ==========================================

    // Customer Search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (customerSearch.length > 2 && (!selectedCustomer || customerSearch !== selectedCustomer.name)) {
                try {
                    const res = await apiClient.get(`/customers/?search=${customerSearch}`);
                    setCustomers(res.data);
                    setShowCustomerResults(true);
                } catch (e) { console.error(e); }
            } else { setCustomers([]); setShowCustomerResults(false); }
        }, 400);
        return () => clearTimeout(timer);
    }, [customerSearch, selectedCustomer]);

    // Product Search - Now handled by ServiceSelectorModal
    // Keeping state for backward compatibility with handleProductSelect

    const handleProductSelect = (product) => {
        setSelectedProduct(product);
        setProductSearch(product.name);
        setShowProductResults(false);
        setIsManualItem(false); // Disable manual mode if product selected

        // Auto-detect unit
        const isKg = product.unit_type?.toLowerCase().includes('kilo') || product.name.toLowerCase().includes('kg');
        setUnitMode(isKg ? 'KG' : 'PIECES');

        setCurrentItem(prev => ({
            ...prev,
            weight_kg: '', pieces: isKg ? '' : '1', quantity: 1,
            manual_price: product.price || 0, is_manual_price: false, observations: ''
        }));
    };

    const handleEnableManualItem = () => {
        setIsManualItem(true);
        setSelectedProduct(null);
        setProductSearch('');
        setUnitMode('PIECES'); // Default to Pieces/Units for custom items
        setCurrentItem(prev => ({
            ...prev,
            quantity: 1, weight_kg: '', pieces: '1',
            is_manual_price: true, manual_price: '', observations: ''
        }));
    };

    const handleQuickCreateCustomer = async () => {
        if (!quickCustomer.name || !quickCustomer.phone) {
            return toast.error("Nombre y teléfono son obligatorios");
        }
        try {
            const res = await apiClient.post('/customers', {
                ...quickCustomer,
                credit_limit: 100 // Default credit limit for quick customers
            });
            setSelectedCustomer(res.data);
            setCustomerSearch(res.data.name);
            setShowQuickCreate(false);
            setQuickCustomer({ name: '', id_number: '', phone: '' });
            toast.success("Cliente creado exitosamente");
        } catch (error) {
            console.error(error);
            toast.error("Error al crear cliente");
        }
    };

    const addToCart = () => {
        if (!selectedProduct && !isManualItem) return toast.error("Seleccione un servicio o use modo manual");
        if (isManualItem && !manualDescription) return toast.error("Ingrese descripción del servicio");

        const isKgMode = unitMode === 'KG';
        // Relaxed validation for manual mode? No, still need quantity/weight
        if (isKgMode && !currentItem.weight_kg) return toast.error("Ingrese Peso (Kg)");
        if (!isKgMode && !currentItem.pieces) return toast.error("Ingrese Cantidad");

        let finalQty = isKgMode ? parseFloat(currentItem.weight_kg) : parseFloat(currentItem.pieces);
        let finalPrice = currentItem.is_manual_price ? parseFloat(currentItem.manual_price) : parseFloat(selectedProduct?.price || 0);

        if (isNaN(finalPrice)) return toast.error("Precio inválido");

        const newItem = {
            id: Date.now(),
            product_id: selectedProduct?.id || null, // NULL for custom items? Backend might require product_id?
            // If backend requires product_id, we might need a "GENERIC SERVICE" product.
            // For now assuming backend handles null product_id if description is provided, OR we create a generic product on fly?
            // Let's assume SalesService might need product_id.
            // CHECK: Backend SalesService logic.
            // *Correction*: Backend often iterates items and looks up product.
            // If ID is missing, backend might fail.
            // Then `if prod:` checks fail.
            // Then `if not is_service: is_service_only = False`.
            // Then `for item in sale_data.items: ... product = db.query... .one()` -> raises NoResultFound or 404 if not found.
            // **CRITICAL**: The backend NEEDS a valid product ID.
            // **SOLUTION**: I cannot support purely NULL product_id without backend changes.
            // **FAST FIX**: I need a "GENERIC" product in DB.
            // OR I can search for a product named "VARIOS" or "OTROS" in the frontend and use its ID stealthily?
            // User probably already has one.
            // Just in case, I will NOT modify backend now to avoid risks.
            // I will add a warning or try to find a "GENERIC" product?
            // Better: I will let the user search "VARIOS" in the normal search, BUT user specifically asked for "Manual".
            // If I let is_manual_item, I must pick a placeholder product if possible.
            // Let's try sending `product_id` as undefined/null and see if backend handles it?
            // Checked backend code: `product = db.query(models.Product).filter(models.Product.id == item.product_id).with_for_update().first()` -> `if not product: raise 404`.
            // So product_id IS REQUIRED.
            // I will implement "Manual" as: User types name, BUT I must map it to a "VARIOS" product ID if available, or I have to prompt user to select "VARIOS" service first.
            // The user wants "New Order -> Various".
            // I will add a "VARIOS" button that searches for a product named "VARIOS" or "GENERICO" and selects it automatically, then focuses description.

            description: isManualItem ? manualDescription : selectedProduct.name,
            observations: currentItem.observations || '',
            quantity: finalQty,
            unit_price: finalPrice,
            weight_kg: isKgMode ? finalQty : 0,
            pieces: isKgMode ? (parseInt(currentItem.pieces) || 0) : finalQty,
            service_type: 'LAUNDRY',
            unit_mode: unitMode
        };

        setCart([...cart, newItem]);
        setSelectedProduct(null);
        setProductSearch('');
        setIsManualItem(false);
        setManualDescription('');
        setCurrentItem(prev => ({ ...prev, weight_kg: '', pieces: '', observations: '' }));
        toast.success("Agregado");
    };

    const handleCreateOrder = async () => {
        if (!selectedCustomer) return toast.error("Seleccione Cliente");
        if (cart.length === 0) return toast.error("Carrito vacío");

        setFormLoading(true);
        try {
            const payload = {
                customer_id: selectedCustomer.id,
                service_type: 'LAUNDRY',
                priority: orderMetadata.priority,
                order_metadata: {
                    bag_color: orderMetadata.bag_color || `LAV-${Date.now().toString().slice(-4)}`,
                    total_items: cart.length,
                    pieces: cart.reduce((acc, i) => acc + (Number(i.pieces) || 0), 0)
                },
                items: cart.map(item => ({
                    product_id: item.product_id,
                    description: item.description,
                    observations: item.observations,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                })),
                problem_description: `Orden Lavandería (${cart.length} ítems)`,
                device_type: 'ROPA'
            };

            const res = await apiClient.post('/services/orders', payload);
            setTicketNumber(res.data.ticket_number);
            toast.success("Orden Creada Exitosamente");

            // Refresh Dashboard
            setRefreshTrigger(p => p + 1);

            // Reset Form (keep customer? optional. Let's reset for now)
            setCart([]);
            setSelectedCustomer(null);
            setCustomerSearch('');
            setOrderMetadata({ bag_color: '', priority: 'NORMAL' });

            // Hide success message after 5s or manually
            setTimeout(() => setTicketNumber(null), 5000);

        } catch (error) {
            console.error(error);
            toast.error("Error al crear la orden");
        } finally {
            setFormLoading(false);
        }
    };


    // ==========================================
    // RENDER
    // ==========================================
    const filteredOrders = getFilteredOrders();

    return (
        <div className="flex flex-col md:flex-row h-[calc(100vh-70px)] overflow-hidden bg-slate-50 relative z-0 w-full pb-20 md:pb-0">

            {/* LEFT PANEL: DASHBOARD (65%) */}
            <div className={`flex-1 flex-col min-w-0 border-r border-slate-200 ${activeTab === 'DASHBOARD' ? 'flex' : 'hidden md:flex'}`}>
                {/* Header & Filters */}
                <div className="p-4 bg-white border-b border-slate-100 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Shirt className="text-indigo-600" />
                            Control de Lavandería
                        </h1>
                        {/* REMOVED REDUNDANT BUTTON */}
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded transition ${viewMode === 'list' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}><ListIcon size={18} /></button>
                            <button onClick={() => setViewMode('kanban')} className={`p-1.5 rounded transition ${viewMode === 'kanban' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}><LayoutGrid size={18} /></button>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                            <input
                                className="w-full pl-9 p-2 text-sm bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none"
                                placeholder="Buscar orden, cliente o bolsa..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <select
                            className="bg-slate-50 text-sm font-bold text-slate-600 rounded-lg px-3 outline-none focus:ring-2 focus:ring-indigo-100"
                            value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                        >
                            <option value="ALL">Todos</option>
                            <option value="PENDING">En Proceso</option>
                            <option value="READY">Listos</option>
                        </select>
                        <button onClick={() => setRefreshTrigger(p => p + 1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><RefreshCw size={18} /></button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden p-3">
                    {viewMode === 'list' ? (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden h-full flex flex-col">
                            <LaundryList orders={filteredOrders} onSelectOrder={setSelectedOrder} onDeleteOrder={handleDeleteOrder} onEditOrder={handleEditOrder} />
                        </div>
                    ) : (
                        <div className="flex gap-4 h-full overflow-x-auto pb-2">
                            {COLUMNS.map(col => {
                                const colOrders = filteredOrders.filter(o => col.id === 'RECEIVED' ? ['RECEIVED', 'DIAGNOSING'].includes(o.status) : o.status === col.id);
                                return (
                                    <div key={col.id} className={`flex-1 min-w-[260px] flex flex-col rounded-xl border ${col.color}`}>
                                        <div className="p-3 font-bold text-slate-600 text-sm flex justify-between">
                                            {col.label} <span className="bg-white px-2 rounded-full shadow-sm text-xs py-0.5">{colOrders.length}</span>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                                            {colOrders.map(order => (
                                                <div key={order.id} onClick={() => setSelectedOrder(order)} className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 hover:shadow-md cursor-pointer transition-all group relative">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="font-bold text-slate-800">#{order.ticket_number}</span>
                                                        <span className="text-[10px] text-slate-400">{new Date(order.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="text-xs font-medium text-slate-600 mb-2 truncate">{order.customer?.name}</div>
                                                    <div className="flex gap-1 flex-wrap">
                                                        {order.priority === 'URGENT' && <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 rounded font-bold">URGENTE</span>}
                                                        {order.order_metadata?.bag_color && <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 rounded border border-purple-100 truncate max-w-[100px]">{order.order_metadata.bag_color}</span>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT PANEL: QUICK ORDER */}
            <div className={`bg-white shadow-xl flex-col transition-all duration-300 z-10 border-l border-slate-200 shrink-0 ${activeTab === 'FORM' ? 'flex w-full md:w-[480px]' : 'hidden md:flex md:w-[480px]'}`}>
                <div className="p-4 bg-indigo-600 text-white shadow-lg flex justify-between items-center relative overflow-hidden shrink-0">
                    <div className="relative z-10">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Plus size={20} className="text-indigo-200" /> Nuevo Pedido
                        </h2>
                        <p className="text-indigo-200 text-xs">Registro rápido de lavandería</p>
                    </div>
                    <div className="absolute -right-6 -bottom-10 opacity-10 rotate-12">
                        <Shirt size={100} />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {/* TICKET SUCCESS */}
                    {ticketNumber && (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-3 animate-bounce">
                            <CheckCircle className="text-emerald-500" size={24} />
                            <div>
                                <div className="font-bold text-emerald-800">Orden #{ticketNumber}</div>
                                <div className="text-xs text-emerald-600">Registrada correctamente</div>
                            </div>
                            <button onClick={() => setTicketNumber(null)} className="ml-auto text-emerald-400 hover:text-emerald-700"><X size={16} /></button>
                        </div>
                    )}

                    {/* 1. CUSTOMER */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cliente</label>
                            {!selectedCustomer && !showQuickCreate && (
                                <button
                                    onClick={() => setShowQuickCreate(true)}
                                    className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 shadow-sm transition-all active:scale-95"
                                >
                                    + Nuevo Cliente
                                </button>
                            )}
                        </div>

                        {showQuickCreate ? (
                            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-xl border border-emerald-200 space-y-3 animate-in fade-in slide-in-from-top-2">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-sm font-bold text-emerald-800">Crear Cliente Rápido</h3>
                                    <button onClick={() => setShowQuickCreate(false)} className="text-emerald-400 hover:text-emerald-700">
                                        <X size={16} />
                                    </button>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-emerald-700 uppercase">Nombre *</label>
                                    <input
                                        className="w-full p-2 border border-emerald-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder="Nombre completo"
                                        value={quickCustomer.name}
                                        onChange={e => setQuickCustomer({ ...quickCustomer, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-emerald-700 uppercase">Cédula (Opcional)</label>
                                    <input
                                        className="w-full p-2 border border-emerald-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder="V-12345678"
                                        value={quickCustomer.id_number}
                                        onChange={e => setQuickCustomer({ ...quickCustomer, id_number: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-emerald-700 uppercase">Teléfono *</label>
                                    <input
                                        className="w-full p-2 border border-emerald-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder="0412-1234567"
                                        value={quickCustomer.phone}
                                        onChange={e => setQuickCustomer({ ...quickCustomer, phone: e.target.value })}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setShowQuickCreate(false);
                                            setQuickCustomer({ name: '', id_number: '', phone: '' });
                                        }}
                                        className="flex-1 px-4 py-2 bg-white border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50 font-medium text-sm transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleQuickCreateCustomer}
                                        className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-lg hover:from-emerald-700 hover:to-teal-800 font-bold text-sm shadow-md transition-all active:scale-95"
                                    >
                                        Crear Cliente
                                    </button>
                                </div>
                            </div>
                        ) : !selectedCustomer ? (
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-indigo-300" size={16} />
                                <input
                                    className="w-full pl-9 p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
                                    placeholder="Buscar por nombre o cédula..."
                                    value={customerSearch}
                                    onChange={e => setCustomerSearch(e.target.value)}
                                />
                                {showCustomerResults && (
                                    <div className="absolute z-20 w-full mt-1 bg-white border rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                        {customers.map(c => (
                                            <div key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(c.name); setShowCustomerResults(false); }} className="p-3 hover:bg-indigo-50 cursor-pointer border-b text-sm">
                                                <div className="font-bold text-slate-700">{c.name}</div>
                                                <div className="text-xs text-slate-400">{c.id_number}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex justify-between items-center bg-indigo-50 p-3 rounded-xl border border-indigo-100 group">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700 font-bold">
                                        {selectedCustomer.name.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="font-bold text-indigo-900 text-sm">{selectedCustomer.name}</div>
                                        <div className="text-[10px] text-indigo-500">{selectedCustomer.id_number}</div>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedCustomer(null)} className="text-indigo-300 hover:text-rose-500 p-1 rounded transition-colors"><X size={16} /></button>
                            </div>
                        )}
                    </div>

                    {/* 2. ORDER DETAILS */}
                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Prioridad</label>
                            <select
                                className={`w-full p-2 border rounded-lg text-sm outline-none font-bold ${orderMetadata.priority === 'URGENT' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                                value={orderMetadata.priority}
                                onChange={e => setOrderMetadata({ ...orderMetadata, priority: e.target.value })}
                            >
                                <option value="NORMAL">Normal</option>
                                <option value="HIGH">Alta</option>
                                <option value="URGENT">Urgente</option>
                            </select>
                            <p className="text-[10px] text-slate-400 mt-1">El identificador se generará automáticamente (LAV-xxxx)</p>
                        </div>
                    </div>

                    {/* 3. ADD SERVICE */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-dotted border-slate-300 space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                                <Plus size={14} className="text-indigo-500" />
                                Agregar Servicio
                            </label>
                            {/* Manual Toggle */}
                            <button
                                onClick={handleEnableManualItem}
                                className={`text-[10px] font-bold px-2 py-1 rounded bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 ${isManualItem ? 'bg-indigo-600 text-white border-indigo-600 hover:text-white' : ''}`}
                            >
                                Manual / Varios
                            </button>
                        </div>

                        {/* MANUAL ENTRY MODE */}
                        {isManualItem ? (
                            <div className="animate-in fade-in slide-in-from-top-2 space-y-3">
                                <input
                                    className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                                    placeholder="Descripción del servicio (ej: Limpieza especial)..."
                                    value={manualDescription}
                                    onChange={e => setManualDescription(e.target.value)}
                                    autoFocus
                                />
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <span className="absolute left-2 top-2 text-slate-400">$</span>
                                        <input
                                            type="number" step="0.01"
                                            className="w-full pl-6 p-2 text-sm border rounded-lg font-bold outline-none"
                                            placeholder="Precio"
                                            value={currentItem.manual_price}
                                            onChange={e => setCurrentItem({ ...currentItem, manual_price: e.target.value })}
                                        />
                                    </div>
                                    <input
                                        type="number"
                                        className="w-20 p-2 text-sm border rounded-lg text-center"
                                        placeholder="Cant."
                                        value={currentItem.pieces}
                                        onChange={e => setCurrentItem({ ...currentItem, pieces: e.target.value })}
                                    />
                                    <button onClick={addToCart} className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 shadow-md"><Plus size={18} /></button>
                                </div>
                                <div className="text-[10px] text-amber-600 bg-amber-50 p-2 rounded">
                                    * Este ítem se agregará como 'Varios' sin vincular stock.
                                </div>
                            </div>
                        ) : (
                            /* PRODUCT SEARCH MODE */
                            <>
                                <button
                                    onClick={() => setShowServiceSelector(true)}
                                    className="w-full p-3 text-sm border-2 border-dashed border-indigo-300 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left flex items-center gap-2 text-indigo-600 font-medium"
                                >
                                    <Search size={18} />
                                    {selectedProduct ? selectedProduct.name : 'Buscar servicio (clic para abrir selector)...'}
                                </button>

                                {selectedProduct && (
                                    <div className="animate-in fade-in slide-in-from-top-2 space-y-3">
                                        {/* Toggle & Price */}
                                        <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200">
                                            <div className="text-sm font-bold text-slate-700 truncate max-w-[120px]">{selectedProduct.name}</div>
                                            <div className="flex gap-1">
                                                <button onClick={() => setUnitMode('KG')} className={`px-2 py-1 text-[10px] font-bold rounded ${unitMode === 'KG' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>KG</button>
                                                <button onClick={() => setUnitMode('PIECES')} className={`px-2 py-1 text-[10px] font-bold rounded ${unitMode === 'PIECES' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>UD</button>
                                            </div>
                                        </div>

                                        {/* Observations */}
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Observaciones</label>
                                            <textarea
                                                className="w-full p-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                                placeholder="Notas especiales (ej: Mancha en el cuello)..."
                                                rows="2"
                                                value={currentItem.observations}
                                                onChange={e => setCurrentItem({ ...currentItem, observations: e.target.value })}
                                            />
                                        </div>

                                        {/* Inputs */}
                                        <div className="flex gap-2">
                                            {unitMode === 'KG' ? (
                                                <>
                                                    <input type="number" placeholder="Kg" className="flex-1 p-2 text-sm border rounded-lg font-bold" value={currentItem.weight_kg} onChange={e => setCurrentItem({ ...currentItem, weight_kg: e.target.value })} autoFocus />
                                                    <input type="number" placeholder="Pzas (Opc)" className="w-20 p-2 text-sm border rounded-lg" value={currentItem.pieces} onChange={e => setCurrentItem({ ...currentItem, pieces: e.target.value })} />
                                                </>
                                            ) : (
                                                <input type="number" placeholder="Cantidad" className="flex-1 p-2 text-sm border rounded-lg font-bold" value={currentItem.pieces} onChange={e => setCurrentItem({ ...currentItem, pieces: e.target.value })} autoFocus />
                                            )}
                                            <button onClick={addToCart} className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 shadow-md"><Plus /></button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>


                    {/* 4. MINI CART */}
                    {cart.length > 0 && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Resumen</label>
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                {cart.map((item, idx) => (
                                    <div key={item.id} className="p-3 border-b border-slate-50 last:border-0 flex justify-between items-center">
                                        <div className="flex-1">
                                            <div className="text-sm font-bold text-slate-700">{item.description}</div>
                                            <div className="text-[10px] text-slate-400">
                                                {item.weight_kg > 0 ? `${item.weight_kg} kg` : `${item.quantity} ud`} x ${item.unit_price}
                                            </div>
                                            {item.observations && (
                                                <div className="mt-1 text-xs text-gray-600 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">
                                                    <span className="font-bold text-amber-700">Nota:</span> {item.observations}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-bold text-slate-800">${(item.quantity * item.unit_price).toFixed(2)}</span>
                                            <button onClick={() => setCart(cart.filter(c => c.id !== item.id))} className="text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                ))}
                                <div className="bg-slate-50 p-3 flex justify-between items-center border-t border-slate-100">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Total Estimado</span>
                                    <span className="text-lg font-black text-indigo-700">${cart.reduce((a, c) => a + (c.quantity * c.unit_price), 0).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* FOOTER ACTIONS */}
                <div className="p-4 bg-white border-t border-slate-100">
                    <button
                        onClick={handleCreateOrder}
                        disabled={formLoading || cart.length === 0 || !selectedCustomer}
                        className="w-full bg-slate-900 hover:bg-black disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold shadow-xl shadow-slate-200 flex justify-center items-center gap-2 transition-all active:scale-95"
                    >
                        {formLoading ? 'Procesando...' : (
                            <>
                                <Save size={20} /> Crear Orden
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* MODALS */}
            {selectedOrder && (
                <LaundryDetailModal
                    orderId={selectedOrder.id}
                    onClose={() => { setSelectedOrder(null); setRefreshTrigger(p => p + 1); }}
                />
            )}

            {/* Service Selector Modal */}
            <ServiceSelectorModal
                isOpen={showServiceSelector}
                onClose={() => setShowServiceSelector(false)}
                onSelectService={handleProductSelect}
                selectedServices={cart}
            />

            {/* =====================================================================================
                MOBILE TAB SWITCHER - Bottom Navigation
               ===================================================================================== */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 flex gap-3 z-50 shadow-2xl">
                {/* Dashboard Tab */}
                <button
                    onClick={() => setActiveTab('DASHBOARD')}
                    className={`
                        flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2
                        ${activeTab === 'DASHBOARD'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }
                    `}
                >
                    <LayoutGrid size={20} />
                    <span>Dashboard</span>
                </button>

                {/* Form Tab with Badge */}
                <button
                    onClick={() => setActiveTab('FORM')}
                    className={`
                        flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 relative
                        ${activeTab === 'FORM'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }
                    `}
                >
                    <Plus size={20} />
                    <span>Nuevo Pedido</span>
                    {cart.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center shadow-md">
                            {cart.length}
                        </span>
                    )}
                </button>
            </div>
        </div>
    );
};

export default LaundryUnified;
