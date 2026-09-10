export type LedgerEntry = {
  date: string;
  particulars: string;
  debit: number;
  credit: number;
  balance: number;
};

export type PrintableLedger = {
  name: string;
  code: string;
  entries: LedgerEntry[];
  debit: number;
  credit: number;
  balance: number;
};

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(n || 0));

const esc = (s: string) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

const fmtDate = (d: string) => {
  const t = new Date(d);
  return isNaN(t.getTime()) ? d : t.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

/** Opens a clean printable advance ledger (one running account per person). */
export function printLedgers(title: string, ledgers: PrintableLedger[]) {
  if (!ledgers.length) return;
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const blocks = ledgers.map((l) => `
    <section class="ledger">
      <div class="head">
        <div><span class="name">${esc(l.name)}</span> <span class="code">${esc(l.code)}</span></div>
        <div class="bal">Balance: Rs. ${inr(l.balance)}</div>
      </div>
      <table>
        <thead>
          <tr><th>Date</th><th>Particulars</th><th class="r">Advance (Dr)</th><th class="r">Repaid (Cr)</th><th class="r">Balance</th></tr>
        </thead>
        <tbody>
          ${l.entries.map((e) => `
            <tr>
              <td>${esc(fmtDate(e.date))}</td>
              <td>${esc(e.particulars)}</td>
              <td class="r">${e.debit ? inr(e.debit) : "-"}</td>
              <td class="r">${e.credit ? inr(e.credit) : "-"}</td>
              <td class="r">${inr(e.balance)}</td>
            </tr>`).join("")}
          <tr class="tot">
            <td colspan="2">Total</td>
            <td class="r">${inr(l.debit)}</td>
            <td class="r">${inr(l.credit)}</td>
            <td class="r">${inr(l.balance)}</td>
          </tr>
        </tbody>
      </table>
    </section>`).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 11px; }
    h1 { font-size: 16px; margin: 0; }
    .meta { font-size: 10px; color: #444; margin: 2px 0 14px; }
    .ledger { margin-bottom: 16px; page-break-inside: avoid; }
    .head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
    .name { font-weight: bold; font-size: 12px; }
    .code { font-size: 10px; color: #555; }
    .bal { font-weight: bold; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #999; padding: 3px 6px; }
    thead { background: #eee; }
    .r { text-align: right; }
    .tot { font-weight: bold; background: #f5f5f5; }
  </style></head>
  <body>
    <h1>${esc(title)}</h1>
    <div class="meta">PayPulse — HR &amp; Payroll · Printed ${esc(today)}</div>
    ${blocks}
    <script>window.onload = function () { window.print(); }<\/script>
  </body></html>`;

  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
