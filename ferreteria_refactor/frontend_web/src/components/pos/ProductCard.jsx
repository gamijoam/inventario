import React from 'react';
import { Shield, Snowflake } from 'lucide-react';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import ProductThumbnail from '../products/ProductThumbnail';

const fmt = (n) => {
    try {
        return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    } catch {
        return Number(n).toFixed(2);
    }
};

const ProductCard = ({
    product,
    onClick,
    currentStock = 0,
    currencySymbol = '$',
    convertProductPrice,
    isSelected = false,
    nearExpiry = false
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
            className={cn(
                'group relative flex flex-col bg-white rounded-xl cursor-pointer transition-all duration-200 border overflow-hidden h-full',
                isSelected
                    ? 'ring-2 ring-blue-500 shadow-lg border-blue-400'
                    : 'border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200',
                isAnimating && 'scale-95 ring-2 ring-blue-400'
            )}
        >
            {/* ── Imagen ── */}
            <div className="relative bg-slate-50 flex items-center justify-center overflow-hidden" style={{ height: '60%', minHeight: 110 }}>
                <ProductThumbnail
                    imageUrl={product.image_url}
                    productName={product.name}
                    size="lg"
                    className="w-full h-full object-contain p-1 transition-transform duration-500 group-hover:scale-105"
                    updatedAt={product.updated_at}
                />

                {/* Badges esquina sup-izq */}
                <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 items-start">
                    {product.has_imei && (
                        <Badge className="bg-blue-600/90 text-white border-none text-[7px] font-black tracking-widest px-1.5 h-4 shadow-sm">
                            SERIAL
                        </Badge>
                    )}
                    {product.is_combo && (
                        <Badge className="bg-purple-500/90 text-white border-none text-[7px] font-black tracking-widest px-1.5 h-4 shadow-sm">
                            COMBO
                        </Badge>
                    )}
                    {product.drug_classification === 'PRESCRIPTION' && (
                        <Badge className="bg-blue-500/90 text-white border-none text-[7px] font-black px-1.5 h-4 shadow-sm flex items-center gap-0.5">
                            <Shield size={7} />Rx
                        </Badge>
                    )}
                    {product.drug_classification === 'CONTROLLED' && (
                        <Badge className="bg-orange-600/90 text-white border-none text-[7px] font-black px-1.5 h-4 shadow-sm">
                            C
                        </Badge>
                    )}
                    {product.storage_condition === 'REFRIGERATED' && (
                        <Badge className="bg-sky-400/90 text-white border-none text-[7px] font-black px-1.5 h-4 shadow-sm flex items-center gap-0.5">
                            <Snowflake size={7} />2-8°C
                        </Badge>
                    )}
                    {product.storage_condition === 'FROZEN' && (
                        <Badge className="bg-blue-800/90 text-white border-none text-[7px] font-black px-1.5 h-4 shadow-sm flex items-center gap-0.5">
                            <Snowflake size={7} />CONG.
                        </Badge>
                    )}
                </div>

                {/* Stock badge esquina sup-der */}
                <div className="absolute top-1.5 right-1.5">
                    {isOutOfStock ? (
                        <span className="bg-red-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full shadow">
                            AGOTADO
                        </span>
                    ) : isLowStock ? (
                        <span className="bg-amber-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full shadow">
                            BAJO
                        </span>
                    ) : null}
                </div>

                {nearExpiry && (
                    <div className="absolute bottom-0 inset-x-0 bg-amber-500/90 text-white text-[7px] font-black text-center py-0.5 tracking-wide">
                        VENCE PRONTO
                    </div>
                )}
            </div>

            {/* ── Info ── */}
            <div className="flex flex-col gap-1 p-2 flex-1">
                {/* Nombre */}
                <p className="text-xs font-bold text-slate-800 leading-tight line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {product.name}
                </p>

                {/* SKU + stock */}
                <div className="flex items-center justify-between">
                    {product.sku && (
                        <span className="text-[9px] text-slate-400 font-mono truncate max-w-[70px]">
                            {product.sku}
                        </span>
                    )}
                    <span className={cn(
                        'text-[9px] font-bold ml-auto',
                        isOutOfStock ? 'text-red-500' : isLowStock ? 'text-amber-500' : 'text-emerald-600'
                    )}>
                        {numStock.toFixed(0)} un.
                    </span>
                </div>

                {/* Precios */}
                <div className="mt-auto pt-1 border-t border-slate-100 flex items-center justify-between gap-1">
                    <span className="text-sm font-black text-blue-600">
                        ${fmt(product.price)}
                    </span>
                    {priceBS > 0 && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                            Bs {fmt(priceBS)}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default React.memo(ProductCard);
