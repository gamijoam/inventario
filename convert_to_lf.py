"""Convertir docker-entrypoint.sh a formato Unix (LF)"""
with open('docker-entrypoint.sh', 'rb') as f:
    content = f.read()

# Convertir CRLF a LF
content = content.replace(b'\r\n', b'\n')

with open('docker-entrypoint.sh', 'wb') as f:
    f.write(content)

print("✅ Archivo convertido a formato Unix (LF)")
