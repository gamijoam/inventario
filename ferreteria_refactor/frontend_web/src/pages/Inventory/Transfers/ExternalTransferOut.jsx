import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../../../config/axios';
import { toast } from 'react-hot-toast';
import { Search, Package, ArrowRight, Download, Trash2, AlertTriangle, CheckCircle, Camera, X, Image as ImageIcon, Zap, MessageSquareShare, Loader2, FileText, Building2, ClipboardList } from 'lucide-react';

const ExternalTransferOut = () => {
    const [products, setProducts] = useState([]);
    const [search, setSearch] = useState('');
    const [selectedItems, setSelectedItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [warehouses, setWarehouses] = useState([]);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [exportSummary, setExportSummary] = useState(null);
    const [lastPackage, setLastPackage] = useState(null);
    const [sendingChat, setSendingChat] = useState(false);
    const [downloadingGuide, setDownloadingGuide] = useState(false);
    const [destinationCompany, setDestinationCompany] = useState('');
    const [destinationMode, setDestinationMode] = useState('org');
    const [orgCompanies, setOrgCompanies] = useState([]);
    const [loadingOrgCompanies, setLoadingOrgCompanies] = useState(false);
    const [selectedDestinationTenantId, setSelectedDestinationTenantId] = useState('');
    const [dispatchNotes, setDispatchNotes] = useState('');
    const [photos, setPhotos] = useState([]); // { file, preview, uploading, url }
    const [uploadingPhotos, setUploadingPhotos] = useState(false);
    const [imeiPicker, setImeiPicker] = useState({ openFor: null, instances: [], loading: false, query: '' });
    const fileInputRef = useRef(null);

    // Check if any item exceeds available stock
    const hasStockError = selectedItems.some(i => i.quantity > i.current_stock);
    const hasImeiError = selectedItems.some(i => i.has_imei && (i.selected_imeis?.length || 0) !== Number(i.quantity));
    const selectedWarehouse = warehouses.find(w => String(w.id) === String(selectedWarehouseId));
    const totalUnits = selectedItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const totalSerials = selectedItems.reduce((sum, item) => sum + (item.selected_imeis?.length || 0), 0);
    const photoCount = photos.length;
    const currentTenantSchema = window.location.hostname.split('.')[0];

    // Load warehouses on mount
    useEffect(() => {
        const fetchWarehouses = async () => {
            try {
                const response = await apiClient.get('/warehouses');
                const active = response.data.filter(w => w.is_active);
                setWarehouses(active);
                // Default to main or first
                const main = active.find(w => w.is_main);
                if (main) setSelectedWarehouseId(main.id);
                else if (active.length > 0) setSelectedWarehouseId(active[0].id);
            } catch (error) {
                console.error("Error loading warehouses:", error);
                toast.error("No se pudieron cargar los almacenes");
            }
        };
        fetchWarehouses();
    }, []);

    useEffect(() => {
        setSelectedItems(prev => prev.map(item => ({ ...item, selected_imeis: [] })));
        setImeiPicker({ openFor: null, instances: [], loading: false, query: '' });
    }, [selectedWarehouseId]);

    useEffect(() => {
        const fetchOrgCompanies = async () => {
            try {
                setLoadingOrgCompanies(true);
                const { data } = await apiClient.get('/organizations/mine');
                const companies = Array.isArray(data)
                    ? data.filter(company => company?.is_active !== false && company?.schema_name !== currentTenantSchema)
                    : [];
                setOrgCompanies(companies);
                if (companies.length === 0) {
                    setDestinationMode('free');
                }
            } catch (error) {
                console.info('No se pudieron cargar empresas de la organizacion para traslado externo', error);
                setOrgCompanies([]);
                setDestinationMode('free');
            } finally {
                setLoadingOrgCompanies(false);
            }
        };
        fetchOrgCompanies();
    }, []);

    const handleDestinationModeChange = (mode) => {
        setDestinationMode(mode);
        setSelectedDestinationTenantId('');
        setDestinationCompany('');
    };

    const handleOrgDestinationChange = (tenantId) => {
        setSelectedDestinationTenantId(tenantId);
        const selected = orgCompanies.find(company => String(company.tenant_id) === String(tenantId));
        setDestinationCompany(selected?.name || '');
    };

    // Initial Search Logic
    useEffect(() => {
        if (search.length > 2) {
            searchProducts();
        }
    }, [search]);

    const searchProducts = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get(`/products?search=${search}&limit=20`);
            setProducts(Array.isArray(response.data) ? response.data : (response.data?.items || []));
        } catch (error) {
            console.error("Error searching products:", error);
        } finally {
            setLoading(false);
        }
    };

    const addToTransfer = (product) => {
        if (!product.sku) {
            toast.error(`El producto "${product.name}" no tiene Código de Barras (SKU) y no se puede transferir.`);
            return;
        }
        if (selectedItems.find(i => i.product_id === product.id)) {
            toast('El producto ya está en la lista', { icon: 'info' });
            return;
        }
        setSelectedItems([...selectedItems, {
            product_id: product.id,
            name: product.name,
            sku: product.sku,
            current_stock: product.stock,
            quantity: 1,
            has_imei: !!product.has_imei,
            selected_imeis: []
        }]);
    };

    const updateQuantity = (id, qty) => {
        setSelectedItems(selectedItems.map(item =>
            item.product_id === id
                ? {
                    ...item,
                    quantity: parseFloat(qty) || 0,
                    selected_imeis: (item.selected_imeis || []).slice(0, parseFloat(qty) || 0)
                }
                : item
        ));
        // Reset confirmation when quantities change
        setShowConfirmation(false);
    };

    const removeItem = (id) => {
        setSelectedItems(selectedItems.filter(item => item.product_id !== id));
    };

    const openImeiPicker = async (itemIdx) => {
        const item = selectedItems[itemIdx];
        if (!item || !selectedWarehouseId) return;
        setImeiPicker({ openFor: itemIdx, instances: [], loading: true, query: '' });
        try {
            const { data } = await apiClient.get(`/inventory/product/${item.product_id}/instances`);
            const sourceId = Number(selectedWarehouseId);
            const filtered = (Array.isArray(data) ? data : []).filter(
                pi => Number(pi.warehouse_id) === sourceId && pi.status === 'AVAILABLE'
            );
            setImeiPicker(prev => ({ ...prev, instances: filtered, loading: false }));
        } catch (error) {
            console.error(error);
            toast.error('Error cargando IMEIs disponibles');
            setImeiPicker({ openFor: null, instances: [], loading: false, query: '' });
        }
    };

    const closeImeiPicker = () => setImeiPicker({ openFor: null, instances: [], loading: false, query: '' });

    const toggleImeiForItem = (itemIdx, instance) => {
        const next = [...selectedItems];
        const current = next[itemIdx].selected_imeis || [];
        const isSelected = current.some(s => s.id === instance.id);
        if (isSelected) {
            next[itemIdx].selected_imeis = current.filter(s => s.id !== instance.id);
        } else {
            if (current.length >= next[itemIdx].quantity) {
                return toast.error(`Ya seleccionaste ${current.length} IMEIs para cantidad ${next[itemIdx].quantity}`);
            }
            next[itemIdx].selected_imeis = [...current, { id: instance.id, serial_number: instance.serial_number }];
        }
        setSelectedItems(next);
    };

    const selectFirstN = (itemIdx, quantity) => {
        const next = [...selectedItems];
        next[itemIdx].selected_imeis = imeiPicker.instances
            .slice(0, quantity)
            .map(pi => ({ id: pi.id, serial_number: pi.serial_number }));
        setSelectedItems(next);
    };

    const scanImeiForItem = (itemIdx) => {
        const code = imeiPicker.query.trim().toUpperCase();
        if (!code) return;
        const instance = imeiPicker.instances.find(pi => (pi.serial_number || '').toUpperCase() === code);
        if (!instance) {
            toast.error('IMEI no disponible en el almacén origen');
            return;
        }
        toggleImeiForItem(itemIdx, instance);
        setImeiPicker(prev => ({ ...prev, query: '' }));
    };

    const handleAddPhotos = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const newPhotos = files.map(file => ({
            file,
            preview: URL.createObjectURL(file),
            uploading: false,
            url: null
        }));
        setPhotos(prev => [...prev, ...newPhotos]);
        // Reset input so same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removePhoto = (index) => {
        setPhotos(prev => {
            const updated = [...prev];
            URL.revokeObjectURL(updated[index].preview);
            updated.splice(index, 1);
            return updated;
        });
    };

    const uploadAllPhotos = async () => {
        const pendingPhotos = photos.filter(p => !p.url);
        if (pendingPhotos.length === 0) return photos.map(p => p.url);

        setUploadingPhotos(true);
        const updatedPhotos = [...photos];

        for (let i = 0; i < updatedPhotos.length; i++) {
            if (updatedPhotos[i].url) continue; // Already uploaded
            updatedPhotos[i].uploading = true;
            setPhotos([...updatedPhotos]);

            try {
                const formData = new FormData();
                formData.append('file', updatedPhotos[i].file);
                const res = await apiClient.post('/inventory/transfer/upload-photo', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                updatedPhotos[i].url = res.data.url;
                updatedPhotos[i].uploading = false;
            } catch (err) {
                console.error('Photo upload failed:', err);
                updatedPhotos[i].uploading = false;
                setPhotos([...updatedPhotos]);
                setUploadingPhotos(false);
                throw new Error('Error al subir foto de evidencia');
            }
        }

        setPhotos([...updatedPhotos]);
        setUploadingPhotos(false);
        return updatedPhotos.map(p => p.url);
    };


    const sendLastPackageToOrgChat = async () => {
        if (!lastPackage?.json) {
            toast.error('No hay paquete generado para enviar');
            return;
        }

        try {
            setSendingChat(true);
            const orgRes = await apiClient.get('/organizations/my-org');
            const organizations = Array.isArray(orgRes.data) ? orgRes.data : [];
            const org = organizations[0];
            if (!org?.id) {
                toast.error('Esta empresa no tiene organización vinculada para enviar el chat');
                return;
            }

            const file = new File([lastPackage.json], lastPackage.filename, { type: 'application/json' });
            const formData = new FormData();
            formData.append('message', `Paquete de traslado ${lastPackage.packageId || ''}: ${lastPackage.models} modelo${lastPackage.models !== 1 ? 's' : ''}, ${lastPackage.units} unidad${lastPackage.units !== 1 ? 'es' : ''}.`);
            formData.append('file', file);

            await apiClient.post(`/organizations/${org.id}/chat/messages`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success('Paquete enviado al chat empresarial');
        } catch (error) {
            console.error('Error enviando paquete al chat:', error);
            const msg = error.response?.data?.detail || 'No se pudo enviar el paquete al chat';
            toast.error(msg);
        } finally {
            setSendingChat(false);
        }
    };

    const downloadBlobFile = (blob, filename) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    };

    const downloadDispatchGuide = async (packageData = lastPackage?.packageData) => {
        if (!packageData) {
            toast.error('No hay paquete disponible para la guia');
            return;
        }
        try {
            setDownloadingGuide(true);
            const response = await apiClient.post('/inventory/transfer/dispatch-guide', {
                package: packageData,
                destination_company: destinationCompany.trim(),
                notes: dispatchNotes.trim(),
            }, { responseType: 'blob' });

            const disposition = response.headers?.['content-disposition'] || '';
            const match = disposition.match(/filename="?([^";]+)"?/i);
            const filename = match?.[1] || `guia-despacho-${packageData.dispatch_guide_number || packageData.package_id || 'traslado'}.pdf`;
            downloadBlobFile(response.data, filename);
            toast.success('Guia de despacho descargada');
        } catch (error) {
            console.error('Error descargando guia de despacho:', error);
            const msg = error.response?.data?.detail || 'No se pudo generar la guia de despacho';
            toast.error(msg);
        } finally {
            setDownloadingGuide(false);
        }
    };

    const handleExport = async () => {
        if (selectedItems.length === 0) return;
        if (!selectedWarehouseId) {
            toast.error("Seleccione un almacén de origen");
            return;
        }
        for (const item of selectedItems) {
            if (item.has_imei && (item.selected_imeis?.length || 0) !== Number(item.quantity)) {
                toast.error(`"${item.name}" maneja IMEI. Selecciona o escanea exactamente ${item.quantity} seriales.`);
                return;
            }
        }

        try {
            setGenerating(true);
            const loadingToast = toast.loading(
                photos.length > 0
                    ? "Subiendo fotos y generando paquete..."
                    : "Generando y descargando paquete..."
            );

            // Upload photos first (if any)
            let photoUrls = [];
            if (photos.length > 0) {
                try {
                    photoUrls = await uploadAllPhotos();
                } catch (err) {
                    toast.dismiss(loadingToast);
                    toast.error(err.message);
                    setGenerating(false);
                    return;
                }
            }

            // Call API to generate package (and deduct stock)
            const payload = {
                source_company: "Ferreteria Principal", // TODO: Make configurable or dynamic
                warehouse_id: parseInt(selectedWarehouseId),
                destination_company: destinationCompany.trim() || null,
                dispatch_notes: dispatchNotes.trim() || null,
                items: selectedItems.map(item => ({
                    product_id: item.product_id,
                    quantity: item.quantity,
                    serial_numbers: item.selected_imeis?.map(i => i.serial_number) || [],
                    instances: item.selected_imeis?.map(i => ({ product_instance_id: i.id })) || []
                })),
                photo_urls: photoUrls
            };

            const response = await apiClient.post('/inventory/transfer/export', payload);

            // Create download
            const packageFilename = `TRANSFER_${new Date().toISOString().slice(0, 10)}.json`;
            const packageJson = JSON.stringify(response.data, null, 2);
            const blob = new Blob([packageJson], { type: 'application/json;charset=utf-8' });
            downloadBlobFile(blob, packageFilename);

            const summary = response.data || {};
            const modelsCount = summary.models_count ?? summary.items_count ?? selectedItems.length;
            const unitsCount = summary.units_count ?? totalUnits;
            const serialsCount = summary.imei_count ?? totalSerials;
            const photosCount = summary.photos_count ?? photoUrls.length;

            toast.dismiss(loadingToast);
            toast.success(`Paquete generado: ${modelsCount} modelo${modelsCount !== 1 ? 's' : ''}, ${unitsCount} unidad${unitsCount !== 1 ? 'es' : ''}.`);
            setExportSummary({
                packageId: summary.package_id,
                models: modelsCount,
                units: unitsCount,
                serials: serialsCount,
                photos: photosCount,
                warehouse: summary.source_warehouse_name || selectedWarehouse?.name || 'almacén origen',
                destination: summary.destination_company || destinationCompany.trim() || 'Destino por definir',
                guideNumber: summary.dispatch_guide_number,
                items: selectedItems.map(i => ({ sku: i.sku, name: i.name, quantity: i.quantity, serials: i.selected_imeis?.length || 0 }))
            });
            setLastPackage({
                filename: packageFilename,
                json: packageJson,
                models: modelsCount,
                units: unitsCount,
                serials: serialsCount,
                packageId: summary.package_id,
                guideNumber: summary.dispatch_guide_number,
                packageData: summary,
            });
            setSelectedItems([]);
            setImeiPicker({ openFor: null, instances: [], loading: false, query: '' });
            setShowConfirmation(false);
            setSearch('');
            setProducts([]);
            // Cleanup photo previews
            photos.forEach(p => URL.revokeObjectURL(p.preview));
            setPhotos([]);

        } catch (error) {
            console.error("Export failed:", error);
            const msg = error.response?.data?.detail || "Error al generar paquete";
            toast.error(msg);
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="grid grid-cols-1 gap-2 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.85fr)]">
            {/* Left Panel: Search */}
            <div className="flex min-h-[520px] flex-col rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <h2 className="text-base font-black text-slate-800 mb-2 flex items-center gap-2">
                    <Search className="text-indigo-600" />
                    Buscar Productos
                </h2>

                {/* Warehouse Selector */}
                <div className="mb-2 bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Almacen de origen</label>
                    <select
                        value={selectedWarehouseId}
                        onChange={(e) => setSelectedWarehouseId(e.target.value)}
                        className="w-full border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:ring-indigo-500"
                    >
                        {warehouses.map(w => (
                            <option key={w.id} value={w.id}>{w.name} {w.is_main ? '(Principal)' : ''}</option>
                        ))}
                    </select>
                </div>

                <div className="mb-2 grid gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 shadow-sm">
                    <div>
                        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-indigo-700">
                                <Building2 size={13} />
                                Empresa destino
                            </label>
                            <div className="inline-flex rounded-lg border border-indigo-100 bg-white p-1 text-[11px] font-black uppercase text-slate-500">
                                <button
                                    type="button"
                                    onClick={() => handleDestinationModeChange('org')}
                                    disabled={orgCompanies.length === 0}
                                    className={`rounded-md px-2.5 py-1 transition-colors ${destinationMode === 'org' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'}`}
                                >
                                    Organizacion
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDestinationModeChange('free')}
                                    className={`rounded-md px-2.5 py-1 transition-colors ${destinationMode === 'free' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-50'}`}
                                >
                                    Libre
                                </button>
                            </div>
                        </div>

                        {destinationMode === 'org' && orgCompanies.length > 0 ? (
                            <select
                                value={selectedDestinationTenantId}
                                onChange={(e) => handleOrgDestinationChange(e.target.value)}
                                className="w-full rounded-lg border border-indigo-100 bg-white px-2.5 py-2 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                            >
                                <option value="">Selecciona una empresa de la organizacion...</option>
                                {orgCompanies.map(company => (
                                    <option key={company.tenant_id || company.schema_name || company.name} value={company.tenant_id}>
                                        {company.name} {company.schema_name ? `(${company.schema_name})` : ''}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <input
                                type="text"
                                value={destinationCompany}
                                onChange={(e) => setDestinationCompany(e.target.value)}
                                placeholder={loadingOrgCompanies ? 'Cargando empresas...' : 'Ej: Colaloca 2, sucursal centro...'}
                                className="w-full rounded-lg border border-indigo-100 bg-white px-2.5 py-2 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                            />
                        )}

                        {destinationMode === 'org' && orgCompanies.length === 0 && !loadingOrgCompanies && (
                            <p className="mt-1 text-[11px] font-semibold text-indigo-500">No hay empresas vinculadas disponibles; usa destino libre.</p>
                        )}
                    </div>
                    <div>
                        <label className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase text-indigo-700">
                            <ClipboardList size={13} />
                            Nota de despacho
                        </label>
                        <textarea
                            value={dispatchNotes}
                            onChange={(e) => setDispatchNotes(e.target.value)}
                            placeholder="Transportista, observaciones, responsable que recibe..."
                            rows={2}
                            className="w-full resize-none rounded-lg border border-indigo-100 bg-white px-2.5 py-2 text-sm text-slate-700 outline-none transition-all focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                        />
                    </div>
                </div>

                <div className="relative mb-6">
                    <input
                        type="text"
                        placeholder="Buscar por nombre o código..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border-none shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-600"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                    />
                    <Search className="absolute left-3 top-3.5 text-slate-400" size={20} />
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                    {loading && <div className="text-center py-4 text-slate-400">Buscando...</div>}

                    {products.map(product => (
                        <div
                            key={product.id}
                            onClick={() => addToTransfer(product)}
                            className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-slate-700 group-hover:text-indigo-700 transition-colors">
                                        {product.name}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1 text-sm">
                                        <span className={`px-2 py-0.5 rounded-lg font-mono text-xs ${product.sku ? 'bg-slate-100 text-slate-600' : 'bg-red-50 text-red-600'}`}>
                                            {product.sku || 'SIN SKU'}
                                        </span>
                                        <span className="text-slate-500">
                                            Stock Global: <span className="font-bold text-slate-700">{product.stock}</span>
                                        </span>
                                    </div>
                                </div>
                                <div className="bg-slate-50 p-2 rounded-lg group-hover:bg-indigo-50 transition-colors">
                                    <ArrowRight size={20} className="text-slate-400 group-hover:text-indigo-600" />
                                </div>
                            </div>
                        </div>
                    ))}

                    {!loading && products.length === 0 && search.length > 2 && (
                        <div className="text-center py-8 text-slate-400">
                            No se encontraron productos
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel: Transfer List */}
            <div className="flex min-h-[520px] flex-col rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <h2 className="text-base font-black text-slate-800 mb-2 flex items-center gap-2">
                    <Package className="text-emerald-600" />
                    Paquete de salida
                </h2>

                <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                        <p className="text-[10px] font-bold uppercase text-slate-400">Modelos</p>
                        <p className="text-base font-black text-slate-800">{selectedItems.length}</p>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2">
                        <p className="text-[10px] font-bold uppercase text-emerald-600">Unidades</p>
                        <p className="text-base font-black text-emerald-700">{totalUnits}</p>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2">
                        <p className="text-[10px] font-bold uppercase text-amber-600">Seriales</p>
                        <p className="text-base font-black text-amber-700">{totalSerials}</p>
                    </div>
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-2">
                        <p className="text-[10px] font-bold uppercase text-indigo-600">Fotos</p>
                        <p className="text-base font-black text-indigo-700">{photoCount}</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto mb-2 border border-slate-100 rounded-xl bg-slate-50 p-4">
                    {selectedItems.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 opacity-60">
                            <Download size={48} />
                            <p>Agrega productos para generar el archivo</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {selectedItems.map(item => (
                                <div key={item.product_id} className="bg-white p-3 rounded-lg shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                        <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                            {item.name}
                                            {item.has_imei && <span className="text-[10px] uppercase font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">IMEI</span>}
                                        </h4>
                                        <p className="text-xs text-slate-400 font-mono">{item.sku}</p>
                                        <p className={`text-xs mt-0.5 ${item.quantity > item.current_stock ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                                            Stock: {item.current_stock}
                                            {item.quantity > item.current_stock && (
                                                <span className="ml-1">Excede el stock disponible</span>
                                            )}
                                        </p>
                                    </div>

                                    {item.has_imei && (
                                        <button
                                            type="button"
                                            onClick={() => imeiPicker.openFor === selectedItems.indexOf(item) ? closeImeiPicker() : openImeiPicker(selectedItems.indexOf(item))}
                                            className={`text-xs font-bold px-2.5 py-2 rounded-lg border transition-colors flex items-center gap-1.5 ${
                                                (item.selected_imeis?.length || 0) > 0
                                                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                                                    : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300 hover:text-amber-700'
                                            }`}
                                        >
                                            <Zap size={13} />
                                            {(item.selected_imeis?.length || 0) > 0 ? `${item.selected_imeis.length} IMEI${item.selected_imeis.length > 1 ? 's' : ''}` : 'IMEIs'}
                                        </button>
                                    )}

                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-400 font-bold uppercase">Cant:</span>
                                        <input
                                            type="number"
                                            className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-right font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                                            value={item.quantity}
                                            onChange={(e) => updateQuantity(item.product_id, e.target.value)}
                                            min="0"
                                        />
                                    </div>

                                    <button
                                        onClick={() => removeItem(item.product_id)}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                    </div>

                                    {item.has_imei && imeiPicker.openFor === selectedItems.indexOf(item) && (
                                        <div className="mt-3 border-t border-slate-100 pt-3">
                                            {imeiPicker.loading ? (
                                                <div className="text-xs text-slate-400 py-3 text-center">Cargando IMEIs disponibles...</div>
                                            ) : imeiPicker.instances.length === 0 ? (
                                                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                                    No hay IMEIs disponibles de este producto en el almacén origen.
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            value={imeiPicker.query}
                                                            onChange={(e) => setImeiPicker(prev => ({ ...prev, query: e.target.value }))}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    scanImeiForItem(selectedItems.indexOf(item));
                                                                }
                                                            }}
                                                            placeholder="Escanea o escribe el IMEI..."
                                                            className="flex-1 px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-amber-300 outline-none"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => scanImeiForItem(selectedItems.indexOf(item))}
                                                            className="px-2.5 py-2 bg-amber-500 text-white rounded-lg text-xs font-bold"
                                                        >
                                                            Agregar
                                                        </button>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs text-slate-600">
                                                        <span><b>{imeiPicker.instances.length}</b> disponibles - <b>{item.selected_imeis?.length || 0}/{item.quantity}</b> seleccionados</span>
                                                        {(item.selected_imeis?.length || 0) < item.quantity && imeiPicker.instances.length >= item.quantity && (
                                                            <button type="button" onClick={() => selectFirstN(selectedItems.indexOf(item), item.quantity)} className="font-bold text-indigo-600">
                                                                Auto-seleccionar {item.quantity}
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-1 max-h-28 overflow-y-auto">
                                                        {imeiPicker.instances.map(pi => {
                                                            const isSelected = item.selected_imeis?.some(s => s.id === pi.id);
                                                            return (
                                                                <button
                                                                    key={pi.id}
                                                                    type="button"
                                                                    onClick={() => toggleImeiForItem(selectedItems.indexOf(item), pi)}
                                                                    className={`text-left p-2 rounded-lg border text-xs font-mono flex items-center gap-2 ${
                                                                        isSelected ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'
                                                                    }`}
                                                                >
                                                                    <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${isSelected ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-300'}`}>
                                                                        {isSelected && <CheckCircle size={10} />}
                                                                    </span>
                                                                    <span className="flex-1 truncate">{pi.serial_number}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Photo Evidence Section */}
                <div className="mb-2">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-slate-600 flex items-center gap-2">
                            <Camera size={16} className="text-indigo-500" />
                            Evidencia fotográfica
                        </h3>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                        >
                            <Camera size={14} />
                            Agregar Fotos
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            capture="environment"
                            onChange={handleAddPhotos}
                            className="hidden"
                        />
                    </div>

                    {photos.length === 0 ? (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-slate-200 rounded-xl p-3 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
                        >
                            <ImageIcon size={24} className="mx-auto text-slate-300 mb-1" />
                            <p className="text-xs text-slate-400">Agregar fotos opcionales</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-4 gap-2">
                            {photos.map((photo, idx) => (
                                <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                                    <img
                                        src={photo.preview}
                                        alt={`Evidencia ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                    {photo.uploading && (
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    )}
                                    {photo.url && (
                                        <div className="absolute top-1 left-1 bg-emerald-500 rounded-full p-0.5">
                                            <CheckCircle size={12} className="text-white" />
                                        </div>
                                    )}
                                    <button
                                        onClick={() => removePhoto(idx)}
                                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                            {/* Add more button */}
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="aspect-square rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
                            >
                                <Camera size={20} className="text-slate-300" />
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-auto pt-4 border-t border-slate-100">
                    {/* Success banner after export */}
                    {exportSummary && (
                        <div className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                            <div className="flex items-start gap-2">
                                <CheckCircle className="mt-0.5 flex-shrink-0 text-emerald-600" size={20} />
                                <div className="min-w-0 flex-1">
                                    <p className="font-bold">Paquete generado y stock descontado.</p>
                                    <p className="mt-0.5 text-emerald-700">
                                        {exportSummary.models} modelo{exportSummary.models !== 1 ? 's' : ''}, {exportSummary.units} unidad{exportSummary.units !== 1 ? 'es' : ''} desde {exportSummary.warehouse} hacia {exportSummary.destination}.
                                    </p>
                                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                                        <span className="rounded-md bg-white/70 px-2 py-1 font-bold text-emerald-800">Seriales: {exportSummary.serials}</span>
                                        <span className="rounded-md bg-white/70 px-2 py-1 font-bold text-emerald-800">Fotos: {exportSummary.photos}</span>
                                        <span className="truncate rounded-md bg-white/70 px-2 py-1 font-mono text-[11px] text-emerald-700">{exportSummary.guideNumber || 'Guia lista'}</span>
                                        <span className="truncate rounded-md bg-white/70 px-2 py-1 font-mono text-[11px] text-emerald-700">{exportSummary.packageId || 'JSON listo'}</span>
                                    </div>
                                </div>
                                <div className="flex shrink-0 flex-col gap-2">
                                    <button
                                        type="button"
                                        onClick={() => downloadDispatchGuide()}
                                        disabled={downloadingGuide || !lastPackage}
                                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-2 text-xs font-black text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-60"
                                    >
                                        {downloadingGuide ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                                        PDF guia
                                    </button>
                                    <button
                                        type="button"
                                        onClick={sendLastPackageToOrgChat}
                                        disabled={sendingChat || !lastPackage}
                                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-2 text-xs font-black text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
                                    >
                                        {sendingChat ? <Loader2 size={14} className="animate-spin" /> : <MessageSquareShare size={14} />}
                                        Enviar al chat
                                    </button>
                                    <button onClick={() => setExportSummary(null)} className="text-xs font-bold text-emerald-700 hover:text-emerald-900">
                                        Cerrar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Stock error warning */}
                    {hasStockError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-2 flex gap-2 text-sm text-red-700">
                            <AlertTriangle className="flex-shrink-0 text-red-500" size={20} />
                            <p>
                                Hay cantidades superiores al stock disponible.
                            </p>
                        </div>
                    )}

                    {hasImeiError && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2 flex gap-2 text-sm text-amber-800">
                            <AlertTriangle className="flex-shrink-0" size={20} />
                            <p>Faltan IMEI por seleccionar.</p>
                        </div>
                    )}

                    <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        <div className="flex gap-2">
                            <AlertTriangle className="flex-shrink-0" size={20} />
                            <p>
                                Al generar el paquete, se descontarán <strong>{totalUnits}</strong> unidad{totalUnits !== 1 ? 'es' : ''} de <strong>{selectedItems.length}</strong> modelo{selectedItems.length !== 1 ? 's' : ''} desde {selectedWarehouse?.name || 'sin almacén'}.
                            </p>
                        </div>
                    </div>

                    {/* Confirmation step */}
                    {showConfirmation && (
                        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-2">
                            <p className="font-bold text-amber-800 text-sm mb-2 flex items-center gap-2">
                                <AlertTriangle size={16} />
                                Confirma el paquete de salida
                            </p>
                            <div className="mb-2 grid grid-cols-4 gap-2 text-center text-xs">
                                <div className="rounded-lg bg-white/70 px-2 py-2"><b className="block text-base text-slate-900">{selectedItems.length}</b>Modelos</div>
                                <div className="rounded-lg bg-white/70 px-2 py-2"><b className="block text-base text-slate-900">{totalUnits}</b>Unidades</div>
                                <div className="rounded-lg bg-white/70 px-2 py-2"><b className="block text-base text-slate-900">{totalSerials}</b>Seriales</div>
                                <div className="rounded-lg bg-white/70 px-2 py-2"><b className="block text-base text-slate-900">{photoCount}</b>Fotos</div>
                            </div>
                            <div className="mb-2 rounded-lg bg-white/70 px-2.5 py-2 text-sm text-amber-900">
                                <span className="font-bold">Destino:</span> {destinationCompany.trim() || 'Destino por definir'}
                            </div>
                            <ul className="mb-2 ml-1 space-y-1 text-sm text-amber-900">
                                {selectedItems.map(item => (
                                    <li key={item.product_id}>
                                        <span className="font-mono text-xs">{item.sku}</span> {item.name} - <strong>{item.quantity}</strong> unidades
                                    </li>
                                ))}
                            </ul>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowConfirmation(false)}
                                    className="flex-1 py-2 px-4 rounded-lg border border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-100 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleExport}
                                    disabled={generating}
                                    className="flex-1 py-2 px-4 rounded-lg bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {generating ? (
                                        <span className="animate-pulse">Procesando...</span>
                                    ) : (
                                        <>
                                            <CheckCircle size={16} />
                                            Confirmar y generar
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => { setShowConfirmation(true); setExportSummary(null); setLastPackage(null); }}
                        disabled={selectedItems.length === 0 || generating || !selectedWarehouseId || hasStockError || hasImeiError || showConfirmation}
                        className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <Download size={20} />
                        Generar paquete
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExternalTransferOut;
