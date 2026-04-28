@echo off
cd /d "%~dp0"
"C:\Program Files\nodejs\node.exe" server.js > "%~dp0server-4317-live.log" 2>&1
