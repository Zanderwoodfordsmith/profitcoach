"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const COACH_STORAGE_KEY = "boss_impersonate_coach";
const CONTACT_STORAGE_KEY = "boss_impersonate_contact";

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

  useEffect(() => {
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

  const value: ImpersonationContextValue = {
    impersonatingCoachId,
    setImpersonatingCoachId,
    clearImpersonation,
    impersonatingContactId,
    setImpersonatingContactId,
    clearContactImpersonation,
  };

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
