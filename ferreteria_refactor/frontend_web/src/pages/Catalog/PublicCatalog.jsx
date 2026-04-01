import { useState, useEffect, useCallback } from 'react';
import { Search, ShoppingBag, MessageCircle, Package, X, Phone, ExternalLink, Filter } from 'lucide-react';
import { API_BASE_URL } from '../../config/constants';

// Extraer el schema del tenant desde el subdominio actual
// Ej: solucionescodecraft.qa.miinventariofacil.com → "solucionescodecraft"
const getTenantSchema = () => {
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    const sub = parts[0];
    const reserved = ['www','api','app','admin','dashboard'];
    if (!reserved.includes(sub) && !sub.startsWith('api-') && !sub.startsWith('app-')) {
      return sub;
    }
  }
  return null;
};

// URL base del API
const getBase = () => (API_BASE_URL || '').replace(/\/api\/v1\/?$/, '');
const API = (path) => `${getBase()}/api/v1${path}`;

// Convierte rutas relativas de imágenes a URLs absolutas
// Ej: /media/products/abc.webp → https://api-qa.miinventariofacil.com/media/products/abc.webp
const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${getBase()}${url}`;
};

// Pasar el tenant como query param (más confiable con Cloudflare que headers custom)
const apiFetch = (url) => {
  const schema = getTenantSchema();
  const separator = url.includes('?') ? '&' : '?';
  const finalUrl = schema ? `${url}${separator}_tenant=${schema}` : url;
  return fetch(finalUrl);
};

function fmtPrice(price) {
  return `$${Number(price).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function whatsappLink(phone, productName, price) {
  const msg = encodeURIComponent(
    `Hola! Me interesa el producto: *${productName}* ($${Number(price).toFixed(2)}). ¿Está disponible?`
  );
  const clean = (phone || '').replace(/\D/g, '');
  return `https://wa.me/${clean}?text=${msg}`;
}

/* ── Tarjeta de producto ────────────────────────────────── */
function ProductCard({ product, waPhone }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 flex flex-col">
      {/* Imagen */}
      <div className="aspect-square bg-slate-50 flex items-center justify-center overflow-hidden">
        {product.image_url && !imgError ? (
          <img src={getImageUrl(product.image_url)} alt={product.name}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-300">
            <Package size={36} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1 gap-3">
        <div className="flex-1">
          {product.category && (
            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">
              {product.category}
            </span>
          )}
          <p className="text-sm font-bold text-slate-800 mt-0.5 line-clamp-2">
            {product.name}
          </p>
          {product.sku && (
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              SKU: {product.sku}
            </p>
          )}
          {product.description && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
              {product.description}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-lg font-black text-slate-900">
            {fmtPrice(product.price)}
          </span>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full
            ${product.stock > 5
              ? 'bg-emerald-50 text-emerald-600'
              : product.stock > 0
              ? 'bg-amber-50 text-amber-600'
              : 'bg-rose-50 text-rose-500'}`}>
            {product.stock > 5 ? 'Disponible' : product.stock > 0 ? `Solo ${product.stock}` : 'Agotado'}
          </span>
        </div>

        {waPhone && product.stock > 0 && (
          <a href={whatsappLink(waPhone, product.name, product.price)}
            target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm shadow-emerald-200">
            <MessageCircle size={16} />
            Pedir por WhatsApp
          </a>
        )}
        {!waPhone && product.stock > 0 && (
          <div className="flex items-center justify-center gap-1.5 py-2 bg-slate-50 rounded-xl text-xs text-slate-400 font-medium">
            <ShoppingBag size={13} />
            Consultar disponibilidad
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Página principal del catálogo ──────────────────────── */
export default function PublicCatalog() {
  const [data, setData]           = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [category, setCategory]   = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError]         = useState(null);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (category) params.set('category', category);

      const [catRes, catList] = await Promise.all([
        apiFetch(`${API('/public/catalog')}?${params}`),
        apiFetch(API('/public/catalog/categories')),
      ]);

      if (!catRes.ok) throw new Error('No se pudo cargar el catálogo');
      setData(await catRes.json());
      if (catList.ok) setCategories(await catList.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  useEffect(() => { fetchCatalog(); }, [fetchCatalog]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  const clearSearch = () => { setSearch(''); setSearchInput(''); };

  // ── Error / vacío ─────────────────────────────────────────
  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center p-8">
        <Package size={48} className="text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500 font-medium">Catálogo no disponible</p>
        <p className="text-slate-400 text-sm mt-1">{error}</p>
      </div>
    </div>
  );

  const business = data?.business;
  const products = data?.products || [];
  const waPhone  = business?.whatsapp || business?.phone;

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header del negocio ─────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            {business?.logo_url ? (
              <img src={business.logo_url} alt={business?.name}
                className="w-10 h-10 rounded-xl object-cover border border-slate-200" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                <ShoppingBag size={18} className="text-indigo-600" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="font-black text-slate-900 text-lg leading-tight truncate">
                {loading ? '...' : (business?.name || 'Catálogo')}
              </h1>
              {business?.phone && (
                <a href={`tel:${business.phone}`}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 transition-colors">
                  <Phone size={11} />
                  {business.phone}
                </a>
              )}
            </div>
            {waPhone && (
              <a href={`https://wa.me/${waPhone.replace(/\D/g,'')}`}
                target="_blank" rel="noreferrer"
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all">
                <MessageCircle size={14} />
                WhatsApp
              </a>
            )}
          </div>

          {/* Buscador */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Buscar productos..."
                className="w-full pl-9 pr-8 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 outline-none bg-white"
              />
              {searchInput && (
                <button type="button" onClick={clearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                  <X size={14} />
                </button>
              )}
            </div>
            <button type="submit"
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all">
              Buscar
            </button>
            {categories.length > 0 && (
              <button type="button" onClick={() => setShowFilters(f => !f)}
                className={`px-3 py-2.5 border rounded-xl text-sm font-bold transition-all
                  ${showFilters ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>
                <Filter size={15} />
              </button>
            )}
          </form>

          {/* Filtro categorías */}
          {showFilters && categories.length > 0 && (
            <div className="mt-2 flex gap-2 flex-wrap">
              <button onClick={() => setCategory('')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all
                  ${!category ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                Todos
              </button>
              {categories.map(c => (
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
                <div className="p-4 space-y-2">
                  <div className="h-3 bg-slate-100 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                  <div className="h-8 bg-slate-100 rounded mt-3" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <Package size={48} className="text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-bold text-lg">
              {search ? 'Sin resultados para tu búsqueda' : 'No hay productos disponibles'}
            </p>
            {search && (
              <button onClick={clearSearch}
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
                {category && <span> en <span className="font-bold">{category}</span></span>}
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {products.map(p => (
                <ProductCard key={p.id} product={p} waPhone={waPhone} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────── */}
      <div className="text-center py-8 border-t border-slate-200 mt-4">
        <p className="text-xs text-slate-400">
          Catálogo powered by{' '}
          <a href="https://miinventariofacil.com" target="_blank" rel="noreferrer"
            className="text-indigo-500 font-bold hover:underline inline-flex items-center gap-1">
            Mi Inventario Fácil <ExternalLink size={10} />
          </a>
        </p>
      </div>
    </div>
  );
}
