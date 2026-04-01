import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, ShoppingBag, MessageCircle, Package, X, Phone,
  ExternalLink, Filter, Star, ShoppingCart, Trash2, Share2,
  Clock, ChevronRight, QrCode, Copy, Check, ArrowLeft,
  MinusCircle, PlusCircle, AlertCircle
} from 'lucide-react';
import { API_BASE_URL } from '../../config/constants';
import { toast } from 'react-hot-toast';

// ── Helpers ──────────────────────────────────────────────────
const getBase  = () => (API_BASE_URL || '').replace(/\/api\/v1\/?$/, '');
const API      = (p) => `${getBase()}/api/v1${p}`;
const imgURL   = (url) => (!url ? null : url.startsWith('http') ? url : `${getBase()}${url}`);
const fmtPrice = (p) => `$${Number(p).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

const getTenant = () => {
  const parts = window.location.hostname.split('.');
  if (parts.length >= 3) {
    const s = parts[0];
    if (!['www','api','app','admin','dashboard'].includes(s) && !s.startsWith('api-'))
      return s;
  }
  return null;
};

const apiFetch = (url) => {
  const t = getTenant();
  const sep = url.includes('?') ? '&' : '?';
  return fetch(t ? `${url}${sep}_tenant=${t}` : url);
};

const waLink = (phone, msg) => {
  const clean = (phone || '').replace(/\D/g, '');
  return `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
};

// ── Horario ───────────────────────────────────────────────────
function BusinessHours({ hoursStr }) {
  if (!hoursStr) return null;
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
      <Clock size={12} className="shrink-0" />
      <span>{hoursStr}</span>
    </div>
  );
}

// ── Modal de detalle de producto ─────────────────────────────
function ProductDetailModal({ product, waPhone, onClose, onAddCart, cartQty }) {
  if (!product) return null;
  const [qty, setQty] = useState(1);
  const inStock = product.stock > 0;

  const directMsg = `Hola! Me interesa: *${product.name}* - ${fmtPrice(product.price)}. ¿Está disponible?`;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}>
      <div className="bg-white w-full sm:rounded-3xl sm:max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {/* Imagen */}
        <div className="relative aspect-square bg-slate-50">
          {imgURL(product.image_url) ? (
            <img src={imgURL(product.image_url)} alt={product.name}
              className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package size={64} className="text-slate-200" />
            </div>
          )}
          <button onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 bg-white/90 rounded-full flex items-center justify-center shadow-sm hover:bg-white transition-all">
            <X size={18} className="text-slate-600" />
          </button>
          {product.featured && (
            <span className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 bg-amber-400 text-white rounded-full text-xs font-black">
              <Star size={11} fill="white" /> Destacado
            </span>
          )}
        </div>

        <div className="p-5 space-y-4">
          {product.category && (
            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">
              {product.category}
            </span>
          )}
          <h2 className="text-xl font-black text-slate-900">{product.name}</h2>

          {product.sku && (
            <p className="text-xs text-slate-400 font-mono">SKU: {product.sku}</p>
          )}

          {product.description && (
            <p className="text-sm text-slate-600 leading-relaxed">{product.description}</p>
          )}

          <div className="flex items-center justify-between">
            <span className="text-3xl font-black text-slate-900">{fmtPrice(product.price)}</span>
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full
              ${!inStock ? 'bg-rose-50 text-rose-500' :
                product.stock > 5 ? 'bg-emerald-50 text-emerald-600' :
                'bg-amber-50 text-amber-600'}`}>
              {!inStock ? 'Agotado' : product.stock > 5 ? 'Disponible' : `Solo ${product.stock} uds`}
            </span>
          </div>

          {inStock && (
            <>
              {/* Selector de cantidad */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500">Cantidad:</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setQty(q => Math.max(1, q-1))}
                    className="text-slate-400 hover:text-indigo-600 transition-colors">
                    <MinusCircle size={24} />
                  </button>
                  <span className="w-8 text-center font-black text-lg">{qty}</span>
                  <button onClick={() => setQty(q => {
                    if (q >= product.stock) {
                      toast(`Máximo disponible: ${product.stock} unidad(es)`, { icon: '📦' });
                      return q;
                    }
                    return q + 1;
                  })}
                    className="text-slate-400 hover:text-indigo-600 transition-colors">
                    <PlusCircle size={24} />
                  </button>
                </div>
                {qty >= product.stock && (
                  <span className="text-xs text-amber-600 font-bold flex items-center gap-1">
                    <AlertCircle size={12} /> Máximo disponible
                  </span>
                )}
              </div>

              {/* Botones */}
              <div className="space-y-2.5">
                <button onClick={() => { onAddCart(product, qty); onClose(); }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black transition-all shadow-lg shadow-indigo-200">
                  <ShoppingCart size={18} />
                  Agregar al carrito {qty > 1 ? `(${qty})` : ''}
                </button>
                {waPhone && (
                  <a href={waLink(waPhone, directMsg)} target="_blank" rel="noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold transition-all">
                    <MessageCircle size={16} />
                    Pedir directo por WhatsApp
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Carrito flotante ──────────────────────────────────────────
function CartDrawer({ items, onRemove, onClose, waPhone, business }) {
  const total = items.reduce((s, i) => s + Number(i.product.price) * i.qty, 0);

  const buildMsg = () => {
    const lines = items.map(i =>
      `• ${i.qty}x ${i.product.name} — ${fmtPrice(Number(i.product.price) * i.qty)}`
    );
    return `Hola ${business?.name || ''}! Quiero hacer el siguiente pedido:\n\n${lines.join('\n')}\n\n*Total: ${fmtPrice(total)}*\n\n¿Pueden confirmar disponibilidad?`;
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-end" onClick={onClose}>
      <div className="bg-white w-full sm:w-96 h-[80vh] rounded-t-3xl sm:rounded-l-3xl sm:rounded-t-none sm:h-full flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-black text-slate-800 flex items-center gap-2">
            <ShoppingCart size={20} className="text-indigo-600" />
            Tu pedido ({items.length})
          </h3>
          <button onClick={onClose}
            className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Tu carrito está vacío</p>
            </div>
          ) : items.map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-200 shrink-0">
                {imgURL(item.product.image_url)
                  ? <img src={imgURL(item.product.image_url)} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><Package size={16} className="text-slate-400" /></div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{item.product.name}</p>
                <p className="text-xs text-slate-500">{item.qty}x {fmtPrice(item.product.price)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-black text-sm text-slate-900">
                  {fmtPrice(Number(item.product.price) * item.qty)}
                </span>
                <button onClick={() => onRemove(i)}
                  className="text-slate-300 hover:text-rose-400 transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {items.length > 0 && (
          <div className="p-5 border-t border-slate-100 space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-600">Total estimado</span>
              <span className="text-2xl font-black text-indigo-600">{fmtPrice(total)}</span>
            </div>
            {waPhone ? (
              <a href={waLink(waPhone, buildMsg())} target="_blank" rel="noreferrer"
                className="w-full flex items-center justify-center gap-2.5 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-base transition-all shadow-lg shadow-emerald-200">
                <MessageCircle size={20} />
                Enviar pedido por WhatsApp
              </a>
            ) : (
              <div className="w-full flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-400 rounded-2xl text-sm">
                <AlertCircle size={16} />
                Contacta al negocio para finalizar
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modal QR / Compartir ──────────────────────────────────────
function ShareModal({ onClose }) {
  const url = window.location.href;
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const wa = `https://wa.me/?text=${encodeURIComponent(`¡Mira este catálogo! ${url}`)}`;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-black text-slate-800 flex items-center gap-2">
            <Share2 size={18} className="text-indigo-600" /> Compartir catálogo
          </h3>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>

        {/* QR */}
        <div className="flex justify-center mb-4">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}&color=4f46e5&bgcolor=ffffff`}
            alt="QR del catálogo"
            className="rounded-2xl border border-slate-200 shadow-sm"
            width={180} height={180}
          />
        </div>
        <p className="text-xs text-center text-slate-400 mb-4">Escanea para abrir el catálogo</p>

        {/* Link */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 truncate font-mono">
            {url}
          </div>
          <button onClick={copy}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5
              ${copied ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}>
            {copied ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
          </button>
        </div>

        {/* WhatsApp */}
        <a href={wa} target="_blank" rel="noreferrer"
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold transition-all">
          <MessageCircle size={16} />
          Compartir por WhatsApp
        </a>
      </div>
    </div>
  );
}

// ── Tarjeta de producto ───────────────────────────────────────
function ProductCard({ product, waPhone, onDetail, onAdd, waCartEnabled }) {
  const [imgErr, setImgErr] = useState(false);
  const inStock = product.stock > 0;

  return (
    <div
      className={`bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col cursor-pointer
        ${product.featured ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200'}
        ${!inStock ? 'opacity-70' : 'hover:-translate-y-0.5'}`}
      onClick={() => onDetail(product)}>

      <div className="relative aspect-square bg-slate-50">
        {imgURL(product.image_url) && !imgErr ? (
          <img src={imgURL(product.image_url)} alt={product.name}
            onError={() => setImgErr(true)}
            className={`w-full h-full object-cover ${!inStock ? 'grayscale-[50%]' : ''}`} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package size={32} className="text-slate-300" />
          </div>
        )}
        {product.featured && (
          <span className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 bg-amber-400 text-white rounded-full text-[10px] font-black">
            <Star size={9} fill="white" /> Destacado
          </span>
        )}
        {!inStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60">
            <span className="px-3 py-1 bg-rose-500 text-white text-xs font-black rounded-full">Agotado</span>
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col flex-1 gap-2">
        <div className="flex-1">
          {product.category && (
            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest block">
              {product.category}
            </span>
          )}
          <p className="text-sm font-bold text-slate-800 line-clamp-2 mt-0.5">{product.name}</p>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-black text-slate-900">{fmtPrice(product.price)}</span>
          {inStock && product.stock <= 5 && (
            <span className="text-[10px] text-amber-600 font-bold">Últimas {product.stock}</span>
          )}
        </div>

        {inStock && (
          <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
            {waCartEnabled ? (
              <button onClick={() => onAdd(product, 1)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all">
                <ShoppingCart size={13} /> Agregar
              </button>
            ) : waPhone ? (
              <a href={waLink(waPhone, `Hola! Me interesa: *${product.name}* - ${fmtPrice(product.price)}`)}
                target="_blank" rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all">
                <MessageCircle size={13} /> Pedir
              </a>
            ) : null}
            <button onClick={() => onDetail(product)}
              className="p-2 border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all">
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────
export default function PublicCatalog() {
  const [data, setData]         = useState(null);
  const [cats, setCats]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [search, setSearch]     = useState('');
  const [searchIn, setSearchIn] = useState('');
  const [category, setCategory] = useState('');
  const debounceRef             = useRef(null);
  const [showFilters, setShowFilters] = useState(false);
  const [cart, setCart]         = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [detailProduct, setDetailProduct] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams();
      if (search) p.set('search', search);
      if (category) p.set('category', category);

      const [catRes, catList] = await Promise.all([
        apiFetch(`${API('/public/catalog')}?${p}`),
        apiFetch(API('/public/catalog/categories')),
      ]);

      if (!catRes.ok) throw new Error('No se pudo cargar el catálogo');
      setData(await catRes.json());
      if (catList.ok) setCats(await catList.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [search, category]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addToCart = (product, qty = 1) => {
    setCart(c => {
      const idx = c.findIndex(i => i.product.id === product.id);
      const currentQty = idx >= 0 ? c[idx].qty : 0;
      const newQty = currentQty + qty;

      // Validar que no supere el stock disponible
      if (newQty > product.stock) {
        const remaining = product.stock - currentQty;
        if (remaining <= 0) {
          toast(`⚠️ No hay más unidades disponibles de "${product.name}". Stock máximo: ${product.stock}`, { icon: '🚫' });
        } else {
          toast(`⚠️ Solo puedes agregar ${remaining} unidad(es) más de "${product.name}" (stock disponible: ${product.stock})`, { icon: '📦' });
          // Agregar solo hasta el máximo permitido
          if (idx >= 0) {
            const n = [...c];
            n[idx] = { ...n[idx], qty: product.stock };
            return n;
          }
          return [...c, { product, qty: remaining }];
        }
        return c; // Sin cambios si ya está al máximo
      }

      if (idx >= 0) {
        const n = [...c];
        n[idx] = { ...n[idx], qty: newQty };
        return n;
      }
      return [...c, { product, qty }];
    });
  };

  const removeFromCart = (idx) => setCart(c => c.filter((_, i) => i !== idx));

  const handleSearch = (e) => { e.preventDefault(); setSearch(searchIn.trim()); };

  // Búsqueda dinámica — dispara 400ms después de que el usuario deja de escribir
  const handleSearchInput = (val) => {
    setSearchIn(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(val.trim());
    }, 400);
  };

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center p-8">
        <Package size={48} className="text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500 font-medium">Catálogo no disponible</p>
      </div>
    </div>
  );

  const biz      = data?.business;
  const products = data?.products || [];
  const waPhone  = biz?.whatsapp || biz?.phone;
  const waCart   = biz?.whatsapp_cart !== false;
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            {biz?.logo_url ? (
              <img src={imgURL(biz.logo_url)} alt={biz?.name}
                className="w-11 h-11 rounded-xl object-cover border border-slate-200 shrink-0" />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                <ShoppingBag size={20} className="text-indigo-600" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="font-black text-slate-900 text-lg leading-tight truncate">
                {loading ? '...' : biz?.name || 'Catálogo'}
              </h1>
              {biz?.phone && (
                <a href={`tel:${biz.phone}`} className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors">
                  <Phone size={10} />{biz.phone}
                </a>
              )}
              <BusinessHours hoursStr={biz?.hours} />
            </div>

            {/* Acciones del header */}
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setShowShare(true)}
                className="w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-xl transition-all">
                <Share2 size={16} className="text-slate-600" />
              </button>
              {waCart && (
                <button onClick={() => setShowCart(true)}
                  className="relative w-9 h-9 flex items-center justify-center bg-indigo-100 hover:bg-indigo-200 rounded-xl transition-all">
                  <ShoppingCart size={16} className="text-indigo-600" />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-600 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                      {cartCount > 9 ? '9+' : cartCount}
                    </span>
                  )}
                </button>
              )}
              {waPhone && (
                <a href={`https://wa.me/${waPhone.replace(/\D/g,'')}`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all">
                  <MessageCircle size={14} />
                  <span className="hidden sm:inline">WhatsApp</span>
                </a>
              )}
            </div>
          </div>

          {/* Buscador */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={searchIn} onChange={e => handleSearchInput(e.target.value)}
                placeholder="Buscar productos..."
                className="w-full pl-9 pr-8 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 outline-none bg-white" />
              {searchIn && (
                <button type="button" onClick={() => { if(debounceRef.current) clearTimeout(debounceRef.current); setSearchIn(''); setSearch(''); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                  <X size={13} />
                </button>
              )}
            </div>
            <button type="submit" className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all">
              Buscar
            </button>
            {cats.length > 0 && (
              <button type="button" onClick={() => setShowFilters(f => !f)}
                className={`px-3 py-2.5 border rounded-xl text-sm font-bold transition-all
                  ${showFilters ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                <Filter size={15} />
              </button>
            )}
          </form>

          {showFilters && cats.length > 0 && (
            <div className="mt-2 flex gap-2 flex-wrap">
              <button onClick={() => setCategory('')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all
                  ${!category ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                Todos
              </button>
              {cats.map(c => (
                <button key={c} onClick={() => setCategory(c === category ? '' : c)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all
                    ${category === c ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Grid de productos ───────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({length: 8}).map((_,i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-pulse">
                <div className="aspect-square bg-slate-100" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-slate-100 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                  <div className="h-8 bg-slate-100 rounded mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <Package size={48} className="text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-bold text-lg">
              {search ? `Sin resultados para "${search}"` : 'No hay productos disponibles'}
            </p>
            {search && (
              <button onClick={() => { if(debounceRef.current) clearTimeout(debounceRef.current); setSearch(''); setSearchIn(''); }}
                className="mt-3 text-indigo-600 text-sm font-bold hover:underline">
                Ver todos los productos
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500">
                <span className="font-bold text-slate-700">{data?.total}</span> producto(s)
                {search && <span> para "<span className="font-bold text-indigo-600">{search}</span>"</span>}
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {products.map(p => (
                <ProductCard key={p.id} product={p}
                  waPhone={waPhone}
                  waCartEnabled={waCart}
                  onDetail={setDetailProduct}
                  onAdd={addToCart}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-8 border-t border-slate-200 mt-4">
        <p className="text-xs text-slate-400">
          Catálogo creado con{' '}
          <a href="https://miinventariofacil.com" target="_blank" rel="noreferrer"
            className="text-indigo-500 font-bold hover:underline">
            Mi Inventario Fácil
          </a>
        </p>
      </div>

      {/* ── Modales ─────────────────────────────────────────── */}
      {detailProduct && (
        <ProductDetailModal
          product={detailProduct}
          waPhone={waPhone}
          onClose={() => setDetailProduct(null)}
          onAddCart={addToCart}
          cartQty={cart.find(i => i.product.id === detailProduct.id)?.qty || 0}
        />
      )}

      {showCart && (
        <CartDrawer
          items={cart}
          onRemove={removeFromCart}
          onClose={() => setShowCart(false)}
          waPhone={waPhone}
          business={biz}
        />
      )}

      {showShare && <ShareModal onClose={() => setShowShare(false)} />}

      {/* Botón flotante del carrito (mobile) */}
      {waCart && cartCount > 0 && !showCart && (
        <button onClick={() => setShowCart(true)}
          className="fixed bottom-6 right-4 flex items-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-2xl shadow-indigo-400 font-bold text-sm transition-all animate-bounce-once z-30">
          <ShoppingCart size={18} />
          Ver pedido ({cartCount})
        </button>
      )}
    </div>
  );
}
