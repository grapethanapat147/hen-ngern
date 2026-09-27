import { CalendarDays, ChevronLeft, ChevronRight, House, List, Repeat, Target, X } from "lucide-react";

// Navigation and UI icons — same Lucide set as the category icons. Decorative: always aria-hidden.

type IconProps = { className?: string };
const common = { "aria-hidden": true, focusable: "false", strokeWidth: 1.8 } as const;

export const IconHome = ({ className }: IconProps) => <House {...common} className={className} />;
export const IconList = ({ className }: IconProps) => <List {...common} className={className} />;
export const IconRepeat = ({ className }: IconProps) => <Repeat {...common} className={className} />;
export const IconCalendar = ({ className }: IconProps) => <CalendarDays {...common} className={className} />;
export const IconTarget = ({ className }: IconProps) => <Target {...common} className={className} />;
export const IconChevron = ({ className, dir = "right" }: IconProps & { dir?: "left" | "right" }) =>
  dir === "right" ? <ChevronRight {...common} className={className} /> : <ChevronLeft {...common} className={className} />;
export const IconClose = ({ className }: IconProps) => <X {...common} className={className} />;
