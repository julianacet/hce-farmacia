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
set "CONFIG=%DIR%config.bat"

echo.
echo ================================================
echo    HCE Farmacia - Primera configuracion
echo ================================================
echo.

REM ── Verificar si ya fue configurado ───────────────────────────────────────────

if exist "%CONFIG%" (
    echo [!] Este equipo ya fue configurado.
    echo     Si quieres reconfigurar, elimina config.bat y ejecuta este script de nuevo.
    echo.
    pause
    exit /b 0
)

echo [1] Configurando firewall para descubrimiento en red local...
netsh advfirewall firewall add rule name="HCE Farmacia - Descubrimiento" ^
    dir=in action=allow protocol=UDP localport=45678 >nul 2>&1
echo       OK

echo [2] Guardando configuracion...
(
    echo @echo off
    echo REM Generado por primera_vez_farmacia.bat
    echo set "APP_TZ=America/Bogota"
) > "%CONFIG%"
echo       OK

echo.
echo ================================================
echo   Configuracion completada
echo ================================================
echo.
echo   Para abrir HCE Farmacia: haz doble clic en el acceso
echo   directo del escritorio o en farm-web.exe
echo.
echo   HCE Farmacia se conectara automaticamente al servidor
echo   HCE Consultorio cuando esten en la misma red local.
echo.
echo   IMPORTANTE: Asegurate de que HCE Consultorio este
echo   abierto en el equipo del medico antes de abrir
echo   HCE Farmacia.
echo.
pause
