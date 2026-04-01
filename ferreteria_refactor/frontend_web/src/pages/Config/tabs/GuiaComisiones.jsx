import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, HelpCircle, BookOpen,
         ShoppingCart, Wrench, Users, Tag, DollarSign, CheckCircle,
         AlertCircle, ArrowRight } from 'lucide-react';

/* ── helpers ── */
const Toggle = ({ value, onChange }) => (
    <button onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${value ? 'bg-emerald-500' : 'bg-slate-300'}`}>
        <span className={`inline-block h-3.5 w-3.5 mt-0.5 transform rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
);

const Pill = ({ children, color = 'slate' }) => {
    const map = {
        blue:    'bg-blue-100 text-blue-800',
        emerald: 'bg-emerald-100 text-emerald-800',
        violet:  'bg-violet-100 text-violet-800',
        amber:   'bg-amber-100 text-amber-800',
        red:     'bg-red-100 text-red-700',
        slate:   'bg-slate-100 text-slate-700',
        teal:    'bg-teal-100 text-teal-800',
    };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${map[color]}`}>{children}</span>;
};

const Step = ({ n, text, done, active }) => (
    <div className="flex items-start gap-3">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5
            ${active ? 'bg-blue-600 text-white ring-2 ring-blue-200' : done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
            {done ? '✓' : n}
        </div>
        <p className={`text-sm leading-relaxed pt-0.5 ${active ? 'text-slate-800 font-semibold' : done ? 'text-slate-500 line-through' : 'text-slate-600'}`}>{text}</p>
    </div>
);

const InfoBox = ({ icon, title, desc, color = 'blue' }) => {
    const map = { blue: 'bg-blue-50 border-blue-200', amber: 'bg-amber-50 border-amber-200', emerald: 'bg-emerald-50 border-emerald-200' };
    return (
        <div className={`border rounded-xl p-3 flex gap-3 ${map[color]}`}>
            <span className="text-xl shrink-0">{icon}</span>
            <div>
                <p className="text-sm font-bold text-slate-800">{title}</p>
                {desc && <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{desc}</p>}
            </div>
        </div>
    );
};

/* ─── SECCIÓN: Calculadora ─────────────────────────────────────── */
const Calculadora = () => {
    const [sale, setSale]       = useState(100);
    const [hasCat, setHasCat]   = useState(true);
    const [hasRule, setHasRule] = useState(false);
    const [rulePct, setRulePct] = useState(10);
    const [userPct, setUserPct] = useState(8);

    const pct        = hasRule && hasCat ? rulePct : userPct;
    const commission = (userPct === 0 && !hasRule) ? 0 : (sale * pct / 100);
    const source     = hasRule && hasCat ? `Regla de categoría (${rulePct}%)` : `% del usuario (${userPct}%)`;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-semibold text-slate-600 block mb-1">Monto de la venta ($)</label>
                        <input type="number" value={sale} onChange={e => setSale(+e.target.value)}
                            className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:border-blue-400" />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                        <span className="text-xs font-semibold text-slate-700">¿Producto tiene categoría?</span>
                        <Toggle value={hasCat} onChange={setHasCat} />
                    </div>
                    {hasCat && (
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                            <span className="text-xs font-semibold text-slate-700">¿Categoría tiene regla?</span>
                            <Toggle value={hasRule} onChange={setHasRule} />
                        </div>
                    )}
                    {hasRule && hasCat && (
                        <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">% de la regla</label>
                            <div className="flex items-center gap-2">
                                <input type="range" min="0" max="30" value={rulePct} onChange={e => setRulePct(+e.target.value)} className="flex-1" />
                                <span className="text-sm font-bold text-blue-600 w-10 text-right">{rulePct}%</span>
                            </div>
                        </div>
                    )}
                    <div>
                        <label className="text-xs font-semibold text-slate-600 block mb-1">% del usuario</label>
                        <div className="flex items-center gap-2">
                            <input type="range" min="0" max="30" value={userPct} onChange={e => setUserPct(+e.target.value)} className="flex-1" />
                            <span className="text-sm font-bold text-violet-600 w-10 text-right">{userPct}%</span>
                        </div>
                    </div>
                </div>
                <div className={`rounded-2xl p-5 flex flex-col justify-center items-center text-center space-y-2 border-2 ${commission > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    {commission > 0 ? (
                        <>
                            <p className="text-4xl font-black text-emerald-700">${commission.toFixed(2)}</p>
                            <Pill color="emerald">comisión generada</Pill>
                            <p className="text-xs text-slate-500 mt-1">{source}</p>
                            <p className="text-xs text-slate-400">sobre ${sale.toFixed(2)} de venta</p>
                        </>
                    ) : (
                        <>
                            <AlertCircle size={32} className="text-red-400" />
                            <p className="text-sm font-bold text-red-700">Sin comisión</p>
                            <p className="text-xs text-red-500">Usuario con 0% y sin regla activa</p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

/* ─── SECCIÓN: Flujo POS ───────────────────────────────────────── */
const FlujoPOS = () => {
    const [activeStep, setActiveStep] = useState(0);
    const steps = [
        {
            title: '1. El cajero inicia sesión',
            icon: '👤',
            desc: 'El vendedor abre el sistema con su usuario. Asegúrate de que tenga el % de comisión configurado en Configuración → Comisiones → Tasas por Usuario.',
            tip: 'Sin % configurado = sin comisión, aunque venda mucho.',
            example: 'Ejemplo: Juan tiene 10% como Vendedor.',
            color: 'blue',
        },
        {
            title: '2. El cajero abre el POS y busca el producto',
            icon: '🛒',
            desc: 'Va a "Vender" y agrega productos al carrito. El sistema verifica automáticamente si ese producto tiene categoría y si esa categoría tiene regla de comisión.',
            tip: 'No necesitas activar nada en el producto. Solo que tenga su categoría asignada.',
            example: 'Juan agrega "Pantalla Samsung A54" → categoría Repuestos → regla 8%.',
            color: 'violet',
        },
        {
            title: '3. Finaliza la venta',
            icon: '💳',
            desc: 'El cajero cobra al cliente (efectivo, tarjeta, transferencia) y confirma la venta.',
            tip: 'En este momento exacto se genera la comisión automáticamente.',
            example: 'Venta de $200 → comisión de $16 registrada para Juan (8% regla Repuestos).',
            color: 'emerald',
        },
        {
            title: '4. La comisión queda registrada',
            icon: '📊',
            desc: 'Puedes ver todas las comisiones pendientes en Reportes → Comisiones. Se acumulan hasta que el admin las pague.',
            tip: 'Las comisiones no se pagan solas — el admin debe hacer clic en "Pagar" para liquidarlas.',
            example: 'Juan tiene $16 pendientes de cobro.',
            color: 'teal',
        },
        {
            title: '5. El admin paga las comisiones',
            icon: '💵',
            desc: 'Cuando quieras liquidar: Reportes → Comisiones → selecciona el empleado → "Pagar". Elige el método y confirma. Se registra como egreso en la caja.',
            tip: 'Recuerda retirar físicamente el dinero de la caja para que el sistema y la realidad coincidan.',
            example: 'El admin paga $16 a Juan en efectivo. Queda en cero.',
            color: 'amber',
        },
    ];

    const colorMap = {
        blue:    { ring: 'ring-blue-400',    bg: 'bg-blue-600',    light: 'bg-blue-50 border-blue-200' },
        violet:  { ring: 'ring-violet-400',  bg: 'bg-violet-600',  light: 'bg-violet-50 border-violet-200' },
        emerald: { ring: 'ring-emerald-400', bg: 'bg-emerald-600', light: 'bg-emerald-50 border-emerald-200' },
        teal:    { ring: 'ring-teal-400',    bg: 'bg-teal-600',    light: 'bg-teal-50 border-teal-200' },
        amber:   { ring: 'ring-amber-400',   bg: 'bg-amber-500',   light: 'bg-amber-50 border-amber-200' },
    };

    const s = steps[activeStep];
    const c = colorMap[s.color];

    return (
        <div className="space-y-4">
            {/* Step pills */}
            <div className="flex gap-1.5 flex-wrap">
                {steps.map((st, i) => (
                    <button key={i} onClick={() => setActiveStep(i)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${i === activeStep ? `${c.bg} text-white border-transparent` : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                        <span>{st.icon}</span>
                        <span className="hidden sm:inline">Paso {i + 1}</span>
                        <span className="sm:hidden">{i + 1}</span>
                    </button>
                ))}
            </div>

            {/* Active step detail */}
            <div className={`border-2 rounded-2xl p-5 space-y-3 ${c.light}`}>
                <div className="flex items-center gap-3">
                    <span className="text-3xl">{s.icon}</span>
                    <h4 className="font-bold text-slate-800">{s.title}</h4>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{s.desc}</p>
                <div className="bg-white/70 rounded-xl p-3 text-xs text-slate-600 border border-white/80">
                    <span className="font-bold">📌 Tip: </span>{s.tip}
                </div>
                <div className="bg-white/70 rounded-xl p-3 text-xs text-slate-600 border border-white/80">
                    <span className="font-bold">💡 Ejemplo: </span>{s.example}
                </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between">
                <button onClick={() => setActiveStep(p => Math.max(0, p - 1))} disabled={activeStep === 0}
                    className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-30 transition-colors">
                    <ChevronLeft size={14} /> Anterior
                </button>
                <div className="flex gap-1.5 items-center">
                    {steps.map((_, i) => (
                        <div key={i} className={`h-1.5 rounded-full transition-all ${i === activeStep ? `w-4 ${c.bg}` : 'w-1.5 bg-slate-200'}`} />
                    ))}
                </div>
                <button onClick={() => setActiveStep(p => Math.min(steps.length - 1, p + 1))} disabled={activeStep === steps.length - 1}
                    className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-30 transition-colors">
                    Siguiente <ChevronRight size={14} />
                </button>
            </div>
        </div>
    );
};

/* ─── SECCIÓN: Flujo Taller ────────────────────────────────────── */
const FlujoTaller = () => {
    const [activeStep, setActiveStep] = useState(0);
    const steps = [
        {
            title: '1. Se crea la orden de servicio',
            icon: '📋',
            desc: 'El cajero o técnico abre el módulo Servicios → Nueva Orden. Completa los datos del cliente, el equipo y describe el problema. En el Paso 3 puede asignar el técnico desde el inicio.',
            tip: 'Si no asignas técnico al crear, puedes hacerlo después al agregar ítems.',
            example: 'Yamachu (cajera) crea la orden SRV-00010 para reparar un Samsung A54.',
            color: 'blue',
        },
        {
            title: '2. Se agregan los ítems del servicio',
            icon: '🔧',
            desc: 'Dentro de la orden, con el botón "+ Agregar", el técnico registra los trabajos realizados (mano de obra) y los repuestos usados. Cada ítem puede tener su técnico asignado.',
            tip: 'Los ítems de mano de obra no necesitan categoría — el % del técnico se aplica directamente.',
            example: 'Carlos (técnico) agrega "Cambio de pantalla" a $120 y se asigna a sí mismo.',
            color: 'violet',
        },
        {
            title: '3. La orden pasa a estado LISTO',
            icon: '✨',
            desc: 'Cuando el trabajo está terminado, se cambia el estado a "Listo" usando el stepper en la parte superior de la orden. Esto indica que está lista para entregarse al cliente.',
            tip: 'Las comisiones NO se generan al cambiar el estado — solo al cobrar.',
            example: 'Carlos marca la orden como Listo. El cliente va a recoger el equipo.',
            color: 'emerald',
        },
        {
            title: '4. Se cobra la orden',
            icon: '💳',
            desc: 'Con la orden en estado LISTO, aparece el botón verde "Cobrar" en el encabezado. Al presionarlo se abre el formulario de pago: monto e ingresa el método de cobro.',
            tip: 'Este es el momento exacto en que se generan las comisiones automáticamente.',
            example: 'Yamachu cobra $120 en efectivo al cliente.',
            color: 'teal',
        },
        {
            title: '5. Las comisiones se generan automáticamente',
            icon: '💰',
            desc: 'Al confirmar el cobro, el sistema registra las comisiones según la configuración. Si está activo el toggle de vendedor, la cajera también recibe comisión adicional.',
            tip: 'Con "Taller — Vendedor" activo: Yamachu gana su % Y Carlos gana su %. Son comisiones independientes.',
            example: 'Carlos: 15% de $120 = $18 (técnico). Yamachu: 10% de $120 = $12 (vendedora).',
            color: 'amber',
        },
    ];

    const colorMap = {
        blue:    { bg: 'bg-blue-600',    light: 'bg-blue-50 border-blue-200' },
        violet:  { bg: 'bg-violet-600',  light: 'bg-violet-50 border-violet-200' },
        emerald: { bg: 'bg-emerald-600', light: 'bg-emerald-50 border-emerald-200' },
        teal:    { bg: 'bg-teal-600',    light: 'bg-teal-50 border-teal-200' },
        amber:   { bg: 'bg-amber-500',   light: 'bg-amber-50 border-amber-200' },
    };

    const s = steps[activeStep];
    const c = colorMap[s.color];

    return (
        <div className="space-y-4">
            <div className="flex gap-1.5 flex-wrap">
                {steps.map((st, i) => (
                    <button key={i} onClick={() => setActiveStep(i)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${i === activeStep ? `${c.bg} text-white border-transparent` : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                        <span>{st.icon}</span>
                        <span className="hidden sm:inline">Paso {i + 1}</span>
                        <span className="sm:hidden">{i + 1}</span>
                    </button>
                ))}
            </div>
            <div className={`border-2 rounded-2xl p-5 space-y-3 ${c.light}`}>
                <div className="flex items-center gap-3">
                    <span className="text-3xl">{s.icon}</span>
                    <h4 className="font-bold text-slate-800">{s.title}</h4>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{s.desc}</p>
                <div className="bg-white/70 rounded-xl p-3 text-xs text-slate-600 border border-white/80">
                    <span className="font-bold">📌 Tip: </span>{s.tip}
                </div>
                <div className="bg-white/70 rounded-xl p-3 text-xs text-slate-600 border border-white/80">
                    <span className="font-bold">💡 Ejemplo: </span>{s.example}
                </div>
            </div>
            <div className="flex justify-between">
                <button onClick={() => setActiveStep(p => Math.max(0, p - 1))} disabled={activeStep === 0}
                    className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-30">
                    <ChevronLeft size={14} /> Anterior
                </button>
                <div className="flex gap-1.5 items-center">
                    {steps.map((_, i) => (
                        <div key={i} className={`h-1.5 rounded-full transition-all ${i === activeStep ? `w-4 ${c.bg}` : 'w-1.5 bg-slate-200'}`} />
                    ))}
                </div>
                <button onClick={() => setActiveStep(p => Math.min(steps.length - 1, p + 1))} disabled={activeStep === steps.length - 1}
                    className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-30">
                    Siguiente <ChevronRight size={14} />
                </button>
            </div>
        </div>
    );
};

/* ─── COMPONENTE PRINCIPAL ─────────────────────────────────────── */
const TABS = [
    { id: 'como',   label: '¿Cómo funciona?', icon: <BookOpen size={15} /> },
    { id: 'pos',    label: 'Flujo POS',        icon: <ShoppingCart size={15} /> },
    { id: 'taller', label: 'Flujo Taller',     icon: <Wrench size={15} /> },
    { id: 'calc',   label: 'Calculadora',      icon: <DollarSign size={15} /> },
    { id: 'faq',    label: 'FAQ',              icon: <HelpCircle size={15} /> },
];

const GuiaComisiones = ({ onClose }) => {
    const [tab, setTab] = useState('como');

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-lg">$</div>
                        <div>
                            <h2 className="font-bold text-slate-800 text-base">Guía del Sistema de Comisiones</h2>
                            <p className="text-xs text-slate-400">Todo lo que necesitas saber</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                        <X size={18} className="text-slate-500" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 px-4 py-2.5 border-b bg-slate-50/60 shrink-0 overflow-x-auto">
                    {TABS.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${tab === t.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-white hover:text-slate-700'}`}>
                            {t.icon}{t.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">

                    {/* ── CÓMO FUNCIONA ── */}
                    {tab === 'como' && (<>
                        <InfoBox icon="💡" color="blue" title="La idea principal"
                            desc="El sistema calcula automáticamente cuánto gana cada vendedor o técnico por cada venta o servicio. Todo se registra solo — tú solo configuras los porcentajes y el sistema hace el resto." />

                        <div>
                            <h3 className="text-sm font-bold text-slate-700 mb-2">📐 Jerarquía de prioridad</h3>
                            <div className="space-y-2">
                                {[
                                    { n: 1, color: 'bg-blue-600',   label: 'Regla de categoría',    desc: 'Si el producto tiene categoría Y esa categoría tiene una regla configurada → se usa ese %. Tiene la máxima prioridad sobre cualquier otra cosa.' },
                                    { n: 2, color: 'bg-violet-600', label: '% individual del usuario', desc: 'Si no hay regla de categoría → se usa el % que configuraste al usuario. Aplica tanto si el producto tiene categoría como si no.' },
                                    { n: 3, color: 'bg-slate-400',  label: 'Sin comisión',           desc: 'Si el usuario tiene 0% y no hay regla activa → no se genera comisión para esa venta.' },
                                ].map(item => (
                                    <div key={item.n} className="flex gap-3 items-start p-3 bg-slate-50 rounded-xl">
                                        <div className={`w-6 h-6 ${item.color} text-white rounded-full flex items-center justify-center text-xs font-black shrink-0`}>{item.n}</div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-700">{item.label}</p>
                                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <InfoBox icon="⚠️" color="amber" title="Los porcentajes NO se suman"
                            desc="Solo se aplica uno — el de mayor prioridad. Si hay una regla del 10% para la categoría, el usuario gana 10%, aunque su porcentaje individual sea 8%." />

                        <div>
                            <h3 className="text-sm font-bold text-slate-700 mb-2">📍 ¿Cuándo se genera la comisión?</h3>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                                    <p className="text-sm font-bold text-blue-800 flex items-center gap-1.5"><ShoppingCart size={14} /> POS</p>
                                    <p className="text-xs text-blue-700 mt-1">Al finalizar la venta y confirmar el cobro</p>
                                </div>
                                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                                    <p className="text-sm font-bold text-emerald-800 flex items-center gap-1.5"><Wrench size={14} /> Taller</p>
                                    <p className="text-xs text-emerald-700 mt-1">Al presionar "Cobrar" con la orden en estado LISTO</p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-slate-700 mb-2">👥 Tipos de comisión</h3>
                            <div className="space-y-2">
                                {[
                                    { icon: '🛒', title: '% Vendedor', desc: 'Se aplica cuando el usuario hace una venta en el POS, o cuando gestiona una orden del taller (si el toggle "Taller — Vendedor" está activo).' },
                                    { icon: '🔧', title: '% Técnico', desc: 'Se aplica al técnico asignado en cada ítem del taller. Los ítems de mano de obra no necesitan categoría — se usa directamente el % del técnico.' },
                                ].map(item => (
                                    <div key={item.icon} className="flex gap-3 p-3 bg-slate-50 rounded-xl">
                                        <span className="text-xl shrink-0">{item.icon}</span>
                                        <div>
                                            <p className="text-sm font-bold text-slate-700">{item.title}</p>
                                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>)}

                    {/* ── FLUJO POS ── */}
                    {tab === 'pos' && (<>
                        <InfoBox icon="🛒" color="blue" title="Flujo completo — Ventas POS"
                            desc="Sigue cada paso para entender exactamente cómo funciona el sistema desde que el cajero entra hasta que cobra su comisión." />
                        <FlujoPOS />
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                            <p className="text-xs font-bold text-slate-700 mb-2">📋 Requisitos para que funcione el POS:</p>
                            <div className="space-y-1.5">
                                {[
                                    { ok: true,  text: 'Sistema de comisiones activo en Configuración' },
                                    { ok: true,  text: 'Módulo "Ventas POS" activado' },
                                    { ok: true,  text: 'El usuario tiene % Vendedor > 0' },
                                    { ok: false, text: 'El producto no necesita ninguna activación especial — solo tener su categoría asignada si deseas usar reglas' },
                                ].map((r, i) => (
                                    <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
                                        <CheckCircle size={13} className={`mt-0.5 shrink-0 ${r.ok ? 'text-emerald-500' : 'text-blue-400'}`} />
                                        <span>{r.text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>)}

                    {/* ── FLUJO TALLER ── */}
                    {tab === 'taller' && (<>
                        <InfoBox icon="🔧" color="emerald" title="Flujo completo — Módulo Taller"
                            desc="El taller tiene su propio flujo de 5 pasos. Las comisiones se generan al cobrar la orden, no al crearla." />
                        <FlujoTaller />
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                            <p className="text-xs font-bold text-slate-700 mb-2">📋 Requisitos para que funcione el Taller:</p>
                            <div className="space-y-1.5">
                                {[
                                    'Sistema de comisiones activo en Configuración',
                                    'Módulo "Taller — Técnico" activado',
                                    'El técnico tiene % Técnico > 0',
                                    'Para que la cajera también gane: activar "Taller — Vendedor" y que la cajera tenga % Vendedor > 0',
                                    'La orden debe estar en estado LISTO para que aparezca el botón "Cobrar"',
                                ].map((r, i) => (
                                    <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
                                        <CheckCircle size={13} className="mt-0.5 shrink-0 text-emerald-500" />
                                        <span>{r}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>)}

                    {/* ── CALCULADORA ── */}
                    {tab === 'calc' && (<>
                        <p className="text-xs text-slate-500">Ajusta los controles para ver cómo se calcula la comisión en tiempo real.</p>
                        <Calculadora />
                    </>)}

                    {/* ── FAQ ── */}
                    {tab === 'faq' && (
                        <div className="space-y-2">
                            {[
                                { q: '¿Tengo que activar algo en cada producto?',
                                  a: 'No. Solo asigna una categoría al producto. Si esa categoría tiene una regla configurada, se usa ese %. Si no hay regla, se usa el % del usuario vendedor. No hay que tocar nada más en el producto.' },
                                { q: '¿Un usuario puede tener dos porcentajes diferentes?',
                                  a: 'Sí. Cada usuario tiene un "% Vendedor" (para ventas POS) y un "% Técnico" (para trabajos en el taller). Son completamente independientes. Un técnico que también vende en el mostrador puede tener ambos configurados.' },
                                { q: '¿Qué pasa si no hay regla para la categoría?',
                                  a: 'El sistema usa automáticamente el % individual del usuario como respaldo. No se pierde la comisión — solo se calcula con el % del vendedor o técnico que hizo la venta/servicio.' },
                                { q: '¿Cuándo exactamente se genera la comisión del taller?',
                                  a: 'Al momento de COBRAR la orden (botón "Cobrar" que aparece cuando la orden está en estado LISTO). No al crearla, no al cambiar el estado — solo al cobrar.' },
                                { q: '¿Pueden ganar comisión la cajera Y el técnico a la vez?',
                                  a: 'Sí, si activas el toggle "Taller — Vendedor" en Configuración → Comisiones. La cajera gana su % como vendedora y el técnico gana su % por el trabajo. Son comisiones separadas e independientes.' },
                                { q: '¿Cómo pago las comisiones acumuladas?',
                                  a: 'Ve a Reportes → Comisiones. Verás a cada empleado con su saldo pendiente. Haz clic en "Pagar", elige el método de pago y confirma. El sistema registra automáticamente el egreso en la caja activa.' },
                                { q: '¿Qué pasa si anulo una venta?',
                                  a: 'Las comisiones de esa venta pasan a estado "Anulada" automáticamente. No se pagan aunque estuvieran pendientes. El saldo del empleado se ajusta correctamente.' },
                                { q: '¿Dónde veo las comisiones de mis empleados?',
                                  a: 'En Reportes → Comisiones. Puedes ver el resumen por empleado, el rol (Vendedor o Técnico), el módulo (POS o Taller), y el detalle de cada transacción. También puedes exportar a CSV.' },
                            ].map((item, i) => (
                                <details key={i} className="group bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                                    <summary className="px-4 py-3 text-sm font-semibold text-slate-700 cursor-pointer list-none flex justify-between items-center gap-3">
                                        <span>{item.q}</span>
                                        <span className="text-slate-400 text-xs shrink-0 group-open:rotate-180 transition-transform">▼</span>
                                    </summary>
                                    <div className="px-4 pb-3 pt-1 border-t border-slate-200">
                                        <p className="text-xs text-slate-600 leading-relaxed">{item.a}</p>
                                    </div>
                                </details>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t bg-slate-50 rounded-b-2xl shrink-0">
                    <p className="text-xs text-slate-400 text-center">Configuración en: <strong className="text-slate-600">Configuración → Comisiones</strong> · Reportes en: <strong className="text-slate-600">Reportes → Comisiones</strong></p>
                </div>
            </div>
        </div>
    );
};

export default GuiaComisiones;
