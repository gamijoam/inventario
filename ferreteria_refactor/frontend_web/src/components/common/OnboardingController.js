import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAppTour } from '../../hooks/useAppTour';

export default function OnboardingController() {
    const { user } = useAuth();
    const { startTour, markAsCompleted } = useAppTour();

    useEffect(() => {
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

    return null; // This component doesn't render anything visible
}
