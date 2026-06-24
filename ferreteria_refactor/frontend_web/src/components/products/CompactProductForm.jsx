import { useEffect, useMemo, useState } from 'react';
import {
    Package,
    DollarSign,
    Warehouse,
    Layers,
    ScanBarcode,
    Scissors,
    Check,
    Plus,
    Pencil,
    ShieldCheck,
    Image as ImageIcon,
    BookOpen,
    Gift,
    Trash2,
    Search,
} from 'lucide-react';
import { Sheet, SheetContent } from '../../components/ui/sheet';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { cn } from '../../lib/utils';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { useConfig } from '../../context/ConfigContext';
import apiClient from '../../config/axios';
import ProductImageUploader from './ProductImageUploader';
import ProductGalleryManager from './ProductGalleryManager';
import ProductUnitManager from './ProductUnitManager';
import { useAppTour } from '../../hooks/useAppTour';
import toast from 'react-hot-toast';

const defaultForm = {
    name: '',
    sku: '',
    category_id: null,
    cost: '',
    price: '',
    profit_margin: '',
    stock: 0,
    min_stock: 5,
    location: '',
    unit_type: 'UNID',
    exchange_rate_id: null,
    is_service: false,
    has_imei: false,
    is_combo: false,
    is_menu_item: false,
    is_commissionable: false,
    warehouse_stocks: [],
    prices: {},
    units: [],
    combo_items: [],
    promotion_items: [],
    warranty_policy_id: null,
    image_url: '',
    image_url_original: '',
    commission_amount: '',
    commission_percentage: '',
    gallery_images: [],
};


const normalizeGalleryImages = (images = [], primaryImageUrl = '') => {
    const clean = (images || [])
        .filter(image => image?.image_url)
        .map((image, index) => ({
            ...image,
            color_name: image.color_name || '',
            color_hex: image.color_hex || '',
            sort_order: index,
            is_primary: !!image.is_primary,
        }));

    let primaryIndex = primaryImageUrl
        ? clean.findIndex(image => image.image_url === primaryImageUrl)
        : clean.findIndex(image => image.is_primary);

    if (primaryImageUrl && primaryIndex === -1) {
        clean.unshift({
            image_url: primaryImageUrl,
            color_name: '',
            color_hex: '',
            is_primary: true,
            sort_order: 0,
        });
        primaryIndex = 0;
    }

    if (primaryIndex === -1 && clean.length > 0) primaryIndex = 0;

    return clean.map((image, index) => ({
        ...image,
        sort_order: index,
        is_primary: index === primaryIndex,
    }));
};


const formatMoneyInput = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(2) : '';
};

const formatPercentInput = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const number = Number(value);
    if (!Number.isFinite(number)) return '';
    return number.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
};

const formatQtyInput = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const number = Number(value);
    if (!Number.isFinite(number)) return '';
    return number.toFixed(3).replace(/\.?0+$/, '');
};

const toFiniteNumber = (value) => {
    const number = parseFloat(value);
    return Number.isFinite(number) ? number : null;
};

const calculatePriceFromMargin = (cost, margin) => {
    const costNumber = toFiniteNumber(cost);
    const marginNumber = toFiniteNumber(margin);
    if (costNumber === null || marginNumber === null || costNumber <= 0) return null;
    return costNumber * (1 + marginNumber / 100);
};

const calculateMarginFromPrice = (cost, price) => {
    const costNumber = toFiniteNumber(cost);
    const priceNumber = toFiniteNumber(price);
    if (costNumber === null || priceNumber === null || costNumber <= 0) return null;
    return ((priceNumber - costNumber) / costNumber) * 100;
};

const normalizeColorHex = (value) => {
    if (!value) return '#6366f1';
    const raw = String(value).trim();
    if (!raw) return '#6366f1';
    return raw.startsWith('#') ? raw : `#${raw}`;
};

const getColorVariants = (instances = []) => {
    const variantsMap = new Map();

    (Array.isArray(instances) ? instances : []).forEach((instance) => {
        const colorName = String(instance?.color_name || '').trim();
        const colorHex = normalizeColorHex(instance?.color_hex);
        const key = `${colorName || colorHex}|${colorHex}`;

        if (!variantsMap.has(key)) {
            variantsMap.set(key, {
                key,
                name: colorName || 'Color sin nombre',
                hex: colorHex,
                count: 0,
            });
        }

        variantsMap.get(key).count += 1;
    });

    return Array.from(variantsMap.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

const buildUnitPayload = (unit) => {
    const rawInput = Number(unit.user_input || unit.conversion_factor || 0);
    const conversionFactor = unit.type === 'fraction'
        ? (rawInput ? 1 / rawInput : 0)
        : rawInput;

    return {
        ...(unit.id && typeof unit.id === 'number' && unit.id <= 10_000_000 ? { id: unit.id } : {}),
        unit_name: (unit.unit_name || '').trim(),
        conversion_factor: conversionFactor,
        barcode: (unit.barcode || '').trim(),
        cost_price: unit.cost_price !== '' && unit.cost_price !== null && unit.cost_price !== undefined ? parseFloat(unit.cost_price) : null,
        price_usd: unit.price_usd !== '' && unit.price_usd !== null && unit.price_usd !== undefined ? parseFloat(unit.price_usd) : null,
        profit_margin: unit.profit_margin !== '' && unit.profit_margin !== null && unit.profit_margin !== undefined ? parseFloat(unit.profit_margin) : null,
        discount_percentage: parseFloat(unit.discount_percentage) || 0,
        is_discount_active: !!unit.is_discount_active,
        is_default: !!unit.is_default,
        exchange_rate_id: unit.exchange_rate_id ? parseInt(unit.exchange_rate_id, 10) : null,
    };
};

const validateUnitsForSubmit = (units = []) => {
    const seenNames = new Set();
    const seenBarcodes = new Set();
    const seenFactors = new Set();
    const cleanUnits = [];

    for (const unit of units) {
        const clean = buildUnitPayload(unit);
        const nameKey = clean.unit_name.toLowerCase();
        const barcodeKey = clean.barcode.toLowerCase();
        const factorKey = Number(clean.conversion_factor || 0).toFixed(6);

        if (!clean.unit_name) {
            return { ok: false, message: 'Cada presentacion debe tener un nombre claro.' };
        }
        if (!Number.isFinite(clean.conversion_factor) || clean.conversion_factor <= 0) {
            return { ok: false, message: `La presentacion "${clean.unit_name}" tiene una conversion invalida.` };
        }
        if (clean.price_usd === null || !Number.isFinite(clean.price_usd) || clean.price_usd <= 0) {
            return { ok: false, message: `La presentacion "${clean.unit_name}" debe tener precio mayor que cero.` };
        }
        if (seenNames.has(nameKey)) {
            return { ok: false, message: `Ya existe una presentacion llamada "${clean.unit_name}".` };
        }
        if (barcodeKey && seenBarcodes.has(barcodeKey)) {
            return { ok: false, message: `El codigo de barras "${clean.barcode}" esta repetido en presentaciones.` };
        }
        if (seenFactors.has(factorKey)) {
            return { ok: false, message: `Ya existe una presentacion con la misma conversion que "${clean.unit_name}".` };
        }

        seenNames.add(nameKey);
        if (barcodeKey) seenBarcodes.add(barcodeKey);
        seenFactors.add(factorKey);
        cleanUnits.push(clean);
    }

    return { ok: true, units: cleanUnits };
};

const FieldLabel = ({ children }) => (
    <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">
        {children}
    </label>
);

const Panel = ({ id, title, eyebrow, action, children, className }) => (
    <section id={id} className={cn('rounded-lg border border-slate-200 bg-white shadow-sm', className)}>
        {(title || eyebrow || action) && (
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div className="min-w-0">
                    {eyebrow && <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{eyebrow}</p>}
                    {title && <h3 className="truncate text-sm font-black text-slate-900">{title}</h3>}
                </div>
                {action}
            </div>
        )}
        <div className="p-4">{children}</div>
    </section>
);

const TypeOption = ({ id, active, icon: Icon, label, onClick }) => (
    <button
        id={id}
        type="button"
        onClick={onClick}
        className={cn(
            'flex h-11 items-center gap-2 rounded-md border px-2.5 text-left text-xs font-black transition-all',
            active
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/10'
                : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-slate-900'
        )}
    >
        <Icon size={15} className="shrink-0" />
        <span className="truncate">{label}</span>
    </button>
);

const mapInitialProduct = (product) => {
    if (!product) return { ...defaultForm };
    const prices = {};
    if (Array.isArray(product.prices)) {
        product.prices.forEach(item => {
            const listId = item.price_list_id || item.price_list?.id;
            if (listId) prices[listId] = formatMoneyInput(item.price);
        });
    } else if (product.prices && typeof product.prices === 'object') {
        Object.entries(product.prices).forEach(([listId, price]) => {
            prices[listId] = formatMoneyInput(price);
        });
    }

    const incomingGallery = Array.isArray(product.gallery_images) ? product.gallery_images : [];
    const fallbackPrimary = product.image_url || '';

    return {
        ...defaultForm,
        name: product.name || '',
        sku: product.sku || '',
        category_id: product.category_id || product.category?.id || null,
        cost: formatMoneyInput(product.cost_price ?? product.cost),
        price: formatMoneyInput(product.price),
        profit_margin: formatPercentInput(product.profit_margin),
        stock: formatQtyInput(product.stock ?? 0),
        min_stock: formatQtyInput(product.min_stock ?? 5),
        location: product.location || '',
        unit_type: product.unit_type || 'UNID',
        exchange_rate_id: product.exchange_rate_id || null,
        is_service: !!product.is_service,
        has_imei: !!product.has_imei,
        is_combo: !!product.is_combo,
        is_menu_item: !!product.is_menu_item,
        is_commissionable: !!product.is_commissionable,
        warehouse_stocks: Array.isArray(product.stocks) ? product.stocks : (Array.isArray(product.warehouse_stocks) ? product.warehouse_stocks : []),
        prices,
        units: Array.isArray(product.units)
            ? product.units.filter(unit => unit.is_active !== false).map(unit => {
                const factor = Number(unit.conversion_factor) || 1;
                const isPacking = factor >= 1;
                return {
                    id: unit.id,
                    unit_name: unit.unit_name || '',
                    user_input: isPacking ? factor : (factor > 0 ? 1 / factor : 1),
                    conversion_factor: factor,
                    type: isPacking ? 'packing' : 'fraction',
                    barcode: unit.barcode || '',
                    cost_price: unit.cost_price ?? 0,
                    profit_margin: unit.profit_margin ?? '',
                    price_usd: unit.price_usd ?? '',
                    discount_percentage: unit.discount_percentage ?? 0,
                    is_discount_active: !!unit.is_discount_active,
                    is_default: !!unit.is_default,
                    exchange_rate_id: unit.exchange_rate_id || '',
                };
            })
            : [],
        combo_items: Array.isArray(product.combo_items) ? product.combo_items : [],
        promotion_items: Array.isArray(product.promotion_items) ? product.promotion_items.filter(item => item.is_active !== false).map(item => ({
            id: item.id,
            child_product_id: item.child_product_id,
            quantity: formatQtyInput(item.quantity || 1),
            unit_id: item.unit_id || null,
            label: item.label || '',
            child_product: item.child_product || null,
            is_active: item.is_active !== false,
        })) : [],
        warranty_policy_id: product.warranty_policy_id || null,
        image_url: product.image_url || '',
        image_url_original: product.image_url_original || '',
        commission_amount: product.commission_amount ?? '',
        commission_percentage: product.commission_percentage ?? '',
        gallery_images: normalizeGalleryImages(incomingGallery, fallbackPrimary),
    };
};

const CompactProductForm = ({ isOpen, onClose, onSubmit, initialData = null, categories = [], warehouses = [], exchangeRates = [] }) => {
    const { modules } = useConfig();
    const { startTour } = useAppTour();
    const [formData, setFormData] = useState(defaultForm);
    const [activeTab, setActiveTab] = useState('precios');
    const [saving, setSaving] = useState(false);
    const [priceCalcMode, setPriceCalcMode] = useState('margin');
    const [priceLists, setPriceLists] = useState([]);
    const [policies, setPolicies] = useState([]);
    const [promoSearch, setPromoSearch] = useState('');
    const [promoResults, setPromoResults] = useState([]);
    const [loadingPromoResults, setLoadingPromoResults] = useState(false);
    const isEditing = !!initialData?.id;

    const priceValue = parseFloat(formData.price || 0) || 0;
    const costValue = parseFloat(formData.cost || 0) || 0;
    const marginValue = parseFloat(formData.profit_margin || 0) || 0;
    const profitValue = priceValue - costValue;
    const productType = formData.is_service ? 'service' : formData.is_combo ? 'combo' : formData.has_imei ? 'serial' : 'physical';
    const selectedCategory = categories.find(category => String(category.id) === String(formData.category_id));
    const selectedWarranty = policies.find(policy => String(policy.id) === String(formData.warranty_policy_id));
    const productTypeLabel = { physical: 'Fisico', serial: 'Serial', service: 'Servicio', combo: 'Combo' }[productType] || 'Fisico';
    const canUsePresentations = !formData.is_service && !formData.is_combo;
    const colorVariants = useMemo(() => getColorVariants(initialData?.instances), [initialData]);

    const startProductFormGuide = () => {
        setActiveTab('precios');
        setTimeout(() => startTour('PRODUCT_FORM_PRESENTATIONS'), 120);
    };

    const fetchPriceLists = async () => {
        try {
            const { data } = await apiClient.get('/price-lists/');
            setPriceLists(Array.isArray(data) ? data.filter(list => list.is_active !== false) : []);
        } catch {
            setPriceLists([]);
        }
    };

    const fetchPolicies = async () => {
        try {
            const { data } = await apiClient.get('/warranties/policies');
            setPolicies(Array.isArray(data) ? data.filter(policy => policy.is_active !== false) : []);
        } catch {
            setPolicies([]);
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        setFormData(mapInitialProduct(initialData));
        setPriceCalcMode('margin');
        setActiveTab('precios');
        fetchPriceLists();
        fetchPolicies();
    }, [isOpen, initialData]);

    const createPriceList = async () => {
        const name = window.prompt('Nombre de la nueva lista de precios:');
        if (!name?.trim()) return;
        try {
            await apiClient.post('/price-lists/', { name: name.trim(), is_active: true, requires_auth: false });
            await fetchPriceLists();
            toast.success(`Lista "${name.trim()}" creada`);
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'No se pudo crear la lista');
        }
    };

    const renamePriceList = async (list) => {
        const name = window.prompt('Nuevo nombre de la lista:', list.name);
        if (!name?.trim() || name.trim() === list.name) return;
        try {
            await apiClient.patch(`/price-lists/${list.id}`, { name: name.trim() });
            await fetchPriceLists();
            toast.success('Lista actualizada');
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'No se pudo actualizar la lista');
        }
    };

    const setProductType = (type) => {
        setFormData(prev => ({
            ...prev,
            is_service: type === 'service',
            has_imei: type === 'serial',
            is_combo: type === 'combo',
            combo_items: type === 'combo' ? prev.combo_items : [],
            warehouse_stocks: type === 'physical' ? prev.warehouse_stocks : [],
            stock: type === 'physical' ? prev.stock : 0,
        }));
    };

    const searchPromoProducts = async (query) => {
        const q = query.trim();
        setPromoSearch(query);
        if (q.length < 2) {
            setPromoResults([]);
            return;
        }
        setLoadingPromoResults(true);
        try {
            const { data } = await apiClient.get('/products/', { params: { search: q, limit: 8 } });
            const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
            setPromoResults(items.filter(item => item.is_active !== false && !item.has_imei && String(item.id) !== String(initialData?.id || '')));
        } catch {
            setPromoResults([]);
        } finally {
            setLoadingPromoResults(false);
        }
    };

    const addPromotionItem = (product) => {
        if (!product?.id) return;
        if (formData.promotion_items.some(item => String(item.child_product_id) === String(product.id))) {
            toast.error('Ese producto ya esta incluido en la promocion');
            return;
        }
        setFormData(prev => ({
            ...prev,
            promotion_items: [
                ...(prev.promotion_items || []),
                {
                    child_product_id: product.id,
                    quantity: '1',
                    unit_id: null,
                    label: `Incluido: ${product.name}`,
                    child_product: product,
                    is_active: true,
                }
            ]
        }));
        setPromoSearch('');
        setPromoResults([]);
    };

    const updatePromotionItem = (index, patch) => {
        setFormData(prev => ({
            ...prev,
            promotion_items: (prev.promotion_items || []).map((item, i) => i === index ? { ...item, ...patch } : item),
        }));
    };

    const removePromotionItem = (index) => {
        setFormData(prev => ({
            ...prev,
            promotion_items: (prev.promotion_items || []).filter((_, i) => i !== index),
        }));
    };

    const setWarehouseQty = (warehouseId, rawValue) => {
        const quantity = parseFloat(rawValue) || 0;
        setFormData(prev => {
            const stocks = [...prev.warehouse_stocks];
            const idx = stocks.findIndex(item => item.warehouse_id === warehouseId);
            if (idx >= 0) stocks[idx] = { ...stocks[idx], quantity };
            else stocks.push({ warehouse_id: warehouseId, quantity });
            return { ...prev, warehouse_stocks: stocks, stock: stocks.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) };
        });
    };

    const handleCostChange = (value) => {
        setFormData(prev => {
            const next = { ...prev, cost: value };
            if (priceCalcMode === 'price') {
                const marginFromPrice = calculateMarginFromPrice(value, prev.price);
                if (marginFromPrice !== null) next.profit_margin = formatPercentInput(marginFromPrice);
                return next;
            }
            const priceFromMargin = calculatePriceFromMargin(value, prev.profit_margin);
            if (priceFromMargin !== null) next.price = formatMoneyInput(priceFromMargin);
            return next;
        });
    };

    const handlePriceChange = (value) => {
        setPriceCalcMode('price');
        setFormData(prev => {
            const next = { ...prev, price: value };
            const margin = calculateMarginFromPrice(prev.cost, value);
            if (margin !== null) next.profit_margin = formatPercentInput(margin);
            return next;
        });
    };

    const handleMarginChange = (value) => {
        setPriceCalcMode('margin');
        setFormData(prev => {
            const next = { ...prev, profit_margin: value };
            const price = calculatePriceFromMargin(prev.cost, value);
            if (price !== null) next.price = formatMoneyInput(price);
            return next;
        });
    };

    const handlePrimaryImageChange = (url) => {
        setFormData(prev => {
            const normalizedGallery = normalizeGalleryImages(prev.gallery_images || [], url || '');
            const primary = normalizedGallery.find(image => image.is_primary);
            return {
                ...prev,
                image_url: primary?.image_url || url || '',
                gallery_images: normalizedGallery,
            };
        });
    };

    const handleGalleryChange = (galleryImages) => {
        setFormData(prev => {
            const normalizedGallery = normalizeGalleryImages(galleryImages, prev.image_url);
            const primary = normalizedGallery.find(image => image.is_primary);
            return {
                ...prev,
                image_url: primary?.image_url || prev.image_url || '',
                gallery_images: normalizedGallery,
            };
        });
    };

    const handleSubmit = async () => {
        const name = formData.name.trim();
        const sku = formData.sku.trim();
        if (!name) {
            toast.error('El nombre del producto es obligatorio.');
            return;
        }
        if (priceValue <= 0) {
            toast.error('El precio de venta debe ser mayor que cero.');
            setActiveTab('precios');
            return;
        }

        const pricesArray = Object.entries(formData.prices || {})
            .map(([listId, rawPrice]) => ({
                price_list_id: parseInt(listId, 10),
                price: parseFloat(rawPrice) || 0,
            }))
            .filter(item => Number.isFinite(item.price_list_id) && item.price > 0);

        const normalizedGallery = normalizeGalleryImages(formData.gallery_images || [], formData.image_url);

        const unitsValidation = canUsePresentations ? validateUnitsForSubmit(formData.units) : { ok: true, units: [] };
        if (!unitsValidation.ok) {
            toast.error(unitsValidation.message);
            setActiveTab('precios');
            return;
        }

        const stockValue = productType === 'physical' ? parseFloat(formData.stock || 0) || 0 : 0;
        const payload = {
            ...formData,
            name,
            sku,
            category_id: formData.category_id ? parseInt(formData.category_id, 10) : null,
            cost_price: costValue,
            price: priceValue,
            stock: stockValue,
            min_stock: parseFloat(formData.min_stock || 0) || 0,
            exchange_rate_id: formData.exchange_rate_id ? parseInt(formData.exchange_rate_id, 10) : null,
            warranty_policy_id: formData.warranty_policy_id ? parseInt(formData.warranty_policy_id, 10) : null,
            profit_margin: Number.isFinite(marginValue) ? Math.min(marginValue, 999.99) : null,
            commission_amount: formData.commission_amount ? parseFloat(formData.commission_amount) : null,
            commission_percentage: formData.commission_percentage ? parseFloat(formData.commission_percentage) : null,
            warehouse_stocks: productType === 'physical' ? formData.warehouse_stocks : [],
            units: unitsValidation.units,
            combo_items: formData.is_combo ? (formData.combo_items || []) : [],
            promotion_items: (formData.promotion_items || [])
                .map(item => ({
                    child_product_id: parseInt(item.child_product_id, 10),
                    quantity: parseFloat(item.quantity || 0),
                    unit_id: item.unit_id ? parseInt(item.unit_id, 10) : null,
                    label: item.label || '',
                    is_active: item.is_active !== false,
                }))
                .filter(item => Number.isFinite(item.child_product_id) && item.quantity > 0),
            prices: pricesArray,
            image_url: normalizedGallery.find(image => image.is_primary)?.image_url || formData.image_url || '',
            gallery_images: normalizedGallery,
        };
        delete payload.cost;

        setSaving(true);
        try {
            await onSubmit(payload);
            setFormData({ ...defaultForm });
        } catch (error) {
            toast.error(getApiErrorMessage(error, isEditing ? 'No se pudo actualizar el producto. Revisa los datos e intenta de nuevo.' : 'No se pudo crear el producto. Revisa los datos e intenta de nuevo.'));
        } finally {
            setSaving(false);
        }
    };

    const tabs = [
        { id: 'precios', label: 'Precios', icon: DollarSign },
        { id: 'inventario', label: 'Inventario', icon: Warehouse },
        { id: 'media', label: 'Imagen', icon: ImageIcon },
        { id: 'avanzado', label: 'Avanzado', icon: Layers },
    ];

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent id="tour-product-form-shell" side="right" className="w-full sm:w-[95vw] sm:max-w-[1180px] flex flex-col gap-0 p-0 border-l border-slate-200 bg-slate-100 [&>button.absolute]:hidden">
                <header className="sticky top-0 z-20 border-b border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between gap-3 px-5 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-white shadow-sm shadow-indigo-200">
                                <Package size={18} />
                            </div>
                            <div className="min-w-0">
                                <h2 className="truncate text-lg font-black leading-tight text-slate-900">{isEditing ? 'Editar producto' : 'Nuevo producto'}</h2>
                                <p className="truncate text-xs font-bold text-slate-500">{isEditing ? 'Actualiza la ficha del producto' : 'Registro rapido de producto'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button id="tour-product-form-guide" type="button" variant="outline" onClick={startProductFormGuide} className="font-black text-indigo-600">
                                <BookOpen size={15} className="mr-2" /> Guia
                            </Button>
                            <Button type="button" variant="ghost" onClick={onClose} className="font-bold">Cancelar</Button>
                            <Button id="tour-product-form-save" type="button" onClick={handleSubmit} disabled={saving || !formData.name.trim()} className="bg-indigo-600 font-black text-white hover:bg-indigo-700">
                                <Check size={16} className="mr-2" /> {saving ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Guardar')}
                            </Button>
                        </div>
                    </div>
                </header>

                <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)]">
                    <aside className="min-h-0 overflow-y-auto border-r border-slate-200 bg-white [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <div className="space-y-4 p-4">
                            <Panel id="tour-product-form-main" title="Datos principales" eyebrow="Producto" className="shadow-none">
                                <div className="space-y-3">
                                    <div>
                                        <FieldLabel>Nombre *</FieldLabel>
                                        <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Nombre del producto" className="h-10 font-bold" />
                                    </div>
                                    <div className="grid grid-cols-1 gap-3">
                                        <div>
                                            <FieldLabel>SKU / Codigo</FieldLabel>
                                            <Input value={formData.sku} onChange={e => setFormData(p => ({ ...p, sku: e.target.value }))} placeholder="SKU-001" className="h-10 font-bold" />
                                        </div>
                                        <div>
                                            <FieldLabel>Categoria</FieldLabel>
                                            <select
                                                value={formData.category_id || ''}
                                                onChange={e => setFormData(p => ({ ...p, category_id: e.target.value || null }))}
                                                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400"
                                            >
                                                <option value="">Sin categoria</option>
                                                {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </Panel>

                            <Panel id="tour-product-form-type" title="Tipo de producto" eyebrow="Configuracion" className="shadow-none">
                                <div className="grid grid-cols-2 gap-2">
                                    <TypeOption active={productType === 'physical'} icon={Package} label="Producto" onClick={() => setProductType('physical')} />
                                    {modules?.services && <TypeOption active={productType === 'serial'} icon={ScanBarcode} label="Serial" onClick={() => setProductType('serial')} />}
                                    <TypeOption active={productType === 'service'} icon={Scissors} label="Servicio" onClick={() => setProductType('service')} />
                                    <TypeOption active={productType === 'combo'} icon={Layers} label="Combo" onClick={() => setProductType('combo')} />
                                </div>
                            </Panel>



                            {productType === 'serial' && colorVariants.length > 0 && (
                                <Panel title="Variaciones detectadas" eyebrow="Colores activos" className="shadow-none">
                                    <div className="space-y-2">
                                        {colorVariants.map((variant) => (
                                            <div key={variant.key} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <span
                                                        className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-200 shadow-sm"
                                                        style={{ backgroundColor: variant.hex }}
                                                        title={variant.hex}
                                                    />
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-black text-slate-800">{variant.name}</p>
                                                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{variant.hex}</p>
                                                    </div>
                                                </div>
                                                <span className="rounded-md border border-indigo-100 bg-indigo-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-indigo-700">
                                                    {variant.count} IMEI
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                            )}
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vista rapida</p>
                                <div className="mt-2 space-y-2 text-xs font-bold text-slate-600">
                                    <div className="flex justify-between gap-3"><span>Tipo</span><span className="text-slate-900">{productTypeLabel}</span></div>
                                    <div className="flex justify-between gap-3"><span>Categoria</span><span className="truncate text-slate-900">{selectedCategory?.name || 'Sin categoria'}</span></div>
                                    <div className="flex justify-between gap-3"><span>Precio</span><span className="text-emerald-700">${priceValue.toFixed(2)}</span></div>
                                    <div className="flex justify-between gap-3"><span>Stock</span><span className="text-slate-900">{Number(formData.stock || 0)}</span></div>
                                </div>
                            </div>

                            {productType === 'serial' && colorVariants.length > 0 && (
                                <Panel title="Variaciones detectadas" eyebrow="Colores activos" className="shadow-none">
                                    <div className="space-y-2">
                                        {colorVariants.map((variant) => (
                                            <div key={variant.key} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <span
                                                        className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-200 shadow-sm"
                                                        style={{ backgroundColor: variant.hex }}
                                                        title={variant.hex}
                                                    />
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-black text-slate-800">{variant.name}</p>
                                                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{variant.hex}</p>
                                                    </div>
                                                </div>
                                                <span className="rounded-md border border-indigo-100 bg-indigo-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-indigo-700">
                                                    {variant.count} IMEI
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                            )}
                        </div>
                    </aside>

                    <main className="flex min-h-0 flex-col overflow-hidden">
                        <nav id="tour-product-form-tabs" className="border-b border-slate-200 bg-white px-4 py-3">
                            <div className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1">
                                {tabs.map(tab => {
                                    const Icon = tab.icon;
                                    const active = activeTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setActiveTab(tab.id)}
                                            className={cn(
                                                'inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-black transition-all',
                                                active ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                                            )}
                                        >
                                            <Icon size={15} />
                                            <span className="hidden sm:inline">{tab.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </nav>

                        <div className="min-h-0 flex-1 overflow-y-auto p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {activeTab === 'precios' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_1fr_1fr]">
                                        <Panel id="tour-product-form-price" title="Precio de venta" eyebrow="POS y catalogo" className="border-emerald-200">
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl font-black text-emerald-500">$</span>
                                                <Input type="number" step="0.01" value={formData.price} onChange={e => handlePriceChange(e.target.value)} onBlur={e => setFormData(p => ({ ...p, price: formatMoneyInput(e.target.value) }))} className="h-12 border-2 border-emerald-200 pl-8 text-right text-2xl font-black text-emerald-600" placeholder="0.00" />
                                            </div>
                                        </Panel>
                                        <Panel title="Costo" eyebrow="Compra">
                                            <Input type="number" step="0.01" value={formData.cost} onChange={e => handleCostChange(e.target.value)} onBlur={e => setFormData(p => ({ ...p, cost: formatMoneyInput(e.target.value) }))} className="h-12 text-right text-lg font-black" placeholder="0.00" />
                                        </Panel>
                                        <Panel title="Margen" eyebrow="Utilidad">
                                            <div className="grid grid-cols-2 gap-2">
                                                <Input type="number" step="0.01" value={formData.profit_margin} onChange={e => handleMarginChange(e.target.value)} onBlur={e => setFormData(p => ({ ...p, profit_margin: formatPercentInput(e.target.value) }))} className="h-12 text-center text-lg font-black text-indigo-600" placeholder="0" />
                                                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Utilidad</p>
                                                    <p className={cn('text-lg font-black', profitValue < 0 ? 'text-rose-600' : 'text-slate-900')}>${profitValue.toFixed(2)}</p>
                                                </div>
                                            </div>
                                        </Panel>
                                    </div>

                                    <Panel
                                        id="tour-product-form-price-lists"
                                        title="Listas de precios"
                                        eyebrow={`${priceLists.length} activas`}
                                        action={(
                                            <button type="button" onClick={createPriceList} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 text-xs font-black text-indigo-600 hover:bg-indigo-100">
                                                <Plus size={13} /> Nueva lista
                                            </button>
                                        )}
                                    >
                                        <div className="overflow-hidden rounded-lg border border-slate-200">
                                            <div className="grid grid-cols-[1fr_160px_42px] bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                <span>Lista</span>
                                                <span className="text-right">Precio</span>
                                                <span />
                                            </div>
                                            <div className="divide-y divide-slate-100">
                                                <div className="grid grid-cols-[1fr_160px_42px] items-center px-3 py-2">
                                                    <span className="text-sm font-black text-emerald-700">Precio base</span>
                                                    <span className="text-right text-sm font-black text-emerald-700">${priceValue.toFixed(2)}</span>
                                                    <span />
                                                </div>
                                                {priceLists.map(list => (
                                                    <div key={list.id} className="grid grid-cols-[1fr_160px_42px] items-center gap-2 px-3 py-2">
                                                        <span className="truncate text-sm font-bold text-slate-700">{list.name}</span>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            value={formData.prices?.[list.id] || ''}
                                                            onChange={e => setFormData(prev => ({ ...prev, prices: { ...prev.prices, [list.id]: e.target.value } }))}
                                                            onBlur={e => setFormData(prev => ({ ...prev, prices: { ...prev.prices, [list.id]: formatMoneyInput(e.target.value) } }))}
                                                            placeholder="0.00"
                                                            className="h-8 text-right text-sm font-black text-indigo-700"
                                                        />
                                                        <button type="button" onClick={() => renamePriceList(list)} className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-indigo-50 hover:text-indigo-600" title="Renombrar lista">
                                                            <Pencil size={13} />
                                                        </button>
                                                    </div>
                                                ))}
                                                {priceLists.length === 0 && (
                                                    <div className="px-3 py-4 text-center text-xs font-bold text-slate-400">No hay listas activas.</div>
                                                )}
                                            </div>
                                        </div>
                                    </Panel>


                                    {canUsePresentations && (
                                        <Panel
                                            id="tour-product-form-presentations"
                                            title="Presentaciones y unidades"
                                            eyebrow={formData.units.length > 0 ? `${formData.units.length} configuradas` : 'Opcional'}
                                        >
                                            <ProductUnitManager
                                                units={formData.units}
                                                onUnitsChange={units => setFormData(prev => ({ ...prev, units }))}
                                                baseUnitType={formData.unit_type}
                                                basePrice={formData.price}
                                                baseCost={formData.cost}
                                                exchangeRates={exchangeRates}
                                                productExchangeRateId={formData.exchange_rate_id}
                                            />
                                        </Panel>
                                    )}
                                </div>
                            )}

                            {activeTab === 'inventario' && (
                                <div className="space-y-4">
                                    {productType === 'physical' && (
                                        <>
                                            <Panel id="tour-product-form-inventory" title="Parametros" eyebrow="Stock">
                                                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                                    <div><FieldLabel>Stock minimo</FieldLabel><Input type="number" step="0.001" value={formData.min_stock} onChange={e => setFormData(p => ({ ...p, min_stock: e.target.value }))} onBlur={e => setFormData(p => ({ ...p, min_stock: formatQtyInput(e.target.value) }))} className="h-10 font-bold" /></div>
                                                    <div><FieldLabel>Ubicacion</FieldLabel><Input value={formData.location} onChange={e => setFormData(p => ({ ...p, location: e.target.value }))} className="h-10 font-bold" placeholder="Pasillo A" /></div>
                                                    <div>
                                                        <FieldLabel>Unidad</FieldLabel>
                                                        <select value={formData.unit_type} onChange={e => setFormData(p => ({ ...p, unit_type: e.target.value }))} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold">
                                                            <option value="UNID">Unidad</option>
                                                            <option value="KILO">Kilo</option>
                                                            <option value="METRO">Metro</option>
                                                            <option value="CAJA">Caja</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </Panel>
                                            <Panel title="Existencias por almacen" eyebrow="Distribucion">
                                                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                                    {warehouses.map(warehouse => {
                                                        const qty = formData.warehouse_stocks.find(item => item.warehouse_id === warehouse.id)?.quantity || 0;
                                                        return (
                                                            <div key={warehouse.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                                                <span className="truncate text-sm font-bold text-slate-700">{warehouse.name}</span>
                                                                <Input type="number" step="0.001" value={formatQtyInput(qty)} onChange={e => setWarehouseQty(warehouse.id, e.target.value)} className="h-8 w-24 text-right font-black" />
                                                            </div>
                                                        );
                                                    })}
                                                    {warehouses.length === 0 && <p className="rounded-md border border-dashed border-slate-200 p-4 text-center text-sm font-bold text-slate-400">No hay almacenes configurados</p>}
                                                </div>
                                            </Panel>
                                        </>
                                    )}
                                    {productType === 'serial' && (
                                        <Panel id="tour-product-form-serial" title="Control serializado" eyebrow="IMEI / Serial">
                                            <p className="mb-4 text-sm font-medium text-slate-500">Las unidades se cargan luego desde Recepcion IMEI. Aqui defines alerta y ubicacion sugerida.</p>
                                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                                <Input type="number" step="0.001" value={formData.min_stock} onChange={e => setFormData(p => ({ ...p, min_stock: e.target.value }))} onBlur={e => setFormData(p => ({ ...p, min_stock: formatQtyInput(e.target.value) }))} placeholder="Alerta minima" />
                                                <Input value={formData.location} onChange={e => setFormData(p => ({ ...p, location: e.target.value }))} placeholder="Ubicacion sugerida" />
                                            </div>
                                        </Panel>
                                    )}
                                    {(productType === 'service' || productType === 'combo') && (
                                        <Panel title={productType === 'service' ? 'Servicio sin inventario' : 'Combo calculado por componentes'} eyebrow="Inventario">
                                            <p className="text-sm font-medium text-slate-500">Este tipo no requiere carga manual de stock en este formulario compacto.</p>
                                        </Panel>
                                    )}
                                </div>
                            )}

                            {activeTab === 'media' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_1fr]">
                                        <Panel id="tour-product-form-media" title="Imagen principal" eyebrow="Foto">
                                            <p className="text-sm font-medium text-slate-500">Esta foto se usa como portada del producto. Debajo puedes sumar imagenes adicionales por color o acabado.</p>
                                        </Panel>
                                        <Panel>
                                            <ProductImageUploader
                                                currentImageUrl={formData.image_url}
                                                currentImageOriginalUrl={formData.image_url_original}
                                                onImageUpdate={(url) => handlePrimaryImageChange(url || '')}
                                                onOriginalUpdate={(url) => setFormData(prev => ({ ...prev, image_url_original: url || '' }))}
                                            />
                                        </Panel>
                                    </div>

                                    <Panel title="Galeria y variantes visuales" eyebrow={(formData.gallery_images || []).length > 0 ? `${(formData.gallery_images || []).length} imagenes` : 'Opcional'}>
                                        <ProductGalleryManager
                                            galleryImages={formData.gallery_images || []}
                                            primaryImageUrl={formData.image_url}
                                            onChange={handleGalleryChange}
                                            onPrimaryChange={handlePrimaryImageChange}
                                        />
                                    </Panel>
                                </div>
                            )}

                            {activeTab === 'avanzado' && (
                                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                                    <Panel id="tour-product-form-advanced" title="Reglas" eyebrow="Opciones">
                                        <div className="space-y-2">
                                            {modules?.restaurant && (
                                                <label className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-black text-slate-700">
                                                    Item de menu
                                                    <input type="checkbox" checked={formData.is_menu_item} onChange={e => setFormData(p => ({ ...p, is_menu_item: e.target.checked }))} />
                                                </label>
                                            )}
                                            <label className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-black text-slate-700">
                                                Aplica comision
                                                <input type="checkbox" checked={formData.is_commissionable} onChange={e => setFormData(p => ({ ...p, is_commissionable: e.target.checked }))} />
                                            </label>
                                        </div>
                                    </Panel>
                                    <Panel title="Bonos de promocion" eyebrow={(formData.promotion_items || []).length ? `${(formData.promotion_items || []).length} incluidos` : 'Opcional'}>
                                        <div className="space-y-3">
                                            <div>
                                                <FieldLabel><span className="inline-flex items-center gap-1"><Gift size={12} /> Productos incluidos sin costo</span></FieldLabel>
                                                <div className="relative">
                                                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                    <Input value={promoSearch} onChange={e => searchPromoProducts(e.target.value)} placeholder="Buscar vidrio, forro, accesorio..." className="h-10 pl-9" />
                                                    {promoResults.length > 0 && (
                                                        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-xl">
                                                            {promoResults.map(product => (
                                                                <button key={product.id} type="button" onClick={() => addPromotionItem(product)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-indigo-50">
                                                                    <span>
                                                                        <span className="block text-sm font-black text-slate-800">{product.name}</span>
                                                                        <span className="text-xs font-bold text-slate-400">{product.sku || 'Sin SKU'} · Stock {Number(product.stock || 0).toFixed(0)}</span>
                                                                    </span>
                                                                    <span className="text-xs font-black text-indigo-600">Agregar</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                {loadingPromoResults && <p className="mt-1 text-xs font-bold text-slate-400">Buscando...</p>}
                                            </div>

                                            <div className="space-y-2">
                                                {(formData.promotion_items || []).map((item, index) => (
                                                    <div key={`${item.child_product_id}-${index}`} className="rounded-md border border-emerald-100 bg-emerald-50/50 p-3">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <p className="truncate text-sm font-black text-slate-800">{item.child_product?.name || `Producto #${item.child_product_id}`}</p>
                                                                <p className="text-xs font-bold text-emerald-700">Se cobra en $0.00 y descuenta stock</p>
                                                            </div>
                                                            <button type="button" onClick={() => removePromotionItem(index)} className="rounded-md border border-red-100 bg-white p-2 text-red-500 hover:bg-red-50" title="Eliminar incluido">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[110px_1fr]">
                                                            <Input type="number" min="0.001" step="0.001" value={item.quantity} onChange={e => updatePromotionItem(index, { quantity: e.target.value })} onBlur={e => updatePromotionItem(index, { quantity: formatQtyInput(e.target.value || 1) })} placeholder="Cant." />
                                                            <Input value={item.label || ''} onChange={e => updatePromotionItem(index, { label: e.target.value })} placeholder="Texto en factura: Incluido por promocion" />
                                                        </div>
                                                    </div>
                                                ))}
                                                {(formData.promotion_items || []).length === 0 && (
                                                    <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-400">
                                                        Sin productos incluidos. Si agregas un accesorio aqui, el POS lo bonifica y descuenta inventario automaticamente.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </Panel>
                                    <Panel title="Garantia y moneda" eyebrow="Venta">
                                        <div className="space-y-3">
                                            <div>
                                                <FieldLabel>Tasa de referencia</FieldLabel>
                                                <select value={formData.exchange_rate_id || ''} onChange={e => setFormData(p => ({ ...p, exchange_rate_id: e.target.value || null }))} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold">
                                                    <option value="">Tasa global</option>
                                                    {exchangeRates.map(rate => <option key={rate.id} value={rate.id}>{rate.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <FieldLabel><span className="inline-flex items-center gap-1"><ShieldCheck size={12} /> Garantia</span></FieldLabel>
                                                <select value={formData.warranty_policy_id || ''} onChange={e => setFormData(p => ({ ...p, warranty_policy_id: e.target.value || null }))} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold">
                                                    <option value="">Sin garantia</option>
                                                    {policies.map(policy => (
                                                        <option key={policy.id} value={policy.id}>
                                                            {policy.name} {policy.type === 'LIFETIME' ? '(De por vida)' : `(${policy.duration} ${policy.type})`}
                                                        </option>
                                                    ))}
                                                </select>
                                                {selectedWarranty && <p className="mt-2 text-xs font-bold text-slate-400">Seleccionada: {selectedWarranty.name}</p>}
                                            </div>
                                        </div>
                                    </Panel>
                                </div>
                            )}
                        </div>
                    </main>
                </div>
            </SheetContent>
        </Sheet>
    );
};

export default CompactProductForm;
