// @cache-bust: 20260502-124455
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../utils/apiErrors';
import { Plus, Search, Package, Filter, X, Trash2, Pencil, RefreshCw, MoreHorizontal, FileDown, FileUp, ChevronDown, Barcode } from 'lucide-react';
import SearchWithScanner from '../components/common/SearchWithScanner';
import ProductForm from '../components/products/ProductForm';
import ProductMobileCard from '../components/products/ProductMobileCard';
import BulkProductActions from '../components/products/BulkProductActions';
import InventoryValuationCard from '../components/products/InventoryValuationCard';
import ProductThumbnail from '../components/products/ProductThumbnail';
import ProductInstancesModal from '../components/products/ProductInstancesModal';
import { useConfig } from '../context/ConfigContext';
import { useWebSocket } from '../context/WebSocketContext';
import { useAuth } from '../context/AuthContext';
import apiClient from '../config/axios';
import clsx from 'clsx';
import { cn } from '../utils/cn';
import { normalizeSearch } from '../utils/search';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

// Helper to format stock
const formatStock = (stock) => {
    const num = Number(stock);
    return num % 1 === 0 ? num.toFixed(0) : num.toFixed(3).replace(/\.?0+$/, '');
};

const Products = () => {
    const { user } = useAuth();
    const { getActiveCurrencies, convertProductPrice, modules } = useConfig();
    const { subscribe } = useWebSocket();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isInstancesModalOpen, setIsInstancesModalOpen] = useState(false);
    const [selectedProductForInstances, setSelectedProductForInstances] = useState(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 50;

    // Filters State
    const [categories, setCategories] = useState([]);

    // Exponer refreshCategories para ProductForm (crear categoría inline)
    useEffect(() => {
        window.__refreshCategories = async () => {
            try {
                const res = await apiClient.get('/categories');
                setCategories(res.data);
            } catch {}
        };
        return () => { delete window.__refreshCategories; };
    }, []);
    const [exchangeRates, setExchangeRates] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [filterCategory, setFilterCategory] = useState('');
    const [filterExchangeRate, setFilterExchangeRate] = useState('');
    const [filterWarehouse, setFilterWarehouse] = useState('');

    const fetchProducts = async (page = currentPage) => {
        setIsLoading(true);
        try {
            const skip = (page - 1) * ITEMS_PER_PAGE;
            const response = await apiClient.get('/products/', {
                params: {
                    skip,
                    limit: ITEMS_PER_PAGE,
                    search: searchTerm || undefined,
                    warehouse_id: filterWarehouse || undefined,
                }
            });
            setProducts(Array.isArray(response.data) ? response.data : (response.data?.items || []));
        } catch (error) {
            console.error("Error fetching products:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (product) => {
        if (window.confirm(`¿Estás seguro de que deseas eliminar el producto "${product.name}"?`)) {
            try {
                await apiClient.delete(`/products/${product.id}`);
                toast.success("Producto eliminado correctamente");
            } catch (error) {
                console.error("Error deleting product:", error);
                toast.error("Error al eliminar el producto");
            }
        }
    };

    const fetchFilters = async () => {
        try {
            const [catRes, rateRes, whRes] = await Promise.all([
                apiClient.get('/categories'),
                apiClient.get('/config/exchange-rates', { params: { is_active: true } }),
                apiClient.get('/warehouses')
            ]);
            setCategories(catRes.data);
            setExchangeRates(rateRes.data);
            setWarehouses(whRes.data);
        } catch (error) {
            console.error("Error fetching filters:", error);
        }
    };

    useEffect(() => {
        fetchProducts(currentPage);
    }, [currentPage]);

    useEffect(() => {
        fetchFilters();

        const unsubCreate = subscribe('product:created', (newProduct) => setProducts(prev => [newProduct, ...prev]));
        const unsubUpdate = subscribe('product:updated', (updatedProduct) => setProducts(prev => prev.map(p => {
            if (p.id !== updatedProduct.id) return p;
            // Preservar prices con price_list si el WS no los trae
            const merged = { ...p, ...updatedProduct };
            if (!updatedProduct.prices || updatedProduct.prices.length === 0) merged.prices = p.prices;
            return merged;
        })));
        const unsubDelete = subscribe('product:deleted', (deletedProduct) => setProducts(prev => prev.filter(p => p.id !== deletedProduct.id)));

        return () => { unsubCreate(); unsubUpdate(); unsubDelete(); };
    }, [subscribe]);

    // Debounced search: reset to page 1 and re-fetch
    useEffect(() => {
        const timeout = setTimeout(() => {
            setCurrentPage(1);
            fetchProducts(1);
        }, 400);
        return () => clearTimeout(timeout);
    }, [searchTerm, filterCategory, filterWarehouse]);

    // Client-side category and exchange rate filtering (not handled by backend params)
    const filteredProducts = products.filter(product => {
        const matchesCategory = !filterCategory || product.category_id === parseInt(filterCategory);
        const matchesRate = !filterExchangeRate || product.exchange_rate_id === parseInt(filterExchangeRate);
        return matchesCategory && matchesRate;
    });

    return (
        <div className="max-w-[1600px] mx-auto min-h-screen space-y-4 md:space-y-8 animate-in fade-in duration-500">

            {/* 1. Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Inventario</h1>
                    <p className="text-slate-500 text-sm max-w-2xl">
                        Gestiona tu catálogo de productos, existencias y precios. Utiliza las herramientas de importación masiva para actualizaciones rápidas.
                    </p>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    {/* Search Bar - Integrated in Header Actions */}
                    {/* Search Bar - Integrated in Header Actions */}
                    <div className="relative flex-1 md:w-64">
                        <SearchWithScanner
                            value={searchTerm}
                            onChange={(val) => setSearchTerm(val)}
                            placeholder="Buscar producto..."
                            inputClassName="h-10 bg-white"
                        />
                    </div>

                    {modules?.services && (
                        <Link
                            to="/inventory/serialized-reception"
                            className="inline-flex items-center gap-2 h-10 px-4 bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50 rounded-lg shadow-sm hover:shadow-md transition-all font-semibold text-sm whitespace-nowrap"
                        >
                            <Barcode size={16} />
                            <span className="hidden sm:inline">Recepción</span>
                        </Link>
                    )}
                    {['ADMIN', 'WAREHOUSE'].includes(user?.role) && (
                        <Button
                            id="tour-products-add-btn"
                            onClick={() => setIsModalOpen(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm h-10 px-4"
                        >
                            <Plus size={16} className="mr-2" />
                            Nuevo Producto
                        </Button>
                    )}
                </div>
            </div>

            {/* 2. Stats & Tools - Hidden on mobile for compact view */}
            <div className="hidden md:grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3">
                    <InventoryValuationCard />
                </div>
                <div className="flex flex-col gap-3 justify-end h-full">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2 h-full justify-center">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Acciones Rápidas</span>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={fetchProducts} className="flex-1 border-slate-200 text-slate-600 hover:bg-slate-50">
                                <RefreshCw size={14} className="mr-2" /> Recargar
                            </Button>
                            <BulkProductActions onImportComplete={fetchProducts} />
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Filtros y Resultados */}
            <div className="flex flex-col gap-4">

                {/* Mobile Filters (Horizontal Scroll) */}
                <div className="flex gap-2 overflow-x-auto pb-2 md:hidden no-scrollbar">
                    <button
                        onClick={() => { setFilterCategory(''); setFilterWarehouse(''); }}
                        className={cn(
                            "px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors border",
                            !filterCategory && !filterWarehouse
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-white text-slate-600 border-slate-200"
                        )}
                    >
                        Todos
                    </button>
                    {categories.map(c => (
                        <button
                            key={c.id}
                            onClick={() => setFilterCategory(c.id === parseInt(filterCategory) ? '' : c.id.toString())}
                            className={cn(
                                "px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors border",
                                parseInt(filterCategory) === c.id
                                    ? "bg-indigo-600 text-white border-indigo-600"
                                    : "bg-white text-slate-600 border-slate-200"
                            )}
                        >
                            {c.name}
                        </button>
                    ))}
                </div>

                {/* Desktop Filters (Toolbar) */}
                <div className="hidden md:flex p-4 bg-white rounded-xl border border-slate-200 shadow-sm gap-4">
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="h-9 px-3 rounded-lg border border-slate-200 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none bg-slate-50/50 text-slate-600 font-medium"
                    >
                        <option value="">Todas las Categorías</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>

                    <select
                        value={filterWarehouse}
                        onChange={(e) => setFilterWarehouse(e.target.value)}
                        className="h-9 px-3 rounded-lg border border-slate-200 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none bg-slate-50/50 text-slate-600 font-medium"
                    >
                        <option value="">Todas las Bodegas</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>

                    {(filterCategory || filterWarehouse) && (
                        <Button variant="ghost" size="sm" onClick={() => { setFilterCategory(''); setFilterWarehouse(''); }} className="text-rose-500 h-9">
                            <X size={14} className="mr-1" /> Limpiar
                        </Button>
                    )}
                </div>

                {/* CONTENIDO PRINCIPAL: Cards (Móvil) vs Tabla (Desktop) */}

                {/* Vista Móvil: Lista de Tarjetas */}
                <div className="md:hidden space-y-3">
                    {isLoading ? (
                        <div className="p-8 text-center text-slate-400">Cargando productos...</div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            No se encontraron productos.
                        </div>
                    ) : (
                        filteredProducts.map(product => (
                            <ProductMobileCard
                                key={product.id}
                                product={product}
                                onEdit={(p) => { setSelectedProduct(p); setIsModalOpen(true); }}
                                onDelete={handleDelete}
                                onCategoryClick={(catId) => setFilterCategory(catId.toString())}
                            />
                        ))
                    )}
                </div>

                {/* Vista Desktop: Tabla Tradicional */}
                <div className="hidden md:flex bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden md:min-h-[500px] flex-col">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                                <TableHead className="w-[80px]">Img</TableHead>
                                <TableHead className="w-[300px]">Producto / SKU</TableHead>
                                <TableHead>Categoría</TableHead>
                                <TableHead className="text-right">Precio</TableHead>
                                <TableHead>Stock</TableHead>
                                <TableHead className="text-right w-[80px]">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        <div className="flex items-center justify-center gap-2 text-slate-500">
                                            <RefreshCw className="animate-spin" size={16} /> Cargando inventario...
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : filteredProducts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                                        No se encontraron productos.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredProducts.map((product) => (
                                    <TableRow key={product.id} className="group hover:bg-indigo-50/30 transition-colors duration-200">
                                        <TableCell>
                                            <div className="relative">
                                                <ProductThumbnail
                                                    imageUrl={product.image_url}
                                                    productName={product.name}
                                                    size="md"
                                                    className="h-14 w-14 rounded-xl border border-slate-100 shadow-sm mix-blend-multiply transition-transform group-hover:scale-105"
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors text-base tracking-tight">
                                                    {product.name}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold border border-slate-200 uppercase tracking-tighter">
                                                        SKU: {product.sku || '---'}
                                                    </span>
                                                    {Array.isArray(product.prices) && product.prices.length > 0 && (
                                                        <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                                                            {product.prices[0].price_list?.name || 'Lista'}: ${Number(product.prices[0].price || 0).toFixed(2)}
                                                        </span>
                                                    )}
                                                    {product.has_imei && (
                                                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-1 border-blue-200 text-blue-700 bg-blue-50 font-black">
                                                            SERIAL
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {product.category?.name ? (
                                                <Badge
                                                    variant="outline"
                                                    className="font-bold text-slate-600 bg-white border-slate-200 hover:bg-slate-50 cursor-pointer shadow-sm active:scale-95 transition-transform"
                                                    onClick={() => setFilterCategory(product.category_id.toString())}
                                                >
                                                    {product.category.name}
                                                </Badge>
                                            ) : (
                                                <Badge
                                                    variant="outline"
                                                    className="font-medium text-slate-400 bg-slate-50/50 border-slate-100 border-dashed italic cursor-pointer hover:bg-slate-100 transition-colors"
                                                    onClick={() => setFilterCategory('')}
                                                >
                                                    Sin categoría
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex flex-col items-end gap-1.5">
                                                {/* Precio base */}
                                                <div className="flex flex-col items-end">
                                                    <div className="text-2xl font-black text-indigo-700 tracking-tighter leading-none">
                                                        ${Number(product.price).toFixed(2)}
                                                    </div>
                                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">USD</div>
                                                </div>
                                                {/* Primera lista de precios */}
                                                {Array.isArray(product.prices) && product.prices.length > 0 && (
                                                    <div className="flex flex-col items-end bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1">
                                                        <div className="text-base font-black text-indigo-700 tracking-tight leading-none">
                                                            ${Number(product.prices[0].price || 0).toFixed(2)}
                                                        </div>
                                                        <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mt-0.5 truncate max-w-[90px]">
                                                            {product.prices[0].price_list?.name || 'Lista especial'}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {(() => {
                                                const totalStock = Number(product.stock || 0);
                                                const minStock = Number(product.min_stock ?? 5);
                                                const isOut = totalStock === 0;
                                                const isLow = !isOut && totalStock < minStock;

                                                return (
                                                    <div className="flex flex-col gap-1">
                                                        <div className={cn(
                                                            "text-lg font-black tracking-tight leading-none",
                                                            isOut ? "text-rose-600" : (isLow ? "text-amber-600" : "text-emerald-600")
                                                        )}>
                                                            {formatStock(totalStock)} <span className="text-xs uppercase opacity-70">un.</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <div className={cn(
                                                                "w-2 h-2 rounded-full",
                                                                isOut ? "bg-rose-500 animate-pulse" : (isLow ? "bg-amber-500" : "bg-emerald-500")
                                                            )}></div>
                                                            <span className={cn(
                                                                "text-[10px] font-black uppercase tracking-wider",
                                                                isOut ? "text-rose-500" : (isLow ? "text-amber-600" : "text-emerald-600")
                                                            )}>
                                                                {isOut ? "Agotado" : (isLow ? "Bajo Stock" : "En Stock")}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {['ADMIN', 'WAREHOUSE'].includes(user?.role) && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-100 shadow-none hover:shadow-sm rounded-xl transition-all">
                                                            <MoreHorizontal size={20} />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="rounded-xl border-slate-200 shadow-xl min-w-[160px]">
                                                        <DropdownMenuLabel className="text-xs uppercase text-slate-400 tracking-widest">Opciones</DropdownMenuLabel>
                                                        {product.has_imei && modules.services && (
                                                            <DropdownMenuItem
                                                                onClick={() => { setSelectedProductForInstances(product); setIsInstancesModalOpen(true); }}
                                                                className="py-2.5 rounded-lg cursor-pointer font-medium text-slate-700 hover:text-indigo-600 hover:bg-indigo-50"
                                                            >
                                                                <div className="flex items-center w-full">
                                                                    <div className="w-8 flex justify-center"><Search size={16} /></div>
                                                                    <span>Ver Seriales / IMEIs</span>
                                                                </div>
                                                            </DropdownMenuItem>
                                                        )}
                                                        {['ADMIN', 'WAREHOUSE'].includes(user?.role) && (
                                                            <DropdownMenuItem onClick={() => { setSelectedProduct(product); setIsModalOpen(true); }} className="py-2.5 rounded-lg cursor-pointer">
                                                                <Pencil size={16} className="mr-3 text-indigo-500" />
                                                                <span className="font-bold">Editar</span>
                                                            </DropdownMenuItem>
                                                        )}
                                                        {user?.role === 'ADMIN' && (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    onClick={() => handleDelete(product)}
                                                                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 focus:bg-rose-50 py-2.5 rounded-lg cursor-pointer font-bold"
                                                                >
                                                                    <Trash2 size={16} className="mr-3" /> Eliminar
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t">
                <div className="text-sm text-muted-foreground">
                    Mostrando {filteredProducts.length} productos (página {currentPage})
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                    >
                        Anterior
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => p + 1)}
                        disabled={products.length < ITEMS_PER_PAGE}
                    >
                        Siguiente
                    </Button>
                </div>
            </div>

            <ProductForm
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setSelectedProduct(null); }}
                initialData={selectedProduct}
                categories={categories}
                warehouses={warehouses}
                exchangeRates={exchangeRates}
                onSubmit={async (productData) => {
                    try {
                        if (selectedProduct) { await apiClient.put(`/products/${selectedProduct.id}`, productData); toast.success("Actualizado"); }
                        else { await apiClient.post('/products/', productData); toast.success("Creado"); }
                        await fetchProducts(); setIsModalOpen(false); setSelectedProduct(null);
                    } catch (e) { console.error(e); toast.error(e.response?.data?.detail || "Error"); }
                }}
            />

            <ProductInstancesModal
                isOpen={isInstancesModalOpen}
                onClose={() => { setIsInstancesModalOpen(false); setSelectedProductForInstances(null); }}
                product={selectedProductForInstances}
            />
        </div>
    );
};

export default Products;
