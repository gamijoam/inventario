#!/usr/bin/env python3
"""
Setup Script - Configuración Inicial del Sistema de Licencias
Genera las claves RSA y actualiza la clave pública en los archivos necesarios.

IMPORTANTE: Ejecutar SOLO UNA VEZ durante la configuración inicial.
"""

import subprocess
import sys
from pathlib import Path


def main():
    print("="*70)
    print("  Configuracion Inicial del Sistema de Licencias")
    print("="*70)
    print()
    
    # Paso 1: Generar claves RSA
    print("[*] Paso 1: Generando claves RSA...")
    print("   Ejecutando: python scripts/license_generator.py --generate-keys")
    print()
    
    result = subprocess.run(
        [sys.executable, "scripts/license_generator.py", "--generate-keys"],
        capture_output=True,
        text=True
    )
    
    print(result.stdout)
    if result.returncode != 0:
        print("[ERROR] Error al generar claves:")
        print(result.stderr)
        sys.exit(1)
    
    # Paso 2: Leer la clave pública
    print("\n[*] Paso 2: Leyendo clave publica...")
    public_key_path = Path("scripts/public_key.pem")
    
    if not public_key_path.exists():
        print(f"[ERROR] No se encontro {public_key_path}")
        sys.exit(1)
    
    with open(public_key_path, 'r') as f:
        public_key = f.read()
    
    print("[OK] Clave publica leida correctamente")
    
    # Paso 3: Actualizar archivos
    print("\n[*] Paso 3: Actualizando archivos con la clave publica...")
    
    files_to_update = [
        "backend_api/middleware/license_guard.py",
        "Launcher.pyw"
    ]
    
    for file_path in files_to_update:
        path = Path(file_path)
        if not path.exists():
            print(f"[!] Archivo no encontrado: {file_path}")
            continue
        
        # Leer contenido
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Reemplazar placeholder
        if "PLACEHOLDER_PUBLIC_KEY" in content:
            # Extraer solo el contenido de la clave (sin BEGIN/END)
            key_lines = public_key.strip().split('\n')
            key_content = '\n'.join(key_lines[1:-1])  # Excluir primera y última línea
            
            # Reconstruir con formato correcto
            formatted_key = f'"""-----BEGIN PUBLIC KEY-----\n{key_content}\n-----END PUBLIC KEY-----"""'
            
            content = content.replace(
                '"""-----BEGIN PUBLIC KEY-----\nPLACEHOLDER_PUBLIC_KEY\n-----END PUBLIC KEY-----"""',
                formatted_key
            )
            
            # Guardar
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f"   [OK] Actualizado: {file_path}")
        else:
            print(f"   [!] No se encontro placeholder en: {file_path}")
    
    # Resumen final
    print("\n" + "="*70)
    print("[OK] Configuracion completada exitosamente!")
    print("="*70)
    print()
    print("[i] Proximos pasos:")
    print()
    print("1. IMPORTANTE: Respalda tu clave privada (scripts/private_key.pem)")
    print("   Esta clave es CRITICA y NO debe perderse ni compartirse.")
    print()
    print("2. Para generar una licencia DEMO:")
    print("   python scripts/license_generator.py --create-demo \"Nombre Cliente\"")
    print()
    print("3. Para generar una licencia FULL:")
    print("   a) El cliente debe ejecutar el Launcher y obtener su Machine ID")
    print("   b) python scripts/license_generator.py --create-full \"Nombre Cliente\" --hw-id MACHINE_ID --days 365")
    print()
    print("4. El cliente debe pegar la licencia en la ventana de activacion del Launcher")
    print()
    print("="*70)


if __name__ == "__main__":
    main()
