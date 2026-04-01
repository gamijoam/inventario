import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import {
  Store, Package, ShoppingCart, CheckCircle,
  ArrowRight, ArrowLeft, X, Plus, Trash2, Loader
} from 'lucide-react';

/* ── Step indicator ─────────────────────────────────────── */
const StepDot = ({ n, label, current, done }) => (
  <div className="flex flex-col items-center gap-1">
    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm transition-all
      ${done    ? 'bg-emerald-500 text-white' :
        current ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' :
                  'bg-slate-200 text-slate-400'}`}>
      {done ? <CheckCircle size={18} /> : n}
    </div>
    <span className={`text-[10px] font-bold ${current ? 'text-indigo-600' : 'text-slate-400'}`}>{label}</span>
  </div>
);

const StepLine = ({ done }) => (
  <div className={`flex-1 h-1 rounded-full mx-1 mt-4 transition-all ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
);

/* ── Paso 1: Configura tu negocio ───────────────────────── */
function Step1({ onNext }) {
  const [form, setForm] = useState({ name: '', phone: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast.error('Ingresa el nombre del negocio');
    setSaving(true);
    try {
      await apiClient.put('/config/business', { name: form.name, phone: form.phone });
      await apiClient.post('/onboarding/step', { step: 1 });
      toast.success('¡Negocio configurado!');
      onNext();
    } catch (e) {
      toast.error('Error: ' + (e?.response?.data?.detail || e.message));
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Store size={28} className="text-indigo-600" />
        </div>
        <h2 className="text-xl font-black text-slate-800">Configura tu negocio</h2>
        <p className="text-sm text-slate-500 mt-1">Esta información aparecerá en tus facturas y tickets de venta</p>
      </div>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-600 block mb-1.5">Nombre del negocio *</label>
          <p className="text-[11px] text-slate-400 mb-1.5">Tal como aparecerá en los tickets que le envíes a tus clientes</p>
          <input type="text" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Ej: Ferretería González" autoFocus
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 outline-none" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600 block mb-1.5">
            Teléfono / WhatsApp del negocio <span className="font-normal text-slate-400">(opcional)</span>
          </label>
          <p className="text-[11px] text-slate-400 mb-1.5">
            Este número se usará para el botón "Pedir por WhatsApp" del catálogo público.<br/>
            <strong>Incluye el código de país</strong> sin el signo +
          </p>
          <input type="text" value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="Ej: 584121234567 (Venezuela) | 573001234567 (Colombia)"
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 outline-none font-mono" />
          <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px] text-slate-400">
            <span className="bg-slate-50 px-2 py-1 rounded-lg text-center">🇻🇪 58 + número</span>
            <span className="bg-slate-50 px-2 py-1 rounded-lg text-center">🇨🇴 57 + número</span>
            <span className="bg-slate-50 px-2 py-1 rounded-lg text-center">🇲🇽 52 + número</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-lg">💵</span>
          <div>
            <p className="text-sm font-bold text-slate-700">Moneda: Dólar (USD)</p>
            <p className="text-xs text-slate-400">Todos los precios e inventario se manejan en dólares</p>
          </div>
        </div>
      </div>
      <button onClick={handleSubmit} disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all disabled:opacity-60 shadow-lg shadow-indigo-200">
        {saving ? <Loader size={18} className="animate-spin" /> : <ArrowRight size={18} />}
        {saving ? 'Guardando...' : 'Continuar'}
      </button>
    </div>
  );
}

/* ── Paso 2: Agrega productos ───────────────────────────── */
function Step2({ onNext, onBack }) {
  const [products, setProducts] = useState([{ name: '', sku: '', price: '', stock: '' }]);
  const [saving, setSaving] = useState(false);

  const add = () => setProducts(p => [...p, { name: '', sku: '', price: '', stock: '' }]);
  const remove = i => setProducts(p => p.filter((_, idx) => idx !== i));
  const update = (i, f, v) => setProducts(p => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r));

  const handleSubmit = async () => {
    const valid = products.filter(p => p.name.trim() && p.price);
    if (!valid.length) return toast.error('Agrega al menos un producto con nombre y precio');
    setSaving(true);
    try {
      for (const p of valid) {
        await apiClient.post('/products', {
          name: p.name.trim(),
          price: parseFloat(p.price) || 0,
          stock: parseInt(p.stock) || 0,
          is_active: true,
          ...(p.sku && p.sku.trim() ? { sku: p.sku.trim() } : {}),
        });
      }
      await apiClient.post('/onboarding/step', { step: 2 });
      toast.success(`¡${valid.length} producto(s) guardado(s)! Ya puedes venderlos desde el POS ✅`);
      onNext();
    } catch (e) {
      toast.error('Error: ' + (e?.response?.data?.detail || e.message));
    } finally { setSaving(false); }
  };

  const skip = async () => {
    try { await apiClient.post('/onboarding/step', { step: 2 }); } catch {}
    onNext();
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Package size={28} className="text-emerald-600" />
        </div>
        <h2 className="text-xl font-black text-slate-800">Agrega tus primeros productos</h2>
        <p className="text-sm text-slate-500 mt-1">
          Ingresa los productos que vendes. El <span className="font-bold text-slate-600">SKU</span> es tu código interno 
          (ej: "CABLE-01"). Puedes dejarlo en blanco y el sistema lo genera automáticamente.
        </p>
      </div>
      <div className="space-y-2.5">
        <div className="grid grid-cols-12 gap-1.5 text-[10px] font-black text-slate-400 uppercase px-1 mb-0.5">
          <span className="col-span-4">Nombre del producto</span>
          <span className="col-span-2">SKU</span>
          <span className="col-span-2">Precio $</span>
          <span className="col-span-2">Stock</span>
          <span className="col-span-2"></span>
        </div>
        {products.map((p, i) => (
          <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
            <input value={p.name} onChange={e => update(i, 'name', e.target.value)}
              placeholder="Ej: Cable HDMI 2m" autoFocus={i === 0}
              className="col-span-4 px-2.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-300 outline-none" />
            <input value={p.sku || ''} onChange={e => update(i, 'sku', e.target.value)}
              placeholder="Automático"
              className="col-span-2 px-2.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-300 outline-none" />
            <input value={p.price} onChange={e => update(i, 'price', e.target.value)}
              placeholder="0.00" type="number" min="0" step="0.01"
              className="col-span-2 px-2.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-300 outline-none" />
            <input value={p.stock} onChange={e => update(i, 'stock', e.target.value)}
              placeholder="0" type="number" min="0"
              className="col-span-2 px-2.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-300 outline-none" />
            <button onClick={() => remove(i)}
              className="col-span-2 flex justify-center text-slate-300 hover:text-rose-400 transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button onClick={add}
          className="flex items-center gap-1.5 text-xs text-indigo-600 font-bold hover:text-indigo-800 transition-colors py-1">
          <Plus size={14} /> Agregar fila
        </button>
      </div>
      <div className="flex gap-2">
        <button onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
          <ArrowLeft size={16} /> Atrás
        </button>
        <button onClick={handleSubmit} disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all disabled:opacity-60 shadow-lg shadow-indigo-200">
          {saving ? <Loader size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          {saving ? 'Guardando...' : 'Guardar y continuar'}
        </button>
      </div>
      <button onClick={skip} className="w-full text-xs text-slate-400 hover:text-slate-600 py-1 transition-colors">
        Omitir este paso →
      </button>
    </div>
  );
}

/* ── Paso 3: ¡Listo! ────────────────────────────────────── */
function Step3({ onFinish }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const go = async (path) => {
    setLoading(true);
    try { await apiClient.post('/onboarding/complete'); } catch {}
    onFinish();
    navigate(path);
  };

  return (
    <div className="text-center space-y-6 py-2">
      <div className="relative inline-block">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
          <CheckCircle size={40} className="text-emerald-500" />
        </div>
        <span className="absolute -top-1 -right-1 text-xl">🎉</span>
      </div>
      <div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">¡Tu negocio está listo!</h2>
        <p className="text-sm text-slate-500 max-w-sm mx-auto">
          Tu negocio ya está configurado en Mi Inventario Fácil.
          Puedes empezar a cobrar y el sistema registrará todo automáticamente.
        </p>
      </div>
      <div className="space-y-2.5">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">¿Qué quieres hacer primero?</p>
        <button onClick={() => go('/pos')} disabled={loading}
          className="w-full flex items-center gap-3 p-4 border-2 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all text-left">
          <ShoppingCart size={20} className="text-indigo-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-black text-indigo-800">Hacer mi primera venta</p>
            <p className="text-xs text-indigo-600">Abre el punto de venta ahora mismo</p>
          </div>
          <ArrowRight size={16} className="text-indigo-400 shrink-0" />
        </button>
        <button onClick={() => go('/inventory')} disabled={loading}
          className="w-full flex items-center gap-3 p-4 border border-slate-200 hover:bg-slate-50 rounded-xl transition-all text-left">
          <Package size={20} className="text-slate-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-700">Ver mi inventario</p>
            <p className="text-xs text-slate-400">Revisar y agregar más productos</p>
          </div>
          <ArrowRight size={16} className="text-slate-300 shrink-0" />
        </button>
        <button onClick={() => go('/')} disabled={loading}
          className="w-full text-xs text-slate-400 hover:text-slate-600 py-2 transition-colors">
          Ir al dashboard →
        </button>
      </div>
    </div>
  );
}

/* ── Componente principal ───────────────────────────────── */
export default function OnboardingWizard({ onClose, initialStep = 1 }) {
  const [step, setStep] = useState(Math.max(1, Math.min(initialStep, 3)));

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative">

        {/* Header con progreso */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-5">
            <span className="text-xs font-bold text-slate-400">Paso {step} de 3</span>
            {step < 3 && (
              <button onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                <X size={14} className="text-slate-500" />
              </button>
            )}
          </div>
          <div className="flex items-start">
            {[{n:1,l:'Negocio'},{n:2,l:'Productos'},{n:3,l:'¡Listo!'}].map((s, i) => (
              <div key={s.n} className="flex items-start flex-1">
                <StepDot n={s.n} label={s.l} current={step === s.n} done={step > s.n} />
                {i < 2 && <StepLine done={step > s.n} />}
              </div>
            ))}
          </div>
        </div>

        {/* Contenido */}
        <div className="px-6 pb-6">
          {step === 1 && <Step1 onNext={() => setStep(2)} />}
          {step === 2 && <Step2 onNext={() => setStep(3)} onBack={() => setStep(1)} />}
          {step === 3 && <Step3 onFinish={onClose} />}
        </div>
      </div>
    </div>
  );
}
