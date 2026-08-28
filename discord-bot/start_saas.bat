@echo off
title Discord Automation Cloud (SaaS) Launcher
echo ========================================================
echo   Discord Automation Cloud (SaaS) - Production Launcher
echo ========================================================
echo.
echo Launching Live Dashboard on http://localhost:3000...
start http://localhost:3000
python server.py
pause
