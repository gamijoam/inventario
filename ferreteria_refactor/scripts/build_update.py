import os
import shutil
import json
import zipfile
import re
import sys

# CONFIGURATION
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # ferreteria_refactor
REPO_ROOT = os.path.dirname(PROJECT_ROOT) # ferreteria
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend_caja")
LANDING_PAGE_DIR = os.path.join(REPO_ROOT, "landing_page")
DOWNLOADS_DIR = os.path.join(LANDING_PAGE_DIR, "downloads")
VERSION_FILE = os.path.join(LANDING_PAGE_DIR, "version.json")
ZIP_NAME = "update_ferreteria.zip"

# --- BUILD OPTIONS ---
# Set these to True/False to control what gets re-compiled
BUILD_CLIENT = True    # Re-compile Ferreteria.exe
BUILD_SERVER = False    # Re-compile Server.exe (Set to True if you changed Backend)
BUILD_LAUNCHER = False  # Re-compile Launcher.exe

# Set this to False if old clients are crashing during update.
# This keeps the old Launcher but updates the App.
INCLUDE_LAUNCHER_IN_ZIP = True
# ---------------------

EXCLUDES = [
    r"__pycache__",
    r"\.git",
    r"\.venv",
    r"env",
    r"venv",
    r"\.env", # Do not include local config
    r"ferreteria\.db", # Do not include local DB
    r"\.vscode",
    r"\.idea",
    r"tests",
    r"wip",
    r"brain",
    r"artifacts"
]

def increment_version(version_str):
    major, minor, patch = map(int, version_str.split('.'))
    return f"{major}.{minor}.{patch + 1}"

def is_excluded(path):
    for pattern in EXCLUDES:
        if re.search(pattern, path):
            return True
    return False

def zip_folder(folder_path, output_path):
    print(f"Zipping {folder_path} to {output_path}...")
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(folder_path):
            # Filtering exclusions
            dirs[:] = [d for d in dirs if not is_excluded(os.path.join(root, d))]
            
            for file in files:
                file_path = os.path.join(root, file)
                if is_excluded(file_path):
                    continue
                
                # Rel path inside zip
                rel_path = os.path.relpath(file_path, folder_path)
                zipf.write(file_path, rel_path)

def main():
    if not os.path.exists(LANDING_PAGE_DIR):
        print(f"Error: Landing page dir not found at {LANDING_PAGE_DIR}")
        return

    # 0. Compile Logic
    print("--- Checking Build Configuration ---")
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    import build_exe
    
    # We must ensure directories exist (build_exe.clean might remove them if called unconditionally)
    # So we only call clean if we are building something?
    # Better: Let's assume user manages clean or we modify build_exe later.
    # For now, just call the functions.
    
    if BUILD_CLIENT:
        build_exe.build_frontend()
    else:
        print("[SKIP] Client Build (Ferreteria.exe)")
        
    if BUILD_SERVER:
        build_exe.build_backend()
    else:
        print("[SKIP] Server Build (Server.exe)")

    if BUILD_LAUNCHER:
        build_exe.build_launcher()
    else:
        print("[SKIP] Launcher Build (Launcher.exe)")
        

    COMPILED_DIR = os.path.join(PROJECT_ROOT, "dist", "Ferreteria")
    
    # Validation
    if BUILD_CLIENT and not os.path.exists(COMPILED_DIR):
        print("Error: Client build failed or not found.")
        return

    # 1. Read Version
    with open(VERSION_FILE, 'r') as f:
        data = json.load(f)
    
    current_version = data.get("version", "1.0.0")
    new_version = increment_version(current_version)
    print(f"Upgrading from {current_version} to {new_version}")
    
    # 2. Update Version in memory
    data["version"] = new_version
    data["release_notes"] = f"Update to {new_version}"
    
    # 2b. Save Version JSON (So we can zip the updated file)
    with open(VERSION_FILE, 'w') as f:
        json.dump(data, f, indent=4)
    
    # 3. Create Zip from COMPILED_DIR
    if not os.path.exists(DOWNLOADS_DIR):
        os.makedirs(DOWNLOADS_DIR)
        
    zip_path = os.path.join(DOWNLOADS_DIR, ZIP_NAME)
    
    print(f"Creating Unified Update Zip at {zip_path}...")
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # Add Frontend (Client)
        client_src = os.path.join(PROJECT_ROOT, "dist", "Ferreteria")
        if os.path.exists(client_src):
            print("Adding Client...")
            for root, dirs, files in os.walk(client_src):
                for file in files:
                    file_path = os.path.join(root, file)
                    rel_path = os.path.relpath(file_path, client_src)
                    # Put inside 'Client' folder in zip
                    zipf.write(file_path, os.path.join("Client", rel_path))
        else:
            print("Warning: Client build not found!")

        # Add Backend (Server)
        server_src = os.path.join(PROJECT_ROOT, "dist", "Server")
        if os.path.exists(server_src):
            print("Adding Server...")
            for root, dirs, files in os.walk(server_src):
                for file in files:
                    file_path = os.path.join(root, file)
                    rel_path = os.path.relpath(file_path, server_src)
                    # Put inside 'Server' folder in zip
                    zipf.write(file_path, os.path.join("Server", rel_path))
        else:
            print("Warning: Server build not found!")
            
        # Add Launcher.exe
        if INCLUDE_LAUNCHER_IN_ZIP:
            launcher_exe = os.path.join(PROJECT_ROOT, "dist", "Launcher.exe")
            if os.path.exists(launcher_exe):
                print("Adding Launcher.exe...")
                zipf.write(launcher_exe, "Launcher.exe")
            else:
                print("Warning: Launcher.exe not found in dist!")
        else:
            print("[SKIP] Launcher.exe exclusion (Safe Update Mode)")
            
        # Add Web Dashboard (Source)
        web_dashboard_src = os.path.join(PROJECT_ROOT, "web_dashboard")
        if os.path.exists(web_dashboard_src):
            print("Adding Web Dashboard sources...")
            for root, dirs, files in os.walk(web_dashboard_src):
                # Filter exclusions
                dirs[:] = [d for d in dirs if not is_excluded(os.path.join(root, d))]
                for file in files:
                    file_path = os.path.join(root, file)
                    if is_excluded(file_path): 
                        continue
                    
                    rel_path = os.path.relpath(file_path, PROJECT_ROOT) # e.g. web_dashboard/app.py
                    zipf.write(file_path, rel_path)
        else:
            print("Warning: web_dashboard folder not found!")
            
        # Add updater.py (Standalone updater script)
        updater_src = os.path.join(PROJECT_ROOT, "updater.py")
        if os.path.exists(updater_src):
            print("Adding updater.py...")
            zipf.write(updater_src, "updater.py")
            
            # Also copy to landing_page for Netlify hosting
            updater_dest = os.path.join(LANDING_PAGE_DIR, "updater.py")
            shutil.copy(updater_src, updater_dest)
            print(f"Copied updater.py to {updater_dest}")
        else:
            print("Warning: updater.py not found!")
            
        # Add version.json (Updated)
        print("Adding version.json...")
        zipf.write(VERSION_FILE, "version.json")
        
    print("Build Complete!")
    print(f"Update zip created at: {zip_path}")
    print(f"Version updated to: {new_version}")
    print("Now run: git add . && git commit -m 'Release v...' && git push")

if __name__ == "__main__":
    main()
