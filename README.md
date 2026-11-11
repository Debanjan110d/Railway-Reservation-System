# Railway Reservation System with Waiting-List Management & Custom DSA

An academic Data Structures and Algorithms (DSA) project featuring custom berth allocation, quota-based passenger prioritization, dynamic PNR hash indexing, priority waiting-list queues, probabilistic Bloom filter pre-checking, and in-place stable reservation chart sorting.

---

## 1. Technology Stack

- **Frontend**: Next.js 16 (React 19 + TypeScript + Tailwind CSS v4 via Turbopack)
- **Backend**: Python 3.11+ / FastAPI
- **Database**: PostgreSQL / SQLite (with SQLAlchemy ORM)
- **Logging**: Dedicated non-locking runtime error log (`logs/error.log`, tracked in Git)
- **CI/CD & Automation**: GitHub Actions (`backend-ci.yml`, `dependabot.yml`)

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

## 3. Quick Start (Windows Launcher)

### Launching System (Backend + Frontend)
```powershell
.\run.ps1
```
The launcher automatically:
1. Verifies database connectivity and auto-seeds initial trains and coaches.
2. Starts the FastAPI Backend on `http://127.0.0.1:8000`.
3. Starts the Next.js Frontend with Turbopack on `http://localhost:3000`.
4. Initializes dedicated runtime logging into `logs/error.log`.

- **Frontend UI**: [http://localhost:3000](http://localhost:3000)
- **Interactive API Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **DSA Diagnostics & Live Metrics**: [http://127.0.0.1:8000/api/v1/metrics/dsa](http://127.0.0.1:8000/api/v1/metrics/dsa)
- **Dedicated Error Log**: `logs/error.log`

---

## 4. Interactive Demonstration Workflows

### Demo 1: Booking & Atomic Berth Hold (5 Min TTL)
1. Navigate to **Search & Book**.
2. Select **Bhopal Shatabdi Express (12002)** or **Rajdhani Express (12301)**.
3. Select your desired reservation quota:
   - `GN`: Standard General priority
   - `SS`: Senior Citizen (Priority 1 in waiting heap)
   - `LD`: Ladies Quota (Priority 2 in waiting heap)
   - `TQ`: Tatkal Waitlist
4. Fill in passenger details and select preferred berths.
5. Click **Request Temporary Berth Hold (5 Min TTL)**.
6. Observe the real-time countdown timer, held berths in amber, and toast notification.
7. Click **Simulate Successful Payment** to confirm berths and index PNR into the Bloom Filter and Hash Table.

### Demo 2: Priority Waitlist Allocation & Automatic Promotion
1. Select a train run with zero available berths (or book all berths until full).
2. Book a passenger with **Senior Citizen (SS)** quota. Notice status allocates as `WAITING (WL)`.
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

## 5. Running Quality Checks Locally

```bash
# Run full 16-test automated pytest suite
export PYTHONPATH=./backend
python -m pytest backend/app/tests/ -v

# Run 1,200-event academic simulation benchmark
python -m backend.app.tests.simulation_runner
```
