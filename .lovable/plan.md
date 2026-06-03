## Monthly Attendance Sheet (Printable)

Add a new printable monthly attendance matrix where each employee is a row and each date of the selected month is a column.

### Where it lives
- New route: `src/routes/_app.attendance-sheet.tsx` at URL `/attendance-sheet`
- New sidebar entry "Attendance Sheet" (icon: `CalendarDays`) added to `src/components/app-sidebar.tsx`, placed right after "Attendance"

### UI
- Header controls: Month picker + Year picker + "Print" button
- Matrix table:
  - Columns: `#`, `Employee` (sticky left), then `1, 2, 3 … N` (N = days in month), then totals: `P`, `A`, `L`, `WO`, `HD`, `Net`
  - Rows: all active employees (sorted by employee_code / name)
  - Cell value: single-letter status code
    - P = present, A = absent, L = leave, W = week-off, H = half-day, "-" = no record
  - Sundays (and column header) shaded lightly
- Footer row: column totals (count of P per date)

### Data
- Query `employees` (status='active') and `attendance` for `date BETWEEN month-start AND month-end` in parallel
- Build a `Map<employee_id, Map<dateStr, status>>` for O(1) cell lookups
- Totals computed client-side per row using existing payroll rules (leave = paid, half-day = 0.5)

### Print layout
- Dedicated print stylesheet (scoped via Tailwind `print:` utilities) — hide sidebar/header, force landscape, shrink font, remove cell padding
- Add `@page { size: A4 landscape; margin: 8mm; }` in a `<style>` block inside the route
- Title block on print: "Attendance Sheet — {Month Year}" + company name
- Single-page fit: use `text-[9px]`, `px-1`, narrow date columns (`w-6`), sticky-name column wide enough for full name

### No database changes
Read-only view over existing `attendance` and `employees` tables — no migration, no schema change.

### Files
- Create: `src/routes/_app.attendance-sheet.tsx`
- Edit: `src/components/app-sidebar.tsx` (add nav item)
- Auto-updated: `src/routeTree.gen.ts`
