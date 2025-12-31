import { useState } from 'react';
import apiClient from '../../config/axios';
import toast from 'react-hot-toast';
import { CloudDownload, RefreshCw } from 'lucide-react';

export default function SyncButton() {
    const [loading, setLoading] = useState(false);

    const handleSync = async () => {
        setLoading(true);
        const toastId = toast.loading('Sincronizando con la nube...');

        try {
            // Trigger the local backend to pull from VPS
            const response = await apiClient.post('/sync-local/trigger');

            console.log("Sync Result:", response.data);

            toast.success(`Sincronización Completada!`, { id: toastId });
            toast.success(`${response.data.details.products} productos actualizados.`);

            // Optional: Reload page to show new data
            setTimeout(() => window.location.reload(), 1500);

        } catch (error) {
            console.error(error);
            toast.error('Error al sincronizar. Verifique su internet.', { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleSync}
            disabled={loading}
            className={`
                flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${loading
                    ? 'bg-blue-100 text-blue-800 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                }
            `}
            title="Descargar catálogo actualizado"
        >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Sincronizando...' : 'Sincronizar'}
        </button>
    );
}
