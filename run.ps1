# ==============================================================================
# Railway Reservation System with Custom DSA & Waiting-List Engine
# Single-Command Windows Launcher for Backend (FastAPI) and Frontend (Next.js)
# ==============================================================================

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   RAILWAY RESERVATION SYSTEM (ACADEMIC DSA ENGINE)              " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

$env:PYTHONPATH = "$ProjectRoot\backend"

# Step 1: Initialize Database & Seed
Write-Host "[*] Step 1: Initializing Database & Seeding Trains..." -ForegroundColor Yellow
python "$ProjectRoot\backend\app\database\seed.py"

# Step 2: Start Backend
Write-Host "[*] Step 2: Starting FastAPI Backend on http://127.0.0.1:8000..." -ForegroundColor Green
$BackendProcess = Start-Process python -ArgumentList "-m uvicorn app.main:app --app-dir `"$ProjectRoot\backend`" --host 127.0.0.1 --port 8000" -PassThru -NoNewWindow

Start-Sleep -Seconds 2

# Step 3: Start Frontend (using cmd.exe /c to properly invoke npm.cmd on Windows)
Write-Host "[*] Step 3: Starting Next.js Frontend on http://localhost:3000..." -ForegroundColor Green
Set-Location "$ProjectRoot\frontend"
$FrontendProcess = Start-Process "cmd.exe" -ArgumentList "/c npm run dev -- -p 3000" -PassThru -NoNewWindow
Set-Location $ProjectRoot

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   SYSTEM SUCCESSFULLY LAUNCHED!                                " -ForegroundColor Green
Write-Host "   - Frontend UI:      http://localhost:3000                     " -ForegroundColor White
Write-Host "   - Backend API Docs: http://127.0.0.1:8000/docs                " -ForegroundColor White
Write-Host "   - DSA Diagnostics:  http://127.0.0.1:8000/api/v1/metrics/dsa  " -ForegroundColor White
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop both processes."

try {
    $watchPids = @()
    if ($BackendProcess -and $BackendProcess.Id -gt 0) { $watchPids += $BackendProcess.Id }
    if ($FrontendProcess -and $FrontendProcess.Id -gt 0) { $watchPids += $FrontendProcess.Id }
    if ($watchPids.Count -gt 0) {
        Wait-Process -Id $watchPids
    }
} finally {
    Write-Host "`nStopping server processes..." -ForegroundColor Yellow
    if ($BackendProcess -and $BackendProcess.Id -gt 0) {
        Stop-Process -Id $BackendProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if ($FrontendProcess -and $FrontendProcess.Id -gt 0) {
        Stop-Process -Id $FrontendProcess.Id -Force -ErrorAction SilentlyContinue
    }
}
