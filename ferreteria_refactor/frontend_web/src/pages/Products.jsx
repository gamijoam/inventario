import { useState, useEffect } from 'react';
import { Plus, Search, Package, Filter, X, Trash2, Pencil } from 'lucide-react';
import ProductForm from '../components/products/ProductForm';
import BulkProductActions from '../components/products/BulkProductActions';
import InventoryValuationCard from '../components/products/InventoryValuationCard';
import ProductThumbnail from '../components/products/ProductThumbnail';
import { useConfig } from '../context/ConfigContext';
import { useWebSocket } from '../context/WebSocketContext';
import apiClient from '../config/axios';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper to format stock: show as integer if whole number, otherwise show decimals
const formatStock = (stock) => {
    const num = Number(stock);
    return num % 1 === 0 ? num.toFixed(0) : num.toFixed(3).replace(/\.?0+$/, '');
};

const Products = () => {
    const { getActiveCurrencies, convertProductPrice } = useConfig();
    const { subscribe } = useWebSocket();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null); // For editing

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
                // State update is handled by WebSocket subscription
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

        // WebSocket Subscriptions
        const unsubCreate = subscribe('product:created', (newProduct) => {
            setProducts(prev => [newProduct, ...prev]);
        });

        const unsubUpdate = subscribe('product:updated', (updatedProduct) => {
            setProducts(prev => prev.map(p => p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p));
        });

        const unsubDelete = subscribe('product:deleted', (deletedProduct) => {
            setProducts(prev => prev.filter(p => p.id !== deletedProduct.id));
        });

        return () => {
            unsubCreate();
            unsubUpdate();
            unsubDelete();
        };
    }, [subscribe]);

    // Helper to render stock cell with indicators
    const renderStockCell = (product) => {
        if (filterWarehouse) {
            // Specific Warehouse View
            const stockEntry = product.stocks?.find(s => s.warehouse_id === parseInt(filterWarehouse));
            const quantity = stockEntry ? stockEntry.quantity : 0;
            return (
                <span className={`px-2.5 py-0.5 inline-flex text-xs font-bold rounded-full border ${quantity > 10
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                    {formatStock(quantity)}
                </span>
            );
        } else {
            // All Warehouses View (Total + Breakdown)
            const totalStock = product.stock;
            const hasStocks = product.stocks && product.stocks.length > 0;

            return (
                <div className="flex flex-col items-start gap-1">
                    <span className={`px-2.5 py-0.5 inline-flex text-xs font-bold rounded-full border ${totalStock > 10
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                        Total: {formatStock(totalStock)}
                    </span>
                    {hasStocks ? (
                        <div className="flex flex-wrap gap-1 mt-1">
                            {product.stocks.filter(s => s.quantity > 0).map(stock => {
                                const whName = warehouses.find(w => w.id === stock.warehouse_id)?.name || 'N/A';
                                return (
                                    <span key={stock.id} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 font-medium" title={`Ubicación: ${stock.location || 'Sin definir'}`}>
                                        {whName}: {formatStock(stock.quantity)}
                                    </span>
                                );
                            })}
                        </div>
                    ) : (
                        <span className="text-[10px] text-slate-400 italic">Sin asignar</span>
                    )}
                </div>
            );
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center">
                        <Package className="mr-2 text-indigo-600" /> Catalogo de Productos
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Gestiona precios, existencias y códigos.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {/* Bulk Import/Export Actions */}
                    <BulkProductActions onImportComplete={fetchProducts} />

                    {/* Nuevo Producto Button */}
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl flex items-center shadow-lg shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5 transition-all font-bold text-sm"
                    >
                        <Plus size={20} className="mr-2" />
                        Nuevo Producto
                    </button>
                </div>
            </div>

            {/* Valuation Dashboard (Admin Only) */}
            <InventoryValuationCard />

            {/* Filters Bar */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, SKU, Código..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    {/* Warehouse Filter */}
                    <div className="relative min-w-[160px] flex-1 md:flex-none">
                        <select
                            value={filterWarehouse}
                            onChange={(e) => setFilterWarehouse(e.target.value)}
                            className={`w-full appearance-none pl-3 pr-8 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-bold transition-all ${filterWarehouse ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                        >
                            <option value="">Todas las Bodegas</option>
                            {warehouses.map(wh => (
                                <option key={wh.id} value={wh.id}>
                                    {wh.name} {wh.is_main ? '(Principal)' : ''}
                                </option>
                            ))}
                        </select>
                        <Filter className={`absolute right-3 top-2.5 pointer-events-none ${filterWarehouse ? 'text-indigo-500' : 'text-slate-400'}`} size={16} />
                    </div>

                    <div className="relative min-w-[160px] flex-1 md:flex-none">
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="w-full appearance-none pl-3 pr-8 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium text-slate-600 hover:border-slate-300 transition-colors"
                        >
                            <option value="">Todas las Categorías</option>
                            {categories.filter(cat => !cat.parent_id).map(parent => (
                                <optgroup key={parent.id} label={parent.name}>
                                    <option value={parent.id}>{parent.name}</option>
                                    {categories.filter(child => child.parent_id === parent.id).map(child => (
                                        <option key={child.id} value={child.id}>
                                            └─ {child.name}
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                            {categories.filter(cat => !cat.parent_id && !categories.some(c => c.parent_id === cat.id)).length === 0 && categories.filter(cat => !cat.parent_id).map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                        <Filter className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" size={16} />
                    </div>

                    <div className="relative min-w-[140px] flex-1 md:flex-none">
                        <select
                            value={filterExchangeRate}
                            onChange={(e) => setFilterExchangeRate(e.target.value)}
                            className="w-full appearance-none pl-3 pr-8 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium text-slate-600 hover:border-slate-300 transition-colors"
                        >
                            <option value="">Todas las Tasas</option>
                            {exchangeRates.map(rate => (
                                <option key={rate.id} value={rate.id}>
                                    {rate.name}
                                </option>
                            ))}
                        </select>
                        <Filter className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" size={16} />
                    </div>

                    {(filterCategory || filterExchangeRate || filterWarehouse) && (
                        <button
                            onClick={() => {
                                setFilterCategory('');
                                setFilterExchangeRate('');
                                setFilterWarehouse('');
                            }}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-100"
                            title="Limpiar Filtros"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Producto</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">SKU / Unidad</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Precio Publico</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                {filterWarehouse ? 'Stock (Bodega)' : 'Stock Total'}
                            </th>
                            <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-50">
                        {products
                            .filter(product => {
                                // 1. Search Logic
                                const matchesSearch = !searchTerm || (() => {
                                    const search = searchTerm.toLowerCase();
                                    return (
                                        product.name.toLowerCase().includes(search) ||
                                        (product.sku && product.sku.toLowerCase().includes(search))
                                    );
                                })();

                                // 2. Category Filter
                                const matchesCategory = !filterCategory || product.category_id === parseInt(filterCategory);

                                // 3. Exchange Rate Filter
                                const matchesRate = !filterExchangeRate || product.exchange_rate_id === parseInt(filterExchangeRate);

                                // 4. Warehouse Filter
                                const matchesWarehouse = !filterWarehouse || (product.stocks && product.stocks.some(s => s.warehouse_id === parseInt(filterWarehouse) && s.quantity > 0));

                                return matchesSearch && matchesCategory && matchesRate && matchesWarehouse;
                            })
                            .map((product, index) => {
                                return (
                                    <tr
                                        key={product.id}
                                        className={clsx(
                                            "transition-colors duration-200",
                                            index % 2 === 0 ? "bg-white" : "bg-slate-50/40",
                                            "hover:bg-indigo-50/40"
                                        )}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-4">
                                                <ProductThumbnail
                                                    imageUrl={product.image_url}
                                                    productName={product.name}
                                                    updatedAt={product.updated_at}
                                                    size="md"
                                                />
                                                <div>
                                                    <div className="text-sm font-bold text-slate-900 flex items-center">
                                                        {product.name}
                                                    </div>
                                                    {product.units && product.units.length > 0 && (
                                                        <span className="inline-flex mt-1 px-2 py-0.5 text-[10px] bg-purple-100 text-purple-700 font-bold rounded-full border border-purple-200">
                                                            Multi-formato
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-slate-600">{product.sku || '---'}</span>
                                                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">{product.unit}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-black text-slate-800">${Number(product.price).toFixed(2)}</div>
                                            <div className="text-xs text-slate-500 flex flex-col mt-0.5">
                                                {getActiveCurrencies().map(currency => (
                                                    <span key={currency.id}>
                                                        {convertProductPrice(product, currency.currency_code).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency.symbol}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {renderStockCell(product)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => {
                                                        setSelectedProduct(product);
                                                        setIsModalOpen(true);
                                                    }}
                                                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    title="Editar"
                                                >
                                                    <Pencil size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(product)}
                                                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        {products.length === 0 && !isLoading && (
                            <tr>
                                <td colSpan="5" className="text-center py-12 text-slate-400">
                                    No se encontraron productos.
                                </td>
                            </tr>
                        )}
                        {isLoading && (
                            <tr>
                                <td colSpan="5" className="text-center py-12 text-slate-400">
                                    Cargando inventario...
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden grid grid-cols-1 gap-4 pb-20">
                {products
                    .filter(product => {
                        const matchesSearch = !searchTerm || (() => {
                            const search = searchTerm.toLowerCase();
                            return (
                                product.name.toLowerCase().includes(search) ||
                                (product.sku && product.sku.toLowerCase().includes(search))
                            );
                        })();
                        const matchesCategory = !filterCategory || product.category_id === parseInt(filterCategory);
                        const matchesRate = !filterExchangeRate || product.exchange_rate_id === parseInt(filterExchangeRate);
                        const matchesWarehouse = !filterWarehouse || (product.stocks && product.stocks.some(s => s.warehouse_id === parseInt(filterWarehouse) && s.quantity > 0));

                        return matchesSearch && matchesCategory && matchesRate && matchesWarehouse;
                    })
                    .map(product => {
                        return (
                            <div key={product.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm active:scale-[0.98] transition-all">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <ProductThumbnail
                                            imageUrl={product.image_url}
                                            productName={product.name}
                                            updatedAt={product.updated_at}
                                            size="md"
                                        />
                                        <div>
                                            <div className="font-bold text-slate-800 text-sm leading-tight">{product.name}</div>
                                            <div className="text-xs text-slate-500 flex gap-2 mt-1 font-medium">
                                                <span>{product.sku || 'Sin SKU'}</span>
                                                <span>•</span>
                                                <span className="uppercase">{product.unit}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end pl-2">
                                        {renderStockCell(product)}
                                    </div>
                                </div>

                                <div className="flex justify-between items-end border-t border-slate-100 pt-3 mt-3">
                                    <div>
                                        <div className="text-lg font-black text-indigo-600">${Number(product.price).toFixed(2)}</div>
                                        <div className="text-xs text-slate-400 font-medium">Precio Base</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setSelectedProduct(product);
                                                setIsModalOpen(true);
                                            }}
                                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                                        >
                                            <Pencil size={14} /> Editar
                                        </button>
                                        <button
                                            onClick={() => handleDelete(product)}
                                            className="bg-rose-50 hover:bg-rose-100 text-rose-600 p-2 rounded-lg transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                {!isLoading && products.length === 0 && (
                    <div className="text-center py-10 text-slate-400 font-medium">
                        No se encontraron productos.
                    </div>
                )}
            </div>

            <ProductForm
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedProduct(null); // Clear selection on close
                }}
                initialData={selectedProduct} // Pass data for editing
                onSubmit={async (productData) => {
                    try {
                        if (selectedProduct) {
                            // Edit Mode
                            await apiClient.put(`/products/${selectedProduct.id}`, productData);
                            alert("Producto actualizado exitosamente");
                        } else {
                            // Create Mode
                            await apiClient.post('/products/', productData);
                            alert("Producto creado exitosamente");
                        }
                        await fetchProducts(); // Refresh list
                        setIsModalOpen(false);
                        setSelectedProduct(null);
                    } catch (error) {
                        console.error("Error saving product:", error);
                        const errorMessage = error.response?.data?.detail || "Error al guardar producto";
                        alert(errorMessage);
                    }
                }}
            />
        </div >
    );
};

export default Products;
