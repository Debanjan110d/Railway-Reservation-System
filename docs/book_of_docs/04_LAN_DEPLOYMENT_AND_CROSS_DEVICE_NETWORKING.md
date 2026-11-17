# Chapter 4: Local Area Network (LAN), Portability & Docker Engineering

---

## 1. Motivation & College Viva Demonstration Value

For academic evaluators, university project exhibitions, and viva examinations, demonstrating an application solely on `localhost:3000` is often insufficient. Evaluators look for proof that:
1. The web application is truly multi-tiered and accessible from external devices (e.g., an examiner accessing the booking portal on their smartphone while an admin monitors the reservation chart on a laptop).
2. The system handles concurrent requests from multiple distinct network nodes simultaneously.
3. Network boundaries, IP routing, Cross-Origin Resource Sharing (CORS), and containerization are properly configured.

---

## 2. The "Loopback Network Trap" & Solution

### The Core Problem
When running full-stack applications in development, the frontend client typically communicates with the backend via `http://localhost:8000` or `http://127.0.0.1:8000`.

When an external device on the local Wi-Fi (such as an Android or iOS smartphone at `192.168.0.150`) navigates to the host machine's IP (`http://192.168.0.106:3000`):
- Next.js downloads React components to the mobile browser.
- When the user clicks "Book Ticket", the mobile browser executes JavaScript:
  ```typescript
  // NAIVE IMPLEMENTATION: FAILS ON MOBILE DEVICES!
  fetch("http://127.0.0.1:8000/api/v1/bookings/hold");
  ```
- Because `127.0.0.1` refers to the **mobile phone's own loopback address**, the mobile device attempts to find a FastAPI server running on the phone itself.
- **Result:** Immediate network failure: `net::ERR_CONNECTION_REFUSED`.

---

### The Engineering Solution

#### 1. Dynamic Client-Side Hostname Resolution (`frontend/src/lib/api.ts`)
We engineer an automated client-side fallback that detects the current browser origin:

```typescript
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined"
    ? `http://${window.location.hostname}:8000/api/v1`
    : "http://127.0.0.1:8000/api/v1");
```

- When accessed from the host machine: `window.location.hostname` is `localhost` $\implies$ API points to `http://localhost:8000/api/v1`.
- When accessed from an iPhone/Android device: `window.location.hostname` is `192.168.0.106` $\implies$ API automatically routes to `http://192.168.0.106:8000/api/v1` without manual configuration.

---

#### 2. Next.js 16 Cross-Origin Resource Safeguards (`allowedDevOrigins`)
In Next.js 16, dev-server HMR (Hot Module Replacement) WebSocket connections from LAN origins are blocked by default for security, resulting in:
`⚠ Blocked cross-origin request to Next.js dev resource /_next/hmr from "192.168.0.106"`

We configure `frontend/next.config.ts` to query local network interfaces dynamically using Node's `os.networkInterfaces()` and permit private IP subnets (`192.168.*.*`, `10.*.*.*`, `172.*.*.*`):

```typescript
const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: getAllowedDevOrigins(), // Permits LAN clients without warnings
  turbopack: { ... },
};
```

---

#### 3. Automatic Port Collision Protection (`free_port_if_occupied`)
To avoid `EADDRINUSE` crashes when relaunching after unexpected script termination, `serve_lan.py` and `run.ps1` detect and free ports 8000 and 3000 automatically before binding Uvicorn and Next.js.

---

## 3. How to Launch and Test Across LAN Devices

### Option A: Automated LAN Runner
```bash
python serve_lan.py
```
*Auto-detects active LAN IPv4, verifies dependencies, seeds 2 simplified Kolkata trains, and prints mobile and PC access URLs.*

### Option B: Windows PowerShell Script
```powershell
.\run.ps1
```

### Option C: Windows Double-Click Launcher
Double-click `run.bat` in File Explorer.

---

## 4. Docker & Containerized Deployment

For evaluation panels requiring containerized demonstration, RailDSA provides two deployment approaches:

### Approach 1: Microservice Orchestration with `docker-compose`
Spins up separate backend and frontend containers with volume persistence:

```bash
docker compose up --build
```

- **Frontend Container:** Port `3000:3000` (Node 20 Alpine)
- **Backend Container:** Port `8000:8000` (Python 3.11 Slim with SQLite persistence)

### Approach 2: Unified All-in-One Docker Image
Builds a single self-contained container running both services:

```bash
# Build the unified image
docker build -t raildsa .

# Run the container
docker run -p 3000:3000 -p 8000:8000 raildsa
```

Access the UI at [http://localhost:3000](http://localhost:3000) and API docs at [http://localhost:8000/docs](http://localhost:8000/docs).

---

## 5. Firewall & Troubleshooting Checklist

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| Mobile phone shows "Site unreachable" | Windows Defender Firewall blocking port 3000/8000 | In Windows Security, allow Node.js and Python through Private Networks, or run: `New-NetFirewallRule -DisplayName "RailDSA" -Direction Inbound -LocalPort 3000,8000 -Protocol TCP -Action Allow` in admin PowerShell. |
| Host shows page, but buttons fail | Mobile cannot reach backend on port 8000 | Check that both `0.0.0.0:8000` and `0.0.0.0:3000` are bound and not blocked by router client-isolation. |
| Mobile Hotspot isolation | Some public/college Wi-Fi networks block device-to-device traffic | Use a personal mobile hotspot where all devices are on the same subnet without AP client isolation. |
| `EADDRINUSE: 3000` | Previous Next.js process still alive | Relaunch using `run.bat` or `python serve_lan.py` (which includes automated port cleanup). |
