/**
 * BusinessLogoUploader.jsx — Sube y gestiona el logo del negocio.
 * El logo se usa en: tickets, catálogo público, certificado de garantía.
 */
import { useState, useEffect, useRef } from 'react';
import { ImagePlus, Trash2, Loader2, Image as ImageIcon, Check } from 'lucide-react';
import apiClient from '../../../config/axios';
import { API_ROOT_URL } from '../../../config/constants';
import { toast } from 'react-hot-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';

export default function BusinessLogoUploader() {
  const [logoUrl, setLogoUrl] = useState('');
  const [logoSize, setLogoSize] = useState('medium');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const fetchLogo = async () => {
    try {
      const r = await apiClient.get('/config/business-config');
      const arr = r.data || [];
      const cfg = arr.find(c => c.key === 'business_logo');
      setLogoUrl(cfg?.value || '');
      const sizeCfg = arr.find(c => c.key === 'business_logo_size');
      setLogoSize(sizeCfg?.value || 'medium');
    } catch {
      // Fallback: get all configs
      try {
        const r2 = await apiClient.get('/config/business');
        setLogoUrl(r2.data?.logo_url || '');
      } catch {}
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchLogo(); }, []);

  const getFullUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${API_ROOT_URL}${url}?v=${Date.now()}`;
  };

  const handleUpload = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Debe ser una imagen (PNG, JPG, WEBP)');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen no debe exceder 2 MB');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await apiClient.post('/config/business/upload-logo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setLogoUrl(r.data.url);
      toast.success('Logo actualizado');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Error al subir el logo');
    } finally { setUploading(false); }
  };

  const handleSizeChange = async (size) => {
    setLogoSize(size);
    try {
      await apiClient.put(`/config/business_logo_size`, { key: 'business_logo_size', value: size });
      toast.success(`Tamaño del logo: ${size}`);
    } catch (e) {
      toast.error('Error al guardar tamaño');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('¿Eliminar el logo del negocio?')) return;
    setUploading(true);
    try {
      await apiClient.delete('/config/business/logo');
      setLogoUrl('');
      toast.success('Logo eliminado');
    } catch (e) {
      toast.error('Error al eliminar');
    } finally { setUploading(false); }
  };

  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleUpload(e.dataTransfer.files[0]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon size={18} className="text-indigo-500" />
          Logo del Negocio
        </CardTitle>
        <CardDescription>
          Se muestra en tickets, catálogo público y certificado de garantía. PNG/JPG/WEBP, máx 2 MB.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-indigo-500" />
          </div>
        ) : logoUrl ? (
          <>
          <div className="flex items-center gap-6 flex-wrap">
            {/* Preview */}
            <div className="w-40 h-40 rounded-2xl border-2 border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shadow-inner relative">
              <img src={getFullUrl(logoUrl)} alt="Logo del negocio"
                className="max-w-full max-h-full object-contain p-3" />
              <div className="absolute top-1 right-1 bg-emerald-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <Check size={9} /> ACTIVO
              </div>
            </div>

            {/* Acciones */}
            <div className="space-y-2">
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm transition disabled:opacity-50">
                <ImagePlus size={16} />
                {uploading ? 'Subiendo…' : 'Reemplazar logo'}
                <input ref={fileInputRef} type="file" className="hidden" accept="image/*" disabled={uploading}
                  onChange={e => handleUpload(e.target.files?.[0])} />
              </label>
              <button onClick={handleDelete} disabled={uploading}
                className="block w-full px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-sm font-bold transition disabled:opacity-50 flex items-center justify-center gap-2">
                <Trash2 size={16} /> Eliminar logo
              </button>
              <p className="text-[10px] text-slate-400">
                Se procesa automáticamente: max 600×600 px, optimizado a PNG.
              </p>
            </div>
          </div>

          {/* Selector de tamaño del logo en garantía */}
          <div className="mt-5 pt-5 border-t border-slate-100">
            <Label className="text-xs font-bold uppercase text-slate-500 mb-2 block">
              Tamaño del logo en el PDF de garantía
            </Label>
            <div className="grid grid-cols-5 gap-2">
              {[
                { id: 'small',   label: 'Pequeño',  desc: '70%' },
                { id: 'medium',  label: 'Mediano',  desc: '100%' },
                { id: 'large',   label: 'Grande',   desc: '160%' },
                { id: 'xlarge',  label: 'Extra',    desc: '250%' },
                { id: 'gigante', label: 'Gigante',  desc: '350%' },
              ].map(opt => (
                <button key={opt.id}
                  onClick={() => handleSizeChange(opt.id)}
                  className={`px-3 py-2 rounded-xl border-2 transition text-center ${
                    logoSize === opt.id
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'
                  }`}>
                  <div className="text-xs font-bold">{opt.label}</div>
                  <div className="text-[10px] opacity-70">{opt.desc}</div>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              Aplica solo al certificado de garantía (no afecta otros tickets).
            </p>
          </div>
          </>
        ) : (
          <div onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
            className={`rounded-2xl border-2 border-dashed py-10 px-6 text-center transition cursor-pointer ${
              dragActive ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 hover:border-indigo-300 bg-slate-50/50'
            }`}
            onClick={() => fileInputRef.current?.click()}>
            <div className="mx-auto w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mb-3 shadow-sm">
              <ImagePlus size={24} className="text-slate-400" />
            </div>
            <p className="text-sm font-bold text-slate-700 mb-1">Arrastra tu logo aquí o haz click</p>
            <p className="text-xs text-slate-500">PNG, JPG o WEBP · Máximo 2 MB · Se redimensiona a 600×600</p>
            <input ref={fileInputRef} type="file" className="hidden" accept="image/*"
              onChange={e => handleUpload(e.target.files?.[0])} />
            {uploading && (
              <Loader2 size={20} className="animate-spin text-indigo-500 mx-auto mt-3" />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
