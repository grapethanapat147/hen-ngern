import { STATUS } from "@/lib/copy";

const STYLES = {
  actual: "bg-sage-soft text-sage",
  expected: "border border-dashed border-teal text-teal bg-card",
  overdue: "bg-coral-soft text-coral-ink",
  review: "bg-amber-soft text-amber-ink",
} as const;

/** Status is always text + colour, never colour alone. */
export function StatusBadge({ status, className }: { status: keyof typeof STATUS; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]} ${className ?? ""}`}>
      {STATUS[status]}
    </span>
  );
}
