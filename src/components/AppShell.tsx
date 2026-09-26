"use client";

import type { ReactNode } from "react";
import { Banners } from "./Banners";
import { Logo } from "./Logo";
import { BottomNav, Sidebar } from "./Nav";
import { SentenceBar } from "./SentenceBar";
import { UiProvider } from "./ui/UiProvider";
import { POLICY_SHORT } from "@/lib/copy";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <UiProvider>
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 nav:gap-6 nav:px-6">
        <aside className="hidden w-56 shrink-0 flex-col gap-6 py-6 nav:flex">
          <Logo wrapTagline />
          <Sidebar />
          <p className="mt-auto text-xs text-muted">{POLICY_SHORT}</p>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col gap-3 pb-[calc(80px+env(safe-area-inset-bottom))] nav:pb-8">
          <header className="px-4 pt-3 nav:hidden">
            <Logo />
          </header>
          <div className="flex flex-col gap-3 nav:mx-auto nav:w-full nav:max-w-[1180px] nav:pt-6">
            <SentenceBar />
            <Banners />
            <main className="px-4">{children}</main>
          </div>
        </div>
      </div>
      <BottomNav />
    </UiProvider>
  );
}
