/**
 * UAE compliance primitives. Validators check FORMAT (registries such as FTA / ICA verify identity).
 * Islamic holidays are observed dates and can shift with moon sighting — HR confirms before payroll locks.
 */

export const validTRN = (trn: unknown): boolean => /^\d{15}$/.test(String(trn ?? '').replace(/[\s-]/g, ''));

/** Emirates ID: 784-YYYY-NNNNNNN-C (15 digits, starts 784). */
export const validEmiratesID = (id: unknown): boolean => /^784\d{12}$/.test(String(id ?? '').replace(/[\s-]/g, ''));

/** AE IBAN with real ISO 13616 mod-97 check (not just a regex). */
export function validIbanAE(iban: unknown): boolean {
  const s = String(iban ?? '').replace(/[\s-]/g, '').toUpperCase();
  if (!/^AE\d{21}$/.test(s)) return false;
  const rearranged = s.slice(4) + s.slice(0, 4);
  let rem = 0;
  for (const ch of rearranged) {
    const v = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of v) rem = (rem * 10 + Number(d)) % 97;
  }
  return rem === 1;
}

/** -> +9715XXXXXXXX or null. Accepts 05XXXXXXXX, 9715XXXXXXXX, +9715XXXXXXXX. */
export function normalizeMsisdn(p: unknown): string | null {
  let d = String(p ?? '').replace(/[\s-]/g, '');
  if (/^05\d{8}$/.test(d)) d = '+971' + d.slice(1);
  else if (/^9715\d{8}$/.test(d)) d = '+' + d;
  return /^\+9715\d{8}$/.test(d) ? d : null;
}

/** Digits-only international number for WhatsApp ids (accepts any country). */
export const waId = (p: unknown): string => String(p ?? '').replace(/[^\d]/g, '');

export const HOLIDAYS: Record<number, string[]> = {
  2026: ['2026-01-01', '2026-03-20', '2026-03-21', '2026-03-22', '2026-05-27', '2026-05-28', '2026-06-16', '2026-08-26', '2026-12-02', '2026-12-03'],
  2027: ['2027-01-01', '2027-03-10', '2027-03-11', '2027-05-17', '2027-05-18', '2027-06-06', '2027-08-16', '2027-12-02', '2027-12-03'],
};

/** UAE weekend is Saturday–Sunday (since 2022). */
export function isWorkingDay(iso: string): boolean {
  const d = new Date(iso + 'T00:00:00Z');
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return !(HOLIDAYS[d.getUTCFullYear()] || []).includes(iso);
}

export function addWorkingDays(iso: string, n: number): string {
  let d = new Date(iso + 'T00:00:00Z');
  let left = n;
  while (left > 0) {
    d = new Date(d.getTime() + 86_400_000);
    if (isWorkingDay(d.toISOString().slice(0, 10))) left--;
  }
  return d.toISOString().slice(0, 10);
}

/** Amount in words (English) for tax invoices — AED with fils. */
export function amountInWordsAED(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const below1000 = (n: number): string => {
    const parts: string[] = [];
    if (n >= 100) {
      parts.push(ones[Math.floor(n / 100)] + ' Hundred');
      n %= 100;
    }
    if (n >= 20) {
      parts.push(tens[Math.floor(n / 10)] + (n % 10 ? '-' + ones[n % 10] : ''));
    } else if (n > 0) parts.push(ones[n]);
    return parts.join(' ');
  };
  const words = (n: number): string => {
    if (n === 0) return 'Zero';
    const chunks: [number, string][] = [[1_000_000_000, 'Billion'], [1_000_000, 'Million'], [1_000, 'Thousand'], [1, '']];
    const out: string[] = [];
    for (const [v, name] of chunks) {
      if (n >= v) {
        const q = Math.floor(n / v);
        n %= v;
        out.push(below1000(q) + (name ? ' ' + name : ''));
      }
    }
    return out.join(' ');
  };
  const total = Math.round(Math.abs(amount) * 100);
  const dirhams = Math.floor(total / 100);
  const fils = total % 100;
  return `UAE Dirham ${words(dirhams)}${fils ? ` and ${words(fils)} Fils` : ''} Only`;
}
