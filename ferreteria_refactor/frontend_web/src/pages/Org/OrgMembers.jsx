/**
 * OrgMembers.jsx — Gestión de miembros del grupo empresarial
 */
import React, { useState, useEffect } from 'react';
import {
  Users, Plus, Trash2, Mail, Shield, CheckCircle,
  Clock, RefreshCw, UserPlus
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';

export default function OrgMembers() {
  const [members, setMembers] = useState([]);
  const [orgId, setOrgId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ email: '', role: 'manager' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient.get('/organizations/my-org').then(r => {
      if (r.data?.[0]) {
        const id = r.data[0].id;
        setOrgId(id);
        return apiClient.get(`/organizations/${id}/members`);
      }
    }).then(r => {
      if (r?.data) setMembers(r.data);
    }).catch(() => toast.error('Error cargando miembros'))
      .finally(() => setLoading(false));
  }, []);

  const handleInvite = async () => {
    if (!form.email.trim()) return toast.error('Ingresa un email');
    setSaving(true);
    try {
      const r = await apiClient.post(`/organizations/${orgId}/members`, form);
      setMembers(prev => [...prev, r.data]);
      setShowInvite(false);
      setForm({ email: '', role: 'manager' });
      toast.success('Invitación enviada');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error al invitar');
    } finally { setSaving(false); }
  };

  const handleRemove = async (memberId) => {
    if (!confirm('¿Eliminar este miembro?')) return;
    try {
      await apiClient.delete(`/organizations/${orgId}/members/${memberId}`);
      setMembers(prev => prev.filter(m => m.id !== memberId));
      toast.success('Miembro eliminado');
    } catch { toast.error('Error al eliminar'); }
  };

  const ROLE_BADGE = {
    owner:   'bg-indigo-100 text-indigo-700',
    manager: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Miembros del Grupo</h1>
          <p className="text-slate-500 text-sm mt-1">
            Gestiona quién puede acceder y cambiar entre empresas de la organización
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5
            rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
        >
          <UserPlus size={16} /> Invitar
        </button>
      </div>

      {/* Modal invitar */}
      {showInvite && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-indigo-900 flex items-center gap-2">
            <Mail size={16} /> Invitar nuevo miembro
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="email"
              placeholder="email@empresa.com"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              className="px-3 py-2 rounded-xl border border-indigo-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 col-span-2"
            />
            <select
              value={form.role}
              onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              className="px-3 py-2 rounded-xl border border-indigo-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="manager">Gerente</option>
              <option value="owner">Propietario</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleInvite}
                disabled={saving}
                className="flex-1 bg-indigo-600 text-white rounded-xl py-2 text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Enviando...' : 'Invitar'}
              </button>
              <button
                onClick={() => setShowInvite(false)}
                className="flex-1 bg-white text-slate-600 rounded-xl py-2 text-sm font-bold border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de miembros */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={24} className="text-indigo-500 animate-spin" />
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No hay miembros aún</p>
          <p className="text-sm">Invita a gerentes para que puedan acceder al panel</p>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="bg-white rounded-2xl border border-slate-100 p-4
              flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-indigo-600 font-black text-sm">
                  {(m.user_email || '?').charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 truncate">{m.user_email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ROLE_BADGE[m.role] || 'bg-slate-100 text-slate-600'}`}>
                    {m.role === 'owner' ? 'Propietario' : 'Gerente'}
                  </span>
                  {m.accepted_at ? (
                    <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                      <CheckCircle size={10} /> Activo
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-600 flex items-center gap-1">
                      <Clock size={10} /> Pendiente
                    </span>
                  )}
                </div>
              </div>
              {m.role !== 'owner' && (
                <button
                  onClick={() => handleRemove(m.id)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
