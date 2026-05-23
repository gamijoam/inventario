import os
import uuid
import shutil
from fastapi import UploadFile, HTTPException
from ..tenant_context import get_tenant_schema
from PIL import Image

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

        # Detectar si la imagen tiene canal alpha (fondo transparente)
        has_alpha = image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info)

        if has_alpha:
            # Normalizar a RGBA para que WEBP guarde el alpha
            image = image.convert("RGBA")
            # WebP soporta alpha. quality=90 para mantener bordes nítidos del recorte.
            image.save(file_location, "WEBP", quality=90, lossless=False)
        else:
            # Fondo opaco: convertir a RGB para reducir tamaño
            if image.mode != "RGB":
                image = image.convert("RGB")
            image.save(file_location, "WEBP", quality=85)

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
        has_alpha = image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info)
        if has_alpha:
            image = image.convert("RGBA")
            image.save(file_location, "WEBP", quality=90, lossless=False)
        else:
            if image.mode != "RGB":
                image = image.convert("RGB")
            image.save(file_location, "WEBP", quality=85)
    except Exception as e:
        print(f"❌ Error saving bytes as image in {file_location}: {e}")
        raise HTTPException(status_code=500, detail="Error al guardar la imagen")

    return f"/media/{folder}/{unique_filename}"



