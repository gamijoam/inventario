import { useState, useEffect } from 'react';
import { Plus, List as ListIcon } from 'lucide-react';
import QuoteList from './QuoteList';
import QuoteEditor from './QuoteEditor';

const QuotesManager = () => {
    // Determine initial view based on props or location if needed, default to list
    const [view, setView] = useState('list'); // 'list' or 'editor'
    const [selectedQuoteId, setSelectedQuoteId] = useState(null); // For loading a quote into editor (if we implement editing)

    const handleCreateNew = () => {
        setSelectedQuoteId(null);
        setView('editor');
    };

    const handleBackToList = () => {
        setView('list');
        setSelectedQuoteId(null);
    };

    return (
        <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
            {/* Header / Sub-nav */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-slate-800">
                        {view === 'list' ? 'Gestión de Cotizaciones' : 'Nueva Cotización'}
                    </h1>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button
                        onClick={() => setView('list')}
                        className={`
                            px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-all
                            ${view === 'list'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }
                        `}
                    >
                        <ListIcon size={18} />
                        Listado
                    </button>
                    <button
                        onClick={handleCreateNew}
                        className={`
                            px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-all
                            ${view === 'editor'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }
                        `}
                    >
                        <Plus size={18} />
                        Nueva Cotización
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
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
