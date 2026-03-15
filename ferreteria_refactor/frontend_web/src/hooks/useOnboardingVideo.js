import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ONBOARDING_VIDEOS } from '../config/onboardingVideos';

// Clave localStorage: aislada por tenant + usuario para evitar cruces
const buildKey = (tenantId, userId, videoKey) =>
    `onboarding_video:${tenantId}:${userId}:${videoKey}`;

export const useOnboardingVideo = (videoKey) => {
    const { user } = useAuth();
    const [showModal, setShowModal] = useState(false);

    const videoConfig = ONBOARDING_VIDEOS[videoKey];

    useEffect(() => {
        if (!videoConfig || !user?.id) return;

        const key = buildKey(user.tenant_id || 'default', user.id, videoKey);
        const alreadySeen = localStorage.getItem(key) === 'true';

        if (!alreadySeen) {
            // Pequeño delay para que la página cargue antes de mostrar el modal
            const timer = setTimeout(() => setShowModal(true), 800);
            return () => clearTimeout(timer);
        }
    }, [videoKey, user?.id, user?.tenant_id, videoConfig]);

    const dismiss = () => {
        if (user?.id && videoConfig) {
            const key = buildKey(user.tenant_id || 'default', user.id, videoKey);
            localStorage.setItem(key, 'true');
        }
        setShowModal(false);
    };

    // Permite re-abrir el video manualmente (botón "Ver tutorial")
    const open = () => setShowModal(true);

    return { showModal, dismiss, open, videoConfig };
};
