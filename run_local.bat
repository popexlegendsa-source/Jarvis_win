@echo off
setlocal enabledelayedexpansion
title JARVIS - Personal Assistant v2.9.3

echo.
echo    __  ___  ____  _  _  ____  ____
echo   (  )/ __)(  _ \( \/ )(_  _)/ ___)
echo    ) \\__ \ )   / \  /  _)(_ \___ \
echo   (__)(___/(__\_)  \/  (____)(____/
echo.
echo [JARVIS] Initializing Environment...
echo --------------------------------------------------

:: --- 0. Очистка старых процессов ---
echo [0/5] Cleaning sessions...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

:: --- 1. ПРОВЕРКА И ПРЯМАЯ СИНХРОНИЗАЦИЯ (OTA) ---
set /p do_sync="Sync with AI Studio Cloud? (y/n): "
if /i "!do_sync!"=="y" (
    echo [OTA] Direct Sync Mode Activated.
    if not exist .sync_url (
        set /p s_url="Enter your AI Studio App URL: "
        echo !s_url! > .sync_url
    )
    set /p s_url=<.sync_url
    
    :: Очистка URL от кавычек, пробелов и слэша на конце
    set s_url=!s_url:"=!
    set s_url=!s_url: =!
    if "!s_url:~-1!"=="/" set s_url=!s_url:~0,-1!
    
    echo [OTA] Fetching latest JARVIS bundle from: !s_url!/api/sync/bundle
    curl -f -L "!s_url!/api/sync/bundle" -o jarvis_update.zip
    
    if not exist jarvis_update.zip (
        echo [ERROR] Failed to download update. Check URL or internet.
        del .sync_url
        pause
    ) else if %errorlevel% neq 0 (
        echo [ERROR] Server returned an error. Deleting bad zip...
        del jarvis_update.zip
        del .sync_url
        pause
    ) else (
        echo [OTA] Extracting update...
        powershell -Command "Expand-Archive -Path '.\jarvis_update.zip' -DestinationPath '.' -Force"
        del jarvis_update.zip
        echo [SUCCESS] JARVIS updated to latest cloud version!
        echo [!] Restarting script to apply core changes...
        pause
        start run_local.bat
        exit
    )
)

:: --- 2. SECURITY TOKEN SETUP ---
if not exist .agent_token (
    echo.
    echo ==================================================
    echo [SECURITY SETUP] 
    echo Unsecured remote execution is highly dangerous.
    echo Please create a secure Local Bridge Token.
    echo You will enter this token in the AI Studio Settings.
    echo ==================================================
    set /p new_token="Enter a new secure PIN/Token: "
    echo !new_token! > .agent_token
)
set /p agent_token=<.agent_token
set agent_token=!agent_token: =!


:: --- 2. ПРОВЕРКА И АВТО-УСТАНОВКА ЗАВИСИМОСТЕЙ ---
:: (Здесь идет оригинальный код проверки Git/Node/Python из v2.7.2)

:: 2.1 ПРОВЕРКА GIT И АВТО-ОБНОВЛЕНИЕ
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Git not found. Skip Git checks.
) else (
    echo [1/5] Syncing with Private GitHub Repository...
    if not exist .git (
        echo [JARVIS] Initializing Git link...
        git init
        git remote add origin https://github.com/popexlegendsa-source/Jarvis_win.git
        git branch -M main
    ) else (
        git remote set-url origin https://github.com/popexlegendsa-source/Jarvis_win.git
    )
    
    :: Стягиваем изменения. Так как репо приватный, Git сам вызовет окно авторизации (Credential Manager)
    git pull origin main
)

:: 1.3 ПРОВЕРКА NODE.JS
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

:: 1.4 ПРОВЕРКА PYTHON
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
    echo [2/5] Installing UI dependencies...
    call npm install
)

:: --- 3. ЗАПУСК БЭКЕНДА ---
echo [3/5] Starting Automation Agent...
python -m pip install flask flask-cors pyautogui >nul 2>&1
start /b "" pythonw agent_runner.py --token !agent_token!

:: --- 4. ЗАПУСК ФРОНТЕНДА ---
echo [4/5] Launching Dashboard...
start http://localhost:3000
npx vite --port=3000 --host=127.0.0.1
pause
