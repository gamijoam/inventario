/**
 * WarrantyTemplateSelector.jsx
 * Selector visual de plantillas para el certificado de garantia (PDF).
 *
 * - GET /warranties/templates           → lista de plantillas disponibles
 * - GET /warranties/template-config     → plantilla actual del tenant
 * - PUT /warranties/template-config     → cambiar plantilla
 * - GET /warranties/template-preview/{style} → PDF de demo
 */
import { useEffect, useState } from 'react';
import { Check, Eye, FileText, Sparkles, Loader2 } from 'lucide-react';
import apiClient from '../../../config/axios';
import { toast } from 'react-hot-toast';

const STYLE_ICONS = {
  moderno:     '🎨',
  clasico:     '📜',
  minimalista: '⚪',
  corporativo: '💼',
  colorido:    '🌈',
  premium:     '✨',
  legal:       '⚖️',
};

const STYLE_THEMES = {
  moderno:     'from-blue-500 to-indigo-500',
  clasico:     'from-amber-700 to-stone-700',
  minimalista: 'from-slate-400 to-slate-600',
  corporativo: 'from-blue-900 to-amber-600',
  colorido:    'from-pink-500 via-purple-500 to-orange-500',
  premium:     'from-amber-700 to-amber-300',
  legal:       'from-slate-800 to-blue-700',
};

export default function WarrantyTemplateSelector() {
  const [templates, setTemplates] = useState([]);
  const [currentStyle, setCurrentStyle] = useState('moderno');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [previewing, setPreviewing] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [tplRes, cfgRes] = await Promise.all([
          apiClient.get('/warranties/templates'),
          apiClient.get('/warranties/template-config'),
        ]);
        setTemplates(tplRes.data || []);
        setCurrentStyle(cfgRes.data?.style || 'moderno');
      } catch {
        toast.error('Error al cargar plantillas');
      } finally { setLoading(false); }
    })();
  }, []);

  const handleSelect = async (style) => {
    if (style === currentStyle || saving) return;
    setSaving(style);
    try {
      await apiClient.put('/warranties/template-config', { style });
      setCurrentStyle(style);
      toast.success(`Plantilla "${style}" activada`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Error al guardar');
    } finally { setSaving(null); }
  };

  const handlePreview = async (style) => {
    setPreviewing(style);
    try {
      const r = await apiClient.get(`/warranties/template-preview/${style}`,
        { responseType: 'blob' });
      const blob = new Blob([r.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch {
      toast.error('Error al generar vista previa');
    } finally { setPreviewing(null); }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-5 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <div className="h-10 w-10 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center">
          <FileText size={18} />
        </div>
        <div className="flex-1">
          <h3 className="font-black text-slate-900">Diseño del Certificado de Garantía</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Elige cómo se ve el PDF que se imprime o envía al cliente. El cambio aplica de inmediato.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-3">
        {templates.map(tpl => {
          const isActive = tpl.id === currentStyle;
          const isSaving = saving === tpl.id;
          const isPreviewing = previewing === tpl.id;
          const theme = STYLE_THEMES[tpl.id] || 'from-slate-400 to-slate-600';
          return (
            <div key={tpl.id}
              onClick={() => handleSelect(tpl.id)}
              className={`relative rounded-lg p-4 cursor-pointer transition-all
                ${isActive
                  ? 'border border-indigo-500 bg-indigo-50/70 shadow-sm'
                  : 'border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm'
                }`}>

              {/* Badge "Activa" */}
              {isActive && (
                <div className="absolute top-3 right-3 bg-indigo-600 text-white text-[10px] font-black px-2 py-1 rounded-md flex items-center gap-1 shadow-sm">
                  <Check size={10} /> ACTIVA
                </div>
              )}

              {/* Thumbnail tipo paleta */}
              <div className={`h-20 rounded-md bg-gradient-to-br ${theme} flex items-center justify-center mb-3 overflow-hidden relative`}>
                <span className="text-3xl">{STYLE_ICONS[tpl.id] || '📄'}</span>
                {/* Líneas decorativas que simulan un PDF */}
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-3 left-3 right-3 h-0.5 bg-white rounded"></div>
                  <div className="absolute top-5 left-3 w-1/2 h-0.5 bg-white rounded"></div>
                  <div className="absolute bottom-5 left-3 right-3 h-0.5 bg-white rounded"></div>
                  <div className="absolute bottom-3 left-3 w-2/3 h-0.5 bg-white rounded"></div>
                </div>
              </div>

              <div className="flex items-center justify-between mb-1">
                <h4 className="font-black text-sm text-slate-900 capitalize">{tpl.name}</h4>
                {tpl.is_default && (
                  <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">
                    DEFAULT
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-500 leading-snug min-h-[34px]">
                {tpl.description}
              </p>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); handlePreview(tpl.id); }}
                  disabled={isPreviewing}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition disabled:opacity-50">
                  {isPreviewing ? <Loader2 size={11} className="animate-spin" /> : <Eye size={11} />}
                  Ver ejemplo
                </button>
                {!isActive && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleSelect(tpl.id); }}
                    disabled={isSaving}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition disabled:opacity-50">
                    {isSaving ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                    Usar esta
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
