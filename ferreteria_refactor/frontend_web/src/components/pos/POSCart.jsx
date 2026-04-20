import { useState } from 'react';
import { Trash2, ShoppingCart, CreditCard, Minus, Plus, MapPin, Tag, X, Percent, DollarSign, ShieldCheck, Users, Pencil, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import ProductThumbnail from '../products/ProductThumbnail';
import { cn } from '../../lib/utils';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import PinAuthModal from '../common/PinAuthModal';
import { toast } from 'react-hot-toast';

import { useConfig } from '../../context/ConfigContext';
import { useCart } from '../../context/CartContext';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

const formatLocalCurrency = (amount) => {
    try {
        return new Intl.NumberFormat('de-DE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    } catch (error) {
        return amount.toFixed(2);
    }
};

// Helper: format quantity display - removes excessive decimals
const formatQty = (qty, factor) => {
    if (!factor || factor >= 1) return Number(qty).toFixed(0);
    if (factor >= 0.01) return Number(qty).toFixed(2);
    if (factor >= 0.001) return Number(qty).toFixed(3);
    return Number(qty).toFixed(4);
};

const POSCart = ({
    cartItems = [],
    onRemoveItem,
    onUpdateQuantity,
    onClearCart,
    totals = { totalUSD: 0, totalBs: 0 },
    anchorCurrency = { symbol: '$' },
    onCheckout,
    onItemClick,
    secondaryCurrency,
    convertPrice,
    totalsByCurrency = {}
}) => {

    const { business, currencies } = useConfig();
    const { cartDiscount, setCartDiscount, discountUSD, discountBs, rawTotalUSD, rawBs, updateCartItem } = useCart();
    const precioLibre = useFeatureFlag('precio_libre_pos');

    // Discount Panel state
    const [showDiscountPanel, setShowDiscountPanel] = useState(false);
    const [discountInput, setDiscountInput] = useState('');
    const [discountType, setDiscountType] = useState('percent'); // 'percent' | 'fixed' | 'fixed_bs' | 'target' | 'target_bs'

    // PIN Auth State
    const [showPinModal, setShowPinModal] = useState(false);
    const [pendingDiscount, setPendingDiscount] = useState(null);

    // Precio libre — edición inline por item
    const [editingPriceItemId, setEditingPriceItemId] = useState(null);
    const [priceInputValue, setPriceInputValue] = useState('');

    // Precio libre — edición de total final
    const [showTotalEdit, setShowTotalEdit] = useState(false);
    const [totalEditInput, setTotalEditInput] = useState('');

    const handleStartPriceEdit = (e, item) => {
        e.stopPropagation();
        setEditingPriceItemId(item.id);
        setPriceInputValue(String(item.unit_price_usd));
    };

    const handleConfirmPriceEdit = (e, item) => {
        e.stopPropagation();
        const newPrice = parseFloat(priceInputValue);
        if (!isNaN(newPrice) && newPrice > 0) {
            updateCartItem(item.id, {
                unit_price_usd: newPrice,
                price_overridden: true,
                original_price_usd: item.original_price_usd ?? item.unit_price_usd,
            });
        }
        setEditingPriceItemId(null);
    };

    const handleConfirmTotalEdit = () => {
        const val = parseFloat(totalEditInput);
        if (isNaN(val) || val <= 0) { toast.error('Ingresa un monto válido'); return; }
        if (val >= rawTotalUSD) { toast.error('El total debe ser menor al subtotal actual'); return; }
        setCartDiscount({ type: 'target', value: val, active: true });
        setShowTotalEdit(false);
        setTotalEditInput('');
    };

    // Calculate Taxes dynamically based on business config
    const taxRate = parseFloat(business?.default_tax_rate || 0);
    const subtotalUSD = totals.totalUSD / (1 + (taxRate / 100));
    const taxAmountUSD = totals.totalUSD - subtotalUSD;

    const handleApplyDiscount = () => {
        const val = parseFloat(discountInput);
        if (isNaN(val) || val <= 0) return;
        if (discountType === 'percent' && val > 100) return;
        if (discountType === 'target' && val >= rawTotalUSD) {
            // Assuming 'toast' is available globally or imported
            // If not, replace with console.error or similar
            toast.error("El monto final debe ser menor al total original");
            return;
        }
        if (discountType === 'target_bs') {
            if (val >= rawBs) { // Using rawBs as per instruction
                // Assuming 'toast' is available globally or imported
                toast.error("El monto final en Bs debe ser menor al total original");
                return;
            }
        }

        // Instead of applying directly, stage it and ask for PIN
        setPendingDiscount({ type: discountType, value: val, active: true });
        setShowPinModal(true);
    };

    const confirmApplyDiscount = (supervisorId) => {
        if (pendingDiscount) {
            setCartDiscount({ ...pendingDiscount, auth_user_id: supervisorId });
            setShowDiscountPanel(false);
            setPendingDiscount(null);
            setDiscountInput('');
        }
    };

    const handleRemoveDiscount = () => {
        setCartDiscount({ type: 'percent', value: 0, active: false });
        setDiscountInput('');
        setShowDiscountPanel(false);
    };

    const hasDiscount = cartDiscount?.active;

    return (
        <div id="tour-pos-cart" className="flex flex-col h-full bg-white relative">

            {/* Added PIN Modal */}
            <PinAuthModal
                isOpen={showPinModal}
                onClose={() => { setShowPinModal(false); setPendingDiscount(null); }}
                onSuccess={confirmApplyDiscount}
                title="Autorizar Descuento"
                message="Este descuento modificará el total de la factura. Requiere autorización de un administrador."
            />

            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-200 bg-white flex justify-between items-center flex-shrink-0 z-10 shadow-sm">
                <div className="flex items-center gap-2">
                    <h2 className="font-black text-slate-800 tracking-tight flex items-center gap-2">
                        <ShoppingCart className="text-blue-500" size={20} />
                        CARRITO
                    </h2>
                    <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-blue-200/50 px-2 font-bold tracking-widest text-[10px]">
                        {cartItems.length}
                    </Badge>
                </div>
                <div className="flex items-center gap-1.5">
                    {/* NEW: Global Discount Button */}
                    <Button
                        variant="secondary"
                        size="icon"
                        onClick={() => setShowDiscountPanel(v => !v)}
                        className={cn(
                            "h-9 w-9 rounded-xl transition-all font-bold border",
                            cartDiscount?.active
                                ? "bg-rose-500 text-white border-rose-600 hover:bg-rose-600 shadow-md shadow-rose-200"
                                : "bg-white text-slate-600 border-slate-200 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 shadow-sm"
                        )}
                        title={cartDiscount?.active ? `Descuento: ${cartDiscount.type === 'percent' ? cartDiscount.value + '%' : (cartDiscount.type === 'fixed_bs' ? 'Bs' : cartDiscount.type?.startsWith('fixed_') ? cartDiscount.type.replace('fixed_', '') : '$') + cartDiscount.value}` : "Aplicar Descuento"}
                        disabled={cartItems.length === 0}
                    >
                        <Tag size={16} />
                    </Button>
                    <Button
                        variant="secondary"
                        size="icon"
                        onClick={onClearCart}
                        className="h-9 w-9 bg-white text-slate-600 border border-slate-200 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 rounded-xl transition-all shadow-sm ml-1"
                        title="Limpiar Carrito"
                        disabled={cartItems.length === 0}
                    >
                        <Trash2 size={18} />
                    </Button>
                </div>
            </div>

            {/* Discount Panel - Inline Dropdown */}
            {showDiscountPanel && (
                <div className="border-b border-rose-100 bg-rose-50/60 px-4 py-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] font-black text-rose-700 uppercase tracking-widest flex items-center gap-1.5">
                            <Tag size={12} />
                            Descuento en Factura
                        </p>
                        <button onClick={() => setShowDiscountPanel(false)} className="text-rose-400 hover:text-rose-700 transition-colors">
                            <X size={14} />
                        </button>
                    </div>

                    {/* Type Toggle */}
                    <div className="flex rounded-xl overflow-hidden border border-rose-200 w-full mb-3 shadow-sm bg-white flex-wrap sm:flex-nowrap">
                        <button
                            onClick={() => setDiscountType('percent')}
                            className={cn(
                                "flex-1 min-w-[50px] flex items-center justify-center gap-1.5 py-2 text-[10px] font-black transition-all",
                                discountType === 'percent'
                                    ? "bg-rose-500 text-white shadow-inner"
                                    : "bg-white text-rose-400 hover:bg-rose-50 border-r border-b sm:border-b-0 border-rose-100"
                            )}
                        >
                            <Percent size={11} /> %
                        </button>
                        <button
                            onClick={() => setDiscountType('fixed')}
                            className={cn(
                                "flex-1 min-w-[50px] flex items-center justify-center gap-1.5 py-2 text-[10px] font-black transition-all",
                                discountType === 'fixed'
                                    ? "bg-rose-500 text-white shadow-inner"
                                    : "bg-white text-rose-400 hover:bg-rose-50 border-r border-b sm:border-b-0 border-rose-100"
                            )}
                        >
                            <DollarSign size={11} /> USD
                        </button>
                        <button
                            onClick={() => setDiscountType('fixed_bs')}
                            className={cn(
                                "flex-1 min-w-[50px] flex items-center justify-center gap-1.5 py-2 text-[10px] font-black transition-all",
                                discountType === 'fixed_bs'
                                    ? "bg-rose-500 text-white shadow-inner"
                                    : "bg-white text-rose-400 hover:bg-rose-50 border-r sm:border-r-0 border-b sm:border-b-0 border-rose-100"
                            )}
                        >
                            <span className="font-serif italic text-[11px] mr-[-2px]">Bs</span> Fijo
                        </button>
                        <button
                            onClick={() => setDiscountType('target')}
                            className={cn(
                                "flex-1 min-w-[50px] flex items-center justify-center gap-1.5 py-2 text-[10px] font-black transition-all",
                                discountType === 'target'
                                    ? "bg-indigo-500 text-white shadow-inner"
                                    : "bg-indigo-50 text-indigo-400 hover:bg-indigo-100 border-r border-indigo-200"
                            )}
                            title="Monto Final Deseado (USD)"
                        >
                            Final $
                        </button>
                        <button
                            onClick={() => setDiscountType('target_bs')}
                            className={cn(
                                "flex-1 min-w-[50px] flex items-center justify-center gap-1.5 py-2 text-[10px] font-black transition-all",
                                discountType === 'target_bs'
                                    ? "bg-indigo-500 text-white shadow-inner"
                                    : "bg-indigo-50 text-indigo-400 hover:bg-indigo-100"
                            )}
                            title="Monto Final Deseado (Bs)"
                        >
                            Final Bs
                        </button>
                    </div>

                    {/* Input */}
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-400 text-xs font-black">
                                {discountType === 'percent' ? '%' : (discountType === 'fixed_bs' || discountType === 'target_bs' ? 'Bs' : '$')}
                            </span>
                            <input
                                type="number"
                                min="0"
                                max={discountType === 'percent' ? 100 : undefined}
                                value={discountInput}
                                onChange={e => setDiscountInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleApplyDiscount()}
                                placeholder={discountType === 'percent' ? '0 – 100' : (discountType === 'target' || discountType === 'target_bs' ? 'Monto final a cobrar' : '0.00')}
                                autoFocus
                                className="w-full pl-8 pr-3 py-2 rounded-xl border-2 border-rose-200 bg-white text-sm font-black text-slate-800 focus:border-rose-400 focus:ring-4 focus:ring-rose-100 outline-none transition-all"
                            />
                        </div>
                        <button
                            onClick={handleApplyDiscount}
                            className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-black rounded-xl transition-all active:scale-95 shadow-md flex items-center gap-1.5"
                        >
                            <ShieldCheck size={14} />
                            Aplicar
                        </button>
                    </div>

                    {/* Remove current discount */}
                    {cartDiscount?.active && (
                        <button
                            onClick={handleRemoveDiscount}
                            className="w-full text-[10px] font-black text-rose-500 hover:text-rose-700 transition-colors bg-rose-100/50 py-1.5 rounded-lg border border-rose-100 flex items-center justify-center gap-1"
                        >
                            <X size={12} />
                            Quitar descuento activo
                        </button>
                    )}
                </div>
            )}

            {/* Cart Items List */}
            <div className="flex-1 overflow-hidden relative bg-slate-50/20">
                {cartItems.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 p-8 text-center animate-in fade-in zoom-in-95 duration-500">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-xl shadow-slate-200/50">
                            <ShoppingCart size={40} className="text-slate-200" strokeWidth={1.5} />
                        </div>
                        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Carrito Vacío</p>
                        <p className="text-[10px] mt-2 text-slate-400 max-w-[180px] leading-relaxed">Escanea un producto o selecciónalo del catálogo para comenzar la venta.</p>
                    </div>
                ) : (
                    <ScrollArea className="h-full w-full">
                        <div className="p-3 space-y-3">
                            {/* NEW: Reverse sort to show latest at top */}
                            {[...cartItems].reverse().map((item, idx) => (
                                <div
                                    key={`${item.id}-${item.unit_id}-${idx}`}
                                    onClick={() => onItemClick && onItemClick(item)}
                                    className="group flex items-center gap-4 p-3 bg-white border border-slate-100 rounded-2xl hover:border-blue-200 hover:shadow-xl transition-all cursor-pointer relative"
                                >
                                    {/* Thumbnail */}
                                    <div className="w-14 h-14 flex-shrink-0 bg-slate-50 rounded-xl overflow-hidden border border-slate-100 relative group-hover:bg-white transition-colors">
                                        <ProductThumbnail
                                            imageUrl={item.image_url}
                                            productName={item.name}
                                            size="sm"
                                            updatedAt={item.updated_at}
                                            className="w-full h-full object-contain"
                                        />
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
                                        <div className="flex justify-between items-start">
                                            <div className="min-w-0">
                                                <h4 className="text-[11px] font-black text-slate-800 truncate pr-2 leading-tight uppercase tracking-tight" title={item.name}>
                                                    {item.name}
                                                </h4>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100/50">
                                                        {item.unit_name}
                                                    </span>
                                                    {item.discount_percentage > 0 && (
                                                        <span className="text-[9px] font-black bg-rose-500 text-white px-1.5 py-0.5 rounded-lg">
                                                            -{item.discount_percentage}%
                                                        </span>
                                                    )}
                                                </div>
                                                {item.location && (
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <MapPin size={9} className="text-slate-400 flex-shrink-0" />
                                                        <span className="text-[9px] font-bold text-slate-400 truncate">{item.location}</span>
                                                    </div>
                                                )}
                                                {/* NEW: Barber assignment indicator */}
                                                {item.is_barbershop_service && (
                                                    <div className={cn(
                                                        "flex items-center gap-1 mt-1.5 px-1.5 py-0.5 rounded-lg border w-max",
                                                        item.employee_id
                                                            ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                                                            : "bg-rose-50 border-rose-200 text-rose-600 animate-pulse"
                                                    )}>
                                                        <Users size={9} className="flex-shrink-0" />
                                                        <span className="text-[9px] font-bold">
                                                            {item.employee_id ? "✅ Empleado Asignado" : "⚠️ Clic para asignar empleado"}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-right flex flex-col items-end gap-0.5">
                                                {/* Precio — editable si precio_libre_pos está activo */}
                                                {precioLibre && editingPriceItemId === item.id ? (
                                                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                        <span className="text-[10px] text-blue-400">$</span>
                                                        <input
                                                            autoFocus
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={priceInputValue}
                                                            onChange={e => setPriceInputValue(e.target.value)}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') handleConfirmPriceEdit(e, item);
                                                                if (e.key === 'Escape') { e.stopPropagation(); setEditingPriceItemId(null); }
                                                            }}
                                                            onBlur={e => handleConfirmPriceEdit(e, item)}
                                                            className="w-20 text-right text-sm font-black text-blue-600 border border-blue-300 rounded-lg px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-blue-50 tabular-nums"
                                                        />
                                                        <button
                                                            onMouseDown={e => handleConfirmPriceEdit(e, item)}
                                                            className="w-5 h-5 flex items-center justify-center rounded-lg bg-blue-500 text-white hover:bg-blue-600"
                                                        >
                                                            <Check size={10} strokeWidth={3} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div
                                                        className={cn(
                                                            "flex flex-col items-end gap-0 group/price",
                                                            precioLibre && "cursor-pointer"
                                                        )}
                                                        onClick={precioLibre ? e => handleStartPriceEdit(e, item) : undefined}
                                                        onMouseDown={precioLibre ? e => e.stopPropagation() : undefined}
                                                        title={precioLibre ? "Clic para editar precio unitario" : undefined}
                                                    >
                                                        <div className="flex items-center gap-1">
                                                            {item.price_overridden && (
                                                                <span className="text-[8px] font-black text-orange-500 bg-orange-50 border border-orange-200 px-1 rounded">MOD</span>
                                                            )}
                                                            <div className={cn(
                                                                "text-sm font-black text-blue-600 tabular-nums",
                                                                precioLibre && "group-hover/price:text-blue-400 transition-colors"
                                                            )}>
                                                                <span className="text-[10px] mr-0.5">$</span>
                                                                {formatLocalCurrency(item.subtotal_usd)}
                                                            </div>
                                                            {precioLibre && (
                                                                <Pencil size={9} className="text-blue-300 opacity-0 group-hover/price:opacity-100 transition-opacity flex-shrink-0" />
                                                            )}
                                                        </div>
                                                        {item.qty > 1 && (
                                                            <span className="text-[9px] text-slate-400 tabular-nums">
                                                                ${formatLocalCurrency(item.unit_price_usd)} c/u
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                {secondaryCurrency && item.subtotal_bs > 0 && (() => {
                                                    const rateObj = currencies.find(r => r.id === item.exchange_rate_id);
                                                    const localSym = rateObj?.currency_symbol || rateObj?.currency_code || secondaryCurrency.symbol;
                                                    return (
                                                        <div className="text-[10px] font-black text-emerald-700 tabular-nums bg-emerald-100/50 px-1.5 rounded-lg border border-emerald-200/50">
                                                            <span className="text-[8px] mr-1 italic opacity-60">{localSym}</span>
                                                            {formatLocalCurrency(item.subtotal_bs)}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between mt-2.5">
                                            {/* Quantity Control (Elegant) */}
                                            <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 h-8 shadow-inner overflow-hidden">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onUpdateQuantity(item.id, Math.max(0, item.quantity - 1));
                                                    }}
                                                    disabled={item.has_imei}
                                                    className="w-8 h-full flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-white transition-all border-r border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title={item.has_imei ? "Elimine el item para modificar seriales" : "Disminuir cantidad"}
                                                >
                                                    <Minus size={12} strokeWidth={3} />
                                                </button>
                                                <input
                                                    type="number"
                                                    value={formatQty(item.quantity, item.conversion_factor)}
                                                    onClick={(e) => { e.stopPropagation(); e.target.select(); }}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        const val = parseFloat(e.target.value);
                                                        if (!isNaN(val)) onUpdateQuantity(item.id, val);
                                                    }}
                                                    disabled={item.has_imei}
                                                    className="w-12 text-center text-sm font-black text-slate-900 bg-transparent border-none focus:ring-0 tabular-nums disabled:text-slate-500"
                                                />
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onUpdateQuantity(item.id, item.quantity + 1);
                                                    }}
                                                    disabled={item.has_imei}
                                                    className="w-8 h-full flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-white transition-all border-l border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title={item.has_imei ? "Escanee otro serial para agregar" : "Aumentar cantidad"}
                                                >
                                                    <Plus size={12} strokeWidth={3} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Remove Action (Accessible) */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRemoveItem(item.cartItemId || item.id);
                                        }}
                                        className="absolute top-2 right-2 bg-rose-50 border border-rose-100 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl w-8 h-8 flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100 active:scale-95"
                                        title="Eliminar item"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </div>

            {/* Footer Totals */}
            <div className="bg-white border-t border-slate-100 p-6 space-y-4 shadow-[0_-15px_30px_-15px_rgba(0,0,0,0.05)] z-10">
                <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <span>Subtotal Neto</span>
                        <span className="text-slate-600 tabular-nums">
                            {anchorCurrency.symbol}{formatLocalCurrency(subtotalUSD)}
                        </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <span>{taxRate > 0 ? `Impuestos (${taxRate}%)` : 'Impuestos (0%)'}</span>
                        <span className="text-slate-600 tabular-nums">
                            {anchorCurrency.symbol}{formatLocalCurrency(taxAmountUSD)}
                        </span>
                    </div>

                    {/* Discount Row */}
                    {hasDiscount && discountUSD > 0 && (
                        <div className="flex justify-between items-center text-[10px] font-black text-rose-600 uppercase tracking-widest animate-in slide-in-from-top-1 duration-200">
                            <span className="flex items-center gap-1">
                                <Tag size={10} />
                                Desc ({cartDiscount.type === 'percent' ? cartDiscount.value + '%' : (cartDiscount.type === 'fixed_bs' ? 'Bs Fijo' : 'Fijo')})
                            </span>
                            <span className="tabular-nums">
                                −{anchorCurrency.symbol}{formatLocalCurrency(discountUSD)}
                            </span>
                        </div>
                    )}
                </div>

                <div className="pt-4 border-t border-slate-100">
                    <div className="flex justify-between items-end mb-5">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total a Recibir</span>
                            <div className="flex items-baseline gap-1 animate-in slide-in-from-left-2 duration-500">
                                <span className="text-3xl font-black text-blue-600 tracking-tighter tabular-nums drop-shadow-sm">
                                    {anchorCurrency.symbol}{formatLocalCurrency(totals.totalUSD)}
                                </span>
                            </div>
                        </div>
                        <div className="text-right animate-in slide-in-from-right-2 duration-500 flex flex-col items-end gap-1">
                            {Object.entries(totalsByCurrency).filter(([code, amt]) => code !== 'USD' && amt > 0.005).map(([code, amt]) => {
                                const curr = currencies.find(c => c.currency_code === code && c.is_active);
                                const sym = curr?.currency_symbol || code;
                                return (
                                    <div key={code} className="bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-2xl">
                                        <span className="text-lg font-black text-emerald-500 tabular-nums tracking-tighter">
                                            {formatLocalCurrency(amt)} <span className="text-[10px] uppercase ml-0.5">{sym}</span>
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Edición libre de total final */}
                    {precioLibre && cartItems.length > 0 && (
                        <div className="mb-3">
                            {!showTotalEdit ? (
                                <button
                                    onClick={() => { setShowTotalEdit(true); setTotalEditInput(String(totals.totalUSD.toFixed(2))); }}
                                    className="w-full flex items-center justify-center gap-1.5 text-[10px] font-black text-orange-500 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-xl py-2 transition-colors"
                                >
                                    <Pencil size={10} />
                                    EDITAR TOTAL FINAL
                                </button>
                            ) : (
                                <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
                                    <span className="text-[10px] font-black text-orange-600 whitespace-nowrap">Total $</span>
                                    <input
                                        autoFocus
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={totalEditInput}
                                        onChange={e => setTotalEditInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handleConfirmTotalEdit();
                                            if (e.key === 'Escape') setShowTotalEdit(false);
                                        }}
                                        className="flex-1 text-right text-sm font-black text-orange-700 bg-white border border-orange-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-400 tabular-nums"
                                    />
                                    <button onClick={handleConfirmTotalEdit} className="w-7 h-7 flex items-center justify-center rounded-lg bg-orange-500 text-white hover:bg-orange-600 flex-shrink-0">
                                        <Check size={12} strokeWidth={3} />
                                    </button>
                                    <button onClick={() => setShowTotalEdit(false)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-orange-200 text-orange-400 hover:bg-orange-100 flex-shrink-0">
                                        <X size={12} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <Button
                        id="tour-pos-pay-btn"
                        size="lg"
                        className="w-full h-14 text-lg font-black bg-indigo-600 hover:bg-indigo-700 shadow-2xl shadow-indigo-300/30 rounded-2xl transition-all hover:-translate-y-1 active:scale-[0.98] group"
                        onClick={onCheckout}
                        disabled={cartItems.length === 0}
                    >
                        <CreditCard className="mr-3 group-hover:animate-bounce" size={24} />
                        COBRAR <span className="ml-2 text-[10px] opacity-60 bg-white/20 px-2 py-0.5 rounded-full font-mono">F5</span>
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default POSCart;
