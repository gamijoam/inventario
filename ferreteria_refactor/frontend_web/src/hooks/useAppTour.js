import { useNavigate } from 'react-router-dom';
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
    const getCurrentRoute = () => {
        const hashRoute = window.location.hash?.replace(/^#/, '');
        if (hashRoute) return hashRoute;
        return `${window.location.pathname}${window.location.search}`;
    };

    const normalizeRoute = (route) => {
        if (!route) return '/';
        return route.startsWith('/') ? route : `/${route}`;
    };

    const routeMatches = (target) => normalizeRoute(getCurrentRoute()) === normalizeRoute(target);

    // Helper: Wait for element to exist in DOM (with timeout)
    const waitForElement = (selector, timeout = 5000) => {
        return new Promise((resolve) => {
            if (!selector) return resolve(null);
            const existing = document.querySelector(selector);
            if (existing) return resolve(existing);

            const observer = new MutationObserver(() => {
                const found = document.querySelector(selector);
                if (found) {
                    resolve(found);
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

    const waitForRoute = (target, timeout = 3000) => {
        return new Promise((resolve) => {
            if (!target || routeMatches(target)) return resolve(true);
            const startedAt = Date.now();
            const tick = () => {
                if (routeMatches(target)) return resolve(true);
                if (Date.now() - startedAt > timeout) return resolve(false);
                setTimeout(tick, 50);
            };
            tick();
        });
    };

    const navigateForTour = async (target) => {
        if (!target || routeMatches(target)) return;
        navigate(target);
        await waitForRoute(target);
        await new Promise(resolve => setTimeout(resolve, 250));
    };

    const startTour = async (flowId = 'WELCOME', onComplete) => {
        const driverFn = getDriver();
        if (!driverFn) {
            console.warn('Driver.js not loaded via CDN');
            if (onComplete) onComplete();
            return;
        }

        const flow = TOUR_FLOWS[flowId] || TOUR_FLOWS.WELCOME;

        const steps = flow.steps.map((step, index) => ({
            ...step,
            onDeselected: async () => {
                const nextStep = flow.steps[index + 1];
                if (nextStep?.navigate) {
                    await navigateForTour(nextStep.navigate);
                    if (nextStep.element) await waitForElement(nextStep.element);
                }
            },
            onHighlightStarted: async () => {
                if (step.navigate) {
                    await navigateForTour(step.navigate);
                    if (step.element) await waitForElement(step.element);
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

        // Initial navigation supports HashRouter routes with query strings.
        if (flow.startUrl && !routeMatches(flow.startUrl)) {
            await navigateForTour(flow.startUrl);
        }

        const firstElement = steps.find(step => step.element)?.element;
        if (firstElement) await waitForElement(firstElement, 2500);
        driverObj.drive();
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
