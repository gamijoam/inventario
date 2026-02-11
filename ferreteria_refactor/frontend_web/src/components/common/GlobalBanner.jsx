import { useState, useEffect } from 'react';
import { X, Info, AlertTriangle, AlertCircle, Bell } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useNotifications } from '../../context/NotificationContext';

const GlobalBanner = () => {
    const { notifications } = useNotifications();
    const [activeNotification, setActiveNotification] = useState(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Logic:
        // 1. If there's a LIVE (real-time) notification that hasn't been dismissed, show it.
        // 2. If there's a CRITICAL notification that hasn't been dismissed, show it.

        const live = notifications.find(n => n.isLive && !n.isRead && !localStorage.getItem(`dismissed_popup_${n.id}`));
        if (live) {
            setActiveNotification(live);
            setVisible(true);
            return;
        }

        const critical = notifications.find(n => n.level === 'critical' && !n.isRead && !localStorage.getItem(`dismissed_popup_${n.id}`));
        if (critical) {
            setActiveNotification(critical);
            setVisible(true);
            return;
        }

        // If neither, hide
        if (!live && !critical) {
            setVisible(false);
        }
    }, [notifications]);

    const handleDismiss = () => {
        if (activeNotification) {
            localStorage.setItem(`dismissed_popup_${activeNotification.id}`, 'true');
            setVisible(false);
        }
    };

    if (!visible || !activeNotification) return null;

    const getStyles = (level) => {
        switch (level) {
            case 'info':
                return {
                    bg: 'bg-indigo-600/95',
                    icon: <Info className="w-5 h-5 text-white" />
                };
            case 'warning':
                return {
                    bg: 'bg-amber-500/95',
                    icon: <AlertTriangle className="w-5 h-5 text-white" />
                };
            case 'critical':
                return {
                    bg: 'bg-red-600/95',
                    icon: <AlertCircle className="w-5 h-5 text-white" />
                };
            default:
                return {
                    bg: 'bg-slate-800/95',
                    icon: <Bell className="w-5 h-5 text-white" />
                };
        }
    };

    const styles = getStyles(activeNotification.level);

    return (
        <div className="fixed top-20 right-4 sm:right-8 z-[100] max-w-md w-[calc(100vw-2rem)] animate-in slide-in-from-top-4 duration-500">
            <div className={cn(
                "backdrop-blur-xl border border-white/20 rounded-2xl p-4 flex flex-col gap-3",
                styles.bg,
                "shadow-[0_20px_50px_rgba(0,0,0,0.3)] text-white overflow-hidden relative"
            )}>
                {/* Decorative glow */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-xl">
                            {styles.icon}
                        </div>
                        <h4 className="font-black text-sm tracking-widest uppercase text-white/90">
                            {activeNotification.title}
                        </h4>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="bg-white/10 hover:bg-white/20 transition-all p-1.5 rounded-lg text-white/80 hover:text-white"
                        aria-label="Cerrar"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="pl-12 pr-4">
                    <p className="text-sm text-white font-medium leading-relaxed">
                        {activeNotification.content}
                    </p>
                </div>

                <div className="mt-1 flex justify-end">
                    <span className="text-[9px] uppercase font-black tracking-[0.2em] text-white/30">
                        {activeNotification.isLive ? 'Aviso en Vivo' : 'Importante'}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default GlobalBanner;
