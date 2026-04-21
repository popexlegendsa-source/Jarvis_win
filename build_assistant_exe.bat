@echo off
setlocal enabledelayedexpansion
title JARVIS Launcher Compiler

echo ==================================================
echo.
echo           JARVIS LAUNCHER COMPILER
echo        (Compiles launcher.py to assistant.exe)
echo.
echo ==================================================
echo.

:: Check for python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Please install Python 3.10+ from python.org
    pause
    exit
)

echo [1/3] Installing PyInstaller...
python -m pip install pyinstaller >nul 2>&1

echo [2/3] Compiling assistant.exe (GUI Launcher)...
:: Compiles it as a single executable, --noconsole hides the default CMD window so ONLY the UI shows up
python -m PyInstaller --onefile --noconsole --name "assistant" launcher.py

echo [3/3] Cleaning up build files...
move /y "dist\assistant.exe" "assistant.exe" >nul 2>&1
rmdir /s /q build >nul 2>&1
rmdir /s /q dist >nul 2>&1
del assistant.spec >nul 2>&1
del launcher.spec >nul 2>&1

echo.
echo ==================================================
echo [SUCCESS] Standalone Launcher Compilation complete!
echo You can now delete "build_assistant_exe.bat" and "launcher.py" if you wish.
echo To boot the JARVIS system, simply double-click "assistant.exe"!
echo ==================================================
pause
