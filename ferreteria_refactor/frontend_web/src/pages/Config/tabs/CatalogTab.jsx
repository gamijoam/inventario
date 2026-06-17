import { useState, useEffect } from 'react';
import apiClient from '../../../config/axios';
import { toast } from 'react-hot-toast';
import { ExternalLink, QrCode, Copy, Check, Star, Clock, Eye, EyeOff, ShoppingCart, Loader } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';

export default function CatalogTab() {
  const [config, setConfig]   = useState({
    catalog_show_out_of_stock: 'false',
    catalog_business_hours:    '',
    catalog_whatsapp_cart:     'true',
  });
  const [saving, setSaving]   = useState(false);
  const [copied, setCopied]   = useState(false);

  // Detectar el subdominio actual para construir el link del catálogo
  const catalogUrl = `${window.location.protocol}//${window.location.host}/#/catalogo`;

  useEffect(() => {
    apiClient.get('/config').then(r => {
      const keys = ['catalog_show_out_of_stock','catalog_business_hours','catalog_whatsapp_cart'];
      const map  = {};
      (Array.isArray(r.data) ? r.data : []).forEach(c => {
        if (keys.includes(c.key)) map[c.key] = c.value;
      });
      setConfig(prev => ({ ...prev, ...map }));
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await apiClient.post('/public/catalog/config', config);
      toast.success('Configuracion del catalogo guardada');
    } catch {
      toast.error('Error al guardar');
    } finally { setSaving(false); }
  };

  const toggle = (key) => setConfig(c => ({
    ...c, [key]: c[key] === 'true' ? 'false' : 'true'
  }));

  const copyLink = () => {
    navigator.clipboard?.writeText(catalogUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Link y QR */}
      <Card className="rounded-lg border-slate-200 shadow-sm">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
            <QrCode size={18} className="text-indigo-600" />
            Link del catálogo público
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-5 pt-0">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600 truncate font-mono">
              {catalogUrl}
            </div>
            <button onClick={copyLink}
              className={`px-3 py-2.5 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-all
                ${copied ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}>
              {copied ? <><Check size={13} />Copiado</> : <><Copy size={13} />Copiar</>}
            </button>
            <a href={catalogUrl} target="_blank" rel="noreferrer"
              className="px-3 py-2.5 border border-slate-200 rounded-md text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-all">
              <ExternalLink size={13} />Ver
            </a>
          </div>

          <div className="flex justify-center">
            <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm inline-block">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(catalogUrl)}&color=4f46e5&bgcolor=ffffff`}
                alt="QR del catálogo"
                className="rounded-md"
                width={160} height={160}
              />
              <p className="text-[10px] text-center text-slate-400 mt-2 font-medium">
                Comparte este QR con tus clientes
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Opciones del catálogo */}
      <Card className="rounded-lg border-slate-200 shadow-sm">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-lg font-black text-slate-900">Opciones del catalogo</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100 p-5 pt-0">

          {/* Carrito WhatsApp */}
          <div className="flex items-start gap-3 py-4 first:pt-0">
            <div className="h-9 w-9 rounded-md bg-emerald-50 flex items-center justify-center shrink-0">
              <ShoppingCart size={17} className="text-emerald-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold text-slate-800 cursor-pointer">
                  Carrito de WhatsApp
                </Label>
                <div onClick={() => toggle('catalog_whatsapp_cart')}
                  className={`w-11 h-6 rounded-full cursor-pointer transition-colors relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all
                    ${config.catalog_whatsapp_cart === 'true' ? 'bg-emerald-500 after:translate-x-5' : 'bg-slate-200'}`}
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Los clientes agregan productos al carrito y envían el pedido completo por WhatsApp.
              </p>
            </div>
          </div>

          {/* Mostrar agotados */}
          <div className="flex items-start gap-3 py-4">
            <div className="h-9 w-9 rounded-md bg-slate-50 flex items-center justify-center shrink-0">
              {config.catalog_show_out_of_stock === 'true'
                ? <Eye size={17} className="text-slate-600" />
                : <EyeOff size={17} className="text-slate-400" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold text-slate-800 cursor-pointer">
                  Mostrar productos agotados
                </Label>
                <div onClick={() => toggle('catalog_show_out_of_stock')}
                  className={`w-11 h-6 rounded-full cursor-pointer transition-colors relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all
                    ${config.catalog_show_out_of_stock === 'true' ? 'bg-indigo-500 after:translate-x-5' : 'bg-slate-200'}`}
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Si está activo, los productos sin stock aparecen con cartel "Agotado" en lugar de ocultarse.
              </p>
            </div>
          </div>

          {/* Horario */}
          <div className="flex items-start gap-3 py-4">
            <div className="h-9 w-9 rounded-md bg-amber-50 flex items-center justify-center shrink-0">
              <Clock size={17} className="text-amber-600" />
            </div>
            <div className="flex-1 space-y-2">
              <Label className="text-sm font-bold text-slate-800 block">
                Horario de atención
              </Label>
              <input
                value={config.catalog_business_hours}
                onChange={e => setConfig(c => ({ ...c, catalog_business_hours: e.target.value }))}
                placeholder="Ej: Lun-Vie 8am-6pm | Sáb 9am-2pm"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
              />
              <p className="text-[11px] text-slate-400">
                Se muestra debajo del nombre del negocio en el catálogo.
              </p>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Tip de productos destacados */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
        <Star size={16} className="text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Destacar productos</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Para marcar un producto como destacado ve a <strong>Inventario, editar producto</strong> y activa el toggle "Destacar en catalogo publico". Los productos destacados aparecen primero en el catalogo.
          </p>
        </div>
      </div>

      <Button onClick={save} disabled={saving} className="w-full rounded-md bg-indigo-600 hover:bg-indigo-700">
        {saving ? <><Loader size={16} className="animate-spin mr-2" />Guardando...</> : 'Guardar configuración del catálogo'}
      </Button>
    </div>
  );
}
