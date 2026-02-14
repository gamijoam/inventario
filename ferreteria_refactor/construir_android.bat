@echo off
echo ==================================================
echo   📱 ACTUALIZAR APP ANDROID (CAPACITOR)
echo ==================================================

cd frontend_web || (
  echo ❌ Error: No encuentro la carpeta 'frontend_web'.
  goto :error
)

echo.
echo 🏗️  Compilando proyecto React...
call npm run build
if %ERRORLEVEL% neq 0 goto :error

echo.
echo 🔄 Sincronizando Capacitor...
call npx cap sync
if %ERRORLEVEL% neq 0 goto :error

echo 📂 Copiando archivos a Android...
call npx cap copy android
if %ERRORLEVEL% neq 0 goto :error

echo.
echo ✅ ¡LISTO!
echo 👉 Abre Android Studio y dale al botón PLAY (▶️).
cd ..
pause
exit /b 0

:error
echo.
echo ❌ ALGO SALIÓ MAL. Revisa los errores arriba.
cd ..
pause
exit /b 1
