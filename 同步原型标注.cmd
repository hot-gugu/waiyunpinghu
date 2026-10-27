@echo off
cd /d "%~dp0"
python prototype-local-server.py --sync
if errorlevel 1 (echo 同步失败，请检查文件格式。) else (echo 同步完成，请刷新页面。)
pause
