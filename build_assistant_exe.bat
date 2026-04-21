@echo off
setlocal enabledelayedexpansion
title JARVIS Assistant Compiler

echo ==================================================
echo.
echo           JARVIS ASSISTANT COMPILER
echo        (Compiles agent_runner.py to .exe)
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

echo [2/3] Compiling assistant.exe...
:: Compiles it as a single executable, hiding the console window usually requires --noconsole, 
:: but we want to see the HTTP logs, so we leave it as console app.
python -m PyInstaller --onefile --name "assistant" agent_runner.py

echo [3/3] Cleaning up build files...
move "dist\assistant.exe" "assistant.exe" >nul 2>&1
rmdir /s /q build >nul 2>&1
rmdir /s /q dist >nul 2>&1
del assistant.spec >nul 2>&1

echo.
echo ==================================================
echo [SUCCESS] Compilation complete!
echo You can now delete "build_assistant_exe.bat" and "agent_runner.py" if you wish,
echo and launch the backend by simply double-clicking "assistant.exe".
echo ==================================================
pause
