import React, { useState } from 'react';
import { Plus, List as ListIcon, FileText } from 'lucide-react';
import QuoteList from './QuoteList';
import QuoteEditor from './QuoteEditor';
import clsx from 'clsx';

const QuotesManager = () => {
    const [view, setView] = useState('list'); // 'list' or 'editor'
    const [selectedQuoteId, setSelectedQuoteId] = useState(null);

    const handleCreateNew = () => {
        setSelectedQuoteId(null);
        setView('editor');
    };

    const handleBackToList = () => {
        setView('list');
        setSelectedQuoteId(null);
    };

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col bg-slate-50 overflow-hidden p-4 gap-4">
            {/* Header / Sub-nav */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center shadow-sm z-30 flex-shrink-0">
                <div className="flex items-center gap-3 mb-4 sm:mb-0">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                        <FileText size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">
                            {view === 'list' ? 'Gestión de Cotizaciones' : selectedQuoteId ? 'Editar Cotización' : 'Nueva Cotización'}
                        </h1>
                        <p className="text-sm text-slate-500 font-medium">
                            {view === 'list' ? 'Administra tus presupuestos' : 'Crea una propuesta comercial'}
                        </p>
                    </div>
                </div>

                <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                    <button
                        onClick={() => setView('list')}
                        className={clsx(
                            "px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all",
                            view === 'list'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        )}
                    >
                        <ListIcon size={18} />
                        Listado
                    </button>
                    <button
                        onClick={handleCreateNew}
                        className={clsx(
                            "px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all",
                            view === 'editor'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        )}
                    >
                        <Plus size={18} />
                        Nueva Cotización
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative rounded-2xl border border-slate-200 bg-white shadow-sm">
                {view === 'list' ? (
                    <QuoteList onCreateNew={handleCreateNew} onEdit={(id) => { setSelectedQuoteId(id); setView('editor'); }} />
                ) : (
                    <QuoteEditor
                        quoteId={selectedQuoteId}
                        onBack={handleBackToList}
                    />
                )}
            </div>
        </div>
    );
};

export default QuotesManager;
