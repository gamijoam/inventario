import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Trash2, Save, X, AlertCircle, Package, DollarSign, Calendar, FileText, ChevronDown, Check, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';

// Helper to format stock
const formatStock = (stock) => {
    const num = Number(stock);
    return num % 1 === 0 ? num.toFixed(0) : num.toFixed(3).replace(/\.?0+$/, '');
};

const CreatePurchase = () => {
    const navigate = useNavigate();
    const searchInputRef = useRef(null);
    const productSearchRef = useRef(null);

    // State
    const [suppliers, setSuppliers] = useState([]);
    const [products, setProducts] = useState([]);
    const [selectedSupplier, setSelectedSupplier] = useState(null);
    const [supplierSearch, setSupplierSearch] = useState('');
    const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

    const [invoiceData, setInvoiceData] = useState({
        invoice_number: '',
        purchase_date: new Date().toISOString().split('T')[0],
        due_date: '',
        notes: ''
    });

    const [purchaseItems, setPurchaseItems] = useState([]);
    const [productSearch, setProductSearch] = useState('');
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [paymentType, setPaymentType] = useState('CREDIT'); // CASH or CREDIT
    const [showCostUpdateModal, setShowCostUpdateModal] = useState(null);

    // Load suppliers and products
    const fetchSuppliers = async () => {
        try {
            const response = await apiClient.get('/suppliers');
            setSuppliers(response.data);
        } catch (error) {
            console.error('Error fetching suppliers:', error);
            toast.error('Error al cargar proveedores');
        }
    };

    const fetchProducts = async () => {
        try {
            const response = await apiClient.get('/products');
            setProducts(response.data);
        } catch (error) {
            console.error('Error fetching products:', error);
            toast.error('Error al cargar productos');
        }
    };

    useEffect(() => {
        fetchSuppliers();
        fetchProducts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Filter suppliers
    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(supplierSearch.toLowerCase())
    );

    // Handle supplier selection
    const handleSupplierSelect = (supplier) => {
        setSelectedSupplier(supplier);
        setSupplierSearch(supplier.name);
        setShowSupplierDropdown(false);

        // Calculate due date based on payment terms
        if (supplier.payment_terms) {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + supplier.payment_terms);
            setInvoiceData(prev => ({
                ...prev,
                due_date: dueDate.toISOString().split('T')[0]
            }));
        }
    };

    // Filter products for search
    useEffect(() => {
        if (productSearch) {
            const filtered = products.filter(p =>
                p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase()))
            );
            setFilteredProducts(filtered);
        } else {
            setFilteredProducts([]);
        }
    }, [productSearch, products]);

    // Add product to purchase
    const handleAddProduct = (product) => {
        const existingItem = purchaseItems.find(item => item.product_id === product.id);

        if (existingItem) {
            setPurchaseItems(prev => prev.map(item =>
                item.product_id === product.id
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ));
        } else {
            setPurchaseItems(prev => [...prev, {
                product_id: product.id,
                product_name: product.name,
                quantity: 1,
                unit_cost: Number(product.cost_price) || 0,
                original_cost: Number(product.cost_price) || 0,
                current_price: Number(product.price) || 0,
                profit_margin: Number(product.profit_margin) || 0,
                tax_rate: Number(product.tax_rate) || 0,
                subtotal: Number(product.cost_price) || 0
            }]);
        }

        setProductSearch('');
        setFilteredProducts([]);
        productSearchRef.current?.focus();
        toast.success('Producto agregado');
    };

    // Update item quantity
    const handleQuantityChange = (productId, quantity) => {
        setPurchaseItems(prev => prev.map(item =>
            item.product_id === productId
                ? { ...item, quantity: parseFloat(quantity) || 0, subtotal: (parseFloat(quantity) || 0) * item.unit_cost }
                : item
        ));
    };

    // Update item cost
    const handleCostChange = (productId, cost) => {
        const item = purchaseItems.find(i => i.product_id === productId);
        const newCost = parseFloat(cost) || 0;

        setPurchaseItems(prev => prev.map(i =>
            i.product_id === productId
                ? { ...i, unit_cost: newCost, subtotal: i.quantity * newCost }
                : i
        ));

        // Show modal if cost changed
        if (item && newCost !== item.original_cost && newCost > 0) {
            setShowCostUpdateModal({
                productId,
                newCost,
                originalCost: item.original_cost,
                productName: item.product_name,
                profitMargin: item.profit_margin,
                taxRate: item.tax_rate,
                updatePrice: false,
                newSalePrice: null
            });
        }
    };

    // Remove item
    const handleRemoveItem = (productId) => {
        setPurchaseItems(prev => prev.filter(item => item.product_id !== productId));
        toast.success('Producto eliminado de la lista');
    };

    // Calculate total
    const total = purchaseItems.reduce((sum, item) => sum + item.subtotal, 0);

    // Submit purchase
    const handleSubmit = async () => {
        if (!selectedSupplier) {
            toast.error('Selecciona un proveedor');
            return;
        }

        if (purchaseItems.length === 0) {
            toast.error('Agrega al menos un producto');
            return;
        }

        try {
            const purchaseData = {
                supplier_id: selectedSupplier.id,
                invoice_number: invoiceData.invoice_number,
                notes: invoiceData.notes,
                total_amount: total,
                items: purchaseItems.map(item => ({
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit_cost: item.unit_cost,
                    update_cost: item.update_cost !== undefined ? item.update_cost : (item.unit_cost !== item.original_cost),
                    update_price: item.update_price || false,
                    new_sale_price: item.new_sale_price || null
                })),
                payment_type: paymentType
            };

            await apiClient.post('/purchases', purchaseData);
            toast.success('Compra registrada exitosamente');
            navigate('/purchases');
        } catch (error) {
            console.error('Error creating purchase:', error);
            toast.error(error.response?.data?.detail || 'Error al registrar compra');
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50 gap-4 p-4">
            {/* TOP HEADER: Invoice & Supplier Info */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex-shrink-0 z-30">
                <div className="flex gap-6 items-start">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-5">
                        {/* Supplier */}
                        <div className="col-span-1 relative">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-1">
                                <FileText size={12} /> Proveedor
                            </label>
                            <div className="relative">
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={supplierSearch}
                                    onChange={(e) => {
                                        setSupplierSearch(e.target.value);
                                        setShowSupplierDropdown(true);
                                    }}
                                    onFocus={() => setShowSupplierDropdown(true)}
                                    className={clsx(
                                        "w-full p-2.5 border rounded-xl font-medium outline-none text-sm transition-all shadow-sm",
                                        selectedSupplier
                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                            : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                                    )}
                                    placeholder="Buscar proveedor..."
                                />
                                {selectedSupplier && (
                                    <div className="absolute right-3 top-2.5 text-emerald-600 animate-in zoom-in">
                                        <Check size={16} strokeWidth={3} />
                                    </div>
                                )}
                            </div>
                            {showSupplierDropdown && filteredSuppliers.length > 0 && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95">
                                    {filteredSuppliers.map(supplier => (
                                        <div
                                            key={supplier.id}
                                            onClick={() => handleSupplierSelect(supplier)}
                                            className="p-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-0 text-sm transition-colors"
                                        >
                                            <div className="font-bold text-slate-800">{supplier.name}</div>
                                            <div className="text-xs text-slate-500 mt-0.5">Crédito: {supplier.payment_terms} días</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Invoice Data */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-1">
                                <Package size={12} /> Nro. Factura
                            </label>
                            <input
                                type="text"
                                value={invoiceData.invoice_number}
                                onChange={(e) => setInvoiceData(prev => ({ ...prev, invoice_number: e.target.value }))}
                                className="w-full p-2.5 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-sm transition-all"
                                placeholder="Ej: 001-230"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-1">
                                <Calendar size={12} /> Fecha Emisión
                            </label>
                            <input
                                type="date"
                                value={invoiceData.purchase_date}
                                onChange={(e) => setInvoiceData(prev => ({ ...prev, purchase_date: e.target.value }))}
                                className="w-full p-2.5 border border-slate-200 rounded-xl outline-none text-sm text-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-sm transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-1">
                                <AlertCircle size={12} /> Vencimiento
                            </label>
                            <input
                                type="date"
                                value={invoiceData.due_date}
                                onChange={(e) => setInvoiceData(prev => ({ ...prev, due_date: e.target.value }))}
                                className={clsx(
                                    "w-full p-2.5 border rounded-xl outline-none text-sm shadow-sm transition-all",
                                    new Date(invoiceData.due_date) < new Date()
                                        ? 'border-rose-200 bg-rose-50 text-rose-800'
                                        : 'border-slate-200 text-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                                )}
                            />
                        </div>
                    </div>

                    {/* Totals Widget */}
                    <div className="w-72 bg-slate-900 rounded-2xl p-4 text-white shadow-lg shadow-slate-200 flex-shrink-0 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <DollarSign size={64} />
                        </div>
                        <div className="relative z-10">
                            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Total Factura</div>
                            <div className="text-3xl font-black tracking-tight mb-2 flex items-baseline gap-1">
                                <span className="text-lg text-slate-500 font-bold">$</span>
                                {Number(total).toFixed(2)}
                            </div>
                            <div className="flex items-center justify-between bg-slate-800/50 rounded-lg p-2 backdrop-blur-sm">
                                <span className="text-xs text-slate-400 font-medium">Items: {purchaseItems.length}</span>
                                <span className={clsx(
                                    "text-xs font-bold px-2 py-0.5 rounded-md",
                                    paymentType === 'CREDIT' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                                )}>
                                    {paymentType === 'CREDIT' ? 'Crédito' : 'Contado'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT: Items & Search */}
            <div className="flex-1 flex gap-4 overflow-hidden">
                {/* LEFT: Items List */}
                <div className="flex-1 flex flex-col overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-sm">
                    {/* Search Bar */}
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 z-20">
                        <div className="relative">
                            <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
                            <input
                                ref={productSearchRef}
                                type="text"
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-lg hover:border-indigo-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-sm placeholder:text-slate-400"
                                placeholder="Escanea el código de barras o escribe para agregar productos..."
                                autoFocus
                            />
                            {/* Autocomplete Dropdown */}
                            {filteredProducts.length > 0 && (
                                <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-100 max-h-[400px] overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2">
                                    {filteredProducts.map(product => (
                                        <div
                                            key={product.id}
                                            onClick={() => handleAddProduct(product)}
                                            className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 flex justify-between items-center group transition-colors"
                                        >
                                            <div>
                                                <div className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{product.name}</div>
                                                <div className="text-xs text-slate-500 flex gap-3 mt-1 font-medium">
                                                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">Stock: {formatStock(product.stock)}</span>
                                                    <span>Costo Prom: ${Number(product.cost_price || 0).toFixed(2)}</span>
                                                    <span className="text-indigo-600">PVP: ${Number(product.price).toFixed(2)}</span>
                                                </div>
                                            </div>
                                            <div className="bg-indigo-50 text-indigo-600 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100">
                                                <Plus size={18} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Table */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                        <table className="w-full text-sm border-collapse">
                            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3 text-left font-bold text-slate-400 uppercase text-xs tracking-wider">Producto</th>
                                    <th className="px-4 py-3 text-center font-bold text-slate-400 uppercase text-xs tracking-wider w-24">Cant.</th>
                                    <th className="px-4 py-3 text-center font-bold text-slate-400 uppercase text-xs tracking-wider w-36">Costo Fact.</th>
                                    <th className="px-4 py-3 text-center font-bold text-indigo-400 uppercase text-xs tracking-wider w-40">Config</th>
                                    <th className="px-4 py-3 text-center font-bold text-amber-500 uppercase text-xs tracking-wider w-32">Nuevo PVP</th>
                                    <th className="px-4 py-3 text-right font-bold text-slate-400 uppercase text-xs tracking-wider w-32">Subtotal</th>
                                    <th className="px-4 py-3 w-12"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {purchaseItems.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="p-16 text-center text-slate-300">
                                            <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
                                                <div className="bg-slate-50 p-6 rounded-full mb-4">
                                                    <Package size={48} strokeWidth={1.5} />
                                                </div>
                                                <p className="text-lg font-bold text-slate-400">Lista de compra vacía</p>
                                                <p className="text-sm font-medium">Agrega productos usando el buscador arriba</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    purchaseItems.map(item => {
                                        // Calculate projected price for display
                                        const projectedPrice = item.unit_cost * (1 + (item.profit_margin || 0) / 100) * (1 + (item.tax_rate || 0) / 100);

                                        return (
                                            <tr key={item.product_id} className="hover:bg-slate-50/80 transition-colors group">
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-slate-800">{item.product_name}</div>
                                                    <div className="text-xs text-slate-400 mt-0.5 font-medium">
                                                        Costo Base: ${Number(item.original_cost).toFixed(2)}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => handleQuantityChange(item.product_id, e.target.value)}
                                                        className="w-full text-center font-bold border border-slate-200 rounded-lg p-1.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-700 hover:border-slate-300"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 relative">
                                                    <div className="relative group/input">
                                                        <span className="absolute left-2 top-1.5 text-slate-400 font-bold text-xs">$</span>
                                                        <input
                                                            type="number"
                                                            value={item.unit_cost}
                                                            onChange={(e) => handleCostChange(item.product_id, e.target.value)}
                                                            className={clsx(
                                                                "w-full pl-5 pr-1 font-bold rounded-lg p-1.5 outline-none text-center text-sm transition-all border",
                                                                item.unit_cost !== item.original_cost
                                                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                                    : 'bg-white text-slate-600 border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                                                            )}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="text-xs flex flex-col gap-1 items-center">
                                                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold whitespace-nowrap border border-indigo-100">
                                                            M: {item.profit_margin}%
                                                        </span>
                                                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold whitespace-nowrap border border-slate-200">
                                                            IVA: {item.tax_rate}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="text-sm font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100" title="Precio calculado con nuevo costo">
                                                        ${projectedPrice.toFixed(2)}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 mt-1 font-medium">
                                                        Actual: ${item.current_price.toFixed(2)}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono font-bold text-slate-700 text-sm">
                                                    ${item.subtotal.toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={() => handleRemoveItem(item.product_id)}
                                                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Footer Totals */}
                    <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-between items-center text-sm text-slate-500 font-medium">
                        <div className="flex gap-4">
                            <span>{purchaseItems.length} líneas de detalle</span>
                        </div>
                        <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
                            <AlertCircle size={14} />
                            <span>Los precios de venta se recalcularán al confirmar costos.</span>
                        </div>
                    </div>
                </div>

                {/* RIGHT SIDEBAR: Actions & Payment */}
                <div className="w-80 flex flex-col gap-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <ArrowRight size={14} className="text-indigo-600" /> Condiciones
                        </h3>

                        <label className="text-xs font-bold text-slate-500 mb-2 block">Método de Pago</label>
                        <div className="grid grid-cols-2 gap-2 mb-5">
                            <button
                                onClick={() => setPaymentType('CASH')}
                                className={clsx(
                                    "py-2.5 px-3 rounded-xl text-sm font-bold border transition-all active:scale-95",
                                    paymentType === 'CASH'
                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                                        : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'
                                )}
                            >
                                Contado
                            </button>
                            <button
                                onClick={() => setPaymentType('CREDIT')}
                                className={clsx(
                                    "py-2.5 px-3 rounded-xl text-sm font-bold border transition-all active:scale-95",
                                    paymentType === 'CREDIT'
                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                                        : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'
                                )}
                            >
                                Crédito
                            </button>
                        </div>

                        <label className="text-xs font-bold text-slate-500 mb-2 block">Notas / Observaciones</label>
                        <textarea
                            value={invoiceData.notes}
                            onChange={(e) => setInvoiceData(prev => ({ ...prev, notes: e.target.value }))}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none h-32 transition-all placeholder:text-slate-400"
                            placeholder="Ej: Mercadería entregada por transporte XYZ..."
                        ></textarea>
                    </div>

                    <div className="flex-1"></div> {/* Spacer */}

                    <div className="space-y-3">
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm mb-2">
                            <div className="flex justify-between mb-2 text-sm font-medium text-slate-500">
                                <span>Subtotal</span>
                                <span>${total.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xl font-black text-slate-800 pt-3 border-t border-slate-100">
                                <span>TOTAL</span>
                                <span>${total.toFixed(2)}</span>
                            </div>
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={!selectedSupplier || purchaseItems.length === 0}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-indigo-200 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0 flex items-center justify-center gap-2 active:scale-95"
                        >
                            <Save size={20} /> Procesar Compra
                        </button>
                        <button
                            onClick={() => navigate('/purchases')}
                            className="w-full bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 py-3 rounded-xl font-bold transition-all shadow-sm active:scale-95"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>

            {/* Price/Cost Update Modal */}
            {showCostUpdateModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 duration-200 border border-slate-200">
                        <div className="flex items-center text-amber-600 mb-6 border-b border-slate-100 pb-4">
                            <div className="bg-amber-100 p-2 rounded-xl mr-3">
                                <AlertCircle size={28} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Cambio de Costo Detectado</h3>
                                <p className="text-sm text-slate-500 font-medium">¿Quieres actualizar el precio de venta?</p>
                            </div>
                        </div>

                        <div className="space-y-5 mb-8">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm">
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Producto</label>
                                <div className="text-slate-800 font-bold text-lg">{showCostUpdateModal.productName}</div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 rounded-xl border border-slate-200 bg-white">
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Anterior</label>
                                    <div className="text-xl font-mono text-slate-400 line-through">${Number(showCostUpdateModal.originalCost).toFixed(2)}</div>
                                </div>
                                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                                    <label className="block text-xs font-bold text-amber-700 uppercase mb-1">Nuevo</label>
                                    <div className="text-2xl font-black font-mono text-amber-700">
                                        ${Number(showCostUpdateModal.newCost).toFixed(2)}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                <div className="flex items-center justify-between mb-3">
                                    <label htmlFor="updatePriceCheck" className="text-sm font-bold text-indigo-900 cursor-pointer select-none">
                                        Actualizar Precio de Venta
                                    </label>
                                    <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full cursor-pointer">
                                        <input
                                            type="checkbox"
                                            id="updatePriceCheck"
                                            className="peer absolute w-full h-full opacity-0 z-10 cursor-pointer"
                                            checked={showCostUpdateModal.updatePrice || false}
                                            onChange={(e) => setShowCostUpdateModal(prev => ({ ...prev, updatePrice: e.target.checked }))}
                                        />
                                        <div className={`peer-checked:bg-indigo-600 w-full h-full bg-slate-300 rounded-full shadow-inner transition-colors`}></div>
                                        <div className={`peer-checked:translate-x-6 absolute left-0 top-0 bg-white w-6 h-6 rounded-full shadow transition-transform duration-200`}></div>
                                    </div>
                                </div>

                                {showCostUpdateModal.updatePrice && (
                                    <div className="animate-in slide-in-from-top-2 duration-200">
                                        <label className="block text-xs font-bold text-indigo-600 mb-1">Nuevo PVP Sugerido</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-indigo-400 font-bold">$</span>
                                            <input
                                                type="number"
                                                className="w-full pl-7 p-2.5 border-2 border-indigo-200 rounded-xl font-bold text-indigo-800 focus:border-indigo-500 outline-none bg-white shadow-sm"
                                                value={showCostUpdateModal.newSalePrice || ''}
                                                onChange={(e) => setShowCostUpdateModal(prev => ({ ...prev, newSalePrice: parseFloat(e.target.value) }))}
                                                placeholder={showCostUpdateModal.profitMargin ? `${(showCostUpdateModal.newCost * (1 + showCostUpdateModal.profitMargin / 100) * (1 + showCostUpdateModal.taxRate / 100)).toFixed(2)}` : '0.00'}
                                            />
                                        </div>
                                        <div className="text-xs text-indigo-500 mt-2 flex items-center gap-1 font-medium bg-indigo-100/50 p-2 rounded-lg">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                            {showCostUpdateModal.profitMargin ? `Margen: ${showCostUpdateModal.profitMargin}% | IVA: ${showCostUpdateModal.taxRate}%` : 'Sin margen configurado'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setShowCostUpdateModal(null)}
                                className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 py-3 rounded-xl font-bold transition-all shadow-sm active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    setPurchaseItems(prev => prev.map(item =>
                                        item.product_id === showCostUpdateModal.productId
                                            ? {
                                                ...item,
                                                update_cost: true,
                                                update_price: showCostUpdateModal.updatePrice || false,
                                                new_sale_price: showCostUpdateModal.newSalePrice || null
                                            }
                                            : item
                                    ));
                                    setShowCostUpdateModal(null);
                                }}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 active:scale-95 transition-all"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreatePurchase;
