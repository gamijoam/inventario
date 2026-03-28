"""
Mi Inventario Fácil — Launcher
Inicia PostgreSQL + FastAPI con splash screen visual.
Se compila a .exe con: pyinstaller --onefile --windowed --icon=icon.ico launcher.py
"""
import os
import sys
import time
import subprocess
import threading
import tkinter as tk
from tkinter import messagebox
import webbrowser
import signal

# Paths relativos al .exe o al script
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Si el launcher está en la raíz del paquete
PG_BIN = os.path.join(BASE_DIR, "postgresql", "bin")
PG_DATA = os.path.join(BASE_DIR, "postgresql", "data")
PG_LOG = os.path.join(BASE_DIR, "postgresql", "log.txt")
PYTHON_EXE = os.path.join(BASE_DIR, "python", "python.exe")
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
MEDIA_DIR = os.path.join(BACKEND_DIR, "media")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

URL = "http://localhost:8000"
uvicorn_process = None
pg_started_by_us = False


def check_prerequisites():
    """Verifica que todos los archivos necesarios existen."""
    errors = []
    if not os.path.exists(os.path.join(PG_BIN, "pg_ctl.exe")):
        errors.append("PostgreSQL no encontrado")
    if not os.path.exists(PYTHON_EXE):
        errors.append("Python no encontrado")
    if not os.path.exists(os.path.join(BACKEND_DIR, "main.py")):
        errors.append("Backend no encontrado")
    if not os.path.exists(PG_DATA):
        errors.append("Base de datos no inicializada.\nEjecute setup.bat primero.")
    return errors


def is_pg_running():
    """Verifica si PostgreSQL está corriendo."""
    try:
        result = subprocess.run(
            [os.path.join(PG_BIN, "pg_isready.exe"), "-h", "localhost", "-p", "5432", "-U", "postgres"],
            capture_output=True, timeout=5
        )
        return result.returncode == 0
    except Exception:
        return False


def start_postgresql():
    """Inicia PostgreSQL si no está corriendo."""
    global pg_started_by_us
    if is_pg_running():
        return True

    # Crear media si no existe
    os.makedirs(MEDIA_DIR, exist_ok=True)

    try:
        subprocess.run(
            [os.path.join(PG_BIN, "pg_ctl.exe"), "start", "-D", PG_DATA, "-l", PG_LOG, "-w"],
            capture_output=True, timeout=30
        )
        # Esperar a que esté listo
        for _ in range(10):
            if is_pg_running():
                pg_started_by_us = True
                return True
            time.sleep(1)
    except Exception:
        pass
    return False


def start_uvicorn():
    """Inicia uvicorn en background."""
    global uvicorn_process
    env = os.environ.copy()
    env["PYTHONPATH"] = BASE_DIR

    uvicorn_process = subprocess.Popen(
        [PYTHON_EXE, "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"],
        cwd=BASE_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        creationflags=subprocess.CREATE_NO_WINDOW
    )
    return uvicorn_process


def wait_for_server(timeout=30):
    """Espera a que el servidor HTTP responda."""
    import urllib.request
    start = time.time()
    while time.time() - start < timeout:
        try:
            urllib.request.urlopen(URL, timeout=2)
            return True
        except Exception:
            time.sleep(1)
    return False


def stop_all():
    """Detiene uvicorn y PostgreSQL."""
    global uvicorn_process, pg_started_by_us
    if uvicorn_process:
        try:
            uvicorn_process.terminate()
            uvicorn_process.wait(timeout=5)
        except Exception:
            try:
                uvicorn_process.kill()
            except Exception:
                pass
        uvicorn_process = None

    if pg_started_by_us:
        try:
            subprocess.run(
                [os.path.join(PG_BIN, "pg_ctl.exe"), "stop", "-D", PG_DATA, "-m", "fast"],
                capture_output=True, timeout=10
            )
        except Exception:
            pass
        pg_started_by_us = False


class SplashScreen:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Mi Inventario Fácil")
        self.root.overrideredirect(True)  # Sin barra de título
        self.root.configure(bg="#0f172a")

        # Centrar ventana
        w, h = 420, 280
        x = (self.root.winfo_screenwidth() - w) // 2
        y = (self.root.winfo_screenheight() - h) // 2
        self.root.geometry(f"{w}x{h}+{x}+{y}")

        # Contenido
        frame = tk.Frame(self.root, bg="#0f172a")
        frame.pack(expand=True, fill="both", padx=30, pady=30)

        # Logo / Título
        title = tk.Label(frame, text="📦", font=("Segoe UI", 36), bg="#0f172a", fg="white")
        title.pack(pady=(10, 5))

        name = tk.Label(frame, text="Mi Inventario Fácil", font=("Segoe UI", 18, "bold"), bg="#0f172a", fg="white")
        name.pack()

        version = tk.Label(frame, text="Sistema de Gestión de Negocios", font=("Segoe UI", 9), bg="#0f172a", fg="#64748b")
        version.pack(pady=(2, 20))

        # Status
        self.status_label = tk.Label(frame, text="Iniciando...", font=("Segoe UI", 10), bg="#0f172a", fg="#94a3b8")
        self.status_label.pack()

        # Barra de progreso simple
        self.progress_frame = tk.Frame(frame, bg="#1e293b", height=4)
        self.progress_frame.pack(fill="x", pady=(15, 0))
        self.progress_bar = tk.Frame(self.progress_frame, bg="#3b82f6", height=4, width=0)
        self.progress_bar.place(x=0, y=0, height=4)

        self.progress = 0

    def set_status(self, text, progress=None):
        """Actualiza el mensaje y la barra de progreso."""
        self.status_label.config(text=text)
        if progress is not None:
            self.progress = progress
            bar_width = int(360 * (progress / 100))
            self.progress_bar.place(x=0, y=0, height=4, width=bar_width)
        self.root.update()

    def close(self):
        self.root.destroy()

    def show_error(self, message):
        self.root.deiconify()
        messagebox.showerror("Error - Mi Inventario Fácil", message)
        self.close()


class TrayApp:
    """Aplicación de bandeja del sistema después de iniciar."""
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Mi Inventario Fácil")
        self.root.geometry("320x200")
        self.root.resizable(False, False)
        self.root.protocol("WM_DELETE_WINDOW", self.minimize)

        frame = tk.Frame(self.root, padx=20, pady=20)
        frame.pack(expand=True, fill="both")

        tk.Label(frame, text="✅ Mi Inventario Fácil", font=("Segoe UI", 14, "bold"), fg="#16a34a").pack(pady=(0, 5))
        tk.Label(frame, text="El servidor está corriendo", font=("Segoe UI", 10), fg="#64748b").pack()
        tk.Label(frame, text=URL, font=("Segoe UI", 10, "bold"), fg="#3b82f6", cursor="hand2").pack(pady=(5, 15))

        btn_frame = tk.Frame(frame)
        btn_frame.pack(fill="x")

        tk.Button(btn_frame, text="Abrir Navegador", command=lambda: webbrowser.open(URL),
                  bg="#3b82f6", fg="white", font=("Segoe UI", 9, "bold"),
                  relief="flat", padx=15, pady=5).pack(side="left", padx=(0, 5))

        tk.Button(btn_frame, text="Detener y Salir", command=self.quit_app,
                  bg="#ef4444", fg="white", font=("Segoe UI", 9, "bold"),
                  relief="flat", padx=15, pady=5).pack(side="right")

    def minimize(self):
        self.root.withdraw()

    def quit_app(self):
        stop_all()
        self.root.destroy()

    def run(self):
        self.root.mainloop()


def main():
    # 1. Verificar prerequisitos
    errors = check_prerequisites()
    if errors:
        root = tk.Tk()
        root.withdraw()
        messagebox.showerror("Error - Mi Inventario Fácil", "\n".join(errors))
        root.destroy()
        return

    # 2. Splash screen
    splash = SplashScreen()

    def startup():
        try:
            # Paso 1: PostgreSQL
            splash.set_status("Iniciando base de datos...", 10)
            if not start_postgresql():
                splash.show_error("No se pudo iniciar PostgreSQL.\nRevise postgresql\\log.txt")
                return

            splash.set_status("Base de datos lista", 40)

            # Paso 2: Servidor web
            splash.set_status("Iniciando servidor web...", 50)
            start_uvicorn()

            splash.set_status("Esperando que el servidor esté listo...", 70)
            if not wait_for_server(timeout=30):
                splash.show_error("El servidor web no respondió.\nRevise la consola para más detalles.")
                stop_all()
                return

            splash.set_status("¡Listo! Abriendo navegador...", 100)
            time.sleep(1)

            # 3. Abrir navegador
            webbrowser.open(URL)

            # 4. Cerrar splash, abrir control panel
            splash.close()

            # 5. Ventana de control
            app = TrayApp()
            app.run()

        except Exception as e:
            try:
                splash.show_error(f"Error inesperado:\n{str(e)}")
            except Exception:
                pass
            stop_all()

    # Ejecutar startup en thread para que splash se actualice
    thread = threading.Thread(target=startup, daemon=True)
    thread.start()
    splash.root.mainloop()


if __name__ == "__main__":
    main()
