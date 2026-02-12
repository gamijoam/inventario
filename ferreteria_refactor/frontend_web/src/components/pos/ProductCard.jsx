import React from 'react';
import { Package, AlertTriangle, Layers, RotateCcw, User } from 'lucide-react';
import { Badge } from '../ui/badge';
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
    const priceBS = convertProductPrice ? convertProductPrice(product, 'VES') : 0;
    const isLowStock = currentStock <= (product.min_stock || 5);

    return (
        <div
            onClick={() => onClick(product)}
            className={`
                group relative flex flex-col justify-between bg-white rounded-2xl cursor-pointer transition-all duration-500
                border h-full min-h-[260px] overflow-hidden
                ${isSelected
                    ? 'ring-4 ring-blue-500/20 shadow-2xl border-blue-500 -translate-y-2'
                    : 'border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 hover:border-blue-200'
                }
            `}
        >
            {/* Image Section - Cleaner & More Premium */}
            <div className="relative h-40 bg-gradient-to-b from-slate-50 to-white overflow-hidden p-6 flex items-center justify-center">
                <ProductThumbnail
                    imageUrl={product.image_url}
                    productName={product.name}
                    size="lg"
                    className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-110"
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

                {/* Low Stock Indicator - Bottom-Right */}
                <div className="absolute bottom-3 right-3">
                    {isLowStock && (
                        <Badge
                            variant={currentStock <= 0 ? "destructive" : "warning"}
                            className="text-[9px] font-bold px-2 py-0.5 rounded-full shadow-md backdrop-blur-sm border-white/20"
                        >
                            {currentStock <= 0 ? 'SIN STOCK' : 'STOCK BAJO'}
                        </Badge>
                    )}
                </div>
            </div>

            {/* Content Section */}
            <div className="p-4 flex-1 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-md tracking-widest uppercase border border-slate-200/50 truncate max-w-[90px]">
                        {product.sku || 'N/A'}
                    </span>
                    {!isLowStock && (
                        <div className="flex items-center gap-1.5 text-slate-500">
                            <Package size={10} className="text-slate-400" />
                            <span className="text-[10px] font-bold">
                                {Number(currentStock).toFixed(0)} <span className="font-medium text-slate-400">Unid.</span>
                            </span>
                        </div>
                    )}
                </div>

                <h3 className="font-bold text-slate-800 text-sm leading-tight line-clamp-2 group-hover:text-blue-600 transition-colors min-h-[2.5rem]" title={product.name}>
                    {product.name}
                </h3>

                {/* Price Display Redesign */}
                <div className="mt-auto pt-3 border-t border-slate-50 flex flex-col gap-1">
                    {/* Primary Price (USD) - Blue */}
                    <div className="flex justify-between items-center group/price">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Precio $</span>
                        <div className="flex items-baseline gap-0.5 text-blue-600">
                            <span className="text-xs font-black">$</span>
                            <span className="text-xl font-black tracking-tight">
                                {formatLocalCurrency(product.price)}
                            </span>
                        </div>
                    </div>

                    {/* Secondary Price (VES) - Green */}
                    <div className="flex justify-between items-center bg-emerald-50/50 rounded-lg px-2 py-1 border border-emerald-100/50 group/bs">
                        <span className="text-[10px] font-bold text-emerald-600/70 uppercase">Precio Bs</span>
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

export default ProductCard;
