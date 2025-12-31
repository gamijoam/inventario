import React, { useState, useEffect } from 'react';
import { useCloudConfig } from '../../context/CloudConfigContext';
import InitialSetupWizard from './InitialSetupWizard';

const AppWithCloudConfig = ({ children }) => {
    const { config, isLoading } = useCloudConfig();
    const [showWizard, setShowWizard] = useState(false);

    useEffect(() => {
        // Solo mostrar wizard si no está configurado Y no estamos cargando
        if (!isLoading && !config.isConfigured) {
            setShowWizard(true);
        }
    }, [isLoading, config.isConfigured]);

    // Pantalla de carga mientras se verifica la configuración
    if (isLoading) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white'
            }}>
                <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔄</div>
                <h2 style={{ margin: '0 0 10px 0' }}>Cargando Ferretería POS</h2>
                <p style={{ margin: 0, opacity: 0.8 }}>Verificando configuración...</p>
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
};

export default AppWithCloudConfig;
