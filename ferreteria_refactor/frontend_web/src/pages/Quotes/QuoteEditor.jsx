import { useState, useEffect, useRef } from 'react';
import { Search, Save, Trash2, Plus, Minus, User, MapPin, Layers, UserPlus } from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import ProductThumbnail from '../../components/products/ProductThumbnail';
import QuickCustomerModal from '../../components/pos/QuickCustomerModal';
import CustomerSearch from '../../components/pos/CustomerSearch'; // Import
import { useConfig } from '../../context/ConfigContext';

const QuoteEditor = ({ quoteId, onBack }) => {
    // State
    const [searchTerm, setSearchTerm] = useState('');
    const [catalog, setCatalog] = useState([]);
    const [cart, setCart] = useState([]); // Local cart for quote
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [customers, setCustomers] = useState([]); // New state for customers

    // Refs
    const searchRef = useRef(null);

    // Config
    const { currencies } = useConfig();
    const anchorCurrency = currencies.find(c => c.is_anchor) || { symbol: '$' };

    // Load initial data (Catalog + Quote if editing)
    useEffect(() => {
        fetchCatalog();
        fetchCustomers(); // Fetch customers
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
            // Restore Items
            // Note: Mapping might depend on how backend returns items.
            // Assuming simplified mapping for now.
            const mappedItems = data.items.map(item => ({
                id: item.product_id,
                name: item.product?.name || "Producto Desconocido",
                quantity: item.quantity,
                unit_price: item.unit_price,
                subtotal: item.subtotal,
                image_url: item.product?.image_url,
                price: item.unit_price // Fallback
            }));
            setCart(mappedItems);
            
            // Restore Customer
            if (data.customer) {
                setSelectedCustomer(data.customer);
            }
            
            // Restore Notes
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
    ).slice(0, 20); // Limit to 20 for perf

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
        setSearchTerm(''); // Clear search after add
        searchRef.current?.focus();
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
                    is_box: false // Simplified for now
                }))
            };

            await apiClient.post('/quotes', payload);
            toast.success("Cotización Guardada");
            onBack(); // Return to list
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar cotización");
        } finally {
            setSaving(false);
        }
    };

    const totalAmount = cart.reduce((sum, item) => sum + Number(item.subtotal), 0);
    
    // Handle new customer creation from modal
    const handleCustomerCreated = (newCustomer) => {
        setCustomers(prev => [...prev, newCustomer]);
        setSelectedCustomer(newCustomer);
    };

    return (
        <div className="h-full flex flex-col md:flex-row">
            {/* LEFT: Catalog (60%) */}
            <div className="flex-1 bg-slate-50 flex flex-col p-4 overflow-hidden border-r border-gray-200">
                {/* Search Bar */}
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                    <input
                        ref={searchRef}
                        type="text"
                        placeholder="Buscar productos (nombre o código)..."
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 shadow-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        autoFocus
                    />
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 content-start pb-20">
                    {filteredCatalog.map(product => (
                        <div
                            key={product.id}
                            onClick={() => addToCart(product)}
                            className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all group"
                        >
                            <div className="mb-2">
                                <ProductThumbnail
                                    imageUrl={product.image_url}
                                    productName={product.name}
                                    updatedAt={product.updated_at}
                                    size="sm"
                                />
                            </div>
                            <h4 className="font-bold text-gray-700 text-sm line-clamp-2 leading-tight mb-1">{product.name}</h4>

                            {/* SKU & Location */}
                            <div className="flex flex-wrap gap-1 mb-2">
                                <span className="text-[10px] bg-slate-100 px-1.5 rounded text-slate-500 font-mono">{product.sku}</span>
                                {product.location && (
                                    <span className="text-[10px] bg-yellow-50 text-yellow-700 border border-yellow-100 px-1 rounded flex items-center gap-0.5">
                                        <MapPin size={8} /> {product.location}
                                    </span>
                                )}
                            </div>

                            <div className="flex justify-between items-end mt-auto">
                                <span className="font-black text-gray-800">{anchorCurrency.symbol}{Number(product.price).toFixed(2)}</span>
                                <div className="text-[10px] text-gray-500">
                                    Stock: {Number(product.stock).toFixed(0)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* RIGHT: Quote Builder (40%) */}
            <div className="w-full md:w-[400px] xl:w-[450px] bg-white flex flex-col shadow-xl z-20">
                {/* Customer Section */}
                <div className="p-4 bg-slate-50 border-b border-gray-200">
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cliente</label>
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
                            className="bg-blue-100 text-blue-600 p-3 rounded-lg hover:bg-blue-200 transition-colors"
                            title="Crear Nuevo Cliente"
                        >
                            <UserPlus size={20} />
                        </button>
                     </div>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {cart.map(item => (
                        <div key={item.id} className="flex gap-3 py-3 border-b border-gray-100 group">
                            <div className="flex-1">
                                <div className="font-bold text-gray-800 text-sm">{item.name}</div>
                                <div className="text-xs text-blue-600 font-medium">
                                    {anchorCurrency.symbol}{Number(item.unit_price).toFixed(2)} x unidad
                                </div>
                            </div>

                            {/* Qty Controls */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center bg-slate-100 rounded-lg">
                                    <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:bg-slate-200 rounded-l-lg"><Minus size={14} /></button>
                                    <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                                    <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:bg-slate-200 rounded-r-lg"><Plus size={14} /></button>
                                </div>
                                <div className="flex flex-col items-end min-w-[60px]">
                                    <span className="font-bold text-gray-900">{anchorCurrency.symbol}{Number(item.subtotal).toFixed(2)}</span>
                                </div>
                                <button onClick={() => removeItem(item.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {cart.length === 0 && (
                        <div className="text-center text-gray-400 py-10 italic text-sm">
                            Agrega productos desde el catálogo
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-4 border-t border-gray-200 bg-slate-50 space-y-3">
                    <textarea
                        className="w-full text-sm p-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                        rows="2"
                        placeholder="Notas para la cotización (ej: Válido por 5 días)..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                    ></textarea>

                    <div className="flex justify-between items-center text-lg font-bold text-gray-800 px-2">
                        <span>Total:</span>
                        <span className="text-2xl">{anchorCurrency.symbol}{totalAmount.toFixed(2)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={onBack}
                            className="w-full py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={cart.length === 0 || saving}
                            className={`w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition-all ${saving ? 'opacity-70' : ''}`}
                        >
                            <Save size={18} />
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
