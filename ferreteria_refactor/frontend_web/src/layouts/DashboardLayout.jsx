import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import GlobalBanner from '../components/common/GlobalBanner';
import OnboardingController from '../components/common/OnboardingController';
import MobileBottomNav from '../components/layout/MobileBottomNav';
import { cn } from '../utils/cn';

export default function DashboardLayout() {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const toggleSidebar = () => {
        setIsSidebarCollapsed(!isSidebarCollapsed);
    };

    const closeMobileMenu = () => {
        setIsMobileMenuOpen(false);
    };

    return (
        <div className="min-h-screen bg-slate-50/50 font-sans text-slate-900 flex w-full">
            {/* Mobile Header - Branding Only */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-center px-4 z-30 shadow-sm pt-[env(safe-area-inset-top)]">
                <div className="flex items-center gap-2.5 font-bold text-base text-slate-800">
                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-lg flex items-center justify-center text-white shadow-md shadow-indigo-200 text-sm font-black">
                        MI
                    </div>
                    <span className="tracking-tight"><span className="text-indigo-600">Mi</span> Inventario <span className="text-indigo-600">Fácil</span></span>
                </div>
            </div>

            {/* Mobile Bottom Navigation */}
            <MobileBottomNav onOpenMenu={() => setIsMobileMenuOpen(true)} />

            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden animate-in fade-in duration-200"
                    onClick={closeMobileMenu}
                />
            )}

            {/* Sidebar */}
            <Sidebar
                isCollapsed={isSidebarCollapsed}
                toggleSidebar={toggleSidebar}
                isMobileMenuOpen={isMobileMenuOpen}
                closeMobileMenu={closeMobileMenu}
            />

            {/* Main Content Wrapper */}
            <div
                className={cn(
                    "flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-300 ease-in-out",
                    "pt-16 md:pt-0 pb-24 md:pb-0",
                    isSidebarCollapsed ? "md:ml-20" : "md:ml-64"
                )}
            >
                <OnboardingController />
                <GlobalBanner />
                <div className="hidden md:block">
                    <Header />
                </div>

                <main className="flex-1 p-4 md:p-8">
                    <div className="max-w-7xl mx-auto w-full">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
