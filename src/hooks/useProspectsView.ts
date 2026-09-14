"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProspectsView } from "@/components/prospects/ProspectsViewSwitcher";

const STORAGE_KEY = "pc-prospects-view";

function readStoredView(): ProspectsView {
  if (typeof window === "undefined") return "board";
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("view");
    if (fromQuery === "list" || fromQuery === "board") return fromQuery;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "list" || stored === "board") return stored;
  } catch {
    // ignore
  }
  return "board";
}

function writeView(view: ProspectsView) {
  try {
    window.localStorage.setItem(STORAGE_KEY, view);
    const url = new URL(window.location.href);
    if (view === "board") url.searchParams.delete("view");
    else url.searchParams.set("view", view);
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", next);
  } catch {
    // ignore
  }
}

export function useProspectsView() {
  const [view, setViewState] = useState<ProspectsView>("board");

  useEffect(() => {
    setViewState(readStoredView());
  }, []);

  const setView = useCallback((next: ProspectsView) => {
    setViewState(next);
    writeView(next);
  }, []);

  return { view, setView };
}
