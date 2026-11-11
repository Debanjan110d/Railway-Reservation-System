# ==============================================================================
# Railway Reservation System with Custom DSA & Waiting-List Engine
# Single-Command Windows Launcher for Backend (FastAPI) and Frontend (Next.js)
# ==============================================================================

param(
    [switch]$NoLog = $false
)

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

$LogDir = Join-Path $ProjectRoot "logs"
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
}
$ErrorLog = Join-Path $LogDir "error.log"

function Log-ErrorMsg {
    param([string]$Message)
    $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $entry = "[$ts] [ERROR] [Launcher]: $Message"
    Write-Host $entry -ForegroundColor Red
    if (-not $NoLog) {
        $entry | Out-File -Append -FilePath $ErrorLog -Encoding utf8
    }
}

function Log-InfoMsg {
    param([string]$Message)
    $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $entry = "[$ts] [INFO] [Launcher]: $Message"
    if (-not $NoLog) {
        $entry | Out-File -Append -FilePath $ErrorLog -Encoding utf8
    }
}

Log-InfoMsg "Launcher initialized. Preparing to start Railway Reservation System."

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   RAILWAY RESERVATION SYSTEM (ACADEMIC DSA ENGINE)              " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

$env:PYTHONPATH = "$ProjectRoot\backend"

# Step 1: Initialize Database & Seed
Write-Host "[*] Step 1: Initializing Database & Seeding Trains..." -ForegroundColor Yellow
try {
    python "$ProjectRoot\backend\app\database\seed.py"
} catch {
    Log-ErrorMsg "Database initialization or seeding failed: $_"
}

# Step 2: Start Backend
Write-Host "[*] Step 2: Starting FastAPI Backend on http://127.0.0.1:8000..." -ForegroundColor Green
try {
    $BackendProcess = Start-Process python -ArgumentList "-m uvicorn app.main:app --app-dir `"$ProjectRoot\backend`" --host 127.0.0.1 --port 8000" -PassThru -NoNewWindow
    Log-InfoMsg "FastAPI Backend started with PID $($BackendProcess.Id)."
} catch {
    Log-ErrorMsg "Failed to start FastAPI Backend: $_"
}

Start-Sleep -Seconds 2

# Step 3: Start Frontend (using cmd.exe /c to properly invoke npm.cmd on Windows)
Write-Host "[*] Step 3: Starting Next.js Frontend on http://localhost:3000..." -ForegroundColor Green
try {
    Set-Location "$ProjectRoot\frontend"
    $FrontendProcess = Start-Process "cmd.exe" -ArgumentList "/c npm run dev -- -p 3000" -PassThru -NoNewWindow
    Set-Location $ProjectRoot
    Log-InfoMsg "Next.js Frontend started with PID $($FrontendProcess.Id)."
} catch {
    Set-Location $ProjectRoot
    Log-ErrorMsg "Failed to start Next.js Frontend: $_"
}

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   SYSTEM SUCCESSFULLY LAUNCHED!                                " -ForegroundColor Green
Write-Host "   - Frontend UI:      http://localhost:3000                     " -ForegroundColor White
Write-Host "   - Backend API Docs: http://127.0.0.1:8000/docs                " -ForegroundColor White
Write-Host "   - DSA Diagnostics:  http://127.0.0.1:8000/api/v1/metrics/dsa  " -ForegroundColor White
Write-Host "   - Error Log File:   $ErrorLog                                 " -ForegroundColor Yellow
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop both processes."

try {
    $watchPids = @()
    if ($BackendProcess -and $BackendProcess.Id -gt 0) { $watchPids += $BackendProcess.Id }
    if ($FrontendProcess -and $FrontendProcess.Id -gt 0) { $watchPids += $FrontendProcess.Id }
    if ($watchPids.Count -gt 0) {
        Wait-Process -Id $watchPids
    }
} catch {
    Log-ErrorMsg "Error during process monitoring: $_"
} finally {
    Write-Host "`nStopping server processes..." -ForegroundColor Yellow
    Log-InfoMsg "Stopping server processes."
    if ($BackendProcess -and $BackendProcess.Id -gt 0) {
        Stop-Process -Id $BackendProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if ($FrontendProcess -and $FrontendProcess.Id -gt 0) {
        Stop-Process -Id $FrontendProcess.Id -Force -ErrorAction SilentlyContinue
    }
}
