#!/usr/bin/env python3
"""Debug Alembic encoding error"""
import traceback
import sys

sys.path.insert(0, '.')

try:
    from alembic.config import Config
    from alembic import command
    
    cfg = Config('alembic.ini')
    command.upgrade(cfg, 'head')
except Exception as e:
    print("=" * 70)
    print("FULL TRACEBACK:")
    print("=" * 70)
    traceback.print_exc()
    print("\n" + "=" * 70)
    print(f"Error type: {type(e).__name__}")
    print(f"Error message: {e}")
    
    if hasattr(e, 'object') and hasattr(e, 'start'):
        print(f"\nProblematic byte at position {e.start}: {hex(e.object[e.start])}")
        print(f"Context (bytes {max(0, e.start-20)}:{e.start+20}):")
        print(e.object[max(0, e.start-20):e.start+20])
