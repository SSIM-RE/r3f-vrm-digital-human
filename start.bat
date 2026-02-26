@echo off
setlocal enabledelayedexpansion

set "PROJECT_DIR=D:\AI\OpenClaw\r3f-vrm-final-main"
set "SERVER_DIR=%PROJECT_DIR%\server"
set "GPT_DIR=D:\AI\OpenClaw\GPT-SoVITS-v2pro-20250604"
set "PYTHON=C:\Users\Miss\AppData\Local\Programs\Python\Python310\python.exe"

echo ========================================
echo    Mico VRM - Starting Services
echo ========================================
echo.

echo [1/4] Starting GPT-SoVITS TTS...
start "GPT-SoVITS" cmd /k "cd /d "%GPT_DIR%" && "%PYTHON%" api_v2.py -a 127.0.0.1 -p 9880"

timeout /t 8 /nobreak >nul
echo      Waiting...

echo [2/4] Starting Whisper API...
start "Whisper" cmd /k "cd /d "%SERVER_DIR%" && python app.py"

timeout /t 5 /nobreak >nul

echo [3/4] Starting WebSocket...
start "WebSocket" cmd /k "cd /d "%SERVER_DIR%" && python ws_simple.py"

timeout /t 5 /nobreak >nul

echo [4/4] Starting Frontend...
start "Frontend" cmd /k "cd /d "%PROJECT_DIR%" && npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo    All Services Started!
echo ========================================
echo.
echo URLs:
echo   - Frontend:    http://localhost:5173
echo   - Whisper:    http://localhost:5000
echo   - WebSocket:  ws://127.0.0.1:8765
echo   - GPT-SoVITS: http://127.0.0.1:9880
echo.
echo Press any key to exit...
pause >nul
