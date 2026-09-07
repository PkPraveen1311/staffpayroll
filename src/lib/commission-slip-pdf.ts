import { jsPDF } from "jspdf";
import logoAsset from "@/assets/pehchaan-logo.png.asset.json";

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

const money = (n: any) =>
  "Rs. " + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(n ?? 0));

function numberToWordsIndian(num: number): string {
  num = Math.round(num);
  if (num === 0) return "Zero Rupees Only";
  const a = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const b = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const twoDigit = (n: number): string => (n < 20 ? a[n] : b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : ""));
  const threeDigit = (n: number): string => {
    const h = Math.floor(n / 100), r = n % 100;
    return (h ? a[h] + " Hundred" + (r ? " " : "") : "") + (r ? twoDigit(r) : "");
  };
  let n = num, out = "";
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) out += twoDigit(crore) + " Crore ";
  if (lakh) out += twoDigit(lakh) + " Lakh ";
  if (thousand) out += twoDigit(thousand) + " Thousand ";
  if (n) out += threeDigit(n);
  return out.trim().replace(/\s+/g, " ") + " Rupees Only";
}

export type CommissionSlip = {
  agent: any;
  period: string;
  fixed: number;
  commission: number;
  gross: number;
  tdsRate: number;
  tds: number;
  net: number;
  days?: number | null;
  daysInMonth?: number | null;
  dueDate?: string | null;
  paidDate?: string | null;
};

export async function generateCommissionSlipPdf(s: CommissionSlip) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, H = 297, M = 12;

  const logo = await getLogoData();
  if (logo) { try { doc.addImage(logo, "PNG", M, M, 28, 20); } catch {} }

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
  doc.text(`Commission / Incentive Slip — ${s.period}`, W / 2, M + 22, { align: "center" });

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.4);
  doc.line(M, M + 26, W - M, M + 26);

  let y = M + 32;
  const ag = s.agent ?? {};
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Agent Details", M, y);
  y += 5;
  doc.setDrawColor(210, 210, 210);
  doc.setFillColor(245, 247, 250);
  doc.rect(M, y, W - 2 * M, 22, "FD");

  const pairs: [string, string][] = [
    ["Name", String(ag.full_name ?? "—")],
    ["Agent Code", String(ag.agent_code ?? "—")],
    ["PAN", String(ag.pan ?? "—")],
    ["Bank A/C", String(ag.bank_account ?? "—")],
    ["IFSC", String(ag.ifsc_code ?? "—")],
    ["Pay Type", ag.pay_type === "fixed" ? "Fixed Incentive" : "Commission"],
    ["Paid Days", s.days != null ? `${s.days} / ${s.daysInMonth ?? "—"}` : "—"],
    ["Due / Paid", `${s.dueDate ?? "—"} / ${s.paidDate ?? "—"}`],
  ];
  const colW = (W - 2 * M) / 2;
  doc.setFontSize(8.5);
  pairs.forEach((p, i) => {
    const x = M + 3 + (i % 2) * colW;
    const ry = y + 5 + Math.floor(i / 2) * 4.2;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(110, 110, 110);
    doc.text(`${p[0]}:`, x, ry);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 20, 20);
    doc.text(p[1], x + 26, ry);
  });
  y += 28;

  const rows: [string, number][] = [
    ["Fixed Incentive (attendance based)", s.fixed],
    ["Commission on Sales", s.commission],
    ["Gross Payable", s.gross],
    [`TDS u/s 194H @ ${s.tdsRate}%`, -s.tds],
  ];
  doc.setFillColor(34, 139, 130);
  doc.rect(M, y, W - 2 * M, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("Particulars", M + 3, y + 5);
  doc.text("Amount (Rs.)", W - M - 3, y + 5, { align: "right" });
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  rows.forEach((r, i) => {
    if (i % 2 === 0) { doc.setFillColor(250, 250, 252); doc.rect(M, y, W - 2 * M, 6, "F"); }
    doc.setFont("helvetica", r[0] === "Gross Payable" ? "bold" : "normal");
    doc.text(r[0], M + 3, y + 4.2);
    doc.text(money(r[1]), W - M - 3, y + 4.2, { align: "right" });
    y += 6;
  });
  doc.setDrawColor(200, 200, 200);
  doc.rect(M, y - rows.length * 6 - 7, W - 2 * M, rows.length * 6 + 7);
  y += 6;

  const bannerH = 26;
  doc.setFillColor(34, 139, 130);
  doc.rect(M, y, W - 2 * M, bannerH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("NET PAYABLE", M + 5, y + 7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(money(s.net), W - M - 5, y + 11, { align: "right" });
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text(`(Fixed ${money(s.fixed)} + Commission ${money(s.commission)} - TDS ${money(s.tds)})`, M + 5, y + 13);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text("In words: " + numberToWordsIndian(s.net), M + 5, y + 21, { maxWidth: W - 2 * M - 10 });

  doc.setDrawColor(200, 200, 200);
  doc.line(M, H - M - 12, W - M, H - M - 12);
  doc.setTextColor(120, 120, 120);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.text("Computer-generated commission slip. TDS deducted under Section 194H.", W / 2, H - M - 7, { align: "center" });
  doc.text(`Generated on ${new Date().toLocaleString("en-IN")}`, W / 2, H - M - 3, { align: "center" });

  doc.save(`Commission_Slip_${String(ag.agent_code ?? "AGT")}_${s.period.replace(/\s+/g, "_")}.pdf`);
}
