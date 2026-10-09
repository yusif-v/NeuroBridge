@echo off
setlocal
cd /d "%~dp0"
if exist ".tools\godot\Godot_v4.6.2-stable_win64.exe" (
    start "" ".tools\godot\Godot_v4.6.2-stable_win64.exe" --path "%~dp0."
    exit /b
)
where godot >nul 2>nul
if not errorlevel 1 (
    start "" godot --path "%~dp0."
    exit /b
)
echo Open project.godot in Godot 4, then press F6 or F5 to play.
echo Or put the Godot executable on PATH as godot.exe.
pause
