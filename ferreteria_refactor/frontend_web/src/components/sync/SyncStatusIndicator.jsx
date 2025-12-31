import React from 'react';
import { useAutoSync } from '../context/AutoSyncContext';
import './SyncStatusIndicator.css';

const SyncStatusIndicator = () => {
    const { syncStatus, syncNow } = useAutoSync();

    const getStatusIcon = () => {
        if (syncStatus.isSyncing) return '🔄';
        if (!syncStatus.isOnline) return '📡';
        if (syncStatus.error) return '⚠️';
        return '✅';
    };

    const getStatusText = () => {
        if (syncStatus.isSyncing) return 'Sincronizando...';
        if (!syncStatus.isOnline) return 'Sin conexión';
        if (syncStatus.error) return 'Error de sync';
        if (syncStatus.lastSync) {
            const minutes = Math.floor((new Date() - new Date(syncStatus.lastSync)) / 60000);
            if (minutes < 1) return 'Sincronizado ahora';
            if (minutes < 60) return `Sincronizado hace ${minutes}m`;
            const hours = Math.floor(minutes / 60);
            return `Sincronizado hace ${hours}h`;
        }
        return 'Nunca sincronizado';
    };

    const getStatusClass = () => {
        if (syncStatus.isSyncing) return 'syncing';
        if (!syncStatus.isOnline) return 'offline';
        if (syncStatus.error) return 'error';
        return 'online';
    };

    return (
        <div className={`sync-status-indicator ${getStatusClass()}`}>
            <div className="sync-status-content">
                <span className="sync-icon">{getStatusIcon()}</span>
                <div className="sync-info">
                    <span className="sync-text">{getStatusText()}</span>
                    {syncStatus.pendingSales > 0 && (
                        <span className="pending-badge">{syncStatus.pendingSales} pendientes</span>
                    )}
                </div>
            </div>

            {!syncStatus.isSyncing && (
                <button
                    className="sync-manual-btn"
                    onClick={syncNow}
                    disabled={syncStatus.isSyncing}
                    title="Sincronizar ahora"
                >
                    🔄
                </button>
            )}
        </div>
    );
};

export default SyncStatusIndicator;
