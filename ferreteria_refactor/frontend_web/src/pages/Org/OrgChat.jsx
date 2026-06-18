import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Download,
  Loader2,
  MessageCircle,
  Paperclip,
  RefreshCw,
  Send,
  Store,
  X,
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const formatDateTime = (value) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
};

const formatBytes = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const initials = (value) => {
  const source = (value || '?').trim();
  return source.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
};

const buildOrgWsUrl = (orgId) => {
  const token = localStorage.getItem('token');
  if (!token || !orgId) return null;

  const isDev = import.meta.env.DEV;
  let wsUrl;
  if (isDev && window.location.hostname === 'localhost') {
    wsUrl = 'ws://127.0.0.1:8000/api/v1/ws';
  } else {
    const apiBase = apiClient.defaults.baseURL || `${window.location.origin}/api/v1`;
    const wsProtocol = apiBase.startsWith('https') ? 'wss:' : 'ws:';
    const cleanBase = apiBase.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    wsUrl = cleanBase.includes('/api/v1')
      ? `${wsProtocol}//${cleanBase}/ws`
      : `${wsProtocol}//${cleanBase}/api/v1/ws`;
  }

  const sep = wsUrl.includes('?') ? '&' : '?';
  return `${wsUrl}${sep}tenant_id=${encodeURIComponent(`org:${orgId}`)}&token=${encodeURIComponent(token)}`;
};

export default function OrgChat() {
  const { user } = useAuth();
  const [org, setOrg] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [wsStatus, setWsStatus] = useState('DISCONNECTED');
  const bottomRef = useRef(null);
  const socketRef = useRef(null);

  const orgId = org?.id;

  const scrollToBottom = useCallback(() => {
    window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 80);
  }, []);

  const loadOrg = useCallback(async () => {
    const r = await apiClient.get('/organizations/my-org');
    const currentOrg = Array.isArray(r.data) ? r.data[0] : null;
    if (!currentOrg?.id) throw new Error('Sin organizacion vinculada');
    setOrg(currentOrg);
    return currentOrg;
  }, []);

  const loadMessages = useCallback(async (targetOrgId = orgId) => {
    if (!targetOrgId) return;
    const r = await apiClient.get(`/organizations/${targetOrgId}/chat/messages`, { params: { limit: 120 } });
    setMessages(Array.isArray(r.data) ? r.data : []);
    scrollToBottom();
  }, [orgId, scrollToBottom]);

  useEffect(() => {
    let alive = true;
    const init = async () => {
      setLoading(true);
      try {
        const currentOrg = await loadOrg();
        if (!alive) return;
        await loadMessages(currentOrg.id);
      } catch (err) {
        console.error(err);
        toast.error('No se pudo cargar el chat empresarial');
      } finally {
        if (alive) setLoading(false);
      }
    };
    init();
    return () => { alive = false; };
  }, [loadOrg, loadMessages]);

  useEffect(() => {
    if (!orgId) return undefined;
    const url = buildOrgWsUrl(orgId);
    if (!url) return undefined;

    let closedByUnmount = false;
    const socket = new WebSocket(url);
    socketRef.current = socket;
    setWsStatus('CONNECTING');

    socket.onopen = () => {
      setWsStatus('CONNECTED');
      socket._pingTimer = window.setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send('ping');
      }, 30000);
    };

    socket.onmessage = (event) => {
      if (event.data === 'pong') return;
      try {
        const packet = JSON.parse(event.data);
        if (packet.type !== 'org_chat:message_created') return;
        const message = packet.data;
        if (!message?.id || message.organization_id !== orgId) return;
        setMessages(prev => {
          if (prev.some(item => item.id === message.id)) return prev;
          return [...prev, message];
        });
        scrollToBottom();
      } catch (err) {
        console.warn('Mensaje WS no reconocido', err);
      }
    };

    socket.onclose = () => {
      if (socket._pingTimer) window.clearInterval(socket._pingTimer);
      if (!closedByUnmount) setWsStatus('DISCONNECTED');
    };

    socket.onerror = () => {
      setWsStatus('DISCONNECTED');
      try { socket.close(); } catch {}
    };

    return () => {
      closedByUnmount = true;
      if (socket._pingTimer) window.clearInterval(socket._pingTimer);
      try { socket.close(); } catch {}
    };
  }, [orgId, scrollToBottom]);

  const sendMessage = async () => {
    if (!orgId || (!text.trim() && !file)) return;
    setSending(true);
    try {
      const formData = new FormData();
      formData.append('message', text.trim());
      if (file) formData.append('file', file);
      const r = await apiClient.post(`/organizations/${orgId}/chat/messages`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessages(prev => prev.some(item => item.id === r.data.id) ? prev : [...prev, r.data]);
      setText('');
      setFile(null);
      scrollToBottom();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  const stats = useMemo(() => {
    const attachments = messages.reduce((sum, item) => sum + (item.attachments?.length || 0), 0);
    const senders = new Set(messages.map(item => item.sender_email).filter(Boolean));
    return { total: messages.length, attachments, senders: senders.size };
  }, [messages]);

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-lg shadow-indigo-100">
              <MessageCircle size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wide text-indigo-500">Comunicacion interna</p>
              <h1 className="truncate text-2xl font-black text-slate-950">Chat empresarial</h1>
              <p className="text-sm font-semibold text-slate-500">Mensajes y archivos entre las empresas del grupo.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700">
              <Building2 size={14} /> {org?.name || 'Organizacion'}
            </span>
            <span className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-black ${wsStatus === 'CONNECTED' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
              <span className={`h-2 w-2 rounded-full ${wsStatus === 'CONNECTED' ? 'bg-emerald-500' : 'bg-slate-300'}`} /> {wsStatus === 'CONNECTED' ? 'En vivo' : 'Reconectando'}
            </span>
            <button onClick={() => loadMessages()} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50">
              <RefreshCw size={14} /> Refrescar
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-px border-t border-slate-200 bg-slate-200">
          <div className="bg-white p-4"><p className="text-[10px] font-black uppercase text-slate-400">Mensajes</p><p className="text-xl font-black text-slate-950">{stats.total}</p></div>
          <div className="bg-white p-4"><p className="text-[10px] font-black uppercase text-slate-400">Archivos</p><p className="text-xl font-black text-slate-950">{stats.attachments}</p></div>
          <div className="bg-white p-4"><p className="text-[10px] font-black uppercase text-slate-400">Participantes</p><p className="text-xl font-black text-slate-950">{stats.senders}</p></div>
        </div>
      </section>

      <section className="grid min-h-[620px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-h-0 flex-col">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Canal general</p>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/70 p-4">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm font-bold text-slate-400">
                <Loader2 size={18} className="mr-2 animate-spin" /> Cargando chat...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                <MessageCircle size={42} className="mb-3 text-slate-200" />
                <p className="font-black text-slate-600">Aun no hay mensajes</p>
                <p className="mt-1 max-w-sm text-sm">Usa este canal para consultas entre tiendas, traslados y archivos compartidos.</p>
              </div>
            ) : messages.map(item => {
              const isMine = item.sender_email === user?.email;
              return (
                <div key={item.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[82%] rounded-2xl border px-4 py-3 shadow-sm ${isMine ? 'border-indigo-100 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-900'}`}>
                    <div className={`mb-1 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-wide ${isMine ? 'text-indigo-100' : 'text-slate-400'}`}>
                      <span>{item.sender_name || item.sender_email}</span>
                      {item.tenant_name && <span className="inline-flex items-center gap-1"><Store size={11} /> {item.tenant_name}</span>}
                      <span>{formatDateTime(item.created_at)}</span>
                    </div>
                    {item.message && <p className="whitespace-pre-wrap text-sm font-semibold leading-6">{item.message}</p>}
                    {item.attachments?.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {item.attachments.map(attachment => (
                          <a
                            key={attachment.id}
                            href={attachment.stored_url}
                            target="_blank"
                            rel="noreferrer"
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-black transition-colors ${isMine ? 'border-white/20 bg-white/10 text-white hover:bg-white/20' : 'border-indigo-100 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
                          >
                            <Paperclip size={14} />
                            <span className="min-w-0 flex-1 truncate">{attachment.original_filename}</span>
                            <span className="shrink-0 opacity-70">{formatBytes(attachment.file_size)}</span>
                            <Download size={13} />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-slate-100 bg-white p-4">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              rows={3}
              placeholder="Escribe una consulta para el grupo..."
              className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition-colors focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100"
            />
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
                  <Paperclip size={15} /> Adjuntar
                  <input
                    type="file"
                    className="hidden"
                    accept=".json,.xlsx,.xls,.csv,.txt,.pdf,.png,.jpg,.jpeg,.webp"
                    onChange={(event) => setFile(event.target.files?.[0] || null)}
                  />
                </label>
                {file ? (
                  <span className="inline-flex min-w-0 max-w-[360px] items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700">
                    <Paperclip size={14} />
                    <span className="truncate">{file.name}</span>
                    <button type="button" onClick={() => setFile(null)} className="rounded-full p-1 text-indigo-500 hover:bg-indigo-100 hover:text-indigo-800" aria-label="Quitar archivo">
                      <X size={13} />
                    </button>
                  </span>
                ) : (
                  <p className="text-xs font-semibold text-slate-400">Acepta JSON de traslados, Excel, PDF e imagenes.</p>
                )}
              </div>
              <button
                onClick={sendMessage}
                disabled={sending || (!text.trim() && !file)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-black text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {sending ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>

        <aside className="hidden border-l border-slate-200 bg-white p-4 lg:block">
          <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4 text-indigo-900">
            <MessageCircle size={20} className="mb-2 text-indigo-600" />
            <p className="text-sm font-black">Uso recomendado</p>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-indigo-700">Comparte consultas entre empresas, archivos de traslado, comprobantes o listas para coordinar inventario sin salir del sistema.</p>
          </div>
          <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-4 text-amber-800">
            <AlertCircle size={18} className="mb-2 text-amber-600" />
            <p className="text-xs font-semibold leading-relaxed">Este canal es visible para miembros autorizados de la organizacion. No compartas claves o datos sensibles.</p>
          </div>
        </aside>
      </section>
    </div>
  );
}
