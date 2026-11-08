# Contributor Guide - Railway Reservation System

Hey team! This doc covers how we work on the Railway Reservation System codebase, branch naming, local testing, and pull request reviews.

---

## 1. Quick Architecture Overview

We're keeping business and algorithm logic strictly on the backend:
- **Backend**: FastAPI + SQLAlchemy (`backend/app/`)
  - `dsa/`: Pure custom implementations. No `dict`, `set`, or SQL `ORDER BY` replacements for core requirements!
    - `hash_table.py`: Separate-chaining hash table with rolling hash & load factor resizing.
    - `priority_queue.py`: Min-heap for quota-based waitlist ordering.
    - `bloom_filter.py`: Kirsch-Mitzenmacher double-hashing filter.
    - `sorting.py`: Merge sort by `(coach, berth_number)`.
    - `waiting_queue.py`: Doubly-linked list for RAC FIFO queue.
  - `services/`: Holds state transitions (`AVAILABLE` -> `HELD` -> `CONFIRMED`) and cancellation auto-promotion.
- **Frontend**: Next.js dashboard (`frontend/`)
  - Communicates with backend REST API at `http://127.0.0.1:8000/api/v1`.
- **Database**: PostgreSQL for staging/CI, SQLite default for local run.

---

## 2. Setting Up Your Machine

### Prerequisites
- Python 3.11+
- Node.js 18+ & npm

### Clone & Install
```bash
git clone https://github.com/Debanjan110d/Railway-Reservation-System.git
cd Railway-Reservation-System

# 1. Backend dependencies
pip install -r backend/requirements.txt

# 2. Frontend dependencies
cd frontend
npm install
cd ..
```

### Running Locally
To spin up both backend and frontend together:

**On Linux / macOS / Git Bash:**
```bash
chmod +x run.sh
./run.sh
```

**On Windows (PowerShell):**
```powershell
.\run.ps1
```

- Web UI: http://localhost:3000
- API Docs: http://127.0.0.1:8000/docs
- Live DSA Metrics: http://127.0.0.1:8000/api/v1/metrics/dsa

---

## 3. Team Branching Conventions

We protect `main`. Don't push directly to `main`!

Use these prefixes for branches:
- `feat/<short-name>`: New feature (e.g., `feat/quota-allocation`)
- `fix/<issue-name>`: Bug fix (e.g., `fix/seat-hold-race-condition`)
- `test/<test-name>`: New tests or test refactoring (e.g., `test/concurrency-benchmark`)
- `docs/<topic>`: Documentation updates (e.g., `docs/algorithm-complexity`)
- `refactor/<module>`: Cleanups without behavior changes

---

## 4. How to Submit a Change

1. **Pull the latest `main`:**
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Branch off:**
   ```bash
   git checkout -b feat/your-feature-name
   ```

3. **Make your changes & test locally:**
   Always run the test suite before pushing:
   ```bash
   # Make sure backend is in your python path
   # Linux / macOS:
   PYTHONPATH=./backend python -m pytest backend/app/tests/ -v

   # Windows (PowerShell):
   $env:PYTHONPATH="backend"; python -m pytest backend/app/tests/ -v
   ```

4. **Commit with meaningful messages:**
   Use conventional commits style:
   - `feat(dsa): add collision metrics to pnr hash table`
   - `fix(booking): prevent double allocation on hold timeout`
   - `test(api): add test for pnr bloom filter fast rejection`

5. **Push and create a PR:**
   ```bash
   git push -u origin feat/your-feature-name
   ```
   Open a PR against `main` on GitHub and fill out the checklist in the PR template.

---

## 5. Review & CI Quality Gates

Every PR runs our automated GitHub Actions workflow:
- **Backend Test Suite & Service Check**:
  - Sets up Python on clean Ubuntu runner.
  - Spawns a real PostgreSQL service container.
  - Seeds train routes and coach berths.
  - Runs all unit, integration, and DSA test suites.

A PR can only be merged when:
1. The CI check passes completely (green checkmark).
2. Code owner (@Debanjan110d) approves changes touching `/backend/app/dsa/`, `/backend/app/services/`, or `.github/`.
3. No merge conflicts exist with `main`.

---

## 6. Code Guidelines (Important for Academic Integrity)

- **Do NOT replace custom DSA**: Under no circumstances should you replace `PNRHashTable`, `PriorityQueue`, `BloomFilter`, or `merge_sort_chart` with Python's built-in `dict`, `heapq`, or SQL `ORDER BY`.
- **Explain what you write**: If you use AI to draft logic, you must understand, test, and be ready to explain every single line in viva/review.
- **Never commit `.env` or credentials**: Keep secrets out of Git! Use `.env.example` as a template.
