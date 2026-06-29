import os
import uuid
import shutil
from fastapi import UploadFile, HTTPException
from ..tenant_context import get_tenant_schema
from PIL import Image, ImageOps

# Base directory for media files
# In Docker, this is mounted to a persistent volume /app/media
# For local dev, we use a local 'media' folder
if os.environ.get("DOCKER_CONTAINER") or os.path.exists("/.dockerenv"):
    BASE_MEDIA_DIR = "/app/media"
else:
    # Local development
    BASE_MEDIA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "media")

# Allowed extensions
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
MAX_IMAGE_DIMENSION = 1200
THUMBNAIL_DIMENSION = 360
RESAMPLE_FILTER = getattr(Image, "Resampling", Image).LANCZOS


def _has_alpha(image: Image.Image) -> bool:
    return image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info)


def _prepare_image(image: Image.Image, max_dimension: int) -> Image.Image:
    prepared = ImageOps.exif_transpose(image)
    if max(prepared.size) > max_dimension:
        prepared = prepared.copy()
        prepared.thumbnail((max_dimension, max_dimension), RESAMPLE_FILTER)
    return prepared


def _save_webp(image: Image.Image, file_location: str, max_dimension: int, quality_rgb: int, quality_alpha: int) -> Image.Image:
    prepared = _prepare_image(image, max_dimension)
    if _has_alpha(prepared):
        output = prepared.convert("RGBA")
        output.save(file_location, "WEBP", quality=quality_alpha, lossless=False, method=6)
    else:
        output = prepared.convert("RGB") if prepared.mode != "RGB" else prepared
        output.save(file_location, "WEBP", quality=quality_rgb, method=6)
    return prepared


def _thumbnail_location(folder: str, filename: str) -> str:
    thumb_dir = os.path.join(BASE_MEDIA_DIR, folder, "thumbs")
    os.makedirs(thumb_dir, exist_ok=True)
    return os.path.join(thumb_dir, filename)


def _save_thumbnail(image: Image.Image, folder: str, filename: str) -> None:
    try:
        thumb_location = _thumbnail_location(folder, filename)
        _save_webp(
            image,
            thumb_location,
            max_dimension=THUMBNAIL_DIMENSION,
            quality_rgb=72,
            quality_alpha=78,
        )
    except Exception as e:
        # La miniatura acelera el POS, pero no debe bloquear la carga del producto.
        print(f"⚠️ Error creando miniatura {folder}/{filename}: {e}")


def save_upload_file(file: UploadFile, folder: str = "products") -> str:
    """
    Saves an uploaded file securely with WebP conversion.
    Strictly follows path: {BASE_MEDIA_DIR}/{folder}/{uuid}.webp
    Returns: The relative public URL (e.g., /media/products/uuid.webp)
    """
    # 1. Validate Extension
    extension = file.filename.split('.')[-1].lower() if '.' in file.filename else ''
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Extensión no permitida. Use: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # 2. Generate Unique Name
    unique_filename = f"{uuid.uuid4()}.webp"

    # 3. Build Paths
    full_path = os.path.join(BASE_MEDIA_DIR, folder)
    os.makedirs(full_path, exist_ok=True)

    file_location = os.path.join(full_path, unique_filename)

    # 4. Save and Convert to WebP — preservando alpha si la imagen tiene transparencia
    try:
        image = Image.open(file.file)
        prepared = _save_webp(
            image,
            file_location,
            max_dimension=MAX_IMAGE_DIMENSION,
            quality_rgb=85,
            quality_alpha=90,
        )
        _save_thumbnail(prepared, folder, unique_filename)

    except Exception as e:
        print(f"❌ Error saving/converting image in {file_location}: {e}")
        raise HTTPException(status_code=500, detail="Error al procesar la imagen")

    # 5. Return Public URL (Enforced clean path)
    return f"/media/{folder}/{unique_filename}"


def save_bytes_as_image(image_bytes: bytes, folder: str = "products",
                       extension: str = "png") -> str:
    """
    Guarda bytes crudos de una imagen ya procesada (ej. salida de rembg).
    Conserva canal alpha si existe. Devuelve URL pública.

    Args:
        image_bytes: bytes de la imagen (PNG/JPEG/WEBP).
        folder: subcarpeta dentro de media (ej. 'products').
        extension: extensión sugerida (solo informativa).

    Returns:
        URL relativa /media/{folder}/{uuid}.webp
    """
    import io
    unique_filename = f"{uuid.uuid4()}.webp"
    full_path = os.path.join(BASE_MEDIA_DIR, folder)
    os.makedirs(full_path, exist_ok=True)
    file_location = os.path.join(full_path, unique_filename)

    try:
        image = Image.open(io.BytesIO(image_bytes))
        prepared = _save_webp(
            image,
            file_location,
            max_dimension=MAX_IMAGE_DIMENSION,
            quality_rgb=85,
            quality_alpha=90,
        )
        _save_thumbnail(prepared, folder, unique_filename)
    except Exception as e:
        print(f"❌ Error saving bytes as image in {file_location}: {e}")
        raise HTTPException(status_code=500, detail="Error al guardar la imagen")

    return f"/media/{folder}/{unique_filename}"
