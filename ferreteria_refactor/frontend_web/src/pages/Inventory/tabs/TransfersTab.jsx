import React, { useState } from 'react';
import { ArrowRightLeft, Upload, Download } from 'lucide-react';
import InventoryTransfers from '../../Warehouses/InventoryTransfers';
import ExternalTransferOut from '../Transfers/ExternalTransferOut';
import ExternalTransferIn from '../Transfers/ExternalTransferIn';

const SUB_TABS = [
  { key: 'internal', label: 'Internos',  icon: ArrowRightLeft },
  { key: 'export',   label: 'Exportar',  icon: Download },
  { key: 'import',   label: 'Importar',  icon: Upload },
];

const TransfersTab = () => {
  const [activeTab, setActiveTab] = useState('internal');

  return (
    <div className="space-y-4">
      {/* Sub-tab pill selector */}
      <div className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        {SUB_TABS.map(({ key, label, icon: Icon }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`
                flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-bold
                transition-colors
                ${isActive
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }
              `}
            >
              <Icon size={16} />
              {label}
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
