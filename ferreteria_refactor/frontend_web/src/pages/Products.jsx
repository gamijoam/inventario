import { useState, useEffect } from 'react';
import { Plus, Search, Package, Filter, X, Trash2, Pencil, RefreshCw, MoreHorizontal, FileDown, FileUp, ChevronDown } from 'lucide-react';
import ProductForm from '../components/products/ProductForm';
import BulkProductActions from '../components/products/BulkProductActions';
import InventoryValuationCard from '../components/products/InventoryValuationCard';
import ProductThumbnail from '../components/products/ProductThumbnail';
import { useConfig } from '../context/ConfigContext';
import { useWebSocket } from '../context/WebSocketContext';
import apiClient from '../config/axios';
import clsx from 'clsx';
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
    const { getActiveCurrencies, convertProductPrice } = useConfig();
    const { subscribe } = useWebSocket();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters State
    const [categories, setCategories] = useState([]);
    const [exchangeRates, setExchangeRates] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [filterCategory, setFilterCategory] = useState('');
    const [filterExchangeRate, setFilterExchangeRate] = useState('');
    const [filterWarehouse, setFilterWarehouse] = useState('');

    const fetchProducts = async () => {
        setIsLoading(true);
        try {
            const response = await apiClient.get('/products/');
            setProducts(response.data);
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
                alert("Producto eliminado correctamente");
            } catch (error) {
                console.error("Error deleting product:", error);
                alert("Error al eliminar el producto");
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
        fetchProducts();
        fetchFilters();

        const unsubCreate = subscribe('product:created', (newProduct) => setProducts(prev => [newProduct, ...prev]));
        const unsubUpdate = subscribe('product:updated', (updatedProduct) => setProducts(prev => prev.map(p => p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p)));
        const unsubDelete = subscribe('product:deleted', (deletedProduct) => setProducts(prev => prev.filter(p => p.id !== deletedProduct.id)));

        return () => { unsubCreate(); unsubUpdate(); unsubDelete(); };
    }, [subscribe]);

    // Computed Products List
    const filteredProducts = products.filter(product => {
        const matchesSearch = !searchTerm || product.name.toLowerCase().includes(searchTerm.toLowerCase()) || (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesCategory = !filterCategory || product.category_id === parseInt(filterCategory);
        const matchesRate = !filterExchangeRate || product.exchange_rate_id === parseInt(filterExchangeRate);
        const matchesWarehouse = !filterWarehouse || (product.stocks && product.stocks.some(s => s.warehouse_id === parseInt(filterWarehouse) && s.quantity > 0));
        return matchesSearch && matchesCategory && matchesRate && matchesWarehouse;
    });

    return (
        <div className="p-8 max-w-[1600px] mx-auto min-h-screen space-y-8 animate-in fade-in duration-500">

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
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <Input
                            placeholder="Buscar producto..."
                            className="pl-9 h-10 bg-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <Button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm h-10 px-4"
                    >
                        <Plus size={16} className="mr-2" />
                        Nuevo Producto
                    </Button>
                </div>
            </div>

            {/* 2. Stats & Tools */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Valuation Card - Keep logic but possibly style simplified? Keeping original component for now */}
                <div className="lg:col-span-3">
                    <InventoryValuationCard />
                </div>
                <div className="flex flex-col gap-3 justify-end h-full">
                    {/* Quick Actions Panel */}
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

            {/* 3. Data Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden md:min-h-[500px] flex flex-col">
                {/* Table Toolbar / Filters (Optional Secondary Bar) */}
                <div className="p-4 border-b border-slate-100 flex gap-4 overflow-x-auto">
                    {/* Simplified Filters - Using Selects styled minimally */}
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="h-9 px-3 rounded-md border border-slate-200 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none bg-slate-50/50 text-slate-600 font-medium"
                    >
                        <option value="">Todas las Categorías</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>

                    <select
                        value={filterWarehouse}
                        onChange={(e) => setFilterWarehouse(e.target.value)}
                        className="h-9 px-3 rounded-md border border-slate-200 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none bg-slate-50/50 text-slate-600 font-medium"
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
                                <TableRow key={product.id} className="group">
                                    <TableCell>
                                        <ProductThumbnail
                                            imageUrl={product.image_url}
                                            productName={product.name}
                                            size="sm"
                                            className="rounded-lg border border-slate-100 mix-blend-multiply"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                                {product.name}
                                            </span>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono border border-slate-200">
                                                    {product.sku || 'N/A'}
                                                </span>
                                                {product.has_imei && (
                                                    <Badge variant="outline" className="text-[9px] h-4 px-1 gap-1 border-blue-200 text-blue-700 bg-blue-50">
                                                        SERIAL
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {product.category?.name ? (
                                            <Badge variant="outline" className="font-normal text-slate-600 bg-slate-50 border-slate-200">
                                                {product.category.name}
                                            </Badge>
                                        ) : (
                                            <span className="text-slate-400 text-xs italic">Sin categoría</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        <div className="text-slate-900">${Number(product.price).toFixed(2)}</div>
                                        <div className="text-xs text-slate-400">USD</div>
                                    </TableCell>
                                    <TableCell>
                                        {(() => {
                                            const totalStock = product.stock || 0;
                                            // Warehouse filtering visual logic
                                            if (filterWarehouse) {
                                                const s = product.stocks?.find(st => st.warehouse_id === parseInt(filterWarehouse));
                                                return (
                                                    <Badge variant={s?.quantity > 5 ? "secondary" : "destructive"} className="font-bold">
                                                        {formatStock(s?.quantity || 0)} un.
                                                    </Badge>
                                                );
                                            }
                                            // Default Total
                                            return (
                                                <Badge
                                                    variant={totalStock <= 5 ? "destructive" : "secondary"}
                                                    className={clsx(
                                                        "font-bold",
                                                        totalStock > 5 ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200" : ""
                                                    )}
                                                >
                                                    {formatStock(totalStock)} un.
                                                </Badge>
                                            );
                                        })()}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-900 data-[state=open]:text-indigo-600">
                                                    <MoreHorizontal size={16} />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => { setSelectedProduct(product); setIsModalOpen(true); }}>
                                                    <Pencil size={14} className="mr-2 text-slate-500" /> Editar
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => handleDelete(product)}
                                                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 focus:bg-rose-50"
                                                >
                                                    <Trash2 size={14} className="mr-2" /> Eliminar
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination Placeholder (if needed in future) */}
            <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Mostrando {filteredProducts.length} productos</span>
                {/* <div className="flex gap-2">...</div> */}
            </div>

            <ProductForm
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setSelectedProduct(null); }}
                initialData={selectedProduct}
                onSubmit={async (productData) => {
                    try {
                        if (selectedProduct) { await apiClient.put(`/products/${selectedProduct.id}`, productData); alert("Actualizado"); }
                        else { await apiClient.post('/products/', productData); alert("Creado"); }
                        await fetchProducts(); setIsModalOpen(false); setSelectedProduct(null);
                    } catch (e) { console.error(e); alert(e.response?.data?.detail || "Error"); }
                }}
            />
        </div>
    );
};

export default Products;
