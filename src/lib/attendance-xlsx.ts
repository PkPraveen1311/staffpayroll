import ExcelJS from "exceljs";

export type AttendanceSheetRow = {
  code: string;
  name: string;
  department: string;
  cells: string[]; // one per day, "P"/"A"/"H"/"L"/"W"/"T"/"-"
  counts: { P: number; A: number; H: number; L: number; W: number; T: number };
  net: number;
};

const STATUS_FILL: Record<string, string> = {
  P: "FFD9F2E3",
  T: "FFD4F1F7",
  W: "FFE8DEF8",
  L: "FFD8ECFB",
  H: "FFFDEBC8",
  A: "FFFAD4D4",
  "-": "FFF3F4F6",
};

const STATUS_FONT: Record<string, string> = {
  P: "FF11734B",
  T: "FF0B6E7A",
  W: "FF5B21B6",
  L: "FF0B5394",
  H: "FF9A5B00",
  A: "FF9B1C1C",
  "-": "FF9CA3AF",
};

const THIN = { style: "thin" as const, color: { argb: "FFB6C2CF" } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

function buildSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  title: string,
  subtitle: string,
  days: number[],
  sundays: Set<number>,
  rows: AttendanceSheetRow[],
  accent: string,
) {
  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: "frozen", xSplit: 3, ySplit: 4 }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
  });

  const headers = ["#", "Code", "Name", "Department", ...days.map(String), "P", "A", "H", "L", "W", "T", "Net"];
  const lastCol = headers.length;

  ws.mergeCells(1, 1, 1, lastCol);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { name: "Calibri", size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  t.alignment = { horizontal: "center", vertical: "middle" };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: accent } };
  ws.getRow(1).height = 28;

  ws.mergeCells(2, 1, 2, lastCol);
  const s = ws.getCell(2, 1);
  s.value = subtitle;
  s.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF334155" } };
  s.alignment = { horizontal: "center", vertical: "middle" };
  s.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2F7" } };
  ws.getRow(2).height = 18;

  ws.addRow([]);

  const headerRow = ws.addRow(headers);
  headerRow.height = 20;
  headerRow.eachCell((cell, col) => {
    const dayIdx = col - 5;
    const isSun = dayIdx >= 0 && dayIdx < days.length && sundays.has(days[dayIdx]);
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isSun ? "FF9B1C1C" : accent } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = BORDER;
  });

  rows.forEach((r, i) => {
    const values = [
      i + 1,
      r.code,
      r.name,
      r.department,
      ...r.cells,
      r.counts.P,
      r.counts.A,
      r.counts.H,
      r.counts.L,
      r.counts.W,
      r.counts.T,
      r.net,
    ];
    const row = ws.addRow(values);
    row.height = 17;
    const band = i % 2 === 1;
    row.eachCell((cell, col) => {
      cell.border = BORDER;
      cell.font = { name: "Calibri", size: 10 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      if (col <= 4) {
        cell.alignment = { horizontal: col === 1 ? "center" : "left", vertical: "middle" };
        cell.font = { name: "Calibri", size: 10, bold: col === 3 };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: band ? "FFF1F5F9" : "FFFFFFFF" } };
      } else if (col <= 4 + days.length) {
        const v = String(cell.value ?? "-");
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STATUS_FILL[v] ?? "FFFFFFFF" } };
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: STATUS_FONT[v] ?? "FF111827" } };
      } else if (col === lastCol) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF7A4E00" } };
        cell.numFmt = "0.0";
      } else {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: band ? "FFF1F5F9" : "FFFFFFFF" } };
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF334155" } };
      }
    });
  });

  // Legend
  ws.addRow([]);
  const legend = ws.addRow(["Legend:", "P = Present", "A = Absent", "H = Half-day", "L = Leave", "W = Week-off", "T = Tour", "- = No record"]);
  legend.eachCell((cell, col) => {
    cell.font = { name: "Calibri", size: 9, bold: col === 1, color: { argb: "FF475569" } };
  });

  ws.getColumn(1).width = 4;
  ws.getColumn(2).width = 12;
  ws.getColumn(3).width = 26;
  ws.getColumn(4).width = 16;
  for (let i = 0; i < days.length; i++) ws.getColumn(5 + i).width = 3.6;
  for (let i = 0; i < 6; i++) ws.getColumn(5 + days.length + i).width = 4.6;
  ws.getColumn(lastCol).width = 6.5;

  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: 4 } };
}

export async function exportAttendanceSheetXlsx(opts: {
  monthLabel: string;
  days: number[];
  sundays: number[];
  employees: AttendanceSheetRow[];
  agents: AttendanceSheetRow[];
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "PayPulse";
  wb.created = new Date();
  const sundaySet = new Set(opts.sundays);

  buildSheet(wb, "Employees", "PEHCHAAN — Employee Attendance Sheet", opts.monthLabel, opts.days, sundaySet, opts.employees, "FF1F3A5F");
  buildSheet(wb, "Commission Agents", "PEHCHAAN — Commission Agent Attendance", opts.monthLabel, opts.days, sundaySet, opts.agents, "FF6B21A8");

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Attendance_${opts.monthLabel.replace(/\s+/g, "_")}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
