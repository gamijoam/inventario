const FIELD_LABELS = {
    name: 'Nombre',
    sku: 'SKU',
    price: 'Precio',
    stock: 'Stock',
    category_id: 'Categoria',
    warehouse_id: 'Almacen',
    email: 'Correo',
    password: 'Contrasena',
    username: 'Usuario',
    id_number: 'Cedula/RIF',
    amount: 'Monto del pago',
    payment_method: 'Metodo de pago',
    reference: 'Referencia',
    payment_date: 'Fecha del pago',
    currency: 'Moneda',
};

const normalizeText = (value) => String(value || '').trim();

const translateKnownMessage = (message) => {
    const text = normalizeText(message);
    const lower = text.toLowerCase();

    if (!text) return '';
    if ((lower.includes('sku') || lower.includes('barcode')) && (lower.includes('already exists') || lower.includes('duplicate') || lower.includes('unique'))) {
        return 'Ya existe un producto con ese SKU. Usa otro codigo o deja el SKU vacio si no aplica.';
    }
    if (lower.includes('decimal input should be') || lower.includes('valid decimal') || lower.includes('finite number')) return 'debe ser un numero valido';
    if (lower.includes('field required')) return 'es obligatorio';
    if (lower.includes('input should be greater than') || lower.includes('greater than 0')) return 'debe ser mayor que cero';
    if (lower.includes('payment method requires reference') || lower.includes('requires reference')) return 'Este metodo de pago requiere numero de referencia.';
    if (lower.includes('cash session') && (lower.includes('closed') || lower.includes('not open'))) return 'La caja esta cerrada. Abre una caja antes de cobrar.';
    if (lower.includes('warehouse') && lower.includes('required')) return 'Selecciona un almacen para completar la operacion.';
    if (lower.includes('sale') && lower.includes('void')) return 'No se pudo anular la venta. Verifica permisos, PIN o estado de la factura.';
    if (lower.includes('warranty') && lower.includes('not found')) return 'No se encontro garantia para esta venta o IMEI.';
    if (lower.includes('imei') && lower.includes('not found')) return 'IMEI no encontrado.';
    if (lower.includes('supplier') && (lower.includes('already exists') || lower.includes('duplicate'))) return 'Ya existe un proveedor con esos datos.';
    if (lower.includes('purchase') && lower.includes('not found')) return 'Compra no encontrada.';
    if (lower.includes('quote') && lower.includes('not found')) return 'Cotizacion no encontrada.';
    if (lower.includes('product not found')) return 'Producto no encontrado. Puede que haya sido eliminado o movido por otro usuario.';
    if (lower.includes('payment method already exists')) return 'Ya existe un metodo de pago con ese nombre.';
    if (lower.includes('name already exists')) return 'Ya existe un registro con ese nombre.';
    if (lower.includes('customer with this id number already exists')) return 'Ya existe un cliente con esa cedula/RIF.';
    if (lower.includes('username already exists')) return 'Ya existe un usuario con ese correo o nombre de usuario.';
    if (lower.includes('database error')) return 'No se pudo guardar por una restriccion de datos. Revisa campos duplicados o valores invalidos.';
    if (lower.includes('not enough stock') || lower.includes('stock insuficiente')) return 'No hay stock suficiente para completar la operacion.';
    if (lower.includes('cannot deactivate your own account')) return 'No puedes desactivar tu propia cuenta.';
    if (lower.includes('incorrect username or password')) return 'Usuario o contrasena incorrectos.';
    if (lower.includes('user account is inactive')) return 'La cuenta de usuario esta inactiva.';
    if (lower.includes('pin is required')) return 'El PIN es obligatorio.';
    if (lower.includes('invalid pin')) return 'PIN invalido.';
    if (lower.includes('pin must be 4-6 digits')) return 'El PIN debe tener entre 4 y 6 digitos.';
    if (lower.includes('user not found')) return 'Usuario no encontrado.';

    return text;
};

const formatValidationDetail = (detail) => {
    if (!Array.isArray(detail) || detail.length === 0) return '';
    return detail.map((item) => {
        if (typeof item === 'string') return translateKnownMessage(item);
        const rawLoc = Array.isArray(item?.loc) ? item.loc.filter(Boolean) : [];
        const field = rawLoc[rawLoc.length - 1];
        const label = FIELD_LABELS[field] || field;
        const msg = translateKnownMessage(item?.msg || item?.message || 'valor invalido');
        return label ? `${label}: ${msg}` : msg;
    }).filter(Boolean).join(' | ');
};

export const getApiErrorMessage = (error, fallback = 'No se pudo completar la accion') => {
    const status = error?.response?.status;
    const data = error?.response?.data;
    const detail = data?.detail ?? data?.message ?? data?.error;

    if (status === 401) return 'Tu sesion expiro. Inicia sesion nuevamente.';
    if (status === 403) return 'No tienes permisos para realizar esta accion.';
    if (status === 404) return translateKnownMessage(detail) || 'No encontramos el registro solicitado.';
    if (status === 409) return translateKnownMessage(detail) || 'Ya existe un registro con esos datos.';
    if (!status) return 'No hay conexion con el servidor. Revisa internet o intenta de nuevo.';

    if (typeof detail === 'string') return translateKnownMessage(detail) || fallback;
    if (Array.isArray(detail)) return formatValidationDetail(detail) || fallback;
    if (detail && typeof detail === 'object') {
        const values = Object.entries(detail).map(([key, value]) => {
            const label = FIELD_LABELS[key] || key;
            const msg = Array.isArray(value) ? value.join(', ') : value;
            return `${label}: ${translateKnownMessage(msg)}`;
        }).join(' | ');
        return values || fallback;
    }

    return translateKnownMessage(error?.message) || fallback;
};

export const showApiError = (toast, error, fallback) => {
    toast.error(getApiErrorMessage(error, fallback));
};
