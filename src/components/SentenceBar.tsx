"use client";

import { useEffect, useId, useState } from "react";
import { parseSentence } from "@/domain/parser";
import { useBook } from "@/lib/book";
import { SENTENCE } from "@/lib/copy";
import { toEditable } from "@/lib/drafts";
import { useUi } from "./ui/UiProvider";

export function SentenceBar() {
  const { snapshot, store } = useBook();
  const { openDrafts } = useUi();
  const [text, setText] = useState("");
  const [error, setError] = useState(false);
  const [placeholder, setPlaceholder] = useState(0);
  const inputId = useId();
  const errorId = useId();

  useEffect(() => {
    const timer = window.setInterval(() => setPlaceholder((i) => (i + 1) % SENTENCE.placeholders.length), 4_000);
    return () => window.clearInterval(timer);
  }, []);

  const convert = () => {
    const state = snapshot.state;
    if (!state || !store || !text.trim()) return;
    const drafts = parseSentence(text, { today: store.today(), accounts: state.accounts, settings: state.settings });
    if (drafts.length === 0) {
      setError(true);
      return;
    }
    setError(false);
    openDrafts({
      drafts: drafts.map((d, i) => toEditable(d, `${Date.now()}-${i}`)),
      source: "sentence",
      onSaved: () => setText(""),
    });
  };

  return (
    <form
      className="flex flex-col gap-1.5 px-4"
      onSubmit={(e) => {
        e.preventDefault();
        convert();
      }}
    >
      <label htmlFor={inputId} className="text-sm font-medium text-muted">
        {SENTENCE.label}
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          name="sentence"
          autoComplete="off"
          enterKeyHint="go"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(false);
          }}
          onKeyDown={(e) => {
            // Thai IMEs send Enter while composing — don't submit then.
            if (e.key === "Enter" && e.nativeEvent.isComposing) e.preventDefault();
          }}
          placeholder={SENTENCE.placeholders[placeholder]}
          aria-invalid={error}
          aria-describedby={error ? errorId : undefined}
          className="min-h-12 min-w-0 flex-1 rounded-full border border-line bg-card px-4 text-base placeholder:text-muted/80 focus-visible:border-teal"
        />
        <button
          type="submit"
          disabled={!text.trim() || !snapshot.ready}
          className="min-h-12 shrink-0 rounded-full bg-teal px-5 font-semibold text-white disabled:opacity-40"
        >
          {SENTENCE.button}
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-coral-ink">
          {SENTENCE.error}
        </p>
      )}
    </form>
  );
}
