export const getTokenSubject = () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return '';
    const [, payload] = token.split('.');
    if (!payload) return '';
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(normalized)
        .split('')
        .map(char => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join('')
    );
    return JSON.parse(json)?.sub || '';
  } catch {
    return '';
  }
};
