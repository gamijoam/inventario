import { useEffect } from 'react';

const CHUNK_RELOAD_KEY = 'mif_chunk_reload_attempted';

const isChunkLoadError = (error) => {
    const message = String(error?.message || error?.reason?.message || error || '');
    const name = String(error?.name || error?.reason?.name || '');

    return name === 'ChunkLoadError'
        || /Loading chunk \d+ failed/i.test(message)
        || /Failed to fetch dynamically imported module/i.test(message)
        || /Importing a module script failed/i.test(message);
};

const reloadOnceForFreshAssets = () => {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
    window.setTimeout(() => window.location.reload(), 250);
};

export default function ChunkReloadGuard() {
    useEffect(() => {
        const onUnhandledRejection = (event) => {
            if (isChunkLoadError(event.reason)) reloadOnceForFreshAssets();
        };

        const onError = (event) => {
            if (isChunkLoadError(event.error || event.message)) reloadOnceForFreshAssets();
        };

        window.addEventListener('unhandledrejection', onUnhandledRejection);
        window.addEventListener('error', onError);

        return () => {
            window.removeEventListener('unhandledrejection', onUnhandledRejection);
            window.removeEventListener('error', onError);
        };
    }, []);

    return null;
}
