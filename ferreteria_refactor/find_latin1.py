#!/usr/bin/env python3
"""Find files containing Latin-1 encoded text"""
import os
import glob

files = glob.glob(r'alembic\versions\*.py')

print(f"Searching {len(files)} files for Latin-1 byte 0xf3 (ó)...")
print("=" * 70)

for filepath in files:
    with open(filepath, 'rb') as f:
        content = f.read()
    
    if b'\xf3' in content:
        print(f"\n❌ FOUND: {os.path.basename(filepath)}")
        
        # Find all occurrences
        pos = 0
        while True:
            pos = content.find(b'\xf3', pos)
            if pos == -1:
                break
            
            # Show context
            start = max(0, pos - 30)
            end = min(len(content), pos + 30)
            context = content[start:end]
            
            print(f"   Position {pos}: {context.decode('latin-1', errors='replace')}")
            pos += 1

print("\n" + "=" * 70)
print("Search complete!")
