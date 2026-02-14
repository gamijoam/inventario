@echo off
setlocal
echo ==================================================
echo   📦 GENERANDO APK ANDROID (DEBUG)
echo ==================================================

:: 1. CONFIGURAR JAVA (Hardcoded to known Android Studio path)
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"

echo 🔎 Verificando Java...
java -version
if %ERRORLEVEL% neq 0 (
    echo ❌ ERROR: No se puede ejecutar Java. Verifica la instalación.
    goto :error
)

echo.
echo 🛠️ 2. Compilando Frontend (React)...
cd frontend_web
call npm run build
if %ERRORLEVEL% neq 0 goto :error

echo.
echo 🔄 3. Sincronizando Capacitor...
call npx cap sync
if %ERRORLEVEL% neq 0 goto :error

echo.
echo 🐘 4. Construyendo APK con Gradle...
cd android
call gradlew assembleDebug
if %ERRORLEVEL% neq 0 goto :error

echo.
echo 📂 5. Copiando APK...
cd ..\..
copy "frontend_web\android\app\build\outputs\apk\debug\app-debug.apk" "Ferreteria_App_Debug.apk"

echo.
echo ==================================================
echo ✅ ¡EXCELENTE! APK CREADA: Ferreteria_App_Debug.apk
echo ==================================================
pause
exit /b 0

:error
echo.
echo ❌ ERROR EN EL PROCESO
pause
exit /b 1
