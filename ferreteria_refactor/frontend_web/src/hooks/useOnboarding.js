import { useState, useEffect } from 'react';
import apiClient from '../config/axios';

export function useOnboarding() {
  const [data, setData]     = useState({ step: 0, completed: true });
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const r = await apiClient.get('/onboarding/status', { _silentNetworkError: true });
      setData(r.data);
    } catch {
      setData({ step: 0, completed: true }); // fallar silenciosamente
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);
  return { ...data, loading, refresh };
}
