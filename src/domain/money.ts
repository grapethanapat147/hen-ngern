import type { Currency, Settings, Transaction } from "./types";

const RATE_SCALE = 1_000_000n;

/** Integer division of a BigInt, rounding half away from zero. */
function divRoundHalfAway(n: bigint, d: bigint): bigint {
  const negative = n < 0n !== d < 0n;
  const an = n < 0n ? -n : n;
  const ad = d < 0n ? -d : d;
  let q = an / ad;
  if ((an % ad) * 2n >= ad) q += 1n;
  return negative ? -q : q;
}

/**
 * Minor units × FX rate → THB minor units, rounded half away from zero.
 * The rate is scaled to an integer (6 dp) and multiplied with BigInt so no float error reaches the result.
 */
export function toThbMinor(amountMinor: number, fxRateToThb: number): number {
  if (fxRateToThb === 1) return amountMinor;
  const rate = BigInt(Math.round(fxRateToThb * 1_000_000));
  return Number(divRoundHalfAway(BigInt(amountMinor) * rate, RATE_SCALE));
}

export const txThbMinor = (tx: Pick<Transaction, "amountMinor" | "fxRateToThb">): number =>
  toThbMinor(tx.amountMinor, tx.fxRateToThb);

/** Current rate from settings; `null` when no usable rate is set (show "รออัตราแลกเปลี่ยน"). */
export function currentRate(currency: Currency, settings: Settings): number | null {
  if (currency === "THB") return 1;
  const rate = settings.fx[currency];
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

/** Expected (≈) THB for a planned amount at today's rate; `null` if the rate is missing. */
export function approxThbMinor(amountMinor: number, currency: Currency, settings: Settings): number | null {
  const rate = currentRate(currency, settings);
  return rate === null ? null : toThbMinor(amountMinor, rate);
}

/**
 * Parse a user-typed amount ("1,234.5", "65") to minor units without float math.
 * Returns null for anything that is not a non-negative number with ≤ 2 decimals.
 */
export function parseAmountToMinor(input: string): number | null {
  const s = input.trim().replace(/,/g, "");
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const whole = Number(m[1]);
  const frac = Number((m[2] ?? "").padEnd(2, "0"));
  return whole * 100 + frac;
}

const PREFIX: Record<Currency, string> = { THB: "฿", USD: "US$", EUR: "€" };

function groupThousands(n: bigint): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** `฿1,234` (no decimals when whole) · `฿1,234.50` · `US$20` · `€9.99`. Negative values get a leading minus sign. */
export function formatMoney(minor: number, currency: Currency): string {
  const abs = BigInt(Math.abs(minor));
  const whole = abs / 100n;
  const frac = abs % 100n;
  const body = frac === 0n ? groupThousands(whole) : `${groupThousands(whole)}.${frac.toString().padStart(2, "0")}`;
  return `${minor < 0 ? "−" : ""}${PREFIX[currency]}${body}`;
}

/** `+฿30` / `−฿30` / `฿0` for differences. */
export function formatSignedThb(minor: number): string {
  if (minor === 0) return formatMoney(0, "THB");
  return minor > 0 ? `+${formatMoney(minor, "THB")}` : formatMoney(minor, "THB");
}
