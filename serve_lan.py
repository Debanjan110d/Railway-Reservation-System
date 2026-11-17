#!/usr/bin/env python3
"""
Railway Reservation System - Local Area Network (LAN) Server Runner
Enables access from any device (smartphones, tablets, PCs) connected to the same Wi-Fi/LAN.
Includes auto-dependency verification and setup for fresh laptops.
"""

import os
import sys
import socket
import subprocess
import signal
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR / "backend"
FRONTEND_DIR = BASE_DIR / "frontend"
LOGS_DIR = BASE_DIR / "logs"
LOGS_DIR.mkdir(exist_ok=True)
LOG_FILE = LOGS_DIR / "lan_server.log"
ERR_FILE = LOGS_DIR / "error.log"

def get_lan_ip() -> str:
    """Detect the active primary LAN IPv4 address."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Does not send actual traffic, just resolves outbound route
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip

def ensure_dependencies():
    """Verify and auto-install Python and Node dependencies if running on a fresh laptop."""
    print("[*] Verifying Python backend dependencies...")
    try:
        import fastapi
        import uvicorn
        import sqlalchemy
        import pydantic
        print("[✓] Python backend dependencies verified.")
    except ImportError:
        print("[!] Missing Python packages. Installing from backend/requirements.txt...")
        req_file = BACKEND_DIR / "requirements.txt"
        cmd = [sys.executable, "-m", "pip", "install", "-r", str(req_file)]
        subprocess.run(cmd, check=True)
        print("[✓] Backend dependencies installed successfully.")

    print("[*] Verifying Frontend node_modules...")
    node_modules = FRONTEND_DIR / "node_modules"
    if not node_modules.exists():
        print("[!] node_modules not found in frontend. Running npm install (first-time setup)...")
        npm_bin = "npm.cmd" if sys.platform == "win32" else "npm"
        cmd = [npm_bin, "install"]
        subprocess.run(cmd, cwd=str(FRONTEND_DIR), check=True, shell=(sys.platform == "win32"))
        print("[✓] Frontend npm packages installed successfully.")
    else:
        print("[✓] Frontend node_modules verified.")

def seed_database_if_needed():
    """Ensure database has initial seed data."""
    print("[*] Checking database and seeding trains...")
    try:
        cmd = [sys.executable, "-m", "app.database.seed"]
        res = subprocess.run(cmd, cwd=str(BACKEND_DIR), capture_output=True, text=True)
        if res.returncode == 0:
            print("[✓] Database check complete.")
        else:
            print(f"[!] Seed warning: {res.stderr.strip() or res.stdout.strip()}")
    except Exception as e:
        print(f"[!] Could not run seed script: {e}")

def main():
    lan_ip = get_lan_ip()
    port_frontend = 3000
    port_backend = 8000

    print("=" * 72)
    print("      RAILWAY RESERVATION SYSTEM (ACADEMIC DSA ENGINE) - LAN HOST")
    print("=" * 72)
    print(f"[*] Detected Primary LAN IPv4 Address: {lan_ip}")
    print()

    # Step 1: Auto-verify & install dependencies on fresh laptops
    ensure_dependencies()

    # Step 2: Seed DB
    seed_database_if_needed()

    # Pass dynamic LAN API URL to frontend so mobile browsers can communicate with backend
    env = os.environ.copy()
    env["NEXT_PUBLIC_API_URL"] = f"http://{lan_ip}:{port_backend}/api/v1"

    print(f"[*] Starting FastAPI Backend on 0.0.0.0:{port_backend}...")
    backend_cmd = [
        sys.executable, "-m", "uvicorn",
        "app.main:app",
        "--host", "0.0.0.0",
        "--port", str(port_backend)
    ]
    
    backend_proc = subprocess.Popen(
        backend_cmd,
        cwd=str(BACKEND_DIR),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )

    time.sleep(2)  # Give backend time to bind

    print(f"[*] Starting Next.js Frontend on 0.0.0.0:{port_frontend}...")
    # On Windows npm is npm.cmd
    npm_bin = "npm.cmd" if sys.platform == "win32" else "npm"
    frontend_cmd = [
        npm_bin, "run", "dev", "--",
        "-H", "0.0.0.0",
        "-p", str(port_frontend)
    ]

    frontend_proc = subprocess.Popen(
        frontend_cmd,
        cwd=str(FRONTEND_DIR),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )

    print()
    print("=" * 72)
    print("   LAN WEB APPLICATION IS NOW LIVE ACROSS YOUR NETWORK!")
    print("=" * 72)
    print(f"   [📱] Wi-Fi / LAN Mobile URL:   http://{lan_ip}:{port_frontend}")
    print(f"   [💻] Host Machine URL:        http://localhost:{port_frontend}")
    print(f"   [🔌] Backend API Docs:        http://{lan_ip}:{port_backend}/docs")
    print(f"   [📊] Custom DSA Diagnostics:  http://{lan_ip}:{port_backend}/api/v1/metrics/dsa")
    print("=" * 72)
    print("   Press Ctrl+C anytime to stop both servers.")
    print("=" * 72)

    def shutdown(sig, frame):
        print("\n[*] Gracefully shutting down LAN servers...")
        try:
            backend_proc.terminate()
            backend_proc.wait(timeout=3)
        except Exception:
            backend_proc.kill()
        try:
            frontend_proc.terminate()
            frontend_proc.wait(timeout=3)
        except Exception:
            frontend_proc.kill()
        print("[✓] All servers stopped cleanly.")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Monitor stdout and forward to console and log file
    with open(LOG_FILE, "a", encoding="utf-8") as log_f:
        try:
            while True:
                b_line = backend_proc.stdout.readline() if backend_proc.poll() is None else None
                f_line = frontend_proc.stdout.readline() if frontend_proc.poll() is None else None

                if b_line:
                    line = f"[Backend] {b_line.strip()}"
                    log_f.write(line + "\n")
                    log_f.flush()
                if f_line:
                    line = f"[Frontend] {f_line.strip()}"
                    log_f.write(line + "\n")
                    log_f.flush()

                if backend_proc.poll() is not None and frontend_proc.poll() is not None:
                    break
                time.sleep(0.05)
        except KeyboardInterrupt:
            shutdown(None, None)

if __name__ == "__main__":
    main()
