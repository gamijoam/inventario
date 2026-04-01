import { useState } from 'react';
import { CheckCircle, Circle, ChevronRight, X, Rocket } from 'lucide-react';
import OnboardingWizard from './OnboardingWizard';

const STEPS = [
  { label: 'Configura tu negocio',     desc: 'Nombre, moneda y teléfono' },
  { label: 'Agrega tus productos',     desc: 'Al menos 1 producto en tu inventario' },
  { label: 'Realiza tu primera venta', desc: 'Prueba el punto de venta' },
];

export default function OnboardingBanner({ currentStep = 0, onDismiss }) {
  const [showWizard, setShowWizard] = useState(false);
  if (currentStep >= 3) return null;

  const pct = Math.round((currentStep / 3) * 100);

  return (
    <>
      <div className="bg-gradient-to-br from-indigo-50 via-violet-50 to-indigo-50 border border-indigo-200 rounded-2xl p-5 mb-6 shadow-sm">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
              <Rocket size={17} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-black text-indigo-900">Completa tu configuración</p>
              <p className="text-xs text-indigo-500">{3 - currentStep} paso(s) restante(s) · ~10 minutos</p>
            </div>
          </div>
          <button onClick={onDismiss}
            className="w-6 h-6 rounded-full bg-white/70 hover:bg-white flex items-center justify-center transition-colors shrink-0">
            <X size={11} className="text-slate-400" />
          </button>
        </div>

        {/* Barra de progreso */}
        <div className="mb-3.5">
          <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
            <span>Progreso</span><span>{pct}%</span>
          </div>
          <div className="h-2 bg-indigo-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-700"
              style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Pasos */}
        <div className="space-y-1.5 mb-4">
          {STEPS.map((s, i) => {
            const done   = i < currentStep;
            const active = i === currentStep;
            return (
              <div key={i} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all
                ${active ? 'bg-white shadow-sm border border-indigo-100' : ''}`}>
                {done
                  ? <CheckCircle size={15} className="text-emerald-500 shrink-0" />
                  : <Circle size={15} className={`shrink-0 ${active ? 'text-indigo-400' : 'text-slate-200'}`} />}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold truncate
                    ${done ? 'line-through text-slate-400' : active ? 'text-slate-800' : 'text-slate-400'}`}>
                    {s.label}
                  </p>
                  {active && <p className="text-[10px] text-slate-400">{s.desc}</p>}
                </div>
                {active && (
                  <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full shrink-0">
                    Ahora
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <button onClick={() => setShowWizard(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-200">
          Continuar configuración
          <ChevronRight size={16} />
        </button>
      </div>

      {showWizard && (
        <OnboardingWizard
          initialStep={currentStep + 1}
          onClose={() => setShowWizard(false)}
        />
      )}
    </>
  );
}
