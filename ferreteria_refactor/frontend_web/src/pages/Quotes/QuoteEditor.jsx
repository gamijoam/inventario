import React, { useState, useEffect, useRef } from 'react';
import { Search, Save, Trash2, Plus, Minus, User, MapPin, Layers, UserPlus, FileText, ChevronRight, ShoppingCart, ArrowLeft } from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import ProductThumbnail from '../../components/products/ProductThumbnail';
import QuickCustomerModal from '../../components/pos/QuickCustomerModal';
import CustomerSearch from '../../components/pos/CustomerSearch';
import { useConfig } from '../../context/ConfigContext';
import clsx from 'clsx';

const QuoteEditor = ({ quoteId, onBack }) => {
    // State
    const [searchTerm, setSearchTerm] = useState('');
    const [catalog, setCatalog] = useState([]);
    const [cart, setCart] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [customers, setCustomers] = useState([]);

    // Refs
    const searchRef = useRef(null);

    // Config
    const { currencies } = useConfig();
    const anchorCurrency = currencies.find(c => c.is_anchor) || { symbol: '$' };

    // Load initial data
    useEffect(() => {
        fetchCatalog();
        fetchCustomers();
        if (quoteId) {
            loadQuote(quoteId);
        }
    }, [quoteId]);

    const fetchCatalog = async () => {
        try {
            const { data } = await apiClient.get('/products');
            setCatalog(data);
        } catch (error) {
            console.error(error);
            toast.error("Error cargando productos");
        }
    };

    const fetchCustomers = async () => {
        try {
            const { data } = await apiClient.get('/customers');
            setCustomers(data);
        } catch (error) {
            console.error("Error fetching customers:", error);
        }
    };

    const loadQuote = async (id) => {
        try {
            const { data } = await apiClient.get(`/quotes/${id}`);
            const mappedItems = data.items.map(item => ({
                id: item.product_id,
                name: item.product?.name || "Producto Desconocido",
                quantity: item.quantity,
                unit_price: item.unit_price,
                subtotal: item.subtotal,
                image_url: item.product?.image_url,
                price: item.unit_price,
                sku: item.product?.sku
            }));
            setCart(mappedItems);

            if (data.customer) {
                setSelectedCustomer(data.customer);
            }

            setNotes(data.notes || '');
        } catch (error) {
            console.error("Error loading quote:", error);
            toast.error("Error cargando cotización");
        }
    };

    // Filter Logic
    const filteredCatalog = catalog.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 24);

    // Cart Logic
    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item => item.id === product.id
                    ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price }
                    : item
                );
            }
            return [...prev, {
                ...product,
                quantity: 1,
                unit_price: Number(product.price),
                subtotal: Number(product.price)
            }];
        });
        setSearchTerm('');
        searchRef.current?.focus();
        toast.success("Producto agregado");
    };

    const updateQuantity = (id, delta) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = Math.max(1, item.quantity + delta);
                return { ...item, quantity: newQty, subtotal: newQty * Number(item.unit_price) };
            }
            return item;
        }));
    };

    const removeItem = (id) => {
        setCart(prev => prev.filter(item => item.id !== id));
    };

    const handleSave = async () => {
        if (cart.length === 0) return toast.error("La cotización está vacía");

        setSaving(true);
        try {
            const payload = {
                customer_id: selectedCustomer?.id || null,
                total_amount: cart.reduce((sum, item) => sum + item.subtotal, 0),
                notes: notes,
                items: cart.map(item => ({
                    product_id: item.id,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    subtotal: item.subtotal,
                    is_box: false
                }))
            };

            await apiClient.post('/quotes', payload);
            toast.success("Cotización Guardada Exitosamente");
            onBack();
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar cotización");
        } finally {
            setSaving(false);
        }
    };

    const totalAmount = cart.reduce((sum, item) => sum + Number(item.subtotal), 0);

    const handleCustomerCreated = (newCustomer) => {
        setCustomers(prev => [...prev, newCustomer]);
        setSelectedCustomer(newCustomer);
    };

    return (
        <div className="h-full flex flex-col md:flex-row gap-4 p-4 lg:p-0">
            {/* LEFT: Catalog (60-70%) */}
            <div className="flex-1 bg-slate-50 flex flex-col overflow-hidden rounded-2xl border border-slate-200">
                {/* Search Bar */}
                <div className="p-4 bg-white border-b border-slate-200">
                    <div className="relative">
                        <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder="Buscar productos para agregar a la cotización..."
                            className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-inner font-medium text-lg"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredCatalog.map(product => (
                            <div
                                key={product.id}
                                onClick={() => addToCart(product)}
                                className="bg-white rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:border-indigo-400 hover:shadow-md hover:-translate-y-1 transition-all group overflow-hidden flex flex-col h-[260px]"
                            >
                                <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-center items-center h-[140px] relative">
                                    <ProductThumbnail
                                        imageUrl={product.image_url}
                                        productName={product.name}
                                        updatedAt={product.updated_at}
                                        size="lg"
                                        className="w-24 h-24 object-contain transition-transform group-hover:scale-110"
                                    />
                                    <div className="absolute top-2 right-2 bg-indigo-600 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                                        <Plus size={16} strokeWidth={3} />
                                    </div>
                                </div>

                                <div className="p-3 flex-1 flex flex-col justify-between">
                                    <div>
                                        <h4 className="font-bold text-slate-700 text-sm line-clamp-2 leading-tight mb-1.5">{product.name}</h4>
                                        <div className="flex flex-wrap gap-1 mb-2">
                                            <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-mono border border-slate-200">{product.sku}</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-end">
                                        <span className="font-black text-slate-800 text-lg flex items-baseline gap-0.5">
                                            <span className="text-xs text-slate-400">$</span>
                                            {Number(product.price).toFixed(2)}
                                        </span>
                                        <div className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                                            Stock: {Number(product.stock).toFixed(0)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* RIGHT: Quote Builder (30-40%) */}
            <div className="w-full md:w-[400px] xl:w-[480px] bg-white flex flex-col shadow-xl z-20 rounded-2xl border border-slate-200 overflow-hidden">
                {/* Header Actions */}
                <div className="p-4 border-b border-slate-200 bg-slate-50/80 backdrop-blur-sm flex items-center justify-between">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                        title="Volver"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <h2 className="font-bold text-slate-700 flex items-center gap-2">
                        <FileText size={18} className="text-indigo-600" /> Detalle de Cotización
                    </h2>
                </div>

                {/* Customer Section */}
                <div className="p-4 bg-white border-b border-slate-100">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                        <User size={12} /> Cliente
                    </label>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <CustomerSearch
                                customers={customers}
                                selectedCustomer={selectedCustomer}
                                onSelect={setSelectedCustomer}
                            />
                        </div>
                        <button
                            onClick={() => setIsCustomerModalOpen(true)}
                            className="bg-indigo-50 text-indigo-600 p-3 rounded-xl hover:bg-indigo-100 transition-colors border border-indigo-100 shadow-sm"
                            title="Crear Nuevo Cliente"
                        >
                            <UserPlus size={20} />
                        </button>
                    </div>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-50/30">
                    {cart.map(item => (
                        <div key={item.id} className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex gap-3 group">
                            {/* Image Placeholder */}
                            <div className="w-12 h-12 bg-slate-100 rounded-lg flex-shrink-0 flex items-center justify-center p-1">
                                <ProductThumbnail imageUrl={item.image_url} size="xs" />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-slate-800 text-sm truncate">{item.name}</div>
                                <div className="text-xs text-slate-500 font-medium mt-0.5">
                                    {anchorCurrency.symbol}{Number(item.unit_price).toFixed(2)} x unidad
                                </div>
                            </div>

                            {/* Qty Controls & Total */}
                            <div className="flex flex-col items-end gap-2">
                                <div className="font-black text-slate-800 text-base">
                                    ${Number(item.subtotal).toFixed(2)}
                                </div>
                                <div className="flex items-center bg-slate-100 rounded-lg border border-slate-200 p-0.5">
                                    <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600"><Minus size={12} /></button>
                                    <span className="w-6 text-center text-xs font-bold text-slate-700">{item.quantity}</span>
                                    <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:bg-white hover:shadow-sm rounded-md transition-all text-indigo-600"><Plus size={12} /></button>
                                </div>
                            </div>

                            <button
                                onClick={() => removeItem(item.id)}
                                className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 p-1.5 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-100 transition-all pointer-events-none group-hover:pointer-events-auto"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}

                    {cart.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                            <ShoppingCart size={48} className="mb-2" />
                            <p className="text-sm font-medium">Carrito vacío</p>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-5 border-t border-slate-200 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-30">
                    <div className="mb-4">
                        <textarea
                            className="w-full text-sm p-3 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none bg-slate-50 transition-all"
                            rows="2"
                            placeholder="Notas para la cotización (ej: Válido por 5 días)..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                        ></textarea>
                    </div>

                    <div className="flex justify-between items-end mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="text-slate-500 font-bold uppercase text-xs mb-1 block">Total Estimado</span>
                        <span className="text-3xl font-black text-slate-800 leading-none">{anchorCurrency.symbol}{totalAmount.toFixed(2)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={handleSave}
                            disabled={cart.length === 0 || saving}
                            className={clsx(
                                "py-3.5 px-6 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 hover:bg-indigo-700 hover:-translate-y-0.5 active:scale-95 transition-all col-span-2",
                                (saving || cart.length === 0) && "opacity-50 cursor-not-allowed shadow-none translate-y-0"
                            )}
                        >
                            <Save size={20} />
                            {saving ? 'Guardando...' : 'Guardar Cotización'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <QuickCustomerModal
                isOpen={isCustomerModalOpen}
                onClose={() => setIsCustomerModalOpen(false)}
                onSuccess={handleCustomerCreated}
            />
        </div>
    );
};

export default QuoteEditor;
