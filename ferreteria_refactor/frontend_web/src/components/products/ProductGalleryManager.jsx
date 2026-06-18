import { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Star, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../../config/axios';
import { API_ROOT_URL } from '../../config/constants';
import { cn } from '../../lib/utils';

const getSafeColorHex = (hex) => /^#([0-9a-fA-F]{6})$/.test(hex || '') ? hex : '#cbd5e1';

const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_ROOT_URL}${url}`;
};

const normalizeImages = (images = [], primaryImageUrl = '') => {
    const clean = (images || [])
        .filter(image => image?.image_url)
        .map((image, index) => ({
            ...image,
            color_name: image.color_name || '',
            color_hex: image.color_hex || '',
            sort_order: index,
            is_primary: !!image.is_primary,
        }));

    let primaryIndex = primaryImageUrl
        ? clean.findIndex(image => image.image_url === primaryImageUrl)
        : clean.findIndex(image => image.is_primary);

    if (primaryImageUrl && primaryIndex === -1) {
        clean.unshift({
            image_url: primaryImageUrl,
            color_name: '',
            color_hex: '',
            is_primary: true,
            sort_order: 0,
        });
        primaryIndex = 0;
    }

    if (primaryIndex === -1 && clean.length > 0) {
        primaryIndex = 0;
    }

    return clean.map((image, index) => ({
        ...image,
        sort_order: index,
        is_primary: index === primaryIndex,
    }));
};

export default function ProductGalleryManager({ galleryImages = [], primaryImageUrl = '', onChange, onPrimaryChange }) {
    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const images = useMemo(() => normalizeImages(galleryImages, primaryImageUrl), [galleryImages, primaryImageUrl]);

    const emitChange = (nextImages, nextPrimaryUrl = primaryImageUrl) => {
        const normalized = normalizeImages(nextImages, nextPrimaryUrl);
        const primary = normalized.find(image => image.is_primary);
        onChange(normalized);
        onPrimaryChange?.(primary?.image_url || '');
    };

    const handleUpload = async (files) => {
        const list = Array.from(files || []).filter(file => file.type.startsWith('image/'));
        if (list.length === 0) return;
        setUploading(true);
        try {
            const uploaded = [];
            for (const file of list) {
                const formData = new FormData();
                formData.append('file', file);
                const { data } = await apiClient.post('/products/upload-image', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                uploaded.push({
                    image_url: data?.image_url,
                    color_name: '',
                    color_hex: '',
                    is_primary: false,
                });
            }
            emitChange([...images, ...uploaded]);
            toast.success(list.length === 1 ? 'Imagen agregada a la galeria' : `${list.length} imagenes agregadas`);
        } catch (error) {
            toast.error(error?.response?.data?.detail || 'No se pudo subir la imagen');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const updateImage = (index, patch) => {
        const next = images.map((image, currentIndex) => currentIndex === index ? { ...image, ...patch } : image);
        emitChange(next);
    };

    const removeImage = (index) => {
        const next = images.filter((_, currentIndex) => currentIndex !== index);
        const nextPrimary = next.find(image => image.is_primary)?.image_url || next[0]?.image_url || '';
        emitChange(next, nextPrimary);
    };

    const moveImage = (index, direction) => {
        const target = index + direction;
        if (target < 0 || target >= images.length) return;
        const next = [...images];
        [next[index], next[target]] = [next[target], next[index]];
        emitChange(next);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                    <p className="text-sm font-black text-slate-900">Galeria por color</p>
                    <p className="text-xs font-semibold text-slate-500">Sube fotos adicionales y relacionalas con colores o acabados del mismo producto.</p>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(event) => handleUpload(event.target.files)}
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-indigo-200 bg-white px-3 text-sm font-black text-indigo-600 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <ImagePlus size={15} /> {uploading ? 'Subiendo...' : 'Agregar imagenes'}
                    </button>
                </div>
            </div>

            {images.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-10 text-center">
                    <p className="text-sm font-black text-slate-500">Todavia no hay imagenes en la galeria.</p>
                    <p className="mt-1 text-xs font-semibold text-slate-400">La primera que subas puede quedar como principal.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {images.map((image, index) => {
                        const isPrimary = image.image_url === primaryImageUrl || image.is_primary;
                        return (
                            <div key={`${image.image_url}-${index}`} className={cn('grid gap-3 rounded-lg border bg-white p-3 shadow-sm md:grid-cols-[88px_minmax(0,1fr)_auto]', isPrimary ? 'border-indigo-300' : 'border-slate-200')}>
                                <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                                    <img src={getImageUrl(image.image_url)} alt={image.color_name || 'Imagen de producto'} className="h-[88px] w-full object-cover" />
                                </div>

                                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px]">
                                    <div>
                                        <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Color / variante visual</label>
                                        <input
                                            value={image.color_name || ''}
                                            onChange={(event) => updateImage(index, { color_name: event.target.value })}
                                            placeholder="Ej: Negro mate, Azul oceano"
                                            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-indigo-400"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Muestra</label>
                                        <div className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3">
                                            <input
                                                type="color"
                                                value={getSafeColorHex(image.color_hex)}
                                                onChange={(event) => updateImage(index, { color_hex: event.target.value })}
                                                className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                                            />
                                            <span className="text-xs font-black text-slate-500">{getSafeColorHex(image.color_hex)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-row gap-2 md:flex-col">
                                    <button
                                        type="button"
                                        onClick={() => emitChange(images, image.image_url)}
                                        className={cn('inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-xs font-black transition', isPrimary ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600 hover:border-amber-200 hover:text-amber-700')}
                                    >
                                        <Star size={14} /> Principal
                                    </button>
                                    <button type="button" onClick={() => moveImage(index, -1)} disabled={index === 0} className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-slate-500 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"><ArrowUp size={14} /></button>
                                    <button type="button" onClick={() => moveImage(index, 1)} disabled={index === images.length - 1} className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-slate-500 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"><ArrowDown size={14} /></button>
                                    <button type="button" onClick={() => removeImage(index)} className="inline-flex h-9 items-center justify-center rounded-md border border-rose-200 bg-rose-50 px-3 text-rose-600 transition hover:bg-rose-100"><Trash2 size={14} /></button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
