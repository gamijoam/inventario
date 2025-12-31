#!/usr/bin/env python3
"""
Launcher - Sistema de Ferretería
Lanza la aplicación híbrida (React + FastAPI) con validación de licencia.
"""

import sys
import os
import subprocess
import webbrowser
import time
import tkinter as tk
from tkinter import messagebox, simpledialog
from pathlib import Path
from jose import jwt, JWTError
from datetime import datetime
import uuid


# Rutas
BASE_DIR = Path(__file__).parent
LICENSE_FILE = BASE_DIR / "license.key"
BACKEND_DIR = BASE_DIR / "backend_api"
LOG_FILE = BASE_DIR / "launcher.log"

# Redirigir stdout/stderr si no hay consola (para ejecución con doble click)
if sys.stdout is None:
    sys.stdout = open(LOG_FILE, "a")
if sys.stderr is None:
    sys.stderr = open(LOG_FILE, "a")

print(f"\\n--- Launcher iniciado: {datetime.now()} ---")
print(f"CWD: {os.getcwd()}")
print(f"Script: {__file__}")

# Asegurar CWD
os.chdir(BASE_DIR)
print(f"New CWD: {os.getcwd()}")

# Clave pública (debe coincidir con la del middleware)
PUBLIC_KEY = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0wnnOdeEW3b181oL2KC9
1lZFKhVOLPiohBL69d6qLSsYJNuv3SIVf6jD+khFZMgAXcIT87Bgov614SKk/IPN
Uip6zEUPWWsATQqIEsK0dchsgaHZYb0/fUOu7NK3Xi2PHvtUE66YgKYEbBbxVlXW
ocGWhyfgUBZWgboG8Ehhe0s/74SKSc+5n7DVKIHm6bwqRhzfANCdaD349sB9HS34
iPS2uot2kBNfNTCuLaxWMhDwvsyEVy75PqRiJj76cbD6PE1N/BRx4U2N8NIy4wyG
rRNtqsPUITYZVaFO/97jS4cLE0pbxxMENM3BzqAJiPL+59IPkyAk9JJDsMHbjXlj
TQIDAQAB
-----END PUBLIC KEY-----"""


def get_machine_id():
    """Obtiene el ID de hardware de la máquina."""
    return str(uuid.getnode())


def validate_license():
    """
    Valida la licencia JWT.
    
    Returns:
        tuple: (valid: bool, message: str, payload: dict or None)
    """
    # Verificar que existe el archivo
    if not LICENSE_FILE.exists():
        return False, "No se encontró archivo de licencia", None
    
    # Leer el token
    try:
        with open(LICENSE_FILE, 'r') as f:
            token = f.read().strip()
    except Exception as e:
        return False, f"Error al leer licencia: {str(e)}", None
    
    # Validar el token JWT
    try:
        payload = jwt.decode(token, PUBLIC_KEY, algorithms=["RS256"])
    except JWTError as e:
        return False, f"Licencia inválida: {str(e)}", None
    
    # Verificar expiración
    exp_timestamp = payload.get("exp")
    if exp_timestamp:
        exp_date = datetime.fromtimestamp(exp_timestamp)
        if datetime.utcnow() > exp_date:
            return False, f"Licencia expirada el {exp_date.strftime('%Y-%m-%d')}", None
    
    # Verificar hardware ID (solo para FULL)
    license_type = payload.get("type", "FULL")
    if license_type == "FULL":
        license_hw_id = payload.get("hw_id")
        current_hw_id = get_machine_id()
        
        if license_hw_id and license_hw_id != current_hw_id:
            return False, "Esta licencia no es válida para este equipo", None
    
    return True, "Licencia válida", payload


def save_license(license_key):
    """Guarda la licencia en el archivo."""
    try:
        with open(LICENSE_FILE, 'w') as f:
            f.write(license_key.strip())
        return True
    except Exception as e:
        messagebox.showerror("Error", f"No se pudo guardar la licencia:\n{str(e)}")
        return False


def show_license_dialog():
    """Muestra un diálogo para ingresar la licencia."""
    root = tk.Tk()
    root.withdraw()  # Ocultar ventana principal
    
    # Obtener machine ID
    machine_id = get_machine_id()
    
    # Crear ventana personalizada
    dialog = tk.Toplevel(root)
    dialog.title("Activación de Licencia")
    dialog.geometry("600x400")
    dialog.resizable(False, False)
    
    # Centrar ventana
    dialog.update_idletasks()
    x = (dialog.winfo_screenwidth() // 2) - (600 // 2)
    y = (dialog.winfo_screenheight() // 2) - (400 // 2)
    dialog.geometry(f"+{x}+{y}")
    
    # Frame principal
    main_frame = tk.Frame(dialog, padx=20, pady=20)
    main_frame.pack(fill=tk.BOTH, expand=True)
    
    # Título
    title_label = tk.Label(
        main_frame,
        text="🔐 Activación de Licencia",
        font=("Arial", 16, "bold")
    )
    title_label.pack(pady=(0, 10))
    
    # Información del Machine ID
    info_frame = tk.LabelFrame(main_frame, text="Información de este Equipo", padx=10, pady=10)
    info_frame.pack(fill=tk.X, pady=(0, 15))
    
    machine_id_label = tk.Label(
        info_frame,
        text=f"Machine ID: {machine_id}",
        font=("Courier", 10, "bold"),
        fg="blue"
    )
    machine_id_label.pack()
    
    hint_label = tk.Label(
        info_frame,
        text="Proporcione este ID al administrador para obtener su licencia FULL",
        font=("Arial", 8),
        fg="gray"
    )
    hint_label.pack()
    
    # Instrucciones
    instructions = tk.Label(
        main_frame,
        text="Pegue su clave de licencia a continuación:",
        font=("Arial", 10)
    )
    instructions.pack(pady=(0, 5))
    
    # Campo de texto para la licencia
    license_text = tk.Text(main_frame, height=8, width=70, wrap=tk.WORD)
    license_text.pack(pady=(0, 15))
    license_text.focus()
    
    # Variable para almacenar el resultado
    result = {"activated": False}
    
    def activate():
        license_key = license_text.get("1.0", tk.END).strip()
        
        if not license_key:
            messagebox.showwarning("Advertencia", "Por favor, ingrese una clave de licencia")
            return
        
        # Validar el token antes de guardar
        try:
            payload = jwt.decode(license_key, PUBLIC_KEY, algorithms=["RS256"])
            
            # Verificar expiración
            exp_timestamp = payload.get("exp")
            if exp_timestamp:
                exp_date = datetime.fromtimestamp(exp_timestamp)
                if datetime.utcnow() > exp_date:
                    messagebox.showerror(
                        "Licencia Expirada",
                        f"Esta licencia expiró el {exp_date.strftime('%Y-%m-%d %H:%M:%S')}"
                    )
                    return
            
            # Verificar hardware ID (solo para FULL)
            license_type = payload.get("type", "FULL")
            if license_type == "FULL":
                license_hw_id = payload.get("hw_id")
                current_hw_id = get_machine_id()
                
                if license_hw_id and license_hw_id != current_hw_id:
                    messagebox.showerror(
                        "Hardware No Compatible",
                        f"Esta licencia es para otro equipo.\n\n"
                        f"Licencia para: {license_hw_id}\n"
                        f"Este equipo: {current_hw_id}\n\n"
                        f"Solicite una licencia con el Machine ID correcto."
                    )
                    return
            
            # Guardar licencia
            if save_license(license_key):
                client_name = payload.get("sub", "Cliente")
                days_remaining = None
                
                if exp_timestamp:
                    time_remaining = exp_date - datetime.utcnow()
                    days_remaining = max(0, time_remaining.days)
                
                messagebox.showinfo(
                    "¡Licencia Activada!",
                    f"Licencia activada exitosamente.\n\n"
                    f"Cliente: {client_name}\n"
                    f"Tipo: {license_type}\n"
                    f"Días restantes: {days_remaining if days_remaining is not None else 'N/A'}"
                )
                result["activated"] = True
                dialog.destroy()
        
        except JWTError as e:
            messagebox.showerror("Licencia Inválida", f"La licencia no es válida:\n{str(e)}")
        except Exception as e:
            messagebox.showerror("Error", f"Error al activar licencia:\n{str(e)}")
    
    def cancel():
        dialog.destroy()
    
    # Botones
    button_frame = tk.Frame(main_frame)
    button_frame.pack()
    
    activate_btn = tk.Button(
        button_frame,
        text="✓ Activar Licencia",
        command=activate,
        bg="#4CAF50",
        fg="white",
        font=("Arial", 10, "bold"),
        padx=20,
        pady=10
    )
    activate_btn.pack(side=tk.LEFT, padx=5)
    
    cancel_btn = tk.Button(
        button_frame,
        text="✗ Cancelar",
        command=cancel,
        bg="#f44336",
        fg="white",
        font=("Arial", 10, "bold"),
        padx=20,
        pady=10
    )
    cancel_btn.pack(side=tk.LEFT, padx=5)
    
    # Hacer modal
    dialog.transient(root)
    dialog.grab_set()
    root.wait_window(dialog)
    
    return result["activated"]


def start_backend():
    """Inicia el servidor FastAPI."""
    print("🚀 Iniciando servidor backend...")
    
    # Cambiar al directorio del backend
    os.chdir(BACKEND_DIR.parent)
    
    # Iniciar uvicorn
    backend_process = subprocess.Popen(
        [
            sys.executable, "-m", "uvicorn",
            "ferreteria_refactor.backend_api.main:app",
            "--host", "127.0.0.1",
            "--port", "8000",
            "--reload"
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        universal_newlines=True
    )
    
    return backend_process


def start_frontend():
    """Inicia el servidor de desarrollo de React."""
    print("🎨 Iniciando frontend...")
    
    frontend_dir = BASE_DIR / "frontend_web"
    
    # Iniciar npm run dev
    frontend_process = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=frontend_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        universal_newlines=True,
        shell=True
    )
    
    return frontend_process


def main():
    """Función principal del launcher."""
    print("="*60)
    print("  Sistema de Ferretería - Launcher")
    print("="*60)
    
    # Validar licencia
    valid, message, payload = validate_license()
    
    if not valid:
        print(f"\n❌ {message}")
        print(f"🖥️  Machine ID: {get_machine_id()}\n")
        
        # Mostrar diálogo de activación
        root = tk.Tk()
        root.withdraw()
        
        response = messagebox.askyesno(
            "Licencia Requerida",
            f"{message}\n\n"
            f"¿Desea activar una licencia ahora?"
        )
        
        if response:
            activated = show_license_dialog()
            if not activated:
                messagebox.showinfo("Cancelado", "No se puede iniciar sin una licencia válida.")
                sys.exit(1)
            
            # Revalidar
            valid, message, payload = validate_license()
            if not valid:
                messagebox.showerror("Error", f"La licencia sigue siendo inválida:\n{message}")
                sys.exit(1)
        else:
            sys.exit(1)
    
    # Mostrar información de la licencia
    print(f"\n✅ Licencia válida")
    print(f"   Cliente: {payload.get('sub')}")
    print(f"   Tipo: {payload.get('type')}")
    
    exp_timestamp = payload.get("exp")
    if exp_timestamp:
        exp_date = datetime.fromtimestamp(exp_timestamp)
        time_remaining = exp_date - datetime.utcnow()
        days_remaining = max(0, time_remaining.days)
        print(f"   Expira: {exp_date.strftime('%Y-%m-%d')} ({days_remaining} días restantes)")
    
    print("\n" + "="*60)
    
    # Iniciar servicios
    backend_process = start_backend()
    
    # Esperar a que el backend esté listo
    print("⏳ Esperando a que el backend esté listo...")
    time.sleep(5)
    
    frontend_process = start_frontend()
    
    # Esperar a que el frontend esté listo
    print("⏳ Esperando a que el frontend esté listo...")
    time.sleep(8)
    
    # Abrir navegador
    print("🌐 Abriendo navegador...")
    webbrowser.open("http://localhost:5173")
    
    print("\n✅ Aplicación iniciada correctamente!")
    print("   Backend: http://127.0.0.1:8000")
    print("   Frontend: http://localhost:5173")
    print("   Documentación API: http://127.0.0.1:8000/docs")
    print("\n⚠️  Presione Ctrl+C para detener la aplicación\n")
    
    try:
        # Mantener el launcher corriendo
        backend_process.wait()
    except KeyboardInterrupt:
        print("\n\n🛑 Deteniendo aplicación...")
        backend_process.terminate()
        frontend_process.terminate()
        print("✅ Aplicación detenida.")


if __name__ == "__main__":
    main()
