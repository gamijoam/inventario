// Invensoft Desktop — Tauri Core
//
// Fase 1: Arrancar el sidecar del backend FastAPI + cargar la app React.
// Fase 2+: System tray, impresoras, auto-updater, comandos nativos.

use tauri::Manager;
use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // ── Lanzar el sidecar del backend (invensoft-backend.exe) ─────────
            // El sidecar corre FastAPI + PostgreSQL en localhost:8000.
            // Tauri lo gestiona: si se cierra la ventana, el sidecar también muere.
            let shell = app.shell();
            let _sidecar = shell
                .sidecar("invensoft-backend")
                .expect("Sidecar 'invensoft-backend' no encontrado en bundle")
                .spawn()
                .expect("Error al arrancar el backend de Invensoft");

            // Guardar el handle para poder matar el proceso al cerrar (opcional)
            // app.manage(SidecarHandle(_sidecar));

            println!("[Tauri] ✅ Sidecar backend iniciado.");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Invensoft");
}
