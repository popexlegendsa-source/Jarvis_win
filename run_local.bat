@echo off
setlocal enabledelayedexpansion

:: --- ADMIN PRIVILEGES CHECK ---
net session >nul 2>&1
if %errorLevel% neq 0 (
    set IS_ADMIN=NO
) else (
    set IS_ADMIN=YES
)

cd /d "%~dp0"

title JARVIS - Personal Assistant v2.11.2

echo.
echo    __  ___  ____  _  _  ____  ____
echo   (  )/ __)(  _ \( \/ )(_  _)/ ___)
echo    ) \\__ \ )   / \  /  _)(_ \___ \
echo   (__)(___/(__\_)  \/  (____)(____/
echo.

if "!IS_ADMIN!"=="NO" (
    echo [!] NOTICE: JARVIS is running in Standard Mode.
    echo [!] To use Network Firewall commands, please close this window, 
    echo [!] right-click 'run_local.bat' and select "Run as Administrator".
    echo.
) else (
    echo [i] JARVIS is running with Administrator privileges!
    echo.
)

echo [JARVIS] Initializing Environment...
echo --------------------------------------------------

:: --- 0. Очистка старых процессов ---
echo [0/5] Cleaning sessions...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

:: --- 1. SECURITY TOKEN SETUP ---
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
:: [REMOVED BY USER REQUEST - Git auto-sync disabled to prevent overwriting manual ZIP downloads]

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
if exist "assistant.exe" (
    start /b "" assistant.exe --token !agent_token!
) else (
    python -m pip install flask flask-cors pyautogui >nul 2>&1
    start /b "" pythonw agent_runner.py --token !agent_token!
)

:: --- 4. ЗАПУСК ФРОНТЕНДА ---
echo [4/5] Launching Dashboard...
start http://localhost:3000
npx vite --port=3000 --host=127.0.0.1
pause
