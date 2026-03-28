"""
Mi Inventario Fácil — Launcher con UI
Inicia PostgreSQL + FastAPI con splash screen visual.
"""
import os
import sys
import time
import subprocess
import threading
import webbrowser

# Paths
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Set TCL/TK environment for embedded Python
os.environ['TCL_LIBRARY'] = os.path.join(BASE_DIR, 'python', 'tcl', 'tcl8.6')
os.environ['TK_LIBRARY'] = os.path.join(BASE_DIR, 'python', 'tcl', 'tk8.6')

import tkinter as tk
from tkinter import messagebox

PG_BIN = os.path.join(BASE_DIR, "postgresql", "bin")
PG_DATA = os.path.join(BASE_DIR, "postgresql", "data")
PG_LOG = os.path.join(BASE_DIR, "postgresql", "log.txt")
PYTHON_EXE = os.path.join(BASE_DIR, "python", "python.exe")
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
MEDIA_DIR = os.path.join(BACKEND_DIR, "media")
URL = "http://localhost:8000"

uvicorn_process = None
pg_started_by_us = False


def is_pg_running():
    try:
        r = subprocess.run(
            [os.path.join(PG_BIN, "pg_isready.exe"), "-h", "localhost", "-p", "5432", "-U", "postgres"],
            capture_output=True, timeout=5)
        return r.returncode == 0
    except Exception:
        return False


def start_postgresql():
    global pg_started_by_us
    if is_pg_running():
        return True
    os.makedirs(MEDIA_DIR, exist_ok=True)
    try:
        subprocess.run(
            [os.path.join(PG_BIN, "pg_ctl.exe"), "start", "-D", PG_DATA, "-l", PG_LOG, "-w"],
            capture_output=True, timeout=30)
        for _ in range(10):
            if is_pg_running():
                pg_started_by_us = True
                return True
            time.sleep(1)
    except Exception:
        pass
    return False


def start_uvicorn():
    global uvicorn_process
    env = os.environ.copy()
    env["PYTHONPATH"] = BASE_DIR
    uvicorn_process = subprocess.Popen(
        [PYTHON_EXE, "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"],
        cwd=BASE_DIR, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)


def wait_for_server(timeout=45):
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
    global uvicorn_process, pg_started_by_us
    if uvicorn_process:
        try:
            uvicorn_process.terminate()
            uvicorn_process.wait(timeout=5)
        except Exception:
            try: uvicorn_process.kill()
            except Exception: pass
        uvicorn_process = None
    if pg_started_by_us:
        try:
            subprocess.run(
                [os.path.join(PG_BIN, "pg_ctl.exe"), "stop", "-D", PG_DATA, "-m", "fast"],
                capture_output=True, timeout=10)
        except Exception:
            pass
        pg_started_by_us = False


# ═══════════════════════════════════════════════════
# SPLASH SCREEN
# ═══════════════════════════════════════════════════
class SplashScreen:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Mi Inventario Fácil")
        self.root.overrideredirect(True)
        self.root.configure(bg="#0f172a")

        w, h = 440, 300
        x = (self.root.winfo_screenwidth() - w) // 2
        y = (self.root.winfo_screenheight() - h) // 2
        self.root.geometry(f"{w}x{h}+{x}+{y}")
        self.root.attributes('-topmost', True)

        main = tk.Frame(self.root, bg="#0f172a")
        main.pack(expand=True, fill="both", padx=35, pady=30)

        # Icono
        tk.Label(main, text="\u2615", font=("Segoe UI Emoji", 40), bg="#0f172a", fg="#3b82f6").pack(pady=(5, 0))

        # Título
        tk.Label(main, text="Mi Inventario Fácil", font=("Segoe UI", 20, "bold"), bg="#0f172a", fg="white").pack(pady=(5, 0))

        # Subtítulo
        tk.Label(main, text="Sistema de Gestión de Negocios", font=("Segoe UI", 9), bg="#0f172a", fg="#64748b").pack(pady=(2, 25))

        # Estado
        self.status = tk.Label(main, text="Iniciando...", font=("Segoe UI", 10), bg="#0f172a", fg="#94a3b8")
        self.status.pack()

        # Barra de progreso (fondo)
        bar_bg = tk.Frame(main, bg="#1e293b", height=6)
        bar_bg.pack(fill="x", pady=(15, 0))
        bar_bg.pack_propagate(False)

        # Barra de progreso (relleno)
        self.bar = tk.Frame(bar_bg, bg="#3b82f6", height=6)
        self.bar.place(x=0, y=0, relheight=1, width=0)
        self.bar_bg_width = 370

        # Versión
        tk.Label(main, text="v1.0", font=("Segoe UI", 8), bg="#0f172a", fg="#334155").pack(anchor="e", pady=(10, 0))

    def update_status(self, text, pct):
        self.status.config(text=text)
        w = int(self.bar_bg_width * pct / 100)
        self.bar.place(x=0, y=0, relheight=1, width=max(w, 0))
        self.root.update()

    def destroy(self):
        self.root.destroy()


# ═══════════════════════════════════════════════════
# CONTROL PANEL (después de iniciar)
# ═══════════════════════════════════════════════════
class ControlPanel:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Mi Inventario Fácil")
        self.root.geometry("380x280")
        self.root.resizable(False, False)
        self.root.configure(bg="white")
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

        main = tk.Frame(self.root, bg="white")
        main.pack(expand=True, fill="both", padx=25, pady=20)

        # Check verde + título
        header = tk.Frame(main, bg="white")
        header.pack(fill="x", pady=(0, 10))
        tk.Label(header, text="\u2714", font=("Segoe UI Emoji", 20), bg="white", fg="#16a34a").pack(side="left")
        tk.Label(header, text="  Servidor activo", font=("Segoe UI", 16, "bold"), bg="white", fg="#0f172a").pack(side="left")

        # Info
        info = tk.Frame(main, bg="#f8fafc", relief="solid", bd=1)
        info.pack(fill="x", pady=(0, 15))
        for label, value in [
            ("URL:", URL),
            ("Usuario:", "admin"),
            ("Contraseña:", "admin123"),
        ]:
            row = tk.Frame(info, bg="#f8fafc")
            row.pack(fill="x", padx=12, pady=3)
            tk.Label(row, text=label, font=("Segoe UI", 9), bg="#f8fafc", fg="#64748b", width=12, anchor="w").pack(side="left")
            tk.Label(row, text=value, font=("Segoe UI", 9, "bold"), bg="#f8fafc", fg="#0f172a").pack(side="left")

        # Botones
        btns = tk.Frame(main, bg="white")
        btns.pack(fill="x")

        open_btn = tk.Button(btns, text="Abrir navegador", command=lambda: webbrowser.open(URL),
                             bg="#3b82f6", fg="white", font=("Segoe UI", 10, "bold"),
                             relief="flat", padx=20, pady=8, cursor="hand2")
        open_btn.pack(side="left", expand=True, fill="x", padx=(0, 5))

        stop_btn = tk.Button(btns, text="Detener", command=self.on_close,
                             bg="#ef4444", fg="white", font=("Segoe UI", 10, "bold"),
                             relief="flat", padx=20, pady=8, cursor="hand2")
        stop_btn.pack(side="right", expand=True, fill="x", padx=(5, 0))

        # Footer
        tk.Label(main, text="Otros dispositivos: http://[IP-de-esta-PC]:8000",
                 font=("Segoe UI", 8), bg="white", fg="#94a3b8").pack(pady=(10, 0))

    def on_close(self):
        stop_all()
        self.root.destroy()

    def run(self):
        self.root.mainloop()


# ═══════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════
def main():
    # Verificaciones
    if not os.path.exists(PG_DATA):
        root = tk.Tk(); root.withdraw()
        messagebox.showerror("Error", "Base de datos no inicializada.\nEjecute setup.bat primero.")
        root.destroy(); return

    # Splash
    splash = SplashScreen()

    def startup():
        try:
            splash.update_status("Iniciando base de datos...", 10)
            if not start_postgresql():
                splash.destroy()
                r = tk.Tk(); r.withdraw()
                messagebox.showerror("Error", "PostgreSQL no pudo iniciar.\nRevise postgresql\\log.txt")
                r.destroy(); return

            splash.update_status("Base de datos lista", 35)
            time.sleep(0.5)

            splash.update_status("Iniciando servidor web...", 45)
            start_uvicorn()

            for i in range(30):
                pct = 50 + int(i * 1.6)
                splash.update_status(f"Cargando aplicación...", min(pct, 95))
                try:
                    import urllib.request
                    urllib.request.urlopen(URL, timeout=1)
                    break
                except Exception:
                    time.sleep(1)
            else:
                splash.destroy()
                r = tk.Tk(); r.withdraw()
                messagebox.showerror("Error", "El servidor no respondió.\nEjecute start.bat para ver detalles.")
                r.destroy(); stop_all(); return

            splash.update_status("¡Listo! Abriendo navegador...", 100)
            time.sleep(0.8)
            webbrowser.open(URL)
            splash.destroy()

            # Panel de control
            panel = ControlPanel()
            panel.run()

        except Exception as e:
            try:
                splash.destroy()
                r = tk.Tk(); r.withdraw()
                messagebox.showerror("Error", f"Error inesperado:\n{e}")
                r.destroy()
            except Exception:
                pass
            stop_all()

    thread = threading.Thread(target=startup, daemon=True)
    thread.start()
    splash.root.mainloop()


if __name__ == "__main__":
    main()
