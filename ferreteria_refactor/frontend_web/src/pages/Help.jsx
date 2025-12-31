import { useState } from 'react';
import { helpContent } from '../data/helpContent';

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
        blue: 'bg-blue-50 border-blue-200 text-blue-700',
        green: 'bg-green-50 border-green-200 text-green-700',
        yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
        purple: 'bg-purple-50 border-purple-200 text-purple-700',
        indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
        gray: 'bg-gray-50 border-gray-200 text-gray-700'
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">
                        📚 Centro de Ayuda
                    </h1>
                    <p className="text-gray-600">
                        Aprenda a usar todas las funcionalidades del sistema
                    </p>
                </div>

                {/* Search Bar */}
                <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="🔍 Buscar en la ayuda..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <span className="absolute left-4 top-3.5 text-gray-400 text-xl">
                            🔍
                        </span>
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* Content */}
                {filteredContent.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                        <p className="text-gray-500 text-lg">
                            No se encontraron resultados para "{searchTerm}"
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {filteredContent.map(module => (
                            <div key={module.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
                                {/* Module Header */}
                                <div className={`p-4 border-l-4 ${colorClasses[module.color]}`}>
                                    <h2 className="text-2xl font-bold flex items-center gap-2">
                                        <span className="text-3xl">{module.icon}</span>
                                        {module.title}
                                    </h2>
                                </div>

                                {/* Sections */}
                                <div className="divide-y divide-gray-200">
                                    {module.sections.map(section => {
                                        const key = `${module.id}-${section.id}`;
                                        const isExpanded = expandedSections[key];

                                        return (
                                            <div key={section.id}>
                                                {/* Section Header */}
                                                <button
                                                    onClick={() => toggleSection(module.id, section.id)}
                                                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                                                >
                                                    <h3 className="text-lg font-semibold text-gray-800 text-left">
                                                        {section.title}
                                                    </h3>
                                                    <span className="text-gray-400 text-xl">
                                                        {isExpanded ? '▼' : '▶'}
                                                    </span>
                                                </button>

                                                {/* Section Content */}
                                                {isExpanded && (
                                                    <div className="px-6 pb-6 bg-gray-50">
                                                        {/* Steps */}
                                                        <div className="mb-4">
                                                            <h4 className="font-semibold text-gray-700 mb-2">
                                                                Pasos:
                                                            </h4>
                                                            <ol className="space-y-2">
                                                                {section.steps.map((step, idx) => (
                                                                    <li key={idx} className="flex gap-3">
                                                                        <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                                                                            {idx + 1}
                                                                        </span>
                                                                        <span className="text-gray-700 pt-0.5">
                                                                            {step}
                                                                        </span>
                                                                    </li>
                                                                ))}
                                                            </ol>
                                                        </div>

                                                        {/* Tips */}
                                                        {section.tips && section.tips.length > 0 && (
                                                            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
                                                                <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                                                                    💡 Consejos:
                                                                </h4>
                                                                <ul className="space-y-1">
                                                                    {section.tips.map((tip, idx) => (
                                                                        <li key={idx} className="text-blue-700 text-sm">
                                                                            • {tip}
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

                {/* Footer */}
                <div className="mt-8 bg-white rounded-lg shadow-sm p-6 text-center">
                    <p className="text-gray-600 mb-2">
                        ¿No encontró lo que buscaba?
                    </p>
                    <p className="text-sm text-gray-500">
                        Contacte a soporte técnico: <a href="mailto:soporte@invensoft.lat" className="text-blue-600 hover:underline">soporte@invensoft.lat</a>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Help;
