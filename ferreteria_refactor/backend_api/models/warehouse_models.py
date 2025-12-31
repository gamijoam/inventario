
class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    address = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    is_main = Column(Boolean, default=False) # To identify the primary/default warehouse

    stocks = relationship("ProductStock", back_populates="warehouse")

    def __repr__(self):
        return f"<Warehouse(name='{self.name}', main={self.is_main})>"

class ProductStock(Base):
    __tablename__ = "product_stocks"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    quantity = Column(Numeric(12, 3), default=0.000)
    location = Column(String, nullable=True) # Specific shelf/bin in this warehouse

    product = relationship("Product", back_populates="stocks")
    warehouse = relationship("Warehouse", back_populates="stocks")

    def __repr__(self):
        return f"<ProductStock(product={self.product_id}, warehouse={self.warehouse_id}, qty={self.quantity})>"
