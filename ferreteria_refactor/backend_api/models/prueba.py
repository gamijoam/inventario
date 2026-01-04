from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from ..database.db import Base
from ..utils.time_utils import get_venezuela_now

class PruebaActualizacion(Base):
    """
    Tabla de prueba para validar que Alembic detecta cambios incrementales.
    
    Esta tabla se puede borrar después de confirmar que las migraciones funcionan.
    """
    __tablename__ = "prueba_actualizacion"
    
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text, nullable=True)
    activo = Column(Boolean, default=True)
    fecha_creacion = Column(DateTime, default=get_venezuela_now)
    
    def __repr__(self):
        return f"<PruebaActualizacion(id={self.id}, nombre='{self.nombre}')>"
