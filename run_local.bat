@echo off
setlocal enabledelayedexpansion
title JARVIS - Personal Assistant v2.7.0

echo.
echo    __  ___  ____  _  _  ____  ____
echo   (  )/ __)(  _ \( \/ )(_  _)/ ___)
echo    ) \\__ \ )   / \  /  _)(_ \___ \
echo   (__)(___/(__\_)  \/  (____)(____/
echo.
echo [JARVIS] Initializing Environment...
echo --------------------------------------------------

:: --- 0. Очистка старых процессов ---
echo [0/4] Cleaning sessions...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

:: --- 1. ПРОВЕРКА И АВТО-УСТАНОВКА ---

:: 1.1 ПРОВЕРКА GIT
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Git not found.
    set /p i_git="Install Git automatically? (y/n): "
    if /i "!i_git!"=="y" (
        echo [JARVIS] Installing Git via Winget...
        winget install --id Git.Git -e --source winget
        echo [!] Restart JARVIS after installation.
        pause & exit
    )
)

:: 1.2 ПРОВЕРКА NODE.JS
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Node.js not found.
    set /p i_node="Install Node.js (LTS) automatically? (y/n): "
    if /i "!i_node!"=="y" (
        echo [JARVIS] Installing Node.js via Winget...
        winget install --id OpenJS.NodeJS.LTS -e --source winget
        echo [!] Restart JARVIS after installation.
        pause & exit
    )
)

:: 1.3 ПРОВЕРКА PYTHON
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Python not found.
    set /p i_py="Install Python 3.11 automatically? (y/n): "
    if /i "!i_py!"=="y" (
        echo [JARVIS] Installing Python via Winget...
        winget install --id Python.Python.3.11 -e --source winget
        echo [!] Restart JARVIS after installation.
        pause & exit
    )
)

:: --- 2. УСТАНОВКА ЗАВИСИМОСТЕЙ ---
if not exist node_modules (
    echo [2/4] Installing UI dependencies...
    call npm install
)

:: --- 3. ЗАПУСК БЭКЕНДА ---
echo [3/4] Starting Automation Agent...
python -m pip install flask flask-cors >nul 2>&1
start /b "" pythonw agent_runner.py

:: --- 4. ЗАПУСК ФРОНТЕНДА ---
echo [4/4] Launching Dashboard...
start http://localhost:3000
npx vite --port=3000 --host=127.0.0.1
pause
