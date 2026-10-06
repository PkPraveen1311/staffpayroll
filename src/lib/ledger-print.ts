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
  const styles = getComputedStyle(document.documentElement);
  const tokenNames = ["paper", "ink", "muted", "border", "heading", "heading-fill", "stripe", "total-fill", "positive", "negative"];
  const printTokens = tokenNames.map((name) => `--print-${name}:${styles.getPropertyValue(`--print-${name}`).trim()};`).join("");

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
    :root { ${printTokens} }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: Arial, Helvetica, sans-serif; color: var(--print-ink); background: var(--print-paper); font-size: 11px; }
    h1 { font-size: 16px; margin: 0; color: var(--print-heading); }
    .meta { font-size: 10px; color: var(--print-muted); margin: 2px 0 14px; }
    .ledger { margin-bottom: 16px; page-break-inside: avoid; }
    .head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; color: var(--print-heading); }
    .name { font-weight: bold; font-size: 12px; }
    .code { font-size: 10px; color: var(--print-muted); }
    .bal { font-weight: bold; color: var(--print-positive); }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid var(--print-border); padding: 3px 6px; }
    thead { background: var(--print-heading-fill); color: var(--print-heading); }
    tbody tr:nth-child(even) { background: var(--print-stripe); }
    tbody td:nth-child(3) { color: var(--print-negative); }
    tbody td:nth-child(4) { color: var(--print-positive); }
    .r { text-align: right; }
    .tot { font-weight: bold; background: var(--print-total-fill) !important; color: var(--print-positive); }
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
