// Ejemplo de integración en App.jsx o main.jsx

import React from 'react';
import { CloudConfigProvider, useCloudConfig } from './context/CloudConfigContext';
import { AutoSyncProvider } from './context/AutoSyncContext';
import InitialSetupWizard from './components/setup/InitialSetupWizard';
import SyncStatusIndicator from './components/sync/SyncStatusIndicator';

// Componente wrapper que maneja el wizard
function AppWithConfig({ children }) {
    const { config, isLoading } = useCloudConfig();
    const [showWizard, setShowWizard] = React.useState(false);

    React.useEffect(() => {
        if (!isLoading && !config.isConfigured) {
            setShowWizard(true);
        }
    }, [isLoading, config.isConfigured]);

    if (isLoading) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh'
            }}>
                <div>Cargando configuración...</div>
            </div>
        );
    }

    return (
        <>
            {showWizard && (
                <InitialSetupWizard onComplete={() => setShowWizard(false)} />
            )}
            {children}
        </>
    );
}

// Uso en tu App principal
function App() {
    return (
        <CloudConfigProvider>
            <AppWithConfig>
                <AutoSyncProvider>
                    {/* Tu aplicación actual */}
                    <YourMainApp />
                </AutoSyncProvider>
            </AppWithConfig>
        </CloudConfigProvider>
    );
}

// En tu Dashboard o Layout principal, agrega el indicador:
function Dashboard() {
    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <h1>Ferretería POS</h1>
                <SyncStatusIndicator /> {/* Agregar aquí */}
            </header>
            {/* Resto del contenido */}
        </div>
    );
}

export default App;
