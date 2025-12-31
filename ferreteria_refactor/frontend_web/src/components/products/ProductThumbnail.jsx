// Componente simple para mostrar miniatura de producto con fallback
import { Package } from 'lucide-react';

export default function ProductThumbnail({ imageUrl, productName, size = 'md', updatedAt }) {
    const sizes = {
        sm: 'w-10 h-10',
        md: 'w-16 h-16',
        lg: 'w-24 h-24'
    };

    const iconSizes = {
        sm: 16,
        md: 24,
        lg: 32
    };

    // Cache busting con updated_at
    const getImageUrl = () => {
        if (!imageUrl) return null;
        const timestamp = updatedAt ? new Date(updatedAt).getTime() : Date.now();
        // Use relative path - works in both dev and production
        return `${imageUrl}?v=${timestamp}`;
    };

    if (!imageUrl) {
        return (
            <div className={`${sizes[size]} bg-slate-100 rounded-lg flex items-center justify-center border border-slate-200`}>
                <Package className="text-slate-400" size={iconSizes[size]} />
            </div>
        );
    }

    return (
        <img
            src={getImageUrl()}
            alt={productName}
            className={`${sizes[size]} object-cover rounded-lg border border-slate-200`}
            onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = `
          <div class="${sizes[size]} bg-slate-100 rounded-lg flex items-center justify-center border border-slate-200">
            <svg class="text-slate-400" width="${iconSizes[size]}" height="${iconSizes[size]}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
            </svg>
          </div>
        `;
            }}
        />
    );
}
