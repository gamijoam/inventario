#!/usr/bin/env python3
import subprocess
result = subprocess.run(['docker', 'run', '--rm', 'gamijoam/ferreteria-admin-panel:qa-v2026-v101', 'sh', '-c', 'grep -o "localhost:8000" /usr/share/nginx/html/assets/index-BSn9jEPn.js 2>/dev/null'], capture_output=True, text=True)
print("localhost references:", result.stdout.strip())
print("stderr:", result.stderr.strip()[:100] if result.stderr else "none")