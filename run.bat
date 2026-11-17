@echo off
title Railway Reservation System Launcher
echo =================================================================
echo   RAILWAY RESERVATION SYSTEM - AUTO SETUP AND LAUNCHER
echo =================================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] Launcher exited with an error. Check logs\error.log for details.
    pause
)

