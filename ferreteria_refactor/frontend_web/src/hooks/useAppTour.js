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

// --- Per-tour completion tracking (localStorage) ---
const STORAGE_KEY = 'completed_tours';

const getCompletedTours = () => {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
        return [];
    }
};

const markTourCompleted = (tourId) => {
    const completed = getCompletedTours();
    if (!completed.includes(tourId)) {
        completed.push(tourId);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
    }
};

export const isTourCompleted = (tourId) => getCompletedTours().includes(tourId);

export const resetTourProgress = () => {
    localStorage.removeItem(STORAGE_KEY);
};

export const useAppTour = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Helper: Wait for element to exist in DOM (with timeout)
    const waitForElement = (selector, timeout = 5000) => {
        return new Promise((resolve) => {
            if (document.querySelector(selector)) {
                return resolve(document.querySelector(selector));
            }

            const observer = new MutationObserver(() => {
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
                console.warn(`Tour: Element ${selector} not found within ${timeout}ms`);
                resolve(null);
            }, timeout);
        });
    };

    const startTour = async (flowId = 'WELCOME', onComplete) => {
        const driverFn = getDriver();
        if (!driverFn) {
            console.warn('Driver.js not loaded via CDN');
            if (onComplete) onComplete();
            return;
        }

        const flow = TOUR_FLOWS[flowId] || TOUR_FLOWS.WELCOME;

        // Filter out steps whose element doesn't exist (graceful skip)
        // We do this dynamically per step during the tour via onHighlightStarted
        const steps = flow.steps
            .filter(step => {
                // Steps without element (info-only popover) always pass
                if (!step.element) return true;
                // Steps with navigate always pass (element will appear after navigation)
                if (step.navigate) return true;
                // For current-page steps, check if element exists now
                // If not, still include it — waitForElement will handle it
                return true;
            })
            .map(step => ({
                ...step,
                onHighlightStarted: async (element, stepRef, options) => {
                    // Check if step requires navigation
                    if (step.navigate && location.pathname !== step.navigate) {
                        navigate(step.navigate);
                        if (step.element) {
                            await waitForElement(step.element);
                        }
                    }

                    // If it's a sidebar group, try to expand it
                    if (step.element && step.element.includes('group')) {
                        const el = document.querySelector(step.element);
                        if (el && el.getAttribute('aria-expanded') === 'false') {
                            el.click();
                            await new Promise(r => setTimeout(r, 300));
                        }
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
            steps: steps,
            onDestroyStarted: () => {
                // Mark this specific tour as completed
                markTourCompleted(flow.id);
                if (onComplete) onComplete();
                driverObj.destroy();
            }
        });

        // Initial Navigation if flow starts on a different page
        if (flow.startUrl && location.pathname !== flow.startUrl) {
            navigate(flow.startUrl);
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

    return { startTour, markAsCompleted, isTourCompleted, resetTourProgress };
};
