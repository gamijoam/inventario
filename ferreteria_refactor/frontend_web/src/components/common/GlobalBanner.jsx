import { useState, useEffect } from 'react';
import { X, Info, AlertTriangle, AlertCircle } from 'lucide-react';
import apiClient from '../../config/axios';

const GlobalBanner = () => {
    const [message, setMessage] = useState(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const fetchMessages = async () => {
            try {
                const response = await apiClient.get('/system/messages/active');
                if (response.data && response.data.length > 0) {
                    // Get highest priority message that hasn't been dismissed
                    const activeMsg = response.data.find(msg => {
                        const dismissed = localStorage.getItem(`dismissed_msg_${msg.id}`);
                        return !dismissed;
                    });

                    if (activeMsg) {
                        setMessage(activeMsg);
                        setVisible(true);
                    }
                }
            } catch (error) {
                console.error("Error fetching system messages", error);
            }
        };

        fetchMessages();
    }, []);

    const handleDismiss = () => {
        if (message) {
            localStorage.setItem(`dismissed_msg_${message.id}`, 'true');
            setVisible(false);
        }
    };

    if (!visible || !message) return null;

    const getStyles = (level) => {
        switch (level) {
            case 'info':
                return {
                    bg: 'bg-blue-600',
                    icon: <Info className="w-5 h-5 text-white" />
                };
            case 'warning':
                return {
                    bg: 'bg-yellow-500',
                    icon: <AlertTriangle className="w-5 h-5 text-white" />
                };
            case 'critical':
                return {
                    bg: 'bg-red-600',
                    icon: <AlertCircle className="w-5 h-5 text-white" />
                };
            default:
                return {
                    bg: 'bg-indigo-600',
                    icon: <Info className="w-5 h-5 text-white" />
                };
        }
    };

    const styles = getStyles(message.level);

    return (
        <div className={`${styles.bg} text-white px-4 py-3 shadow-md relative z-50`}>
            <div className="container mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {styles.icon}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                        <span className="font-bold">{message.title}:</span>
                        <span className="text-sm sm:text-base">{message.content}</span>
                    </div>
                </div>
                <button
                    onClick={handleDismiss}
                    className="text-white/80 hover:text-white transition-colors p-1"
                    aria-label="Cerrar notificación"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

export default GlobalBanner;
