import React, { useState } from 'react';
import { Search, Package, Image as ImageIcon, Box } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { cn } from '../../lib/utils';
import ProductThumbnail from '../products/ProductThumbnail'; // Reusing consistency where possible, but wrapping for style

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

    // Internal state for search visualization if controlled by parent via onSearch/searchTerm
    // If onSearch expects the event or value, we handle commonly.

    return (
        <div className="flex flex-col h-full bg-muted/10 overflow-hidden rounded-3xl border border-slate-200">

            {/* Sticky Header */}
            <div className="p-4 bg-background border-b z-10 space-y-4">
                {/* Row 1: Search */}
                <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <Search size={20} />
                    </div>
                    <Input
                        placeholder="Buscar productos por nombre o código..."
                        className="h-12 pl-11 text-lg bg-slate-50 border-slate-200 focus:bg-white transition-all shadow-sm rounded-xl"
                        value={searchTerm}
                        onChange={(e) => onSearch(e.target.value)}
                    />
                </div>

                {/* Row 2: Categories */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide mask-gradient-right">
                    <Button
                        variant={selectedCategoryId === null ? "default" : "outline"}
                        size="sm"
                        onClick={() => onFilterCategory(null)}
                        className={cn(
                            "rounded-full px-4 h-8 whitespace-nowrap",
                            selectedCategoryId === null ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200"
                        )}
                    >
                        Todos
                    </Button>
                    {categories.map((cat) => (
                        <Button
                            key={cat.id}
                            variant={selectedCategoryId === cat.id ? "default" : "outline"}
                            size="sm"
                            onClick={() => onFilterCategory(cat.id)}
                            className={cn(
                                "rounded-full px-4 h-8 whitespace-nowrap",
                                selectedCategoryId === cat.id ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200"
                            )}
                        >
                            {cat.name}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Grid Area */}
            <div className="flex-1 min-h-0 relative bg-slate-50/50">
                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-pulse flex flex-col items-center">
                            <Package size={48} className="text-slate-300 mb-2" />
                            <span className="text-slate-400 font-medium">Cargando catálogo...</span>
                        </div>
                    </div>
                ) : products.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center text-slate-400">
                            <Box size={48} className="mx-auto mb-2 opacity-50" />
                            <p className="font-medium">No se encontraron productos</p>
                            <p className="text-xs">Intenta con otra búsqueda o categoría</p>
                        </div>
                    </div>
                ) : (
                    <ScrollArea className="h-full">
                        <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 pb-20">
                            {products.map((product) => {
                                const stock = product.stock || 0; // Or passed pre-calculated
                                const isLowStock = stock <= 5;
                                const hasImage = !!product.image_url;

                                return (
                                    <div
                                        key={product.id}
                                        onClick={() => onAddToCart(product)}
                                        className="
                                            group relative flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 
                                            cursor-pointer hover:shadow-md hover:border-indigo-300 hover:ring-2 hover:ring-indigo-500/10 
                                            transition-all active:scale-95 overflow-hidden select-none h-full
                                        "
                                    >
                                        {/* Stock Badge */}
                                        <Badge
                                            className={cn(
                                                "absolute top-2 right-2 z-10 px-1.5 py-0.5 text-[10px] font-bold shadow-sm border-white/50 backdrop-blur-md",
                                                isLowStock ? "bg-rose-500 text-white hover:bg-rose-600" : "bg-white/90 text-slate-700 hover:bg-white"
                                            )}
                                        >
                                            {Number(stock)} {stock === 1 ? 'Unid.' : 'Unids.'}
                                        </Badge>

                                        {/* Image Area (Square) */}
                                        <div className="aspect-square w-full bg-slate-100 relative overflow-hidden">
                                            <ProductThumbnail
                                                imageUrl={product.image_url}
                                                productName={product.name}
                                                size="lg"
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                updatedAt={product.updated_at}
                                            />


                                            {/* Gradient Overlay on Hover */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-2">
                                                <span className="text-white text-xs font-bold bg-black/30 px-2 py-1 rounded-full backdrop-blur-sm">Agregar +</span>
                                            </div>
                                        </div>

                                        {/* Body */}
                                        <div className="p-3 flex flex-col flex-1">
                                            <div className="flex items-baseline gap-1 mb-1">
                                                <span className="text-sm font-bold text-slate-400">{currencySymbol}</span>
                                                <span className="text-lg font-black text-slate-800 leading-none">
                                                    {parseFloat(product.price).toFixed(2)}
                                                </span>
                                            </div>

                                            {/* Secondary Price (Bs usually) */}
                                            {convertProductPrice && secondaryCurrency && (
                                                <div className="flex items-baseline gap-1 mb-1.5 opacity-80">
                                                    <span className="text-xs font-bold text-slate-400">{secondaryCurrency.symbol}</span>
                                                    <span className="text-sm font-bold text-slate-600 leading-none">
                                                        {convertProductPrice(product, secondaryCurrency.currency_code).toFixed(2)}
                                                    </span>
                                                </div>
                                            )}

                                            <h3 className="text-xs font-medium text-slate-600 leading-snug line-clamp-2 min-h-[2.5em]" title={product.name}>
                                                {product.name}
                                            </h3>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                )}
            </div>
        </div>
    );
};

export default POSCatalog;
