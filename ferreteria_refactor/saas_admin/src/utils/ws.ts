import api from '../api/axios';

export const buildAdminWsUrl = (token: string) => {
    const apiBase = api.defaults.baseURL || `${window.location.origin}/api/v1`;
    let base = apiBase;

    if (base.startsWith('/')) {
        const host = window.location.hostname;
        if (host.startsWith('admin-qa')) base = 'https://api-qa.miinventariofacil.com/api/v1';
        else if (host.startsWith('admin')) base = 'https://api.miinventariofacil.com/api/v1';
        else base = `${window.location.origin}${base}`;
    }

    const wsProtocol = base.startsWith('https') ? 'wss:' : 'ws:';
    const cleanBase = base.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const wsUrl = cleanBase.includes('/api/v1')
        ? `${wsProtocol}//${cleanBase}/ws`
        : `${wsProtocol}//${cleanBase}/api/v1/ws`;
    return `${wsUrl}?tenant_id=public&token=${encodeURIComponent(token)}`;
};
