import os
from pathlib import Path
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend

# Configuración
BASE_DIR = Path(__file__).parent.parent.parent # Root del proyecto
LAUNCHER = BASE_DIR / "Launcher.pyw"
MIDDLEWARE = BASE_DIR / "ferreteria_refactor" / "backend_api" / "middleware" / "license_guard.py"
SCRIPTS_DIR = BASE_DIR / "ferreteria_refactor" / "scripts"

def generate_key_pair():
    print("[*] Generando nuevas llaves RSA-2048...")
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    )
    
    # Export Private
    priv_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    
    # Export Public
    pub_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode('utf-8')
    
    # Guardar en disco (aseguras que esten en .gitignore!)
    with open(SCRIPTS_DIR / "private_key.pem", "wb") as f:
        f.write(priv_pem)
    with open(SCRIPTS_DIR / "public_key.pem", "w") as f:
        f.write(pub_pem)
        
    print("[OK] Llaves generadas en scripts/")
    return pub_pem

def update_file(path, public_key_pem):
    print(f"[*] Actualizando {path.name}...")
    if not path.exists():
        print(f"[ERROR] No existe {path}")
        return

    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Buscar bloque actual de clave publica
    start_marker = 'PUBLIC_KEY = """-----BEGIN PUBLIC KEY-----'
    end_marker = '-----END PUBLIC KEY-----"""'
    
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker)
    
    if start_idx == -1 or end_idx == -1:
        print("[ERROR] No se encontro el bloque PUBLIC_KEY para reemplazar.")
        return
        
    # Construir nuevo bloque
    new_block = f'PUBLIC_KEY = """{public_key_pem.strip()}"""'
    
    # Reemplazar
    new_content = content[:start_idx] + new_block + content[end_idx + len(end_marker):]
    
    with open(path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print("[OK] Archivo actualizado.")

def main():
    print("=== ROTACION DE SEGURIDAD AUTOMATICA ===")
    
    # 1. Generar
    new_pub_key = generate_key_pair()
    
    # 2. Actualizar Launcher
    update_file(LAUNCHER, new_pub_key)
    
    # 3. Actualizar Middleware
    update_file(MIDDLEWARE, new_pub_key)
    
    # 4. Eliminar license.key antiguas si existen
    lic_file = BASE_DIR / "license.key"
    if lic_file.exists():
        os.remove(lic_file)
        print("[*] license.key antigua eliminada.")
        
    lic_refactor = BASE_DIR / "ferreteria_refactor" / "license.key"
    if lic_refactor.exists():
        os.remove(lic_refactor)
        print("[*] ferreteria_refactor/license.key eliminada.")

    print("\n[EXITO] Seguridad restaurada. Debes generar nuevas licencias para todos los clientes.")
    print("IMPORTANTE: Ejecuta 'git add .' y 'git commit' de inmediato.")

if __name__ == "__main__":
    main()
