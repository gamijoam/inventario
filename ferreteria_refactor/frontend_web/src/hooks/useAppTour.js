import { useNavigate, useLocation } from 'react-router-dom';
import api from '../config/axios';
import { TOUR_FLOWS } from '../config/tourFlows';

// --- Driver.js CDN Loader ---
const getDriver = () => {
    if (typeof window === 'undefined') return null;
    const w = window;
    if (w.driver && w.driver.js && w.driver.js.driver) return w.driver.js.driver;
    if (w.driver && w.driver.driver) return w.driver.driver;
    if (typeof w.driver === 'function') return w.driver;
    return null;
};

export const useAppTour = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Helper: Wait for element to exist in DOM (with timeout)
    const waitForElement = (selector, timeout = 5000) => {
        return new Promise((resolve, reject) => {
            if (document.querySelector(selector)) {
                return resolve(document.querySelector(selector));
            }

            const observer = new MutationObserver((mutations) => {
                if (document.querySelector(selector)) {
                    resolve(document.querySelector(selector));
                    observer.disconnect();
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            setTimeout(() => {
                observer.disconnect();
                // Don't reject, just resolve null so tour continues or handles it gracefully
                console.warn(`Tour: Element ${selector} not found within ${timeout}ms`);
                resolve(null);
            }, timeout);
        });
    };

    const startTour = async (flowId = 'GLOBAL', onComplete) => {
        const driverFn = getDriver();
        if (!driverFn) {
            console.warn('Driver.js not loaded via CDN');
            if (onComplete) onComplete();
            return;
        }

        const flow = TOUR_FLOWS[flowId] || TOUR_FLOWS.GLOBAL;

        // Define steps with dynamic navigation logic
        const steps = flow.steps.map(step => ({
            ...step,
            onHighlightStarted: async (element, stepRef, options) => {
                // Check if step requires navigation
                if (step.navigate && location.pathname !== step.navigate) {
                    navigate(step.navigate);
                    // Wait for the target element to appear after navigation
                    if (step.element) {
                        await waitForElement(step.element);
                    }
                }

                // If it's a sidebar group, try to expand it (simulated click if needed)
                if (step.element && step.element.includes('group')) {
                    const el = document.querySelector(step.element);
                    // Logic to expand if collapsed can go here
                }
            }
        }));

        const driverObj = driverFn({
            showProgress: true,
            animate: true,
            allowClose: true,
            overlayColor: 'rgba(15, 23, 42, 0.65)',
            stagePadding: 4,
            popoverClass: 'onboarding-popover-theme',
            nextBtnText: 'Siguiente',
            prevBtnText: 'Anterior',
            doneBtnText: 'Finalizar',
            steps: steps, // Use processed steps
            onDestroyStarted: () => {
                if (onComplete) onComplete();
                driverObj.destroy();
            }
        });

        // Initial Navigation if flow starts on a different page
        if (flow.startUrl && location.pathname !== flow.startUrl) {
            navigate(flow.startUrl);
            // Wait briefly for page load then start
            setTimeout(() => driverObj.drive(), 500);
        } else {
            driverObj.drive();
        }
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
