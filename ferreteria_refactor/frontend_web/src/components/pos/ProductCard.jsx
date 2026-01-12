import React from 'react';
import { Package, AlertTriangle, Layers, RotateCcw, User } from 'lucide-react';
import ProductThumbnail from '../products/ProductThumbnail'; // Assuming relative path adjustment

const formatCurrency = (amount, currency = 'USD') => {
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2
        }).format(amount);
    } catch (error) {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }
};

const ProductCard = ({
    product,
    onClick,
    currentStock = 0,
    currencySymbol = '$',
    convertProductPrice, // Function from context to get VES price
    isSelected = false
}) => {

    // Calculate Dual Price
    // We expect convertProductPrice to return the raw number in VES
    const priceBS = convertProductPrice ? convertProductPrice(product, 'VES') : 0;

    // Determine Stock Status Color
    const isLowStock = currentStock <= (product.min_stock || 5);
    const hasStock = currentStock > 0;

    return (
        <div
            onClick={() => onClick(product)}
            className={`
                group relative flex flex-col justify-between bg-white rounded-xl cursor-pointer transition-all duration-300
                border h-full min-h-[220px] overflow-hidden
                ${isSelected
                    ? 'ring-2 ring-indigo-500 shadow-xl border-transparent -translate-y-1'
                    : 'border-slate-100 shadow-md hover:shadow-xl hover:-translate-y-1 hover:border-indigo-100'
                }
            `}
        >
            {/* Image Section */}
            <div className="relative h-32 bg-slate-50 border-b border-slate-50 overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center p-4">
                    {/* We can use the existing ProductThumbnail but larger, or render img directly for object-cover */}
                    {product.image_url ? (
                        <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-500"
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                    ) : (
                        <Package className="text-slate-300 w-12 h-12" strokeWidth={1.5} />
                    )}
                </div>

                {/* Float Badges */}
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                    {/* Serialized Badge */}
                    {product.has_imei && (
                        <span className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                            SERIAL
                        </span>
                    )}
                    {/* Combo Badge */}
                    {product.is_combo && (
                        <span className="bg-purple-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1">
                            <Layers size={8} /> COMBO
                        </span>
                    )}
                </div>

                {/* Stock Badge */}
                <div className="absolute bottom-2 right-2">
                    {isLowStock && (
                        <span className={`
                            flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm backdrop-blur-sm
                            ${currentStock <= 0
                                ? 'bg-rose-500/90 text-white'
                                : 'bg-amber-400/90 text-amber-900'
                            }
                        `}>
                            {currentStock <= 0 ? 'AGOTADO' : 'POCO STOCK'}
                        </span>
                    )}
                </div>
            </div>

            {/* Content Section */}
            <div className="p-3 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 rounded tracking-tighter line-clamp-1 max-w-[80px]">
                        {product.sku || '---'}
                    </span>
                    {!isLowStock && (
                        <span className="text-[10px] font-medium text-slate-400">
                            Stock: {Number(currentStock).toFixed(0)}
                        </span>
                    )}
                </div>

                <h3 className="font-semibold text-slate-700 text-sm leading-snug line-clamp-2 mb-3 group-hover:text-indigo-600 transition-colors" title={product.name}>
                    {product.name}
                </h3>

                <div className="mt-auto pt-2 border-t border-slate-50">
                    <div className="flex flex-col items-end">
                        {/* Primary Price (USD) */}
                        <div className="flex items-baseline gap-0.5">
                            <span className="text-xs text-slate-400 font-medium">$</span>
                            <span className="text-xl font-bold text-slate-900 tracking-tight leading-none">
                                {formatCurrency(product.price, 'USD').replace('$', '')}
                            </span>
                        </div>

                        {/* Secondary Price (VES) */}
                        <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-[10px] text-slate-400 italic">aprox.</span>
                            <span className="text-xs font-bold text-indigo-600/80 font-mono">
                                Bs {priceBS.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductCard;
