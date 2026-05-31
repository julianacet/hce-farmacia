; Inno Setup Script — HCE Farmacia
; Compilar con: ISCC.exe farm.iss /DMyVersion=1.0.0
; Requiere Inno Setup 6+: https://jrsoftware.org/isinfo.php

#ifndef MyVersion
  #define MyVersion "1.0.0"
#endif

[Setup]
AppName=HCE Farmacia
AppVersion={#MyVersion}
AppPublisher=Tu Consultorio
AppPublisherURL=
AppSupportURL=
AppUpdatesURL=
DefaultDirName={autopf}\HCE Farmacia
DefaultGroupName=HCE Farmacia
DisableProgramGroupPage=yes
OutputDir=.
OutputBaseFilename=HCE-Farmacia-Setup
SetupIconFile=farm.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
; Requiere Windows 10 o superior (WebView2)
MinVersion=10.0
; Cerrar farm-web.exe si esta en ejecucion antes de instalar
CloseApplications=yes
CloseApplicationsFilter=farm-web.exe

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Files]
; Binario principal
Source: "farm-web.exe"; DestDir: "{app}"; Flags: ignoreversion

; Icono de la aplicación (generado en CI desde ui/public/favicon.svg)
Source: "farm.ico"; DestDir: "{app}"; Flags: ignoreversion

; Scripts de gestion
Source: "primera_vez_farmacia.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "actualizar_farmacia.bat";  DestDir: "{app}"; Flags: ignoreversion

; Version actual
Source: "version.txt"; DestDir: "{app}"; Flags: ignoreversion

; Frontend estatico (generado por construir_windows.sh)
Source: "dist-farmacia\*"; DestDir: "{app}\dist-farmacia"; Flags: ignoreversion recursesubdirs createallsubdirs

[Dirs]
Name: "{app}\logs"

[Icons]
Name: "{group}\Abrir HCE Farmacia";          Filename: "{app}\farm-web.exe"; WorkingDir: "{app}"; IconFilename: "{app}\farm.ico"
Name: "{group}\Desinstalar HCE Farmacia";    Filename: "{uninstallexe}"
Name: "{commondesktop}\HCE Farmacia";        Filename: "{app}\farm-web.exe"; WorkingDir: "{app}"; IconFilename: "{app}\farm.ico"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Crear acceso directo en el escritorio"; GroupDescription: "Iconos adicionales:"

[Run]
; Actualizacion (config.bat existe): verificar y confirmar actualizacion
Filename: "{app}\actualizar_farmacia.bat"; \
    WorkingDir: "{app}"; \
    Flags: shellexec waituntilterminated runhidden; \
    Check: FileExists(ExpandConstant('{app}\config.bat'))

; Primera instalacion: configurar modulo de farmacia
Filename: "{cmd}"; Parameters: "/c primera_vez_farmacia.bat"; \
    Description: "Configurar HCE Farmacia"; \
    WorkingDir: "{app}"; \
    Flags: waituntilterminated; \
    Check: not FileExists(ExpandConstant('{app}\config.bat'))

; Primera instalacion: ofrecer abrir al terminar
Filename: "{app}\farm-web.exe"; \
    Description: "Abrir HCE Farmacia ahora"; \
    WorkingDir: "{app}"; \
    Flags: nowait postinstall skipifsilent; \
    Check: not FileExists(ExpandConstant('{app}\config.bat'))

[UninstallRun]
Filename: "taskkill"; Parameters: "/f /im farm-web.exe"; \
    Flags: shellexec waituntilterminated runhidden; RunOnceId: "cerrar"

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
begin
  if CurStep = ssInstall then begin
    // Cerrar farm-web.exe si esta en ejecucion
    Exec('taskkill', '/f /im farm-web.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    // Eliminar acceso directo antiguo del escritorio del usuario (creado por primera_vez_farmacia.bat)
    if FileExists(ExpandConstant('{userdesktop}\HCE Farmacia.lnk')) then
      DeleteFile(ExpandConstant('{userdesktop}\HCE Farmacia.lnk'));
  end;
end;
