# ==============================================================================
# Railway Reservation System with Custom DSA & Waiting-List Engine
# Universal Auto-Install & Launcher for Windows (FastAPI Backend + Next.js Frontend)
# ==============================================================================

param(
    [switch]$NoLog = $false,
    [switch]$SkipInstall = $false
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
        try {
            $entry | Out-File -Append -FilePath $ErrorLog -Encoding utf8
        } catch {}
    }
}

function Log-InfoMsg {
    param([string]$Message)
    $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $entry = "[$ts] [INFO] [Launcher]: $Message"
    if (-not $NoLog) {
        try {
            $entry | Out-File -Append -FilePath $ErrorLog -Encoding utf8
        } catch {}
    }
}

Log-InfoMsg "Launcher initialized. Preparing to start Railway Reservation System."

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   RAILWAY RESERVATION SYSTEM (ACADEMIC DSA ENGINE)              " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# -----------------------------------------------------------------------------
# Prerequisite Verification: Python & Node.js
# -----------------------------------------------------------------------------
$PythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $PythonCmd) {
    Log-ErrorMsg "Python is not installed or not in system PATH. Please install Python 3.10+ from https://python.org."
    exit 1
}

$NodeCmd = Get-Command node -ErrorAction SilentlyContinue
$NpmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $NodeCmd -or -not $NpmCmd) {
    Log-ErrorMsg "Node.js / npm is not installed or not in system PATH. Please install Node.js from https://nodejs.org."
    exit 1
}

# -----------------------------------------------------------------------------
# Step 1: Auto-Install Backend Python Dependencies (if missing)
# -----------------------------------------------------------------------------
if (-not $SkipInstall) {
    Write-Host "[*] Checking Python backend dependencies..." -ForegroundColor Yellow
    $NeedPipInstall = $false
    try {
        $check = python -c "import fastapi, uvicorn, sqlalchemy, pydantic" 2>&1
        if ($LASTEXITCODE -ne 0) {
            $NeedPipInstall = $true
        }
    } catch {
        $NeedPipInstall = $true
    }

    if ($NeedPipInstall) {
        Write-Host "[!] Missing Python dependencies. Running pip install -r backend/requirements.txt..." -ForegroundColor Yellow
        Log-InfoMsg "Installing backend dependencies via pip..."
        try {
            python -m pip install --upgrade pip --quiet
            python -m pip install -r "$ProjectRoot\backend\requirements.txt"
            Write-Host "[✓] Python dependencies installed successfully." -ForegroundColor Green
        } catch {
            Log-ErrorMsg "pip install failed: $_"
        }
    } else {
        Write-Host "[✓] Python backend dependencies verified." -ForegroundColor Green
    }

    # -----------------------------------------------------------------------------
    # Step 2: Auto-Install Frontend npm Dependencies (if missing)
    # -----------------------------------------------------------------------------
    $NodeModulesPath = Join-Path $ProjectRoot "frontend\node_modules"
    if (-not (Test-Path $NodeModulesPath)) {
        Write-Host "[!] node_modules not found in frontend. Running npm install (first-time setup)..." -ForegroundColor Yellow
        Log-InfoMsg "Running npm install in frontend directory..."
        try {
            Set-Location "$ProjectRoot\frontend"
            cmd.exe /c "npm install"
            Set-Location $ProjectRoot
            Write-Host "[✓] Frontend npm packages installed successfully." -ForegroundColor Green
        } catch {
            Set-Location $ProjectRoot
            Log-ErrorMsg "npm install failed: $_"
        }
    } else {
        Write-Host "[✓] Frontend node_modules verified." -ForegroundColor Green
    }
}

$env:PYTHONPATH = "$ProjectRoot\backend"

# -----------------------------------------------------------------------------
# Step 3: Initialize Database & Seed Trains
# -----------------------------------------------------------------------------
Write-Host "[*] Initializing Database & Seeding Trains..." -ForegroundColor Yellow
try {
    python "$ProjectRoot\backend\app\database\seed.py"
} catch {
    Log-ErrorMsg "Database initialization or seeding failed: $_"
}

# -----------------------------------------------------------------------------
# Pre-launch: Free ports 8000 and 3000 if occupied
# -----------------------------------------------------------------------------
function Stop-PortOccupant {
    param([int]$Port)
    try {
        $conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        foreach ($conn in $conns) {
            $pId = $conn.OwningProcess
            if ($pId -and $pId -ne $PID -and $pId -ne 0) {
                Write-Host "[*] Port $Port is in use by PID $pId. Releasing port..." -ForegroundColor Yellow
                Stop-Process -Id $pId -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {}
}
Stop-PortOccupant -Port 8000
Stop-PortOccupant -Port 3000

# -----------------------------------------------------------------------------
# Step 4: Start FastAPI Backend on 0.0.0.0:8000
# -----------------------------------------------------------------------------
Write-Host "[*] Starting FastAPI Backend on http://0.0.0.0:8000..." -ForegroundColor Green
try {
    $BackendProcess = Start-Process python -ArgumentList "-m uvicorn app.main:app --app-dir `"$ProjectRoot\backend`" --host 0.0.0.0 --port 8000" -PassThru -NoNewWindow
    Log-InfoMsg "FastAPI Backend started with PID $($BackendProcess.Id)."
} catch {
    Log-ErrorMsg "Failed to start FastAPI Backend: $_"
}

Start-Sleep -Seconds 2

# -----------------------------------------------------------------------------
# Step 5: Start Next.js Frontend on http://0.0.0.0:3000
# -----------------------------------------------------------------------------
Write-Host "[*] Starting Next.js Frontend on http://0.0.0.0:3000..." -ForegroundColor Green
try {
    Set-Location "$ProjectRoot\frontend"
    $FrontendProcess = Start-Process "cmd.exe" -ArgumentList "/c npm run dev -- -H 0.0.0.0 -p 3000" -PassThru -NoNewWindow
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
Write-Host "   - Dedicated Log:    $ErrorLog                                 " -ForegroundColor Yellow
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop both processes cleanly."

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
