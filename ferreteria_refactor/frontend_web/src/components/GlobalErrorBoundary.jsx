import React from 'react';

class GlobalErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Global Error Caught:", error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-100 p-4">
                    <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full border-l-4 border-red-500">
                        <h1 className="text-2xl font-bold text-red-600 mb-4">🛑 Ha ocurrido un error inesperado</h1>

                        <div className="bg-red-50 p-4 rounded border border-red-100 mb-6">
                            <p className="text-red-800 font-mono text-sm break-all">
                                {this.state.error && this.state.error.toString()}
                            </p>
                        </div>

                        <details className="mb-6">
                            <summary className="text-gray-600 hover:text-gray-800 cursor-pointer text-sm font-medium">
                                Ver detalles técnicos
                            </summary>
                            <pre className="mt-2 bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-auto max-h-60">
                                {this.state.errorInfo && this.state.errorInfo.componentStack}
                            </pre>
                        </details>

                        <div className="flex gap-4">
                            <button
                                onClick={() => window.location.reload()}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors shadow-sm"
                            >
                                Recargar Aplicación
                            </button>
                            <button
                                onClick={() => window.location.href = '/'}
                                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-bold transition-colors"
                            >
                                Ir al Inicio
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default GlobalErrorBoundary;
