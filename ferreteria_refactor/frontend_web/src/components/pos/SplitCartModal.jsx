import React from "react";
import { X, Smartphone, Cable } from "lucide-react";
import { Button } from "../ui/button";

const SplitCartModal = ({ isOpen, onClose, onSplit }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-bold text-slate-800">Carrito Mixto Detectado</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 text-center space-y-4">
                    <div className="flex justify-center items-center gap-4 text-slate-400">
                        <Smartphone size={40} className="text-indigo-500" />
                        <span className="text-2xl font-black text-slate-300">+</span>
                        <Cable size={40} className="text-emerald-500" />
                    </div>
                    
                    <div>
                        <h4 className="text-lg font-black text-slate-800 mb-2">Debes dividir esta venta</h4>
                        <p className="text-sm text-slate-600">
                            Tienes celulares (crédito) y accesorios (contado) en el mismo carrito. Para mantener la contabilidad clara, el sistema facturará los accesorios al contado primero.
                        </p>
                    </div>

                    <div className="pt-4 space-y-3">
                        <Button 
                            onClick={onSplit}
                            className="w-full h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-200"
                        >
                            Facturar Accesorios al Contado
                        </Button>
                        <Button 
                            variant="ghost" 
                            onClick={onClose}
                            className="w-full text-slate-500 hover:bg-slate-100"
                        >
                            Cancelar
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SplitCartModal;
