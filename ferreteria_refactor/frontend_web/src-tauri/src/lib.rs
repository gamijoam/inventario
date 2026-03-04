// Invensoft Desktop — Tauri Core
// Fase 1: Wrapper básico que carga la app React.
// Fase 2+: Aquí se agregarán comandos nativos (system tray, impresoras, licencias).

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running Invensoft");
}
