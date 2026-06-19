const MAX_REPORTS_PER_MINUTE = 8;
const reportTimes = [];

const resolveTenantId = () => {
  const hostname = window.location.hostname || '';
  const parts = hostname.split('.');
  if (parts.length >= 3 && !hostname.includes('localhost')) {
    const subdomain = parts[0];
    if (!['www', 'api', 'app', 'dashboard', 'admin'].includes(subdomain)) {
      return subdomain.replace('.qa', '');
    }
  }
  const selectedTenant = localStorage.getItem('selected_tenant');
  return selectedTenant && selectedTenant !== 'public' ? selectedTenant : null;
};

const apiBasePath = () => {
  const origin = window.location.origin;
  return `${origin}/api/v1/audit/client-errors`;
};

const shouldThrottle = () => {
  const now = Date.now();
  while (reportTimes.length && now - reportTimes[0] > 60_000) reportTimes.shift();
  if (reportTimes.length >= MAX_REPORTS_PER_MINUTE) return true;
  reportTimes.push(now);
  return false;
};

const sanitize = (value, fallback = '') => String(value || fallback).slice(0, 6000);

export const reportClientError = (payload = {}) => {
  try {
    if (shouldThrottle()) return;

    const tenantId = resolveTenantId();
    const body = JSON.stringify({
      kind: sanitize(payload.kind, 'CLIENT_ERROR').slice(0, 40),
      message: sanitize(payload.message || payload.error?.message || payload.error, 'Error desconocido').slice(0, 1000),
      stack: sanitize(payload.stack || payload.error?.stack),
      component_stack: sanitize(payload.component_stack || payload.componentStack),
      route: sanitize(payload.route || `${window.location.pathname}${window.location.hash}${window.location.search}`).slice(0, 500),
      source: sanitize(payload.source || 'frontend').slice(0, 120),
      status: payload.status || null,
      method: payload.method || null,
      url: payload.url || null,
      context: payload.context || {},
    });

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (tenantId) headers['X-Tenant-ID'] = tenantId;
    const token = localStorage.getItem('token');
    if (token) headers.Authorization = `Bearer ${token}`;

    const url = apiBasePath();
    if (navigator.sendBeacon && !headers.Authorization && !tenantId) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
      return;
    }

    fetch(url, {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers,
      body,
    }).catch(() => {});
  } catch {
    // Reporting must never break the app.
  }
};
