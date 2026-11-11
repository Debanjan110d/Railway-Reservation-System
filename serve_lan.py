#!/usr/bin/env python3
"""
Railway Reservation System - Local Area Network (LAN) Server Runner
Enables access from any device (smartphones, tablets, PCs) connected to the same Wi-Fi/LAN.
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
    print("-" * 72)
    print(f"   Connect your smartphone/laptop to the same Wi-Fi network,")
    print(f"   open your browser and navigate to: http://{lan_ip}:{port_frontend}")
    print("=" * 72)
    print("Press CTRL+C anytime to cleanly stop all servers.\n")

    def shutdown(sig, frame):
        print("\n[*] Shutting down LAN servers...")
        try:
            backend_proc.terminate()
        except Exception:
            pass
        try:
            frontend_proc.terminate()
        except Exception:
            pass
        print("[✓] All processes stopped. Goodbye!")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Stream logs to stdout and file
    with open(LOG_FILE, "a", encoding="utf-8") as log_out:
        log_out.write(f"\n--- LAN Server started on {lan_ip} at {time.ctime()} ---\n")
        while True:
            # Check if any process exited unexpectedly
            b_code = backend_proc.poll()
            f_code = frontend_proc.poll()

            if b_code is not None:
                err_msg = f"[!] Backend process exited with code {b_code}"
                print(err_msg)
                with open(ERR_FILE, "a", encoding="utf-8") as err_f:
                    err_f.write(f"{time.ctime()}: {err_msg}\n")
                shutdown(None, None)

            if f_code is not None:
                err_msg = f"[!] Frontend process exited with code {f_code}"
                print(err_msg)
                with open(ERR_FILE, "a", encoding="utf-8") as err_f:
                    err_f.write(f"{time.ctime()}: {err_msg}\n")
                shutdown(None, None)

            time.sleep(1)

if __name__ == "__main__":
    main()
