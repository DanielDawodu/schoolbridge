# SchoolBridge Dashboard Refinement Plan

## 0️⃣ Repository Setup
- **Branch name**: `dashboard-refinement`
- Commands:
  ```bash
  git checkout development
  git pull origin development
  git checkout -b dashboard-refinement
  git push -u origin dashboard-refinement
  ```
- Enable CI lint/test on PRs (already in repo).

---
## 📋 Sprint Overview
| Sprint | Goal | Key Files / Endpoints |
|-------|------|-----------------------|
| 1 | Dashboard core data (API & frontend hooks) | `backend/src/routes/dashboard.ts`, `backend/src/controllers/dashboardController.ts`, `frontend/src/pages/Dashboard.tsx`, `frontend/src/components/WelcomeBanner.tsx` |
| 2 | Interactive UI (cards, attendance, fee summary) | `frontend/src/components/StudentStatsCard.tsx`, `frontend/src/components/ClassStatsCard.tsx`, `frontend/src/components/AttendanceSummary.tsx`, `frontend/src/components/FeeSummary.tsx` |
| 3 | Getting‑Started checklist | `frontend/src/components/GetStartedChecklist.tsx` |
| 4 | Sidebar / navigation restructure | `frontend/src/components/Sidebar.tsx`, `frontend/src/layout/MainLayout.tsx` |
| 5 | Visual design system & responsiveness | `frontend/src/styles/tailwind.config.js`, new `src/components/ui/*` (Button, Card, Input) |
| 6 | Role‑aware dashboard rendering | Extend `AuthContext` role handling, add backend middleware checks if new endpoints introduced |
| 7 | Testing & QA | Add unit tests in `backend/tests/dashboard.test.ts`, frontend component tests with Vitest, run `npm run lint` and `npm test` |
| 8 | Final polish & PR merge | Update README, changelog, CI badge |

---
## Sprint 1 – Dashboard Core Data
### Backend
1. **Create new route file**: `backend/src/routes/dashboard.ts`
   ```ts
   import { Router } from 'express';
   import { getDashboardData } from '../controllers/dashboardController';
   const router = Router();
   router.get('/', getDashboardData);
   export default router;
   ```
2. **Register route in `backend/src/index.ts`** (after other routes):
   ```ts
   import dashboardRoutes from './routes/dashboard';
   app.use('/api/dashboard', dashboardRoutes);
   ```
3. **Controller** `backend/src/controllers/dashboardController.ts`
   - Pull the authenticated user via `req.user` (already added by `verifyToken`).
   - Query the school (`schoolId`) for:
     - Active academic session & term (`AcademicSession` & `Term` models).
     - Student counts (active vs total) using `User` model where `status === 'active'`.
     - Class count (`ClassGroup` model).
     - Today’s attendance aggregates (`Attendance` model) – compute present/absent/late/unmarked.
     - Fee aggregates for the current term (`FeeInvoice` & `Payment` models).
   - Return a JSON payload:
     ```json
     {
       "school": {"name": "...","id": "..."},
       "session": {"name": "..."},
       "term": {"name": "..."},
       "students": {"total": 0, "active": 0},
       "classes": {"total": 0},
       "attendance": {"present":0,"absent":0,"late":0,"unmarked":0},
       "fees": {"expected":0,"collected":0,"outstanding":0,"credit":0}
     }
     ```
   - All queries must be scoped by `schoolId` to enforce data isolation.
   - Add minimal error handling – return `200` with empty arrays if no data.
4. **Add unit test** `backend/tests/dashboard.test.ts` covering:
   - Successful data return for a school with data.
   - Empty‑state handling (no session, no attendance, etc.).
   - Permission check – ensure non‑authenticated request gets 401.

### Frontend
1. **Create a hook** `frontend/src/hooks/useDashboard.ts`
   ```ts
   import { useQuery } from '@tanstack/react-query';
   import api from '../services/api';
   export const useDashboard = () =>
     useQuery(['dashboard'], () => api.get('/dashboard').then(res => res.data), { staleTime: 5 * 60 * 1000 });
   ```
2. **Create `Dashboard` page** `frontend/src/pages/Dashboard.tsx`
   - Use the hook, show loading spinner, error state, then render sub‑components.
   - Pass down the payload sections to the UI components that will be built in later sprints.
3. **Add route** in `frontend/src/App.tsx` (or router config) under protected routes:
   ```tsx
   <Route path="/dashboard" element={<Dashboard />} />
   ```
4. **Update navigation** to include a **Dashboard** link (will be refined later).
5. **Add basic unit test** using Vitest to ensure the hook calls the API correctly.

---
## Sprint 2 – Interactive UI
### Components to add/modify
- `WelcomeBanner.tsx` – displays heading, user name, school name, session, term.
- `StudentStatsCard.tsx` & `ClassStatsCard.tsx` – clickable cards (`<Link to="/students">`).
- `AttendanceSummary.tsx` – grid of four numbers + total marked, with empty‑state link to `/attendance`. Implements the calculation rules described.
- `FeeSummary.tsx` – shows expected/collected/outstanding/credit, percentage bar, links to `/fees` and `/fees/unpaid`.

All components will receive data via props from `Dashboard` and use Tailwind classes for consistent spacing, colors, shadows.

---
## Sprint 3 – Getting‑Started Checklist
- New component `GetStartedChecklist.tsx`.
- Data source: call existing endpoints (`/api/academic-sessions`, `/api/classes`, `/api/subjects`, `/api/students`, `/api/staff`, `/api/teachers/assignments`).
- Compute each task’s completion status (e.g., `sessions.length > 0`).
- Render list items with a check‑icon (Lucide `CheckCircle`) when done, otherwise a forward‑arrow linking to the appropriate page.
- When all tasks completed, replace list with a compact “Setup complete 🎉” banner.

---
## Sprint 4 – Sidebar Refactor
1. **Replace mixed emoji icons** with `lucide-react` icons. Install:
   ```bash
   npm i lucide-react
   ```
2. **Sidebar component** (`src/components/Sidebar.tsx`):
   - Group navigation items as per the spec (Overview, Academics, People, Finance, Administration).
   - Use a data‑driven array of items `{ label, to, icon: <IconName /> }`.
   - Add hover (`bg-gray-100`) and active (`bg-indigo-100 text-indigo-700`) styles.
   - Make it collapsible (Tailwind `hidden md:block` with a toggle button). On mobile, render a `<Drawer>` component (e.g., using `headlessui` Dialog).
   - Ensure the user profile & sign‑out area stays anchored at the bottom (`flex flex-col justify-between h-full`).
3. Update `MainLayout.tsx` to wrap page content with the new sidebar.

---
## Sprint 5 – Design System & Responsiveness
- **Theme file** (`tailwind.config.js`) – define primary color (`#1E3A8A` – Indigo‑900) and extend spacing, borderRadius, boxShadow.
- Create reusable UI primitives under `src/components/ui/` (Button, Card, Input, Badge) that use the theme.
- Replace any hard‑coded margins/paddings with the new utilities.
- Media‑query breakpoints (`xl`, `lg`, `md`, `sm`, `xs`) – ensure:
  - Cards shift from 4‑column to 2‑column to 1‑column as width shrinks.
  - Tables become scrollable containers on small screens.
  - Touch targets ≥ 44 px.
- Run `npm run lint` and fix any Tailwind warnings.

---
## Sprint 6 – Role‑aware Dashboard
- **Backend**: Add a simple middleware `requireRoles(allowed: string[])` that checks `req.user.role` (already decoded in auth middleware). Use it on any new endpoint that needs stricter limits.
- **Frontend**: In `Dashboard.tsx`, read `user.role` from `AuthContext` and conditionally render sections:
  - Principal/Administrator → all sections.
  - Teacher → hide fee summary, show only assigned classes & attendance.
  - Bursar → hide student stats, show fee summary prominently.
- Guard navigation items in the sidebar similarly.

---
## Sprint 7 – Testing & QA
| Area | Tests |
|------|-------|
| Backend | Jest + supertest for `/api/dashboard` and role middleware. |
| Frontend | Vitest + React Testing Library for components (`WelcomeBanner`, `StudentStatsCard`, `AttendanceSummary`). |
| E2E (optional) | Playwright scenario: login → dashboard → click each card → verify navigation. |
| Lint/TS | `npm run lint`, `npm run build` (TS compile). |
| Manual | Test on Chrome/Edge across breakpoints (1920, 1366, 1024, 768, 375). Verify no horizontal scroll, correct card layout, accessible colors (WCAG AA). |

---
## Sprint 8 – Finalise & Merge
1. Update `README.md` with a “Demo” section showing the new dashboard URL.
2. Add a short changelog entry:
   - `feat(dashboard): comprehensive dashboard with live stats, role‑aware view, interactive cards`.
3. Open a Pull Request targeting `development` with a descriptive title.
4. Request review from the team, address any CI failures, then merge.

---
## 📦 Summary of Files Modified / Added
| Category | File/Directory | Purpose |
|----------|----------------|---------|
| Backend | `src/routes/dashboard.ts` | New route |
| Backend | `src/controllers/dashboardController.ts` | Data aggregation |
| Backend | `src/index.ts` (import & `app.use`) | Register route |
| Backend | `tests/dashboard.test.ts` | Unit tests |
| Frontend | `src/pages/Dashboard.tsx` | Dashboard page |
| Frontend | `src/hooks/useDashboard.ts` | Data fetch hook |
| Frontend | `src/components/WelcomeBanner.tsx` | Header info |
| Frontend | `src/components/StudentStatsCard.tsx` | Clickable student card |
| Frontend | `src/components/ClassStatsCard.tsx` | Clickable class card |
| Frontend | `src/components/AttendanceSummary.tsx` | Attendance grid |
| Frontend | `src/components/FeeSummary.tsx` | Fee summary with bar |
| Frontend | `src/components/GetStartedChecklist.tsx` | Checklist UI |
| Frontend | `src/components/Sidebar.tsx` | Refactored navigation |
| Frontend | `src/layout/MainLayout.tsx` | Layout wrapper |
| Frontend | `src/components/ui/*` | Design‑system primitives |
| Frontend | `src/styles/tailwind.config.js` | Theme extensions |
| Frontend | `src/App.tsx` (router changes) | Add dashboard route & sidebar integration |
| Misc | `package.json` (frontend) – add `lucide-react` dependency |

---
## 👀 Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Complex aggregation queries may slow dashboard load. | Performance | Use lean projections, indexes on `schoolId`, batch queries with `Promise.all`. |
| Role‑specific data leakage if backend checks missing. | Security | Enforce role checks in the new controller and reuse existing `verifyToken` middleware. |
| UI breakage on older browsers. | UX | Stick to modern browsers (Chrome/Edge) for demo; graceful fallback via Tailwind. |
| Existing tests may fail due to new imports. | CI stability | Run `npm test` after each sprint, fix failing tests before moving on. |

---
## ✅ Next Immediate Action
Run the **git commands** to create the `dashboard-refinement` branch (see Section 0️⃣) and start **Sprint 1** by adding the dashboard route file.

Once the branch exists, let me know and I’ll generate the first code snippets (backend route + controller) for you to commit.

