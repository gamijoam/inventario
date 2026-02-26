import React, { useState } from 'react';
import { X, Search, User, Scissors, Check } from 'lucide-react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '../../components/ui/sheet';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { cn } from '../../lib/utils';

const EmployeeSelectionModal = ({ isOpen, onClose, onSelect, employees = [] }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredEmployees = employees.filter(emp =>
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        emp.status === 'ACTIVE'
    );

    const handleSelect = (employee) => {
        onSelect(employee);
        onClose();
        setSearchTerm('');
    };

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent side="right" className="w-full sm:w-[400px] flex flex-col p-0 gap-0 bg-slate-50">
                <SheetHeader className="p-6 border-b border-slate-200 bg-white">
                    <div className="flex items-center justify-between">
                        <SheetTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <Scissors size={20} className="text-indigo-600" />
                            Asignar Profesional
                        </SheetTitle>
                        {/* <Button variant="ghost" size="icon" onClick={onClose}><X size={20} /></Button> */}
                    </div>
                </SheetHeader>

                <div className="p-4 bg-white border-b border-slate-100">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        <Input
                            placeholder="Buscar barbero/estilista..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 h-10 border-slate-200 focus:ring-indigo-500"
                            autoFocus
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                    {filteredEmployees.length > 0 ? (
                        filteredEmployees.map(emp => (
                            <button
                                key={emp.id}
                                onClick={() => handleSelect(emp)}
                                className="w-full flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50/30 transition-all text-left group shadow-sm"
                            >
                                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                    <User size={24} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">{emp.name}</h3>
                                    <p className="text-xs text-slate-500">#{emp.document_id || 'Sin ID'}</p>
                                </div>
                                <div className="p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Check className="text-indigo-600" size={20} />
                                </div>
                            </button>
                        ))
                    ) : (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                <User size={32} />
                            </div>
                            <p className="text-slate-500 font-medium">No se encontraron profesionales</p>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-white border-t border-slate-200">
                    <Button
                        variant="outline"
                        className="w-full text-slate-500"
                        onClick={onClose}
                    >
                        Cancelar
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
};

export default EmployeeSelectionModal;
