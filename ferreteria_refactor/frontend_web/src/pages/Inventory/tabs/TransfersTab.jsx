import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRightLeft, Upload, Download, CheckCircle2, History } from 'lucide-react';
import InventoryTransfers from '../../Warehouses/InventoryTransfers';
import ExternalTransferOut from '../Transfers/ExternalTransferOut';
import ExternalTransferIn from '../Transfers/ExternalTransferIn';
import ExternalTransferHistory from '../Transfers/ExternalTransferHistory';

const SUB_TABS = [
  {
    key: 'internal',
    label: 'Traslados internos',
    eyebrow: 'Dentro de la empresa',
    icon: ArrowRightLeft,
    hint: 'Mueve stock entre almacenes sin generar archivo.',
  },
  {
    key: 'export',
    label: 'Enviar a empresa',
    eyebrow: 'Salida externa',
    icon: Download,
    hint: 'Descuenta stock, genera JSON y guia de despacho.',
  },
  {
    key: 'import',
    label: 'Recibir paquete',
    eyebrow: 'Entrada externa',
    icon: Upload,
    hint: 'Valida el archivo recibido antes de sumar inventario.',
  },
  {
    key: 'external-history',
    label: 'Historial externo',
    eyebrow: 'Salidas y entradas',
    icon: History,
    hint: 'Audita paquetes enviados y recibidos entre empresas.',
  },
];

const resolveInitialTab = (mode) => SUB_TABS.some(tab => tab.key === mode) ? mode : 'internal';

const TransfersTab = () => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => resolveInitialTab(searchParams.get('mode')));

  useEffect(() => {
    const mode = searchParams.get('mode');
    if (mode) setActiveTab(resolveInitialTab(mode));
  }, [searchParams]);

  return (
    <div id="tour-transfers-panel" className="space-y-2 animate-in fade-in duration-300">
      <section className="rounded-t-lg border border-b-0 border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-black leading-tight text-slate-900">Traslados</h2>
            <p className="text-xs font-medium text-slate-500">Internos, salidas externas, recepcion e historial.</p>
          </div>
          <div className="hidden flex-wrap items-center gap-1.5 md:flex">
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-black text-slate-600">Interno</span>
            <span className="rounded-md border border-indigo-100 bg-indigo-50 px-2 py-1 text-xs font-black text-indigo-700">JSON + guia</span>
            <span className="rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">Recepcion</span>
          </div>
        </div>
      </section>

      {/* Sub-tab selector */}
      <div id="tour-transfers-modes" className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        {SUB_TABS.map(({ key, label, eyebrow, icon: Icon, hint }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              id={`tour-transfers-mode-${key}`}
              onClick={() => setActiveTab(key)}
              className={`
                flex min-h-[58px] items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors
                ${isActive
                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm shadow-indigo-100'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }
              `}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${isActive ? 'bg-white/15' : 'bg-slate-100 text-slate-500'}`}>
                <Icon size={15} />
              </span>
              <span className="min-w-0">
                <span className={`mb-0.5 flex items-center gap-1 text-[10px] font-black uppercase ${isActive ? 'text-white/80' : 'text-slate-400'}`}>
                  {isActive && <CheckCircle2 size={12} />}
                  {eyebrow}
                </span>
                <span className="block text-xs font-black leading-tight">{label}</span>
                <span className={`hidden text-[11px] leading-4 md:block ${isActive ? 'text-slate-200' : 'text-slate-500'}`}>{hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Active sub-tab content */}
      {activeTab === 'internal' && <InventoryTransfers />}
      {activeTab === 'export'   && <ExternalTransferOut />}
      {activeTab === 'import'   && <ExternalTransferIn />}
      {activeTab === 'external-history' && <ExternalTransferHistory />}
    </div>
  );
};

export default TransfersTab;
