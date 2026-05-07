export const fmtINR = (n: number | string | null | undefined) => {
  const v = typeof n === "string" ? parseFloat(n) : (n ?? 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v || 0);
};

export const monthName = (m: number) =>
  ["January","February","March","April","May","June","July","August","September","October","November","December"][m-1];
