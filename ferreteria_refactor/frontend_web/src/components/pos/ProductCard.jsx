import React from 'react';
import { Shield, Snowflake } from 'lucide-react';
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
    secondaryCurrency = null,
    secondaryCurrencies = [],
    showSecondaryPrice = false,
    isSelected = false,
    nearExpiry = false,
    simpleMode = false,
}) => {
    const [isAnimating, setIsAnimating] = React.useState(false);

    const handleClick = () => {
        setIsAnimating(true);
        onClick(product);
        setTimeout(() => setIsAnimating(false), 300);
    };

    // ── Precios secundarios (lógica intacta) ──────────────────────────────────
    const secondaryPrices = showSecondaryPrice && secondaryCurrencies.length > 0 && convertProductPrice
        ? secondaryCurrencies.map(curr => {
            const code = curr.currency_code || curr.symbol;
            const sym = curr.currency_symbol || curr.symbol;
            const price = convertProductPrice(product, code);
            return { code, sym, price };
        }).filter(p => p.price > 0)
        : [];

    const secCode = secondaryCurrency?.currency_code || secondaryCurrency?.symbol || null;
    const secSymbol = secondaryCurrency?.currency_symbol || secondaryCurrency?.symbol || null;
    const priceBS = secondaryPrices.length === 0 && showSecondaryPrice && secCode && convertProductPrice
        ? convertProductPrice(product, secCode)
        : 0;

    const numStock = Number(currentStock);
    const minStock = Number(product.min_stock ?? 5);
    const isOutOfStock = numStock <= 0;
    const isLowStock = !isOutOfStock && numStock < minStock;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div
            onClick={handleClick}
            className={cn(
                'group relative flex flex-col bg-white rounded-2xl cursor-pointer transition-all duration-200 overflow-hidden h-full select-none',
                isSelected
                    ? 'ring-2 ring-indigo-500 shadow-lg shadow-indigo-100'
                    : 'shadow-sm hover:shadow-md hover:shadow-indigo-100/50 hover:-translate-y-0.5',
                isAnimating && 'scale-95 ring-2 ring-indigo-400',
                isOutOfStock && 'opacity-60'
            )}
        >
            {/* ── Imagen ───────────────────────────────────────────────────── */}
            {!simpleMode && (
                <div className="relative overflow-hidden bg-slate-50" style={{ height: 100 }}>
                    <ProductThumbnail
                        imageUrl={product.image_url}
                        productName={product.name}
                        size="lg"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        updatedAt={product.updated_at}
                    />

                    {/* Badges izquierda */}
                    <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
                        {product.has_imei && (
                            <span className="text-[7px] font-black tracking-widest bg-indigo-600 text-white px-1.5 py-0.5 rounded-full shadow-sm">
                                SERIAL
                            </span>
                        )}
                        {product.is_combo && (
                            <span className="text-[7px] font-black bg-purple-500 text-white px-1.5 py-0.5 rounded-full shadow-sm">
                                COMBO
                            </span>
                        )}
                        {product.drug_classification === 'PRESCRIPTION' && (
                            <span className="text-[7px] font-black bg-blue-500 text-white px-1.5 py-0.5 rounded-full shadow-sm flex items-center gap-0.5">
                                <Shield size={7} />Rx
                            </span>
                        )}
                        {product.drug_classification === 'CONTROLLED' && (
                            <span className="text-[7px] font-black bg-orange-600 text-white px-1.5 py-0.5 rounded-full shadow-sm">
                                C
                            </span>
                        )}
                        {product.storage_condition === 'REFRIGERATED' && (
                            <span className="text-[7px] font-black bg-sky-400 text-white px-1.5 py-0.5 rounded-full shadow-sm flex items-center gap-0.5">
                                <Snowflake size={7} />2-8°C
                            </span>
                        )}
                        {product.storage_condition === 'FROZEN' && (
                            <span className="text-[7px] font-black bg-blue-800 text-white px-1.5 py-0.5 rounded-full shadow-sm flex items-center gap-0.5">
                                <Snowflake size={7} />CONG.
                            </span>
                        )}
                    </div>

                    {/* Stock badge derecha */}
                    <div className="absolute top-1.5 right-1.5">
                        {isOutOfStock ? (
                            <span className="text-[7px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-full shadow-sm">
                                AGOTADO
                            </span>
                        ) : isLowStock ? (
                            <span className="text-[7px] font-black bg-amber-400 text-white px-1.5 py-0.5 rounded-full shadow-sm">
                                BAJO
                            </span>
                        ) : null}
                    </div>

                    {/* Vence pronto */}
                    {nearExpiry && (
                        <div className="absolute bottom-0 inset-x-0 bg-amber-500/90 text-white text-[7px] font-black text-center py-0.5 tracking-wide">
                            VENCE PRONTO
                        </div>
                    )}

                    {/* Overlay al seleccionar */}
                    {isSelected && (
                        <div className="absolute inset-0 bg-indigo-500/10" />
                    )}
                </div>
            )}

            {/* ── Info ─────────────────────────────────────────────────────── */}
            <div className="flex flex-col flex-1 px-2.5 py-2 gap-1">

                {/* Nombre */}
                <div className="flex items-start gap-1">
                    <p className={cn(
                        'font-bold text-slate-800 leading-tight line-clamp-2 flex-1 group-hover:text-indigo-600 transition-colors',
                        simpleMode ? 'text-[11px]' : 'text-[11px]'
                    )}>
                        {product.name}
                    </p>
                    {simpleMode && product.has_imei && (
                        <span className="shrink-0 text-[7px] font-black bg-indigo-100 text-indigo-600 px-1 py-0.5 rounded">SN</span>
                    )}
                </div>

                {/* SKU + stock en una fila */}
                <div className="flex items-center justify-between gap-1">
                    {product.sku && (
                        <span className="text-[9px] text-slate-400 font-mono truncate">
                            {product.sku}
                        </span>
                    )}
                    <span className={cn(
                        'text-[9px] font-bold ml-auto shrink-0',
                        isOutOfStock ? 'text-red-500' : isLowStock ? 'text-amber-500' : 'text-emerald-600'
                    )}>
                        {numStock % 1 === 0 ? numStock.toFixed(0) : numStock.toFixed(1)} un.
                    </span>
                </div>

                {/* Precios */}
                <div className="mt-auto pt-1.5 flex items-end justify-between gap-1">
                    <span className="text-sm font-black text-indigo-600 leading-none">
                        ${fmt(product.price)}
                    </span>
                    {secondaryPrices.length > 0 ? (
                        <div className="flex flex-wrap gap-1 justify-end">
                            {secondaryPrices.map(({ code, sym, price }) => (
                                <span key={code} className="text-[9px] font-bold text-slate-500 leading-none">
                                    {sym}{fmt(price)}
                                </span>
                            ))}
                        </div>
                    ) : (priceBS > 0 && secSymbol && (
                        <span className="text-[9px] font-bold text-slate-500 leading-none">
                            {secSymbol}{fmt(priceBS)}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default React.memo(ProductCard);
