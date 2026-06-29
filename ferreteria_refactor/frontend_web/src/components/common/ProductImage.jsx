import React, { useEffect, useState } from 'react';
import { API_ROOT_URL } from '../../config/constants';
import noImgPlaceholder from '../../assets/no-img.svg';

/**
 * ProductImage Component
 * Handles cross-domain image URLs, cache busting, thumbnails, and fallback placeholder.
 */
const ProductImage = ({ src, alt, className, iconSize = 24, updatedAt, preferThumbnail = false }) => {
    const [error, setError] = useState(false);
    const [fallbackToOriginal, setFallbackToOriginal] = useState(false);

    useEffect(() => {
        setError(false);
        setFallbackToOriginal(false);
    }, [src, updatedAt, preferThumbnail]);

    const getThumbnailUrl = (url) => {
        if (!preferThumbnail || !url) return url;
        const match = url.match(/^(.*\/media\/products\/)([^/?#]+\.webp)([?#].*)?$/i);
        if (!match) return url;
        return `${match[1]}thumbs/${match[2]}${match[3] || ''}`;
    };

    // Cache busting with updated_at. If there is no update date, keep a stable URL.
    const getVersionedUrl = (url) => {
        if (!updatedAt) return url;
        const timestamp = new Date(updatedAt).getTime();
        return `${url}${url.includes('?') ? '&' : '?'}v=${timestamp}`;
    };

    if (!src || error) {
        return (
            <img
                src={noImgPlaceholder}
                alt="Sin imagen"
                className={`${className} object-cover opacity-50 grayscale`}
                loading="lazy"
                decoding="async"
                draggable="false"
            />
        );
    }

    const requestedSrc = fallbackToOriginal ? src : getThumbnailUrl(src);

    // Prepend BASE_API_URL if it's not an absolute URL (doesn't start with http)
    const isAbsolute = requestedSrc.startsWith('http');
    const fullUrl = isAbsolute ? requestedSrc : `${API_ROOT_URL}${requestedSrc}`;
    const finalUrl = getVersionedUrl(fullUrl);

    // Final class logic
    const imgClass = `${className || ''} ${className?.includes('object-') ? '' : 'object-cover'}`.trim();

    return (
        <img
            src={finalUrl}
            alt={alt || "Producto"}
            className={imgClass}
            onError={() => {
                if (preferThumbnail && !fallbackToOriginal && requestedSrc !== src) {
                    setFallbackToOriginal(true);
                    return;
                }
                setError(true);
            }}
            loading="lazy"
            decoding="async"
            draggable="false"
        />
    );
};

export default ProductImage;
