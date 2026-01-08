
import React, { useState, useRef, useEffect } from 'react';
import { useConfig } from '../../context/ConfigContext';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import { Search, Loader2, Barcode, Check, Trash2, Layers, AlertCircle, Save, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const SerializedReception = () => {
    const { modules } = useConfig();
    const [catalog, setCatalog] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filteredCatalog, setFilteredCatalog] = useState([]);

    // Form State
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [imeiInput, setImeiInput] = useState('');
    const [scannedList, setScannedList] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
    const [unitCost, setUnitCost] = useState('');

    const inputRef = useRef(null);
    const searchInputRef = useRef(null);

    // Initial Data Load
    useEffect(() => {
        const loadData = async () => {
            try {
                const [productsRes, warehousesRes] = await Promise.all([
                    apiClient.get('/products/'),
                    apiClient.get('/warehouses')
                ]);

                // Filter only serialized products
                const allProducts = Array.isArray(productsRes.data) ? productsRes.data : [];
                const serializedOnly = allProducts.filter(p => p.has_imei);

                setCatalog(serializedOnly);
                setFilteredCatalog(serializedOnly);

                const whList = Array.isArray(warehousesRes.data) ? warehousesRes.data : [];
                setWarehouses(whList);
                if (whList.length > 0) setSelectedWarehouseId(whList[0].id);

            } catch (error) {
                console.error("Error loading data:", error);
                toast.error("Error cargando productos serializados");
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    // Product Search Filter
    useEffect(() => {
        if (!searchTerm) {
            setFilteredCatalog(catalog);
            return;
        }
        const lower = searchTerm.toLowerCase();
        setFilteredCatalog(catalog.filter(p =>
            p.name.toLowerCase().includes(lower) ||
            (p.sku && p.sku.toLowerCase().includes(lower))
        ));
    }, [searchTerm, catalog]);

    // Handle IMEI Input (Enter key)
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addImei();
        }
    };

    const addImei = () => {
        if (!selectedProduct) {
            toast.error("Primero selecciona un producto");
            return;
        }

        const code = imeiInput.trim().toUpperCase();
        if (!code) return;

        // Check duplicates in current list
        if (scannedList.includes(code)) {
            toast.error('Este IMEI ya está en la lista de ingreso actual');
            setImeiInput('');
            return;
        }

        // Add to list
        setScannedList(prev => [...prev, code]);
        setImeiInput('');
        toast.success(`Capturado: ${code}`);
    };

    const removeImei = (code) => {
        setScannedList(prev => prev.filter(i => i !== code));
    };

    const clearAll = () => {
        if (confirm('¿Borrar toda la lista?')) {
            setScannedList([]);
        }
    };

    const handleProductSelect = (product) => {
        setSelectedProduct(product);
        setSearchTerm(''); // Clear search to hide grid
        setUnitCost(product.cost_price || '');
        // Focus IMEI input
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const resetSelection = () => {
        setSelectedProduct(null);
        setScannedList([]);
        setImeiInput('');
    }

    const handleSubmit = async () => {
        if (!selectedProduct || !selectedWarehouseId || scannedList.length === 0) {
            toast.error("Faltan datos requeridos (Producto, Bodega o IMEIs)");
            return;
        }

        const payload = {
            product_id: selectedProduct.id,
            warehouse_id: parseInt(selectedWarehouseId),
            imeis: scannedList,
            cost: unitCost ? parseFloat(unitCost) : 0
        };

        try {
            const toastId = toast.loading("Procesando Ingreso Masivo...");
            const res = await apiClient.post('/inventory/bulk-entry', payload);

            toast.dismiss(toastId);
            toast.success(`¡Éxito! Stock actualizado: ${res.data.new_stock_level} unidades.`);

            // Reset for next entry
            setScannedList([]);
            setImeiInput('');
            // Optionally keep same product selected or reset? 
            // Typically "Metralleta" is one product batch, then maybe another. Keep product helpful.

        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.detail || "Error procesando ingreso");
        }
    };

    if (isLoading) {
        return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-indigo-600" size={48} /></div>;
    }

    return (
        <div className="h-full bg-slate-50 p-6 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Barcode size={28} className="text-indigo-600" />
                        Recepción Serializada Masiva
                    </h1>
                    <p className="text-sm text-slate-500">Ingreso rápido de equipos por IMEI ("Metralleta")</p>
                </div>
                <Link to="/inventory" className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-bold transition-colors">
                    Volver al Inventario
                </Link>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0">
                {/* LEFT COLUMN: Input & Control */}
                <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

                    {/* Warehouse & Cost Selectors (Only visible if Product Selected) */}
                    {selectedProduct && (
                        <div className="p-4 bg-slate-50 border-b border-slate-100 flex gap-4">
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-slate-500 mb-1">Bodega de Destino</label>
                                <select
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    value={selectedWarehouseId}
                                    onChange={e => setSelectedWarehouseId(e.target.value)}
                                >
                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                            <div className="w-32">
                                <label className="block text-xs font-bold text-slate-500 mb-1">Costo Unitario ($)</label>
                                <input
                                    type="number"
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    value={unitCost}
                                    onChange={e => setUnitCost(e.target.value)}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                    )}

                    {/* Product Selection Mode */}
                    {!selectedProduct ? (
                        <div className="flex-1 flex flex-col p-6">
                            <div className="relative mb-6">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-lg focus:border-indigo-500 focus:bg-white transition-all"
                                    placeholder="Buscar producto a recepcionar..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className="flex-1 overflow-y-auto">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {filteredCatalog.map(product => (
                                        <button
                                            key={product.id}
                                            onClick={() => handleProductSelect(product)}
                                            className="flex items-start gap-4 p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-500 hover:shadow-md transition-all text-left"
                                        >
                                            {product.image_url ? (
                                                <img src={product.image_url} alt="" className="w-16 h-16 object-cover rounded-lg bg-slate-100" />
                                            ) : (
                                                <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300">
                                                    <Layers size={24} />
                                                </div>
                                            )}
                                            <div>
                                                <h3 className="font-bold text-slate-800">{product.name}</h3>
                                                <p className="text-xs text-slate-500 font-mono mt-1">{product.sku}</p>
                                                <span className="inline-block mt-2 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded">
                                                    SERIALIZADO
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                    {filteredCatalog.length === 0 && (
                                        <div className="col-span-full py-12 text-center text-slate-400">
                                            No se encontraron productos serializados
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        // Scanning Mode
                        <div className="flex-1 flex flex-col p-6">
                            {/* Selected Product Header */}
                            <div className="flex items-center justify-between bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-6">
                                <div className="flex items-center gap-4">
                                    {selectedProduct.image_url && <img src={selectedProduct.image_url} className="w-12 h-12 rounded bg-white object-cover" />}
                                    <div>
                                        <h2 className="font-bold text-indigo-900">{selectedProduct.name}</h2>
                                        <p className="text-xs text-indigo-600 font-mono">{selectedProduct.sku}</p>
                                    </div>
                                </div>
                                <button onClick={resetSelection} className="p-2 hover:bg-white rounded-lg text-indigo-400 hover:text-rose-500 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Main Input */}
                            <div className="flex-1 flex flex-col justify-center items-center">
                                <div className="w-full max-w-md space-y-4">
                                    <label className="block text-center text-sm font-bold text-slate-500 uppercase tracking-widest">
                                        Escanear IMEI / Serial
                                    </label>
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        className="w-full text-center px-4 py-6 text-2xl font-mono bg-white border-2 border-indigo-200 rounded-2xl shadow-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all placeholder:text-slate-300"
                                        placeholder="SCAN HERE"
                                        value={imeiInput}
                                        onChange={e => setImeiInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        autoComplete="off"
                                    />
                                    <p className="text-center text-xs text-slate-400">Presiona ENTER para agregar</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: Scanned List sidebar */}
                <div className="w-full lg:w-96 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h3 className="font-bold text-slate-700">Items Capturados</h3>
                        <span className="px-2 py-1 bg-indigo-600 text-white text-xs font-bold rounded-full">
                            {scannedList.length}
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {scannedList.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg shadow-sm animate-in fade-in slide-in-from-left-4 duration-200">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                                    <span className="font-mono text-sm font-medium text-slate-600 truncate">{item}</span>
                                </div>
                                <button onClick={() => removeImei(item)} className="text-slate-300 hover:text-rose-500 transition-colors">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                        {scannedList.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 py-12">
                                <Layers size={48} className="mb-4 opacity-20" />
                                <p className="text-sm">Lista vacía</p>
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t border-slate-100 space-y-3 bg-slate-50">
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={clearAll}
                                disabled={scannedList.length === 0}
                                className="px-4 py-3 border border-slate-300 text-slate-600 font-bold rounded-xl text-sm hover:bg-white transition-all disabled:opacity-50"
                            >
                                Limpiar
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={scannedList.length === 0 || !selectedProduct}
                                className="px-4 py-3 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:shadow-none disabled:transform-none flex items-center justify-center gap-2"
                            >
                                <Save size={18} />
                                Procesar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SerializedReception;
