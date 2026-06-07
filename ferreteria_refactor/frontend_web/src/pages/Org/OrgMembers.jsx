/**
 * OrgMembers.jsx - Gestion de miembros del grupo empresarial
 */
import React, { useState, useEffect } from 'react';
import {
  Users, Trash2, Mail, Shield, CheckCircle,
  Clock, RefreshCw, UserPlus, Crown, UserCog, AlertTriangle
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';

function MetricCard({ icon: Icon, label, value, tone = 'indigo' }) {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-100',
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
        </div>
        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${tones[tone]}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

export default function OrgMembers() {
  const [members, setMembers] = useState([]);
  const [orgId, setOrgId] = useState(null);
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ email: '', role: 'manager' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient.get('/organizations/my-org').then(r => {
      if (r.data?.[0]) {
        const org = r.data[0];
        setOrgId(org.id);
        setOrgName(org.name || 'Mi Grupo');
        return apiClient.get(`/organizations/${org.id}/members`);
      }
    }).then(r => {
      if (r?.data) setMembers(r.data);
    }).catch(() => toast.error('Error cargando miembros'))
      .finally(() => setLoading(false));
  }, []);

  const handleInvite = async () => {
    const email = form.email.trim();
    if (!email) return toast.error('Ingresa un email');
    if (!orgId) return toast.error('Organizacion no disponible');

    setSaving(true);
    try {
      const r = await apiClient.post(`/organizations/${orgId}/members`, {
        email,
        role: form.role,
      });
      setMembers(prev => [...prev, r.data]);
      setShowInvite(false);
      setForm({ email: '', role: 'manager' });
      toast.success('Invitacion enviada');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error al invitar');
    } finally { setSaving(false); }
  };

  const handleRemove = async (memberId) => {
    if (!confirm('Eliminar este miembro del grupo?')) return;
    try {
      await apiClient.delete(`/organizations/${orgId}/members/${memberId}`);
      setMembers(prev => prev.filter(m => m.id !== memberId));
      toast.success('Miembro eliminado');
    } catch { toast.error('Error al eliminar'); }
  };

  const owners = members.filter(m => m.role === 'owner').length;
  const managers = members.filter(m => m.role !== 'owner').length;
  const active = members.filter(m => m.accepted_at).length;
  const pending = members.length - active;

  const ROLE_BADGE = {
    owner: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    manager: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  };

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-100 shrink-0">
              <Users size={22} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wide text-indigo-500">Administracion empresarial</p>
              <h1 className="text-2xl font-black text-slate-950 truncate">Miembros del grupo</h1>
              <p className="text-sm text-slate-500">Gestiona quien puede acceder, cambiar de empresa y operar el panel.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {orgName && (
              <span className="inline-flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-black text-slate-600">
                <Shield size={14} /> {orgName}
              </span>
            )}
            <button
              onClick={() => setShowInvite(true)}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
            >
              <UserPlus size={16} /> Invitar
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard icon={Users} label="Miembros" value={members.length} tone="indigo" />
        <MetricCard icon={Crown} label="Propietarios" value={owners} tone="indigo" />
        <MetricCard icon={UserCog} label="Gerentes" value={managers} tone="emerald" />
        <MetricCard icon={Clock} label="Pendientes" value={pending} tone={pending > 0 ? 'amber' : 'slate'} />
      </div>

      {showInvite && (
        <section className="bg-white border border-indigo-100 rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-indigo-100 bg-indigo-50/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white text-indigo-600 border border-indigo-100 flex items-center justify-center">
                <Mail size={17} />
              </div>
              <div>
                <h2 className="font-black text-slate-900">Invitar nuevo miembro</h2>
                <p className="text-xs text-slate-500">El usuario podra acceder al panel empresarial segun el rol asignado.</p>
              </div>
            </div>
            <button
              onClick={() => setShowInvite(false)}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-2 rounded-lg hover:bg-white"
            >
              Cancelar
            </button>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-3 items-end">
            <div>
              <label className="text-xs font-black uppercase tracking-wide text-slate-500">Correo</label>
              <input
                type="email"
                placeholder="email@empresa.com"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-black uppercase tracking-wide text-slate-500">Rol</label>
              <select
                value={form.role}
                onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
              >
                <option value="manager">Gerente</option>
                <option value="owner">Propietario</option>
              </select>
            </div>
            <button
              onClick={handleInvite}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-lg px-4 py-2.5 text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {saving ? <RefreshCw size={15} className="animate-spin" /> : <UserPlus size={15} />}
              {saving ? 'Enviando...' : 'Invitar'}
            </button>
          </div>
        </section>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm flex items-center justify-center py-16">
          <RefreshCw size={24} className="text-indigo-500 animate-spin" />
        </div>
      ) : members.length === 0 ? (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg p-10 text-center">
          <Users size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="font-black text-slate-700">No hay miembros aun</p>
          <p className="text-sm text-slate-500 mt-1">Invita a gerentes para que puedan acceder al panel.</p>
        </div>
      ) : (
        <section className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-slate-900">Accesos activos</h2>
              <p className="text-xs text-slate-500">Usuarios con relacion al grupo empresarial.</p>
            </div>
            {pending > 0 && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-100 px-2.5 py-1 text-xs font-black text-amber-700">
                <AlertTriangle size={13} /> {pending} pendiente{pending !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="divide-y divide-slate-100">
            {members.map(m => {
              const isOwner = m.role === 'owner';
              return (
                <div key={m.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${isOwner ? 'bg-indigo-50 border-indigo-100' : 'bg-emerald-50 border-emerald-100'}`}>
                        <span className={`font-black text-sm ${isOwner ? 'text-indigo-600' : 'text-emerald-600'}`}>
                          {(m.user_email || '?').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-slate-900 truncate">{m.user_email}</p>
                        <p className="text-xs text-slate-500">ID miembro: {m.id}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                      <span className={`text-[11px] font-black px-2.5 py-1 rounded-full border ${ROLE_BADGE[m.role] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {isOwner ? 'Propietario' : 'Gerente'}
                      </span>
                      {m.accepted_at ? (
                        <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full font-black flex items-center gap-1">
                          <CheckCircle size={11} /> Activo
                        </span>
                      ) : (
                        <span className="text-[11px] bg-amber-50 text-amber-700 border border-amber-100 px-2.5 py-1 rounded-full font-black flex items-center gap-1">
                          <Clock size={11} /> Pendiente
                        </span>
                      )}
                      {!isOwner && (
                        <button
                          onClick={() => handleRemove(m.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} /> Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
