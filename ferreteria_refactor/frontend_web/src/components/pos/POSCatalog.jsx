import { Search, Package, Box } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '../../lib/utils';
import ProductCard from './ProductCard';
import SearchWithScanner from '../common/SearchWithScanner';

const POSCatalog = ({
    products = [],
    categories = [],
    loading = false,
    onAddToCart,
    onSearch,
    onFilterCategory,
    selectedCategoryId = null,
    searchTerm = '',
    currencySymbol = '$',
    secondaryCurrency = null,
    convertProductPrice = null
}) => {

    return (
        <div className="flex flex-col h-full bg-muted/10 overflow-hidden rounded-3xl border border-slate-200">

            {/* Sticky Header */}
            <div className="p-4 bg-background border-b z-10 space-y-4 shadow-sm">
                {/* Row 1: Search */}
                {/* Row 1: Search */}
                <SearchWithScanner
                    id="tour-pos-search"
                    value={searchTerm}
                    onChange={(val) => onSearch(val)}
                    placeholder="Buscar productos por nombre o código..."
                    autoFocus
                    inputClassName="h-14 pl-10 text-lg bg-slate-50 border-slate-200 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm rounded-2xl"
                />

                {/* Row 2: Categories */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide mask-gradient-right">
                    <Button
                        variant={selectedCategoryId === null ? "default" : "outline"}
                        size="md"
                        onClick={() => onFilterCategory(null)}
                        className={cn(
                            "rounded-2xl px-6 h-11 font-black transition-all uppercase text-[11px] tracking-widest",
                            selectedCategoryId === null
                                ? "bg-slate-900 hover:bg-black text-white shadow-xl shadow-slate-900/10"
                                : "border-slate-200 text-slate-500 bg-white hover:text-slate-900 hover:border-slate-400"
                        )}
                    >
                        Todos
                    </Button>
                    {categories.map((cat) => (
                        <Button
                            key={cat.id}
                            variant={selectedCategoryId === cat.id ? "default" : "outline"}
                            size="md"
                            onClick={() => onFilterCategory(cat.id)}
                            className={cn(
                                "rounded-2xl px-6 h-11 font-black transition-all uppercase text-[11px] tracking-widest whitespace-nowrap",
                                selectedCategoryId === cat.id
                                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/20"
                                    : "border-slate-200 text-slate-500 bg-white hover:text-blue-600 hover:border-blue-300"
                            )}
                        >
                            {cat.name}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Grid Area */}
            <div className="flex-1 min-h-0 relative bg-slate-50/30">
                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-pulse flex flex-col items-center">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                                <Package size={32} className="text-blue-500" />
                            </div>
                            <span className="text-slate-400 font-bold uppercase tracking-widest text-xs">Cargando catálogo...</span>
                        </div>
                    </div>
                ) : products.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center animate-in fade-in zoom-in-95">
                        <div className="text-center">
                            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-inner">
                                <Box size={40} className="text-slate-300" />
                            </div>
                            <p className="font-black text-slate-800 uppercase tracking-tighter">No hay resultados</p>
                            <p className="text-xs text-slate-400 font-medium mt-1">Intenta con otra búsqueda o categoría</p>
                        </div>
                    </div>
                ) : (
                    <ScrollArea className="h-full">
                        <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 pb-24">
                            {products.map((product) => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    onClick={onAddToCart}
                                    currentStock={product.stock}
                                    currencySymbol={currencySymbol}
                                    convertProductPrice={convertProductPrice}
                                />
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </div>
        </div>
    );
};

export default POSCatalog;
