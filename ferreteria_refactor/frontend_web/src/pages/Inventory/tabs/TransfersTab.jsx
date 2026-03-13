import React, { useState } from 'react';
import { ArrowRightLeft, Upload, Download } from 'lucide-react';
import InventoryTransfers from '../../Warehouses/InventoryTransfers';
import ExternalTransferOut from '../Transfers/ExternalTransferOut';
import ExternalTransferIn from '../Transfers/ExternalTransferIn';

const SUB_TABS = [
  { key: 'internal', label: 'Internos',  icon: ArrowRightLeft },
  { key: 'export',   label: 'Exportar',  icon: Upload },
  { key: 'import',   label: 'Importar',  icon: Download },
];

const TransfersTab = () => {
  const [activeTab, setActiveTab] = useState('internal');

  return (
    <div className="space-y-4">
      {/* Sub-tab pill selector */}
      <div className="flex items-center gap-1 p-1 bg-indigo-50 rounded-full w-fit">
        {SUB_TABS.map(({ key, label, icon: Icon }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
                transition-all duration-200
                ${isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-indigo-700 hover:bg-indigo-100'
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
