#!/usr/bin/env python3
"""
Secure SECRET_KEY Generator
============================

This script generates a cryptographically secure random key suitable for use
as a SECRET_KEY in JWT token signing and other security-critical operations.

Usage:
    python generate_key.py

The generated key should be added to your .env file:
    SECRET_KEY=<generated-key-here>

IMPORTANT: 
- Never commit the .env file to version control
- Use different keys for development, staging, and production
- Rotate keys periodically for enhanced security
"""

import secrets

def generate_secret_key(length: int = 64) -> str:
    """
    Generate a cryptographically secure random key.
    
    Args:
        length: Number of bytes of randomness (default: 64)
                The resulting base64 string will be longer.
    
    Returns:
        A URL-safe base64-encoded random string
    """
    return secrets.token_urlsafe(length)


if __name__ == "__main__":
    print("=" * 70)
    print("🔐 SECURE SECRET_KEY GENERATOR")
    print("=" * 70)
    print()
    
    # Generate key
    secret_key = generate_secret_key(64)
    
    print("✅ Generated secure SECRET_KEY:")
    print()
    print(f"SECRET_KEY={secret_key}")
    print()
    print("=" * 70)
    print("📋 INSTRUCTIONS:")
    print("=" * 70)
    print()
    print("1. Copy the SECRET_KEY line above")
    print("2. Add it to your .env file in the backend_api directory")
    print("3. Restart your FastAPI server")
    print()
    print("⚠️  SECURITY WARNINGS:")
    print("   - Never commit this key to version control")
    print("   - Use different keys for dev/staging/production")
    print("   - Store production keys in secure secret management systems")
    print("   - Rotate keys periodically")
    print()
    print("=" * 70)
