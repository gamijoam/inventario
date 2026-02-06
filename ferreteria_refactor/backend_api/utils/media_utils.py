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
    
    # 4. Save and Convert to WebP
    try:
        # Open the uploaded image
        image = Image.open(file.file)
        
        # Convert to RGB if necessary
        if image.mode in ("RGBA", "P"):
            image = image.convert("RGB")
            
        # Save as WEBP
        image.save(file_location, "WEBP", quality=85)
        
    except Exception as e:
        print(f"❌ Error saving/converting image in {file_location}: {e}")
        raise HTTPException(status_code=500, detail="Error al procesar la imagen")
    
    # 5. Return Public URL (Enforced clean path)
    return f"/media/{folder}/{unique_filename}"



