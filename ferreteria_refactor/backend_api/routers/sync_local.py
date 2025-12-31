from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from ..database.db import get_db
from ..services import sync_client
from ..models import models

router = APIRouter(prefix="/sync-local", tags=["sync-local"])

@router.post("/trigger")
async def trigger_manual_sync(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Called by Desktop App Frontend to start a full sync from VPS.
    """
    try:
        # Get cloud URL from business configuration (key-value store)
        cloud_url_config = db.query(models.BusinessConfig).filter(
            models.BusinessConfig.key == "cloud_url"
        ).first()
        
        if not cloud_url_config or not cloud_url_config.value:
            raise HTTPException(
                status_code=400, 
                detail="No se ha configurado la URL del servidor de nube. Por favor, configura la sincronización en el wizard."
            )
        
        cloud_url = cloud_url_config.value.rstrip('/')
        
        print(f"[SYNC] Starting manual sync with cloud: {cloud_url}")
        
        # 1. Pull catalog from cloud
        pull_result = await sync_client.pull_catalog_from_cloud(db, vps_url=cloud_url)
        
        # 2. Push Pending Sales
        push_result = await sync_client.push_sales_to_cloud(db, vps_url=cloud_url)
        
        return {
            "message": "Sincronización completada", 
            "details": {
                "pull": pull_result,
                "push": push_result
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[SYNC ERROR] {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error en sincronización: {str(e)}")


