## Pull Request Description

### 1. Summary of Changes
<!-- Briefly describe what you implemented or fixed. -->

### 2. Motivation / Problem Solved
<!-- Why was this change necessary? Link any related GitHub issue (e.g., Fixes #12). -->

### 3. Modified Modules
- [ ] Custom DSA Layer (`backend/app/dsa/`)
- [ ] Reservation Engine & Services (`backend/app/services/`)
- [ ] Database Models / Migrations (`backend/app/models/`, `backend/app/database/`)
- [ ] API Endpoints (`backend/app/api/`)
- [ ] Frontend Application (`frontend/`)
- [ ] Documentation / CI Workflows (`.github/`, docs)

### 4. Tests Added or Updated
<!-- List unit or integration tests added or executed to verify correctness. -->

### 5. Verification Commands Used
```bash
# Frontend checks
cd frontend && npm run lint && npm run build

# Backend checks
PYTHONPATH=./backend pytest backend/app/tests/ -v
```

### 6. Known Limitations / Edge Cases
<!-- Describe any known constraints or areas for future optimization. -->

---

## Contributor Quality Checklist

Before submitting this PR, please check and confirm all of the following:

- [ ] **Frontend Linting**: `npm run lint` passes with 0 errors in `frontend/`.
- [ ] **Frontend Build**: `npm run build` succeeds without build or type errors.
- [ ] **Backend Tests**: `pytest backend/app/tests/ -v` passes completely.
- [ ] **Custom DSA Integrity**: No custom algorithms (Hash Table, Priority Heap, Bloom Filter, Sorter) were replaced with built-in functions or DB indexes.
- [ ] **Scope Discipline**: No unrelated files, lockfile churn, or IDE files modified.
- [ ] **Secrets Security**: No `.env` credentials, API tokens, or sensitive values committed.
- [ ] **Code Ownership & Comprehension**: I personally understand and can explain all submitted logic; any AI-assisted code has been rigorously inspected and tested.
- [ ] **Documentation**: Updated relevant README or comments if API schemas or configuration changed.
