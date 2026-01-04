from sqlalchemy import Column, Integer, String, Boolean
from ..database.db import Base

class NotasRapidas(Base):
    """
    Tabla simple para notas rápidas.
    Migración de prueba #3 - Estructura básica.
    """
    __tablename__ = "notas_rapidas"
    
    id = Column(Integer, primary_key=True, index=True)
    texto = Column(String(500), nullable=False)
    completada = Column(Boolean, default=False)
    
    def __repr__(self):
        return f"<NotasRapidas(id={self.id}, completada={self.completada})>"
