import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfig } from '../../context/ConfigContext';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import {
    Barcode, Loader2, Trash2, Save, X, Search, ExternalLink,
    ChevronDown, Smartphone, AlertCircle, CheckCircle2,
    Zap, Package, RefreshCw
} from 'lucide-react';

const IMEI_API_KEY = '7c1c33d3-0604-43b8-b09e-41226ee7eacd';
const IMEI_SERVICE_ID = 0; // Basic IMEI Check $0.02

// ─── Helpers ──────────────────────────────────────────────────────────────────
const normalizar = (s = '') => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Búsqueda difusa — tolera 1-2 errores tipográficos (Levenshtein simplificado)
const fuzzyMatch = (text, query) => {
    const t = normalizar(text);
    const q = normalizar(query);
    if (!q) return true;
    // Coincidencia exacta por substring
    if (t.includes(q)) return true;
    // Si la query es corta, solo substring
    if (q.length <= 2) return false;
    // Buscar cada palabra del query por separado
    const words = q.split(/\s+/).filter(Boolean);
    if (words.every(w => t.includes(w))) return true;
    // Levenshtein para queries cortas (<=8 chars) por palabra
    for (const word of words) {
        if (word.length < 3) continue;
        // Buscar en ventanas del texto del mismo tamaño ±2
        for (let i = 0; i <= t.length - word.length + 2; i++) {
            const slice = t.slice(i, i + word.length);
            let diff = 0;
            const minLen = Math.min(slice.length, word.length);
            for (let j = 0; j < minLen; j++) { if (slice[j] !== word[j]) diff++; }
            diff += Math.abs(slice.length - word.length);
            const maxErrors = word.length <= 4 ? 1 : 2;
            if (diff <= maxErrors) return true;
        }
    }
    return false;
};

// ─── Item de carrito ───────────────────────────────────────────────────────────
const CartItem = ({ group, catalog, onRemoveImei, onChangeProduct }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropRef = useRef(null);

    const matches = catalog.filter(p =>
        fuzzyMatch(p.name, search) ||
        (p.sku && fuzzyMatch(p.sku, search))
    ).slice(0, 8);

    useEffect(() => {
        const handleClick = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const isUnmatched = !group.productId;
    const borderColor = isUnmatched ? 'border-amber-300' : 'border-slate-200';

    return (
        <div className={`bg-white rounded-2xl border-2 ${borderColor} overflow-hidden`}>
            {/* Header del grupo */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isUnmatched ? 'bg-amber-100' : 'bg-indigo-100'}`}>
                    {isUnmatched ? <AlertCircle size={18} className="text-amber-600" /> : <Smartphone size={18} className="text-indigo-600" />}
                </div>
                <div className="flex-1 min-w-0">
                    {/* Selector de producto */}
                    <div className="relative" ref={dropRef}>
                        <button
                            onClick={() => setOpen(o => !o)}
                            className={`flex items-center gap-1.5 text-sm font-black truncate max-w-full ${isUnmatched ? 'text-amber-700' : 'text-slate-800'}`}
                        >
                            <span className="truncate">{group.productName || '⚠️ Sin identificar — selecciona producto'}</span>
                            <ChevronDown size={14} className="shrink-0" />
                        </button>
                        {open && (
                            <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl z-30 overflow-hidden">
                                <div className="p-2 border-b border-slate-100">
                                    <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-2.5 py-1.5">
                                        <Search size={13} className="text-slate-400" />
                                        <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                                            placeholder="Buscar producto..." className="flex-1 bg-transparent text-xs outline-none" />
                                    </div>
                                </div>
                                <div className="max-h-48 overflow-y-auto">
                                    {matches.map(p => (
                                        <button key={p.id} onClick={() => { onChangeProduct(group.groupId, p); setOpen(false); setSearch(''); }}
                                            className="w-full text-left px-3 py-2.5 text-xs hover:bg-indigo-50 transition-colors">
                                            <p className="font-bold text-slate-800 truncate">{p.name}</p>
                                            {p.sku && <p className="text-slate-400 font-mono">{p.sku}</p>}
                                        </button>
                                    ))}
                                    {matches.length === 0 && <p className="text-xs text-slate-400 px-3 py-4 text-center">Sin resultados</p>}
                                </div>
                            </div>
                        )}
                    </div>
                    {group.brand && (
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{group.brand} · detectado por API</p>
                    )}
                </div>
                <span className="shrink-0 text-[11px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                    {group.imeis.length} IMEI{group.imeis.length !== 1 ? 's' : ''}
                </span>
            </div>
            {/* Si no hay producto asignado, ofrecer crear uno nuevo */}
            {isUnmatched && (
                <div className="px-4 pb-3 flex items-center gap-2">
                    <span className="text-[10px] text-amber-600 font-bold">¿El producto no existe?</span>
                    <a
                        href={`#/products/new?name=${encodeURIComponent(group.productName || '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] font-black text-indigo-600 hover:text-indigo-800 border border-indigo-200 bg-indigo-50 px-2 py-0.5 rounded-lg transition-colors"
                    >
                        <ExternalLink size={10} /> Crear producto nuevo
                    </a>
                </div>
            )}

            {/* Lista de IMEIs */}
            <div className="px-4 py-2 space-y-1">
                {group.imeis.map(item => (
                    <div key={item.imei} className="flex items-center gap-2 py-1">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${item.validating ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                        <span className="flex-1 font-mono text-xs text-slate-700">{item.imei}</span>
                        {item.validating && <Loader2 size={12} className="animate-spin text-amber-500 shrink-0" />}
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
    const { modules } = useConfig();

    const navigate = useNavigate();
    const [catalog, setCatalog] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Carrito: array de grupos { groupId, productId, productName, brand, imeis: [{imei, validating}] }
    const [groups, setGroups] = useState([]);
    const [imeiInput, setImeiInput] = useState('');
    const [scanning, setScanning] = useState(false);

    const inputRef = useRef(null);

    // Cargar datos
    useEffect(() => {
        const load = async () => {
            try {
                const [pRes, wRes] = await Promise.all([
                    apiClient.get('/products/', { params: { limit: 2000, has_imei: true } }),
                    apiClient.get('/warehouses'),
                ]);
                const products = (Array.isArray(pRes.data) ? pRes.data : []).filter(p => p.has_imei);
                setCatalog(products);
                const whs = Array.isArray(wRes.data) ? wRes.data : [];
                setWarehouses(whs);
                if (whs.length > 0) setSelectedWarehouseId(whs[0].id);
            } catch {
                toast.error('Error cargando datos');
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    // Todos los IMEIs ya en carrito
    const allImeis = groups.flatMap(g => g.imeis.map(i => i.imei));

    // Buscar match en catálogo por brand+model
    const findProduct = useCallback((brand = '', model = '') => {
        const q = normalizar(`${brand} ${model}`);
        const byModel = catalog.filter(p => normalizar(p.name).includes(normalizar(model)));
        if (byModel.length === 1) return byModel[0];
        const byBrandModel = catalog.filter(p => normalizar(p.name).includes(q.trim()));
        if (byBrandModel.length === 1) return byBrandModel[0];
        return null; // ambiguo o no encontrado
    }, [catalog]);

    // Agregar IMEI al carrito
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

        // Consultar API IMEI.info
        let brand = '', model = '', matchedProduct = null;
        try {
            const apiRes = await fetch(
                `https://dash.imei.info/api/check/${IMEI_SERVICE_ID}/?API_KEY=${IMEI_API_KEY}&imei=${imei}`
            );
            const data = await apiRes.json();
            if (data?.result) {
                brand = data.result.brand_name || '';
                model = data.result.model || '';
                matchedProduct = findProduct(brand, model);
            }
        } catch {
            // Si falla la API, agregamos igualmente sin identificar
        }

        toast.dismiss('imei-api');
        setScanning(false);

        const imeiItem = { imei, validating: false };
        const groupKey = matchedProduct
            ? `product-${matchedProduct.id}`
            : `unmatched-${brand || imei}`;

        setGroups(prev => {
            // ¿Ya existe un grupo con ese key?
            const exists = prev.find(g => g.groupId === groupKey);
            if (exists) {
                return prev.map(g => g.groupId === groupKey
                    ? { ...g, imeis: [...g.imeis, imeiItem] }
                    : g
                );
            }
            // Crear nuevo grupo
            return [...prev, {
                groupId: groupKey,
                productId: matchedProduct?.id || null,
                productName: matchedProduct?.name || (model ? `${brand} ${model}` : null),
                brand: brand || null,
                imeis: [imeiItem],
            }];
        });

        if (matchedProduct) {
            toast.success(`✅ ${matchedProduct.name}`, { id: 'imei-scan', duration: 1500 });
        } else if (model) {
            toast(`📱 ${brand} ${model} — asigna producto`, { id: 'imei-scan', duration: 2000, icon: '⚠️' });
        } else {
            toast(`IMEI agregado sin identificar`, { id: 'imei-scan', duration: 1500 });
        }

        // Mantener foco en el input
        setTimeout(() => inputRef.current?.focus(), 50);
    }, [imeiInput, allImeis, findProduct]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addImei(); }
    };

    const removeImei = (groupId, imei) => {
        setGroups(prev => prev.map(g => {
            if (g.groupId !== groupId) return g;
            const newImeis = g.imeis.filter(i => i.imei !== imei);
            return newImeis.length > 0 ? { ...g, imeis: newImeis } : null;
        }).filter(Boolean));
    };

    const changeProduct = (groupId, product) => {
        setGroups(prev => prev.map(g => {
            if (g.groupId !== groupId) return g;
            const newKey = `product-${product.id}`;
            // Fusionar con grupo existente si el producto ya tiene grupo
            const existingGroup = prev.find(g2 => g2.groupId === newKey && g2.groupId !== groupId);
            if (existingGroup) {
                // Marcar este para fusionar
                return { ...g, _mergeInto: newKey, productId: product.id, productName: product.name };
            }
            return { ...g, groupId: newKey, productId: product.id, productName: product.name, brand: null };
        }));
        // Fusionar grupos si aplica
        setGroups(prev => {
            const toMerge = prev.filter(g => g._mergeInto);
            if (toMerge.length === 0) return prev;
            let result = prev.filter(g => !g._mergeInto);
            toMerge.forEach(source => {
                result = result.map(g => g.groupId === source._mergeInto
                    ? { ...g, imeis: [...g.imeis, ...source.imeis] }
                    : g
                );
            });
            return result;
        });
    };

    const clearAll = () => {
        if (!confirm('¿Limpiar todo el carrito?')) return;
        setGroups([]);
    };

    const totalImeis = groups.reduce((sum, g) => sum + g.imeis.length, 0);
    const unmatchedGroups = groups.filter(g => !g.productId);
    const canSave = totalImeis > 0 && unmatchedGroups.length === 0 && selectedWarehouseId;

    const handleSave = async () => {
        if (!canSave) {
            if (unmatchedGroups.length > 0) toast.error('Asigna un producto a todos los grupos antes de guardar');
            return;
        }
        setIsSaving(true);
        const toastId = toast.loading('Procesando ingreso...');
        try {
            // Enviar grupo por grupo
            const results = await Promise.all(groups.map(g =>
                apiClient.post('/inventory/bulk-entry', {
                    product_id: g.productId,
                    warehouse_id: parseInt(selectedWarehouseId),
                    imeis: g.imeis.map(i => i.imei),
                    cost: 0,
                })
            ));
            toast.dismiss(toastId);
            toast.success(`✅ ${totalImeis} IMEI(s) ingresados correctamente`);
            setGroups([]);
        } catch (err) {
            toast.dismiss(toastId);
            toast.error(err.response?.data?.detail || 'Error al procesar el ingreso');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="animate-spin text-indigo-600" size={48} />
            </div>
        );
    }

    return (
        <div className="h-full bg-slate-50 flex flex-col overflow-hidden">

            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <Barcode size={20} className="text-indigo-600" />
                        Recepción Serializada
                    </h1>
                    <p className="text-xs text-slate-400 mt-0.5">Pistola el IMEI y se identifica automáticamente vía IMEI.info</p>
                </div>
                <div className="flex items-center gap-2">
                    {totalImeis > 0 && (
                        <button onClick={clearAll} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl transition-all">
                            <Trash2 size={13} /> Limpiar
                        </button>
                    )}
                    <select
                        value={selectedWarehouseId}
                        onChange={e => setSelectedWarehouseId(e.target.value)}
                        className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium bg-white focus:outline-none focus:border-indigo-400"
                    >
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Scanner */}
            <div className="px-6 py-4 bg-white border-b border-slate-100 shrink-0">
                <div className={`flex items-center gap-3 bg-slate-50 border-2 rounded-2xl px-4 py-3 transition-all ${scanning ? 'border-amber-400' : 'border-slate-200 focus-within:border-indigo-500'}`}>
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
                    <button
                        onClick={addImei}
                        disabled={scanning || !imeiInput.trim()}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl disabled:opacity-40 transition-all"
                    >
                        Agregar
                    </button>
                </div>
                {/* Stats */}
                {totalImeis > 0 && (
                    <div className="flex items-center gap-4 mt-2 px-1">
                        <span className="text-[11px] font-bold text-slate-500">{totalImeis} IMEI{totalImeis !== 1 ? 's' : ''} en carrito</span>
                        <span className="text-[11px] font-bold text-slate-500">{groups.length} producto{groups.length !== 1 ? 's' : ''}</span>
                        {unmatchedGroups.length > 0 && (
                            <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1">
                                <AlertCircle size={11} /> {unmatchedGroups.length} sin asignar
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Carrito */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {groups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-3 py-20">
                        <Barcode size={48} strokeWidth={1} />
                        <p className="text-sm font-bold text-center">Pistola el primer IMEI<br />para comenzar</p>
                        <p className="text-[11px] text-slate-400 text-center max-w-xs">
                            Se identificará la marca y modelo automáticamente<br />a través de IMEI.info ($0.02 por consulta)
                        </p>
                    </div>
                ) : (
                    groups.map(group => (
                        <CartItem
                            key={group.groupId}
                            group={group}
                            catalog={catalog}
                            onRemoveImei={removeImei}
                            onChangeProduct={changeProduct}
                        />
                    ))
                )}
            </div>

            {/* Footer guardar */}
            {totalImeis > 0 && (
                <div className="bg-white border-t border-slate-200 px-6 py-4 shrink-0 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-500">
                            {totalImeis} IMEI{totalImeis !== 1 ? 's' : ''} listos para ingresar
                        </p>
                        {unmatchedGroups.length > 0 && (
                            <p className="text-[11px] text-amber-600 font-bold mt-0.5">
                                ⚠️ Asigna producto a {unmatchedGroups.length} grupo{unmatchedGroups.length !== 1 ? 's' : ''} primero
                            </p>
                        )}
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={!canSave || isSaving}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm transition-all ${
                            canSave && !isSaving
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 hover:-translate-y-0.5'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                    >
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Guardar todo
                    </button>
                </div>
            )}
        </div>
    );
};

export default SerializedReception;
 
