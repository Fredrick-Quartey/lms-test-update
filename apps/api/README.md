# apps/api — FastAPI backend (reserved, intentionally empty)

This folder is reserved for the **FastAPI** service owned by the backend developer(s).
The frontend team does not write code here.

The frontend talks to this service only through the agreed contract in
`docs/API_CONTRACT.md` (base path `/api/v1`). Until endpoints are announced ready,
the React app runs against its built-in mock API (`VITE_USE_MOCKS=true`).
