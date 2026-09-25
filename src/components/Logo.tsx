import { PRODUCT_NAME, TAGLINE } from "@/lib/copy";

/** Temporary mark until the real logo (docs/07-next-tasks.md T9). */
export function Logo({ withTagline = true, wrapTagline = false }: { withTagline?: boolean; wrapTagline?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal text-[13px] font-semibold text-white">
        เห็น
      </span>
      <div className="min-w-0">
        <p className="text-lg leading-tight font-semibold">{PRODUCT_NAME}</p>
        {withTagline && <p className={`text-xs text-muted ${wrapTagline ? "" : "truncate"}`}>{TAGLINE}</p>}
      </div>
    </div>
  );
}
