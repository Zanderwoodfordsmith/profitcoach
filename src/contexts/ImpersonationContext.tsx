"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

const COACH_STORAGE_KEY = "boss_impersonate_coach";
const CONTACT_STORAGE_KEY = "boss_impersonate_contact";
const IMPERSONATE_QUERY = "impersonate";
const COACH_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ImpersonationContextValue = {
  impersonatingCoachId: string | null;
  setImpersonatingCoachId: (id: string | null) => void;
  clearImpersonation: () => void;
  impersonatingContactId: string | null;
  setImpersonatingContactId: (id: string | null) => void;
  clearContactImpersonation: () => void;
};

const ImpersonationContext = createContext<ImpersonationContextValue | null>(
  null
);

function impersonateIdFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  if (!window.location.pathname.startsWith("/coach/")) return null;
  try {
    const id = new URLSearchParams(window.location.search)
      .get(IMPERSONATE_QUERY)
      ?.trim();
    return id && COACH_ID_RE.test(id) ? id : null;
  } catch {
    return null;
  }
}

function stripImpersonateQuery() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(IMPERSONATE_QUERY)) return;
  url.searchParams.delete(IMPERSONATE_QUERY);
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", next);
}

function getStoredCoachId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(COACH_STORAGE_KEY);
    return raw && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

function setStoredCoachId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) {
      sessionStorage.setItem(COACH_STORAGE_KEY, id);
    } else {
      sessionStorage.removeItem(COACH_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

function getStoredContactId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CONTACT_STORAGE_KEY);
    return raw && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

function setStoredContactId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) {
      sessionStorage.setItem(CONTACT_STORAGE_KEY, id);
    } else {
      sessionStorage.removeItem(CONTACT_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

export function ImpersonationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [impersonatingCoachId, setCoachState] = useState<string | null>(null);
  const [impersonatingContactId, setContactState] = useState<string | null>(null);

  // useLayoutEffect so `/coach/*` routes see the real impersonation id before paint.
  // A late useEffect caused Community feed read-state to key off the signed-in user
  // for one frame while sessionStorage still held a coach id (or the reverse).
  useLayoutEffect(() => {
    const fromUrl = impersonateIdFromLocation();
    if (fromUrl) {
      setStoredCoachId(fromUrl);
      setStoredContactId(null);
      setCoachState(fromUrl);
      setContactState(null);
      stripImpersonateQuery();
      return;
    }
    setCoachState(getStoredCoachId());
    setContactState(getStoredContactId());
  }, []);

  const setImpersonatingCoachId = useCallback((id: string | null) => {
    setCoachState(id);
    setStoredCoachId(id);
    setContactState(null);
    setStoredContactId(null);
  }, []);

  const clearImpersonation = useCallback(() => {
    setCoachState(null);
    setStoredCoachId(null);
  }, []);

  const setImpersonatingContactId = useCallback((id: string | null) => {
    setContactState(id);
    setStoredContactId(id);
    setCoachState(null);
    setStoredCoachId(null);
  }, []);

  const clearContactImpersonation = useCallback(() => {
    setContactState(null);
    setStoredContactId(null);
  }, []);

  const value = useMemo<ImpersonationContextValue>(
    () => ({
      impersonatingCoachId,
      setImpersonatingCoachId,
      clearImpersonation,
      impersonatingContactId,
      setImpersonatingContactId,
      clearContactImpersonation,
    }),
    [
      impersonatingCoachId,
      setImpersonatingCoachId,
      clearImpersonation,
      impersonatingContactId,
      setImpersonatingContactId,
      clearContactImpersonation,
    ]
  );

  return (
    <ImpersonationContext.Provider value={value}>
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation(): ImpersonationContextValue {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) {
    return {
      impersonatingCoachId: null,
      setImpersonatingCoachId: () => {},
      clearImpersonation: () => {},
      impersonatingContactId: null,
      setImpersonatingContactId: () => {},
      clearContactImpersonation: () => {},
    };
  }
  return ctx;
}
