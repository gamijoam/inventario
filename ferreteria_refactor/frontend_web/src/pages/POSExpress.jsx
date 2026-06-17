import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    Search, ShoppingCart, X, Plus, Minus, Trash2,
    Zap, ArrowLeft, ChevronRight, Loader2, Tag,
    Banknote, CreditCard, CheckCircle2, RotateCcw,
    Hash, Star, GridIcon
} from 'lucide-react';
import apiClient from '../config/axios';
import { useConfig } from '../context/ConfigContext';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';
import { normalizeSearch } from '../utils/search';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n, symbol = '$') => `${symbol}${Number(n || 0).toFixed(2)}`;
const fmtBs = (n, rate) => rate ? `Bs ${(Number(n || 0) * rate).toFixed(2)}` : null;

// ─── ProductCard Express ──────────────────────────────────────────────────────
const ExpressCard = ({ product, onAdd, bsRate }) => {
    const price = Number(product.price || 0);
    const stock = Number(product.stock || 0);
    const outOfStock = stock === 0 && !product.is_service;

    return (
        <button
            onClick={() => !outOfStock && onAdd(product)}
            disabled={outOfStock}
            className={cn(
                'relative flex flex-col items-start w-full p-3 rounded-2xl border-2 text-left transition-all active:scale-95 select-none',
                outOfStock
                    ? 'bg-slate-50 border-slate-100 opacity-40 cursor-not-allowed'
                    : 'bg-white border-slate-200 hover:border-indigo-400 hover:shadow-md hover:shadow-indigo-100 cursor-pointer'
            )}
        >
            <p className="text-xs font-black text-slate-800 leading-tight line-clamp-2 w-full">{product.name}</p>
            {product.sku && <p className="text-[9px] text-slate-400 font-mono mt-0.5 truncate w-full">{product.sku}</p>}
            <div className="mt-2 w-full">
                <span className="text-base font-black text-indigo-600">{fmt(price)}</span>
                {bsRate && <p className="text-[9px] text-slate-400">{fmtBs(price, bsRate)}</p>}
            </div>
            {outOfStock && (
                <span className="absolute top-2 right-2 text-[8px] font-black bg-rose-100 text-rose-500 px-1.5 py-0.5 rounded-full">AGOTADO</span>
            )}
        </button>
    );
};

// ─── Cart Item ────────────────────────────────────────────────────────────────
const CartItem = ({ item, onQty, onRemove }) => (
    <div className="flex items-center gap-2 py-2 border-b border-slate-100 last:border-0">
        <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-800 truncate">{item.name}</p>
            <p className="text-[10px] text-slate-400">{fmt(item.price)} c/u</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => onQty(item.id, -1)} className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                <Minus size={11} />
            </button>
            <span className="w-7 text-center text-sm font-black text-slate-800">{item.qty}</span>
            <button onClick={() => onQty(item.id, 1)} className="w-6 h-6 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-600 flex items-center justify-center transition-colors">
                <Plus size={11} />
            </button>
        </div>
        <span className="text-sm font-black text-slate-800 w-16 text-right shrink-0">
            {fmt(item.price * item.qty)}
        </span>
        <button onClick={() => onRemove(item.id)} className="text-slate-300 hover:text-rose-500 transition-colors ml-1">
            <Trash2 size={13} />
        </button>
    </div>
);

// ─── Modal de Cobro ───────────────────────────────────────────────────────────
const PaymentModal = ({ total, bsRate, paymentMethods, onConfirm, onClose, isProcessing }) => {
    const [method, setMethod] = useState(null);
    const [received, setReceived] = useState('');
    const [currency, setCurrency] = useState('USD');
    const inputRef = useRef(null);

    useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

    const effectiveRate = currency === 'USD' ? 1 : (bsRate || 1);
    const totalInCurrency = currency === 'USD' ? total : total * (bsRate || 1);
    const receivedNum = parseFloat(received) || 0;
    const change = Math.max(0, receivedNum - totalInCurrency);
    const canConfirm = method && receivedNum >= totalInCurrency;

    const numPad = ['7','8','9','4','5','6','1','2','3','00','0','.'];

    const pressNum = (v) => {
        setReceived(prev => {
            if (v === '.' && prev.includes('.')) return prev;
            if (prev === '0' && v !== '.') return v;
            return prev + v;
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-5 text-white">
                    <p className="text-xs font-bold opacity-70 uppercase tracking-widest">Total a cobrar</p>
                    <p className="text-4xl font-black mt-1">{fmt(total)}</p>
                    {bsRate && <p className="text-sm opacity-70 mt-0.5">{fmtBs(total, bsRate)}</p>}
                </div>

                <div className="p-5 space-y-4">
                    {/* Moneda */}
                    <div className="flex gap-2">
                        {['USD', 'Bs'].map(c => (
                            <button
                                key={c}
                                onClick={() => { setCurrency(c); setReceived(''); }}
                                className={cn(
                                    'flex-1 py-2 rounded-xl text-sm font-black border-2 transition-all',
                                    currency === c
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'bg-white text-slate-600 border-slate-200'
                                )}
                            >
                                {c === 'USD' ? '$ USD' : `Bs ${bsRate ? `(${bsRate})` : ''}`}
                            </button>
                        ))}
                    </div>

                    {/* Método de pago */}
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Método de pago</p>
                        <div className="flex flex-wrap gap-1.5">
                            {paymentMethods.filter(m => m.is_active && !m.is_external_financer).map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => setMethod(m)}
                                    className={cn(
                                        'px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all',
                                        method?.id === m.id
                                            ? 'bg-indigo-600 text-white border-indigo-600'
                                            : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                                    )}
                                >
                                    {m.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Input monto */}
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                            Monto recibido ({currency})
                        </p>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-slate-400">
                                {currency === 'USD' ? '$' : 'Bs'}
                            </span>
                            <input
                                ref={inputRef}
                                type="number"
                                value={received}
                                onChange={e => setReceived(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 text-2xl font-black text-right border-2 border-indigo-300 rounded-2xl focus:outline-none focus:border-indigo-500 bg-indigo-50/30"
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    {/* NumPad */}
                    <div className="grid grid-cols-3 gap-1.5">
                        {numPad.map(v => (
                            <button
                                key={v}
                                onClick={() => pressNum(v)}
                                className="py-3 rounded-xl bg-slate-100 hover:bg-indigo-100 text-slate-800 font-black text-base transition-all active:scale-95"
                            >
                                {v}
                            </button>
                        ))}
                    </div>

                    {/* Vuelto */}
                    {receivedNum > 0 && (
                        <div className={cn(
                            'flex items-center justify-between rounded-2xl px-4 py-3 border-2',
                            canConfirm ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
                        )}>
                            <span className={cn('text-sm font-bold', canConfirm ? 'text-emerald-600' : 'text-rose-600')}>
                                {canConfirm ? 'Vuelto' : 'Falta'}
                            </span>
                            <span className={cn('text-xl font-black', canConfirm ? 'text-emerald-700' : 'text-rose-700')}>
                                {currency === 'USD' ? fmt(change) : fmtBs(change / (bsRate || 1), bsRate) || fmt(change)}
                            </span>
                        </div>
                    )}

                    {/* Botones */}
                    <div className="flex gap-2">
                        <button onClick={onClose} className="flex-1 py-3 rounded-2xl border-2 border-slate-200 text-slate-500 font-bold text-sm">
                            Cancelar
                        </button>
                        <button
                            onClick={() => onConfirm({ method, received: receivedNum, currency, change })}
                            disabled={!canConfirm || isProcessing}
                            className="flex-2 flex-grow py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm disabled:opacity-40 flex items-center justify-center gap-2 transition-all"
                        >
                            {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                            {isProcessing ? 'Procesando...' : 'Confirmar Venta'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── POS Express Principal ────────────────────────────────────────────────────
const POSExpress = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { currencies, modules } = useConfig();

    // Tasa del día
    const bsRate = (() => {
        if (!Array.isArray(currencies)) return null;
        const ves = currencies.find(c => c.is_default && c.currency_code === 'VES')
            || currencies.find(c => c.currency_code === 'VES' || c.currency_symbol === 'Bs');
        return ves ? parseFloat(ves.rate) : null;
    })();

    // Estado
    const [products, setProducts]           = useState([]);
    const [categories, setCategories]       = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [activeCategory, setActiveCategory] = useState('all');
    const [search, setSearch]               = useState('');
    const [cart, setCart]                   = useState([]);
    const [isLoading, setIsLoading]         = useState(true);
    const [showPayment, setShowPayment]     = useState(false);
    const [isProcessing, setIsProcessing]   = useState(false);
    const [lastSale, setLastSale]           = useState(null);
    const searchRef = useRef(null);

    // Cargar datos
    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const [pRes, cRes, mRes] = await Promise.all([
                    apiClient.get('/products/', { params: { limit: 2000 } }),
                    apiClient.get('/categories'),
                    apiClient.get('/payment-methods/'),
                ]);
                setProducts(Array.isArray(pRes.data) ? pRes.data : (pRes.data?.items || []));
                setCategories(Array.isArray(cRes.data) ? cRes.data : []);
                setPaymentMethods(Array.isArray(mRes.data) ? mRes.data : []);
            } catch { toast.error('Error cargando datos'); }
            finally { setIsLoading(false); }
        };
        load();
    }, []);

    // Focus en búsqueda al iniciar
    useEffect(() => {
        if (!isLoading) setTimeout(() => searchRef.current?.focus(), 200);
    }, [isLoading]);

    // Filtrar productos
    const filtered = products.filter(p => {
        if (activeCategory !== 'all' && p.category_id !== parseInt(activeCategory)) return false;
        if (!search) return true;
        const q = normalizeSearch(search);
        return normalizeSearch(p.name).includes(q)
            || (p.sku && normalizeSearch(p.sku).includes(q));
    });

    // Carrito
    const addToCart = useCallback((product) => {
        setCart(prev => {
            const ex = prev.find(i => i.id === product.id);
            if (ex) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
            return [...prev, { id: product.id, name: product.name, price: Number(product.price), qty: 1, sku: product.sku, exchange_rate_id: product.exchange_rate_id }];
        });
        // Flash feedback
        toast.success(`+1 ${product.name.slice(0, 20)}`, { duration: 800, icon: '🛒', style: { padding: '6px 12px', fontSize: '12px' } });
    }, []);

    const changeQty = (id, delta) => {
        setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i));
    };

    const removeItem = (id) => setCart(prev => prev.filter(i => i.id !== id));
    const clearCart = () => { setCart([]); setLastSale(null); };

    const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const itemCount = cart.reduce((s, i) => s + i.qty, 0);

    // Procesar venta
    const handleConfirmSale = async ({ method, received, currency, change }) => {
        setIsProcessing(true);
        try {
            // Obtener sesión de caja activa
            const sessionRes = await apiClient.get('/cash/sessions/active').catch(() => ({ data: null }));
            const sessionId = sessionRes.data?.id || null;

            // Preparar tasa
            let exchangeRate = 1;
            let amountInCurrency = received;
            if (currency !== 'USD' && bsRate) {
                exchangeRate = bsRate;
                amountInCurrency = received; // en Bs
            }

            const payload = {
                total_amount: total,
                total_amount_bs: bsRate ? total * bsRate : 0,
                exchange_rate: exchangeRate,
                currency: 'USD',
                payment_method: method.name,
                is_credit: false,
                session_id: sessionId,
                payments: [{
                    payment_method: method.name,
                    amount: currency === 'USD' ? received : received / (bsRate || 1),
                    currency: currency === 'USD' ? 'USD' : 'VES',
                    exchange_rate: currency === 'USD' ? 1 : bsRate,
                }],
                items: cart.map(i => ({
                    product_id: i.id,
                    quantity: i.qty,
                    unit_price: i.price,
                    subtotal: i.price * i.qty,
                    discount: 0,
                    exchange_rate_id: i.exchange_rate_id || null,
                })),
            };

            const res = await apiClient.post('/sales/', payload);
            setLastSale({ id: res.data?.id || res.data?.sale_id, change, currency });
            setCart([]);
            setShowPayment(false);
            toast.success(`✅ Venta registrada`, { duration: 3000 });
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error al procesar venta');
        } finally {
            setIsProcessing(false);
        }
    };

    // ── Pantalla de éxito post-venta ──────────────────────────────────────────
    if (lastSale) {
        return (
            <div className="fixed inset-0 bg-indigo-600 flex flex-col items-center justify-center text-white p-8">
                <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mb-6">
                    <CheckCircle2 size={40} className="text-white" />
                </div>
                <h1 className="text-3xl font-black mb-1">¡Venta Exitosa!</h1>
                {lastSale.id && <p className="text-white/70 text-sm mb-6">Venta #{lastSale.id}</p>}
                {lastSale.change > 0 && (
                    <div className="bg-white/10 rounded-2xl px-8 py-4 mb-8 text-center">
                        <p className="text-white/60 text-sm">Vuelto</p>
                        <p className="text-4xl font-black">
                            {lastSale.currency === 'USD' ? fmt(lastSale.change) : `Bs ${lastSale.change.toFixed(2)}`}
                        </p>
                    </div>
                )}
                <button
                    onClick={clearCart}
                    className="w-full max-w-xs py-4 bg-white text-indigo-600 rounded-2xl font-black text-lg shadow-xl"
                >
                    Nueva Venta
                </button>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Zap size={32} className="text-indigo-500 animate-pulse" />
                    <p className="text-slate-500 font-bold">Cargando POS Express...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-50 flex flex-col overflow-hidden">

            {/* ── Header ────────────────────────────────────────────────────── */}
            <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 shrink-0 shadow-sm">
                <button onClick={() => navigate('/')} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
                    <ArrowLeft size={18} />
                </button>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-amber-400 rounded-xl flex items-center justify-center shadow-sm">
                        <Zap size={16} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black text-slate-800 leading-none">POS Express</h1>
                        <p className="text-[9px] text-slate-400">Modo rápido</p>
                    </div>
                </div>

                {/* Búsqueda */}
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input
                        ref={searchRef}
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar producto o SKU..."
                        className="w-full pl-9 pr-4 py-2 bg-slate-100 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-white transition-all"
                    />
                    {search && (
                        <button onClick={() => { setSearch(''); searchRef.current?.focus(); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* Tasa */}
                {bsRate && (
                    <div className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1.5 rounded-lg">
                        <span>Bs</span>
                        <span className="text-slate-600">{bsRate.toFixed(2)}</span>
                    </div>
                )}
            </div>

            {/* ── Categorías ────────────────────────────────────────────────── */}
            <div className="bg-white border-b border-slate-100 px-4 py-2 flex gap-2 overflow-x-auto shrink-0 scrollbar-hide">
                <button
                    onClick={() => setActiveCategory('all')}
                    className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0',
                        activeCategory === 'all'
                            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    )}
                >
                    <GridIcon size={11} /> Todos
                </button>
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id.toString())}
                        className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0',
                            activeCategory === cat.id.toString()
                                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        )}
                    >
                        <Tag size={10} /> {cat.name}
                    </button>
                ))}
            </div>

            {/* ── Body: Catálogo + Carrito ───────────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden">

                {/* Catálogo */}
                <div className="flex-1 overflow-y-auto p-3">
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                            <Search size={32} className="opacity-30" />
                            <p className="text-sm font-medium">No se encontraron productos</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                            {filtered.map(p => (
                                <ExpressCard key={p.id} product={p} onAdd={addToCart} bsRate={bsRate} />
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Carrito ───────────────────────────────────────────────── */}
                <div className="w-72 xl:w-80 bg-white border-l border-slate-200 flex flex-col shrink-0 shadow-xl">

                    {/* Header carrito */}
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ShoppingCart size={16} className="text-indigo-500" />
                            <span className="text-sm font-black text-slate-800">Carrito</span>
                            {itemCount > 0 && (
                                <span className="w-5 h-5 bg-indigo-600 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                                    {itemCount}
                                </span>
                            )}
                        </div>
                        {cart.length > 0 && (
                            <button onClick={clearCart} className="text-[10px] font-bold text-slate-400 hover:text-rose-500 flex items-center gap-1 transition-colors">
                                <RotateCcw size={11} /> Limpiar
                            </button>
                        )}
                    </div>

                    {/* Items */}
                    <div className="flex-1 overflow-y-auto px-4 py-2">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-2 py-12">
                                <ShoppingCart size={36} className="opacity-30" />
                                <p className="text-xs font-medium text-center">Selecciona productos<br />del catálogo</p>
                            </div>
                        ) : cart.map(item => (
                            <CartItem key={item.id} item={item} onQty={changeQty} onRemove={removeItem} />
                        ))}
                    </div>

                    {/* Footer carrito */}
                    <div className="border-t border-slate-200 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500">Subtotal</span>
                            <span className="text-xs font-bold text-slate-600">{fmt(total)}</span>
                        </div>
                        {bsRate && (
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-slate-400">En Bs ({bsRate})</span>
                                <span className="text-[10px] font-bold text-slate-500">{fmtBs(total, bsRate)}</span>
                            </div>
                        )}

                        <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                            <span className="text-base font-black text-slate-800">TOTAL</span>
                            <span className="text-xl font-black text-indigo-600">{fmt(total)}</span>
                        </div>

                        <button
                            onClick={() => setShowPayment(true)}
                            disabled={cart.length === 0}
                            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-base rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5 shadow-md shadow-indigo-200 flex items-center justify-center gap-2"
                        >
                            <Zap size={18} />
                            Cobrar {fmt(total)}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Modal cobro ───────────────────────────────────────────────── */}
            {showPayment && (
                <PaymentModal
                    total={total}
                    bsRate={bsRate}
                    paymentMethods={paymentMethods}
                    onConfirm={handleConfirmSale}
                    onClose={() => setShowPayment(false)}
                    isProcessing={isProcessing}
                />
            )}
        </div>
    );
};

export default POSExpress;
