"use client";

import { useSyncExternalStore } from "react";
import { LocalStorageRepository } from "@/data/repository";
import { BookStore, LOADING_SNAPSHOT, type BookSnapshot } from "@/data/store";

// One store per browser tab. Created lazily on the client; the server always renders the loading snapshot.

let store: BookStore | null = null;

export function getBookStore(): BookStore {
  if (!store) {
    store = new BookStore(new LocalStorageRepository(safeLocalStorage()));
    store.init();
  }
  return store;
}

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const noop = () => () => {};
const loading = () => LOADING_SNAPSHOT;

export function useBook(): { snapshot: BookSnapshot; store: BookStore | null } {
  const isClient = typeof window !== "undefined";
  const s = isClient ? getBookStore() : null;
  const snapshot = useSyncExternalStore(s ? s.subscribe : noop, s ? s.getSnapshot : loading, loading);
  return { snapshot, store: s };
}
