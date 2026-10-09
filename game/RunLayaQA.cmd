@echo off
setlocal
cd /d "%~dp0"
python qa/run_laya.py --device cuda %*
echo.
echo The report path is printed above. See qa\README.md for setup and replay.
pause
