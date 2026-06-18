import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../config/axios';
import { useWebSocket } from './WebSocketContext';
import { useAuth } from './AuthContext';
import supportService from '../services/supportService';

const NotificationContext = createContext(null);
const LEGACY_READ_KEY = 'read_notifications';
const LOCAL_NOTIFICATION_PREFIX = 'local:';
const SUPPORT_NOTIFICATION_PREFIX = 'support:';

const resolveTenantScope = () => {
    const hostname = window.location.hostname || 'local';
    const parts = hostname.split('.');
    let tenant = null;

    if (parts.length >= 3 && !hostname.includes('localhost')) {
        const subdomain = parts[0];
        if (!['www', 'api', 'app', 'dashboard', 'admin'].includes(subdomain)) {
            tenant = subdomain;
        }
    }

    if (!tenant) tenant = localStorage.getItem('selected_tenant') || 'public';
    return tenant.replace('.qa', '').trim().toLowerCase() || 'public';
};

const parseStoredList = (key) => {
    try {
        const value = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
};

const supportNotificationId = (ticketId) => `${SUPPORT_NOTIFICATION_PREFIX}${ticketId}`;

const buildSupportNotification = (ticket) => ({
    id: supportNotificationId(ticket.id),
    title: `Soporte respondio el ticket #${ticket.id}`,
    content: ticket.admin_response || ticket.subject || 'Tienes una nueva respuesta de soporte.',
    level: ticket.priority === 'critical' ? 'critical' : 'info',
    message_type: 'banner',
    starts_at: ticket.last_message_at || new Date().toISOString(),
    action_url: `/support?ticket=${ticket.id}`,
    source: 'support',
    ticket_id: ticket.id,
    isRead: false,
});

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const { subscribe } = useWebSocket();
    const { user } = useAuth();

    const storageScope = useMemo(() => {
        const tenant = resolveTenantScope();
        const userKey = user?.id || user?.username || 'anon';
        return `${tenant}:${userKey}`;
    }, [user?.id, user?.username]);

    const readKey = useMemo(() => `read_notifications:${storageScope}`, [storageScope]);
    const localKey = useMemo(() => `local_notifications:${storageScope}`, [storageScope]);
    const popupKey = useCallback((id) => `dismissed_popup:${storageScope}:${id}`, [storageScope]);
    const announcementKey = useCallback((id) => `announced:${storageScope}:${id}`, [storageScope]);

    const getReadIds = useCallback(() => {
        const scoped = parseStoredList(readKey);
        const legacy = parseStoredList(LEGACY_READ_KEY);
        return Array.from(new Set([...scoped, ...legacy]));
    }, [readKey]);

    const getLocalNotifications = useCallback(() => (
        parseStoredList(localKey).filter(item => item?.id && item?.title)
    ), [localKey]);

    const saveLocalNotifications = useCallback((items) => {
        localStorage.setItem(localKey, JSON.stringify(items.slice(0, 40)));
    }, [localKey]);

    const isPopupDismissed = useCallback((id) => (
        localStorage.getItem(popupKey(id)) === 'true'
        || localStorage.getItem(`dismissed_popup_${id}`) === 'true'
    ), [popupKey]);

    const dismissPopup = useCallback((id) => {
        localStorage.setItem(popupKey(id), 'true');
    }, [popupKey]);

    const isAnnouncementDismissed = useCallback((id) => (
        localStorage.getItem(announcementKey(id)) === 'true'
        || localStorage.getItem(`announced_${id}`) === 'true'
    ), [announcementKey]);

    const recomputeUnread = useCallback((items) => {
        setUnreadCount(items.filter(n => !n.isRead).length);
    }, []);

    const fetchNotifications = useCallback(async () => {
        try {
            const [systemResponse, supportTickets] = await Promise.all([
                apiClient.get('/system/messages/active', { _silentNetworkError: true }),
                supportService.getUnreadTickets().catch(() => []),
            ]);
            if (!systemResponse.data) return;

            const all = systemResponse.data;
            const readIds = getReadIds();

            const banners = all.filter(n => (n.message_type ?? 'banner') === 'banner');
            const processedBanners = banners.map(n => ({
                ...n,
                isRead: readIds.includes(n.id),
            }));

            const supportNotifications = supportTickets.map(buildSupportNotification);
            const supportIds = new Set(supportNotifications.map(n => n.id));
            const localNotifications = getLocalNotifications()
                .filter(n => n.source !== 'support' || supportIds.has(n.id))
                .map(n => ({
                    ...n,
                    isRead: readIds.includes(n.id),
                }));

            const combined = [
                ...supportNotifications,
                ...localNotifications.filter(local => !supportIds.has(local.id)),
                ...processedBanners.filter(n => !localNotifications.some(local => local.id === n.id) && !supportIds.has(n.id)),
            ];
            setNotifications(combined);
            recomputeUnread(combined);

            const msgs = all.filter(n => n.message_type === 'announcement' && !isAnnouncementDismissed(n.id));
            setAnnouncements(msgs);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    }, [getReadIds, getLocalNotifications, isAnnouncementDismissed, recomputeUnread]);

    const addLocalNotification = useCallback((notification) => {
        const item = {
            level: 'info',
            message_type: 'banner',
            starts_at: new Date().toISOString(),
            ...notification,
            id: String(notification.id),
            isRead: false,
            isLive: true,
        };

        setNotifications(prev => {
            if (prev.some(n => n.id === item.id)) return prev;
            const withoutSameTicket = item.source === 'support'
                ? prev.filter(n => !(n.source === 'support' && n.ticket_id === item.ticket_id))
                : prev;
            const updated = [item, ...withoutSameTicket].slice(0, 80);
            recomputeUnread(updated);
            const currentLocal = getLocalNotifications().filter(n => n.id !== item.id);
            saveLocalNotifications([item, ...currentLocal]);
            return updated;
        });
    }, [getLocalNotifications, saveLocalNotifications, recomputeUnread]);

    useEffect(() => {
        fetchNotifications();

        const unsubscribeSystem = subscribe('system:notification', (data) => {
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
                if (isAnnouncementDismissed(data.id)) return;
                setAnnouncements(prev => {
                    if (prev.find(n => n.id === data.id)) return prev;
                    return [{ ...data }, ...prev];
                });
            } else {
                setNotifications(prev => {
                    if (prev.find(n => n.id === data.id)) return prev;
                    const updated = [{ ...data, isRead: false, isLive: true }, ...prev];
                    recomputeUnread(updated);
                    return updated;
                });
            }
        });

        const unsubscribeSupport = subscribe('support:message_created', (message) => {
            if (message?.sender_type !== 'admin' || !message?.ticket_id) return;
            addLocalNotification({
                id: supportNotificationId(message.ticket_id),
                title: `Soporte respondio el ticket #${message.ticket_id}`,
                content: message.message || 'Tienes una nueva respuesta de soporte.',
                level: 'info',
                starts_at: message.created_at || new Date().toISOString(),
                action_url: `/support?ticket=${message.ticket_id}`,
                source: 'support',
                ticket_id: message.ticket_id,
            });
            window.setTimeout(fetchNotifications, 600);
        });

        return () => {
            unsubscribeSystem && unsubscribeSystem();
            unsubscribeSupport && unsubscribeSupport();
        };
    }, [fetchNotifications, subscribe, isAnnouncementDismissed, addLocalNotification, recomputeUnread]);

    const markAsRead = useCallback((id) => {
        setNotifications(prev => {
            const target = prev.find(n => n.id === id);
            if (target?.source === 'support' && target.ticket_id) {
                supportService.markTicketRead(target.ticket_id)
                    .then(() => fetchNotifications())
                    .catch(() => {});
            }

            const updated = prev.map(n => n.id === id ? { ...n, isRead: true } : n);
            const readIds = Array.from(new Set([...getReadIds(), id]));
            localStorage.setItem(readKey, JSON.stringify(readIds));
            saveLocalNotifications(updated.filter(n => String(n.id).startsWith(LOCAL_NOTIFICATION_PREFIX) || n.source === 'support'));
            recomputeUnread(updated);
            return updated;
        });
    }, [readKey, saveLocalNotifications, getReadIds, recomputeUnread, fetchNotifications]);

    const markAllAsRead = useCallback(() => {
        setNotifications(prev => {
            const supportTicketIds = prev.filter(n => n.source === 'support' && n.ticket_id).map(n => n.ticket_id);
            supportTicketIds.forEach(ticketId => {
                supportService.markTicketRead(ticketId).catch(() => {});
            });

            const updated = prev.map(n => ({ ...n, isRead: true }));
            const readIds = Array.from(new Set([...getReadIds(), ...updated.map(n => n.id)]));
            localStorage.setItem(readKey, JSON.stringify(readIds));
            saveLocalNotifications(updated.filter(n => String(n.id).startsWith(LOCAL_NOTIFICATION_PREFIX) || n.source === 'support'));
            setUnreadCount(0);
            if (supportTicketIds.length) window.setTimeout(fetchNotifications, 600);
            return updated;
        });
    }, [readKey, saveLocalNotifications, getReadIds, fetchNotifications]);

    const dismissAnnouncement = useCallback((id) => {
        localStorage.setItem(announcementKey(id), 'true');
        setAnnouncements(prev => prev.filter(a => a.id !== id));
    }, [announcementKey]);

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            markAsRead,
            markAllAsRead,
            announcements,
            dismissAnnouncement,
            isAnnouncementDismissed,
            isPopupDismissed,
            dismissPopup,
            refresh: fetchNotifications,
            addLocalNotification,
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
