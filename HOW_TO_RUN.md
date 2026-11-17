# Complete Operational Guide: How to Run & Test RailDSA Engine

This guide provides end-to-end instructions for running and evaluating the **Railway Reservation System with Waiting-List Management & Custom DSA** across all platforms (Windows, Linux, macOS, Wi-Fi LAN, and Docker).

---

## 1. System Requirements

Ensure you have either:
* **Native Setup:**
  - **Python 3.10+** (with `pip` in PATH)
  - **Node.js 18+** (with `npm` in PATH)
* **OR Docker Setup:**
  - **Docker Desktop** (or Docker Engine + Docker Compose)

---

## 2. Launch Options

### Option 1: Windows One-Click Double-Click (Recommended for Windows)
Simply double-click the **`run.bat`** file in File Explorer.
> **What it does automatically:**
> 1. Verifies Python and Node.js.
> 2. Auto-installs Python packages from `backend/requirements.txt` if missing.
> 3. Auto-runs `npm install` in `frontend/` if `node_modules` is missing.
> 4. Auto-cleans any leftover processes holding port `8000` or `3000`.
> 5. Resets and seeds the database with the 2 showcase trains (`12301` Rajdhani and `22301` Vande Bharat).
> 6. Starts the FastAPI backend (`0.0.0.0:8000`) and Next.js frontend (`0.0.0.0:3000`).

---

### Option 2: Windows PowerShell
Open PowerShell in the project directory (`d:\clg_project`):
```powershell
.\run.ps1
```

---

### Option 3: Wi-Fi / Local Area Network (LAN) Host (Access from Phone or Other Laptop)
To demo or test from your smartphone, tablet, or a friend's laptop connected to the same Wi-Fi/Hotspot:
```bash
python serve_lan.py
```

The script will automatically detect your primary Wi-Fi IPv4 address (e.g., `192.168.0.106`) and display:
```
========================================================================
   LAN WEB APPLICATION IS NOW LIVE ACROSS YOUR NETWORK!
========================================================================
   [Mobile] Wi-Fi / LAN URL:      http://192.168.0.106:3000
   [Laptop] Local Machine URL:    http://localhost:3000
   [API]    Backend Docs:         http://192.168.0.106:8000/docs
   [DSA]    DSA Diagnostics:      http://192.168.0.106:8000/api/v1/metrics/dsa
========================================================================
```
*Open `http://<YOUR_IP>:3000` on any mobile browser or laptop connected to the same network.*

---

### Option 4: Linux / macOS / WSL
Open your terminal in the project directory:
```bash
chmod +x run.sh
./run.sh
```

---

### Option 5: Docker Containerization

#### A. Microservices via Docker Compose (Recommended)
```bash
docker compose up --build
```
*Spins up two isolated containers:*
- `raildsa-backend`: FastAPI on port 8000 with persistent SQLite volume.
- `raildsa-frontend`: Next.js 16 on port 3000.

#### B. Single Unified Container
```bash
# Build the unified image
docker build -t raildsa .

# Run the container
docker run -p 3000:3000 -p 8000:8000 raildsa
```

---

## 3. Web Application URLs & Ports

| Component | Local URL | LAN / Remote URL | Description |
| :--- | :--- | :--- | :--- |
| **Frontend Web UI** | [http://localhost:3000](http://localhost:3000) | `http://<LAN_IP>:3000` | Full interactive Next.js booking portal. |
| **FastAPI Interactive Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | `http://<LAN_IP>:8000/docs` | Swagger UI for all backend REST endpoints. |
| **DSA Diagnostics & Metrics** | [http://localhost:8000/api/v1/metrics/dsa](http://localhost:8000/api/v1/metrics/dsa) | `http://<LAN_IP>:8000/api/v1/metrics/dsa` | Real-time JSON telemetry of custom data structures. |

---

## 4. Step-by-Step Feature Testing Checklist

### Test 1: Train Search & Filtering
1. Open [http://localhost:3000](http://localhost:3000).
2. Note the **2 showcase trains** on the left column:
   - `12301` Howrah – New Delhi Rajdhani Express
   - `22301` Howrah – New Jalpaiguri Vande Bharat Express
3. Use the **From Origin** and **To Destination** filters or click the **Swap** button.
4. Filter by train name or number in the search bar.

### Test 2: Berth Selection & Quota Rules
1. Select **12301 Howrah – New Delhi Rajdhani Express**.
2. Select scheduled date (e.g., today's date).
3. Toggle between travel classes (`2AC`, `3AC`, `SL`):
   - Notice the live berth grid updates to show Coach `A1` (2AC), `B1` (3AC), or `S1` (SL).
4. Test Quota tabs:
   - **General (GN):** Standard First-Come-First-Served inventory.
   - **Senior Citizen (SS):** Validated for male age $\ge 60$ / female age $\ge 58$. Prioritizes lower berths and enters Priority 1 Min-Heap if full.
   - **Ladies Quota (LD):** Validated for female passengers. Enters Priority 2 Min-Heap if full.
   - **Tatkal (TQ):** Short-notice booking with statutory backend surcharge calculation.

### Test 3: Passenger Validation & 2-Phase Seat Hold (5 Min TTL)
1. In **Passenger Details**, enter:
   - First Name: `Sourav`
   - Middle Name: `Chandidas`
   - Last Name: `Ganguly`
   - Age: Enter an age (must be between 1 and 100; unreal numbers $> 100$ are rejected by backend validation).
   - Gender & Berth Preference.
2. Click **Proceed to Seat Hold (5 Min TTL)**:
   - An atomic mutex lock claims the berth in memory.
   - The selected berth turns amber (`HELD`) on the live coach grid.
   - A 5-minute countdown timer starts.
   - A unique 10-digit PNR is generated with a **Copy PNR** button.

### Test 4: Payment Simulation & Bloom Filter Indexing
1. Click **Simulate Successful Payment**:
   - The berth changes to blue (`CONFIRMED`).
   - The PNR is inserted into the **Custom Polynomial Rolling Hash Table**.
   - The PNR is hashed across $k=6$ independent bit indices in the **Probabilistic Bloom Filter**.
2. Alternatively, test **Simulate Failure**:
   - The held berth is instantly released back to `AVAILABLE` for other passengers.

### Test 5: PNR Status & Bloom Filter Fast-Rejection ($O(k)$)
1. Click the **PNR Status** tab in the navigation bar.
2. Paste the confirmed PNR and click **Lookup PNR**:
   - Bloom filter indicates `PASSED (Positive)`.
   - Hash table performs an $O(1)$ lookup and returns passenger details.
3. Test Fast-Rejection: Enter an invalid PNR like `9999999999`:
   - Bloom filter immediately rejects the query in $O(k)$ time without touching the database or hash table.

### Test 6: Reservation Chart & Stable Merge Sort ($O(N \log N)$)
1. Click the **Reservation Chart** tab.
2. Select any train run from the dropdown.
3. Observe all allocated and vacant berths stably sorted in $O(N \log N)$ time:
   - Sorted strictly by: **Coach Code ASC** $\to$ **Berth Number ASC**.
   - Use the in-chart filter bar to instantly filter by coach, passenger name, or quota.

### Test 7: Custom DSA Structural Diagnostics
1. Click the **DSA Diagnostics** tab.
2. View live metrics:
   - **Custom Hash Table:** Total elements, bucket capacity, load factor ($\alpha$), and collision count.
   - **Bloom Filter:** Bit array size ($m=95{,}850$), hash count ($k=6$), bits set, and theoretical false-positive probability.

### Test 8: Admin Fleet Portal
1. Click the **Admin** tab.
2. View all currently deployed trains with one-click **Delete** capabilities.
3. Register a new custom train with coach configurations and watch it appear dynamically in search without restarting the server.

---

## 5. Troubleshooting Checklist

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **`listen EADDRINUSE: 3000` or `8000`** | A previous server instance didn't close properly | Relaunch using `run.bat`, `.\run.ps1`, or `python serve_lan.py`. All launchers now automatically find and kill previous processes holding those ports. |
| **`Blocked cross-origin request /_next/hmr`** | Next.js 16 blocking external LAN WebSocket | Already fixed in `frontend/next.config.ts` via `allowedDevOrigins` which permits `192.168.*.*`, `10.*.*.*`, and `172.*.*.*`. |
| **Phone shows "Site cannot be reached"** | Windows Defender Firewall blocking port 3000/8000 | In Windows Security, allow Node and Python through Private Networks, or run in PowerShell (Admin): `New-NetFirewallRule -DisplayName "RailDSA" -Direction Inbound -LocalPort 3000,8000 -Protocol TCP -Action Allow`. |
| **`UnicodeEncodeError` in Windows terminal** | Default Windows console codepage `cp1252` | Already fixed: `seed.py` and launchers use standard ASCII `[OK]` and enforce `PYTHONIOENCODING=utf-8`. |
| **Missing packages on a friend's PC** | First-time clone without installed dependencies | Launch via `run.bat` or `.\run.ps1` — they automatically run `pip install` and `npm install` on first launch. |

---

## 6. Running Automated Test Suites

```bash
# Run all 23 backend tests (DSA validation, concurrency locks, quota rules, and API)
cd backend
python -m pytest

# Run frontend Next.js production build verification
cd frontend
npm run build
```
