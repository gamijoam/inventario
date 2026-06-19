import React from 'react';
import { AlertTriangle, Home, RefreshCw, Bug } from 'lucide-react';
import { reportClientError } from '../utils/errorReporter';

class GlobalErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null, showDetails: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Global Error Caught:', error, errorInfo);
        reportClientError({
            kind: 'CLIENT_ERROR',
            source: 'GlobalErrorBoundary',
            error,
            component_stack: errorInfo?.componentStack,
        });
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-100 p-4 text-slate-950">
                    <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/60">
                        <div className="border-b border-slate-100 bg-slate-950 px-6 py-6 text-white">
                            <div className="flex items-start gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500 text-white shadow-lg shadow-rose-950/30">
                                    <AlertTriangle size={24} />
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-200">Error inesperado</p>
                                    <h1 className="mt-2 text-2xl font-black tracking-tight">No se pudo mostrar esta pantalla</h1>
                                    <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                                        La aplicacion encontro un problema visual. Puedes recargar para intentar continuar o volver al inicio.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 p-6">
                            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
                                {this.state.error ? this.state.error.toString() : 'Error desconocido'}
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row">
                                <button
                                    onClick={() => window.location.reload()}
                                    className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-black text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700"
                                >
                                    <RefreshCw size={17} />
                                    Recargar
                                </button>
                                <button
                                    onClick={() => { window.location.href = '/#/'; }}
                                    className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                                >
                                    <Home size={17} />
                                    Ir al inicio
                                </button>
                                <button
                                    onClick={() => this.setState(s => ({ showDetails: !s.showDetails }))}
                                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-600 transition hover:bg-slate-100"
                                >
                                    <Bug size={17} />
                                    Detalles
                                </button>
                            </div>

                            {this.state.showDetails && (
                                <pre className="max-h-64 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                                    {this.state.errorInfo?.componentStack || 'Sin detalles tecnicos disponibles.'}
                                </pre>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default GlobalErrorBoundary;
