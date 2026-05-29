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

; Scripts de gestion
Source: "primera_vez_farmacia.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "actualizar_farmacia.bat";  DestDir: "{app}"; Flags: ignoreversion

; Version actual
Source: "version.txt"; DestDir: "{app}"; Flags: ignoreversion

; Frontend estatico (generado por construir_windows.sh)
Source: "dist-farmacia\*"; DestDir: "{app}\dist-farmacia"; Flags: ignoreversion recursesubdirs createallsubdirs

; Esquema de farmacia (solo se usa en primera instalacion)
Source: "..\db\init.sql"; DestDir: "{app}\db"; Flags: ignoreversion

; Migraciones de esquema (aplicadas en actualizaciones)
Source: "..\db\migration\migrate_*.sql"; DestDir: "{app}\db\migration"; Flags: ignoreversion skipifsourcedoesntexist

[Dirs]
Name: "{app}\logs"
Name: "{app}\db\migration"

[Icons]
Name: "{group}\Abrir HCE Farmacia";          Filename: "{app}\farm-web.exe"; WorkingDir: "{app}"
Name: "{group}\Desinstalar HCE Farmacia";    Filename: "{uninstallexe}"
Name: "{commondesktop}\HCE Farmacia";        Filename: "{app}\farm-web.exe"; WorkingDir: "{app}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Crear acceso directo en el escritorio"; GroupDescription: "Iconos adicionales:"

[Run]
; Actualizacion (config.bat existe): aplicar migraciones en silencio
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

function InitializeSetup(): Boolean;
var
  HcePath: String;
  HceFound: Boolean;
begin
  Result := True;
  HceFound := False;

  // Buscar HCE Consultorio via registro (instalacion con Inno Setup)
  if RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\HCE Consultorio_is1',
                         'InstallLocation', HcePath) then begin
    if FileExists(HcePath + 'hce-web.exe') or FileExists(HcePath + '\hce-web.exe') then
      HceFound := True;
  end;

  // Buscar en ruta por defecto si el registro no funciono
  if not HceFound then begin
    HcePath := ExpandConstant('{autopf}\HCE Consultorio');
    if FileExists(HcePath + '\hce-web.exe') then
      HceFound := True;
  end;

  if not HceFound then begin
    if MsgBox('No se encontro HCE Consultorio instalado en este equipo.' + #13#10 + #13#10 +
              'HCE Farmacia requiere que HCE Consultorio este instalado y configurado primero.' + #13#10 + #13#10 +
              'Puedes continuar, pero deberaas configurar la conexion manualmente.' + #13#10 + #13#10 +
              'Deseas continuar de todas formas?',
              mbConfirmation, MB_YESNO) = IDNO then
      Result := False;
  end;
end;
