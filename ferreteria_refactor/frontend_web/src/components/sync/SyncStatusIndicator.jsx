import React from 'react';
import { useAutoSync } from '../../context/AutoSyncContext';
import './SyncStatusIndicator.css';

const SyncStatusIndicator = () => {
    const { syncStatus, syncNow } = useAutoSync();

    const getStatusIcon = () => {
        if (syncStatus.isSyncing) return '...';
        if (!syncStatus.metadataReady) return '!';
        if (!syncStatus.isOnline) return 'OFF';
        if (syncStatus.error) return '!';
        return 'OK';
    };

    const getStatusText = () => {
        if (syncStatus.isSyncing) return 'Sincronizando...';
        if (!syncStatus.metadataReady) return 'Migracion pendiente';
        if (!syncStatus.isOnline) return 'Sin conexion';
        if (syncStatus.error) return 'Error de sync';
        if (syncStatus.lastSync) {
            const minutes = Math.floor((new Date() - new Date(syncStatus.lastSync)) / 60000);
            if (minutes < 1) return 'Sincronizado ahora';
            if (minutes < 60) return `Sincronizado hace ${minutes}m`;
            const hours = Math.floor(minutes / 60);
            return `Sincronizado hace ${hours}h`;
        }
        return 'Listo para sincronizar';
    };

    const getStatusClass = () => {
        if (syncStatus.isSyncing) return 'syncing';
        if (!syncStatus.metadataReady) return 'error';
        if (!syncStatus.isOnline) return 'offline';
        if (syncStatus.error) return 'error';
        return 'online';
    };

    const totalPending = Number(syncStatus.totalPending || syncStatus.pendingSales || 0);

    return (
        <div className={`sync-status-indicator ${getStatusClass()}`}>
            <div className="sync-status-content">
                <span className="sync-icon">{getStatusIcon()}</span>
                <div className="sync-info">
                    <span className="sync-text">{getStatusText()}</span>
                    {totalPending > 0 && (
                        <span className="pending-badge">{totalPending} pendientes</span>
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
                    Sync
                </button>
            )}
        </div>
    );
};

export default SyncStatusIndicator;
