import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfig } from '../../context/ConfigContext';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import {
    Barcode, Loader2, Trash2, Save, X, Search, ExternalLink,
    Smartphone, AlertCircle, CheckCircle2, Zap, ArrowLeft, Receipt
} from 'lucide-react';

const IMEI_API_KEY = '7c1c33d3-0604-43b8-b09e-41226ee7eacd';
const IMEI_SERVICE_ID = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const normalizar = (s = '') => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[+/\-_,;:.!?@#$%&*()]/g, ' ').replace(/\s+/g, ' ').trim();

const fuzzyMatch = (text, query) => {
    const t = normalizar(text);
    const q = normalizar(query);
    if (!q) return true;
    if (t.includes(q)) return true;
    if (q.length <= 2) return false;
    const words = q.split(/\s+/).filter(Boolean);
    if (words.every(w => t.includes(w))) return true;
    for (const word of words) {
        if (word.length < 3) continue;
        for (let i = 0; i <= t.length - word.length + 2; i++) {
            const slice = t.slice(i, i + word.length);
            let diff = 0;
            const minLen = Math.min(slice.length, word.length);
            for (let j = 0; j < minLen; j++) { if (slice[j] !== word[j]) diff++; }
            diff += Math.abs(slice.length - word.length);
            if (diff <= (word.length <= 4 ? 1 : 2)) return true;
        }
    }
    return false;
};

// ─── Modal de selección de producto ──────────────────────────────────────────
const ProductPickerModal = ({ detected, catalog, imei, onSelect, onClose }) => {
    const [search, setSearch] = useState('');
    const searchRef = useRef(null);

    useEffect(() => { setTimeout(() => searchRef.current?.focus(), 100); }, []);

    // Filtrar en 3 niveles: marca+modelo → solo marca → todos
    const getAutoFiltered = () => {
        // La API Basic puede devolver código interno (2510DRA23L, SM-A065M) en vez de nombre legible
        // Detectar si el modelo es código técnico → ignorarlo, usar solo marca
        const rawModel = detected?.model || '';
        const looksLikeCode = /^[a-zA-Z]{0,4}\d{3,}[a-zA-Z0-9]*$/.test(rawModel.replace(/[\s\-]/g, ''));
        const modelToUse = looksLikeCode ? '' : rawModel;

        // Aliases: la marca de la API puede diferir del nombre en el catálogo
        const BRAND_ALIASES = {
            apple:   ['iphone', 'apple', 'ipad'],
            xiaomi:  ['xiaomi', 'redmi', 'poco'],
            samsung: ['samsung', 'galaxy'],
            huawei:  ['huawei', 'honor'],
            tecno:   ['tecno'],
            itel:    ['itel'],
            infinix: ['infinix'],
        };
        const rawBrand = normalizar(detected?.brand || '');
        const brandAliases = BRAND_ALIASES[rawBrand] || [rawBrand];
        const hasBrand = (n) => brandAliases.some(a => a && n.includes(a));

        // Palabras útiles del modelo (sin genéricas ni números solos)
        const GENERIC = ['galaxy','note','smart','pro','plus','max','mini','lite','ultra','prime','se'];
        const modelWords = normalizar(modelToUse).replace(/[+/\-_]/g,' ').split(/\s+/)
            .filter(w => w.length >= 2 && !GENERIC.includes(w) && !/^\d+$/.test(w));

        // Nivel 1: marca + todas las palabras del modelo legible
        if (rawBrand && modelWords.length > 0) {
            const exact = catalog.filter(p => {
                const n = normalizar(p.name);
                return hasBrand(n) && modelWords.every(w => n.includes(w));
            });
            if (exact.length > 0) return exact;
        }

        // Nivel 2: marca + alguna palabra clave del modelo
        if (rawBrand && modelWords.length > 0) {
            const partial = catalog.filter(p => {
                const n = normalizar(p.name);
                return hasBrand(n) && modelWords.some(w => n.includes(w));
            });
            if (partial.length > 0) return partial;
        }

        // Nivel 3: SOLO MARCA — funciona aunque el modelo sea código interno
        if (rawBrand) {
            const byBrand = catalog.filter(p => hasBrand(normalizar(p.name)));
            if (byBrand.length > 0) return byBrand;
        }

        // Nivel 4: fallback — todo el catálogo
        return catalog;
    };

    const all = search
        ? catalog.filter(p => fuzzyMatch(p.name, search) || (p.sku && fuzzyMatch(p.sku, search)))
        : getAutoFiltered();

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 px-6 py-5 text-white">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Smartphone size={18} className="text-indigo-200" />
                            <span className="text-xs font-black uppercase tracking-widest text-indigo-200">IMEI detectado</span>
                        </div>
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-xl transition-all">
                            <X size={16} />
                        </button>
                    </div>
                    <p className="font-mono text-lg font-bold tracking-wider">{imei}</p>
                    {detected?.brand && (
                        <div className="mt-2 flex items-center gap-2">
                            <span className="bg-white/20 text-white text-xs font-black px-2.5 py-1 rounded-full">
                                {detected.brand}
                            </span>
                            {detected.model && (
                                <span className="bg-white/20 text-white text-xs font-black px-2.5 py-1 rounded-full">
                                    {detected.model}
                                </span>
                            )}
                            <span className="text-indigo-300 text-[10px] font-bold">vía IMEI.info</span>
                        </div>
                    )}
                </div>

                {/* Body */}
                <div className="p-4">
                    <p className="text-sm font-bold text-slate-600 mb-3">
                        ¿A cuál producto corresponde este equipo?
                    </p>

                    {/* Buscador */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 mb-3">
                        <Search size={15} className="text-slate-400 shrink-0" />
                        <input
                            ref={searchRef}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar producto..."
                            className="flex-1 bg-transparent text-sm outline-none text-slate-700 placeholder:text-slate-400"
                        />
                        {search && <button onClick={() => setSearch('')}><X size={13} className="text-slate-400" /></button>}
                    </div>

                    {/* Lista de productos */}
                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                        {all.length === 0 ? (
                            <div className="text-center py-8 text-slate-400">
                                <Smartphone size={32} className="mx-auto mb-2 opacity-30" />
                                <p className="text-xs font-bold">Sin productos encontrados</p>
                            </div>
                        ) : all.map(p => (
                            <button
                                key={p.id}
                                onClick={() => onSelect(p)}
                                className="w-full flex items-center gap-3 p-3 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-400 rounded-2xl text-left transition-all group"
                            >
                                <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center shrink-0 group-hover:border-indigo-300 transition-colors">
                                    <Smartphone size={18} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black text-slate-800 truncate group-hover:text-indigo-700 transition-colors">{p.name}</p>
                                    {p.sku && <p className="text-[10px] text-slate-400 font-mono">{p.sku}</p>}
                                    <p className="text-[10px] text-emerald-600 font-bold mt-0.5">{p.stock} en stock</p>
                                </div>
                                <CheckCircle2 size={16} className="text-slate-200 group-hover:text-indigo-500 transition-colors shrink-0" />
                            </button>
                        ))}
                    </div>

                    {/* Crear nuevo */}
                    <div className="mt-3 pt-3 border-t border-slate-100">
                        <a
                            href={`#/products/new?name=${encodeURIComponent(detected?.model ? `${detected.brand} ${detected.model}` : '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full py-2.5 border-2 border-dashed border-slate-200 hover:border-indigo-400 text-slate-500 hover:text-indigo-600 rounded-2xl text-xs font-black transition-all"
                        >
                            <ExternalLink size={13} />
                            El producto no existe — Crear nuevo
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Item del carrito ─────────────────────────────────────────────────────────
const CartGroup = ({ group, onRemoveImei, onClickGroup }) => {
    const isUnmatched = !group.productId;

    return (
        <div className={`bg-white rounded-2xl border-2 overflow-hidden transition-all ${isUnmatched ? 'border-amber-300' : 'border-slate-200'}`}>
            {/* Header */}
            <button
                onClick={() => isUnmatched && onClickGroup(group)}
                className={`w-full flex items-center gap-3 px-4 py-3 border-b border-slate-100 ${isUnmatched ? 'bg-amber-50/50 cursor-pointer hover:bg-amber-50' : 'bg-slate-50/50 cursor-default'} transition-colors`}
            >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isUnmatched ? 'bg-amber-100' : 'bg-indigo-100'}`}>
                    {isUnmatched
                        ? <AlertCircle size={18} className="text-amber-600" />
                        : <Smartphone size={18} className="text-indigo-600" />
                    }
                </div>
                <div className="flex-1 min-w-0 text-left">
                    <p className={`text-sm font-black truncate ${isUnmatched ? 'text-amber-700' : 'text-slate-800'}`}>
                        {isUnmatched
                            ? (group.detectedName ? `📱 ${group.detectedName}` : 'Sin identificar')
                            : group.productName
                        }
                    </p>
                    <p className="text-[10px] mt-0.5 font-mono">
                        {isUnmatched
                            ? <span className="text-amber-500 font-bold">⚠️ Toca para asignar producto</span>
                            : <span className="text-slate-400">Stock actualizado al guardar</span>
                        }
                    </p>
                </div>
                <span className="shrink-0 text-[11px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                    {group.imeis.length} IMEI{group.imeis.length !== 1 ? 's' : ''}
                </span>
            </button>

            {/* IMEIs */}
            <div className="px-4 py-2 space-y-1">
                {group.imeis.map(item => (
                    <div key={item.imei} className="flex items-center gap-2 py-1">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${isUnmatched ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                        <span className="flex-1 font-mono text-xs text-slate-700">{item.imei}</span>
                        <button onClick={() => onRemoveImei(group.groupId, item.imei)}
                            className="text-slate-300 hover:text-rose-500 transition-colors shrink-0">
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── Componente principal ─────────────────────────────────────────────────────
const SerializedReception = () => {
    const navigate = useNavigate();
    const [catalog, setCatalog] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [groups, setGroups] = useState([]);
    const [imeiInput, setImeiInput] = useState('');
    const [scanning, setScanning] = useState(false);

    // Modal de selección
    const [pickerData, setPickerData] = useState(null); // { imei, detected, groupId }

    const inputRef = useRef(null);

    useEffect(() => {
        const load = async () => {
            try {
                const [pRes, wRes] = await Promise.all([
                    apiClient.get('/products/', { params: { limit: 2000, has_imei: true } }),
                    apiClient.get('/warehouses'),
                ]);
                const products = (Array.isArray(pRes.data) ? pRes.data : (pRes.data?.items || [])).filter(p => p.has_imei);
                setCatalog(products);
                const whs = Array.isArray(wRes.data) ? wRes.data : [];
                setWarehouses(whs);
                if (whs.length > 0) setSelectedWarehouseId(whs[0].id);
            } catch { toast.error('Error cargando datos'); }
            finally { setIsLoading(false); }
        };
        load();
    }, []);

    const allImeis = groups.flatMap(g => g.imeis.map(i => i.imei));

    // Buscar coincidencias en catálogo — filtra por marca Y modelo
    const findMatches = useCallback((brand = '', model = '') => {
        if (!model && !brand) return [];
        const b = normalizar(brand);
        const modelWords = normalizar(model).split(/\s+/).filter(w => w.length >= 2);
        if (modelWords.length === 0) return [];

        return catalog.filter(p => {
            const pName = normalizar(p.name);
            // Rechazar accesorios
            const ACCESORIOS = ['forro','cargador','cable','auricular','audifonos','case',
                'protector','mica','vidrio','templado','soporte','bateria','tapa','cover',
                'estuche','correa','adaptador','repuesto','pantalla'];
            const firstWord = pName.split(' ')[0] || '';
            if (ACCESORIOS.includes(firstWord)) return false;

            // Todas las palabras del modelo deben estar en el nombre
            if (!modelWords.every(w => pName.includes(w))) return false;

            // Si la marca también está → match válido (más estricto)
            if (b && pName.includes(b)) return true;

            // Modelo con ≥2 palabras y todas coinciden → válido
            if (modelWords.length >= 2) return true;

            // Modelo alfanumérico (A100C, Hot60i) → válido
            if (/[a-z]\d|\d[a-z]/i.test(model)) return true;

            return false;
        });
    }, [catalog]);

    const addImei = useCallback(async () => {
        const imei = imeiInput.trim().toUpperCase();
        if (!imei) return;
        if (allImeis.includes(imei)) {
            toast.error('Este IMEI ya está en la lista', { id: 'imei-dup' });
            setImeiInput('');
            return;
        }

        // Validar en BD
        try {
            const res = await apiClient.get(`/inventory/validate-entry?imei=${imei}`);
            if (res.data?.exists) {
                toast.error(res.data.message || 'IMEI ya existe en inventario');
                setImeiInput('');
                return;
            }
        } catch { /* fail open */ }

        setImeiInput('');
        setScanning(true);
        toast.loading('Consultando IMEI.info...', { id: 'imei-api' });

        let brand = '', model = '', detected = null;
        try {
            const apiRes = await fetch(
                `https://dash.imei.info/api/check/${IMEI_SERVICE_ID}/?API_KEY=${IMEI_API_KEY}&imei=${imei}`
            );
            const data = await apiRes.json();
            if (data?.result) {
                brand = data.result.brand_name || '';
                model = data.result.model || '';
                detected = { brand, model };
            }
        } catch { /* sin API, continúa */ }

        toast.dismiss('imei-api');
        setScanning(false);

        const imeiItem = { imei };
        const matches = findMatches(brand, model);

        if (matches.length === 1) {
            // Match único → agregar directo
            const product = matches[0];
            const groupKey = `product-${product.id}`;
            setGroups(prev => {
                const exists = prev.find(g => g.groupId === groupKey);
                if (exists) return prev.map(g => g.groupId === groupKey ? { ...g, imeis: [...g.imeis, imeiItem] } : g);
                return [...prev, { groupId: groupKey, productId: product.id, productName: product.name, detectedName: `${brand} ${model}`.trim(), imeis: [imeiItem] }];
            });
            toast.success(`✅ ${product.name}`, { id: 'imei-scan', duration: 1500 });
        } else {
            // 0 o múltiples matches → abrir modal
            const groupId = `unmatched-${imei}`;
            setGroups(prev => [...prev, {
                groupId,
                productId: null,
                productName: null,
                detectedName: model ? `${brand} ${model}`.trim() : null,
                imeis: [imeiItem],
            }]);
            // Abrir modal de selección
            setPickerData({ imei, detected, groupId });
            if (matches.length > 1) {
                toast(`Múltiples versiones detectadas — elige cuál`, { icon: '📱', duration: 2000 });
            }
        }

        setTimeout(() => inputRef.current?.focus(), 50);
    }, [imeiInput, allImeis, findMatches]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addImei(); }
    };

    // Al seleccionar producto en el modal
    const handlePickerSelect = (product) => {
        const { groupId } = pickerData;
        const newKey = `product-${product.id}`;

        setGroups(prev => {
            // Buscar si ya existe un grupo para ese producto
            const existingGroup = prev.find(g => g.groupId === newKey);
            if (existingGroup) {
                // Fusionar: agregar IMEIs del grupo sin asignar al grupo existente
                const sourceGroup = prev.find(g => g.groupId === groupId);
                return prev
                    .filter(g => g.groupId !== groupId)
                    .map(g => g.groupId === newKey
                        ? { ...g, imeis: [...g.imeis, ...(sourceGroup?.imeis || [])] }
                        : g
                    );
            }
            // Convertir el grupo unmatched en uno con producto asignado
            return prev.map(g => g.groupId === groupId
                ? { ...g, groupId: newKey, productId: product.id, productName: product.name }
                : g
            );
        });

        setPickerData(null);
        toast.success(`✅ Asignado a: ${product.name}`, { duration: 1500 });
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const handleClickGroup = (group) => {
        setPickerData({
            imei: group.imeis[0]?.imei || '',
            detected: group.detectedName ? { brand: '', model: group.detectedName } : null,
            groupId: group.groupId,
        });
    };

    const removeImei = (groupId, imei) => {
        setGroups(prev => prev.map(g => {
            if (g.groupId !== groupId) return g;
            const newImeis = g.imeis.filter(i => i.imei !== imei);
            return newImeis.length > 0 ? { ...g, imeis: newImeis } : null;
        }).filter(Boolean));
    };

    const clearAll = () => {
        if (!confirm('¿Limpiar todo el carrito?')) return;
        setGroups([]);
    };

    const totalImeis = groups.reduce((s, g) => s + g.imeis.length, 0);
    const unmatchedGroups = groups.filter(g => !g.productId);
    const canSave = totalImeis > 0 && unmatchedGroups.length === 0 && selectedWarehouseId;

    const handleSave = async () => {
        if (!canSave) return;
        setIsSaving(true);
        const toastId = toast.loading('Procesando ingreso...');
        try {
            await Promise.all(groups.map(g =>
                apiClient.post('/inventory/bulk-entry', {
                    product_id: g.productId,
                    warehouse_id: parseInt(selectedWarehouseId),
                    imeis: g.imeis.map(i => i.imei),
                    cost: 0,
                })
            ));
            toast.dismiss(toastId);
            toast.success(`✅ ${totalImeis} IMEI(s) ingresados`);
            setGroups([]);
        } catch (err) {
            toast.dismiss(toastId);
            toast.error(err.response?.data?.detail || 'Error al procesar');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-indigo-600" size={48} /></div>;
    }

    return (
        <div id="tour-serialized-reception" className="h-full bg-slate-50 flex flex-col overflow-hidden">

            <div className="mx-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 shadow-sm">
                <div className="flex items-start gap-3">
                    <Receipt size={18} className="mt-0.5 shrink-0" />
                    <div>
                        <p className="text-sm font-black">Usa esta pantalla solo para recepciones sin factura de compra.</p>
                        <p className="mt-0.5 text-xs font-semibold text-amber-700">Si ya registraste una compra y pegaste los IMEIs en esa compra, no los ingreses aqui otra vez: se duplicaria el stock.</p>
                    </div>
                </div>
            </div>

            {/* Modal selector */}
            {pickerData && (
                <ProductPickerModal
                    detected={pickerData.detected}
                    imei={pickerData.imei}
                    catalog={catalog}
                    onSelect={handlePickerSelect}
                    onClose={() => { setPickerData(null); setTimeout(() => inputRef.current?.focus(), 100); }}
                />
            )}

            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4 shrink-0">
                <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
                    <ArrowLeft size={18} />
                </button>
                <div className="flex-1">
                    <h1 className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <Barcode size={20} className="text-indigo-600" />
                        Recepción Serializada
                    </h1>
                    <p className="text-xs text-slate-400 mt-0.5">Pistola el IMEI — se identifica automáticamente vía IMEI.info</p>
                </div>
                <div className="flex items-center gap-2">
                    {totalImeis > 0 && (
                        <button onClick={clearAll} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl transition-all">
                            <Trash2 size={13} /> Limpiar
                        </button>
                    )}
                    <select id="tour-serialized-warehouse" value={selectedWarehouseId} onChange={e => setSelectedWarehouseId(e.target.value)}
                        className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium bg-white focus:outline-none focus:border-indigo-400">
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Scanner */}
            <div className="px-6 py-4 bg-white border-b border-slate-100 shrink-0">
                <div id="tour-serialized-scanner" className={`flex items-center gap-3 bg-slate-50 border-2 rounded-2xl px-4 py-3 transition-all ${scanning ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200 focus-within:border-indigo-500'}`}>
                    {scanning
                        ? <Loader2 size={20} className="text-amber-500 animate-spin shrink-0" />
                        : <Barcode size={20} className="text-slate-400 shrink-0" />
                    }
                    <input
                        ref={inputRef}
                        value={imeiInput}
                        onChange={e => setImeiInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={scanning ? 'Consultando IMEI.info...' : 'Escanear IMEI (Enter para agregar)'}
                        disabled={scanning}
                        className="flex-1 bg-transparent outline-none text-sm font-mono text-slate-800 placeholder:text-slate-400"
                        autoFocus
                    />
                    <button onClick={addImei} disabled={scanning || !imeiInput.trim()}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl disabled:opacity-40 transition-all">
                        Agregar
                    </button>
                </div>

                {totalImeis > 0 && (
                    <div className="flex items-center gap-4 mt-2 px-1">
                        <span className="text-[11px] font-bold text-slate-500">{totalImeis} IMEI{totalImeis !== 1 ? 's' : ''}</span>
                        <span className="text-[11px] font-bold text-slate-500">{groups.length} producto{groups.length !== 1 ? 's' : ''}</span>
                        {unmatchedGroups.length > 0 && (
                            <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1">
                                <AlertCircle size={11} /> {unmatchedGroups.length} sin asignar — toca la tarjeta
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Carrito */}
            <div id="tour-serialized-groups" className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {groups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-3 py-20">
                        <Barcode size={48} strokeWidth={1} />
                        <p className="text-sm font-bold text-center">Pistola el primer IMEI<br />para comenzar</p>
                        <p className="text-[11px] text-slate-400 text-center max-w-xs">
                            Identificación automática vía IMEI.info ($0.02/consulta).<br />
                            Si hay múltiples versiones, elige desde el selector.
                        </p>
                    </div>
                ) : groups.map(group => (
                    <CartGroup
                        key={group.groupId}
                        group={group}
                        onRemoveImei={removeImei}
                        onClickGroup={handleClickGroup}
                    />
                ))}
            </div>

            {/* Footer */}
            {totalImeis > 0 && (
                <div className="bg-white border-t border-slate-200 px-6 py-4 shrink-0 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-500">{totalImeis} IMEI{totalImeis !== 1 ? 's' : ''} listos</p>
                        {unmatchedGroups.length > 0 && (
                            <p className="text-[11px] text-amber-600 font-bold mt-0.5">
                                ⚠️ Asigna producto a {unmatchedGroups.length} grupo{unmatchedGroups.length !== 1 ? 's' : ''} primero
                            </p>
                        )}
                    </div>
                    <button id="tour-serialized-save" onClick={handleSave} disabled={!canSave || isSaving}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm transition-all ${
                            canSave && !isSaving
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 hover:-translate-y-0.5'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}>
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Guardar todo
                    </button>
                </div>
            )}
        </div>
    );
};

export default SerializedReception;
