import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronLeft, Search, Plus, Save, X, Zap, Package, ShoppingCart, ChevronDown } from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import printerService from '../../services/printerService';
import { useConfig } from '../../context/ConfigContext';
import QuickCustomerModal from '../../components/pos/QuickCustomerModal';

const DEVICE_TYPES = [
    { id: 'SMARTPHONE', label: 'Celular', icon: '📱' },
    { id: 'TABLET',     label: 'Tablet',  icon: '📟' },
    { id: 'LAPTOP',     label: 'Laptop',  icon: '💻' },
    { id: 'OTHER',      label: 'Otro',    icon: '🖥️' },
];

const PHYSICAL_CONDITIONS = [
    { id: 'EXCELLENT', label: 'Excelente', stars: 5 },
    { id: 'GOOD',      label: 'Bueno',     stars: 4 },
    { id: 'FAIR',      label: 'Regular',   stars: 3 },
    { id: 'POOR',      label: 'Pobre',     stars: 1 },
];

const COMMON_ISSUES = [
    'Cambio de pantalla', 'Batería muerta', 'No enciende',
    'Se apaga solo', 'Lento/Lag', 'Botones rotos', 'Agua/Humedad', 'Otro problema',
];

/* ─────────────────────────────────────────────────────
   DRAWER DE PLANTILLAS
───────────────────────────────────────────────────── */
const TemplateDrawer = ({ templates, onAddTemplate, onClose }) => {
    const [search, setSearch]       = useState('');
    const [category, setCategory]   = useState('all');
    const inputRef                  = useRef(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const categories = ['all', ...Array.from(new Set(
        templates.map(t => t.category).filter(Boolean)
    ))];

    const filtered = templates.filter(t => {
        const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
                            (t.description || '').toLowerCase().includes(search.toLowerCase());
        const matchCat    = category === 'all' || t.category === category;
        return matchSearch && matchCat;
    });

    const totalPrice = (t) =>
        t.items?.reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0) || 0;

    return (
        <div className="fixed inset-0 z-[60] flex">
            {/* Overlay */}
            <div className="flex-1 bg-black/40" onClick={onClose} />

            {/* Panel */}
            <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl">
                {/* Header drawer */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold">Todas las Plantillas</h3>
                        <p className="text-blue-200 text-sm">{filtered.length} disponibles</p>
                    </div>
                    <button onClick={onClose}
                        className="p-2 hover:bg-blue-500 rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Buscador */}
                <div className="p-4 border-b space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Buscar plantilla..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        />
                    </div>
                    {/* Filtros por categoría */}
                    {categories.length > 1 && (
                        <div className="flex gap-2 flex-wrap">
                            {categories.map(cat => (
                                <button key={cat}
                                    onClick={() => setCategory(cat)}
                                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                                        category === cat
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {cat === 'all' ? 'Todas' : cat}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Lista */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {filtered.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <Zap size={36} className="mx-auto mb-3 opacity-40" />
                            <p className="font-medium">Sin resultados</p>
                            <p className="text-sm">Prueba con otro término</p>
                        </div>
                    ) : (
                        filtered.map(t => (
                            <div key={t.id}
                                className="border-2 border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:bg-blue-50 transition-all">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-slate-800 truncate">{t.name}</p>
                                        {t.description && (
                                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{t.description}</p>
                                        )}
                                        <div className="flex gap-3 mt-2 text-xs text-slate-500">
                                            {t.category && (
                                                <span className="bg-slate-100 px-2 py-0.5 rounded-full">{t.category}</span>
                                            )}
                                            {t.estimated_days && (
                                                <span>⏱ {t.estimated_days}d</span>
                                            )}
                                            <span className="text-slate-400">{t.items?.length || 0} ítem(s)</span>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-lg font-bold text-blue-600">
                                            ${totalPrice(t).toFixed(2)}
                                        </p>
                                        <button
                                            onClick={() => { onAddTemplate(t); onClose(); }}
                                            className="mt-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                                        >
                                            <Plus size={12} /> Agregar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────────────────
   WIZARD PRINCIPAL
───────────────────────────────────────────────────── */
const ServiceOrderWizard = ({ isOpen, onClose, onSuccess }) => {
    const { business }   = useConfig();
    const paperWidth     = business?.paper_width || '80';
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading]         = useState(false);
    const [isQuickCustomerOpen, setIsQuickCustomerOpen] = useState(false);

    // Warranty
    const [warrantyPolicies, setWarrantyPolicies] = useState([]);
    const [selectedWarrantyId, setSelectedWarrantyId] = useState('');

    // Técnico asignado a la orden
    const [technicians, setTechnicians] = useState([]);
    const [selectedTechnicianId, setSelectedTechnicianId] = useState('');

    // Customer search
    const [customers, setCustomers]     = useState([]);
    const [searchTerm, setSearchTerm]   = useState('');
    const [showResults, setShowResults] = useState(false);

    // ── Nuevas features ──────────────────────────────
    const [serviceTemplates, setServiceTemplates]     = useState([]);
    const [showTemplateDrawer, setShowTemplateDrawer] = useState(false);
    const [cartItems, setCartItems]                   = useState([]);   // items que irán en la orden
    const [partSearch, setPartSearch]                 = useState('');
    const [partResults, setPartResults]               = useState([]);
    const [partLoading, setPartLoading]               = useState(false);
    // ─────────────────────────────────────────────────

    const [formData, setFormData] = useState({
        customer: null,
        device_type: 'SMARTPHONE',
        brand: '', model: '', serial_imei: '',
        passcode_pattern: '', passcode_enabled: false,
        problem_description: '', physical_condition: '',
    });

    // Cargar garantías y plantillas al abrir
    useEffect(() => {
        if (!isOpen) return;
        apiClient.get('/users/').then(res => {
            const users = Array.isArray(res.data) ? res.data : [];
            setTechnicians(users.filter(u => u.is_active));
        }).catch(() => {});

        apiClient.get('/warranties/policies').then(res => {
            setWarrantyPolicies(res.data || []);
            const def = (res.data || []).find(p => p.is_default);
            if (def) setSelectedWarrantyId(String(def.id));
        }).catch(() => {});

        apiClient.get('/service-templates').then(res => {
            setServiceTemplates(res.data || []);
        }).catch(() => {});
    }, [isOpen]);

    // Buscar clientes
    useEffect(() => {
        const t = setTimeout(async () => {
            if (searchTerm.length > 2) {
                try {
                    const res = await apiClient.get(`/customers/?q=${searchTerm}`);
                    setCustomers(res.data.items || []);
                    setShowResults(true);
                } catch { setCustomers([]); }
            } else {
                setCustomers([]); setShowResults(false);
            }
        }, 400);
        return () => clearTimeout(t);
    }, [searchTerm]);

    // Buscar repuestos con debounce
    useEffect(() => {
        if (partSearch.length < 2) { setPartResults([]); return; }
        const t = setTimeout(async () => {
            setPartLoading(true);
            try {
                const res = await apiClient.get(`/products/?search=${encodeURIComponent(partSearch)}&limit=50`);
                const items = res.data?.items || res.data || [];
                setPartResults(Array.isArray(items) ? items : []);
            } catch { setPartResults([]); }
            finally { setPartLoading(false); }
        }, 400);
        return () => clearTimeout(t);
    }, [partSearch]);

    /* ── Handlers carrito ── */
    const addTemplateToCart = (template) => {
        const total = template.items?.reduce(
            (s, i) => s + Number(i.unit_price) * Number(i.quantity), 0
        ) || 0;
        const item = {
            _cartId: `tpl-${template.id}-${Date.now()}`,
            type: 'SERVICE',
            label: template.name,
            unit_price: total,
            quantity: 1,
            description: template.name,
            product_id: null,
        };
        setCartItems(prev => [...prev, item]);
        toast.success(`"${template.name}" agregado`);
    };

    const addPartToCart = (product) => {
        const already = cartItems.find(c => c.product_id === product.id);
        if (already) {
            setCartItems(prev => prev.map(c =>
                c.product_id === product.id ? { ...c, quantity: c.quantity + 1 } : c
            ));
        } else {
            setCartItems(prev => [...prev, {
                _cartId: `prod-${product.id}-${Date.now()}`,
                type: 'PART',
                label: product.name,
                unit_price: Number(product.price || product.sale_price || 0),
                quantity: 1,
                product_id: product.id,
                description: null,
            }]);
        }
        toast.success(`"${product.name}" agregado`);
        setPartSearch('');
        setPartResults([]);
    };

    const removeCartItem = (cartId) =>
        setCartItems(prev => prev.filter(c => c._cartId !== cartId));

    const cartTotal = cartItems.reduce((s, c) => s + c.unit_price * c.quantity, 0);

    /* ── Navigation ── */
    const handleNextStep = () => {
        if (currentStep === 0 && !formData.customer) { toast.error('Selecciona un cliente'); return; }
        if (currentStep === 1 && (!formData.brand || !formData.model)) { toast.error('Marca y Modelo son obligatorios'); return; }
        if (currentStep === 2 && !formData.problem_description) { toast.error('Describe el problema'); return; }
        setCurrentStep(p => p + 1);
    };

    const handleCustomerSelect = (customer) => {
        setFormData(prev => ({ ...prev, customer }));
        setSearchTerm(`${customer.name} (${customer.id_number || 'N/A'})`);
        setShowResults(false);
    };

    /* ── Submit ── */
    const handleSubmit = async () => {
        if (!formData.customer) { toast.error('Falta cliente'); return; }
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
                technician_id: selectedTechnicianId ? parseInt(selectedTechnicianId) : null,
                warranty_policy_id: selectedWarrantyId ? parseInt(selectedWarrantyId) : null,
                items: cartItems.map(c => ({
                    product_id: c.product_id || null,
                    description: c.description || c.label,
                    quantity: String(c.quantity),
                    unit_price: String(c.unit_price),
                })),
                payments: [],
            };

            const res = await apiClient.post('/services/orders', payload);
            toast.success(`Orden ${res.data.ticket_number} creada`);

            try {
                const printRes = await apiClient.get(
                    `/services/orders/${res.data.id}/print/thermal?width=${paperWidth}`
                );
                await printerService.printRaw(printRes.data);
            } catch { toast('Ticket no impreso', { icon: '🖨️' }); }

            // Reset completo
            setCurrentStep(0);
            setCartItems([]);
            setPartSearch('');
            setPartResults([]);
            setFormData({
                customer: null, device_type: 'SMARTPHONE',
                brand: '', model: '', serial_imei: '',
                passcode_pattern: '', passcode_enabled: false,
                problem_description: '', physical_condition: '',
            });
            setSearchTerm('');
            setSelectedTechnicianId('');
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
    const quickTemplates = serviceTemplates.slice(0, 3);

    return (
        <>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

                {/* ── Header ── */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-2xl shrink-0">
                    <h2 className="text-2xl font-bold mb-3">Crear Orden de Servicio</h2>
                    <div className="flex gap-2 items-center">
                        {steps.map((step, idx) => (
                            <div key={step} className="flex items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm
                                    ${idx <= currentStep ? 'bg-white text-blue-600' : 'bg-blue-400 text-white'}`}>
                                    {idx < currentStep ? '✓' : idx + 1}
                                </div>
                                {idx < steps.length - 1 && (
                                    <div className={`w-8 h-0.5 ${idx < currentStep ? 'bg-white' : 'bg-blue-400'}`} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Content (scrollable) ── */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* ════════ PASO 1: CLIENTE ════════ */}
                    {currentStep === 0 && (
                        <div className="space-y-5">
                            <h3 className="text-xl font-bold text-gray-800">Paso 1 — Cliente</h3>
                            <div className="relative">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Buscar cliente *</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                    <input type="text" placeholder="Nombre o Cédula..."
                                        className="w-full pl-10 pr-4 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)} />
                                </div>
                                {showResults && customers.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border-2 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                        {customers.map(c => (
                                            <div key={c.id} onClick={() => handleCustomerSelect(c)}
                                                className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-0">
                                                <div className="font-semibold text-gray-800">{c.name}</div>
                                                <div className="text-xs text-gray-500">ID: {c.id_number} · Tel: {c.phone || 'N/A'}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {formData.customer && (
                                <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                                    <p className="font-semibold text-blue-900">✓ Cliente seleccionado</p>
                                    <p className="text-blue-800">{formData.customer.name}</p>
                                    <p className="text-sm text-blue-600">Tel: {formData.customer.phone || 'Sin teléfono'}</p>
                                </div>
                            )}
                            <div className="border-t pt-4">
                                <button onClick={() => setIsQuickCustomerOpen(true)}
                                    className="w-full py-3 bg-indigo-50 text-indigo-600 rounded-lg font-semibold hover:bg-indigo-100 flex items-center justify-center gap-2 transition-colors">
                                    <Plus size={18} /> Crear nuevo cliente
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ════════ PASO 2: EQUIPO ════════ */}
                    {currentStep === 1 && (
                        <div className="space-y-5">
                            <h3 className="text-xl font-bold text-gray-800">Paso 2 — Equipo</h3>
                            <div className="grid grid-cols-2 gap-3">
                                {DEVICE_TYPES.map(dt => (
                                    <button key={dt.id}
                                        onClick={() => setFormData(p => ({ ...p, device_type: dt.id }))}
                                        className={`p-4 rounded-xl border-2 font-semibold transition-all text-center
                                            ${formData.device_type === dt.id
                                                ? 'bg-purple-100 border-purple-500 text-purple-700'
                                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                                        <div className="text-2xl mb-1">{dt.icon}</div>{dt.label}
                                    </button>
                                ))}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Marca *</label>
                                    <input type="text" value={formData.brand}
                                        onChange={e => setFormData(p => ({ ...p, brand: e.target.value }))}
                                        placeholder="Samsung"
                                        className="w-full p-2 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Modelo *</label>
                                    <input type="text" value={formData.model}
                                        onChange={e => setFormData(p => ({ ...p, model: e.target.value }))}
                                        placeholder="A52"
                                        className="w-full p-2 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Serial / IMEI (Opcional)</label>
                                <input type="text" value={formData.serial_imei}
                                    onChange={e => setFormData(p => ({ ...p, serial_imei: e.target.value }))}
                                    placeholder="IMEI o Serial"
                                    className="w-full p-2 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm" />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input type="checkbox" checked={formData.passcode_enabled}
                                        onChange={e => setFormData(p => ({ ...p, passcode_enabled: e.target.checked }))}
                                        className="w-5 h-5" />
                                    <span className="font-semibold text-gray-700">¿Tiene patrón de desbloqueo?</span>
                                </label>
                                {formData.passcode_enabled && (
                                    <input type="text" value={formData.passcode_pattern}
                                        onChange={e => setFormData(p => ({ ...p, passcode_pattern: e.target.value }))}
                                        placeholder="Ej: 1234 o L desde arriba izq"
                                        className="w-full mt-2 p-2 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Estado Físico del Equipo</label>
                                <textarea
                                    rows={3}
                                    placeholder="Ej: Pantalla rayada, carcasa en buen estado, botón de volumen dañado..."
                                    value={formData.physical_condition}
                                    onChange={e => setFormData(p => ({ ...p, physical_condition: e.target.value }))}
                                    className="w-full p-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-400 outline-none resize-none text-sm text-gray-700 placeholder-gray-400"
                                />
                            </div>
                        </div>
                    )}

                    {/* ════════ PASO 3: DIAGNÓSTICO + SERVICIOS + REPUESTOS ════════ */}
                    {currentStep === 2 && (
                        <div className="space-y-6">
                            <h3 className="text-xl font-bold text-gray-800">Paso 3 — Diagnóstico y Servicios</h3>

                            {/* Descripción */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Descripción del Problema *
                                </label>
                                <div className="grid grid-cols-2 gap-2 mb-3">
                                    {COMMON_ISSUES.map(issue => (
                                        <button key={issue}
                                            onClick={() => setFormData(p => ({ ...p, problem_description: issue }))}
                                            className={`p-2 rounded-lg border text-sm transition-all text-left
                                                ${formData.problem_description === issue
                                                    ? 'bg-orange-100 border-orange-400 text-orange-800 font-semibold'
                                                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-orange-50 hover:border-orange-300'}`}>
                                            {issue}
                                        </button>
                                    ))}
                                </div>
                                <textarea value={formData.problem_description}
                                    onChange={e => setFormData(p => ({ ...p, problem_description: e.target.value }))}
                                    rows={3} placeholder="O escribe el problema aquí..."
                                    className="w-full p-3 border-2 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none resize-none text-sm" />
                                <p className="text-xs text-gray-400 mt-1">{formData.problem_description.length}/500</p>
                            </div>

                            {/* ── SECCIÓN SERVICIOS ── */}
                            <div className="border-2 border-blue-100 rounded-xl p-4 space-y-3 bg-blue-50/40">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Zap size={18} className="text-blue-600" />
                                        <span className="font-bold text-slate-800">Servicios</span>
                                        <span className="text-xs text-slate-500">(opcional)</span>
                                    </div>
                                    {serviceTemplates.length > 0 && (
                                        <button onClick={() => setShowTemplateDrawer(true)}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                                            <Search size={12} /> Ver todas ({serviceTemplates.length})
                                        </button>
                                    )}
                                </div>

                                {serviceTemplates.length === 0 ? (
                                    <p className="text-sm text-slate-500 text-center py-2">
                                        Sin plantillas aún. Créalas en "Plantillas" desde el dashboard.
                                    </p>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        {quickTemplates.map(t => {
                                            const total = t.items?.reduce(
                                                (s, i) => s + Number(i.unit_price) * Number(i.quantity), 0
                                            ) || 0;
                                            const added = cartItems.some(c => c._cartId?.startsWith(`tpl-${t.id}-`));
                                            return (
                                                <button key={t.id}
                                                    onClick={() => !added && addTemplateToCart(t)}
                                                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                                                        added
                                                            ? 'bg-green-50 border-green-400 cursor-default'
                                                            : 'bg-white border-slate-200 hover:border-blue-400 hover:bg-blue-50'
                                                    }`}>
                                                    <p className="font-semibold text-slate-800 text-sm truncate">{t.name}</p>
                                                    <p className="text-blue-600 font-bold text-sm mt-1">${total.toFixed(2)}</p>
                                                    {added
                                                        ? <span className="text-xs text-green-600 font-semibold">✓ Agregado</span>
                                                        : <span className="text-xs text-slate-400">Toca para agregar</span>}
                                                </button>
                                            );
                                        })}
                                        {serviceTemplates.length > 3 && (
                                            <button onClick={() => setShowTemplateDrawer(true)}
                                                className="p-3 rounded-xl border-2 border-dashed border-blue-300 text-blue-600 text-sm font-semibold hover:bg-blue-50 transition-all flex flex-col items-center justify-center gap-1">
                                                <ChevronDown size={16} />
                                                +{serviceTemplates.length - 3} más
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ── SECCIÓN REPUESTOS ── */}
                            <div className="border-2 border-slate-200 rounded-xl p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                    <Package size={18} className="text-slate-600" />
                                    <span className="font-bold text-slate-800">Repuestos del Inventario</span>
                                    <span className="text-xs text-slate-500">(opcional)</span>
                                </div>
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                    <input type="text" value={partSearch}
                                        onChange={e => setPartSearch(e.target.value)}
                                        placeholder="Buscar repuesto por nombre..."
                                        className="w-full pl-9 pr-4 py-2 border-2 rounded-lg focus:ring-2 focus:ring-slate-400 outline-none text-sm" />
                                </div>
                                {partLoading && (
                                    <p className="text-xs text-slate-500 text-center">Buscando...</p>
                                )}
                                {partResults.length > 0 && (
                                    <div className="border rounded-xl overflow-hidden divide-y max-h-48 overflow-y-auto">
                                        {partResults.map(p => (
                                            <div key={p.id}
                                                className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                                                    <p className="text-xs text-slate-500">
                                                        Stock: {p.stock ?? '—'} · ${Number(p.price || p.sale_price || 0).toFixed(2)}
                                                    </p>
                                                </div>
                                                <button onClick={() => addPartToCart(p)}
                                                    className="ml-3 p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shrink-0">
                                                    <Plus size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* ── CARRITO ── */}
                            {cartItems.length > 0 && (
                                <div className="border-2 border-emerald-200 rounded-xl p-4 bg-emerald-50/40 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <ShoppingCart size={18} className="text-emerald-700" />
                                        <span className="font-bold text-slate-800">
                                            Carrito ({cartItems.length} ítem{cartItems.length > 1 ? 's' : ''})
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {cartItems.map(c => (
                                            <div key={c._cartId}
                                                className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2">
                                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                                    <span className="text-base">{c.type === 'SERVICE' ? '⚡' : '🔩'}</span>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-slate-800 truncate">{c.label}</p>
                                                        <p className="text-xs text-slate-500">
                                                            {c.quantity}x · ${c.unit_price.toFixed(2)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                                    <span className="font-bold text-slate-700 text-sm">
                                                        ${(c.unit_price * c.quantity).toFixed(2)}
                                                    </span>
                                                    <button onClick={() => removeCartItem(c._cartId)}
                                                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-between items-center pt-2 border-t border-emerald-200">
                                        <span className="font-semibold text-slate-700">Total estimado</span>
                                        <span className="text-xl font-bold text-emerald-700">${cartTotal.toFixed(2)}</span>
                                    </div>
                                </div>
                            )}

                            {/* Técnico asignado */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Técnico asignado <span className="text-slate-400 font-normal">(opcional)</span>
                                </label>
                                <select value={selectedTechnicianId}
                                    onChange={e => setSelectedTechnicianId(e.target.value)}
                                    className="w-full p-2 border-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm">
                                    <option value="">— Asignar después —</option>
                                    {technicians.map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.full_name || u.username}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-slate-400 mt-1">
                                    También puedes asignarlo al agregar ítems individuales.
                                </p>
                            </div>

                            {/* Garantía */}
                            {warrantyPolicies.length > 0 && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Política de Garantía</label>
                                    <select value={selectedWarrantyId}
                                        onChange={e => setSelectedWarrantyId(e.target.value)}
                                        className="w-full p-2 border-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
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

                    {/* ════════ PASO 4: CONFIRMACIÓN ════════ */}
                    {currentStep === 3 && (
                        <div className="space-y-5">
                            <h3 className="text-xl font-bold text-gray-800">Paso 4 — Confirmación</h3>
                            <p className="text-gray-500 text-sm">Revisa los datos antes de crear la orden.</p>

                            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                                <h4 className="font-bold text-blue-900 mb-1">👤 Cliente</h4>
                                <p className="text-blue-800">{formData.customer?.name}</p>
                                <p className="text-sm text-blue-600">Tel: {formData.customer?.phone || 'N/A'}</p>
                            </div>

                            <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
                                <h4 className="font-bold text-purple-900 mb-1">📱 Equipo</h4>
                                <p className="text-purple-800">{formData.brand} {formData.model}</p>
                                {formData.serial_imei && (
                                    <p className="text-sm text-purple-600 font-mono">Serial: {formData.serial_imei}</p>
                                )}
                                <p className="text-sm text-purple-600">
                                    Estado: {formData.physical_condition || 'No especificado'}
                                </p>
                            </div>

                            <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4">
                                <h4 className="font-bold text-orange-900 mb-1">⚠️ Problema</h4>
                                <p className="text-orange-800">{formData.problem_description}</p>
                            </div>

                            {cartItems.length > 0 && (
                                <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4">
                                    <h4 className="font-bold text-emerald-900 mb-2">
                                        🛒 Servicios y Repuestos ({cartItems.length})
                                    </h4>
                                    <div className="space-y-1">
                                        {cartItems.map(c => (
                                            <div key={c._cartId} className="flex justify-between text-sm">
                                                <span className="text-emerald-800">
                                                    {c.type === 'SERVICE' ? '⚡' : '🔩'} {c.label}
                                                </span>
                                                <span className="font-semibold text-emerald-700">
                                                    ${(c.unit_price * c.quantity).toFixed(2)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-2 pt-2 border-t border-emerald-300 flex justify-between font-bold">
                                        <span className="text-emerald-900">Total estimado</span>
                                        <span className="text-emerald-700">${cartTotal.toFixed(2)}</span>
                                    </div>
                                </div>
                            )}

                            {selectedWarrantyId && (
                                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                                    <h4 className="font-bold text-green-900 mb-1">🛡️ Garantía</h4>
                                    <p className="text-green-800">
                                        {warrantyPolicies.find(p => String(p.id) === selectedWarrantyId)?.name}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="border-t bg-gray-50 p-5 flex justify-between gap-4 rounded-b-2xl shrink-0">
                    <button onClick={currentStep === 0 ? onClose : () => setCurrentStep(p => p - 1)}
                        className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors">
                        {currentStep === 0 ? 'Cancelar' : '← Atrás'}
                    </button>

                    {currentStep < 3 ? (
                        <button onClick={handleNextStep}
                            className="px-8 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2">
                            Siguiente <ChevronRight size={18} />
                        </button>
                    ) : (
                        <button onClick={handleSubmit} disabled={loading}
                            className="px-8 py-2 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50">
                            {loading ? 'Creando...' : <><Save size={18} /> Crear Orden</>}
                        </button>
                    )}
                </div>
            </div>
        </div>

        {/* ── Drawer plantillas ── */}
        {showTemplateDrawer && (
            <TemplateDrawer
                templates={serviceTemplates}
                onAddTemplate={addTemplateToCart}
                onClose={() => setShowTemplateDrawer(false)}
            />
        )}

        {/* ── Modal cliente rápido ── */}
        <QuickCustomerModal
            isOpen={isQuickCustomerOpen}
            onClose={() => setIsQuickCustomerOpen(false)}
            onSuccess={handleCustomerSelect}
        />
        </>
    );
};

export default ServiceOrderWizard;
