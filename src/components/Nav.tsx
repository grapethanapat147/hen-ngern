"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TABS } from "@/lib/copy";
import { IconCalendar, IconHome, IconList, IconRepeat, IconTarget } from "./icons";

const ICONS = [IconHome, IconList, IconRepeat, IconCalendar, IconTarget];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="เมนูหลัก" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] nav:hidden">
      <ul className="grid grid-cols-5">
        {TABS.map((tab, i) => {
          const Icon = ICONS[i];
          const active = isActive(pathname, tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] ${active ? "font-semibold text-teal" : "text-muted"}`}
              >
                <Icon className="h-6 w-6" />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <nav aria-label="เมนูหลัก" className="hidden nav:block">
      <ul className="flex flex-col gap-1">
        {TABS.map((tab, i) => {
          const Icon = ICONS[i];
          const active = isActive(pathname, tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 ${active ? "bg-teal-soft font-semibold text-teal" : "text-ink hover:bg-card"}`}
              >
                <Icon className="h-5 w-5" />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
