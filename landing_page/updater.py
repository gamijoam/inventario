"""
Standalone Updater Script
This script is downloaded and executed by the Launcher to perform updates
without file locking issues.
"""
import sys
import os
import json
import zipfile
import urllib.request
import time
import subprocess
import shutil

def main():
    # Get BASE_DIR from command line argument
    if len(sys.argv) < 2:
        print("Usage: updater.py <base_dir>")
        sys.exit(1)
    
    BASE_DIR = sys.argv[1]
    UPDATE_URL_JSON = "https://inventariosoft.netlify.app/version.json"
    LOCAL_VERSION_FILE = os.path.join(BASE_DIR, "version.json")
    
    print("=" * 50)
    print("INVENTARIOSOFT - Actualizador Externo")
    print("=" * 50)
    
    try:
        # 1. Check Remote Version
        print("\n[1/5] Verificando versión remota...")
        with urllib.request.urlopen(UPDATE_URL_JSON) as url:
            data = json.loads(url.read().decode())
            remote_version = data.get("version")
            download_url = data.get("download_url")
            
            # Handle both absolute and relative URLs
            if not download_url.startswith('http'):
                base_url = UPDATE_URL_JSON.rsplit('/', 1)[0]
                download_url = f"{base_url}/{download_url}"
        
        print(f"   Versión disponible: {remote_version}")
        
        # 2. Download ZIP with retry logic
        print(f"\n[2/5] Descargando actualización...")
        zip_path = os.path.join(BASE_DIR, "update_temp.zip")
        
        def download_with_retry(url, dest, max_retries=3):
            """Download file with retry logic and chunked reading"""
            for attempt in range(max_retries):
                try:
                    print(f"   Intento {attempt + 1}/{max_retries}...")
                    
                    # Open connection
                    req = urllib.request.Request(url)
                    response = urllib.request.urlopen(req, timeout=30)
                    total_size = int(response.headers.get('Content-Length', 0))
                    
                    print(f"   Tamaño total: {total_size / (1024*1024):.1f} MB")
                    
                    # Download in chunks
                    chunk_size = 8192  # 8KB chunks
                    downloaded = 0
                    last_percent = 0
                    
                    with open(dest, 'wb') as f:
                        while True:
                            chunk = response.read(chunk_size)
                            if not chunk:
                                break
                            
                            f.write(chunk)
                            downloaded += len(chunk)
                            
                            # Show progress every 5%
                            if total_size > 0:
                                percent = int(downloaded * 100 / total_size)
                                if percent >= last_percent + 5:
                                    print(f"   Progreso: {percent}% ({downloaded / (1024*1024):.1f} MB)")
                                    last_percent = percent
                    
                    # VALIDATE: Check if download is complete
                    if total_size > 0 and downloaded < total_size:
                        raise Exception(f"Descarga incompleta: {downloaded}/{total_size} bytes")
                    
                    print("   ✓ Descarga completa")
                    return True
                    
                except Exception as e:
                    print(f"   ✗ Error en intento {attempt + 1}: {e}")
                    if attempt < max_retries - 1:
                        print(f"   Reintentando en 3 segundos...")
                        time.sleep(3)
                    else:
                        raise Exception(f"Descarga falló después de {max_retries} intentos: {e}")
            
            return False
        
        download_with_retry(download_url, zip_path)
        
        # 3. Wait for processes to close
        print(f"\n[3/5] Esperando cierre de procesos...")
        time.sleep(3)  # Give time for Launcher to fully exit
        
        # 4. Extract with forced overwrite
        print(f"\n[4/5] Instalando actualización...")
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            file_list = zip_ref.namelist()
            total = len(file_list)
            
            for idx, file_info in enumerate(file_list):
                if idx % 100 == 0:  # Progress every 100 files
                    print(f"   Extrayendo: {idx}/{total} archivos...")
                
                # Force delete existing file
                target_path = os.path.join(BASE_DIR, file_info)
                if os.path.exists(target_path) and not os.path.isdir(target_path):
                    try:
                        os.remove(target_path)
                    except Exception as e:
                        print(f"   Warning: No se pudo borrar {file_info}: {e}")
                
                # Extract
                try:
                    zip_ref.extract(file_info, BASE_DIR)
                except Exception as e:
                    print(f"   Error extrayendo {file_info}: {e}")
        
        print("   ✓ Extracción completa")
        
        # 5. Cleanup
        print(f"\n[5/5] Limpiando archivos temporales...")
        try:
            os.remove(zip_path)
        except:
            pass
        
        # Update version file
        with open(LOCAL_VERSION_FILE, 'w') as f:
            json.dump({"version": remote_version}, f)
        
        print(f"\n{'=' * 50}")
        print(f"✓ ACTUALIZACIÓN COMPLETADA A v{remote_version}")
        print(f"{'=' * 50}")
        
        # Relaunch application
        print("\nReiniciando aplicación en 2 segundos...")
        time.sleep(2)
        
        launcher_path = os.path.join(BASE_DIR, "Launcher.exe")
        if os.path.exists(launcher_path):
            subprocess.Popen([launcher_path], cwd=BASE_DIR)
        
    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        print("\nPresiona Enter para cerrar...")
        input()
        sys.exit(1)

if __name__ == "__main__":
    main()
