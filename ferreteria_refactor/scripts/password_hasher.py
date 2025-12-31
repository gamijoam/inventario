#!/usr/bin/env python3
"""
Script para generar hashes de contraseñas para usuarios del sistema.
Uso: python password_hasher.py
"""

from passlib.context import CryptContext
import getpass
import sys

# Configuración del contexto de hashing (mismo que usa el backend)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    """Genera un hash bcrypt de la contraseña."""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica si una contraseña coincide con el hash."""
    return pwd_context.verify(plain_password, hashed_password)

def main():
    print("=" * 60)
    print("  GENERADOR DE CONTRASEÑAS HASHEADAS")
    print("=" * 60)
    print()
    
    # Opción 1: Generar hash
    print("Opciones:")
    print("1. Generar hash de contraseña")
    print("2. Verificar contraseña contra hash")
    print()
    
    choice = input("Selecciona opción (1 o 2): ").strip()
    
    if choice == "1":
        # Generar hash
        print("\n[+] Ingresa la contraseña que deseas hashear:")
        password = getpass.getpass("Contraseña: ")
        
        if not password:
            print("❌ Error: La contraseña no puede estar vacía")
            sys.exit(1)
        
        # Confirmar contraseña
        password_confirm = getpass.getpass("Confirmar contraseña: ")
        
        if password != password_confirm:
            print("❌ Error: Las contraseñas no coinciden")
            sys.exit(1)
        
        # Generar hash
        hashed = hash_password(password)
        
        print("\n" + "=" * 60)
        print("✅ HASH GENERADO EXITOSAMENTE")
        print("=" * 60)
        print()
        print("Hash de la contraseña:")
        print(hashed)
        print()
        print("=" * 60)
        print()
        print("[i] Copia este hash y úsalo en la base de datos")
        print("    para el campo 'hashed_password' del usuario.")
        print()
        
    elif choice == "2":
        # Verificar hash
        print("\n[+] Ingresa la contraseña en texto plano:")
        password = getpass.getpass("Contraseña: ")
        
        print("\n[+] Ingresa el hash a verificar:")
        hashed = input("Hash: ").strip()
        
        if verify_password(password, hashed):
            print("\n✅ La contraseña coincide con el hash")
        else:
            print("\n❌ La contraseña NO coincide con el hash")
    
    else:
        print("❌ Opción inválida")
        sys.exit(1)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n[!] Operación cancelada por el usuario")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)
