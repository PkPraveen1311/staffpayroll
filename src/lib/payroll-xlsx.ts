import ExcelJS from "exceljs";
import { monthName } from "@/lib/format";

type PayrollRow = {
  code: string;
  name: string;
  designation: string;
  department: string;
  days: number;
  basic: number;
  hra: number;
  allowances: number;
  medical: number;
  leaveEnc: number;
  bonus: number;
  special: number;
  gross: number;
  incentive: number;
  pf: number;
  esi: number;
  tds: number;
  advance: number;
  employerPf: number;
  employerEsi: number;
  edli: number;
  pfAdmin: number;
  totalDed: number;
  netPay: number;
  pan: string;
  bankAc: string;
};

export async function exportPayrollRegisterXlsx(month: number, year: number, rows: PayrollRow[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "PayPulse";
  wb.created = new Date();
  const ws = wb.addWorksheet("Payroll Register", {
    views: [{ state: "frozen", ySplit: 5 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } },
  });

  const headers = [
    "Code", "Employee", "Designation", "Department", "Days",
    "Basic", "HRA", "Allowances", "Medical", "Leave Enc.", "Bonus", "Special",
    "Gross", "Incentive",
    "PF", "ESI", "TDS", "Advance", "Total Ded.",
    "Employer PF", "Employer ESI", "EDLI", "PF Admin",
    "Net Pay", "PAN", "Bank A/C",
  ];

  // Title row
  ws.mergeCells(1, 1, 1, headers.length);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `PEHCHAAN — Payroll Register`;
  titleCell.font = { name: "Calibri", size: 20, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A5F" } };
  ws.getRow(1).height = 32;

  // Subtitle row
  ws.mergeCells(2, 1, 2, headers.length);
  const subCell = ws.getCell(2, 1);
  subCell.value = `${monthName(month)} ${year}   ·   ${rows.length} employee${rows.length === 1 ? "" : "s"}   ·   Generated ${new Date().toLocaleString("en-IN")}`;
  subCell.font = { name: "Calibri", size: 11, italic: true, color: { argb: "FFFFFFFF" } };
  subCell.alignment = { horizontal: "center", vertical: "middle" };
  subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2C5282" } };
  ws.getRow(2).height = 20;

  // Blank spacer
  ws.getRow(3).height = 6;

  // Group header (row 4) — colored bands over column groups
  const groupRow = ws.getRow(4);
  groupRow.height = 20;
  const bands: { start: number; end: number; label: string; color: string }[] = [
    { start: 1, end: 5, label: "Employee", color: "FF4A5568" },
    { start: 6, end: 12, label: "Earnings", color: "FF2F855A" },
    { start: 13, end: 14, label: "Gross", color: "FF276749" },
    { start: 15, end: 19, label: "Deductions", color: "FFC53030" },
    { start: 20, end: 23, label: "Employer Contributions", color: "FF6B46C1" },
    { start: 24, end: 24, label: "Net Pay", color: "FF1F3A5F" },
    { start: 25, end: 26, label: "Bank / PAN", color: "FF4A5568" },
  ];
  bands.forEach((b) => {
    ws.mergeCells(4, b.start, 4, b.end);
    const c = ws.getCell(4, b.start);
    c.value = b.label;
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: b.color } };
    for (let col = b.start; col <= b.end; col++) {
      ws.getCell(4, col).border = { right: { style: "thin", color: { argb: "FFFFFFFF" } } };
    }
  });

  // Column header row (5)
  const headerRow = ws.getRow(5);
  headerRow.height = 26;
  headers.forEach((h, i) => {
    const c = ws.getCell(5, i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: "FF1A202C" }, size: 10 };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDF2F7" } };
    c.border = {
      top: { style: "thin", color: { argb: "FFA0AEC0" } },
      bottom: { style: "medium", color: { argb: "FF2D3748" } },
      left: { style: "thin", color: { argb: "FFCBD5E0" } },
      right: { style: "thin", color: { argb: "FFCBD5E0" } },
    };
  });

  // Data rows — live Excel formulas so the sheet recalculates when inputs change
  rows.forEach((r, idx) => {
    const rowNum = 6 + idx;
    const R = rowNum;
    const f = (formula: string, result: number) => ({ formula, result });
    const values: any[] = [
      r.code, r.name, r.designation, r.department, r.days,
      r.basic, r.hra, r.allowances, r.medical, r.leaveEnc, r.bonus, r.special,
      f(`SUM(F${R}:L${R})`, r.gross), r.incentive,
      r.pf > 0 ? f(`ROUND(MIN(15000,F${R})*0.12,0)`, r.pf) : 0,
      r.esi > 0 ? f(`ROUNDUP(F${R}*0.0075,0)`, r.esi) : 0,
      r.tds, r.advance,
      f(`SUM(O${R}:R${R})`, r.totalDed),
      r.employerPf > 0 ? f(`ROUND(MIN(15000,F${R})*0.12,0)`, r.employerPf) : 0,
      r.employerEsi > 0 ? f(`ROUNDUP(F${R}*0.0325,0)`, r.employerEsi) : 0,
      r.edli > 0 ? f(`ROUND(MIN(15000,F${R})*0.005,0)`, r.edli) : 0,
      r.pfAdmin > 0 ? f(`ROUND(MIN(15000,F${R})*0.005,0)`, r.pfAdmin) : 0,
      f(`M${R}+N${R}-S${R}`, r.netPay),
      r.pan, r.bankAc,
    ];
    const row = ws.getRow(rowNum);
    values.forEach((v, i) => {
      const c = ws.getCell(rowNum, i + 1);
      c.value = v;
    });
    row.height = 20;
    const zebra = idx % 2 === 0 ? "FFFFFFFF" : "FFF7FAFC";
    for (let col = 1; col <= headers.length; col++) {
      const c = ws.getCell(rowNum, col);
      c.font = { size: 10, color: { argb: "FF1A202C" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: zebra } };
      c.border = {
        top: { style: "hair", color: { argb: "FFCBD5E0" } },
        bottom: { style: "hair", color: { argb: "FFCBD5E0" } },
        left: { style: "hair", color: { argb: "FFE2E8F0" } },
        right: { style: "hair", color: { argb: "FFE2E8F0" } },
      };
    }
    // Numeric formatting
    const inr = '"₹"#,##0;[Red]("₹"#,##0)';
    for (let col = 6; col <= 24; col++) {
      ws.getCell(rowNum, col).numFmt = inr;
      ws.getCell(rowNum, col).alignment = { horizontal: "right", vertical: "middle" };
    }
    ws.getCell(rowNum, 5).alignment = { horizontal: "center", vertical: "middle" };
    ws.getCell(rowNum, 1).alignment = { horizontal: "center", vertical: "middle" };
    ws.getCell(rowNum, 1).font = { name: "Consolas", size: 10, bold: true, color: { argb: "FF2C5282" } };
    ws.getCell(rowNum, 2).font = { size: 10, bold: true, color: { argb: "FF1A202C" } };
    // Highlight Net Pay column
    const netCell = ws.getCell(rowNum, 24);
    netCell.font = { size: 10, bold: true, color: { argb: "FF22543D" } };
    netCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6F6D5" } };
    // Highlight Gross
    const grossCell = ws.getCell(rowNum, 13);
    grossCell.font = { size: 10, bold: true, color: { argb: "FF22543D" } };
    // Deductions column tint
    ws.getCell(rowNum, 19).font = { size: 10, bold: true, color: { argb: "FF742A2A" } };
  });

  // Totals row
  const totalRow = 6 + rows.length;
  const sumCols = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
  const daysSumCol = 5;
  ws.getCell(totalRow, 1).value = "TOTAL";
  ws.mergeCells(totalRow, 1, totalRow, 4);
  const totalLabel = ws.getCell(totalRow, 1);
  totalLabel.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
  totalLabel.alignment = { horizontal: "center", vertical: "middle" };
  totalLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A5F" } };

  const daysCell = ws.getCell(totalRow, daysSumCol);
  daysCell.value = { formula: `SUM(${colLetter(daysSumCol)}6:${colLetter(daysSumCol)}${totalRow - 1})` };
  daysCell.numFmt = "0";

  sumCols.forEach((col) => {
    const c = ws.getCell(totalRow, col);
    c.value = { formula: `SUM(${colLetter(col)}6:${colLetter(col)}${totalRow - 1})` };
    c.numFmt = '"₹"#,##0';
  });
  ws.getRow(totalRow).height = 24;
  for (let col = 1; col <= headers.length; col++) {
    const c = ws.getCell(totalRow, col);
    if (col > 4) {
      c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D3748" } };
      c.alignment = { horizontal: col === 5 ? "center" : "right", vertical: "middle" };
    }
    c.border = {
      top: { style: "medium", color: { argb: "FF1A202C" } },
      bottom: { style: "medium", color: { argb: "FF1A202C" } },
    };
  }
  // Net pay total pop
  const netTotal = ws.getCell(totalRow, 24);
  netTotal.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF22543D" } };
  netTotal.font = { bold: true, color: { argb: "FFF0FFF4" }, size: 12 };

  // Column widths
  const widths = [10, 26, 20, 18, 8, 12, 12, 12, 12, 12, 12, 12, 13, 12, 11, 11, 11, 11, 13, 13, 13, 11, 12, 15, 14, 18];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  // Auto filter over data
  ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: totalRow - 1, column: headers.length } };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Payroll_Register_${monthName(month)}_${year}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
