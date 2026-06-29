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

    const effectivePrice = React.useMemo(() => {
        let p = parseFloat(product.price) || 0;
        try {
            const listId = localStorage.getItem('pos_default_price_list_id');
            if (listId && Array.isArray(product.prices)) {
                const entry = product.prices.find(x => String(x.price_list_id) === String(listId));
                if (entry && entry.price != null && parseFloat(entry.price) > 0) {
                    p = parseFloat(entry.price);
                }
            }
        } catch {}
        return p;
    }, [product]);

    const priceProduct = (effectivePrice !== (parseFloat(product.price) || 0))
        ? { ...product, price: effectivePrice }
        : product;

    const secondaryPrices = showSecondaryPrice && secondaryCurrencies.length > 0 && convertProductPrice
        ? secondaryCurrencies.map(curr => {
            const code = curr.currency_code || curr.symbol;
            const sym = curr.currency_symbol || curr.symbol;
            const price = convertProductPrice(priceProduct, code);
            return { code, sym, price };
        }).filter(p => p.price > 0)
        : [];

    const secCode = secondaryCurrency?.currency_code || secondaryCurrency?.symbol || null;
    const secSymbol = secondaryCurrency?.currency_symbol || secondaryCurrency?.symbol || null;
    const priceBS = secondaryPrices.length === 0 && showSecondaryPrice && secCode && convertProductPrice
        ? convertProductPrice(priceProduct, secCode)
        : 0;

    const numStock = Number(currentStock);
    const minStock = Number(product.min_stock ?? 5);
    const isOutOfStock = numStock <= 0;
    const isLowStock = !isOutOfStock && numStock < minStock;
    const stockLabel = numStock % 1 === 0 ? numStock.toFixed(0) : numStock.toFixed(1);

    const StatusBadge = () => {
        if (isOutOfStock) {
            return <span className="rounded-md bg-red-500 px-1.5 py-0.5 text-[7px] font-black text-white shadow-sm">AGOTADO</span>;
        }
        if (isLowStock) {
            return <span className="rounded-md bg-amber-400 px-1.5 py-0.5 text-[7px] font-black text-white shadow-sm">BAJO</span>;
        }
        return null;
    };

    return (
        <div
            onClick={handleClick}
            className={cn(
                'group relative flex h-full cursor-pointer select-none overflow-hidden rounded-lg border border-slate-200/80 bg-white p-2 transition-all duration-200',
                isSelected
                    ? 'ring-2 ring-indigo-500 shadow-lg shadow-indigo-100'
                    : 'shadow-[0_1px_3px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 hover:shadow-md hover:shadow-indigo-100/50',
                isAnimating && 'scale-95 ring-2 ring-indigo-400',
                isOutOfStock && 'opacity-60'
            )}
        >
            {!simpleMode && (
                <div className="relative mr-3 flex h-full w-[82px] shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-100 bg-slate-50">
                    <ProductThumbnail
                        imageUrl={product.image_url}
                        productName={product.name}
                        size="full"
                        className="rounded-md object-contain bg-white p-1 transition-transform duration-500 group-hover:scale-[1.04]"
                        updatedAt={product.updated_at}
                    />

                    <div className="absolute left-1 top-1 flex max-w-[74px] flex-wrap gap-0.5">
                        {product.has_imei && (
                            <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[6.5px] font-black tracking-widest text-white shadow-sm">
                                SERIAL
                            </span>
                        )}
                        {product.is_combo && (
                            <span className="rounded bg-purple-500 px-1.5 py-0.5 text-[6.5px] font-black text-white shadow-sm">
                                COMBO
                            </span>
                        )}
                        {product.drug_classification === 'PRESCRIPTION' && (
                            <span className="flex items-center gap-0.5 rounded-full bg-blue-500 px-1.5 py-0.5 text-[6.5px] font-black text-white shadow-sm">
                                <Shield size={7} />Rx
                            </span>
                        )}
                        {product.drug_classification === 'CONTROLLED' && (
                            <span className="rounded-full bg-orange-600 px-1.5 py-0.5 text-[6.5px] font-black text-white shadow-sm">
                                C
                            </span>
                        )}
                        {product.storage_condition === 'REFRIGERATED' && (
                            <span className="flex items-center gap-0.5 rounded-full bg-sky-400 px-1.5 py-0.5 text-[6.5px] font-black text-white shadow-sm">
                                <Snowflake size={7} />2-8C
                            </span>
                        )}
                        {product.storage_condition === 'FROZEN' && (
                            <span className="flex items-center gap-0.5 rounded-full bg-blue-800 px-1.5 py-0.5 text-[6.5px] font-black text-white shadow-sm">
                                <Snowflake size={7} />CONG.
                            </span>
                        )}
                    </div>

                    <div className="absolute right-1 top-1">
                        <StatusBadge />
                    </div>

                    {nearExpiry && (
                        <div className="absolute inset-x-0 bottom-0 bg-amber-500/90 py-0.5 text-center text-[7px] font-black tracking-wide text-white">
                            VENCE PRONTO
                        </div>
                    )}

                    {isSelected && <div className="absolute inset-0 bg-indigo-500/10" />}
                </div>
            )}

            <div className={cn('flex min-w-0 flex-1 flex-col pr-1', simpleMode ? 'gap-1' : 'gap-1.5')}>
                <div className="flex min-h-[34px] items-start gap-2">
                    <p className="line-clamp-2 min-w-0 flex-1 text-[11px] font-black leading-tight text-slate-800 transition-colors group-hover:text-indigo-600">
                        {product.name}
                    </p>
                    {simpleMode && product.has_imei && (
                        <span className="shrink-0 rounded bg-indigo-100 px-1 py-0.5 text-[7px] font-black text-indigo-600">SN</span>
                    )}
                </div>

                <div className="flex min-h-[18px] items-center justify-between gap-2">
                    {product.sku ? (
                        <span className="min-w-0 truncate rounded bg-slate-50 px-1.5 py-0.5 font-mono text-[8px] font-bold text-slate-400">
                            {product.sku}
                        </span>
                    ) : <span />}
                    <span className={cn(
                        'shrink-0 rounded-full px-1.5 py-0.5 text-[8.5px] font-black tabular-nums',
                        isOutOfStock ? 'bg-red-50 text-red-500' : isLowStock ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                    )}>
                        {stockLabel} un.
                    </span>
                </div>

                <div className="mt-auto flex items-end justify-between gap-2 border-t border-slate-100 pt-2">
                    <div className="min-w-0 pb-0.5">
                        <span className="block text-[16px] font-black leading-none text-indigo-600 tabular-nums">
                            {currencySymbol}{fmt(effectivePrice)}
                        </span>
                        {secondaryPrices.length > 0 ? (
                            <div className="mt-1 flex max-w-full flex-wrap gap-x-1 gap-y-0.5">
                                {secondaryPrices.slice(0, 2).map(({ code, sym, price }) => (
                                    <span key={code} className="truncate text-[8px] font-bold leading-none text-slate-500 tabular-nums">
                                        {sym}{fmt(price)}
                                    </span>
                                ))}
                            </div>
                        ) : (priceBS > 0 && secSymbol && (
                            <span className="mt-1 block truncate text-[8px] font-bold leading-none text-slate-500 tabular-nums">
                                {secSymbol}{fmt(priceBS)}
                            </span>
                        ))}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1 pb-1">
                        {simpleMode && <StatusBadge />}
                        <span className={cn(
                            'h-1.5 w-11 overflow-hidden rounded-full',
                            isOutOfStock ? 'bg-red-100' : isLowStock ? 'bg-amber-100' : 'bg-emerald-100'
                        )}>
                            <span className={cn(
                                'block h-full rounded-full',
                                isOutOfStock ? 'w-1 bg-red-500' : isLowStock ? 'w-1/2 bg-amber-400' : 'w-full bg-emerald-500'
                            )} />
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(ProductCard);
