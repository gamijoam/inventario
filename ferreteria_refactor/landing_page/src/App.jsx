import React from 'react';
import { motion } from 'framer-motion';
import {
  Monitor,
  Wrench,
  Smartphone,
  DollarSign,
  Server,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  CreditCard,
  MessageSquare
} from 'lucide-react';

const App = () => {
  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
  };

  const staggerContainer = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">

      {/* =======================================
          NAVBAR
      ======================================== */}
      <nav className="fixed w-full bg-white/80 backdrop-blur-md z-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-black text-2xl tracking-tighter text-indigo-700">
            <Server className="text-indigo-600" />
            <span>InvenSoft</span>
          </div>
          <div className="hidden md:flex gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-indigo-600 transition-colors">Funcionalidades</a>
            <a href="#tech" className="hover:text-indigo-600 transition-colors">Tecnología</a>
            <a href="#contact" className="hover:text-indigo-600 transition-colors">Contacto</a>
          </div>
          <a
            href="http://localhost:5173"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-full text-sm font-bold transition-transform hover:scale-105 shadow-lg shadow-indigo-500/20"
          >
            Ver Demo Local
          </a>
        </div>
      </nav>

      {/* =======================================
          HERO SECTION
      ======================================== */}
      <section className="pt-32 pb-20 px-6 bg-gradient-to-br from-indigo-50 via-white to-blue-50 overflow-hidden relative">
        {/* Background Blobs */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-300/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-300/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center relative z-10">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="text-indigo-600 font-bold tracking-wide text-sm uppercase bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
              ERP & POS Profesional
            </span>
            <h1 className="text-5xl md:text-6xl font-black mt-6 leading-[1.1] text-slate-900">
              El Control Total para tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">Negocio o Comercio</span>
            </h1>
            <p className="mt-6 text-lg text-slate-600 leading-relaxed">
              Gestiona ventas, inventarios, servicios y finanzas en una sola plataforma robusta. Ideal para Minimarkets, Repuestos, Tecnología y cualquier comercio que necesite control exacto.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <a
                href="http://localhost:5173"
                className="flex items-center justify-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
              >
                <Monitor size={20} />
                Probar Demo
              </a>
              <button className="flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 px-8 py-4 rounded-xl font-bold text-lg hover:bg-slate-50 transition-all hover:border-slate-300">
                Ver Video
              </button>
            </div>
          </motion.div>

          {/* Hero Image / Placeholder */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotate: 2 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border-4 border-slate-800 aspect-video flex items-center justify-center group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 opacity-90" />
              <div className="relative z-10 text-center text-slate-400 p-8">
                <Monitor size={64} className="mx-auto mb-4 text-indigo-500 opacity-50" />
                <p className="font-mono text-sm">Dashboard / POS Screenshot Placeholder</p>
                <p className="text-xs text-slate-600 mt-2">1920 x 1080 px</p>
              </div>

              {/* Floating Cards Effect */}
              <div className="absolute -left-8 top-12 bg-white p-4 rounded-xl shadow-xl border border-slate-100 w-48 rotate-[-6deg] animate-pulse">
                <div className="h-2 w-24 bg-slate-200 rounded mb-2" />
                <div className="h-2 w-16 bg-slate-100 rounded" />
              </div>
              <div className="absolute -right-8 bottom-12 bg-white p-4 rounded-xl shadow-xl border border-slate-100 w-48 rotate-[6deg]">
                <div className="flex items-center gap-2 mb-2 text-green-600 font-bold text-sm">
                  <TrendingUp size={16} /> +15.4% Ventas
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full w-3/4 bg-green-500 rounded-full" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* =======================================
          FEATURES GRID
      ======================================== */}
      <section id="features" className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">Todo lo que necesitas para crecer</h2>
            <p className="text-slate-500 text-lg">InvenSoft unifica todas las áreas de tu negocio en un flujo de trabajo intuitivo y rápido.</p>
          </div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {/* Feature 1: POS Avanzado */}
            <FeatureCard
              icon={<Monitor className="text-blue-500" size={32} />}
              title="Punto de Venta Ágil"
              desc="Facturación ultra-rápida, búsqueda inteligente, accesos directos de teclado y diseño optimizado para pantallas táctiles."
            />
            {/* Feature 2: Multimoneda */}
            <FeatureCard
              icon={<DollarSign className="text-green-500" size={32} />}
              title="Multimoneda Real"
              desc="Cobra en Divisas o Bolívares con tasa automática. Reportes de caja unificados y cálculo de vueltos mixto."
            />
            {/* Feature 3: Servicios Técnicos */}
            <FeatureCard
              icon={<Wrench className="text-slate-600" size={32} />}
              title="Gestión de Servicios"
              desc="Módulo opcional para órdenes de reparación, garantías o servicios profesionales. Ideal para talleres y soporte técnico."
            />
            {/* Feature 4: Seriales / IMEI */}
            <FeatureCard
              icon={<Smartphone className="text-purple-500" size={32} />}
              title="Control de Inventario"
              desc="Traza productos por códigos de barra, seriales o IMEI. Perfecto para electrónicos, repuestos y mercancía general."
            />
            {/* Feature 5: Finanzas */}
            <FeatureCard
              icon={<CreditCard className="text-rose-500" size={32} />}
              title="Avances de Efectivo"
              desc="Módulo dedicado para préstamos o avances de efectivo con cálculo automático de comisiones y control de caja."
            />
            {/* Feature 6: Reportes */}
            <FeatureCard
              icon={<TrendingUp className="text-orange-500" size={32} />}
              title="Reportes Inteligentes"
              desc="Visualiza tus ganancias reales, productos más vendidos y rendimiento de vendedores en tiempo real."
            />
          </motion.div>
        </div>
      </section>

      {/* =======================================
          DETAILS / PREVIEW SECTION
      ======================================== */}
      <section className="py-20 bg-slate-900 text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-black mb-6">Diseñado para la eficiencia diaria</h2>
            <div className="space-y-6">
              <DetailItem
                title="Búsqueda Instantánea"
                desc="Encuentra productos por nombre, código o escaneo de barra en milisegundos."
              />
              <DetailItem
                title="Integración WhatsApp"
                desc="Envía tickets y notificaciones de estado de reparación directamente al cliente."
              />
              <DetailItem
                title="Seguridad Robusta"
                desc="Roles de usuario granulares, auditoría de acciones y respaldos automáticos."
              />
            </div>
            <button className="mt-8 text-indigo-400 font-bold flex items-center gap-2 hover:text-indigo-300 transition-colors">
              Explorar todas las características <ChevronRight size={20} />
            </button>
          </div>

          <div className="relative">
            {/* Decorative Screenshot Stack */}
            <div className="relative z-10 bg-slate-800 rounded-xl border border-slate-700 shadow-2xl shadow-black/50 aspect-[4/3] flex items-center justify-center">
              <span className="text-slate-500 font-mono">UI: Ventas & Servicios</span>
            </div>
            <div className="absolute top-8 -right-8 w-full h-full bg-indigo-900/50 rounded-xl border border-indigo-500/30 -z-0 blur-[1px]" />
          </div>
        </div>
      </section>

      {/* =======================================
          CTA FOOTER
      ======================================== */}
      <footer id="contact" className="bg-white py-20 px-6 border-t border-slate-100">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-black text-slate-900 mb-6">¿Listo para modernizar tu negocio?</h2>
          <p className="text-slate-500 mb-8 text-lg">
            Descarga la versión local y empieza a probar todas las funcionalidades hoy mismo sin costo.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a
              href="http://localhost:5173"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-indigo-500/30 flex items-center justify-center gap-2"
            >
              Inicar Sistema (Localhost)
            </a>
            <button className="flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all border border-transparent hover:border-slate-200">
              <MessageSquare size={18} /> Contactar Soporte
            </button>
          </div>
          <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center text-xs text-slate-400">
            <p>&copy; 2026 InvenSoft. Todos los derechos reservados.</p>
            <div className="flex gap-4 mt-4 md:mt-0">
              <a href="#" className="hover:text-slate-600">Privacidad</a>
              <a href="#" className="hover:text-slate-600">Términos</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Components
const FeatureCard = ({ icon, title, desc }) => (
  <motion.div
    variants={{
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 }
    }}
    className="bg-slate-50 p-6 rounded-2xl hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition-all cursor-default border border-transparent hover:border-slate-100"
  >
    <div className="bg-white w-14 h-14 rounded-xl flex items-center justify-center shadow-sm mb-4 border border-slate-100">
      {icon}
    </div>
    <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3>
    <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
  </motion.div>
);

const DetailItem = ({ title, desc }) => (
  <div className="flex gap-4">
    <div className="mt-1 bg-indigo-500/20 p-1 rounded-full h-fit">
      <ShieldCheck size={16} className="text-indigo-400" />
    </div>
    <div>
      <h4 className="font-bold text-lg text-white mb-1">{title}</h4>
      <p className="text-slate-400 text-sm">{desc}</p>
    </div>
  </div>
);

export default App;
