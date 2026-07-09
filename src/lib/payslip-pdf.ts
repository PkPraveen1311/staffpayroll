import { jsPDF } from "jspdf";
import logoAsset from "@/assets/pehchaan-logo.png.asset.json";
import { fmtINR } from "@/lib/format";

let logoDataCache: string | null = null;
async function getLogoData(): Promise<string | null> {
  if (logoDataCache) return logoDataCache;
  try {
    const res = await fetch(logoAsset.url);
    const blob = await res.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    logoDataCache = data;
    return data;
  } catch {
    return null;
  }
}

const money = (n: any) => {
  const v = Number(n ?? 0);
  return "Rs. " + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(v);
};

function numberToWordsIndian(num: number): string {
  num = Math.round(num);
  if (num === 0) return "Zero Rupees Only";
  const a = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const b = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const twoDigit = (n: number): string => n < 20 ? a[n] : b[Math.floor(n/10)] + (n%10 ? " " + a[n%10] : "");
  const threeDigit = (n: number): string => {
    const h = Math.floor(n/100), r = n%100;
    return (h ? a[h] + " Hundred" + (r ? " " : "") : "") + (r ? twoDigit(r) : "");
  };
  let n = num, out = "";
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const rest = n;
  if (crore) out += twoDigit(crore) + " Crore ";
  if (lakh) out += twoDigit(lakh) + " Lakh ";
  if (thousand) out += twoDigit(thousand) + " Thousand ";
  if (rest) out += threeDigit(rest);
  return out.trim().replace(/\s+/g, " ") + " Rupees Only";
}

export async function generatePayslipPdf(slip: any, period: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const H = 297;
  const M = 12;

  // Logo
  const logo = await getLogoData();
  if (logo) {
    try { doc.addImage(logo, "PNG", M, M, 28, 20); } catch {}
  }

  // Header brand
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(20);
  doc.text("PEHCHAAN", W / 2, M + 8, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text("FEEL GOOD & LOOK GREAT", W / 2, M + 13, { align: "center" });

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text(`Salary Slip — ${period}`, W / 2, M + 22, { align: "center" });

  // Divider
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.4);
  doc.line(M, M + 26, W - M, M + 26);

  // Employee info box
  let y = M + 32;
  const emp = slip.employees ?? {};
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Employee Details", M, y);
  y += 5;
  doc.setDrawColor(210, 210, 210);
  doc.setFillColor(245, 247, 250);
  doc.rect(M, y, W - 2 * M, 22, "FD");

  const infoPairs: [string, string][] = [
    ["Name", String(emp.full_name ?? "—")],
    ["Employee Code", String(emp.employee_code ?? "—")],
    ["Designation", String(emp.designation ?? "—")],
    ["Department", String(emp.department ?? "—")],
    ["PAN", String(emp.pan ?? "—")],
    ["Bank A/C", String(emp.bank_account ?? "—")],
    ["Days Worked", String(slip.days_worked ?? "—")],
    ["Pay Period", period],
  ];
  const colW = (W - 2 * M) / 2;
  doc.setFontSize(8.5);
  infoPairs.forEach((p, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + 3 + col * colW;
    const ry = y + 5 + row * 4.2;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(110, 110, 110);
    doc.text(`${p[0]}:`, x, ry);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 20, 20);
    doc.text(p[1], x + 26, ry);
  });
  y += 26;

  // Earnings & Deductions two-column table
  const earnings: [string, number][] = [
    ["Basic", Number(slip.basic ?? 0)],
    ["HRA", Number(slip.hra ?? 0)],
    ["Medical Allowance", Number(slip.medical_allowance ?? 0)],
    ["Leave Encashment", Number(slip.leave_encashment ?? 0)],
    ["Statutory Bonus", Number(slip.statutory_bonus ?? 0)],
    ["Special Allowance", Number(slip.special_allowance ?? 0)],
    ["Other Allowances", Number(slip.allowances ?? 0)],
    ["Incentive", Number(slip.incentive ?? 0)],
  ];
  const deductions: [string, number][] = [
    ["PF (12% of basic)", Number(slip.pf ?? 0)],
    ["ESI", Number(slip.esi ?? 0)],
    ["TDS", Number(slip.tds ?? 0)],
    ["Advance", Number(slip.advance ?? 0)],
  ];
  const totalEarn = earnings.reduce((s, e) => s + e[1], 0);
  const totalDed = Number(slip.total_deductions ?? 0);
  const net = Number(slip.net_pay ?? 0);

  const tableW = (W - 2 * M - 4) / 2;
  const drawTable = (title: string, rows: [string, number][], total: number, x: number, fillHeader: [number, number, number]) => {
    let ty = y;
    doc.setFillColor(...fillHeader);
    doc.rect(x, ty, tableW, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(title, x + 3, ty + 5);
    doc.setTextColor(255, 255, 255);
    doc.text("Amount (Rs.)", x + tableW - 3, ty + 5, { align: "right" });
    ty += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    rows.forEach((r, i) => {
      if (i % 2 === 0) {
        doc.setFillColor(250, 250, 252);
        doc.rect(x, ty, tableW, 5.5, "F");
      }
      doc.text(r[0], x + 3, ty + 3.8);
      doc.text(money(r[1]), x + tableW - 3, ty + 3.8, { align: "right" });
      ty += 5.5;
    });
    // Total row
    doc.setFillColor(230, 235, 245);
    doc.rect(x, ty, tableW, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.text("Total", x + 3, ty + 4.2);
    doc.text(money(total), x + tableW - 3, ty + 4.2, { align: "right" });
    ty += 6;
    // Border
    doc.setDrawColor(200, 200, 200);
    doc.rect(x, y, tableW, ty - y);
    return ty;
  };

  const endLeft = drawTable("Earnings", earnings, totalEarn, M, [34, 139, 130]);
  const endRight = drawTable("Deductions", deductions, totalDed, M + tableW + 4, [180, 70, 90]);
  y = Math.max(endLeft, endRight) + 6;

  // Employer contributions
  const employer: [string, number][] = [
    ["Employer PF (12%)", Number(slip.employer_pf ?? 0)],
    ["EDLI (0.5%)", Number(slip.edli ?? 0)],
    ["PF Admin Charges (0.5%)", Number(slip.pf_admin_charges ?? 0)],
    ["Employer ESI (3.25%)", Number(slip.employer_esi ?? 0)],
  ];
  const employerTotal = employer.reduce((s, e) => s + e[1], 0);
  const ctc = Number(slip.gross ?? 0) + Number(slip.incentive ?? 0) + employerTotal;

  doc.setFillColor(60, 70, 90);
  doc.rect(M, y, W - 2 * M, 6.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("Employer Contributions", M + 3, y + 4.5);
  doc.text(`Cost to Company: ${money(ctc)}`, W - M - 3, y + 4.5, { align: "right" });
  y += 6.5;

  const colE = (W - 2 * M) / 4;
  doc.setFillColor(248, 249, 252);
  doc.rect(M, y, W - 2 * M, 11, "F");
  doc.setDrawColor(200, 200, 200);
  doc.rect(M, y, W - 2 * M, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 30, 30);
  employer.forEach((e, i) => {
    const x = M + i * colE + 3;
    doc.setTextColor(110, 110, 110);
    doc.text(e[0], x, y + 4.5);
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.text(money(e[1]), x, y + 8.5);
    doc.setFont("helvetica", "normal");
  });
  y += 15;

  // Net Pay banner
  const bannerH = 26;
  doc.setFillColor(34, 139, 130);
  doc.rect(M, y, W - 2 * M, bannerH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("NET PAY", M + 5, y + 7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(money(net), W - M - 5, y + 11, { align: "right" });
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text(`(Gross ${money(slip.gross)} + Incentive ${money(slip.incentive ?? 0)} - Deductions ${money(totalDed)})`, M + 5, y + 13, { maxWidth: W - 2 * M - 10 });
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  const words = "In words: " + numberToWordsIndian(net);
  doc.text(words, M + 5, y + 21, { maxWidth: W - 2 * M - 10 });
  y += bannerH + 4;

  // Footer
  doc.setDrawColor(200, 200, 200);
  doc.line(M, H - M - 12, W - M, H - M - 12);
  doc.setTextColor(120, 120, 120);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.text("This is a computer-generated payslip and does not require a signature.", W / 2, H - M - 7, { align: "center" });
  doc.text(`Generated on ${new Date().toLocaleString("en-IN")}`, W / 2, H - M - 3, { align: "center" });

  const filename = `Payslip_${String(emp.employee_code ?? "EMP")}_${period.replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
}
