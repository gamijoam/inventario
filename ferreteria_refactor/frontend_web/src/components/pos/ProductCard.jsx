import React from 'react';
import { Package, AlertTriangle, Layers, RotateCcw, User, MapPin } from 'lucide-react';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import ProductThumbnail from '../products/ProductThumbnail';

const formatLocalCurrency = (amount, currency = 'USD') => {
    try {
        // Use es-VE or similar locale to get 1.234,56 format
        return new Intl.NumberFormat('de-DE', { // de-DE is very consistent with the dot-thousands comma-decimals requirement
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    } catch (error) {
        return amount.toFixed(2);
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
    const [isAnimating, setIsAnimating] = React.useState(false);

    const handleClick = () => {
        setIsAnimating(true);
        onClick(product);
        setTimeout(() => setIsAnimating(false), 300);
    };

    const priceBS = convertProductPrice ? convertProductPrice(product, 'VES') : 0;
    const numStock = Number(currentStock);
    const minStock = Number(product.min_stock ?? 5);
    const isOutOfStock = numStock <= 0;
    const isLowStock = !isOutOfStock && numStock < minStock;

    return (
        <div
            onClick={handleClick}
            className={`
                group relative flex flex-col justify-between bg-white rounded-2xl cursor-pointer transition-all duration-300
                border h-full min-h-[360px] overflow-hidden
                ${isSelected
                    ? 'ring-4 ring-blue-500/20 shadow-2xl border-blue-500 -translate-y-2'
                    : 'border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-blue-200'
                }
                ${isAnimating ? 'ring-4 ring-blue-500/40 scale-95' : ''}
            `}
        >
            {/* Image Section - Redesigned for better aspect ratio */}
            <div className="relative h-40 bg-slate-50 overflow-hidden flex items-center justify-center border-b border-slate-100">
                <ProductThumbnail
                    imageUrl={product.image_url}
                    productName={product.name}
                    size="lg"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    updatedAt={product.updated_at}
                />

                {/* Status Badges - Top-Right */}
                <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
                    {product.has_imei && (
                        <Badge className="bg-blue-600/90 hover:bg-blue-600 text-white border-none text-[8px] font-black tracking-widest px-2 h-5 shadow-sm">
                            IMEI/SERIAL
                        </Badge>
                    )}
                    {product.is_combo && (
                        <Badge className="bg-purple-500/90 hover:bg-purple-500 text-white border-none text-[8px] font-black tracking-widest px-2 h-5 shadow-sm">
                            COMBO
                        </Badge>
                    )}
                </div>

                {/* Stock Status Indicator - Bottom-Right */}
                <div className="absolute bottom-3 right-3">
                    {isOutOfStock ? (
                        <Badge
                            variant="destructive"
                            className="text-[9px] font-bold px-2 py-0.5 rounded-full shadow-md backdrop-blur-sm border-white/20"
                        >
                            SIN STOCK
                        </Badge>
                    ) : isLowStock ? (
                        <Badge
                            variant="warning"
                            className="text-[9px] font-bold px-2 py-0.5 rounded-full shadow-md backdrop-blur-sm border-white/20"
                        >
                            STOCK BAJO
                        </Badge>
                    ) : (
                        <div className="flex items-center gap-1 bg-emerald-50/90 backdrop-blur-sm px-2 py-0.5 rounded-full border border-emerald-200/50 shadow-sm">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-[9px] font-bold text-emerald-700">EN STOCK</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Content Section */}
            <div className="p-3 flex-1 flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-md tracking-widest uppercase border border-slate-200/50 truncate max-w-[90px]">
                        {product.sku || 'N/A'}
                    </span>
                    <div className={cn(
                        "flex items-center gap-1.5",
                        isOutOfStock ? "text-rose-500" : (isLowStock ? "text-amber-500" : "text-slate-500")
                    )}>
                        <div className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            isOutOfStock ? "bg-rose-500 animate-pulse" : (isLowStock ? "bg-amber-500" : "bg-emerald-500")
                        )} />
                        <span className="text-[10px] font-bold">
                            {numStock.toFixed(0)} <span className="font-medium opacity-60">Unid.</span>
                        </span>
                    </div>
                </div>

                <h3 className="font-bold text-slate-800 text-sm leading-tight line-clamp-3 group-hover:text-blue-600 transition-colors min-h-[3.2rem]" title={product.name}>
                    {product.name}
                </h3>

                {/* Location Badge */}
                {product.location && (
                    <div className="flex items-center gap-1 text-slate-400 group-hover:text-indigo-500 transition-colors">
                        <MapPin size={9} className="flex-shrink-0" />
                        <span className="text-[9px] font-bold truncate" title={product.location}>{product.location}</span>
                    </div>
                )}
                {/* Price Display Redesign */}
                <div className="mt-auto pt-2 border-t border-slate-50 flex flex-col gap-0.5">
                    {/* Primary Price (USD) - Blue */}
                    <div className="flex justify-between items-center px-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Precio $</span>
                        <div className="flex items-baseline gap-0.5 text-blue-600">
                            <span className="text-xs font-black">$</span>
                            <span className="text-xl font-black tracking-tight">
                                {formatLocalCurrency(product.price)}
                            </span>
                        </div>
                    </div>

                    {/* Secondary Price (VES) - Green */}
                    <div className="flex justify-between items-center bg-emerald-50/40 rounded-lg px-2 py-0.5 border border-emerald-100/30">
                        <span className="text-[9px] font-bold text-emerald-600/70 uppercase">Precio Bs</span>
                        <div className="flex items-baseline gap-0.5 text-emerald-500">
                            <span className="text-[10px] font-black">Bs</span>
                            <span className="text-sm font-black tracking-tight">
                                {formatLocalCurrency(priceBS)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(ProductCard);
