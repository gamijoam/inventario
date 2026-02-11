import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../config/axios';
import { useWebSocket } from './WebSocketContext';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const { subscribe } = useWebSocket();

    const fetchNotifications = useCallback(async () => {
        try {
            const response = await apiClient.get('/system/messages/active');
            if (response.data) {
                const fetchedNotifications = response.data;

                // Merge with read status from localStorage
                const readIds = JSON.parse(localStorage.getItem('read_notifications') || '[]');
                const processed = fetchedNotifications.map(notification => ({
                    ...notification,
                    isRead: readIds.includes(notification.id)
                }));

                setNotifications(processed);
                setUnreadCount(processed.filter(n => !n.isRead).length);
            }
        } catch (error) {
            console.error("Error fetching notifications:", error);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();

        // Subscribe to real-time notifications
        const unsubscribe = subscribe('system:notification', (data) => {
            setNotifications(prev => {
                // Check if it already exists to avoid duplicates
                if (prev.find(n => n.id === data.id)) return prev;

                const newNotifications = [{ ...data, isRead: false, isLive: true }, ...prev];
                setUnreadCount(newNotifications.filter(n => !n.isRead).length);
                return newNotifications;
            });
        });

        return () => unsubscribe();
    }, [fetchNotifications, subscribe]);

    const markAsRead = (id) => {
        setNotifications(prev => {
            const updated = prev.map(n => n.id === id ? { ...n, isRead: true } : n);

            // Persist to localStorage
            const readIds = updated.filter(n => n.isRead).map(n => n.id);
            localStorage.setItem('read_notifications', JSON.stringify(readIds));

            setUnreadCount(updated.filter(n => !n.isRead).length);
            return updated;
        });
    };

    const markAllAsRead = () => {
        setNotifications(prev => {
            const updated = prev.map(n => ({ ...n, isRead: true }));
            const readIds = updated.map(n => n.id);
            localStorage.setItem('read_notifications', JSON.stringify(readIds));
            setUnreadCount(0);
            return updated;
        });
    };

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            markAsRead,
            markAllAsRead,
            refresh: fetchNotifications
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
