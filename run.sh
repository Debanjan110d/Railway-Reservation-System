#!/usr/bin/env bash

# ==============================================================================
# Railway Reservation System with Custom DSA & Waiting-List Engine
# Single-Command Launcher for Backend (FastAPI) and Frontend (Next.js)
# ==============================================================================

set -e

# Change directory to project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "================================================================="
echo "   RAILWAY RESERVATION SYSTEM (ACADEMIC DSA ENGINE)              "
echo "================================================================="

# Set Python Path for backend modules
export PYTHONPATH="$PROJECT_ROOT/backend"

# Step 1: Initialize and Seed SQLite Database
echo "[*] Step 1: Initializing Database & Seed Trains/Coaches..."
python "$PROJECT_ROOT/backend/app/database/seed.py"

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

# Step 2: Start Backend (FastAPI via Uvicorn)
echo "[*] Step 2: Starting FastAPI Backend on http://127.0.0.1:8000..."
python -m uvicorn app.main:app --app-dir "$PROJECT_ROOT/backend" --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# Wait briefly for backend to bind
sleep 2

# Step 3: Start Frontend (Next.js)
echo "[*] Step 3: Starting Next.js Frontend on http://localhost:3000..."
cd "$PROJECT_ROOT/frontend"
npm run dev -- -p 3000 &
FRONTEND_PID=$!

echo ""
echo "================================================================="
echo "   SYSTEM SUCCESSFULLY LAUNCHED!                                "
echo "   - Frontend UI:      http://localhost:3000                     "
echo "   - Backend API Docs: http://127.0.0.1:8000/docs                "
echo "   - DSA Diagnostics:  http://127.0.0.1:8000/api/v1/metrics/dsa  "
echo "================================================================="
echo "Press Ctrl+C to terminate both servers."

# Keep script running to wait for process signals
wait

