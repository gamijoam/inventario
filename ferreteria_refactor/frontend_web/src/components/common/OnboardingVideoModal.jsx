import React from 'react';
import { X, PlayCircle } from 'lucide-react';

export default function OnboardingVideoModal({ videoId, title, onClose }) {
    if (!videoId) return null;

    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <PlayCircle size={20} className="text-emerald-600" />
                        <span className="font-bold text-slate-800">{title || 'Tutorial'}</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Video 16:9 */}
                <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                    <iframe
                        className="absolute inset-0 w-full h-full"
                        src={embedUrl}
                        title={title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    />
                </div>

                {/* Footer */}
                <div className="px-5 py-3 bg-slate-50 flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                        Este video solo se muestra una vez. Puedes volver a verlo desde el botón "Ver tutorial".
                    </span>
                    <button
                        onClick={onClose}
                        className="text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    );
}
