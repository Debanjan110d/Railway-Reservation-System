# Railway Reservation System with Waiting-List Management & Custom DSA

An academic Data Structures and Algorithms (DSA) project featuring custom berth allocation, quota-based passenger prioritization, dynamic PNR hash indexing, priority waiting-list queues, probabilistic Bloom filter pre-checking, and in-place stable reservation chart sorting.

---

## 1. Technology Stack

- **Frontend**: Next.js (React 19 + TypeScript + Tailwind CSS)
- **Backend**: Python + FastAPI
- **Database**: PostgreSQL / SQLite (with SQLAlchemy ORM)
- **CI/CD & Automation**: GitHub Actions (`frontend-ci.yml`, `backend-ci.yml`, `dependabot.yml`)

---

## 2. Core Custom Data Structures (Zero Built-in Replacements)

1. **Custom PNR Hash Table (`backend/app/dsa/hash_table.py`)**:
   - Separate chaining collision handling with custom linked list nodes.
   - Polynomial rolling hash function with prime base $p=31$.
   - Dynamic load-factor resizing threshold ($\alpha \ge 0.75$).
2. **Quota Priority Queue (`backend/app/dsa/priority_queue.py`)**:
   - Binary Min-Heap (`_sift_up`, `_sift_down`, `heapify`).
   - Deterministic academic priority policy:
     $$(\text{quota\_rank}, \text{category\_subweight}, \text{booking\_timestamp}, \text{passenger\_id})$$
     Rank: Senior Citizen (`SS`) > Ladies (`LD`) > General (`GN`) > Tatkal (`TQ`).
3. **Waiting-List & RAC FIFO Queue (`backend/app/dsa/waiting_queue.py`)**:
   - Doubly linked list queue for RAC and sequential waiting allocations.
4. **Reservation Chart Sorter (`backend/app/dsa/sorting.py`)**:
   - In-place stable Merge Sort ordered by `(Coach Code ASC, Berth Number ASC)`.
5. **Probabilistic Bloom Filter (`backend/app/dsa/bloom_filter.py`)**:
   - Kirsch-Mitzenmacher double hashing with mathematical guarantee of zero false negatives.

---

## 3. Quick Start (Run Both Frontend and Backend in One Go)

### Using Bash (Linux/macOS/Git Bash)
```bash
chmod +x run.sh
./run.sh
```

### Using PowerShell (Windows)
```powershell
.\run.ps1
```

- **Frontend Application**: [http://localhost:3000](http://localhost:3000)
- **Interactive API Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **DSA Diagnostics & Metrics**: [http://127.0.0.1:8000/api/v1/metrics/dsa](http://127.0.0.1:8000/api/v1/metrics/dsa)

---

## 4. Running Quality Checks Locally

### Backend Tests
```bash
# Set Python path and run full pytest suite
export PYTHONPATH=./backend
pytest backend/app/tests/ -v
```

### Frontend Lint and Build
```bash
cd frontend
npm run lint
npm run build
```

