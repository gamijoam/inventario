/**
 * DesktopFirstRun.jsx
 *
 * Pantalla de primer arranque del escritorio.
 * Se muestra UNA SOLA VEZ cuando no hay usuarios en el sistema.
 * El usuario crea su cuenta de administrador y ya puede ingresar.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function DesktopFirstRun() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: '',
    username: '',
    password: '',
    confirm: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.full_name.trim() || !form.username.trim() || !form.password) {
      setError('Todos los campos son obligatorios.');
      return;
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/v1/desktop/setup/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': 'desktop_local',
        },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          username:  form.username.trim().toLowerCase(),
          password:  form.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || 'Error al crear el administrador.');
        return;
      }

      // ¡Listo! Ir al login
      navigate('/login', { replace: true });

    } catch {
      setError('No se pudo conectar con el servidor local. Asegúrese de que el backend está corriendo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo / Título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Mi Inventario Fácil</h1>
          <p className="text-gray-400 text-sm mt-1">Configuración inicial</p>
        </div>

        {/* Card */}
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-1">Crear cuenta de administrador</h2>
          <p className="text-gray-400 text-sm mb-4">
            Esta cuenta tendrá acceso completo al sistema. Solo se crea una vez.
          </p>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-900/30 border border-blue-700/40 mb-6">
            <svg className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0
                012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"/>
            </svg>
            <p className="text-blue-300 text-xs">
              Usa el <strong>nombre de usuario</strong> y la contraseña para iniciar sesión en el sistema.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Nombre completo */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Nombre completo
              </label>
              <input
                type="text"
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                placeholder="Ej: Juan García"
                autoFocus
                className="w-full px-4 py-2.5 rounded-lg bg-gray-700 border border-gray-600
                           text-white placeholder-gray-500 focus:outline-none focus:border-blue-500
                           focus:ring-1 focus:ring-blue-500 transition"
              />
            </div>

            {/* Usuario */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Nombre de usuario
              </label>
              <input
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="Ej: admin"
                className="w-full px-4 py-2.5 rounded-lg bg-gray-700 border border-gray-600
                           text-white placeholder-gray-500 focus:outline-none focus:border-blue-500
                           focus:ring-1 focus:ring-blue-500 transition"
              />
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Contraseña
              </label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-4 py-2.5 rounded-lg bg-gray-700 border border-gray-600
                           text-white placeholder-gray-500 focus:outline-none focus:border-blue-500
                           focus:ring-1 focus:ring-blue-500 transition"
              />
            </div>

            {/* Confirmar contraseña */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Confirmar contraseña
              </label>
              <input
                type="password"
                name="confirm"
                value={form.confirm}
                onChange={handleChange}
                placeholder="Repite la contraseña"
                className="w-full px-4 py-2.5 rounded-lg bg-gray-700 border border-gray-600
                           text-white placeholder-gray-500 focus:outline-none focus:border-blue-500
                           focus:ring-1 focus:ring-blue-500 transition"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-900/40 border border-red-700/50">
                <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414
                    1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0
                    001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"/>
                </svg>
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-lg bg-blue-600 hover:bg-blue-700
                         disabled:bg-blue-800 disabled:cursor-not-allowed
                         text-white font-semibold transition-colors duration-150 mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Creando cuenta...
                </span>
              ) : 'Crear cuenta y comenzar'}
            </button>

          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-xs mt-6">
          Invensoft Desktop · Datos almacenados localmente
        </p>
      </div>
    </div>
  );
}
