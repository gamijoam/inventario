import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import {
  Store, Package, ShoppingCart, CheckCircle,
  ArrowRight, ArrowLeft, X, Plus, Trash2, Loader,
  ReceiptText, DollarSign, Phone, Tag, Boxes, LayoutDashboard
} from 'lucide-react';

const IS_DESKTOP_OFFLINE = import.meta.env.VITE_DESKTOP_OFFLINE === 'true' || import.meta.env.VITE_OFFLINE_SETUP === 'true';

const STEPS = [
  { n: 1, label: 'Negocio', desc: 'Datos visibles', icon: Store },
  { n: 2, label: 'Productos', desc: 'Primer stock', icon: Package },
  { n: 3, label: 'Listo', desc: 'Comenzar', icon: CheckCircle },
];

const StepPill = ({ item, current, done }) => {
  const Icon = item.icon;
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-3 transition-all ${
      done ? 'border-emerald-100 bg-emerald-50' : current ? 'border-indigo-100 bg-indigo-50' : 'border-slate-200 bg-white'
    }`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
        done ? 'bg-emerald-600 text-white' : current ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
      }`}>
        {done ? <CheckCircle size={18} /> : <Icon size={18} />}
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-black ${current ? 'text-indigo-900' : done ? 'text-emerald-900' : 'text-slate-600'}`}>{item.label}</p>
        <p className="text-[11px] text-slate-400">{item.desc}</p>
      </div>
    </div>
  );
};

function StepHeader({ icon: Icon, eyebrow, title, description, tone = 'indigo' }) {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };
  return (
    <div className="flex items-start gap-3">
      <div className={`w-11 h-11 rounded-lg border flex items-center justify-center shrink-0 ${tones[tone]}`}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{eyebrow}</p>
        <h2 className="text-2xl font-black text-slate-950 leading-tight">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function Field({ label, hint, icon: Icon, children }) {
  return (
    <div>
      <label className="block text-xs font-black uppercase tracking-wide text-slate-500 mb-1.5">{label}</label>
      {hint && <p className="text-[11px] text-slate-400 mb-1.5">{hint}</p>}
      <div className="relative">
        {Icon && <Icon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />}
        {children}
      </div>
    </div>
  );
}

function Step1({ onNext }) {
  const [form, setForm] = useState({ name: '', phone: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast.error('Ingresa el nombre del negocio');
    setSaving(true);
    try {
      if (IS_DESKTOP_OFFLINE) {
        localStorage.setItem('offline_business_draft', JSON.stringify({ name: form.name.trim(), phone: form.phone.trim() }));
        toast.success('Configuracion local guardada');
        onNext();
        return;
      }

      await apiClient.put('/config/business', { name: form.name.trim(), phone: form.phone.trim() }, { _skipErrorReport: true });
      await apiClient.post('/onboarding/step', { step: 1 }, { _skipErrorReport: true });
      toast.success('Negocio configurado');
      onNext();
    } catch (e) {
      const message = e?.response?.data?.detail || e.message || 'No se pudo guardar la configuracion';
      toast.error('No se pudo guardar: ' + message);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <StepHeader
        icon={Store}
        eyebrow="Paso 1 de 3"
        title="Identidad del negocio"
        description="Estos datos aparecen en tickets, reportes y catalogo publico. Puedes ajustarlos luego desde configuracion."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nombre comercial" hint="Tal como lo vera tu cliente" icon={ReceiptText}>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Ej: Ferreteria Gonzalez"
            autoFocus
            className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
          />
        </Field>
        <Field label="Telefono / WhatsApp" hint="Opcional, con codigo de pais" icon={Phone}>
          <input
            type="text"
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="584121234567"
            className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none font-mono"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3">
          <DollarSign size={17} className="text-indigo-600" />
          <p className="mt-2 text-xs font-black text-indigo-900">Moneda USD</p>
          <p className="text-[11px] text-indigo-700 mt-0.5">Precios base en dolares.</p>
        </div>
        <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
          <ReceiptText size={17} className="text-emerald-600" />
          <p className="mt-2 text-xs font-black text-emerald-900">Tickets listos</p>
          <p className="text-[11px] text-emerald-700 mt-0.5">Nombre visible al vender.</p>
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
          <LayoutDashboard size={17} className="text-slate-500" />
          <p className="mt-2 text-xs font-black text-slate-800">Editable luego</p>
          <p className="text-[11px] text-slate-500 mt-0.5">No queda bloqueado.</p>
        </div>
      </div>

      <button onClick={handleSubmit} disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-black transition-all disabled:opacity-60 shadow-lg shadow-indigo-100">
        {saving ? <Loader size={18} className="animate-spin" /> : <ArrowRight size={18} />}
        {saving ? 'Guardando...' : 'Continuar'}
      </button>
    </div>
  );
}

function Step2({ onNext, onBack }) {
  const [products, setProducts] = useState([{ name: '', sku: '', price: '', stock: '' }]);
  const [saving, setSaving] = useState(false);

  const add = () => setProducts(p => [...p, { name: '', sku: '', price: '', stock: '' }]);
  const remove = i => setProducts(p => p.length === 1 ? p : p.filter((_, idx) => idx !== i));
  const update = (i, f, v) => setProducts(p => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r));

  const handleSubmit = async () => {
    const valid = products.filter(p => p.name.trim() && p.price);
    if (!valid.length) return toast.error('Agrega al menos un producto con nombre y precio');
    setSaving(true);
    try {
      if (IS_DESKTOP_OFFLINE) {
        localStorage.setItem('offline_products_draft', JSON.stringify(valid));
        toast.success(`${valid.length} producto(s) guardado(s) localmente`);
        onNext();
        return;
      }

      for (const p of valid) {
        await apiClient.post('/products', {
          name: p.name.trim(),
          price: parseFloat(p.price) || 0,
          stock: parseInt(p.stock) || 0,
          is_active: true,
          ...(p.sku && p.sku.trim() ? { sku: p.sku.trim() } : {}),
        }, { _skipErrorReport: true });
      }
      await apiClient.post('/onboarding/step', { step: 2 }, { _skipErrorReport: true });
      toast.success(`${valid.length} producto(s) guardado(s)`);
      onNext();
    } catch (e) {
      toast.error('Error: ' + (e?.response?.data?.detail || e.message));
    } finally { setSaving(false); }
  };

  const skip = async () => {
    if (!IS_DESKTOP_OFFLINE) {
      try { await apiClient.post('/onboarding/step', { step: 2 }, { _skipErrorReport: true }); } catch {}
    }
    onNext();
  };

  return (
    <div className="space-y-6">
      <StepHeader
        icon={Package}
        eyebrow="Paso 2 de 3"
        title="Primeros productos"
        description="Carga algunos productos para que el POS no arranque vacio. Puedes importar Excel o editar detalles despues."
        tone="emerald"
      />

      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <div className="hidden md:grid grid-cols-[1.3fr_0.8fr_0.7fr_0.7fr_40px] gap-2 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-400">
          <span>Producto</span><span>SKU</span><span>Precio</span><span>Stock</span><span />
        </div>
        <div className="divide-y divide-slate-100">
          {products.map((product, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-[1.3fr_0.8fr_0.7fr_0.7fr_40px] gap-2 p-3 items-center">
              <div className="relative">
                <Package size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={product.name} onChange={e => update(i, 'name', e.target.value)}
                  placeholder="Cable HDMI 2m" autoFocus={i === 0}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none" />
              </div>
              <div className="relative">
                <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={product.sku || ''} onChange={e => update(i, 'sku', e.target.value)}
                  placeholder="Auto"
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none font-mono" />
              </div>
              <div className="relative">
                <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={product.price} onChange={e => update(i, 'price', e.target.value)}
                  placeholder="0.00" type="number" min="0" step="0.01"
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none" />
              </div>
              <div className="relative">
                <Boxes size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={product.stock} onChange={e => update(i, 'stock', e.target.value)}
                  placeholder="0" type="number" min="0"
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none" />
              </div>
              <button onClick={() => remove(i)} disabled={products.length === 1}
                className="h-10 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-300 transition-colors"
                title="Eliminar fila">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <button onClick={add}
        className="inline-flex items-center gap-2 text-sm text-indigo-600 font-black hover:text-indigo-800 transition-colors">
        <Plus size={15} /> Agregar otro producto
      </button>

      <div className="flex flex-col sm:flex-row gap-2">
        <button onClick={onBack}
          className="flex items-center justify-center gap-1.5 px-4 py-3 border border-slate-200 rounded-lg text-sm font-black text-slate-600 hover:bg-slate-50 transition-all">
          <ArrowLeft size={16} /> Atras
        </button>
        <button onClick={handleSubmit} disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-black transition-all disabled:opacity-60 shadow-lg shadow-indigo-100">
          {saving ? <Loader size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          {saving ? 'Guardando...' : 'Guardar y continuar'}
        </button>
      </div>
      <button onClick={skip} className="w-full text-xs font-bold text-slate-400 hover:text-slate-600 py-1 transition-colors">
        Omitir productos por ahora
      </button>
    </div>
  );
}

function Step3({ onFinish }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const go = async (path) => {
    setLoading(true);
    if (!IS_DESKTOP_OFFLINE) {
      try { await apiClient.post('/onboarding/complete', {}, { _skipErrorReport: true }); } catch {}
    }
    onFinish();
    navigate(path);
  };

  return (
    <div className="space-y-6">
      <StepHeader
        icon={CheckCircle}
        eyebrow="Paso 3 de 3"
        title="Tu negocio esta listo"
        description="Ya puedes vender desde el POS, revisar inventario o entrar al dashboard para ver el resumen."
        tone="emerald"
      />
      <div className="grid grid-cols-1 gap-3">
        <button onClick={() => go('/pos')} disabled={loading}
          className="w-full flex items-center gap-3 p-4 border-2 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all text-left">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0"><ShoppingCart size={20} /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-indigo-900">Hacer mi primera venta</p>
            <p className="text-xs text-indigo-700">Abre el punto de venta ahora mismo.</p>
          </div>
          <ArrowRight size={16} className="text-indigo-500 shrink-0" />
        </button>
        <button onClick={() => go('/inventory-center')} disabled={loading}
          className="w-full flex items-center gap-3 p-4 border border-slate-200 hover:bg-slate-50 rounded-lg transition-all text-left">
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0"><Package size={20} /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-slate-800">Ver inventario</p>
            <p className="text-xs text-slate-500">Revisar productos, stock y categorias.</p>
          </div>
          <ArrowRight size={16} className="text-slate-300 shrink-0" />
        </button>
        <button onClick={() => go('/')} disabled={loading}
          className="w-full flex items-center gap-3 p-4 border border-slate-200 hover:bg-slate-50 rounded-lg transition-all text-left">
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0"><LayoutDashboard size={20} /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-slate-800">Ir al dashboard</p>
            <p className="text-xs text-slate-500">Entrar al resumen principal.</p>
          </div>
          <ArrowRight size={16} className="text-slate-300 shrink-0" />
        </button>
      </div>
      {loading && <p className="text-center text-xs text-slate-400 font-bold">Finalizando configuracion...</p>}
    </div>
  );
}

export default function OnboardingWizard({ onClose, initialStep = 1 }) {
  const [step, setStep] = useState(Math.max(1, Math.min(initialStep, 3)));

  return (
    <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl relative overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between gap-4 p-5 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wide text-indigo-500">Primer arranque</p>
            <h1 className="text-lg font-black text-slate-950">Configuracion inicial</h1>
          </div>
          {step < 3 && (
            <button onClick={onClose}
              className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
              title="Cerrar">
              <X size={16} className="text-slate-500" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] min-h-0">
          <aside className="border-b lg:border-b-0 lg:border-r border-slate-100 bg-slate-50 p-4">
            <div className="grid grid-cols-3 lg:grid-cols-1 gap-2">
              {STEPS.map(item => (
                <StepPill key={item.n} item={item} current={step === item.n} done={step > item.n} />
              ))}
            </div>
          </aside>

          <main className="p-5 sm:p-6 overflow-y-auto">
            {step === 1 && <Step1 onNext={() => setStep(2)} />}
            {step === 2 && <Step2 onNext={() => setStep(3)} onBack={() => setStep(1)} />}
            {step === 3 && <Step3 onFinish={onClose} />}
          </main>
        </div>
      </div>
    </div>
  );
}
