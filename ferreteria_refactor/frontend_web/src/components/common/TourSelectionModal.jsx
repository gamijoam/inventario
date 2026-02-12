import React from 'react';
import { X, Play, Package, ShoppingCart, LayoutDashboard, Layers, DollarSign, Settings } from 'lucide-react';
import { useAppTour } from '../../hooks/useAppTour';

export default function TourSelectionModal({ isOpen, onClose }) {
    const { startTour } = useAppTour();

    if (!isOpen) return null;

    const tourOptions = [
        {
            id: 'FULL_SYSTEM',
            title: 'Recorrido Maestro',
            description: 'Un paseo completo por todo el sistema (Recomendado).',
            icon: Layers,
            color: 'bg-indigo-600',
            textColor: 'text-white'
        },
        {
            id: 'GLOBAL',
            title: 'Tour Rápido',
            description: 'Resumen del Dashboard principal.',
            icon: LayoutDashboard,
            color: 'bg-slate-100',
            textColor: 'text-slate-700'
        },
        {
            id: 'INVENTORY_FLOW',
            title: 'Inventario',
            description: 'Productos, Almacenes y Movimientos.',
            icon: Package,
            color: 'bg-blue-50',
            textColor: 'text-blue-700'
        },
        {
            id: 'SALES_FLOW',
            title: 'Ventas (POS)',
            description: 'Caja, Facturación y Clientes.',
            icon: ShoppingCart,
            color: 'bg-emerald-50',
            textColor: 'text-emerald-700'
        },
        {
            id: 'FINANCE_FLOW',
            title: 'Finanzas',
            description: 'Compras, Proveedores y Gastos.',
            icon: DollarSign,
            color: 'bg-amber-50',
            textColor: 'text-amber-700'
        },
        {
            id: 'SYSTEM_FLOW',
            title: 'Sistema',
            description: 'Usuarios, Seguridad y Configuración.',
            icon: Settings,
            color: 'bg-gray-50',
            textColor: 'text-gray-700'
        }
    ];

    const handleSelectTour = (flowId) => {
        onClose();
        setTimeout(() => {
            startTour(flowId);
        }, 300);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-slate-50 border-b border-slate-100 p-6 flex items-start justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Guía de Uso Interactiva</h2>
                        <p className="text-slate-500 mt-1">Selecciona un módulo para aprender a usarlo paso a paso.</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-lg transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Grid */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tourOptions.map((option) => (
                        <button
                            key={option.id}
                            onClick={() => handleSelectTour(option.id)}
                            className="flex flex-col items-start p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md hover:bg-slate-50/50 transition-all text-left group relative overflow-hidden h-full"
                        >
                            <div className={`p-3 rounded-lg ${option.color} ${option.textColor} mb-3 group-hover:scale-110 transition-transform`}>
                                <option.icon size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">
                                    {option.title}
                                </h3>
                                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                                    {option.description}
                                </p>
                            </div>
                            {option.id === 'FULL_SYSTEM' && (
                                <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                                    DESTACADO
                                </div>
                            )}
                        </button>
                    ))}
                </div>

                {/* Footer */}
                <div className="bg-slate-50 p-4 text-center text-xs text-slate-400 border-t border-slate-100">
                    Puedes volver a abrir este menú en cualquier momento desde el botón "Guía de Uso" en el menú lateral.
                </div>
            </div>
        </div>
    );
}
