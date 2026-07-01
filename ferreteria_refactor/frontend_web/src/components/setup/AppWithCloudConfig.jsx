import React, { useEffect, useMemo, useState } from 'react';
import { useCloudConfig } from '../../context/CloudConfigContext';
import InitialSetupWizard from './InitialSetupWizard';

const setupRequestedByUrl = () => {
    const search = window.location.search || '';
    const hash = window.location.hash || '';
    return search.includes('setup=1') || hash.includes('setup=1') || hash.includes('setup=true');
};

const AppWithCloudConfig = ({ children }) => {
    const { config, isLoading, isDesktopOffline } = useCloudConfig();
    const setupWizardEnabled = import.meta.env.VITE_SETUP_WIZARD === 'true' || import.meta.env.VITE_OFFLINE_SETUP === 'true' || isDesktopOffline;
    const [showWizard, setShowWizard] = useState(false);

    const shouldShowWizard = useMemo(() => {
        if (setupRequestedByUrl()) return true;
        if (!setupWizardEnabled) return false;
        const completed = localStorage.getItem('offline_setup_completed') === 'true';
        return !completed && !config?.isConfigured;
    }, [config?.isConfigured, setupWizardEnabled]);

    useEffect(() => {
        setShowWizard(shouldShowWizard);
    }, [shouldShowWizard]);

    if (isLoading) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                background: '#f8fafc',
                color: '#0f172a',
                gap: '10px',
                fontFamily: 'system-ui, sans-serif'
            }}>
                <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: '#4f46e5',
                    boxShadow: '0 14px 24px rgba(79, 70, 229, .25)'
                }} />
                <h2 style={{ margin: 0, fontSize: '22px' }}>Cargando Mi Inventario</h2>
                <p style={{ margin: 0, color: '#64748b', fontWeight: 700 }}>Verificando configuracion local...</p>
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
