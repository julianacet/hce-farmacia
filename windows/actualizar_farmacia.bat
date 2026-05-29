@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

net session >nul 2>&1
if errorlevel 1 (
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs -Wait"
    exit /b
)

set "DIR=%~dp0"
set "CONFIG=%DIR%config.bat"
set "MIGRATION_DIR=%DIR%db\migration"

echo.
echo ================================================
echo    HCE Farmacia - Aplicando actualizacion
echo ================================================
echo.

REM ── Verificar configuracion ───────────────────────────────────────────────────

if not exist "%CONFIG%" (
    echo [ERROR] No se encontro config.bat
    echo         Ejecuta primera_vez_farmacia.bat para configurar el modulo.
    echo.
    pause
    exit /b 1
)
call "%CONFIG%"

mkdir "%DIR%logs" 2>nul

REM ── Verificar conectividad a la base de datos ─────────────────────────────────

set "PSQL=%HCE_DIR%pgsql\bin\psql.exe"
if not exist "%PSQL%" (
    where psql >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] No se encontro psql.exe en: %HCE_DIR%pgsql\bin\
        echo         Verifica que HCE Consultorio este instalado correctamente.
        echo.
        pause
        exit /b 1
    )
    set "PSQL=psql"
)

echo [1] Verificando conexion a la base de datos...
"%PSQL%" "!DATABASE_URL!" -c "SELECT 1" >nul 2>&1
if errorlevel 1 (
    echo [!] PostgreSQL no esta accesible.
    echo     Abre HCE Consultorio y vuelve a ejecutar este script.
    echo     Las migraciones se han pospuesto.
    echo.
    echo [!] Migraciones pospuestas - PostgreSQL no disponible >> "%DIR%logs\farmacia_migraciones.log"
    pause
    exit /b 0
)
echo       Conexion exitosa.

REM ── Aplicar migraciones de esquema ────────────────────────────────────────────

echo [2] Aplicando migraciones de base de datos...

set "HAY_MIGRACIONES=0"
for %%f in ("%MIGRATION_DIR%\migrate_*.sql") do set "HAY_MIGRACIONES=1"

if "!HAY_MIGRACIONES!"=="0" (
    echo       Sin migraciones pendientes.
    goto :fin
)

set "ERRORES=0"
for %%f in ("%MIGRATION_DIR%\migrate_*.sql") do (
    echo       - %%~nxf
    "%PSQL%" "!DATABASE_URL!" -f "%%f" >>"%DIR%logs\farmacia_migraciones.log" 2>&1
    if errorlevel 1 (
        echo         [!] Advertencia - ver logs\farmacia_migraciones.log
        set "ERRORES=1"
    )
)

if "!ERRORES!"=="1" (
    echo.
    echo [!] Algunas migraciones tuvieron advertencias. Revisa logs\farmacia_migraciones.log
    echo     Esto puede ser normal si los cambios ya existian.
    echo.
)

:fin
echo.
echo ================================================
echo   Actualizacion completada
echo ================================================
echo.
