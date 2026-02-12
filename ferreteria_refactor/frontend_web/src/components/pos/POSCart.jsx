import { Trash2, ShoppingCart, CreditCard, Minus, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import ProductThumbnail from '../products/ProductThumbnail';
import { cn } from '../../lib/utils';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

import { useConfig } from '../../context/ConfigContext';

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
    convertPrice
}) => {

    const { business } = useConfig();

    // Calculate Taxes dynamically based on business config
    const taxRate = parseFloat(business?.default_tax_rate || 0);
    const subtotalUSD = totals.totalUSD / (1 + (taxRate / 100));
    const taxAmountUSD = totals.totalUSD - subtotalUSD;

    return (
        <div className="flex flex-col h-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 rounded-xl text-blue-600 shadow-sm">
                        <ShoppingCart size={18} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-tighter">Orden de Venta</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            {cartItems.length} {cartItems.length === 1 ? 'producto' : 'productos'}
                        </p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClearCart}
                    className="h-9 w-9 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                    title="Limpiar Carrito"
                    disabled={cartItems.length === 0}
                >
                    <Trash2 size={18} />
                </Button>
            </div>

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
                            {cartItems.map((item, idx) => (
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
                                                    <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100/50">
                                                        {item.unit_name}
                                                    </span>
                                                    {item.discount_percentage > 0 && (
                                                        <span className="text-[9px] font-black bg-rose-500 text-white px-1.5 py-0.5 rounded-md">
                                                            -{item.discount_percentage}%
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right flex flex-col items-end">
                                                <div className="text-sm font-black text-blue-600 tabular-nums">
                                                    <span className="text-[10px] mr-0.5">$</span>
                                                    {formatLocalCurrency(item.subtotal_usd)}
                                                </div>
                                                {secondaryCurrency && (
                                                    <div className="text-[10px] font-bold text-emerald-500 tabular-nums bg-emerald-50 px-1.5 rounded-md border border-emerald-100/30">
                                                        <span className="text-[8px] mr-0.5 italic">Bs</span>
                                                        {formatLocalCurrency(item.subtotal_bs || 0)}
                                                    </div>
                                                )}
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
                                                    className="w-8 h-full flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-white transition-all border-r border-slate-200"
                                                >
                                                    <Minus size={12} strokeWidth={3} />
                                                </button>
                                                <span className="w-10 text-center text-xs font-black text-slate-800 tabular-nums">
                                                    {item.quantity}
                                                </span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onUpdateQuantity(item.id, item.quantity + 1);
                                                    }}
                                                    className="w-8 h-full flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-white transition-all border-l border-slate-200"
                                                >
                                                    <Plus size={12} strokeWidth={3} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Remove Action (Elegant Overlay) */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRemoveItem(item.cartItemId || item.id);
                                        }}
                                        className="absolute -top-1 -right-1 bg-white border border-rose-100 text-rose-500 hover:bg-rose-500 hover:text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100"
                                        title="Eliminar item"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </div>

            {/* Footer Totals - Elegant & Clear */}
            <div className="bg-white border-t border-slate-100 p-6 space-y-6 shadow-[0_-15px_30px_-15px_rgba(0,0,0,0.05)] z-10">
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
                </div>

                <div className="pt-4 border-t border-slate-100">
                    <div className="flex justify-between items-end mb-6">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total a Recibir</span>
                            <div className="flex items-baseline gap-1 animate-in slide-in-from-left-2 duration-500">
                                <span className="text-3xl font-black text-blue-600 tracking-tighter tabular-nums drop-shadow-sm">
                                    {anchorCurrency.symbol}{formatLocalCurrency(totals.totalUSD)}
                                </span>
                            </div>
                        </div>
                        <div className="text-right animate-in slide-in-from-right-2 duration-500">
                            <div className="bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-2xl">
                                <span className="text-lg font-black text-emerald-500 tabular-nums tracking-tighter">
                                    {formatLocalCurrency(totals.totalBs)} <span className="text-[10px] uppercase ml-0.5">Bs</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    <Button
                        size="lg"
                        className="w-full h-14 text-lg font-black bg-blue-600 hover:bg-blue-700 shadow-2xl shadow-blue-500/30 rounded-2xl transition-all hover:-translate-y-1 active:scale-[0.98] group"
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
