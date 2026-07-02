import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAppTour } from '../../hooks/useAppTour';

const IS_DESKTOP_OFFLINE = import.meta.env.VITE_DESKTOP_OFFLINE === 'true' || import.meta.env.VITE_OFFLINE_SETUP === 'true';

export default function OnboardingController() {
    const { user } = useAuth();
    const { startTour, markAsCompleted } = useAppTour();

    useEffect(() => {
        if (IS_DESKTOP_OFFLINE) return;

        // Only auto-start if user is logged in and onboarding is not completed
        if (user && user.is_onboarding_completed === false) {
            // Small timeout to ensure DOM elements are fully rendered
            const timer = setTimeout(() => {
                startTour('WELCOME', async () => {
                    // This callback runs when the tour ends (Close or Finish)
                    await markAsCompleted();
                });
            }, 1500);

            return () => clearTimeout(timer);
        }
    }, [user, startTour, markAsCompleted]);

    if (IS_DESKTOP_OFFLINE) return null;

    return null; // This component doesn't render anything visible
}
