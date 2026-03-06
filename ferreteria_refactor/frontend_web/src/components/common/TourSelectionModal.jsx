import React, { useState } from 'react';
import { X, Package, ShoppingCart, LayoutDashboard, Layers, DollarSign, Settings, UtensilsCrossed, Scissors, Shirt, Wrench, CheckCircle, RotateCcw } from 'lucide-react';
import { useAppTour, isTourCompleted, resetTourProgress } from '../../hooks/useAppTour';
import { useConfig } from '../../context/ConfigContext';
import { TOUR_FLOWS } from '../../config/tourFlows';

const TOUR_OPTIONS = [
    // Core tours (module: null)
    {
        flowKey: 'WELCOME',
        icon: LayoutDashboard,
        color: 'bg-indigo-600',
        textColor: 'text-white',
        featured: true
    },
    {
        flowKey: 'POS_COMPLETE',
        icon: ShoppingCart,
        color: 'bg-emerald-50',
        textColor: 'text-emerald-700'
    },
    {
        flowKey: 'INVENTORY_COMPLETE',
        icon: Package,
        color: 'bg-blue-50',
        textColor: 'text-blue-700'
    },
    {
        flowKey: 'SALES_CLIENTS',
        icon: Layers,
        color: 'bg-violet-50',
        textColor: 'text-violet-700'
    },
    {
        flowKey: 'FINANCE',
        icon: DollarSign,
        color: 'bg-amber-50',
        textColor: 'text-amber-700'
    },
    {
        flowKey: 'SYSTEM',
        icon: Settings,
        color: 'bg-gray-50',
        textColor: 'text-gray-700'
    },
    // Module tours
    {
        flowKey: 'RESTAURANT',
        icon: UtensilsCrossed,
        color: 'bg-orange-50',
        textColor: 'text-orange-700'
    },
    {
        flowKey: 'BARBERSHOP',
        icon: Scissors,
        color: 'bg-emerald-50',
        textColor: 'text-emerald-700'
    },
    {
        flowKey: 'LAUNDRY',
        icon: Shirt,
        color: 'bg-cyan-50',
        textColor: 'text-cyan-700'
    },
    {
        flowKey: 'SERVICES',
        icon: Wrench,
        color: 'bg-purple-50',
        textColor: 'text-purple-700'
    }
];

export default function TourSelectionModal({ isOpen, onClose }) {
    const { startTour } = useAppTour();
    const { modules } = useConfig();
    const [, forceUpdate] = useState(0);

    if (!isOpen) return null;

    // Filter tours based on module availability
    const visibleTours = TOUR_OPTIONS.filter(option => {
        const flow = TOUR_FLOWS[option.flowKey];
        if (!flow) return false;
        // Core tours (module: null) always visible
        if (!flow.module) return true;
        // Module tours only if module is enabled
        return modules?.[flow.module] === true;
    });

    const coreTours = visibleTours.filter(t => !TOUR_FLOWS[t.flowKey].module);
    const moduleTours = visibleTours.filter(t => TOUR_FLOWS[t.flowKey].module);

    const handleSelectTour = (flowKey) => {
        onClose();
        setTimeout(() => {
            startTour(flowKey);
        }, 300);
    };

    const handleResetProgress = () => {
        resetTourProgress();
        forceUpdate(n => n + 1);
    };

    const renderTourCard = (option) => {
        const flow = TOUR_FLOWS[option.flowKey];
        const completed = isTourCompleted(flow.id);

        return (
            <button
                key={option.flowKey}
                onClick={() => handleSelectTour(option.flowKey)}
                className="flex flex-col items-start p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md hover:bg-slate-50/50 transition-all text-left group relative overflow-hidden h-full"
            >
                <div className="flex items-center justify-between w-full mb-3">
                    <div className={`p-3 rounded-lg ${option.color} ${option.textColor} group-hover:scale-110 transition-transform`}>
                        <option.icon size={24} />
                    </div>
                    {completed && (
                        <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full text-[10px] font-bold border border-emerald-100">
                            <CheckCircle size={12} />
                            Completado
                        </div>
                    )}
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">
                        {flow.title}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                        {flow.description}
                    </p>
                </div>
                {option.featured && (
                    <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                        DESTACADO
                    </div>
                )}
            </button>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="bg-slate-50 border-b border-slate-100 p-6 flex items-start justify-between shrink-0">
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

                {/* Scrollable Content */}
                <div className="overflow-y-auto flex-1 p-6 space-y-6">
                    {/* Core Tours */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Tours Principales</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {coreTours.map(renderTourCard)}
                        </div>
                    </div>

                    {/* Module Tours */}
                    {moduleTours.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Módulos Activos</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {moduleTours.map(renderTourCard)}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-slate-50 p-4 flex items-center justify-between border-t border-slate-100 shrink-0">
                    <span className="text-xs text-slate-400">
                        Puedes volver a abrir este menú desde el botón "Guía de Uso" en el menú lateral.
                    </span>
                    <button
                        onClick={handleResetProgress}
                        className="text-xs text-slate-500 hover:text-indigo-600 font-bold flex items-center gap-1 transition-colors"
                    >
                        <RotateCcw size={12} />
                        Repetir todos
                    </button>
                </div>
            </div>
        </div>
    );
}
