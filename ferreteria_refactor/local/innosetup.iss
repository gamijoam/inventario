; ============================================================
; Mi Inventario Fácil — InnoSetup Installer Script
;
; Para compilar:
; 1. En Windows, compilar el launcher:
;    cd MiInventarioFacil
;    python\python.exe -m pip install pyinstaller
;    python\python.exe -m PyInstaller --onefile --windowed --name "Mi Inventario Facil" launcher.py
;    copy dist\Mi Inventario Facil.exe .
;
; 2. Abrir este archivo con InnoSetup y compilar (Ctrl+F9)
; ============================================================

#define MyAppName "Mi Inventario Facil"
#define MyAppVersion "1.0"
#define MyAppPublisher "Mi Inventario Facil"
#define MyAppURL "http://localhost:8000"
#define MyAppExeName "Mi Inventario Facil.exe"

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
ExtraDiskSpaceRequired=188743680

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "Crear acceso directo en el Escritorio"; GroupDescription: "Accesos directos:"; Flags: checked

[Files]
Source: "dist\MiInventarioFacil\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"
Name: "{group}\Detener {#MyAppName}"; Filename: "{app}\stop.bat"; WorkingDir: "{app}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
; Instalar VC++ Redistributable si falta
Filename: "{app}\redist\vc_redist.x64.exe"; Parameters: "/install /quiet /norestart"; StatusMsg: "Instalando Visual C++ Redistributable..."; Check: VCRedistNotInstalled; Flags: waituntilterminated
; Ejecutar setup.bat (instala pip, dependencias, crea BD)
Filename: "{app}\setup.bat"; StatusMsg: "Configurando base de datos..."; Flags: waituntilterminated shellexec
; Iniciar la app
Filename: "{app}\{#MyAppExeName}"; Description: "Iniciar {#MyAppName}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{app}\stop.bat"; Flags: runhidden

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
WelcomeLabel2=Este asistente instalará [name] en su computadora.%n%nLa aplicación funcionará completamente sin internet.%n%nDespués de instalar, se configurará la base de datos automáticamente.
FinishedLabel=La instalación de [name] ha finalizado.%n%nHaga doble click en el acceso directo del escritorio para iniciar.%n%nCredenciales: admin / admin123
