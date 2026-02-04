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

function cnLocal(...inputs) {
    return twMerge(clsx(inputs));
}

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

    // Calculate Taxes for display
    // Assuming totalUSD includes tax, or we can calculate if needed. 
    // For now, let's assume totalUSD is the final price.
    // If we need tax separation, we'd need tax rate info.
    // Displaying "Impuestos incluidos" is safe for now if not clear.

    return (
        <div className="flex flex-col h-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                        <ShoppingCart size={18} />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-slate-800">Orden Actual</h2>
                        <p className="text-[10px] text-slate-500 font-medium">
                            {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}
                        </p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClearCart}
                    className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Limpiar Carrito"
                    disabled={cartItems.length === 0}
                >
                    <Trash2 size={16} />
                </Button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-hidden relative">
                {cartItems.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 p-8 text-center animate-in fade-in duration-500">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                            <ShoppingCart size={32} className="opacity-20" />
                        </div>
                        <p className="text-sm font-medium">Carrito Vacío</p>
                        <p className="text-xs mt-1">Escanea un producto o búscalo en el catálogo para comenzar.</p>
                    </div>
                ) : (
                    <ScrollArea className="h-full w-full">
                        <div className="p-2 space-y-2">
                            {cartItems.map((item, idx) => (
                                <div
                                    key={`${item.id}-${item.unit_id}-${idx}`}
                                    onClick={() => onItemClick && onItemClick(item)}
                                    className="group flex items-center gap-3 p-2 bg-white border border-slate-100 rounded-xl hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer relative"
                                >
                                    {/* Thumbnail */}
                                    <div className="w-12 h-12 flex-shrink-0 bg-slate-50 rounded-lg overflow-hidden border border-slate-100">
                                        <ProductThumbnail
                                            imageUrl={item.image_url}
                                            productName={item.name}
                                            size="sm"
                                        />
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="text-xs font-bold text-slate-700 truncate pr-2 max-w-[140px]" title={item.name}>
                                                {item.name}
                                            </h4>
                                            <div className="text-right">
                                                <div className="text-xs font-bold text-slate-900">
                                                    {anchorCurrency.symbol}{item.subtotal_usd?.toFixed(2)}
                                                </div>
                                                {secondaryCurrency && (
                                                    <div className="text-[10px] font-bold text-slate-500">
                                                        {secondaryCurrency.symbol}{(item.subtotal_bs || 0).toFixed(2)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className="text-[9px] px-1.5 h-4 bg-slate-100 text-slate-500 border-none font-medium">
                                                    {item.unit_name}
                                                </Badge>
                                                {item.discount_percentage > 0 && (
                                                    <Badge variant="destructive" className="text-[9px] px-1 h-4 font-bold">
                                                        -{item.discount_percentage}%
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* Quantity Control (Mini) */}
                                            <div className="flex items-center bg-slate-50 rounded-md border border-slate-200 h-6">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onUpdateQuantity(item.id, Math.max(0, item.quantity - 1)); // TODO: Handle remove if 0 separately? Usually handled by parent or useEffect
                                                    }}
                                                    className="w-6 h-full flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-l-md transition-colors"
                                                >
                                                    <Minus size={10} />
                                                </button>
                                                <span className="w-8 text-center text-xs font-bold text-slate-700 select-none">
                                                    {item.quantity}
                                                </span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onUpdateQuantity(item.id, item.quantity + 1);
                                                    }}
                                                    className="w-6 h-full flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-r-md transition-colors"
                                                >
                                                    <Plus size={10} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Remove Action (Hover only) */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRemoveItem(item.cartItemId || item.id); // Check ID structure
                                        }}
                                        className="absolute -top-1 -right-1 bg-white border border-rose-100 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-full w-5 h-5 flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Eliminar item"
                                    >
                                        <Trash2 size={10} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </div>

            {/* Footer Totals */}
            <div className="bg-slate-50 border-t border-slate-200 p-4 space-y-4">
                <div className="space-y-1.5 opacity-80">
                    <div className="flex justify-between text-xs text-slate-500">
                        <span>Subtotal</span>
                        <span>{anchorCurrency.symbol}{(totals.totalUSD * 0.84).toFixed(2)}</span> {/* Approx calc */}
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                        <span>Impuestos (Est.)</span>
                        <span>{anchorCurrency.symbol}{(totals.totalUSD * 0.16).toFixed(2)}</span>
                    </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60">
                    <div className="flex justify-between items-end mb-4">
                        <span className="text-sm font-bold text-slate-700 uppercase tracking-wide">Total a Pagar</span>
                        <div className="text-right leading-none">
                            <span className="block text-3xl font-black text-indigo-600 tracking-tight">
                                {anchorCurrency.symbol}{totals.totalUSD.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                                {totals.totalBs.toFixed(2)} Bs (Ref)
                            </span>
                        </div>
                    </div>

                    <Button
                        size="lg"
                        className="w-full h-12 text-lg font-bold bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all hover:translate-y-[-1px]"
                        onClick={onCheckout}
                        disabled={cartItems.length === 0}
                    >
                        <CreditCard className="mr-2" /> Cobrar (F5)
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default POSCart;
