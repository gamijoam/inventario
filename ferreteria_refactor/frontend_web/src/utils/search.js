/**
 * Normaliza un string para búsqueda fuzzy.
 * Elimina caracteres especiales (puntos, guiones, espacios, acentos, etc.)
 * y convierte a minúsculas para comparación insensible.
 *
 * Ejemplos:
 *   normalizeSearch("p.c")     → "pc"
 *   normalizeSearch("P.C")     → "pc"
 *   normalizeSearch("hello-world") → "helloworld"
 *   normalizeSearch("USB-C")   → "usbc"
 *
 * @param {string|undefined|null} str
 * @returns {string}
 */
export const normalizeSearch = (str) =>
    str ? str.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
