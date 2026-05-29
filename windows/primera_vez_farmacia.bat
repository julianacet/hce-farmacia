@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

REM Auto-elevacion: relanzar como administrador si es necesario
net session >nul 2>&1
if errorlevel 1 (
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs -Wait"
    exit /b
)

set "DIR=%~dp0"

echo.
echo ================================================
echo    HCE Farmacia - Primera configuracion
echo ================================================
echo.
echo  Este asistente aplica el modulo de farmacia en la
echo  base de datos de HCE Consultorio.
echo.
echo  IMPORTANTE: HCE Consultorio debe estar abierto
echo  antes de continuar.
echo.
pause

REM ── Localizar instalacion de HCE Consultorio ──────────────────────────────────

set "HCE_DIR="

REM 1. Intentar via registro de Windows (instalacion con Inno Setup)
for /f "tokens=2*" %%A in (
    'reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\HCE Consultorio_is1" /v InstallLocation 2^>nul'
) do set "HCE_DIR=%%B"

REM 2. Buscar en rutas comunes si el registro no funciono
if not defined HCE_DIR (
    for %%P in (
        "%ProgramFiles%\HCE Consultorio"
        "%ProgramFiles(x86)%\HCE Consultorio"
        "%SystemDrive%\HCE Consultorio"
    ) do (
        if exist "%%~P\hce-web.exe" set "HCE_DIR=%%~P\"
    )
)

REM 3. Preguntar al usuario si no se encontro
if not defined HCE_DIR (
    echo [!] No se encontro HCE Consultorio automaticamente.
    echo.
    set /p "HCE_DIR=  Ruta de instalacion de HCE Consultorio: "
    echo.
    if not exist "!HCE_DIR!\hce-web.exe" (
        echo [ERROR] No se encontro hce-web.exe en: !HCE_DIR!
        echo.
        pause
        exit /b 1
    )
    REM Asegurar que termina con backslash
    if "!HCE_DIR:~-1!" neq "\" set "HCE_DIR=!HCE_DIR!\"
)

echo [OK] HCE Consultorio encontrado en: !HCE_DIR!
echo.

REM ── Localizar psql.exe ────────────────────────────────────────────────────────

set "PSQL=!HCE_DIR!pgsql\bin\psql.exe"
if not exist "!PSQL!" (
    where psql >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] No se encontro psql.exe en: !HCE_DIR!pgsql\bin\
        echo         Asegurate de que HCE Consultorio este instalado correctamente.
        echo.
        pause
        exit /b 1
    )
    set "PSQL=psql"
)

REM ── Leer configuracion de HCE Consultorio ────────────────────────────────────

set "HCE_CONFIG=!HCE_DIR!config.bat"
if exist "!HCE_CONFIG!" (
    call "!HCE_CONFIG!"
    echo [OK] Configuracion de HCE Consultorio encontrada.
    echo.
) else (
    echo [!] No se encontro config.bat en: !HCE_DIR!
    echo     Ingresa los datos de conexion manualmente:
    echo.
    set /p "DB_USER=  Usuario de la base de datos [hce]: "
    if "!DB_USER!"=="" set "DB_USER=hce"
    set /p "DB_PASS=  Contrasena: "
    set /p "DB_PORT=  Puerto de PostgreSQL [5433]: "
    if "!DB_PORT!"=="" set "DB_PORT=5433"
    set "DATABASE_URL=postgresql://!DB_USER!:!DB_PASS!@127.0.0.1:!DB_PORT!/hce_provider?sslmode=disable"
)

REM ── Verificar conexion ────────────────────────────────────────────────────────

echo [1] Verificando conexion a la base de datos...
"!PSQL!" "!DATABASE_URL!" -c "SELECT 1" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] No se pudo conectar a la base de datos.
    echo.
    echo         Posibles causas:
    echo           - HCE Consultorio no esta abierto
    echo           - Credenciales incorrectas
    echo           - Puerto incorrecto
    echo.
    pause
    exit /b 1
)
echo       Conexion exitosa.

REM ── Aplicar esquema de farmacia ───────────────────────────────────────────────

echo [2] Aplicando esquema de farmacia...
set "SCHEMA_FILE=%DIR%..\db\init.sql"
if not exist "!SCHEMA_FILE!" set "SCHEMA_FILE=%DIR%db\init.sql"

if not exist "!SCHEMA_FILE!" (
    echo [ERROR] No se encontro db\init.sql
    echo.
    pause
    exit /b 1
)

mkdir "%DIR%logs" 2>nul
"!PSQL!" "!DATABASE_URL!" -f "!SCHEMA_FILE!" >"%DIR%logs\farmacia_init.log" 2>&1
if errorlevel 1 (
    echo [!] Hubo advertencias al aplicar el esquema.
    echo     Revisa logs\farmacia_init.log para mas detalles.
    echo     Esto puede ser normal si el esquema ya existia.
) else (
    echo       Esquema aplicado correctamente.
)

REM ── Configurar firewall ───────────────────────────────────────────────────────

echo [3] Configurando firewall (descubrimiento de red)...
netsh advfirewall firewall add rule name="HCE Farmacia - Descubrimiento" ^
    dir=in action=allow protocol=UDP localport=45678 >nul 2>&1
echo       OK

REM ── Guardar configuracion local ───────────────────────────────────────────────

echo [4] Guardando configuracion...
(
    echo @echo off
    echo REM Generado por primera_vez_farmacia.bat — no editar manualmente
    echo set "HCE_DIR=!HCE_DIR!"
    echo set "DATABASE_URL=!DATABASE_URL!"
    echo set "APP_TZ=America/Bogota"
) > "%DIR%config.bat"
echo       OK

echo.
echo ================================================
echo   Configuracion completada
echo ================================================
echo.
echo   Para abrir HCE Farmacia: haz doble clic en farm-web.exe
echo.
echo   En otros equipos ^(recepcion, etc.^):
echo   Copia farm-web.exe y la carpeta dist-farmacia/
echo   No se necesita ninguna configuracion adicional.
echo.
pause
