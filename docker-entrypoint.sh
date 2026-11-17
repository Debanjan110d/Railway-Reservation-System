#!/bin/sh
set -e

echo "================================================================="
echo "   RAILWAY RESERVATION SYSTEM (ACADEMIC DSA ENGINE) - DOCKER     "
echo "================================================================="

# Seed Database
echo "[*] Initializing Database & Seeding Trains..."
cd /app/backend
python -m app.database.seed

# Start FastAPI backend in background
echo "[*] Starting FastAPI Backend on http://0.0.0.0:8000..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait for backend to be ready
sleep 2

# Start Next.js frontend in background
echo "[*] Starting Next.js Frontend on http://0.0.0.0:3000..."
cd /app/frontend
npm start -- -H 0.0.0.0 -p 3000 &
FRONTEND_PID=$!

echo "================================================================="
echo "   CONTAINER RUNNING SUCCESSFULLY!                               "
echo "   - Web UI:           http://localhost:3000                     "
echo "   - API Docs:         http://localhost:8000/docs                "
echo "   - DSA Diagnostics:  http://localhost:8000/api/v1/metrics/dsa  "
echo "================================================================="

# Trap termination signals
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM

wait -n
