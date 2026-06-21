import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRightLeft, Upload, Download, Building2, CheckCircle2, History } from 'lucide-react';
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
    <div id="tour-transfers-panel" className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-400">
              <Building2 size={15} />
              Control de movimientos
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-900">Traslados de inventario</h2>
            <p className="mt-1 max-w-2xl text-sm font-medium text-slate-500">
              Separa movimientos internos, salidas a otra empresa y paquetes recibidos para evitar mezclar operaciones.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2 text-center text-xs font-bold text-slate-500">
            <span className="rounded-md bg-white px-3 py-2 text-slate-700">Interno</span>
            <span className="rounded-md bg-white px-3 py-2 text-indigo-700">JSON + guia</span>
            <span className="rounded-md bg-white px-3 py-2 text-emerald-700">Recepcion</span>
          </div>
        </div>
      </div>

      {/* Sub-tab selector */}
      <div id="tour-transfers-modes" className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
        {SUB_TABS.map(({ key, label, eyebrow, icon: Icon, hint }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              id={`tour-transfers-mode-${key}`}
              onClick={() => setActiveTab(key)}
              className={`
                flex min-h-[86px] items-center gap-3 rounded-lg border px-4 text-left transition-colors
                ${isActive
                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm shadow-indigo-100'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }
              `}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-white/15' : 'bg-slate-100 text-slate-500'}`}>
                <Icon size={18} />
              </span>
              <span className="min-w-0">
                <span className={`mb-0.5 flex items-center gap-1 text-[10px] font-black uppercase ${isActive ? 'text-white/80' : 'text-slate-400'}`}>
                  {isActive && <CheckCircle2 size={12} />}
                  {eyebrow}
                </span>
                <span className="block text-sm font-black">{label}</span>
                <span className={`block text-xs leading-4 ${isActive ? 'text-slate-200' : 'text-slate-500'}`}>{hint}</span>
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
