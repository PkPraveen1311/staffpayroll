import * as XLSX from "xlsx";

export type SheetRow = Record<string, any>;

/** Read the first sheet of an .xlsx/.csv file into header-keyed row objects. */
export async function parseExcelFile(file: File): Promise<SheetRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("The file has no sheets");
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<SheetRow>(ws, { defval: "", raw: false, dateNF: "yyyy-mm-dd" });
  return rows.filter((r) => Object.values(r).some((v) => String(v ?? "").trim() !== ""));
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Get a value from a row by trying multiple header aliases (case/spacing insensitive). */
export function pick(row: SheetRow, ...aliases: string[]): string {
  const map = new Map<string, any>();
  Object.entries(row).forEach(([k, v]) => map.set(norm(k), v));
  for (const a of aliases) {
    const v = map.get(norm(a));
    if (v !== undefined && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

export function toNumber(v: string): number {
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function toBool(v: string, fallback = false): boolean {
  const s = v.trim().toLowerCase();
  if (!s) return fallback;
  return ["yes", "y", "true", "1", "enabled", "on"].includes(s);
}

/** Normalise a spreadsheet date value to yyyy-mm-dd, or null. */
export function toDate(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
  }
  return null;
}

/** Download a blank template workbook with the given headers plus one sample row. */
export function downloadTemplate(filename: string, headers: string[], sample: (string | number)[], sheetName = "Template") {
  const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(12, h.length + 4) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}
