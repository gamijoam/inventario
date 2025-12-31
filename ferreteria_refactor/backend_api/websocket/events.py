"""
WebSocket Event Definitions
Centralized event types for the system
"""

class WebSocketEvents:
    """Event type constants"""
    
    # Exchange Rates
    EXCHANGE_RATE_UPDATED = "exchange_rate:updated"
    EXCHANGE_RATE_CREATED = "exchange_rate:created"
    EXCHANGE_RATE_DELETED = "exchange_rate:deleted"
    
    # Products
    PRODUCT_UPDATED = "product:updated"
    PRODUCT_CREATED = "product:created"
    PRODUCT_DELETED = "product:deleted"
    PRODUCT_STOCK_UPDATED = "product:stock_updated"
    PRODUCT_LOW_STOCK = "product:low_stock"
    PRODUCT_OUT_OF_STOCK = "product:out_of_stock"
    
    # Cash Sessions
    CASH_SESSION_OPENED = "cash_session:opened"
    CASH_SESSION_CLOSED = "cash_session:closed"
    CASH_SESSION_MOVEMENT = "cash_session:movement"
    
    # Sales
    SALE_COMPLETED = "sale:completed"
    SALE_VOIDED = "sale:voided"
    SALE_PAYMENT_RECEIVED = "sale:payment_received"
    
    # Customers
    CUSTOMER_CREATED = "customer:created"
    CUSTOMER_UPDATED = "customer:updated"
    CUSTOMER_CREDIT_CHANGED = "customer:credit_changed"
    
    # Categories
    CATEGORY_CREATED = "category:created"
    CATEGORY_UPDATED = "category:updated"
    CATEGORY_DELETED = "category:deleted"
    
    # Suppliers
    SUPPLIER_CREATED = "supplier:created"
    SUPPLIER_UPDATED = "supplier:updated"
    
    # Users
    USER_CREATED = "user:created"
    USER_UPDATED = "user:updated"
    USER_ROLE_CHANGED = "user:role_changed"
    
    # System
    SYSTEM_NOTIFICATION = "system:notification"
    SYSTEM_ERROR = "system:error"
