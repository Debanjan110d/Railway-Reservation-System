# Contributing to Railway Reservation System

Thank you for contributing to this academic DSA project! To maintain high code quality and prevent broken code from entering the `main` branch, please follow these guidelines.

---

## 1. Branching Strategy

- **Protected Main Branch**: `main` (Direct pushes are disabled; all changes enter via Pull Requests).
- **Branch Naming Conventions**:
  - `feat/<feature-name>` (e.g., `feat/pnr-hash-table`, `feat/waiting-list-heap`)
  - `fix/<bug-name>` (e.g., `fix/berth-allocation-race`)
  - `test/<test-name>` (e.g., `test/concurrency-simulation`)
  - `docs/<doc-name>` (e.g., `docs/dsa-complexity-analysis`)
  - `refactor/<module-name>`

---

## 2. Contribution Workflow (Step-by-Step for all 4 Team Members)

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Debanjan110d/Railway-Reservation-System.git
   cd Railway-Reservation-System
   ```

2. **Set up the Environment**:
   - Backend:
     ```bash
     pip install -r backend/requirements.txt
     ```
   - Frontend:
     ```bash
     cd frontend
     npm ci
     cd ..
     ```

3. **Verify Local Startup**:
   - Run `./run.sh` or `.\run.ps1` to ensure both servers start properly.

4. **Create a Feature Branch**:
   ```bash
   git checkout -b feat/your-feature-name
   ```

5. **Develop and Write Tests**:
   - Strictly preserve all custom DSA implementations. Never replace custom algorithms with built-in libraries or DB `ORDER BY` clauses.
   - Any AI-assisted code must be reviewed, tested, and thoroughly understood by the contributor. You must be able to explain the logic and complexity during code review.

6. **Run Checks Locally Before Pushing**:
   ```bash
   # 1. Run backend tests
   PYTHONPATH=./backend pytest backend/app/tests/ -v

   # 2. Run frontend lint and production build
   cd frontend
   npm run lint
   npm run build
   cd ..
   ```

7. **Commit and Push**:
   ```bash
   git add <modified-files>
   git commit -m "feat(module): describe your clear changes"
   git push origin feat/your-feature-name
   ```

8. **Open a Pull Request**:
   - Complete the `.github/PULL_REQUEST_TEMPLATE.md` checklist.
   - Ensure all automated GitHub Actions CI checks (`Frontend CI`, `Backend CI`) pass.
   - Request review from code owners.
