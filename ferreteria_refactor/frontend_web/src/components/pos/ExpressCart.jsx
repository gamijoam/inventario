import { Trash2, Plus, Minus, ShoppingBag, Zap } from 'lucide-react';
import { Button } from '../ui/button';

/**
 * ExpressCart — Carrito para Modo Express POS.
 * Lista compacta de ítems con controles rápidos de cantidad.
 * CTA de cobro prominente en la parte inferior.
 */
const ExpressCart = ({
    cartItems = [],
    onRemoveItem,
    onUpdateQuantity,
    onClearCart,
    totals = { totalUSD: 0, totalBs: 0 },
    anchorCurrency = { symbol: '$' },
    onCheckout,
    secondaryCurrency,
    convertPrice,
}) => {
    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const displayBs = totals.totalBs || 0;

    return (
        <div className="flex flex-col h-full bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <ShoppingBag size={18} className="text-indigo-500" />
                    <span className="font-black text-slate-800 text-base">
                        Carrito Express
                    </span>
                    {cartItems.length > 0 && (
                        <span className="ml-1 bg-indigo-100 text-indigo-700 text-xs font-black rounded-full px-2 py-0.5">
                            {totalItems}
                        </span>
                    )}
                </div>
                {cartItems.length > 0 && (
                    <button
                        onClick={onClearCart}
                        className="text-xs text-slate-400 hover:text-rose-500 font-semibold transition-colors"
                    >
                        Limpiar
                    </button>
                )}
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto">
                {cartItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400 py-16">
                        <Zap size={36} className="text-slate-200" />
                        <p className="text-sm font-semibold text-center leading-snug">
                            Escanea o busca un producto<br />para comenzar
                        </p>
                    </div>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {cartItems.map((item) => {
                            const price = item.unit_price_usd || item.price_unit_usd || item.price_usd || 0;
                            const subtotal = price * item.quantity;
                            return (
                                <li key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group">
                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-slate-800 text-sm truncate">{item.name}</p>
                                        <p className="text-xs text-slate-400">{anchorCurrency.symbol}{price.toFixed(2)} c/u</p>
                                    </div>
                                    {/* Quantity Controls */}
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                                            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                                        >
                                            <Minus size={13} />
                                        </button>
                                        <span className="w-7 text-center font-black text-slate-800 text-sm">
                                            {item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(2)}
                                        </span>
                                        <button
                                            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                                            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                                        >
                                            <Plus size={13} />
                                        </button>
                                    </div>
                                    {/* Subtotal */}
                                    <div className="w-16 text-right shrink-0">
                                        <p className="font-black text-slate-800 text-sm">{anchorCurrency.symbol}{subtotal.toFixed(2)}</p>
                                    </div>
                                    {/* Remove */}
                                    <button
                                        onClick={() => onRemoveItem(item.id)}
                                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all ml-1"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {/* Footer: Total + CTA */}
            <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-500 font-semibold text-sm">Total</span>
                    <span className="text-2xl font-black text-slate-800">
                        {anchorCurrency.symbol}{totals.totalUSD.toFixed(2)}
                    </span>
                </div>
                {secondaryCurrency && displayBs > 0 && (
                    <p className="text-right text-xs text-slate-400 mb-3">
                        Bs {displayBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                )}
                <Button
                    onClick={onCheckout}
                    disabled={cartItems.length === 0}
                    className="w-full h-14 text-lg font-black rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-200 transition-all"
                >
                    Cobrar {anchorCurrency.symbol}{totals.totalUSD.toFixed(2)}
                </Button>
            </div>
        </div>
    );
};

export default ExpressCart;
