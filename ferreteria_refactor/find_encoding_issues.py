#!/usr/bin/env python3
"""
Find files with encoding issues in Alembic migrations
"""
import os
import glob

versions_dir = r'alembic\versions'
files = glob.glob(os.path.join(versions_dir, '*.py'))

print(f"Checking {len(files)} migration files...")
print("=" * 70)

problematic_files = []

for filepath in files:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        print(f"✅ OK: {os.path.basename(filepath)}")
    except UnicodeDecodeError as e:
        print(f"❌ ERROR: {os.path.basename(filepath)}")
        print(f"   Position: {e.start}, Byte: {hex(e.object[e.start])}")
        problematic_files.append(filepath)
        
        # Try to read with latin-1 to see the content
        try:
            with open(filepath, 'r', encoding='latin-1') as f:
                content = f.read()
                # Show context around the error
                lines = content.split('\n')
                for i, line in enumerate(lines[:10], 1):
                    if 'ó' in line or 'á' in line or 'é' in line or 'í' in line or 'ú' in line:
                        print(f"   Line {i}: {line[:80]}")
        except:
            pass

print("\n" + "=" * 70)
print(f"\nProblematic files found: {len(problematic_files)}")
for f in problematic_files:
    print(f"  - {f}")
