#!/usr/bin/env bash

# ==============================================================================
# Railway Reservation System with Custom DSA & Waiting-List Engine
# Single-Command Launcher for Backend (FastAPI) and Frontend (Next.js)
# ==============================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "================================================================="
echo "   RAILWAY RESERVATION SYSTEM (ACADEMIC DSA ENGINE)              "
echo "================================================================="

# Set Python Path for backend modules
export PYTHONPATH="$PROJECT_ROOT/backend"

# Prerequisite verification
command -v python3 >/dev/null 2>&1 || { echo "[!] Python 3 is required but not installed. Aborting."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "[!] Node.js is required but not installed. Aborting."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "[!] npm is required but not installed. Aborting."; exit 1; }

# Step 1: Verify & Install Python Dependencies
echo "[*] Checking Python backend dependencies..."
if ! python3 -c "import fastapi, uvicorn, sqlalchemy, pydantic" >/dev/null 2>&1; then
    echo "[!] Missing Python dependencies. Installing via pip..."
    python3 -m pip install -r "$PROJECT_ROOT/backend/requirements.txt"
    echo "[✓] Python dependencies installed."
else
    echo "[✓] Python backend dependencies verified."
fi

# Step 2: Verify & Install Frontend Dependencies
if [ ! -d "$PROJECT_ROOT/frontend/node_modules" ]; then
    echo "[!] node_modules not found. Running npm install in frontend..."
    cd "$PROJECT_ROOT/frontend"
    npm install
    cd "$PROJECT_ROOT"
    echo "[✓] Frontend npm packages installed."
else
    echo "[✓] Frontend dependencies verified."
fi

# Step 3: Initialize and Seed Database
echo "[*] Initializing Database & Seeding Trains/Coaches..."
python3 "$PROJECT_ROOT/backend/app/database/seed.py"

# Function to clean up background processes on script exit
cleanup() {
    echo ""
    echo "[!] Stopping all running servers..."
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Step 4: Start Backend (FastAPI via Uvicorn on 0.0.0.0 so LAN access works)
echo "[*] Starting FastAPI Backend on http://0.0.0.0:8000..."
python3 -m uvicorn app.main:app --app-dir "$PROJECT_ROOT/backend" --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

sleep 2

# Step 5: Start Frontend (Next.js on 0.0.0.0)
echo "[*] Starting Next.js Frontend on http://0.0.0.0:3000..."
cd "$PROJECT_ROOT/frontend"
npm run dev -- -H 0.0.0.0 -p 3000 &
FRONTEND_PID=$!

echo ""
echo "================================================================="
echo "   SYSTEM SUCCESSFULLY LAUNCHED!                                "
echo "   - Frontend UI:      http://localhost:3000                     "
echo "   - Backend API Docs: http://localhost:8000/docs                "
echo "   - DSA Diagnostics:  http://localhost:8000/api/v1/metrics/dsa  "
echo "================================================================="
echo "Press Ctrl+C to terminate both servers."

wait
    