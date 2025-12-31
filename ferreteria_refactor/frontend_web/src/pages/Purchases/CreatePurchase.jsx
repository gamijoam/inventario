import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Trash2, Save, X, AlertCircle, Package, DollarSign, Calendar, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../config/axios';

// Helper to format stock: show as integer if whole number, otherwise show decimals
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
    useEffect(() => {
        fetchSuppliers();
        fetchProducts();
    }, []);

    const fetchSuppliers = async () => {
        try {
            const response = await apiClient.get('/suppliers');
            setSuppliers(response.data);
        } catch (error) {
            console.error('Error fetching suppliers:', error);
        }
    };

    const fetchProducts = async () => {
        try {
            const response = await apiClient.get('/products');
            setProducts(response.data);
        } catch (error) {
            console.error('Error fetching products:', error);
        }
    };

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
                profit_margin: Number(product.profit_margin) || 0, // NEW
                tax_rate: Number(product.tax_rate) || 0, // NEW
                subtotal: Number(product.cost_price) || 0
            }]);
        }

        setProductSearch('');
        setFilteredProducts([]);
        productSearchRef.current?.focus();
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
                profitMargin: item.profit_margin, // NEW
                taxRate: item.tax_rate, // NEW
                updatePrice: false,
                newSalePrice: null
            });
        }
    };

    // Remove item
    const handleRemoveItem = (productId) => {
        setPurchaseItems(prev => prev.filter(item => item.product_id !== productId));
    };

    // Calculate total
    const total = purchaseItems.reduce((sum, item) => sum + item.subtotal, 0);

    // Submit purchase
    const handleSubmit = async () => {
        if (!selectedSupplier) {
            alert('Selecciona un proveedor');
            return;
        }

        if (purchaseItems.length === 0) {
            alert('Agrega al menos un producto');
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
            alert('Compra registrada exitosamente');
            navigate('/purchases');
        } catch (error) {
            console.error('Error creating purchase:', error);
            alert(error.response?.data?.detail || 'Error al registrar compra');
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-50">
            {/* TOP HEADER: Invoice & Supplier Info */}
            <div className="bg-white border-b px-6 py-4 flex gap-6 items-start shadow-sm flex-shrink-0 z-10">
                <div className="flex-1 grid grid-cols-4 gap-4">
                    {/* Supplier */}
                    <div className="col-span-1 relative">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Proveedor</label>
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
                                className={`w-full p-2 border rounded font-medium outline-none text-sm transition-colors ${selectedSupplier ? 'border-green-500 bg-green-50 text-green-800' : 'border-gray-300 focus:border-blue-500'}`}
                                placeholder="Buscar proveedor..."
                            />
                            {selectedSupplier && (
                                <div className="absolute right-2 top-2 text-green-600">
                                    <FileText size={16} />
                                </div>
                            )}
                        </div>
                        {showSupplierDropdown && filteredSuppliers.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                {filteredSuppliers.map(supplier => (
                                    <div
                                        key={supplier.id}
                                        onClick={() => handleSupplierSelect(supplier)}
                                        className="p-2 hover:bg-blue-50 cursor-pointer border-b text-sm"
                                    >
                                        <div className="font-bold">{supplier.name}</div>
                                        <div className="text-xs text-gray-500">Crédito: {supplier.payment_terms}d</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Invoice Data */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nro. Factura</label>
                        <input
                            type="text"
                            value={invoiceData.invoice_number}
                            onChange={(e) => setInvoiceData(prev => ({ ...prev, invoice_number: e.target.value }))}
                            className="w-full p-2 border border-blue-300 rounded font-bold text-blue-900 outline-none text-sm focus:ring-2 focus:ring-blue-100"
                            placeholder="Ej: 001-230"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha Emisión</label>
                        <input
                            type="date"
                            value={invoiceData.purchase_date}
                            onChange={(e) => setInvoiceData(prev => ({ ...prev, purchase_date: e.target.value }))}
                            className="w-full p-2 border border-gray-300 rounded outline-none text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Vencimiento</label>
                        <input
                            type="date"
                            value={invoiceData.due_date}
                            onChange={(e) => setInvoiceData(prev => ({ ...prev, due_date: e.target.value }))}
                            className={`w-full p-2 border rounded outline-none text-sm ${new Date(invoiceData.due_date) < new Date() ? 'border-red-300 bg-red-50 text-red-800' : 'border-gray-300'}`}
                        />
                    </div>
                </div>

                {/* Totals Widget */}
                <div className="w-64 bg-slate-800 rounded-lg p-3 text-white shadow-lg flex-shrink-0">
                    <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Factura</div>
                    <div className="text-3xl font-bold tracking-tight">${Number(total).toFixed(2)}</div>
                    <div className="text-xs text-slate-400 mt-1 flex justify-between">
                        <span>Items: {purchaseItems.length}</span>
                        <span className={paymentType === 'CREDIT' ? 'text-orange-300' : 'text-green-300'}>
                            {paymentType === 'CREDIT' ? 'Crédito' : 'Contado'}
                        </span>
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT: Items & Search */}
            <div className="flex-1 flex overflow-hidden">
                {/* LEFT: Items List */}
                <div className="flex-1 flex flex-col p-6 overflow-hidden">
                    {/* Search Bar (Big) */}
                    <div className="mb-6 relative">
                        <Search className="absolute left-4 top-4 text-gray-400" size={20} />
                        <input
                            ref={productSearchRef}
                            type="text"
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-white border-2 border-dashed border-gray-300 rounded-xl text-lg hover:border-blue-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-50 outline-none transition-all shadow-sm"
                            placeholder="Escanea el código de barras o escribe para agregar productos..."
                            autoFocus
                        />
                        {/* Autocomplete Dropdown */}
                        {filteredProducts.length > 0 && (
                            <div className="absolute z-20 w-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 max-h-[400px] overflow-y-auto">
                                {filteredProducts.map(product => (
                                    <div
                                        key={product.id}
                                        onClick={() => handleAddProduct(product)}
                                        className="p-3 hover:bg-blue-50 cursor-pointer border-b flex justify-between items-center group"
                                    >
                                        <div>
                                            <div className="font-bold text-gray-800 group-hover:text-blue-700">{product.name}</div>
                                            <div className="text-xs text-gray-500 flex gap-3 mt-1">
                                                <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">Stock: {formatStock(product.stock)}</span>
                                                <span>Costo Prom: ${Number(product.cost_price || 0).toFixed(2)}</span>
                                                <span className="font-semibold text-blue-600">PVP: ${Number(product.price).toFixed(2)}</span>
                                            </div>
                                        </div>
                                        <div className="bg-blue-100 text-blue-600 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Plus size={16} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Table */}
                    <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                        <div className="overflow-y-auto flex-1">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold">Producto</th>
                                        <th className="px-4 py-3 text-center font-semibold w-24">Cant.</th>
                                        <th className="px-4 py-3 text-center font-semibold w-32">Costo Fact.</th>
                                        <th className="px-4 py-3 text-center font-semibold w-40 text-blue-600">Config</th>
                                        <th className="px-4 py-3 text-center font-semibold w-28 text-orange-600">Nuevo PVP</th>
                                        <th className="px-4 py-3 text-right font-semibold w-32">Subtotal</th>
                                        <th className="px-4 py-3 w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {purchaseItems.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="p-10 text-center text-gray-300">
                                                <div className="flex flex-col items-center">
                                                    <Package size={64} className="mb-4 stroke-1" />
                                                    <p className="text-lg font-medium text-gray-400">Lista de compra vacía</p>
                                                    <p className="text-sm">Agrega productos usando el buscador arriba</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        purchaseItems.map(item => {
                                            // Calculate projected price for display
                                            const projectedPrice = item.unit_cost * (1 + (item.profit_margin || 0) / 100) * (1 + (item.tax_rate || 0) / 100);

                                            return (
                                                <tr key={item.product_id} className="hover:bg-blue-50/30 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="font-bold text-gray-800">{item.product_name}</div>
                                                        <div className="text-xs text-gray-400 mt-0.5">
                                                            Costo Base: ${Number(item.original_cost).toFixed(2)}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="number"
                                                            value={item.quantity}
                                                            onChange={(e) => handleQuantityChange(item.product_id, e.target.value)}
                                                            className="w-full text-center font-bold border border-gray-200 rounded p-1 focus:border-blue-500 outline-none"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 relative">
                                                        <div className="relative">
                                                            <span className="absolute left-2 top-1.5 text-gray-400">$</span>
                                                            <input
                                                                type="number"
                                                                value={item.unit_cost}
                                                                onChange={(e) => handleCostChange(item.product_id, e.target.value)}
                                                                className={`w-full pl-6 pr-1 font-bold rounded p-1 outline-none text-center ${item.unit_cost !== item.original_cost ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-gray-50 text-gray-700 border-none'}`}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <div className="text-xs flex flex-col gap-1 items-center">
                                                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                                M: {item.profit_margin}%
                                                            </span>
                                                            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                                IVA: {item.tax_rate}%
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <div className="text-sm font-bold text-gray-700" title="Precio calculado con nuevo costo">
                                                            ${projectedPrice.toFixed(2)}
                                                        </div>
                                                        <div className="text-[10px] text-gray-400">
                                                            (Actual: ${item.current_price.toFixed(2)})
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono font-medium text-gray-700">
                                                        ${item.subtotal.toFixed(2)}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            onClick={() => handleRemoveItem(item.product_id)}
                                                            className="text-gray-400 hover:text-red-500 transition-colors"
                                                        >
                                                            <X size={18} />
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
                        <div className="bg-gray-50 border-t p-4 flex justify-between items-center text-sm text-gray-600">
                            <div>
                                {purchaseItems.length} líneas de detalle
                            </div>
                            <div className="font-medium">
                                * Los precios de venta se recalcularán al confirmar costos.
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT SIDEBAR: Actions & Payment */}
                <div className="w-80 bg-white border-l p-6 flex flex-col gap-6 shadow-xl z-20">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4">Condiciones</h3>

                        <label className="text-xs font-bold text-gray-500 mb-2 block">Método de Pago</label>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            <button
                                onClick={() => setPaymentType('CASH')}
                                className={`py-2 px-3 rounded text-sm font-bold border transition-all ${paymentType === 'CASH' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                            >
                                Contado
                            </button>
                            <button
                                onClick={() => setPaymentType('CREDIT')}
                                className={`py-2 px-3 rounded text-sm font-bold border transition-all ${paymentType === 'CREDIT' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                            >
                                Crédito
                            </button>
                        </div>

                        <label className="text-xs font-bold text-gray-500 mb-2 block">Notas / Observaciones</label>
                        <textarea
                            value={invoiceData.notes}
                            onChange={(e) => setInvoiceData(prev => ({ ...prev, notes: e.target.value }))}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded text-sm focus:bg-white focus:border-blue-400 outline-none resize-none h-24"
                            placeholder="Ej: Mercadería entregada por transporte XYZ..."
                        ></textarea>
                    </div>

                    <div className="mt-auto space-y-3">
                        <div className="bg-gray-100 p-4 rounded-lg mb-4">
                            <div className="flex justify-between mb-2 text-sm text-gray-600">
                                <span>Subtotal</span>
                                <span>${total.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xl font-bold text-slate-800 pt-2 border-t border-gray-200">
                                <span>TOTAL</span>
                                <span>${total.toFixed(2)}</span>
                            </div>
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={!selectedSupplier || purchaseItems.length === 0}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Save size={20} /> Processar
                        </button>
                        <button
                            onClick={() => navigate('/purchases')}
                            className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 py-3 rounded-xl font-bold transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>

            {/* Price/Cost Update Modal */}
            {showCostUpdateModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 duration-200">
                        <div className="flex items-center text-orange-600 mb-6 border-b pb-4">
                            <AlertCircle size={28} className="mr-3" />
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Cambio de Costo Detectado</h3>
                                <p className="text-sm text-gray-500">¿Quieres actualizar el precio de venta?</p>
                            </div>
                        </div>

                        <div className="space-y-5 mb-8">
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Producto</label>
                                <div className="text-gray-900 font-medium text-lg">{showCostUpdateModal.productName}</div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 rounded-lg border border-gray-200">
                                    <label className="block text-xs font-bold text-gray-400 uppercase">Anterior</label>
                                    <div className="text-xl font-mono text-gray-400 line-through">${Number(showCostUpdateModal.originalCost).toFixed(2)}</div>
                                </div>
                                <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                                    <label className="block text-xs font-bold text-orange-700 uppercase">Nuevo</label>
                                    <div className="text-2xl font-bold font-mono text-orange-700">
                                        ${Number(showCostUpdateModal.newCost).toFixed(2)}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <div className="flex items-center justify-between mb-3">
                                    <label htmlFor="updatePriceCheck" className="text-sm font-bold text-blue-900 cursor-pointer select-none">
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
                                        <div className={`peer-checked:bg-blue-600 w-full h-full bg-gray-300 rounded-full shadow-inner transition-colors`}></div>
                                        <div className={`peer-checked:translate-x-6 absolute left-0 top-0 bg-white w-6 h-6 rounded-full shadow transition-transform duration-200`}></div>
                                    </div>
                                </div>

                                {showCostUpdateModal.updatePrice && (
                                    <div className="animate-in slide-in-from-top-2 duration-200">
                                        <label className="block text-xs font-bold text-blue-600 mb-1">Nuevo PVP Sugerido</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-blue-400 font-bold">$</span>
                                            <input
                                                type="number"
                                                className="w-full pl-7 p-2 border-2 border-blue-200 rounded-lg font-bold text-blue-800 focus:border-blue-500 outline-none bg-white"
                                                value={showCostUpdateModal.newSalePrice || ''}
                                                onChange={(e) => setShowCostUpdateModal(prev => ({ ...prev, newSalePrice: parseFloat(e.target.value) }))}
                                                placeholder={showCostUpdateModal.profitMargin ? `${(showCostUpdateModal.newCost * (1 + showCostUpdateModal.profitMargin / 100) * (1 + showCostUpdateModal.taxRate / 100)).toFixed(2)}` : '0.00'}
                                            />
                                        </div>
                                        <div className="text-xs text-blue-400 mt-2 flex items-center gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                                            {showCostUpdateModal.profitMargin ? `Margen: ${showCostUpdateModal.profitMargin}% | IVA: ${showCostUpdateModal.taxRate}%` : 'Sin margen configurado'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setShowCostUpdateModal(null)}
                                className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 py-3 rounded-xl font-bold transition-colors"
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
                                className="bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-bold shadow-lg shadow-slate-200"
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
