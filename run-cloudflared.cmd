@echo off
cd /d "%~dp0"
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --protocol http2 --url http://127.0.0.1:4317 --no-autoupdate --logfile "%~dp0cloudflared-task-live.log"
