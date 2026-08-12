@echo off
setlocal
title RoTool Updater
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Update-RoTool.ps1" %*
set "ROTOOL_UPDATE_EXIT=%ERRORLEVEL%"
echo.
if not "%ROTOOL_UPDATE_EXIT%"=="0" echo RoTool was not changed. Review the error above.
pause
exit /b %ROTOOL_UPDATE_EXIT%
