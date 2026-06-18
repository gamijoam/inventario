import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRightLeft, Upload, Download } from 'lucide-react';
import InventoryTransfers from '../../Warehouses/InventoryTransfers';
import ExternalTransferOut from '../Transfers/ExternalTransferOut';
import ExternalTransferIn from '../Transfers/ExternalTransferIn';

const SUB_TABS = [
  { key: 'internal', label: 'Internos', icon: ArrowRightLeft, hint: 'Entre almacenes del mismo tenant' },
  { key: 'export', label: 'Exportar', icon: Download, hint: 'Genera paquete y descuenta stock' },
  { key: 'import', label: 'Importar', icon: Upload, hint: 'Recibe paquete de otra empresa' },
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
      {/* Sub-tab selector */}
      <div id="tour-transfers-modes" className="grid grid-cols-1 gap-2 md:grid-cols-3">
        {SUB_TABS.map(({ key, label, icon: Icon, hint }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              id={`tour-transfers-mode-${key}`}
              onClick={() => setActiveTab(key)}
              className={`
                flex min-h-[68px] items-center gap-3 rounded-lg border px-4 text-left transition-colors
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
                <span className="block text-sm font-bold">{label}</span>
                <span className={`block text-xs ${isActive ? 'text-slate-200' : 'text-slate-500'}`}>{hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Active sub-tab content */}
      {activeTab === 'internal' && <InventoryTransfers />}
      {activeTab === 'export'   && <ExternalTransferOut />}
      {activeTab === 'import'   && <ExternalTransferIn />}
    </div>
  );
};

export default TransfersTab;
