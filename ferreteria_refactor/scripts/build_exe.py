import PyInstaller.__main__
import os
import shutil

# PATHS
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # ferreteria_refactor
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend_caja")
MAIN_SCRIPT = os.path.join(FRONTEND_DIR, "src", "main.py")
LAUNCHER_SCRIPT = os.path.join(PROJECT_ROOT, "Launcher.pyw")
DIST_DIR = os.path.join(PROJECT_ROOT, "dist")
BUILD_DIR = os.path.join(PROJECT_ROOT, "build")

def clean():
    if os.path.exists(DIST_DIR):
        shutil.rmtree(DIST_DIR)
    if os.path.exists(BUILD_DIR):
        shutil.rmtree(BUILD_DIR)

def build_frontend():
    print("Building Frontend (Ferreteria.exe)...")
    PyInstaller.__main__.run([
        MAIN_SCRIPT,
        '--name=Ferreteria',
        '--windowed',
        '--onedir', # Directory based for speed and updateability
        '--clean',
        '--distpath', DIST_DIR,
        '--specpath', BUILD_DIR,
        '--workpath', BUILD_DIR,
        # Paths: 
        # 1. PROJECT_ROOT needed for 'from frontend_caja...' imports
        # 2. FRONTEND_DIR needed for 'import src' (if relative to frontend_caja)
        f'--paths={PROJECT_ROOT}',
        f'--paths={FRONTEND_DIR}',
        # Hidden imports often needed for ORMs or specialized libs
        '--hidden-import=sqlalchemy.sql.default_comparator',
        '--hidden-import=pydantic',
        '--hidden-import=pandas',
        '--hidden-import=openpyxl',
        '--collect-all=reportlab',
        '--additional-hooks-dir=.', 
        # Add data if needed (e.g., config templates, although config is dynamic)
    ])
    
    # Copy essential files to dist/Ferreteria override if needed
    # (e.g. .env.example, or ensuring src structure if dynamic imports rely on it - 
    # but PyInstaller usually handles imports well).
    
    # If the app uses relative paths for resources (e.g. images), we might need to copy them.
    # Logic in code uses ConfigController for paths, usually absolute or relative to cwd.
    # compiled app cwd is the dir with exe.
    pass

def build_backend():
    print("Building Backend (Server.exe)...")
    # Backend entry point is backend_api/main.py but uvicorn runs it.
    # We need a wrapper script to run uvicorn programmatically for PyInstaller.
    
    # Create temporary entry point for backend
    backend_entry = os.path.join(PROJECT_ROOT, "run_server.py")
    with open(backend_entry, "w") as f:
        f.write("import uvicorn\n")
        f.write("import sys\n")
        f.write("import traceback\n")
        f.write("try:\n")
        f.write("    from backend_api.main import app\n")
        f.write("    if __name__ == '__main__':\n")
        f.write("        print('Starting Server on port 8000...')\n")
        f.write("        uvicorn.run(app, host='0.0.0.0', port=8000)\n")
        f.write("except Exception as e:\n")
        f.write("    print('CRITICAL SERVER ERROR:')\n")
        f.write("    traceback.print_exc()\n")
        f.write("    input('Press Enter to exit...')\n")
        
    PyInstaller.__main__.run([
        backend_entry,
        '--name=Server',
        '--console', # Server usually has console, or windowed if preferred hidden
        '--onedir', 
        '--clean',
        '--distpath', DIST_DIR,
        '--specpath', BUILD_DIR,
        '--workpath', BUILD_DIR,
        # Backend hidden imports
        '--hidden-import=uvicorn.logging',
        '--hidden-import=uvicorn.loops',
        '--hidden-import=uvicorn.loops.auto',
        '--hidden-import=uvicorn.protocols',
        '--hidden-import=uvicorn.protocols.http',
        '--hidden-import=uvicorn.protocols.http.auto',
        '--hidden-import=uvicorn.lifespan',
        '--hidden-import=uvicorn.lifespan.on',
        '--hidden-import=email_validator',
        '--hidden-import=jose',
        '--hidden-import=sqlalchemy.sql.default_comparator',
        '--hidden-import=passlib.handlers.bcrypt',
    ])
    
    # Cleanup temp file
    if os.path.exists(backend_entry):
        os.remove(backend_entry)

def build_launcher():
    print("Building Launcher (Launcher.exe)...")
    PyInstaller.__main__.run([
        LAUNCHER_SCRIPT,
        '--name=Launcher',
        '--windowed',
        '--onefile', # Single file for the launcher is cleaner
        '--clean',
        '--distpath', DIST_DIR,
        '--specpath', BUILD_DIR,
        '--workpath', BUILD_DIR,
    ])

if __name__ == "__main__":
    clean()
    build_frontend()
    build_backend()
    build_launcher()
    print("Compilation Complete. Check 'ferreteria_refactor/dist'")
