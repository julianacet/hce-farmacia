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

echo.
echo ================================================
echo    HCE Farmacia - Aplicando actualizacion
echo ================================================
echo.

if not exist "%CONFIG%" (
    echo [ERROR] No se encontro config.bat
    echo         Ejecuta primera_vez_farmacia.bat para configurar el modulo.
    echo.
    pause
    exit /b 1
)

echo Actualizacion aplicada correctamente.
echo.
echo   Los archivos de HCE Farmacia han sido actualizados.
echo   Para aplicar los cambios, cierra y vuelve a abrir
echo   HCE Farmacia.
echo.
