// Invensoft Desktop — Tauri Core

use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // En modo release (producción): lanzar el sidecar del backend automáticamente.
            // En modo dev: el desarrollador arranca el backend manualmente con Python.
            #[cfg(not(debug_assertions))]
            {
                use tauri::Manager;
                let shell = app.shell();
                match shell.sidecar("invensoft-backend") {
                    Ok(cmd) => match cmd.spawn() {
                        Ok(_)  => println!("[Tauri] ✅ Backend sidecar iniciado."),
                        Err(e) => eprintln!("[Tauri] ⚠️  No se pudo iniciar el backend: {e}"),
                    },
                    Err(e) => eprintln!("[Tauri] ⚠️  Sidecar no encontrado: {e}"),
                }
            }

            #[cfg(debug_assertions)]
            println!("[Tauri] DEV MODE — backend debe iniciarse manualmente en localhost:8000");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Invensoft");
}
