# Railway Reservation System with Waiting-List Management & Custom DSA

An academic Data Structures and Algorithms (DSA) project featuring custom berth allocation, quota-based passenger prioritization, dynamic PNR hash indexing, priority waiting-list queues, probabilistic Bloom filter pre-checking, and in-place stable reservation chart sorting.

---

## 1. Technology Stack

- **Frontend**: Next.js 16 (React 19 + TypeScript + Tailwind CSS v4 via Turbopack)
- **Backend**: Python 3.11+ / FastAPI
- **Database**: SQLite / PostgreSQL (SQLAlchemy ORM)
- **Containerization**: Docker & Docker Compose (`Dockerfile`, `Dockerfile.backend`, `Dockerfile.frontend`, `docker-compose.yml`)
- **Logging**: Dedicated non-locking runtime error log (`logs/error.log`)

---

## 2. Core Custom Data Structures (Zero Built-in Replacements)

1. **Custom PNR Hash Table (`backend/app/dsa/hash_table.py`)**:
   - Separate chaining collision handling with custom linked list nodes.
   - Polynomial rolling hash function with prime base $p=31$.
   - Dynamic load-factor resizing threshold ($\alpha \ge 0.75$).
2. **Quota Priority Queue (`backend/app/dsa/priority_queue.py`)**:
   - Binary Min-Heap (`_sift_up`, `_sift_down`, `heapify`).
   - Deterministic academic priority policy:
     $$(\text{quota\_rank},\, \text{category\_subweight},\, \text{booking\_timestamp},\, \text{passenger\_id})$$
     Rank: Senior Citizen (`SS`) > Ladies (`LD`) > General (`GN`) > Tatkal (`TQ`).
3. **Waiting-List & RAC FIFO Queue (`backend/app/dsa/waiting_queue.py`)**:
   - Doubly linked list circular queue for RAC and sequential waiting allocations.
4. **Reservation Chart Sorter (`backend/app/dsa/sorting.py`)**:
   - In-place stable Merge Sort ordered by `(Coach Code ASC, Berth Number ASC)`.
5. **Probabilistic Bloom Filter (`backend/app/dsa/bloom_filter.py`)**:
   - Kirsch-Mitzenmacher double hashing with mathematical guarantee of zero false negatives.

For full mathematical proofs, space/time asymptotic bounds, and empirical simulation metrics, see [Complexity & Performance Report](docs/COMPLEXITY_AND_PERFORMANCE.md).

---

## 3. Simplified Academic Fleet

To keep live evaluation and testing clean, intuitive, and immediate, the database seeds **2 core showcase trains** across a 3-day schedule window:

| Train No. | Train Name | Route | Coaches & Classes | Showcase Focus |
| :--- | :--- | :--- | :--- | :--- |
| **12301** | **Howrah - New Delhi Rajdhani Express** | HWH $\to$ NDLS | `A1` (2AC), `B1` (3AC), `S1` (SL) | Sleeper berth layout, Lower-Berth SS priority, Ladies quota, and Tatkal rules. |
| **22301** | **Howrah - New Jalpaiguri Vande Bharat** | HWH $\to$ NJP | `C1` (Chair Car), `E1` (Executive Class) | High-speed Chair Car simulation, rapid booking turnover, and instant waitlisting. |

---

## 4. Quick Start & Multi-Device Launchers

### Option A: Windows Double-Click Launcher
Double-click `run.bat` in File Explorer.

### Option B: Windows PowerShell Launcher (Auto-Installs Dependencies)
```powershell
.\run.ps1
```

### Option C: Linux / macOS / WSL Bash Launcher
```bash
chmod +x run.sh
./run.sh
```

### Option D: Local Area Network (LAN) Server (Any Phone, Tablet, or PC on Wi-Fi)
```bash
python serve_lan.py
```
*Auto-detects your primary Wi-Fi IPv4 address (e.g. `192.168.0.106`), handles port freeing to avoid `EADDRINUSE`, and broadcasts the live web UI so any smartphone or laptop on the same network can access the system at `http://<LAN_IP>:3000`!*

---

## 5. Docker Deployment

### Approach 1: Docker Compose (Microservices)
```bash
# Build and run backend (port 8000) and frontend (port 3000)
docker compose up --build
```

### Approach 2: Unified Single Docker Image
```bash
# Build the unified all-in-one container
docker build -t raildsa .

# Run container exposing ports 3000 and 8000
docker run -p 3000:3000 -p 8000:8000 raildsa
```

- **Frontend Web UI**: [http://localhost:3000](http://localhost:3000)
- **FastAPI Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **DSA Diagnostics & Live Metrics**: [http://localhost:8000/api/v1/metrics/dsa](http://localhost:8000/api/v1/metrics/dsa)

---

## 6. Academic College Project "Book of Documentation"

A comprehensive 6-chapter academic handbook detailing real-world engineering challenges, custom algorithmic formulations, mathematical proofs, quota specifications, and examiner viva voce prep is stored in [`docs/book_of_docs/`](docs/book_of_docs/README.md):

- [**Chapter 1: Problem Analysis & Real-World Challenges**](docs/book_of_docs/01_PROBLEM_ANALYSIS_AND_CHALLENGES.md) — The *Tatkal* concurrency bottleneck, double-booking race condition, waitlist priority inversion, and SQL lock contention.
- [**Chapter 2: Custom DSA Formulations & Mathematical Solutions**](docs/book_of_docs/02_CUSTOM_DSA_SOLUTIONS.md) — Polynomial Rolling Hash Table, Kirsch-Mitzenmacher Bloom Filter ($m=95{,}850, k=6$), 4-Tuple Quota Min-Heap, Doubly-Linked Circular RAC Queue, and Stable Merge Sort.
- [**Chapter 3: Concurrency, Parallel Processing & Normalization**](docs/book_of_docs/03_CONCURRENCY_AND_PARALLEL_PROCESSING.md) — Multi-threaded safety with `threading.RLock`, 2-phase seat holds with 5-minute TTL locks, idempotency tokens, and boundary casing/whitespace normalization.
- [**Chapter 4: Local Area Network (LAN) & Cross-Device Engineering**](docs/book_of_docs/04_LAN_DEPLOYMENT_AND_CROSS_DEVICE_NETWORKING.md) — Dynamic socket discovery, resolving the mobile loopback trap, Next.js 16 `allowedDevOrigins` configuration, and Docker containerization.
- [**Chapter 5: Empirical Benchmark Results & College Viva Voce Guide**](docs/book_of_docs/05_EXPERIMENTAL_RESULTS_AND_VIVA_PREP.md) — Mathematical complexity matrix, 1,200-event empirical benchmark logs, and 15 commonly asked professor/examiner viva questions with model answers.
- [**Chapter 6: Reservation Quota Specification & Financial Rules**](docs/book_of_docs/06_RESERVATION_QUOTA_SPECIFICATION_AND_FINANCIAL_RULES.md) — Technical allocation, demographic backend validation (SS age $\ge 60$, LD female only), lower-berth prioritization, statutory Tatkal surcharge calculation, and max 100-year age limit.

---

## 7. Interactive Demonstration Workflows

### Demo 1: Booking & Atomic Berth Hold (5 Min TTL)
1. Navigate to **Search & Book**.
2. Select **Howrah - New Delhi Rajdhani Express (12301)** or **Howrah - NJP Vande Bharat (22301)**.
3. Select your desired reservation quota:
   - `GN`: Standard General priority (FCFS)
   - `SS`: Senior Citizen (Priority 1 Min-Heap)
   - `LD`: Ladies Quota (Priority 2 Min-Heap)
   - `TQ`: Tatkal Waitlist Pool
4. Fill in passenger details (with automatic senior-citizen priority detection for age $\ge 60$ and age limit $1 \le \text{age} \le 100$) and choose a berth.
5. Click **Proceed to Seat Hold (5 Min TTL)**.
6. Observe the real-time countdown timer, held berths in amber, and notification toast.
7. Click **Simulate Successful Payment** to confirm berths and index PNR into the Bloom Filter and Hash Table.

### Demo 2: Priority Waitlist Allocation & Automatic Promotion
1. Select a train run with zero available berths (or book all berths until full).
2. Book a passenger with **Senior Citizen (SS)** quota. Status allocates as `WAITING (WL)`.
3. Book a second passenger with **General (GN)** quota.
4. Navigate to **PNR Status** and cancel one of the previously confirmed bookings.
5. Observe the Min-Heap promotion: The **Senior Citizen (SS)** is promoted first into the freed berth with status `CONFIRMED (CNF)`, while the General passenger moves up the queue.

### Demo 3: Bloom Filter Fast Rejection ($O(k)$ vs Database)
1. Navigate to **PNR Status**.
2. Click the preset chip `9999999999 (Non-existent)`.
3. Click **Lookup PNR**.
4. Observe the instant negative response: The Bloom Filter verifies that all $k=6$ probe bits are not set, immediately rejecting the query in $O(k)$ time without querying the Hash Table or Database.

### Demo 4: In-Place Stable Merge Sort
1. Navigate to **Reservation Chart**.
2. Select any train run from the dropdown.
3. Observe all allocated berths stably sorted in $O(N \log N)$ time grouped by `Coach Identifier ASC` followed by `Berth Number ASC`.

---

## 8. Running Automated Quality Checks Locally

```bash
# Run full 23-test automated pytest suite
export PYTHONPATH=./backend
python -m pytest backend/app/tests/ -v

# Run frontend build verification
cd frontend && npm run build
```
