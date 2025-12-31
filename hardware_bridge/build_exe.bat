@echo off
echo ==========================================
echo  Building BridgeInvensoft.exe
echo ==========================================

REM Install dependencies
pip install -r requirements.txt
pip install pyinstaller

REM Build the executable
REM --onefile: Create a single EXE
REM --noconsole: Hide the console window (background process)
REM --name: Output name
REM --clean: Clean cache
REM --hidden-import: Ensure USB libraries are included

pyinstaller --noconsole --onefile --clean ^
    --name BridgeInvensoft ^
    --hidden-import=usb ^
    --hidden-import=usb.core ^
    --hidden-import=usb.backend.libusb1 ^
    --hidden-import=win32timezone ^
    --hidden-import=win32print ^
    --hidden-import=win32api ^
    --hidden-import=pythoncom ^
    --hidden-import=pywintypes ^
    --hidden-import=uvicorn.logging ^
    --hidden-import=uvicorn.loops ^
    --hidden-import=uvicorn.loops.auto ^
    --hidden-import=uvicorn.protocols ^
    --hidden-import=uvicorn.protocols.http ^
    --hidden-import=uvicorn.protocols.http.auto ^
    --hidden-import=uvicorn.lifespan ^
    --hidden-import=uvicorn.lifespan.on ^
    --collect-all escpos ^
    main.py

echo.
echo ==========================================
echo  Build Complete!
echo  Executable is in: dist\BridgeInvensoft.exe
echo ==========================================
pause
