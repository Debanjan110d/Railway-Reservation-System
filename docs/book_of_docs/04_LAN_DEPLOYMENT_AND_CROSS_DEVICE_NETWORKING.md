# Chapter 4: Local Area Network (LAN) & Cross-Device Engineering

---

## 1. Motivation & College Viva Demonstration Value

For academic evaluators, university project exhibitions, and viva examinations, demonstrating an application solely on `localhost:3000` is often insufficient. Evaluators look for proof that:
1. The web application is truly multi-tiered and accessible from external devices (e.g., an examiner accessing the booking portal on their smartphone while an admin monitors the reservation chart on a laptop).
2. The system handles concurrent requests from multiple distinct network nodes simultaneously.
3. Network boundaries, IP routing, and Cross-Origin Resource Sharing (CORS) are properly configured.

---

## 2. The "Loopback Network Trap" & Solution

### The Core Problem
When running full-stack applications in development, the frontend client typically communicates with the backend via `http://localhost:8000` or `http://127.0.0.1:8000`.

When an external device on the local Wi-Fi (such as an Android or iOS smartphone at `192.168.0.150`) navigates to the host machine's IP (`http://192.168.0.107:3000`):
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
- When accessed from an iPhone/Android device: `window.location.hostname` is `192.168.0.107` $\implies$ API automatically routes to `http://192.168.0.107:8000/api/v1` without hardcoded configuration!

---

#### 2. Automated Python LAN Server Runner (`serve_lan.py`)
To make launching across the LAN completely seamless, we created `serve_lan.py` at the project root.

##### Dynamic Socket Route Discovery
Instead of parsing unreliable OS shell strings or hardcoding subnets, the script probes the kernel's routing table:

```python
def get_lan_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Connecting to public DNS resolves the active outbound network interface
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip
```

##### Coordinated Dual-Process Host Binding
`serve_lan.py` binds both servers to `0.0.0.0` (all available interfaces):
- **FastAPI Backend:** `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000`
- **Next.js Frontend:** `npm run dev -- -H 0.0.0.0 -p 3000`

---

## 3. How to Launch and Test Across LAN Devices

### Step 1: Ensure Host & Devices Share the Same Wi-Fi Network
Connect your development machine (laptop/desktop) and test devices (smartphones, tablets, other laptops) to the same local Wi-Fi network or mobile hotspot.

### Step 2: Run the LAN Runner Script
Open PowerShell or terminal in the project directory:

```bash
python serve_lan.py
```

### Step 3: Terminal Output Display
The launcher detects the primary LAN IP and prints an interactive ASCII operational card:

```
========================================================================
      RAILWAY RESERVATION SYSTEM (ACADEMIC DSA ENGINE) - LAN HOST
========================================================================
[*] Detected Primary LAN IPv4 Address: 192.168.0.107
[*] Checking database and seeding trains...
[✓] Database check complete.
[*] Starting FastAPI Backend on 0.0.0.0:8000...
[*] Starting Next.js Frontend on 0.0.0.0:3000...

========================================================================
   LAN WEB APPLICATION IS NOW LIVE ACROSS YOUR NETWORK!
========================================================================
   [📱] Wi-Fi / LAN Mobile URL:   http://192.168.0.107:3000
   [💻] Host Machine URL:        http://localhost:3000
   [🔌] Backend API Docs:        http://192.168.0.107:8000/docs
   [📊] Custom DSA Diagnostics:  http://192.168.0.107:8000/api/v1/metrics/dsa
------------------------------------------------------------------------
   Connect your smartphone/laptop to the same Wi-Fi network,
   open your browser and navigate to: http://192.168.0.107:3000
========================================================================
```

### Step 4: Multi-User Concurrent Demonstration
1. **Device 1 (Mobile Phone):** Open `http://192.168.0.107:3000`, navigate to **Search & Book**, and hold 2 berths on *Bhopal Shatabdi Express*.
2. **Device 2 (Host PC):** Watch the **Live Coach Layout** update instantly with berths changing to amber (`HELD`).
3. **Device 3 (Tablet or 2nd Laptop):** Navigate to **Reservation Chart** or **DSA Diagnostics** to observe real-time load factor and hash table collisions update across the network.

---

## 4. Firewall & Troubleshooting Checklist

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| Mobile phone shows "Site unreachable" | Windows Defender Firewall blocking port 3000/8000 | In Windows Security, allow Node.js and Python through Private Networks, or run: `New-NetFirewallRule -DisplayName "RailDSA" -Direction Inbound -LocalPort 3000,8000 -Protocol TCP -Action Allow` in admin PowerShell. |
| Host shows page, but buttons fail | Mobile cannot reach backend on port 8000 | Check that both `0.0.0.0:8000` and `0.0.0.0:3000` are bound and not blocked by router client-isolation. |
| Mobile Hotspot isolation | Some public/college Wi-Fi networks block device-to-device traffic | Use a personal mobile hotspot where all devices are on the same subnet without AP client isolation. |

