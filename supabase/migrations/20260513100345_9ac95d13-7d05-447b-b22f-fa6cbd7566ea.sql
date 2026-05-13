-- Fix Ravi Rajoriya's special allowance (was set for CTC 14442, should be 14130)
UPDATE public.employees SET special_allowance = 1724 WHERE employee_code = 'PEH00057';

-- Recompute April 2026 payslips honoring "leave" as a paid day and the corrected special allowance.
WITH run AS (SELECT id FROM public.payroll_runs WHERE month=4 AND year=2026 LIMIT 1),
days AS (
  SELECT employee_id,
         SUM(CASE WHEN status IN ('present','week-off','leave') THEN 1
                  WHEN status='half-day' THEN 0.5 ELSE 0 END)::numeric AS d
  FROM public.attendance
  WHERE date BETWEEN '2026-04-01' AND '2026-04-30'
  GROUP BY employee_id
),
calc AS (
  SELECT
    p.id AS pid,
    e.id AS eid,
    COALESCE(d.d, 30)                                          AS dw,
    COALESCE(d.d, 30)/30.0                                     AS r,
    e.basic_salary, e.hra, e.allowances, e.medical_allowance,
    e.leave_encashment, e.statutory_bonus, e.special_allowance,
    e.pf_enabled, e.esi_enabled,
    p.incentive, p.advance
  FROM public.payslips p
  JOIN public.employees e ON e.id = p.employee_id
  LEFT JOIN days d ON d.employee_id = e.id
  WHERE p.payroll_run_id = (SELECT id FROM run)
),
final AS (
  SELECT pid, eid, dw,
    ROUND((basic_salary       * r)::numeric, 2) AS basic,
    ROUND((hra                * r)::numeric, 2) AS hra,
    ROUND((allowances         * r)::numeric, 2) AS allow,
    ROUND((medical_allowance  * r)::numeric, 2) AS med,
    ROUND((leave_encashment   * r)::numeric, 2) AS lev,
    ROUND((statutory_bonus    * r)::numeric, 2) AS bon,
    ROUND((special_allowance  * r)::numeric, 2) AS spc,
    incentive, advance,
    CASE WHEN pf_enabled THEN ROUND((LEAST(basic_salary,15000) * CASE WHEN basic_salary>15000 THEN 1 ELSE r END * 0.12)::numeric,2) ELSE 0 END AS pf,
    CASE WHEN esi_enabled THEN ROUND((basic_salary * r * 0.0075)::numeric,2) ELSE 0 END AS esi,
    CASE WHEN pf_enabled THEN ROUND((LEAST(basic_salary,15000) * CASE WHEN basic_salary>15000 THEN 1 ELSE r END * 0.12)::numeric,2) ELSE 0 END AS er_pf,
    CASE WHEN pf_enabled THEN ROUND((LEAST(basic_salary,15000) * CASE WHEN basic_salary>15000 THEN 1 ELSE r END * 0.005)::numeric,2) ELSE 0 END AS edli,
    CASE WHEN pf_enabled THEN ROUND((LEAST(basic_salary,15000) * CASE WHEN basic_salary>15000 THEN 1 ELSE r END * 0.005)::numeric,2) ELSE 0 END AS pfa,
    CASE WHEN esi_enabled THEN ROUND((basic_salary * r * 0.0325)::numeric,2) ELSE 0 END AS er_esi
  FROM calc
)
UPDATE public.payslips p SET
  days_worked = f.dw,
  basic = f.basic, hra = f.hra, allowances = f.allow,
  medical_allowance = f.med, leave_encashment = f.lev,
  statutory_bonus = f.bon, special_allowance = f.spc,
  gross = f.basic + f.hra + f.allow + f.med + f.lev + f.bon + f.spc,
  pf = f.pf, esi = f.esi,
  employer_pf = f.er_pf, edli = f.edli, pf_admin_charges = f.pfa, employer_esi = f.er_esi,
  total_deductions = f.pf + f.esi + p.tds + f.advance,
  net_pay = (f.basic + f.hra + f.allow + f.med + f.lev + f.bon + f.spc) + f.incentive - (f.pf + f.esi + p.tds + f.advance)
FROM final f WHERE p.id = f.pid;

-- Refresh run total
UPDATE public.payroll_runs SET total_net = (SELECT COALESCE(SUM(net_pay),0) FROM public.payslips WHERE payroll_run_id = payroll_runs.id)
WHERE month=4 AND year=2026;