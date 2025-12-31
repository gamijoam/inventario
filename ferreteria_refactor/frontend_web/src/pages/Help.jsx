import { useState } from 'react';
import { helpContent } from '../data/helpContent';
import { Search, ChevronDown, ChevronRight, HelpCircle, BookOpen, ExternalLink, Mail } from 'lucide-react';
import clsx from 'clsx';

const Help = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedSections, setExpandedSections] = useState({});

    // Toggle section expansion
    const toggleSection = (moduleId, sectionId) => {
        const key = `${moduleId}-${sectionId}`;
        setExpandedSections(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    // Filter content based on search
    const filteredContent = helpContent.map(module => {
        if (!searchTerm) return module;

        const filteredSections = module.sections.filter(section =>
            section.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            section.steps.some(step => step.toLowerCase().includes(searchTerm.toLowerCase())) ||
            section.tips?.some(tip => tip.toLowerCase().includes(searchTerm.toLowerCase()))
        );

        return filteredSections.length > 0 ? { ...module, sections: filteredSections } : null;
    }).filter(Boolean);

    const colorClasses = {
        blue: 'bg-blue-100 text-blue-600',
        green: 'bg-emerald-100 text-emerald-600',
        yellow: 'bg-amber-100 text-amber-600',
        purple: 'bg-purple-100 text-purple-600',
        indigo: 'bg-indigo-100 text-indigo-600',
        gray: 'bg-slate-100 text-slate-600'
    };

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col bg-slate-50 p-6 overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                            <BookOpen size={24} />
                        </div>
                        Centro de Ayuda
                    </h1>
                    <p className="text-slate-500 font-medium ml-12">Documentación y guías de uso</p>
                </div>
            </div>

            {/* Search Bar */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6 flex-shrink-0">
                <div className="relative max-w-2xl mx-auto">
                    <Search className="absolute left-4 top-4 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar en la documentación (ej: 'caja', 'devolución')..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-12 py-3.5 border border-slate-200 rounded-xl text-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium text-slate-700 shadow-sm"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full p-1"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {filteredContent.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 border-dashed">
                        <HelpCircle size={64} className="text-slate-200 mb-4" />
                        <p className="text-slate-500 text-lg font-bold">
                            No se encontraron resultados para "{searchTerm}"
                        </p>
                        <p className="text-slate-400 text-sm mt-1">Intenta con otros términos</p>
                    </div>
                ) : (
                    <div className="space-y-8 pb-10">
                        {filteredContent.map(module => (
                            <div key={module.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                {/* Module Header */}
                                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-4">
                                    <div className={clsx("w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm", colorClasses[module.color])}>
                                        {module.icon}
                                    </div>
                                    <h2 className="text-xl font-bold text-slate-800">{module.title}</h2>
                                </div>

                                {/* Sections */}
                                <div className="divide-y divide-slate-100">
                                    {module.sections.map(section => {
                                        const key = `${module.id}-${section.id}`;
                                        const isExpanded = expandedSections[key];

                                        return (
                                            <div key={section.id} className="group">
                                                {/* Section Header */}
                                                <button
                                                    onClick={() => toggleSection(module.id, section.id)}
                                                    className="w-full px-6 py-5 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
                                                >
                                                    <h3 className="text-base font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">
                                                        {section.title}
                                                    </h3>
                                                    <span className={clsx("text-slate-400 transition-transform", isExpanded && "rotate-90 text-indigo-500")}>
                                                        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                                    </span>
                                                </button>

                                                {/* Section Content */}
                                                {isExpanded && (
                                                    <div className="px-6 pb-6 animate-in fade-in slide-in-from-top-2 duration-200">
                                                        {/* Steps */}
                                                        <div className="ml-2 pl-4 border-l-2 border-slate-100">
                                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                                                                Pasos a seguir
                                                            </h4>
                                                            <ol className="space-y-4">
                                                                {section.steps.map((step, idx) => (
                                                                    <li key={idx} className="flex gap-4">
                                                                        <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md shadow-indigo-200">
                                                                            {idx + 1}
                                                                        </span>
                                                                        <span className="text-slate-600 font-medium text-sm pt-0.5 leading-relaxed">
                                                                            {step}
                                                                        </span>
                                                                    </li>
                                                                ))}
                                                            </ol>
                                                        </div>

                                                        {/* Tips */}
                                                        {section.tips && section.tips.length > 0 && (
                                                            <div className="mt-6 bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-xl">
                                                                <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2 text-sm">
                                                                    💡 Consejos Útiles
                                                                </h4>
                                                                <ul className="space-y-2">
                                                                    {section.tips.map((tip, idx) => (
                                                                        <li key={idx} className="text-blue-700 text-sm flex gap-2">
                                                                            <span className="text-blue-400">•</span>
                                                                            {tip}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="mt-6 bg-slate-900 rounded-2xl p-8 text-center text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <HelpCircle size={120} />
                    </div>
                    <p className="text-indigo-200 font-bold mb-2 uppercase text-xs tracking-wider">¿Necesitas más ayuda?</p>
                    <p className="text-xl font-bold mb-6">Estamos aquí para ayudarte a gestionar tu negocio</p>
                    <a
                        href="mailto:soporte@invensoft.lat"
                        className="inline-flex items-center gap-2 bg-white text-slate-900 px-6 py-3 rounded-xl font-bold hover:bg-slate-100 transition-colors shadow-lg active:scale-95"
                    >
                        <Mail size={18} />
                        Contactar Soporte
                    </a>
                </div>
            </div>
        </div>
    );
};

export default Help;
