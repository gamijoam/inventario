// Script para resetear la configuración y probar el wizard
// Ejecutar en la consola del navegador:

// 1. Borrar configuración guardada
localStorage.removeItem('cloud_config');

// 2. Recargar la página
location.reload();

// El wizard debería aparecer automáticamente
console.log('✅ Configuración reseteada. El wizard debería aparecer al recargar.');
