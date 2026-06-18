import { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { FixedSizeGrid } from 'react-window';
import { Package, Box, Loader2 } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import ProductCard from './ProductCard';
import SearchWithScanner from '../common/SearchWithScanner';

const getColumnCount = (width, simpleMode = false) => {
    if (simpleMode) {
        if (width >= 1536) return 10;
        if (width >= 1280) return 8;
        if (width >= 1024) return 7;
        if (width >= 768) return 5;
        return 3;
    }
    if (width >= 1536) return 8;
    if (width >= 1280) return 6;
    if (width >= 1024) return 5;
    if (width >= 768) return 4;
    return 2;
};

const SCROLL_THRESHOLD = 600; // px ahead to trigger load

const POSCatalog = forwardRef(({
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
    secondaryCurrencies = [],
    convertProductPrice = null,
    showSecondaryPrice = false,
    // New infinite scroll props
    onLoadMore = null,
    hasMore = false,
    isLoadingMore = false,
    totalCount = null,
    onSearchChange = null,
    onCategoryChange = null,
    simpleMode = false,
}, ref) => {
    const containerRef = useRef(null);
    const gridRef = useRef(null);
    const searchInputRef = useRef(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);
    const debounceTimerRef = useRef(null);
    const lastSubmittedSearchRef = useRef(searchTerm);

    // Expose resetScroll, focusSearch, clearSearch to parent via ref
    useImperativeHandle(ref, () => ({
        resetScroll: () => {
            if (gridRef.current) {
                gridRef.current.scrollTo({ scrollLeft: 0, scrollTop: 0 });
            }
        },
        focusSearch: () => {
            if (searchInputRef.current) {
                searchInputRef.current.focus();
            }
        },
        clearAndFocusSearch: () => {
            // Clear local state immediately
            setLocalSearchTerm('');
            // Notify parent about the change
            if (onSearchChange) {
                if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                if (lastSubmittedSearchRef.current !== '') {
                    lastSubmittedSearchRef.current = '';
                    onSearchChange('');
                }
            } else if (onSearch) {
                onSearch('');
            }
            // Focus the input
            if (searchInputRef.current) {
                searchInputRef.current.focus();
            }
        },
    }));

    // Sync localSearchTerm with prop
    useEffect(() => {
        setLocalSearchTerm(searchTerm);
        lastSubmittedSearchRef.current = searchTerm;
    }, [searchTerm]);

    // Reset scroll when search or category changes
    useEffect(() => {
        if (gridRef.current) {
            gridRef.current.scrollTo({ scrollLeft: 0, scrollTop: 0 });
        }
    }, [searchTerm, selectedCategoryId]);

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect;
            setContainerSize({ width, height });
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // Cleanup debounce on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        };
    }, []);

    const isServerSide = !!onLoadMore;

    const handleSearchInput = useCallback((val) => {
        setLocalSearchTerm(val);

        if (onSearchChange) {
            // Server-side: debounce 300ms
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = setTimeout(() => {
                if (lastSubmittedSearchRef.current !== val) {
                    lastSubmittedSearchRef.current = val;
                    onSearchChange(val);
                }
            }, 300);
        } else if (onSearch) {
            // Legacy: call onSearch directly
            onSearch(val);
        }
    }, [onSearchChange, onSearch]);

    const handleCategoryClick = useCallback((catId) => {
        if (onCategoryChange) {
            onCategoryChange(catId);
        } else if (onFilterCategory) {
            onFilterCategory(catId);
        }
    }, [onCategoryChange, onFilterCategory]);

    const columnCount = getColumnCount(containerSize.width, simpleMode);
    const rowCount = Math.ceil(products.length / columnCount);
    const GAP = 8; // gap entre cards
    const PADDING = 10;
    const columnWidth = containerSize.width > 0
        ? (containerSize.width - PADDING * 2 - GAP * (columnCount - 1)) / columnCount
        : 0;
    const ROW_HEIGHT = simpleMode ? 88 : 136;

    const totalHeight = rowCount * ROW_HEIGHT;
    const gridHeight = containerSize.height;

    const handleGridScroll = useCallback(({ scrollTop, scrollUpdateWasRequested }) => {
        if (scrollUpdateWasRequested) return; // ignore programmatic scrolls
        if (!onLoadMore || !hasMore || isLoadingMore) return;

        const scrollBottom = scrollTop + gridHeight;
        if (scrollBottom >= totalHeight - SCROLL_THRESHOLD) {
            onLoadMore();
        }
    }, [onLoadMore, hasMore, isLoadingMore, gridHeight, totalHeight]);

    const Cell = useCallback(({ columnIndex, rowIndex, style }) => {
        const index = rowIndex * columnCount + columnIndex;
        if (index >= products.length) return null;
        const product = products[index];

        return (
            <div style={{
                ...style,
                left: style.left + PADDING,
                top: style.top + PADDING,
                width: style.width - GAP,
                height: style.height - GAP,
            }}>
                <ProductCard
                    key={product.id}
                    product={product}
                    onClick={onAddToCart}
                    currentStock={product.stock}
                    currencySymbol={currencySymbol}
                    convertProductPrice={convertProductPrice}
                    secondaryCurrency={secondaryCurrency}
                    secondaryCurrencies={secondaryCurrencies}
                    showSecondaryPrice={showSecondaryPrice}
                />
            </div>
        );
    }, [products, columnCount, onAddToCart, currencySymbol, convertProductPrice, secondaryCurrency, secondaryCurrencies, showSecondaryPrice]);

    const showTotalCount = isServerSide && totalCount != null && products.length > 0;

    return (
        <div className="flex flex-col h-full bg-muted/10 overflow-hidden rounded-xl border border-slate-200">

            {/* Sticky Header */}
            <div className="p-2.5 bg-background border-b z-10 space-y-2 shadow-sm">
                {/* Row 1: Search */}
                <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                        <SearchWithScanner
                            ref={searchInputRef}
                            id="tour-pos-search"
                            value={localSearchTerm}
                            onChange={handleSearchInput}
                            placeholder="Buscar productos por nombre o codigo..."
                            autoFocus
                            inputClassName="h-9 pl-10 text-sm bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all shadow-sm rounded-lg"
                        />
                    </div>
                    {showTotalCount && (
                        <div className="hidden lg:flex flex-col items-end justify-center rounded-lg border border-slate-200 bg-white px-2.5 h-9 min-w-[98px] shadow-sm">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Productos</span>
                            <span className="text-[11px] font-black text-slate-700 tabular-nums">{products.length}/{totalCount}</span>
                        </div>
                    )}
                </div>

                {/* Row 2: Categories */}
                <div className="relative -mx-1 overflow-hidden">
                    <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-background to-transparent" />
                    <div className="flex max-w-full items-center gap-1 overflow-x-auto overflow-y-hidden px-1 pb-2 pr-8 scroll-smooth [scrollbar-width:thin] [scrollbar-color:#94a3b8_transparent] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-slate-100/70 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-slate-500">
                    <Button
                        variant={selectedCategoryId === null ? "default" : "outline"}
                        size="md"
                        onClick={() => handleCategoryClick(null)}
                        className={cn(
                            "rounded-md px-2.5 h-6 shrink-0 font-black transition-all uppercase text-[8.5px] tracking-widest",
                            selectedCategoryId === null
                                ? "bg-slate-900 hover:bg-black text-white shadow-sm"
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
                            onClick={() => handleCategoryClick(cat.id)}
                            className={cn(
                                "rounded-md px-2.5 h-6 shrink-0 font-black transition-all uppercase text-[8.5px] tracking-widest whitespace-nowrap",
                                selectedCategoryId === cat.id
                                    ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                                    : "border-slate-200 text-slate-500 bg-white hover:text-blue-600 hover:border-blue-300"
                            )}
                        >
                            {cat.name}
                        </Button>
                    ))}
                    </div>
                </div>
            </div>

            {/* Grid Area */}
            <div ref={containerRef} className="flex-1 min-h-0 relative bg-slate-50/30 overflow-hidden">
                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-pulse flex flex-col items-center">
                            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
                                <Package size={24} className="text-blue-500" />
                            </div>
                            <span className="text-slate-400 font-bold uppercase tracking-widest text-xs">Cargando catálogo...</span>
                        </div>
                    </div>
                ) : products.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center animate-in fade-in zoom-in-95">
                        <div className="text-center">
                            <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3 border-4 border-white shadow-inner">
                                <Box size={28} className="text-slate-300" />
                            </div>
                            <p className="font-black text-slate-800 uppercase tracking-tighter">No hay resultados</p>
                            <p className="text-xs text-slate-400 font-medium mt-1">Intenta con otra búsqueda o categoría</p>
                        </div>
                    </div>
                ) : containerSize.width > 0 && (
                    <>
                        <FixedSizeGrid
                            ref={gridRef}
                            columnCount={columnCount}
                            columnWidth={columnWidth + GAP}
                            height={containerSize.height}
                            rowCount={rowCount}
                            rowHeight={ROW_HEIGHT}
                            width={containerSize.width}
                            style={{ overflowX: 'hidden' }}
                            overscanRowCount={2}
                            onScroll={isServerSide ? handleGridScroll : undefined}
                        >
                            {Cell}
                        </FixedSizeGrid>

                        {/* Loading more indicator */}
                        {isLoadingMore && (
                            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center py-3 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none">
                                <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm border border-slate-200">
                                    <Loader2 size={16} className="animate-spin text-blue-500" />
                                    <span className="text-xs font-medium text-slate-500">Cargando más productos...</span>
                                </div>
                            </div>
                        )}

                        {/* No more products indicator */}
                        {isServerSide && !hasMore && !isLoadingMore && products.length > 0 && (
                            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center py-2 pointer-events-none">
                                <span className="text-xs text-slate-400 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full">
                                    No hay más productos
                                </span>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
});

POSCatalog.displayName = 'POSCatalog';

export default POSCatalog;
