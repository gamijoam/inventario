#!/usr/bin/env python3
"""Find Latin-1 encoded text in model files"""

files = [
    'backend_api/models/models.py',
    'backend_api/models/restaurant.py',
    'backend_api/models/prueba.py',
    'backend_api/models/prueba_vps.py',
    'backend_api/models/notas.py',
    'backend_api/models/tenant.py'
]

print("Searching for Latin-1 encoded characters (0xf3 = ó)...")
print("=" * 70)

for filepath in files:
    try:
        with open(filepath, 'rb') as f:
            lines = f.readlines()
        
        found_issues = False
        for i, line in enumerate(lines, 1):
            if b'\xf3' in line:
                if not found_issues:
                    print(f"\n❌ FOUND IN: {filepath}")
                    found_issues = True
                
                decoded = line.decode('latin-1', errors='replace').strip()
                print(f"   Line {i}: {decoded[:100]}")
    except Exception as e:
        print(f"⚠️  Error reading {filepath}: {e}")

print("\n" + "=" * 70)
print("Search complete!")
