from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Numeric
from sqlalchemy.orm import relationship
from ..database.db import Base
from ..utils.time_utils import get_venezuela_now

class PruebaVPS(Base):
    """
    Segunda tabla de prueba para validar migraciones en VPS.
    
    Esta tabla incluye:
    - Diferentes tipos de datos
    - Relación con la tabla users
    - Índices personalizados
    """
    __tablename__ = "prueba_vps"
    
    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(200), nullable=False, index=True)
    contenido = Column(Text, nullable=True)
    precio = Column(Numeric(12, 2), default=0.00)
    cantidad = Column(Integer, default=0)
    activo = Column(Boolean, default=True)
    fecha_creacion = Column(DateTime, default=get_venezuela_now, index=True)
    fecha_actualizacion = Column(DateTime, default=get_venezuela_now, onupdate=get_venezuela_now)
    
    # Relación con usuarios (quien creó este registro)
    usuario_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    usuario = relationship("User")
    
    def __repr__(self):
        return f"<PruebaVPS(id={self.id}, titulo='{self.titulo}', precio={self.precio})>"
