@echo off
setlocal
cd /d "%~dp0"
python qa/run_laya.py --device cuda --demo --keep-open --speed 0.75 --decision-delay 0.7 %*
echo.
echo This was a seeded demo defect. The normal game remains unchanged.
pause
