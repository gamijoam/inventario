// Mapa de videos de onboarding por módulo y pestaña.
// Clave: "modulo:pestana" — videoId: ID de YouTube (parte después de ?v= o youtu.be/)
// Para agregar un video nuevo: agrega la clave y el videoId aquí.

export const ONBOARDING_VIDEOS = {
    // Centro de Inventario
    'inventory:productos':   { videoId: 'btv6ZDuO4kA', title: 'Cómo gestionar tus productos' },
    // 'inventory:categorias':  { videoId: '', title: 'Organizar productos por categorías' },
    // 'inventory:kardex':      { videoId: '', title: 'Qué es el Kardex y cómo leerlo' },
    // 'inventory:traslados':   { videoId: '', title: 'Traslados entre almacenes y sucursales' },
    // 'inventory:almacenes':   { videoId: '', title: 'Gestión de almacenes' },
    // 'inventory:seriales':    { videoId: '', title: 'Recepción de productos serializados' },

    // POS / Ventas
    // 'pos':                   { videoId: '', title: 'Cómo realizar una venta' },

    // Compras
    // 'purchases':             { videoId: '', title: 'Registrar una compra a proveedor' },

    // Servicios
    // 'services:reception':    { videoId: '', title: 'Nueva orden de servicio técnico' },
};
