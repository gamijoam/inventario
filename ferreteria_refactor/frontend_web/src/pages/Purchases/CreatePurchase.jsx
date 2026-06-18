import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Trash2, Save, X, AlertCircle, Package, DollarSign, Calendar, FileText, ChevronDown, Check, ArrowRight, Barcode, ScanLine } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import HelpDrawer, { HelpButton } from '../../help/HelpDrawer';
import { useHelp } from '../../help/useHelp';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import { getApiErrorMessage } from '../../utils/apiErrors';
import clsx from 'clsx';
import { normalizeSearch } from '../../utils/search';

// Helper to format stock
const formatStock = (stock) => {
    const num = Number(stock);
    return num % 1 === 0 ? num.toFixed(0) : num.toFixed(3).replace(/\.?0+$/, '');
};

const createLineId = (prefix = 'line') => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const toMoney = (value) => Number.parseFloat(value) || 0;

const parseSerials = (value = '') => String(value)
    .split(/[\s,;]+/)
    .map(v => v.trim().toUpperCase())
    .filter(Boolean);

const COLOR_PRESETS = [
    { name: 'Negro', hex: '#111827' },
    { name: 'Blanco', hex: '#F8FAFC' },
    { name: 'Azul', hex: '#2563EB' },
    { name: 'Verde', hex: '#16A34A' },
    { name: 'Rojo', hex: '#DC2626' },
    { name: 'Rosado', hex: '#EC4899' },
    { name: 'Morado', hex: '#7C3AED' },
    { name: 'Dorado', hex: '#D97706' },
];

const getSafeColorHex = (hex) => /^#([0-9a-fA-F]{6})$/.test(hex || '') ? hex : '#cbd5e1';

const getSerialMeta = (item) => {
    const expected = Number.isInteger(toMoney(item.quantity)) ? toMoney(item.quantity) : 0;
    const serials = parseSerials(item.serial_text);
    const duplicates = serials.filter((serial, index) => serials.indexOf(serial) !== index);
    const uniqueDuplicates = [...new Set(duplicates)];
    const missing = Math.max(expected - serials.length, 0);
    return {
        expected,
        captured: serials.length,
        missing,
        duplicates: uniqueDuplicates,
        complete: expected > 0 && serials.length === expected && uniqueDuplicates.length === 0,
    };
};


const SerialCaptureModal = ({ item, onClose, onSave }) => {
    const inputRef = useRef(null);
    const [serials, setSerials] = useState(() => parseSerials(item?.serial_text || ''));
    const [inputValue, setInputValue] = useState('');
    const [message, setMessage] = useState('');
    const [colorName, setColorName] = useState(() => (item?.color_name || '').trim());
    const [colorHex, setColorHex] = useState(() => item?.color_hex || '');

    const expected = Number.isInteger(toMoney(item?.quantity)) ? toMoney(item.quantity) : 0;
    const duplicates = serials.filter((serial, index) => serials.indexOf(serial) !== index);
    const uniqueDuplicates = [...new Set(duplicates)];
    const missing = Math.max(expected - serials.length, 0);
    const complete = expected > 0 && serials.length === expected && uniqueDuplicates.length === 0;
    const safeColorHex = getSafeColorHex(colorHex);
    const effectiveColorName = colorName.trim() || (colorHex ? 'Color personalizado' : '');

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const addSerialTokens = (rawValue) => {
        const tokens = parseSerials(rawValue);
        if (tokens.length === 0) return;

        setSerials(prev => {
            const next = [...prev];
            const rejected = [];
            for (const token of tokens) {
                if (next.includes(token)) {
                    rejected.push(token);
                    continue;
                }
                if (expected && next.length >= expected) {
                    rejected.push(token);
                    continue;
                }
                next.push(token);
            }

            if (rejected.length > 0) {
                setMessage(expected && next.length >= expected
                    ? 'Ya capturaste la cantidad esperada. Ajusta la cantidad si llegaron mas unidades.'
                    : `Duplicados omitidos: ${rejected.slice(0, 3).join(', ')}`
                );
            } else {
                setMessage('');
            }
            return next;
        });
        setInputValue('');
        requestAnimationFrame(() => inputRef.current?.focus());
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            addSerialTokens(inputValue);
        }
    };

    const handlePaste = (event) => {
        const pasted = event.clipboardData?.getData('text') || '';
        if (parseSerials(pasted).length > 1) {
            event.preventDefault();
            addSerialTokens(pasted);
        }
    };

    const removeSerial = (serial) => {
        setSerials(prev => prev.filter(value => value !== serial));
        setMessage('');
        requestAnimationFrame(() => inputRef.current?.focus());
    };

    const handlePresetClick = (preset) => {
        setColorName(preset.name);
        setColorHex(preset.hex);
    };

    const handleSave = () => {
        if (!complete) {
            setMessage(uniqueDuplicates.length > 0
                ? 'Hay IMEIs duplicados. Elimina los repetidos antes de guardar.'
                : `Faltan ${missing} IMEI(s) para completar esta linea.`
            );
            inputRef.current?.focus();
            return;
        }
        onSave({
            serials,
            color_name: colorName.trim() || null,
            color_hex: /^#([0-9a-fA-F]{6})$/.test(colorHex || '') ? colorHex : null,
        });
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-150">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-4">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                            <Barcode size={22} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[11px] font-black uppercase tracking-wide text-indigo-500">Captura serializada</p>
                            <h3 className="truncate text-lg font-black text-slate-900">{item.product_name}</h3>
                            <p className="text-sm font-semibold text-slate-500">Escanea o escribe un IMEI y presiona Enter para continuar.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                        <X size={20} />
                    </button>
                </div>

                <div className="grid grid-cols-3 gap-2 border-b border-slate-100 bg-slate-50 p-3 text-center">
                    <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
                        <div className="text-xl font-black text-slate-900">{expected || 0}</div>
                        <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">Esperados</div>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
                        <div className="text-xl font-black text-emerald-600">{serials.length}</div>
                        <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">Capturados</div>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
                        <div className={clsx('text-xl font-black', missing ? 'text-amber-600' : 'text-emerald-600')}>{missing}</div>
                        <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">Faltan</div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    <div className="rounded-2xl border-2 border-indigo-100 bg-indigo-50/40 p-3 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-100">
                        <div className="flex items-center gap-2">
                            <ScanLine size={22} className="shrink-0 text-indigo-500" />
                            <input
                                ref={inputRef}
                                value={inputValue}
                                onChange={(event) => setInputValue(event.target.value.toUpperCase())}
                                onKeyDown={handleKeyDown}
                                onPaste={handlePaste}
                                disabled={expected > 0 && serials.length >= expected}
                                className="min-w-0 flex-1 bg-transparent px-1 py-2 font-mono text-base font-black text-slate-900 outline-none placeholder:font-semibold placeholder:text-slate-400"
                                placeholder="Escanear IMEI y Enter"
                            />
                            <button
                                type="button"
                                onClick={() => addSerialTokens(inputValue)}
                                disabled={!inputValue.trim() || (expected > 0 && serials.length >= expected)}
                                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Agregar
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p className="text-sm font-black text-slate-900">Color del lote</p>
                                <p className="text-xs font-semibold text-slate-500">Opcional, pero nos sirve para identificar los equipos en seriales y POS.</p>
                            </div>
                            {(effectiveColorName || colorHex) && (
                                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-700">
                                    <span className="h-3 w-3 rounded-full border border-slate-200" style={{ backgroundColor: safeColorHex }} />
                                    <span>{effectiveColorName || safeColorHex}</span>
                                </div>
                            )}
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_120px]">
                            <div>
                                <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-400">Nombre visible</label>
                                <input
                                    value={colorName}
                                    onChange={(event) => setColorName(event.target.value)}
                                    placeholder="Ej: Negro mate, Azul titanio"
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-400">Color</label>
                                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                                    <input
                                        type="color"
                                        value={safeColorHex}
                                        onChange={(event) => setColorHex(event.target.value)}
                                        className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                                    />
                                    <span className="text-xs font-black text-slate-500">{safeColorHex}</span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {COLOR_PRESETS.map((preset) => {
                                const selected = colorName.trim().toLowerCase() === preset.name.toLowerCase() && getSafeColorHex(colorHex) === preset.hex;
                                return (
                                    <button
                                        key={preset.name}
                                        type="button"
                                        onClick={() => handlePresetClick(preset)}
                                        className={clsx(
                                            'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black transition',
                                            selected ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700'
                                        )}
                                    >
                                        <span className="h-3 w-3 rounded-full border border-slate-200" style={{ backgroundColor: preset.hex }} />
                                        <span>{preset.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {message && (
                        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">
                            <AlertCircle size={16} className="mt-0.5 shrink-0" />
                            <span>{message}</span>
                        </div>
                    )}

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50">
                        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                            <div>
                                <p className="text-sm font-black text-slate-900">IMEIs capturados</p>
                                <p className="text-xs font-semibold text-slate-500">Puedes eliminar uno si el scanner leyo algo incorrecto.</p>
                            </div>
                            {serials.length > 0 && (
                                <button onClick={() => setSerials([])} className="text-xs font-black text-rose-600 hover:text-rose-700">Limpiar</button>
                            )}
                        </div>
                        <div className="max-h-64 overflow-y-auto p-3">
                            {serials.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm font-bold text-slate-400">
                                    Aun no hay IMEIs capturados.
                                </div>
                            ) : (
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {serials.map(serial => {
                                        const duplicated = uniqueDuplicates.includes(serial);
                                        return (
                                            <div key={serial} className={clsx('flex items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2 font-mono text-sm font-black', duplicated ? 'border-rose-200 text-rose-700' : 'border-slate-200 text-slate-800')}>
                                                <span className="min-w-0 truncate">{serial}</span>
                                                <button onClick={() => removeSerial(serial)} className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-2 border-t border-slate-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className={clsx('text-sm font-black', complete ? 'text-emerald-600' : 'text-slate-500')}>
                        {complete ? 'Linea completa para registrar la compra.' : 'Completa los IMEIs esperados para poder guardar.'}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-black text-slate-600 hover:bg-slate-50">Cancelar</button>
                        <button onClick={handleSave} disabled={!complete} className="rounded-xl bg-indigo-600 px-5 py-2 font-black text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none">
                            Guardar lote
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const CreatePurchase = () => {
    const navigate = useNavigate();
    const help = useHelp();

    // State
    const [suppliers, setSuppliers] = useState([]);
    const [products, setProducts] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [selectedSupplier, setSelectedSupplier] = useState(null);
    const [selectedWarehouse, setSelectedWarehouse] = useState(null);
    const [purchaseItems, setPurchaseItems] = useState([]);
    const [productSearch, setProductSearch] = useState('');
    const [supplierSearch, setSupplierSearch] = useState('');
    const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
    const [paymentType, setPaymentType] = useState('CASH'); // CASH or CREDIT
    const [showCostUpdateModal, setShowCostUpdateModal] = useState(null);
    const [serialCaptureLineId, setSerialCaptureLineId] = useState(null);
    const [activeTab, setActiveTab] = useState('ITEMS'); // 'ITEMS' | 'SUMMARY'

    const [invoiceData, setInvoiceData] = useState({
        invoice_number: '',
        purchase_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: ''
    });

    // Refs
    const searchInputRef = useRef(null);
    const productSearchRef = useRef(null);
    const [filteredProducts, setFilteredProducts] = useState([]);
    // ── Herramienta 1: Producto rápido ──────────────────────────
    const [showQuickProduct,    setShowQuickProduct]    = useState(false);
    const [quickProductName,    setQuickProductName]    = useState('');
    const [quickProductSku,     setQuickProductSku]     = useState('');
    const [quickProductCostPrice, setQuickProductCostPrice] = useState('');
    const [quickProductSalePrice, setQuickProductSalePrice] = useState('');
    const [quickProductHasImei, setQuickProductHasImei] = useState(false);
    // ── Herramienta 2: Descuento global del proveedor ───────────
    const [globalDiscount, setGlobalDiscount] = useState({ amount: 0, type: 'NONE', notes: '' });

    // Load suppliers, products, and warehouses
    const fetchSuppliers = async () => {
        try {
            const response = await apiClient.get('/suppliers');
            setSuppliers(response.data);
        } catch (error) {
            console.error('Error fetching suppliers:', error);
            toast.error(getApiErrorMessage(error, 'Error al cargar proveedores'));
        }
    };

    const fetchProducts = async () => {
        try {
            const response = await apiClient.get('/products?limit=2000');
            setProducts(Array.isArray(response.data) ? response.data : (response.data?.items || []));
        } catch (error) {
            console.error('Error fetching products:', error);
            toast.error(getApiErrorMessage(error, 'Error al cargar productos'));
        }
    };

    const fetchWarehouses = async () => { // NEW
        try {
            const response = await apiClient.get('/warehouses');
            if (response.data && response.data.length > 0) {
                setWarehouses(response.data);
                // Default to main warehouse
                const main = response.data.find(w => w.is_main) || response.data[0];
                setSelectedWarehouse(main.id);
            }
        } catch (error) {
            console.error('Error fetching warehouses:', error);
            // Non-blocking, will default to 1 in submit if needed
        }
    };

    useEffect(() => {
        fetchSuppliers();
        fetchProducts();
        fetchWarehouses(); // NEW
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Filter suppliers
    const filteredSuppliers = suppliers.filter(s =>
        normalizeSearch(s.name).includes(normalizeSearch(supplierSearch))
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
                normalizeSearch(p.name).includes(normalizeSearch(productSearch)) ||
                (p.sku && normalizeSearch(p.sku).includes(normalizeSearch(productSearch)))
            );
            setFilteredProducts(filtered);
        } else {
            setFilteredProducts([]);
        }
    }, [productSearch, products]);

    // Herramienta 2: Calcular totales con descuentos
    const subtotalBruto = purchaseItems.reduce((sum, item) => sum + toMoney(item.unit_cost) * toMoney(item.quantity), 0);
    const totalDescItems = purchaseItems.reduce((sum, item) => sum + toMoney(item.discount_amount), 0);
    const totalConDescItems = Math.max(0, subtotalBruto - totalDescItems);
    const globalDiscountInput = Math.max(0, toMoney(globalDiscount.amount));
    const descGlobal = globalDiscount.type === 'PERCENT'
        ? Math.min(totalConDescItems, totalConDescItems * (globalDiscountInput / 100))
        : Math.min(totalConDescItems, globalDiscountInput);
    const totalFinal = Math.max(0, totalConDescItems - descGlobal);

    // Herramienta 1: Agregar producto rápido (sin existir en inventario)
    const handleAddQuickProduct = () => {
        const normalizedName = quickProductName.trim();
        const initialCost = toMoney(quickProductCostPrice);
        const suggestedSalePrice = toMoney(quickProductSalePrice);

        if (!normalizedName) return;
        if (initialCost <= 0) {
            toast.error('Ingresa el costo de compra inicial para crear el producto');
            return;
        }

        const tempId = createLineId('quick');
        setPurchaseItems(prev => [...prev, {
            line_id: tempId,
            product_id: null,
            quick_product: {
                name: normalizedName,
                sku: quickProductSku.trim() || null,
                sale_price: suggestedSalePrice || null,
                has_imei: quickProductHasImei,
            },
            product_name: normalizedName + (quickProductHasImei ? ' - Serial - Nuevo' : ' - Nuevo'),
            quantity: 1,
            unit_cost: initialCost,
            original_cost: initialCost,
            current_price: suggestedSalePrice || 0,
            subtotal: initialCost,
            has_imei: quickProductHasImei,
            serial_text: '',
            color_name: '',
            color_hex: '',
            isNew: true,
            tempId,
        }]);
        setQuickProductName('');
        setQuickProductSku('');
        setQuickProductCostPrice('');
        setQuickProductSalePrice('');
        setQuickProductHasImei(false);
        setShowQuickProduct(false);
    };

    // Add product to purchase
    const handleAddProduct = (product) => {
        const existingItem = purchaseItems.find(item => item.product_id === product.id);

        if (existingItem) {
            setPurchaseItems(prev => prev.map(item => {
                if (item.product_id !== product.id) return item;
                const quantity = toMoney(item.quantity) + 1;
                return {
                    ...item,
                    quantity,
                    subtotal: Math.max(0, quantity * toMoney(item.unit_cost) - toMoney(item.discount_amount))
                };
            }));
        } else {
            const lineId = createLineId('product');
            setPurchaseItems(prev => [...prev, {
                line_id: lineId,
                product_id: product.id,
                product_name: product.name,
                quantity: 1,
                unit_cost: Number(product.cost_price) || 0,
                original_cost: Number(product.cost_price) || 0,
                current_price: Number(product.price) || 0,
                profit_margin: Number(product.profit_margin) || 0,
                tax_rate: Number(product.tax_rate) || 0,
                has_imei: Boolean(product.has_imei),
                serial_text: '',
                color_name: '',
                color_hex: '',
                subtotal: Number(product.cost_price) || 0
            }]);
        }

        setProductSearch('');
        setFilteredProducts([]);
        productSearchRef.current?.focus();
        toast.success('Producto agregado');
    };

    const updateLine = (lineId, updater) => {
        setPurchaseItems(prev => prev.map(item => {
            if ((item.line_id || item.product_id) !== lineId) return item;
            const next = typeof updater === 'function' ? updater(item) : { ...item, ...updater };
            return {
                ...next,
                subtotal: Math.max(0, toMoney(next.quantity) * toMoney(next.unit_cost) - toMoney(next.discount_amount))
            };
        }));
    };

    // Update item quantity
    const handleQuantityChange = (lineId, quantity) => {
        updateLine(lineId, item => ({ ...item, quantity: toMoney(quantity) }));
    };

    // Update item cost
    const handleCostChange = (lineId, cost) => {
        updateLine(lineId, item => ({ ...item, unit_cost: toMoney(cost) }));
    };

    // Remove item
    const handleRemoveItem = (lineId) => {
        setPurchaseItems(prev => prev.filter(item => (item.line_id || item.product_id) !== lineId));
        toast.success('Producto eliminado de la lista');
    };

    // Calculate total
    const total = subtotalBruto;
    const serialCaptureItem = purchaseItems.find(item => (item.line_id || item.product_id) === serialCaptureLineId);

    // Submit purchase
    const handleSubmit = async () => {
        if (!selectedSupplier) {
            toast.error('Selecciona un proveedor');
            return;
        }

        if (!selectedWarehouse) {
            toast.error('Selecciona el almacen donde entrara la mercancia');
            return;
        }

        if (purchaseItems.length === 0) {
            toast.error('Agrega al menos un producto');
            productSearchRef.current?.focus();
            return;
        }

        const invalidItem = purchaseItems.find(item => toMoney(item.quantity) <= 0 || toMoney(item.unit_cost) < 0);
        if (invalidItem) {
            toast.error('Revisa cantidades y costos: la cantidad debe ser mayor a cero y el costo no puede ser negativo.');
            return;
        }

        const invalidSerialItem = purchaseItems.find(item => {
            if (!item.has_imei) return false;
            const qty = toMoney(item.quantity);
            const serials = parseSerials(item.serial_text);
            return !Number.isInteger(qty) || serials.length !== qty || new Set(serials).size !== serials.length;
        });
        if (invalidSerialItem) {
            const qty = toMoney(invalidSerialItem.quantity);
            const serials = parseSerials(invalidSerialItem.serial_text);
            const duplicated = serials.length !== new Set(serials).size;
            toast.error(duplicated
                ? `Hay IMEIs duplicados en ${invalidSerialItem.product_name}`
                : `${invalidSerialItem.product_name} requiere ${Number.isInteger(qty) ? qty : 'cantidad entera'} IMEI(s).`
            );
            return;
        }

        try {
            // Use selected warehouse or default to 1 (safeguard)
            const warehouseId = selectedWarehouse || 1;

            const purchaseData = {
                supplier_id: selectedSupplier.id,
                warehouse_id: warehouseId,
                invoice_number: invoiceData.invoice_number,
                notes: invoiceData.notes,
                total_amount: totalFinal,
                purchase_date: invoiceData.purchase_date,
                due_date: invoiceData.due_date,
                discount_amount: descGlobal || 0,
                discount_type:   globalDiscount.type   || 'NONE',
                discount_notes:  globalDiscount.notes  || null,
                items: purchaseItems.map(item => ({
                    product_id:   item.product_id || null,
                    quick_product: item.quick_product ? { ...item.quick_product, cost_price: toMoney(item.unit_cost) } : null,
                    quantity:     item.quantity,
                    unit_cost:    item.unit_cost,
                    discount_pct: item.discount_pct || 0,
                    discount_amount: item.discount_amount || 0,
                    update_cost:  item.update_cost !== undefined ? item.update_cost : (item.unit_cost !== item.original_cost),
                    update_price: item.update_price || false,
                    new_sale_price: item.new_sale_price || null,
                    serial_numbers: item.has_imei ? parseSerials(item.serial_text) : [],
                    color_name: item.has_imei ? ((item.color_name || '').trim() || null) : null,
                    color_hex: item.has_imei ? (/^#([0-9a-fA-F]{6})$/.test(item.color_hex || '') ? item.color_hex : null) : null,
                })),
                payment_type: paymentType
            };

            await apiClient.post('/purchases', purchaseData);
            toast.success('Compra registrada exitosamente');
            navigate('/purchases');
        } catch (error) {
            console.error('Error creating purchase:', error);
            toast.error(getApiErrorMessage(error, 'Error al registrar compra'));
        }
    };

    return (
        <>
        <div id="tour-purchase-create" className="flex flex-col min-h-[calc(100vh-64px)] bg-slate-50 gap-4 p-3 md:p-4 pb-32 md:pb-4">
            {/* TOP HEADER: Invoice & Supplier Info */}
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm flex-shrink-0 z-30">
                <div className="flex flex-col gap-4 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                                <Package size={20} />
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-slate-900">Recepcion de inventario</h1>
                                <p className="text-sm font-semibold text-slate-500">Registra factura, proveedor, costos y entrada al almacen.</p>
                            </div>
                            <HelpButton contextKey="purchases" onClick={help.open} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:w-80">
                        <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-center">
                            <div className="text-xl font-black leading-none text-indigo-600">${Number(totalFinal).toFixed(2)}</div>
                            <div className="mt-1 text-[10px] font-black uppercase tracking-wide text-indigo-500">Total factura</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                            <div className="text-xl font-black leading-none text-slate-900">{purchaseItems.length}</div>
                            <div className="mt-1 text-[10px] font-black uppercase tracking-wide text-slate-400">Lineas</div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-[minmax(220px,1.2fr)_minmax(180px,0.8fr)_minmax(160px,0.7fr)_minmax(260px,1fr)]">
                    <div id="tour-purchase-supplier" className="relative">
                        <label className="mb-1.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-slate-400">
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
                                    "w-full rounded-md border px-3 py-2.5 pr-9 text-sm font-semibold outline-none transition-all",
                                    selectedSupplier
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                        : 'border-slate-200 bg-white text-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
                                )}
                                placeholder="Buscar proveedor..."
                            />
                            {selectedSupplier && (
                                <div className="absolute right-3 top-2.5 text-emerald-600">
                                    <Check size={16} strokeWidth={3} />
                                </div>
                            )}
                        </div>
                        {showSupplierDropdown && filteredSuppliers.length > 0 && (
                            <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                                {filteredSuppliers.map(supplier => (
                                    <div
                                        key={supplier.id}
                                        onClick={() => handleSupplierSelect(supplier)}
                                        className="cursor-pointer border-b border-slate-50 p-3 text-sm transition-colors last:border-0 hover:bg-indigo-50"
                                    >
                                        <div className="font-black text-slate-800">{supplier.name}</div>
                                        <div className="mt-0.5 text-xs font-semibold text-slate-500">Credito: {supplier.payment_terms} dias</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="mb-1.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-slate-400">
                            <Package size={12} /> Almacen destino
                        </label>
                        <div className="relative">
                            <select
                                value={selectedWarehouse || ''}
                                onChange={(e) => setSelectedWarehouse(Number(e.target.value))}
                                className="w-full appearance-none rounded-md border border-slate-200 bg-white px-3 py-2.5 pr-9 text-sm font-black text-slate-800 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                            >
                                {warehouses.map(wh => (
                                    <option key={wh.id} value={wh.id}>{wh.name} {wh.is_main ? '(Principal)' : ''}</option>
                                ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-3 text-slate-400" size={16} />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-slate-400">
                            <FileText size={12} /> Factura
                        </label>
                        <input
                            type="text"
                            value={invoiceData.invoice_number}
                            onChange={(e) => setInvoiceData(prev => ({ ...prev, invoice_number: e.target.value }))}
                            className="w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm font-black text-slate-800 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                            placeholder="Ej: 001-230"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-slate-400">
                                <Calendar size={12} /> Emision
                            </label>
                            <input
                                type="date"
                                value={invoiceData.purchase_date}
                                onChange={(e) => setInvoiceData(prev => ({ ...prev, purchase_date: e.target.value }))}
                                className="w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-slate-400">
                                <AlertCircle size={12} /> Vence
                            </label>
                            <input
                                type="date"
                                value={invoiceData.due_date}
                                onChange={(e) => setInvoiceData(prev => ({ ...prev, due_date: e.target.value }))}
                                className={clsx(
                                    "w-full rounded-md border px-3 py-2.5 text-sm font-semibold outline-none transition-all",
                                    new Date(invoiceData.due_date) < new Date()
                                        ? 'border-rose-200 bg-rose-50 text-rose-800'
                                        : 'border-slate-200 text-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
                                )}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT: Items & Search */}
            <div className="flex-1 flex gap-4 overflow-hidden md:flex-row flex-col">
                {/* LEFT: Items List */}
                <div className={`flex-1 flex-col overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-sm ${activeTab === 'ITEMS' ? 'flex' : 'hidden md:flex'}`}>
                    {/* Search Bar */}
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 z-20">
                        {/* Botón producto nuevo */}
                        <button
                            id="tour-purchase-new-product"
                            type="button"
                            onClick={() => setShowQuickProduct(true)}
                            className="mb-3 flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold transition-all shadow-sm"
                        >
                            ➕ Producto nuevo
                        </button>
                        <div id="tour-purchase-product-search" className="relative">
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
                            {productSearch && filteredProducts.length === 0 && (
                                <div className="absolute z-50 mt-2 w-full rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold text-amber-700 shadow-xl">
                                    No encontre productos con ese nombre o SKU. Puedes crear uno con el boton Producto nuevo.
                                </div>
                            )}
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
                    <div id="tour-purchase-items" className="flex-1 overflow-y-auto custom-scrollbar p-0 bg-slate-50 md:bg-white">
                        {/* MOBILE CARD LIST */}
                        <div className="md:hidden space-y-3 p-3">
                            {purchaseItems.length === 0 ? (
                                <div className="text-center py-10 text-slate-400">
                                    <Package size={48} className="mx-auto mb-3 opacity-20" />
                                    <p className="text-sm font-bold">Tu carrito está vacío</p>
                                    <p className="text-xs">Agrega productos arriba</p>
                                </div>
                            ) : (
                                purchaseItems.map(item => {
                                    const projectedPrice = item.unit_cost * (1 + (item.profit_margin || 0) / 100) * (1 + (item.tax_rate || 0) / 100);
                                    const enteredSalePrice = toMoney(item.current_price);
                                    const hasManualSalePrice = Boolean(item.isNew && enteredSalePrice > 0);
                                    const visibleSalePrice = hasManualSalePrice ? enteredSalePrice : projectedPrice;
                                    const serialMeta = item.has_imei ? getSerialMeta(item) : null;
                                    return (
                                        <div key={item.line_id || item.product_id} className="bg-white rounded-xl p-3 shadow-sm border border-slate-200 relative">
                                            <div className="flex justify-between items-start mb-3 pr-8">
                                                <div>
                                                    <div className="font-bold text-slate-800 text-sm line-clamp-2">{item.product_name}</div>
                                                    <div className="text-xs text-slate-400 mt-0.5">Base: ${Number(item.original_cost).toFixed(2)}</div>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveItem(item.line_id || item.product_id)}
                                                    className="absolute top-2 right-2 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-12 gap-2 items-center">
                                                {/* Quantity */}
                                                <div className="col-span-3">
                                                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Cant</label>
                                                    <input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => handleQuantityChange(item.line_id || item.product_id, e.target.value)}
                                                        className="w-full text-center font-bold border border-slate-200 rounded-lg py-1.5 text-sm focus:border-indigo-500 outline-none bg-slate-50"
                                                    />
                                                </div>

                                                {/* Cost */}
                                                <div className="col-span-5 px-1">
                                                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1 text-center">Costo</label>
                                                    <div className="relative">
                                                        <span className="absolute left-2 top-1.5 text-slate-400 font-bold text-xs">$</span>
                                                        <input
                                                            type="number"
                                                            value={item.unit_cost}
                                                            onChange={(e) => handleCostChange(item.line_id || item.product_id, e.target.value)}
                                                            onBlur={(e) => {
                                                                if (item.product_id && item.unit_cost !== item.original_cost && item.unit_cost > 0) {
                                                                    setShowCostUpdateModal({
                                                                        lineId: item.line_id || item.product_id,
                                                                        productId: item.product_id,
                                                                        newCost: item.unit_cost,
                                                                        originalCost: item.original_cost,
                                                                        productName: item.product_name,
                                                                        profitMargin: item.profit_margin,
                                                                        taxRate: item.tax_rate,
                                                                        updatePrice: false,
                                                                        newSalePrice: null
                                                                    });
                                                                }
                                                            }}
                                                            className={clsx(
                                                                "w-full pl-4 pr-1 font-bold rounded-lg py-1.5 outline-none text-center text-sm transition-all border",
                                                                item.unit_cost !== item.original_cost
                                                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                                    : 'bg-white text-slate-600 border-slate-200'
                                                            )}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Subtotal */}
                                                <div className="col-span-4 text-right">
                                                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Subtotal</label>
                                                    <div className="font-mono font-black text-slate-700 text-sm">
                                                        ${item.subtotal.toFixed(2)}
                                                    </div>
                                                </div>
                                            </div>

                                            {item.has_imei && (
                                                <div id="tour-purchase-imei-lines" className={clsx(
                                                    "mt-3 rounded-xl border p-3",
                                                    serialMeta.complete ? "border-emerald-200 bg-emerald-50" : serialMeta.duplicates.length ? "border-rose-200 bg-rose-50" : "border-indigo-100 bg-indigo-50"
                                                )}>
                                                    <div className="mb-2 flex items-center justify-between gap-2">
                                                        <label className="text-[10px] font-black uppercase tracking-wide text-indigo-700">IMEIs / Seriales</label>
                                                        <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-black", serialMeta.complete ? "bg-emerald-100 text-emerald-700" : serialMeta.duplicates.length ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700")}>
                                                            {serialMeta.captured}/{serialMeta.expected || toMoney(item.quantity) || 0}
                                                        </span>
                                                    </div>
                                                    <div className="mb-2 grid grid-cols-3 gap-1.5 text-center text-[10px] font-black">
                                                        <div className="rounded-lg bg-white px-2 py-1 text-slate-500">Esperados <span className="text-slate-900">{toMoney(item.quantity) || 0}</span></div>
                                                        <div className="rounded-lg bg-white px-2 py-1 text-emerald-600">Capturados <span>{serialMeta.captured}</span></div>
                                                        <div className={clsx("rounded-lg bg-white px-2 py-1", serialMeta.missing ? "text-amber-600" : "text-emerald-600")}>Faltan <span>{serialMeta.missing}</span></div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSerialCaptureLineId(item.line_id || item.product_id)}
                                                        className={clsx(
                                                            "flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-black transition",
                                                            serialMeta.complete ? "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50" : serialMeta.duplicates.length ? "border-rose-200 bg-white text-rose-700 hover:bg-rose-50" : "border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50"
                                                        )}
                                                    >
                                                        <Barcode size={16} /> Capturar IMEIs
                                                    </button>
                                                    {(item.color_name || item.color_hex) && (
                                                        <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black text-slate-600">
                                                            <span className="h-2.5 w-2.5 rounded-full border border-slate-200" style={{ backgroundColor: getSafeColorHex(item.color_hex) }} />
                                                            <span>{item.color_name || 'Color personalizado'}</span>
                                                        </div>
                                                    )}
                                                    {parseSerials(item.serial_text).length > 0 && (
                                                        <div className="mt-2 line-clamp-2 rounded-lg bg-white px-3 py-2 font-mono text-[11px] font-bold text-slate-500">
                                                            {parseSerials(item.serial_text).slice(0, 4).join(' | ')}{parseSerials(item.serial_text).length > 4 ? '...' : ''}
                                                        </div>
                                                    )}
                                                    {serialMeta.duplicates.length > 0 && (
                                                        <div className="mt-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-rose-600">
                                                            Duplicados: {serialMeta.duplicates.slice(0, 3).join(', ')}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center">
                                                <div className="flex gap-2">
                                                    <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100">M: {item.profit_margin}%</span>
                                                    <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">IVA: {item.tax_rate}%</span>
                                                </div>
                                                <div className="text-xs font-medium text-slate-500">
                                                    {hasManualSalePrice ? (
                                                        <>PVP ingresado: <span className="text-slate-700 font-bold">${visibleSalePrice.toFixed(2)}</span></>
                                                    ) : (
                                                        <>Sugerido: <span className="text-slate-700 font-bold">${projectedPrice.toFixed(2)}</span></>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>

                        {/* DESKTOP TABLE */}
                        <table className="hidden md:table w-full text-sm border-collapse">
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
                                        const serialMeta = item.has_imei ? getSerialMeta(item) : null;

                                        return (
                                            <React.Fragment key={item.line_id || item.product_id}>
                                            <tr className="hover:bg-slate-50/80 transition-colors group">
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
                                                        onChange={(e) => handleQuantityChange(item.line_id || item.product_id, e.target.value)}
                                                        className="w-full text-center font-bold border border-slate-200 rounded-lg p-1.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-700 hover:border-slate-300"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 relative">
                                                    <div className="relative group/input">
                                                        <span className="absolute left-2 top-1.5 text-slate-400 font-bold text-xs">$</span>
                                                        <input
                                                            type="number"
                                                            value={item.unit_cost}
                                                            onChange={(e) => handleCostChange(item.line_id || item.product_id, e.target.value)}
                                                            className={clsx(
                                                                "w-full pl-5 pr-1 font-bold rounded-lg p-1.5 outline-none text-center text-sm transition-all border",
                                                                item.unit_cost !== item.original_cost
                                                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                                    : 'bg-white text-slate-600 border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                                                            )}
                                                            onBlur={() => {
                                                                // Trigger modal only when user finishes typing
                                                                if (item.product_id && item.unit_cost !== item.original_cost && item.unit_cost > 0) {
                                                                    setShowCostUpdateModal({
                                                                        lineId: item.line_id || item.product_id,
                                                                        productId: item.product_id,
                                                                        newCost: item.unit_cost,
                                                                        originalCost: item.original_cost,
                                                                        productName: item.product_name,
                                                                        profitMargin: item.profit_margin,
                                                                        taxRate: item.tax_rate,
                                                                        updatePrice: false,
                                                                        newSalePrice: null
                                                                    });
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="text-xs flex flex-col gap-1 items-center">
                                                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg font-bold whitespace-nowrap border border-indigo-100">
                                                            M: {item.profit_margin}%
                                                        </span>
                                                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg font-bold whitespace-nowrap border border-slate-200">
                                                            IVA: {item.tax_rate}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="text-sm font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100" title={hasManualSalePrice ? 'Precio de venta ingresado manualmente' : 'Precio calculado con nuevo costo'}>
                                                        ${visibleSalePrice.toFixed(2)}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 mt-1 font-medium">
                                                        {hasManualSalePrice
                                                            ? `Sugerido por costo: $${projectedPrice.toFixed(2)}`
                                                            : `Actual: $${item.current_price.toFixed(2)}`}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono font-bold text-slate-700 text-sm">
                                                    ${item.subtotal.toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={() => handleRemoveItem(item.line_id || item.product_id)}
                                                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                            {item.has_imei && (
                                                <tr className="bg-indigo-50/50">
                                                    <td colSpan="7" className="px-4 pb-4">
                                                        <div className={clsx(
                                                            "rounded-xl border bg-white p-3 shadow-sm",
                                                            serialMeta.complete ? "border-emerald-200" : serialMeta.duplicates.length ? "border-rose-200" : "border-indigo-100"
                                                        )}>
                                                            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                                                                <div>
                                                                    <label className="text-[10px] font-black uppercase tracking-wide text-indigo-600">IMEIs / Seriales recibidos</label>
                                                                    <p className="mt-0.5 text-xs font-semibold text-slate-500">Escanea, pega o separa por coma, espacio o salto de linea.</p>
                                                                </div>
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">Esperados: {toMoney(item.quantity) || 0}</span>
                                                                    <span className="rounded-md bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700">Capturados: {serialMeta.captured}</span>
                                                                    <span className={clsx("rounded-md px-2 py-1 text-[10px] font-black", serialMeta.missing ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>Faltan: {serialMeta.missing}</span>
                                                                </div>
                                                            </div>
                                                            {(item.color_name || item.color_hex) && (
                                                                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-600">
                                                                    <span className="h-3 w-3 rounded-full border border-slate-200" style={{ backgroundColor: getSafeColorHex(item.color_hex) }} />
                                                                    <span>{item.color_name || 'Color personalizado'}</span>
                                                                </div>
                                                            )}
                                                            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                                                                <div className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs font-bold text-slate-500">
                                                                    {parseSerials(item.serial_text).length > 0
                                                                        ? `${parseSerials(item.serial_text).slice(0, 6).join(' | ')}${parseSerials(item.serial_text).length > 6 ? '...' : ''}`
                                                                        : 'Sin IMEIs capturados todavia.'}
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSerialCaptureLineId(item.line_id || item.product_id)}
                                                                    className={clsx(
                                                                        "inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-black transition",
                                                                        serialMeta.complete ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : serialMeta.duplicates.length ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100" : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                                                                    )}
                                                                >
                                                                    <Barcode size={16} /> Capturar IMEIs
                                                                </button>
                                                            </div>
                                                            {serialMeta.duplicates.length > 0 && (
                                                                <div className="mt-2 flex items-start gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                                                                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                                                    <span>Duplicados detectados: {serialMeta.duplicates.slice(0, 5).join(', ')}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                            </React.Fragment>
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
                <div className={`flex flex-col gap-4 overflow-y-auto pb-2 ${activeTab === 'SUMMARY' ? 'flex w-full md:w-80' : 'hidden md:flex md:w-80'}`}>
                    <div id="tour-purchase-conditions" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
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
                                <span>${subtotalBruto.toFixed(2)}</span>
                            </div>
                            {totalDescItems > 0 && (
                                <div className="flex justify-between mb-2 text-sm font-bold text-emerald-700">
                                    <span>Desc. items</span>
                                    <span>-${totalDescItems.toFixed(2)}</span>
                                </div>
                            )}
                            {descGlobal > 0 && (
                                <div className="flex justify-between mb-2 text-sm font-bold text-emerald-700">
                                    <span>Desc. proveedor</span>
                                    <span>-${descGlobal.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-xl font-black text-slate-800 pt-3 border-t border-slate-100">
                                <span>TOTAL</span>
                                <span>${totalFinal.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* ── Descuento global del proveedor ── */}
                        <div id="tour-purchase-discount" className="bg-white border border-slate-200 rounded-xl p-4 mb-3">
                            <p className="text-xs font-black text-slate-600 uppercase tracking-wide mb-3">
                                🏷️ Descuento del proveedor
                            </p>
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder={globalDiscount.type === 'PERCENT' ? 'Porcentaje (%)' : 'Monto ($)'}
                                        value={globalDiscount.amount || ''}
                                        onChange={e => setGlobalDiscount(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))}
                                        className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-300"
                                    />
                                    <select
                                        value={globalDiscount.type}
                                        onChange={e => setGlobalDiscount(p => ({ ...p, type: e.target.value }))}
                                        className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                                    >
                                        <option value="NONE">Sin descuento</option>
                                        <option value="FIXED">Monto fijo</option>
                                        <option value="PERCENT">Porcentaje</option>
                                    </select>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Nota (ej: descuento pronto pago)"
                                    value={globalDiscount.notes}
                                    onChange={e => setGlobalDiscount(p => ({ ...p, notes: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-300"
                                />
                                {globalDiscount.amount > 0 && globalDiscount.type !== 'NONE' && (
                                    <div className="flex justify-between text-sm font-bold text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">
                                        <span>Descuento aplicado</span>
                                        <span>-${descGlobal.toFixed(2)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button
                            id="tour-purchase-submit"
                            onClick={handleSubmit}
                            disabled={!selectedSupplier || !selectedWarehouse || purchaseItems.length === 0}
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

            {serialCaptureItem && (
                <SerialCaptureModal
                    item={serialCaptureItem}
                    onClose={() => setSerialCaptureLineId(null)}
                    onSave={({ serials, color_name, color_hex }) => {
                        updateLine(serialCaptureLineId, {
                            serial_text: serials.join('\n'),
                            color_name: color_name || '',
                            color_hex: color_hex || '',
                        });
                        setSerialCaptureLineId(null);
                        toast.success(color_name ? `Lote ${color_name} capturado` : 'IMEIs capturados');
                    }}
                />
            )}

            {/* Price/Cost Update Modal */}
            {showCostUpdateModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl p-5 md:p-6 w-[95%] max-w-md animate-in zoom-in-95 duration-200 border border-slate-200 max-h-[90vh] overflow-y-auto">
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
                                    <label className="block text-xs font-bold text-amber-700 uppercase mb-1">Nuevo Costo</label>
                                    <div className="text-2xl font-black font-mono text-amber-700">
                                        ${Number(showCostUpdateModal.newCost).toFixed(2)}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 transition-all duration-300">
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
                                            onChange={(e) => {
                                                const isChecked = e.target.checked;
                                                let calculatedPrice = null;

                                                // Intelligent Auto-Fill
                                                if (isChecked) {
                                                    const cost = Number(showCostUpdateModal.newCost) || 0;
                                                    const margin = Number(showCostUpdateModal.profitMargin) || 0;
                                                    const tax = Number(showCostUpdateModal.taxRate) || 0;

                                                    // Formula: Cost + Margin + Tax
                                                    const priceWithMargin = cost * (1 + margin / 100);
                                                    const finalPrice = priceWithMargin * (1 + tax / 100);

                                                    calculatedPrice = finalPrice.toFixed(2);
                                                }

                                                setShowCostUpdateModal(prev => ({
                                                    ...prev,
                                                    updatePrice: isChecked,
                                                    newSalePrice: calculatedPrice // Auto-fill or clear
                                                }));
                                            }}
                                        />
                                        <div className={`peer-checked:bg-indigo-600 w-full h-full bg-slate-300 rounded-full shadow-inner transition-colors`}></div>
                                        <div className={`peer-checked:translate-x-6 absolute left-0 top-0 bg-white w-6 h-6 rounded-full shadow transition-transform duration-200`}></div>
                                    </div>
                                </div>

                                {showCostUpdateModal.updatePrice && (
                                    <div className="animate-in slide-in-from-top-2 duration-200">
                                        <label className="block text-xs font-bold text-indigo-600 mb-1">Nuevo PVP (Sugerido)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-indigo-400 font-bold">$</span>
                                            <input
                                                type="number"
                                                className="w-full pl-7 p-2.5 border-2 border-indigo-200 rounded-xl font-bold text-indigo-800 focus:border-indigo-500 outline-none bg-white shadow-sm"
                                                value={showCostUpdateModal.newSalePrice !== null ? showCostUpdateModal.newSalePrice : ''}
                                                onChange={(e) => setShowCostUpdateModal(prev => ({ ...prev, newSalePrice: e.target.value }))}
                                                placeholder="0.00"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="text-xs text-indigo-500 mt-2 flex items-center gap-1 font-medium bg-indigo-100/50 p-2 rounded-lg">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                            {showCostUpdateModal.profitMargin
                                                ? `Calculado con Margen: ${showCostUpdateModal.profitMargin}%`
                                                : 'Sin margen configurado (Ingresa precio manual)'}
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
                                        (item.line_id || item.product_id) === showCostUpdateModal.lineId
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

            {/* =====================================================================================
                MOBILE TAB SWITCHER - Bottom Navigation
               ===================================================================================== */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex gap-3 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                {/* Items Tab */}
                <button
                    onClick={() => setActiveTab('ITEMS')}
                    className={`
                        flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2
                        ${activeTab === 'ITEMS'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }
                    `}
                >
                    <Package size={20} />
                    <span>Items</span>
                    {purchaseItems.length > 0 && (
                        <span className="ml-1 bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                            {purchaseItems.length}
                        </span>
                    )}
                </button>

                {/* Summary Tab */}
                <button
                    onClick={() => setActiveTab('SUMMARY')}
                    className={`
                        flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 relative
                        ${activeTab === 'SUMMARY'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }
                    `}
                >
                    <DollarSign size={20} />
                    <span>Resumen</span>
                </button>
            </div>
        </div>

        {/* ── Modal: Crear producto rápido ─────────────────────────── */}
        {showQuickProduct && (
            <div
                className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
                onClick={() => setShowQuickProduct(false)}
            >
                <div
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
                    onClick={e => e.stopPropagation()}
                >
                    <h3 className="text-lg font-black text-slate-800 mb-1">➕ Nuevo producto</h3>
                    <p className="text-xs text-slate-500 mb-4">
                        Se creará en el inventario al guardar la compra.
                    </p>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-bold text-slate-600 block mb-1">Nombre *</label>
                            <input
                                type="text"
                                value={quickProductName}
                                onChange={e => setQuickProductName(e.target.value)}
                                placeholder="Ej: Filtro de aceite Toyota 2.4"
                                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-600 block mb-1">
                                SKU / Código <span className="font-normal text-slate-400">(opcional)</span>
                            </label>
                            <input
                                type="text"
                                value={quickProductSku}
                                onChange={e => setQuickProductSku(e.target.value)}
                                placeholder="Ej: FILT-TOY-24"
                                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 outline-none font-mono"
                            />
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <label className="text-xs font-bold text-slate-600 block mb-1">Costo de compra inicial *</label>
                                <input
                                    type="number"
                                    value={quickProductCostPrice}
                                    onChange={e => setQuickProductCostPrice(e.target.value)}
                                    placeholder="0.00"
                                    min="0"
                                    step="0.01"
                                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
                                />
                                <p className="mt-1 text-[11px] font-semibold text-slate-400">Se usara para la compra, el costo del producto y el valor del inventario.</p>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 block mb-1">
                                    Precio de venta sugerido <span className="font-normal text-slate-400">(opcional)</span>
                                </label>
                                <input
                                    type="number"
                                    value={quickProductSalePrice}
                                    onChange={e => setQuickProductSalePrice(e.target.value)}
                                    placeholder="0.00"
                                    min="0"
                                    step="0.01"
                                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
                                />
                                <p className="mt-1 text-[11px] font-semibold text-slate-400">Opcional. Si lo dejas vacio, luego puedes ajustarlo con calma.</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setQuickProductHasImei(prev => !prev)}
                            className={clsx(
                                "flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition-all",
                                quickProductHasImei ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-200"
                            )}
                        >
                            <span>
                                <span className="block text-sm font-black">Maneja IMEI / Serial</span>
                                <span className="block text-xs font-semibold opacity-80">Para telefonos, laptops o equipos unitarios.</span>
                            </span>
                            <span className={clsx("h-6 w-11 rounded-full p-0.5 transition-all", quickProductHasImei ? "bg-indigo-600" : "bg-slate-300")}>
                                <span className={clsx("block h-5 w-5 rounded-full bg-white transition-transform", quickProductHasImei && "translate-x-5")} />
                            </span>
                        </button>
                        <div className={clsx("rounded-xl border p-3 text-xs font-semibold", quickProductHasImei ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-amber-200 bg-amber-50 text-amber-700")}>
                            {quickProductHasImei
                                ? 'Al agregarlo, la linea pedira los IMEIs aqui mismo y la compra creara el stock serializado con ese costo inicial.'
                                : 'El costo quedara sembrado desde este modal y aun podras ajustarlo luego en la linea si hace falta.'}
                        </div>
                    </div>
                    <div className="flex gap-2 mt-5">
                        <button
                            onClick={() => setShowQuickProduct(false)}
                            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleAddQuickProduct}
                            disabled={!quickProductName.trim() || toMoney(quickProductCostPrice) <= 0}
                            className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                        >
                            Agregar a la compra
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* ── Ayuda contextual ─────────────────────────────────────── */}
        {help.isOpen && <HelpDrawer contextKey="purchases" onClose={help.close} />}
        </>
    );
};

export default CreatePurchase;
