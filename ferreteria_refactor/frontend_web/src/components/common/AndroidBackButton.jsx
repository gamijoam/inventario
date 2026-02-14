import { useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';

const AndroidBackButton = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Usamos ref para tener siempre el valor actual sin necesitar re-suscribir el listener
    const locationRef = useRef(location);

    useEffect(() => {
        locationRef.current = location;
    }, [location]);

    useEffect(() => {
        // Solo ejecutar en plataformas nativas (Android/iOS)
        if (!Capacitor.isNativePlatform()) return;

        let backButtonListener;

        const setupListener = async () => {
            backButtonListener = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
                const currentPath = locationRef.current.pathname;

                // Rutas donde deberíamos salir de la app en lugar de ir atrás
                const exitRoutes = ['/', '/login', '/mobile-welcome', '/dashboard'];

                // Debug
                console.log(`[AndroidBackButton] Path: ${currentPath}, CanGoBack (WebView): ${canGoBack}`);

                if (exitRoutes.includes(currentPath)) {
                    CapacitorApp.exitApp();
                } else {
                    // Navegar atrás en el historial de React Router
                    navigate(-1);
                }
            });
        };

        setupListener();

        return () => {
            if (backButtonListener) {
                backButtonListener.remove();
            }
        };
    }, [navigate]); // Solo depende de navigate, que es estable

    return null;
};

export default AndroidBackButton;
