import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import ProductThumbnail from './ProductThumbnail';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { cn } from '../../utils/cn';

export default function ProductMobileCard({ product, onEdit, onDelete, onCategoryClick }) {

    // Calcular estado de stock
    const totalStock = product.stock || 0;
    const isLow = totalStock <= 5;
    const isOut = totalStock === 0;

    // Formatear stock
    const formatStock = (stock) => {
        const num = Number(stock);
        return num % 1 === 0 ? num.toFixed(0) : num.toFixed(3).replace(/\.?0+$/, '');
    };

    return (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 flex gap-3 animate-in fade-in duration-300 relative group">

            {/* 1. Thumbnail (Left) */}
            <div className="shrink-0 relative">
                <ProductThumbnail
                    imageUrl={product.image_url}
                    productName={product.name}
                    size="md"
                    className="h-16 w-16 rounded-lg border border-slate-100 shadow-sm object-cover bg-slate-50"
                />

                {/* Stock Badge Overlay */}
                <div className={cn(
                    "absolute -bottom-2 translate-y-1/2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-sm whitespace-nowrap z-10",
                    isOut
                        ? "bg-rose-100 text-rose-700 border-rose-200"
                        : (isLow ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-emerald-100 text-emerald-700 border-emerald-200")
                )}>
                    {isOut ? "Agotado" : (isLow ? "Bajo Stock" : "En Stock")}
                </div>
            </div>

            {/* 2. Content (Right) */}
            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">

                {/* Header: Name & Actions */}
                <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-800 leading-tight line-clamp-2 text-sm mb-1">
                            {product.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 uppercase tracking-wider">
                                {product.sku || '---'}
                            </span>
                            {product.category?.name && (
                                <span
                                    className="text-[10px] font-bold text-indigo-500 truncate max-w-[100px] cursor-pointer hover:underline"
                                    onClick={(e) => { e.stopPropagation(); onCategoryClick && onCategoryClick(product.category_id); }}
                                >
                                    {product.category.name}
                                </span>
                            )}
                        </div>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full">
                                <MoreHorizontal size={18} />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-xl border-slate-100">
                            <DropdownMenuLabel className="text-xs text-slate-400 uppercase tracking-wider">Opciones</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => onEdit(product)} className="py-2.5 font-medium cursor-pointer">
                                <Pencil size={14} className="mr-2 text-indigo-500" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onDelete(product)} className="py-2.5 text-rose-600 focus:text-rose-700 focus:bg-rose-50 font-bold cursor-pointer">
                                <Trash2 size={14} className="mr-2" /> Eliminar
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Footer: Price & Stock */}
                <div className="flex justify-between items-end mt-3 pt-3 border-t border-slate-50 border-dashed">

                    {/* Price */}
                    <div className="flex flex-col">
                        <span className="text-[9px] uppercase text-slate-400 font-bold tracking-wider mb-0.5">Precio</span>
                        <div className="text-lg font-black text-slate-900 leading-none tracking-tight">
                            ${Number(product.price).toFixed(2)}
                            <span className="text-[10px] text-slate-400 font-medium ml-0.5">USD</span>
                        </div>
                    </div>

                    {/* Stock Value */}
                    <div className="flex flex-col items-end">
                        <span className={cn(
                            "text-[9px] uppercase font-bold tracking-wider mb-0.5",
                            isOut ? "text-rose-400" : (isLow ? "text-amber-500" : "text-emerald-500")
                        )}>
                            Stock
                        </span>
                        <div className={cn(
                            "text-xl font-black leading-none flex items-baseline gap-0.5",
                            isOut ? "text-rose-500" : (isLow ? "text-amber-500" : "text-emerald-500")
                        )}>
                            {formatStock(totalStock)}
                            <span className="text-xs font-bold opacity-60 ml-0.5">un.</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
