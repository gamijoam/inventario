// Componente de miniatura que utiliza el componente base ProductImage
import ProductImage from '../common/ProductImage';

export default function ProductThumbnail({ imageUrl, productName, size = 'md', updatedAt, className }) {
    const sizes = {
        xs: 'w-8 h-8',
        sm: 'w-10 h-10',
        md: 'w-16 h-16',
        lg: 'w-24 h-24'
    };

    const iconSizes = {
        xs: 12,
        sm: 16,
        md: 24,
        lg: 32
    };

    return (
        <ProductImage
            src={imageUrl}
            alt={productName}
            updatedAt={updatedAt}
            iconSize={iconSizes[size]}
            className={`${sizes[size]} rounded-lg ${className || ''}`}
        />
    );
}

