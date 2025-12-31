#!/usr/bin/env python3
"""
License Generator - Admin Tool
Genera licencias JWT firmadas con RSA para el sistema de ferretería.

Uso:
    python license_generator.py --generate-keys
    python license_generator.py --create-demo "Nombre Cliente"
    python license_generator.py --create-full "Nombre Cliente" --hw-id 123456789012 --days 365
"""

import argparse
import os
from datetime import datetime, timedelta
from pathlib import Path
from jose import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend
import uuid


# Rutas de archivos
SCRIPT_DIR = Path(__file__).parent
PRIVATE_KEY_PATH = SCRIPT_DIR / "private_key.pem"
PUBLIC_KEY_PATH = SCRIPT_DIR / "public_key.pem"


def generate_rsa_keys():
    """Genera un par de claves RSA (privada/pública) de 2048 bits."""
    print("[*] Generando par de claves RSA-2048...")
    
    # Generar clave privada
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    )
    
    # Serializar clave privada
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    
    # Serializar clave pública
    public_key = private_key.public_key()
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    
    # Guardar claves
    with open(PRIVATE_KEY_PATH, 'wb') as f:
        f.write(private_pem)
    
    with open(PUBLIC_KEY_PATH, 'wb') as f:
        f.write(public_pem)
    
    print(f"[OK] Clave privada guardada en: {PRIVATE_KEY_PATH}")
    print(f"[OK] Clave publica guardada en: {PUBLIC_KEY_PATH}")
    print("\n[!] IMPORTANTE: Nunca distribuyas la clave privada!")
    print("   La clave publica debe estar embebida en backend_api/config.py")


def load_private_key():
    """Carga la clave privada desde el archivo."""
    if not PRIVATE_KEY_PATH.exists():
        raise FileNotFoundError(
            f"[ERROR] No se encontro la clave privada en {PRIVATE_KEY_PATH}\n"
            "   Ejecuta: python license_generator.py --generate-keys"
        )
    
    with open(PRIVATE_KEY_PATH, 'rb') as f:
        return f.read().decode('utf-8')


def create_license(client_name: str, license_type: str, days: int, hw_id: str = None):
    """
    Crea un token JWT firmado con RSA.
    
    Args:
        client_name: Nombre del cliente
        license_type: "DEMO" o "FULL"
        days: Días de validez
        hw_id: ID de hardware (opcional, requerido para FULL)
    
    Returns:
        str: Token JWT firmado
    """
    private_key = load_private_key()
    
    # Calcular fecha de expiración
    now = datetime.utcnow()
    expiration = now + timedelta(days=days)
    
    # Construir payload
    payload = {
        "sub": client_name,
        "iat": int(now.timestamp()),
        "exp": int(expiration.timestamp()),
        "type": license_type
    }
    
    # Agregar hardware ID si se proporciona
    if hw_id:
        payload["hw_id"] = hw_id
    
    # Firmar token
    token = jwt.encode(payload, private_key, algorithm="RS256")
    
    return token


def get_machine_id():
    """Obtiene el ID de hardware de la máquina actual."""
    return str(uuid.getnode())


def main():
    parser = argparse.ArgumentParser(
        description="Generador de Licencias - Sistema de Ferretería",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos:
  # Generar claves RSA (solo la primera vez)
  python license_generator.py --generate-keys
  
  # Crear licencia DEMO de 1 día
  python license_generator.py --create-demo "Ferretería El Tornillo"
  
  # Crear licencia FULL de 30 días con hardware lock
  python license_generator.py --create-full "Ferretería Central" --hw-id 123456789012 --days 30
  
  # Crear licencia FULL de 1 año
  python license_generator.py --create-full "Distribuidora XYZ" --hw-id 987654321098 --days 365
  
  # Obtener ID de hardware de esta máquina
  python license_generator.py --get-machine-id
        """
    )
    
    parser.add_argument('--generate-keys', action='store_true',
                        help='Genera un nuevo par de claves RSA')
    parser.add_argument('--create-demo', metavar='CLIENT_NAME',
                        help='Crea una licencia DEMO de 1 día')
    parser.add_argument('--create-full', metavar='CLIENT_NAME',
                        help='Crea una licencia FULL')
    parser.add_argument('--hw-id', metavar='HARDWARE_ID',
                        help='ID de hardware del cliente (requerido para FULL)')
    parser.add_argument('--days', type=int, default=30,
                        help='Días de validez (default: 30)')
    parser.add_argument('--get-machine-id', action='store_true',
                        help='Muestra el ID de hardware de esta máquina')
    
    args = parser.parse_args()
    
    # Generar claves
    if args.generate_keys:
        if PRIVATE_KEY_PATH.exists() or PUBLIC_KEY_PATH.exists():
            response = input("[!] Ya existen claves. Sobrescribir? (s/N): ")
            if response.lower() != 's':
                print("[X] Operacion cancelada.")
                return
        generate_rsa_keys()
        return
    
    # Obtener machine ID
    if args.get_machine_id:
        machine_id = get_machine_id()
        print(f"[PC] ID de Hardware de esta maquina: {machine_id}")
        print("\n[i] El cliente debe proporcionarte este ID para generar su licencia FULL.")
        return
    
    # Crear licencia DEMO
    if args.create_demo:
        print(f"[+] Creando licencia DEMO para: {args.create_demo}")
        print(f"[T] Validez: 1 dia")
        
        token = create_license(
            client_name=args.create_demo,
            license_type="DEMO",
            days=1,
            hw_id=None  # DEMO no requiere hardware lock
        )
        
        print("\n[OK] Licencia generada exitosamente!")
        print("\n" + "="*80)
        print("LICENCIA DEMO (Valida por 1 dia)")
        print("="*80)
        print(token)
        print("="*80)
        print("\n[i] Copia este token y envialo al cliente.")
        print("   El cliente debe pegarlo en la ventana de activacion del Launcher.")
        return
    
    # Crear licencia FULL
    if args.create_full:
        if not args.hw_id:
            print("[ERROR] --hw-id es requerido para licencias FULL")
            print("   El cliente debe ejecutar el programa y proporcionarte su Machine ID.")
            return
        
        print(f"[+] Creando licencia FULL para: {args.create_full}")
        print(f"[PC] Hardware ID: {args.hw_id}")
        print(f"[T] Validez: {args.days} dias")
        
        token = create_license(
            client_name=args.create_full,
            license_type="FULL",
            days=args.days,
            hw_id=args.hw_id
        )
        
        print("\n[OK] Licencia generada exitosamente!")
        print("\n" + "="*80)
        print(f"LICENCIA FULL (Valida por {args.days} dias)")
        print("="*80)
        print(token)
        print("="*80)
        print("\n[i] Copia este token y envialo al cliente.")
        print("   El cliente debe pegarlo en la ventana de activacion del Launcher.")
        print(f"\n[!] Esta licencia SOLO funcionara en la maquina con ID: {args.hw_id}")
        return
    
    # Si no se proporcionó ninguna acción
    parser.print_help()


if __name__ == "__main__":
    main()
