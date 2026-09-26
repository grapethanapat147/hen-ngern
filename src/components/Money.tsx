import { approxThbMinor, formatMoney, toThbMinor } from "@/domain/money";
import type { Currency, Settings } from "@/domain/types";

const SPOKEN_UNIT: Record<Currency, string> = { THB: "บาท", USD: "ดอลลาร์สหรัฐ", EUR: "ยูโร" };

/** "419 บาท" — for aria-labels (A11y §9). */
export function spokenMoney(minor: number, currency: Currency = "THB"): string {
  const text = formatMoney(Math.abs(minor), currency).replace(/^[^\d]+/, "");
  return `${minor < 0 ? "ลบ " : ""}${text} ${SPOKEN_UNIT[currency]}`;
}

interface MoneyProps {
  minor: number;
  currency?: Currency;
  /** Spoken prefix, e.g. "รายจ่าย". */
  label?: string;
  sign?: "+" | "−" | "⇄";
  className?: string;
}

export function Money({ minor, currency = "THB", label, sign, className }: MoneyProps) {
  const text = `${sign ?? ""}${formatMoney(minor, currency)}`;
  return (
    <span className={`tabular-nums ${className ?? ""}`} aria-label={[label, spokenMoney(minor, currency)].filter(Boolean).join(" ")}>
      {text}
    </span>
  );
}

interface ForeignProps {
  minor: number;
  currency: Currency;
  settings: Settings;
  /** Locked rate for saved transactions; omit for expected amounts (uses today's rate). */
  lockedRate?: number;
  label?: string;
  className?: string;
}

/** `US$20 ≈ ฿665` — foreign amounts always show baht next to them. */
export function MoneyWithThb({ minor, currency, settings, lockedRate, label, className }: ForeignProps) {
  if (currency === "THB") return <Money minor={minor} label={label} className={className} />;
  const thb = lockedRate !== undefined ? toThbMinor(minor, lockedRate) : approxThbMinor(minor, currency, settings);
  return (
    <span className={className}>
      <Money minor={minor} currency={currency} label={label} />
      {thb === null ? (
        <span className="text-muted"> · รออัตราแลกเปลี่ยน</span>
      ) : (
        <span className="text-muted">
          {" ≈ "}
          <Money minor={thb} />
        </span>
      )}
    </span>
  );
}
