"""
Mi Inventario Fácil — Launcher
Inicia PostgreSQL + FastAPI con interfaz de consola visual.
Funciona con Python embebido (sin tkinter).
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

PG_BIN = os.path.join(BASE_DIR, "postgresql", "bin")
PG_DATA = os.path.join(BASE_DIR, "postgresql", "data")
PG_LOG = os.path.join(BASE_DIR, "postgresql", "log.txt")
PYTHON_EXE = os.path.join(BASE_DIR, "python", "python.exe")
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
MEDIA_DIR = os.path.join(BACKEND_DIR, "media")
URL = "http://localhost:8000"

uvicorn_process = None
pg_started_by_us = False


def clear():
    os.system('cls' if os.name == 'nt' else 'clear')


def banner(status="", progress=0):
    """Muestra el banner visual en consola."""
    clear()
    bar_width = 40
    filled = int(bar_width * progress / 100)
    bar = "█" * filled + "░" * (bar_width - filled)

    print()
    print("  ╔══════════════════════════════════════════════════╗")
    print("  ║                                                  ║")
    print("  ║        Mi Inventario Fácil                       ║")
    print("  ║        Sistema de Gestión de Negocios            ║")
    print("  ║                                                  ║")
    print("  ╠══════════════════════════════════════════════════╣")
    print(f"  ║  {status:<48} ║")
    print(f"  ║  [{bar}] {progress:>3}%  ║")
    print("  ║                                                  ║")
    print("  ╚══════════════════════════════════════════════════╝")
    print()


def is_pg_running():
    try:
        result = subprocess.run(
            [os.path.join(PG_BIN, "pg_isready.exe"), "-h", "localhost", "-p", "5432", "-U", "postgres"],
            capture_output=True, timeout=5
        )
        return result.returncode == 0
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
            capture_output=True, timeout=30
        )
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
        cwd=BASE_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    )


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


def main():
    # Verificar prerequisitos
    if not os.path.exists(PG_DATA):
        clear()
        print("\n  [ERROR] La base de datos no ha sido inicializada.")
        print("  Ejecute setup.bat primero.\n")
        input("  Presione Enter para salir...")
        return

    if not os.path.exists(PYTHON_EXE):
        clear()
        print("\n  [ERROR] Python no encontrado.\n")
        input("  Presione Enter para salir...")
        return

    # Configurar título de la ventana
    if os.name == 'nt':
        os.system('title Mi Inventario Facil')
        os.system('color 0F')

    try:
        # Paso 1: PostgreSQL
        banner("Iniciando base de datos...", 10)
        if not start_postgresql():
            banner("ERROR: PostgreSQL no pudo iniciar", 0)
            print("  Revise postgresql\\log.txt para más detalles.\n")
            input("  Presione Enter para salir...")
            return
        banner("Base de datos lista", 35)

        # Paso 2: Servidor web
        banner("Iniciando servidor web...", 45)
        start_uvicorn()

        # Paso 3: Esperar
        for i in range(30):
            progress = 50 + int(i * 1.5)
            banner(f"Cargando aplicacion... ({i+1}s)", min(progress, 95))
            try:
                import urllib.request
                urllib.request.urlopen(URL, timeout=1)
                break
            except Exception:
                time.sleep(1)
        else:
            banner("ERROR: El servidor no respondio", 0)
            print("  Intente ejecutar start.bat para ver el error detallado.\n")
            stop_all()
            input("  Presione Enter para salir...")
            return

        # Paso 4: Listo
        banner("Listo! Abriendo navegador...", 100)
        time.sleep(1)
        webbrowser.open(URL)

        # Paso 5: Panel de control
        clear()
        print()
        print("  ╔══════════════════════════════════════════════════╗")
        print("  ║                                                  ║")
        print("  ║   ✓  Mi Inventario Fácil está corriendo          ║")
        print("  ║                                                  ║")
        print(f"  ║   URL: {URL:<42} ║")
        print("  ║                                                  ║")
        print("  ║   Para acceder desde otro dispositivo:           ║")
        print("  ║   http://[IP-de-esta-PC]:8000                    ║")
        print("  ║                                                  ║")
        print("  ║   Credenciales:                                  ║")
        print("  ║     Usuario: admin                               ║")
        print("  ║     Clave:   admin123                            ║")
        print("  ║                                                  ║")
        print("  ╠══════════════════════════════════════════════════╣")
        print("  ║   Presione Enter para DETENER el servidor        ║")
        print("  ╚══════════════════════════════════════════════════╝")
        print()

        input()

    except KeyboardInterrupt:
        pass
    finally:
        banner("Deteniendo servicios...", 50)
        stop_all()
        banner("Servidor detenido. Hasta luego!", 100)
        time.sleep(1)


if __name__ == "__main__":
    main()
