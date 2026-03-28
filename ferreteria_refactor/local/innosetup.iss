; ============================================================
; Mi Inventario Fácil — InnoSetup Installer Script
;
; Para compilar (en Windows):
;   1. Armar el paquete desde Linux: bash build_package.sh
;   2. Copiar dist/MiInventarioFacil/ a Windows
;   3. Abrir este archivo con InnoSetup 6 y compilar (Ctrl+F9)
;      → genera output/MiInventarioFacil-Setup.exe
; ============================================================

#define MyAppName      "Mi Inventario Facil"
#define MyAppVersion   "1.0"
#define MyAppPublisher "Mi Inventario Facil"
#define MyAppURL       "http://localhost:8000"
#define MyAppExeName   "MiInventarioFacil.exe"

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
PrivilegesRequired=admin
DisableProgramGroupPage=yes
; Espacio aprox: PostgreSQL ~100MB + Python ~60MB + backend + frontend
ExtraDiskSpaceRequired=314572800

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "Crear acceso directo en el Escritorio"; GroupDescription: "Accesos directos:"

[Files]
; Todo el contenido del paquete armado por build_package.sh
Source: "dist\MiInventarioFacil\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}";          Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"
Name: "{group}\Detener {#MyAppName}";  Filename: "{app}\stop.bat";        WorkingDir: "{app}"
Name: "{autodesktop}\{#MyAppName}";    Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
; 1. Instalar VC++ Redistributable si falta (requerido por PostgreSQL)
Filename: "{app}\redist\vc_redist.x64.exe"; Parameters: "/install /quiet /norestart"; StatusMsg: "Instalando Visual C++ Redistributable..."; Check: VCRedistNotInstalled; Flags: waituntilterminated
; 2. Inicializar base de datos (solo primera vez)
Filename: "{app}\setup.bat"; StatusMsg: "Configurando base de datos (puede tardar 1-2 minutos)..."; Flags: waituntilterminated shellexec runhidden
; 3. Lanzar la app al terminar de instalar
Filename: "{app}\{#MyAppExeName}"; Description: "Iniciar {#MyAppName} ahora"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{app}\stop.bat"; Flags: runhidden waituntilterminated

[UninstallDelete]
Type: filesandordirs; Name: "{app}\postgresql\data"
Type: filesandordirs; Name: "{app}\postgresql\log.txt"
Type: filesandordirs; Name: "{app}\backend\media"
Type: filesandordirs; Name: "{app}\backend\backups"

[Code]
function VCRedistNotInstalled: Boolean;
var
  installed: Cardinal;
begin
  Result := True;
  if RegQueryDWordValue(HKLM, 'SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64', 'Installed', installed) then
    Result := (installed <> 1);
end;

[Messages]
WelcomeLabel2=Este asistente instalará [name] en su computadora.%n%nLa aplicación funciona completamente sin internet ni configuración adicional.%n%nSe configurará la base de datos automáticamente al finalizar.
FinishedLabel=La instalación de [name] ha finalizado.%n%nHaga doble click en el acceso directo del Escritorio para iniciar.%n%nCredenciales iniciales:%n  Usuario:     admin%n  Contraseña:  admin123
