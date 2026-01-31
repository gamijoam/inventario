import React from 'react';
import { Package, AlertTriangle, Layers, RotateCcw, User } from 'lucide-react';
import { Badge } from '../ui/badge';
import ProductThumbnail from '../products/ProductThumbnail';

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
    convertProductPrice,
    isSelected = false
}) => {
    const priceBS = convertProductPrice ? convertProductPrice(product, 'VES') : 0;
    const isLowStock = currentStock <= (product.min_stock || 5);

    return (
        <div
            onClick={() => onClick(product)}
            className={`
                group relative flex flex-col justify-between bg-white rounded-xl cursor-pointer transition-all duration-300
                border h-full min-h-[240px] overflow-hidden
                ${isSelected
                    ? 'ring-2 ring-indigo-600 shadow-xl border-transparent -translate-y-1'
                    : 'border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-indigo-200'
                }
            `}
        >
            {/* Image Section */}
            <div className="relative h-36 bg-slate-50 border-b border-slate-50 overflow-hidden p-4">
                <div className="absolute inset-0 flex items-center justify-center p-4">
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
                    {product.has_imei && (
                        <Badge variant="secondary" className="bg-blue-600 text-white hover:bg-blue-700 text-[9px] px-1.5 h-5 gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span> SERIAL
                        </Badge>
                    )}
                    {product.units && product.units.length > 0 && (
                        <Badge variant="secondary" className="bg-emerald-600 text-white hover:bg-emerald-700 text-[9px] px-1.5 h-5 gap-1">
                            <Package size={8} /> CAJAS
                        </Badge>
                    )}
                    {product.is_combo && (
                        <Badge variant="secondary" className="bg-purple-600 text-white hover:bg-purple-700 text-[9px] px-1.5 h-5 gap-1">
                            <Layers size={8} /> COMBO
                        </Badge>
                    )}
                </div>

                {/* Stock Tag */}
                <div className="absolute bottom-2 right-2">
                    {isLowStock && (
                        <Badge variant={currentStock <= 0 ? "destructive" : "warning"} className="text-[10px] h-5 shadow-sm backdrop-blur-sm px-2">
                            {currentStock <= 0 ? 'AGOTADO' : 'POCO STOCK'}
                        </Badge>
                    )}
                </div>
            </div>

            {/* Content Section */}
            <div className="p-3 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-1 gap-2">
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded tracking-tighter truncate max-w-[80px] border border-slate-100">
                        {product.sku || '---'}
                    </span>
                    {!isLowStock && (
                        <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
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
