; ============================================================
; Mi Inventario Fácil — InnoSetup Installer Script
;
; Para compilar: abrir este archivo con InnoSetup y hacer click
; en "Compile" (Ctrl+F9). Genera MiInventarioFacil-Setup.exe
;
; Prerequisito: ejecutar build_package.sh primero para generar
; la carpeta dist/MiInventarioFacil/ con todos los archivos.
; ============================================================

#define MyAppName "Mi Inventario Facil"
#define MyAppVersion "1.0"
#define MyAppPublisher "Mi Inventario Fácil"
#define MyAppURL "http://localhost:8000"
#define MyAppExeName "start.bat"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=output
OutputBaseFilename=MiInventarioFacil-Setup
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
SetupIconFile=
PrivilegesRequired=admin
DisableProgramGroupPage=yes
LicenseFile=
; Espacio estimado en KB (~180MB)
ExtraDiskSpaceRequired=188743680

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "Crear acceso directo en el Escritorio"; GroupDescription: "Accesos directos:"; Flags: checked

[Files]
; Copiar TODO el contenido de dist/MiInventarioFacil/
Source: "dist\MiInventarioFacil\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\frontend\favicon.svg"
Name: "{group}\Detener {#MyAppName}"; Filename: "{app}\stop.bat"; WorkingDir: "{app}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
; Ejecutar setup.bat después de instalar (solo primera vez)
Filename: "{app}\setup.bat"; Description: "Configurar base de datos (primera vez)"; Flags: nowait postinstall shellexec skipifsilent
; Opción: abrir la app después de instalar
Filename: "{app}\{#MyAppExeName}"; Description: "Iniciar {#MyAppName}"; Flags: nowait postinstall skipifsilent unchecked

[UninstallRun]
; Detener servicios antes de desinstalar
Filename: "{app}\stop.bat"; Flags: runhidden

[UninstallDelete]
; Limpiar archivos generados (data de PostgreSQL, logs, etc.)
Type: filesandordirs; Name: "{app}\postgresql\data"
Type: filesandordirs; Name: "{app}\postgresql\log.txt"
Type: filesandordirs; Name: "{app}\backend\media"
Type: filesandordirs; Name: "{app}\backend\backups"

[Messages]
WelcomeLabel2=Este asistente instalará [name] en su computadora.%n%nLa aplicación funcionará completamente sin internet.%n%nDespués de instalar, se configurará la base de datos automáticamente.
FinishedLabel=La instalación de [name] ha finalizado.%n%nEjecute "Mi Inventario Fácil" desde el escritorio para comenzar.%n%nCredenciales: admin / admin123
