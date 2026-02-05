import os
import uuid
import shutil
from fastapi import UploadFile, HTTPException
from ..tenant_context import get_tenant_schema

# Base directory for media files
# In Docker, this is mounted to a persistent volume /app/media
# For local dev, we follow a similar structure
BASE_MEDIA_DIR = "/app/media"

# Allowed extensions
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}

def save_upload_file(file: UploadFile, folder: str = "products") -> str:
    """
    Saves an uploaded file securely with multi-tenant isolation.
    
    Structure: /app/media/{tenant_id}/{folder}/{uuid}.{ext}
    Returns: The relative public URL (e.g., /media/tenant-a/products/uuid.jpg)
    """
    tenant_id = get_tenant_schema()
    
    # 1. Validate Extension
    extension = file.filename.split('.')[-1].lower() if '.' in file.filename else ''
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"Extensión no permitida. Use: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # 2. Generate Unique Name
    unique_filename = f"{uuid.uuid4()}.{extension}"
    
    # 3. Build Paths
    # Real path on disk - ENFORCING ABSOLUTE PATH /app/media
    full_path = os.path.join("/app/media", str(tenant_id), folder)
    os.makedirs(full_path, exist_ok=True)
    
    file_location = os.path.join(full_path, unique_filename)
    
    # 4. Save File
    try:
        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        print(f"❌ Error saving image in {file_location}: {e}")
        raise HTTPException(status_code=500, detail="Error interno al guardar la imagen")
    
    # 5. Return Public URL
    # Consistently use /media prefix for frontend access via Traefik/Nginx
    return f"/media/{tenant_id}/{folder}/{unique_filename}"

