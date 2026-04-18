@echo off
title WinAutomate - All-in-One Launcher
echo.
echo ==================================================
echo   WinAutomate v2.4 - Starting System...
echo ==================================================
echo.

:: 0. Очистка старых процессов (чтобы не было ошибок "Port already in use")
echo [0/4] Cleaning up old sessions...
:: Закрываем процессы на порту 3000 (Vite)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
:: Закрываем процессы на порту 5000 (Python Agent)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
echo Done.

:: 1. Проверка Node.js
echo [1/4] Checking Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found! Please install it from https://nodejs.org/
    pause
    exit
)

:: 1.5 Проверка Git (для авто-обновлений)
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Git is not installed. Auto-updates with "git pull" will not work.
    echo Please install it from https://git-scm.com/ to keep JARVIS updated.
    echo.
)

:: 2. Установка Node зависимостей
if not exist node_modules (
    echo [2/4] First time setup: Installing UI dependencies...
    call npm install
) else (
    echo [2/4] UI dependencies OK.
)

:: 3. Настройка Python и фонового раннера
echo [3/4] Preparing Background Agent...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found! Commands will not execute.
) else (
    python -m pip install flask flask-cors >nul 2>&1
    
    :: Запуск раннера в ФОНЕ
    echo Launching agent_runner.py in background...
    start /b "" pythonw agent_runner.py
)

:: 4. Запуск фронтенда и открытие браузера
echo.
echo [4/4] Starting Dashboard...
echo --------------------------------------------------
echo   UI: http://localhost:3000
echo   AGENT: http://localhost:5000 (Running in background)
echo --------------------------------------------------
echo.

start http://localhost:3000
npx vite --port=3000 --host=127.0.0.1
pause
