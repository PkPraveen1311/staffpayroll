import { supabase } from "@/integrations/supabase/client";

const key = (v: unknown) => String(v ?? "").trim().toLowerCase();

/**
 * Batched import: rows sharing the same code inside one file are merged
 * (last value wins), new rows are inserted in chunks, existing rows updated in
 * parallel batches. Per-row failures are collected instead of aborting.
 */
export async function importByCode(
  table: "employees" | "commission_agents",
  codeField: "employee_code" | "agent_code",
  existingRows: { id: string; [k: string]: any }[],
  records: Record<string, any>[],
): Promise<{ created: number; updated: number }> {
  const existing = new Map(existingRows.map((r) => [key(r[codeField]), r.id as string]));

  // Merge duplicates within the uploaded file
  const merged = new Map<string, Record<string, any>>();
  for (const r of records) {
    const k = key(r[codeField]);
    merged.set(k, { ...(merged.get(k) ?? {}), ...r });
  }

  const toInsert: Record<string, any>[] = [];
  const toUpdate: { id: string; row: Record<string, any> }[] = [];
  merged.forEach((row, k) => {
    const id = existing.get(k);
    if (id) toUpdate.push({ id, row });
    else toInsert.push(row);
  });

  const failures: string[] = [];
  let created = 0;
  let updated = 0;

  for (let i = 0; i < toInsert.length; i += 50) {
    const chunk = toInsert.slice(i, i + 50);
    const { error } = await supabase.from(table).insert(chunk as never);
    if (!error) {
      created += chunk.length;
      continue;
    }
    // Fall back to per-row so one bad row doesn't lose the batch
    for (const row of chunk) {
      const { error: e } = await supabase.from(table).insert(row as never);
      if (e) failures.push(`${row[codeField]}: ${e.message}`);
      else created++;
    }
  }

  for (let i = 0; i < toUpdate.length; i += 20) {
    const chunk = toUpdate.slice(i, i + 20);
    const results = await Promise.all(
      chunk.map((u) => supabase.from(table).update(u.row as never).eq("id", u.id)),
    );
    results.forEach((res, idx) => {
      if (res.error) failures.push(`${chunk[idx].row[codeField]}: ${res.error.message}`);
      else updated++;
    });
  }

  if (failures.length) {
    throw new Error(
      `${created} added, ${updated} updated, ${failures.length} failed — ${failures.slice(0, 3).join("; ")}${failures.length > 3 ? "…" : ""}`,
    );
  }
  return { created, updated };
}
