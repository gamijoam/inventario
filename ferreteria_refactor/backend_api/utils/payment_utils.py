"""
Payment utilities for normalizing payment methods and currency symbols.
Centralized to avoid duplication across reports and export services.
"""

# Comprehensive payment method normalization mapping
PAYMENT_METHOD_MAPPING = {
    # Cash variants
    "Efectivo": "Efectivo",
    "Cash": "Efectivo",
    "cash": "Efectivo",
    "efectivo": "Efectivo",
    "Efectivo Bolívares": "Efectivo",
    "Efectivo Dólares": "Efectivo",
    "Efectivo (Bs)": "Efectivo",
    "Efectivo (USD)": "Efectivo",
    
    # Zelle
    "Zelle": "Zelle",
    "zelle": "Zelle",
    
    # Pago Móvil
    "Pago Móvil": "Pago Móvil",
    "pago movil": "Pago Móvil",
    "Pago Movil": "Pago Móvil",
    "pago móvil": "Pago Móvil",
    
    # Bank Transfer
    "Transferencia": "Transferencia",
    "transferencia": "Transferencia",
    "Transfer": "Transferencia",
    "transfer": "Transferencia",
    
    # POS / Card
    "Punto de Venta": "Punto de Venta",
    "POS": "Punto de Venta",
    "pos": "Punto de Venta",
    "Tarjeta": "Tarjeta",
    "tarjeta": "Tarjeta",
    "Débito": "Tarjeta",
    "Crédito": "Tarjeta",
    "Card": "Tarjeta",
    "card": "Tarjeta",
}


def normalize_payment_method(method: str) -> str:
    """
    Normalize payment method name to standard format.
    
    Args:
        method: Raw payment method name from database
        
    Returns:
        Normalized payment method name
        
    Examples:
        >>> normalize_payment_method("Efectivo (Bs)")
        'Efectivo'
        >>> normalize_payment_method("cash")
        'Efectivo'
        >>> normalize_payment_method("zelle")
        'Zelle'
    """
    return PAYMENT_METHOD_MAPPING.get(method, method or "N/A")


def get_currency_symbol(currency: str) -> str:
    """
    Get the proper currency symbol for display.
    
    Args:
        currency: Currency code (USD, VES, Bs, etc.)
        
    Returns:
        Currency symbol ("$" for USD, "Bs" for Venezuelan Bolívar)
        
    Examples:
        >>> get_currency_symbol("USD")
        '$'
        >>> get_currency_symbol("VES")
        'Bs'
        >>> get_currency_symbol("Bs")
        'Bs'
    """
    currency_upper = (currency or "USD").upper()
    
    # Venezuelan Bolívar variants
    if currency_upper in ["VES", "BS", "VEF", "BOLIVARES", "BOLÍVARES"]:
        return "Bs"
    
    # Default to USD
    return "$"


def normalize_currency_code(currency: str) -> str:
    """
    Normalize currency code to standard format.
    
    Args:
        currency: Raw currency code
        
    Returns:
        Normalized currency code ("USD" or "VES")
        
    Examples:
        >>> normalize_currency_code("Bs")
        'VES'
        >>> normalize_currency_code("USD")
        'USD'
    """
    symbol = get_currency_symbol(currency)
    return "VES" if symbol == "Bs" else "USD"
