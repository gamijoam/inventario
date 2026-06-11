import { AlertTriangle, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import ProductThumbnail from './ProductThumbnail';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { cn } from '../../utils/cn';

const formatStock = (stock) => {
    const num = Number(stock || 0);
    return num % 1 === 0 ? num.toFixed(0) : num.toFixed(3).replace(/\.?0+$/, '');
};

const formatMoney = (value) => `$${Number(value || 0).toFixed(2)}`;

const getProductIssues = (product) => {
    const issues = [];
    if (!String(product.sku || '').trim()) issues.push('Sin SKU');
    if (Number(product.price || 0) <= 0) issues.push('Precio 0');
    if (Array.isArray(product.prices) && product.prices.some(item => Number(item?.price || 0) <= 0)) issues.push('Lista pendiente');
    if (product.has_imei && Number(product.stock || 0) <= 0) issues.push('Serial sin stock');
    return issues;
};

export default function ProductMobileCard({ product, onEdit, onDelete, onCategoryClick }) {
    const totalStock = Number(product.stock || 0);
    const minStock = Number(product.min_stock ?? 5);
    const isOut = totalStock === 0;
    const isLow = !isOut && totalStock < minStock;

    const stockState = isOut
        ? { label: 'Agotado', wrap: 'bg-rose-50 text-rose-700 border-rose-100' }
        : isLow
        ? { label: 'Bajo', wrap: 'bg-amber-50 text-amber-700 border-amber-100' }
        : { label: 'Disponible', wrap: 'bg-emerald-50 text-emerald-700 border-emerald-100' };

    const badges = [
        product.is_service && 'Servicio',
        product.has_imei && 'Serial',
        product.is_combo && 'Combo',
        product.is_commissionable && 'Comision',
    ].filter(Boolean);
    const issues = getProductIssues(product);

    return (
        <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-3 shadow-sm animate-in fade-in duration-300">
            <div className="flex gap-3">
                <ProductThumbnail
                    imageUrl={product.image_url}
                    productName={product.name}
                    size="md"
                    className="h-16 w-16 flex-shrink-0 rounded-lg border border-slate-100 bg-slate-50 object-cover shadow-sm"
                />

                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <button type="button" onClick={() => onEdit(product)} className="min-w-0 text-left">
                            <h3 className="line-clamp-2 text-sm font-black leading-tight text-slate-900">
                                {product.name}
                            </h3>
                        </button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="-mr-2 -mt-2 h-8 w-8 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700">
                                    <MoreHorizontal size={18} />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl border-slate-100 shadow-xl">
                                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-slate-400">Opciones</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => onEdit(product)} className="cursor-pointer py-2.5 font-medium">
                                    <Pencil size={14} className="mr-2 text-indigo-500" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => onDelete(product)} className="cursor-pointer py-2.5 font-bold text-rose-600 focus:bg-rose-50 focus:text-rose-700">
                                    <Trash2 size={14} className="mr-2" /> Eliminar
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md border border-slate-100 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            {product.sku || 'Sin SKU'}
                        </span>
                        {product.category?.name && (
                            <button
                                type="button"
                                className="max-w-[130px] truncate rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600"
                                onClick={(e) => { e.stopPropagation(); onCategoryClick && onCategoryClick(product.category_id); }}
                            >
                                {product.category.name}
                            </button>
                        )}
                    </div>

                    {(badges.length > 0 || issues.length > 0 || (product.prices && product.prices.length > 0)) && (
                        <div className="mt-2 flex flex-wrap gap-1">
                            {badges.map(label => (
                                <span key={label} className="rounded-md border border-slate-100 bg-slate-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-500">
                                    {label}
                                </span>
                            ))}
                            {product.prices && product.prices.length > 0 && (
                                <span className="rounded-md border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-indigo-600">
                                    {product.prices.length} lista{product.prices.length === 1 ? '' : 's'}
                                </span>
                            )}
                            {issues.slice(0, 2).map(issue => (
                                <span key={issue} className="inline-flex items-center gap-1 rounded-md border border-amber-100 bg-amber-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-700">
                                    <AlertTriangle size={10} /> {issue}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3 border-t border-dashed border-slate-100 pt-3">
                <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Precio venta</span>
                    <div className="mt-0.5 text-lg font-black leading-none text-indigo-700">{formatMoney(product.price)}</div>
                    {product.prices && product.prices.length > 0 && (
                        <div className="mt-1 max-w-[180px] truncate text-[11px] font-bold text-slate-500">
                            {product.prices[0].price_list?.name || 'Lista'}: <span className="text-slate-800">{formatMoney(product.prices[0].price)}</span>
                        </div>
                    )}
                </div>

                <div className={cn('rounded-lg border px-3 py-2 text-right', stockState.wrap)}>
                    <span className="block text-[9px] font-black uppercase tracking-wider opacity-70">Stock</span>
                    <div className="text-xl font-black leading-none">
                        {formatStock(totalStock)} <span className="text-[10px] font-bold opacity-60">un.</span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wide">{stockState.label}</span>
                </div>
            </div>
        </div>
    );
}
