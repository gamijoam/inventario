import { useNavigate } from 'react-router-dom';
import api from '../config/axios';

const getDriver = () => {
    // Check multiple locations for driver object from CDN
    if (typeof window === 'undefined') return null;
    const w = window;
    // driver.js v1.0+ usually exposes window.driver.js.driver
    if (w.driver && w.driver.js && w.driver.js.driver) return w.driver.js.driver;
    // fallback
    if (w.driver && w.driver.driver) return w.driver.driver;
    // fallback
    if (typeof w.driver === 'function') return w.driver;

    return null;
};

export const useAppTour = () => {
    const navigate = useNavigate();

    const startTour = (onComplete) => {
        const driverFn = getDriver();
        if (!driverFn) {
            console.warn('Driver.js not loaded via CDN');
            if (onComplete) onComplete();
            return;
        }

        const driverObj = driverFn({
            showProgress: true,
            animate: true,
            allowClose: true,
            overlayColor: 'rgba(15, 23, 42, 0.65)', // Slate 900 with opacity
            stagePadding: 4,
            popoverClass: 'onboarding-popover-theme',
            nextBtnText: 'Siguiente',
            prevBtnText: 'Anterior',
            doneBtnText: 'Finalizar',
            steps: [
                {
                    element: '#sidebar-dashboard',
                    popover: {
                        title: '🚀 Dashboard Principal',
                        description: 'Aquí tienes el resumen en tiempo real de tu negocio. Puedes ver ventas, ganancias y métricas clave de un vistazo.',
                        side: "right",
                        align: 'start'
                    }
                },
                {
                    element: '#btn-new-product',
                    popover: {
                        title: '📦 Gestión de Inventario',
                        description: 'Crea tus productos o servicios rápidamente desde aquí. Mantén tu stock siempre organizado.',
                        side: "bottom",
                        align: 'center'
                    }
                },
                {
                    element: '#sidebar-sales',
                    popover: {
                        title: '💰 Ventas y Facturación',
                        description: 'Registra nuevas ventas, consulta el historial y gestiona tus cuentas por cobrar en un solo lugar.',
                        side: "right",
                        align: 'start'
                    }
                },
                {
                    element: '#user-menu',
                    popover: {
                        title: '👤 Tu Perfil',
                        description: 'Configura tu cuenta, gestiona tu suscripción y personaliza tus preferencias aquí.',
                        side: "bottom",
                        align: 'end'
                    }
                }
            ],
            onDestroyStarted: () => {
                if (onComplete) onComplete();
            }
        });

        driverObj.drive();
    };

    const markAsCompleted = async () => {
        try {
            await api.post('/users/me/onboarding-completed');
        } catch (error) {
            console.error('Error marking onboarding as completed:', error);
        }
    };

    return { startTour, markAsCompleted };
};
