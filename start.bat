@echo off
title Hand Gesture Vocaliser - Launcher
echo ==========================================================
echo          HAND GESTURE VOCALISER - V4 LAUNCHER
echo ==========================================================
echo.

cd /d "%~dp0"

echo [1/3] Checking Python & dependencies...
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not found in PATH! Please install Python 3.10+ and add it to PATH.
    pause
    exit /b 1
)

python -c "import websockets, serial, fastapi, uvicorn" >nul 2>&1
if errorlevel 1 (
    echo Installing backend dependencies...
    python -m pip install -r requirements.txt
)

echo [2/3] Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "Hand Gesture Vocaliser - Backend (FastAPI)" cmd /k "title Backend (FastAPI) & python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000"

echo [3/3] Starting Vite Frontend on http://127.0.0.1:3000 ...
start "Hand Gesture Vocaliser - Frontend (Vite)" cmd /k "title Frontend (Vite) & cd /d "%~dp0frontend" & npm.cmd run dev"

echo.
echo ==========================================================
echo Servers launched successfully!
echo Backend:  http://127.0.0.1:8000
echo Frontend: http://127.0.0.1:3000
echo ==========================================================
echo Opening web dashboard in default browser in 3 seconds...
timeout /t 3 >nul

start http://localhost:3000

echo Application is now running.
echo To stop the application, simply close the opened command windows.
pause
