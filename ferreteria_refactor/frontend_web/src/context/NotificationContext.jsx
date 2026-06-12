import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../config/axios';
import { useWebSocket } from './WebSocketContext';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
    const [notifications,  setNotifications]  = useState([]);  // type: banner
    const [announcements,  setAnnouncements]  = useState([]);  // type: announcement
    const [unreadCount,    setUnreadCount]    = useState(0);
    const { subscribe } = useWebSocket();

    const fetchNotifications = useCallback(async () => {
        try {
            const response = await apiClient.get('/system/messages/active', { _silentNetworkError: true });
            if (!response.data) return;

            const all = response.data;

            // ── Banners (existing behavior) ────────────────────────────────
            const banners = all.filter(n => (n.message_type ?? 'banner') === 'banner');
            const readIds = JSON.parse(localStorage.getItem('read_notifications') || '[]');
            const processedBanners = banners.map(n => ({
                ...n,
                isRead: readIds.includes(n.id),
            }));
            setNotifications(processedBanners);
            setUnreadCount(processedBanners.filter(n => !n.isRead).length);

            // ── Announcements (new: centered modal) ────────────────────────
            const msgs = all.filter(n => n.message_type === 'announcement');
            setAnnouncements(msgs);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();

        const unsubscribe = subscribe('system:notification', (data) => {
            if (data?.refresh || data?.action) {
                fetchNotifications();
                return;
            }

            const now = Date.now();
            const startsAt = data?.starts_at ? new Date(data.starts_at).getTime() : null;
            const expiresAt = data?.expires_at ? new Date(data.expires_at).getTime() : null;
            if (data?.is_active === false || (startsAt && startsAt > now) || (expiresAt && expiresAt <= now)) {
                fetchNotifications();
                return;
            }

            const type = data.message_type ?? 'banner';

            if (type === 'announcement') {
                setAnnouncements(prev => {
                    if (prev.find(n => n.id === data.id)) return prev;
                    return [{ ...data }, ...prev];
                });
            } else {
                setNotifications(prev => {
                    if (prev.find(n => n.id === data.id)) return prev;
                    const updated = [{ ...data, isRead: false, isLive: true }, ...prev];
                    setUnreadCount(updated.filter(n => !n.isRead).length);
                    return updated;
                });
            }
        });

        return () => unsubscribe();
    }, [fetchNotifications, subscribe]);

    // ── Banner helpers ─────────────────────────────────────────────────────────
    const markAsRead = (id) => {
        setNotifications(prev => {
            const updated = prev.map(n => n.id === id ? { ...n, isRead: true } : n);
            const readIds = updated.filter(n => n.isRead).map(n => n.id);
            localStorage.setItem('read_notifications', JSON.stringify(readIds));
            setUnreadCount(updated.filter(n => !n.isRead).length);
            return updated;
        });
    };

    const markAllAsRead = () => {
        setNotifications(prev => {
            const updated = prev.map(n => ({ ...n, isRead: true }));
            localStorage.setItem('read_notifications', JSON.stringify(updated.map(n => n.id)));
            setUnreadCount(0);
            return updated;
        });
    };

    // ── Announcement helpers ───────────────────────────────────────────────────
    // Called by AnnouncementModal after the user clicks "Entendido".
    // Removes the item from state (localStorage flag already set by the modal).
    const dismissAnnouncement = (id) => {
        setAnnouncements(prev => prev.filter(a => a.id !== id));
    };

    return (
        <NotificationContext.Provider value={{
            // banners
            notifications,
            unreadCount,
            markAsRead,
            markAllAsRead,
            // announcements
            announcements,
            dismissAnnouncement,
            // shared
            refresh: fetchNotifications,
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) throw new Error('useNotifications must be used within NotificationProvider');
    return context;
};
