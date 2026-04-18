@echo off
setlocal enabledelayedexpansion

echo [JARVIS RELEASE MANAGER]
echo -----------------------

:: 1. Сначала забираем последние изменения
echo [1/3] Pulling latest changes from GitHub...
git pull
if %errorlevel% neq 0 (
    echo [ERROR] Git pull failed. Make sure you have no uncommitted changes.
    pause
    exit /b
)

:: 2. Читаем версию из package.json (это магия парсинга одной строкой)
for /f "tokens=2 delims=:," %%a in ('findstr /i "version" package.json') do (
    set VERSION=%%a
)
:: Убираем кавычки и пробелы
set VERSION=%VERSION:"=%
set VERSION=%VERSION: =%

echo [2/3] Version detected: v%VERSION%

:: 3. Создаем и пушим тег
echo [3/3] Creating Git Tag v%VERSION%...
git tag -a v%VERSION% -m "Release v%VERSION%"
git push origin v%VERSION%

if %errorlevel% neq 0 (
    echo [WARNING] Tag might already exist or push failed.
) else (
    echo [SUCCESS] New version v%VERSION% is now live on GitHub Releases!
)

echo -----------------------
pause
