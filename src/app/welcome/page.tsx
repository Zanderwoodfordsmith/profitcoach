"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  AuthSplitShell,
  authPrimaryButtonClassName,
} from "@/components/auth/AuthSplitShell";
import { WelcomeCelebration } from "@/components/welcome/WelcomeCelebration";
import {
  WelcomeSetupLoading,
  type WelcomeSetupPhase,
} from "@/components/welcome/WelcomeSetupLoading";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import type {
  ProgrammeIntakeGoal,
  ProgrammeIntakeSituation,
  ProgrammeIntakeTimeCommitment,
} from "@/config/programmeIntake";
import { parseProgrammeWelcomePrefill } from "@/config/programmeWelcome";
import { START_HERE_WELCOME_PATH } from "@/lib/academy/classroomIds";
import { supabaseClient } from "@/lib/supabaseClient";

type WelcomeState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      email: string;
      fullName: string;
      phone: string;
      linkedinUrl: string;
      createdAccount: boolean;
      continuePath: string;
      preview: boolean;
      guest: boolean;
    };

function WelcomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clearImpersonation } = useImpersonation();
  const sessionId = searchParams.get("session_id")?.trim() ?? "";
  const isPreview =
    searchParams.get("preview") === "1" ||
    searchParams.get("preview") === "true";
  const ghlPrefill = useMemo(
    () => parseProgrammeWelcomePrefill(searchParams),
    [searchParams]
  );

  const [state, setState] = useState<WelcomeState>({ status: "loading" });
  const [setupPhase, setSetupPhase] = useState<WelcomeSetupPhase>(
    sessionId ? "confirm" : "provision"
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [continueBusy, setContinueBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function runPreview() {
      try {
        setSetupPhase("provision");
        const {
          data: { user },
        } = await supabaseClient.auth.getUser();
        if (!user) {
          throw new Error("Sign in as admin first, then open this preview link.");
        }

        const roleRes = await fetch("/api/profile-role", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        });
        const roleBody = (await roleRes.json().catch(() => ({}))) as {
          role?: string;
          full_name?: string | null;
        };
        if (!roleRes.ok || roleBody.role !== "admin") {
          throw new Error("This preview is only available to admins.");
        }

        clearImpersonation();

        const profileName =
          typeof roleBody.full_name === "string" ? roleBody.full_name.trim() : "";
        const metaName =
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name.trim()
            : "";

        if (cancelled) return;
        setState({
          status: "ready",
          email: user.email ?? "",
          fullName: profileName || metaName || "Zander",
          phone: "",
          linkedinUrl: "",
          createdAccount: true,
          continuePath: START_HERE_WELCOME_PATH,
          preview: true,
          guest: false,
        });
      } catch (error) {
        if (cancelled) return;
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to open welcome preview.",
        });
      }
    }

    async function runCheckout() {
      try {
        setSetupPhase("confirm");
        // Brief beat so "Payment confirmed" reads as a real first step.
        await new Promise((r) => window.setTimeout(r, 350));
        if (cancelled) return;

        setSetupPhase("provision");
        const res = await fetch("/api/membership/welcome", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          email?: string;
          fullName?: string;
          createdAccount?: boolean;
          tokenHash?: string | null;
          continuePath?: string;
        };

        if (!res.ok) {
          throw new Error(body.error ?? "Unable to open your account.");
        }

        if (!body.tokenHash) {
          throw new Error(
            "Login token missing. Please try signing in from the login page."
          );
        }

        if (cancelled) return;
        setSetupPhase("sign_in");

        const { error: otpError } = await supabaseClient.auth.verifyOtp({
          token_hash: body.tokenHash,
          type: "email",
        });

        if (otpError) {
          throw new Error(otpError.message);
        }

        if (cancelled) return;

        setState({
          status: "ready",
          email: body.email ?? "",
          fullName: body.fullName ?? "there",
          phone: "",
          linkedinUrl: "",
          createdAccount: Boolean(body.createdAccount),
          continuePath: body.continuePath ?? START_HERE_WELCOME_PATH,
          preview: false,
          guest: false,
        });
      } catch (error) {
        if (cancelled) return;
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to complete your welcome setup.",
        });
      }
    }

    function runGuest() {
      if (!ghlPrefill) {
        setState({
          status: "error",
          message:
            "Missing checkout session. If you just paid, open the link from your receipt or contact support.",
        });
        return;
      }
      setState({
        status: "ready",
        email: ghlPrefill.email,
        fullName: ghlPrefill.fullName || "there",
        phone: ghlPrefill.phone,
        linkedinUrl: ghlPrefill.linkedinUrl,
        createdAccount: false,
        continuePath: START_HERE_WELCOME_PATH,
        preview: false,
        guest: true,
      });
    }

    if (isPreview) {
      void runPreview();
    } else if (sessionId) {
      void runCheckout();
    } else {
      runGuest();
    }

    return () => {
      cancelled = true;
    };
  }, [clearImpersonation, ghlPrefill, isPreview, sessionId]);

  async function handleSaveIntake(input: {
    linkedinUrl: string;
    situation: ProgrammeIntakeSituation | "";
    goals: ProgrammeIntakeGoal[];
    timeCommitment: ProgrammeIntakeTimeCommitment | "";
  }) {
    if (state.status !== "ready" || state.preview || state.guest) return;

    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("Session expired. Refresh and try again.");

    const res = await fetch("/api/membership/welcome-intake", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        linkedinUrl: input.linkedinUrl || null,
        situation: input.situation || null,
        goals: input.goals,
        timeCommitment: input.timeCommitment || null,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(body.error ?? "Unable to save intake.");
  }

  async function handleContinue() {
    if (state.status !== "ready") return;
    setPasswordError(null);

    if (state.guest) {
      setContinueBusy(true);
      const login = new URL("/login", window.location.origin);
      if (state.email.trim()) {
        login.searchParams.set("email", state.email.trim());
      }
      login.searchParams.set("next", state.continuePath);
      router.push(`${login.pathname}${login.search}`);
      return;
    }

    if (password.length < 8) {
      setPasswordError("Set a password with at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setContinueBusy(true);

    // Preview shows the same password UI; do not change the admin account.
    if (!state.preview) {
      try {
        const { error } = await supabaseClient.auth.updateUser({ password });
        if (error) throw error;
      } catch (error) {
        setPasswordError(
          error instanceof Error ? error.message : "Unable to save password."
        );
        setContinueBusy(false);
        return;
      }
    }

    router.push(state.continuePath);
  }

  if (state.status === "loading") {
    return (
      <WelcomeSetupLoading
        phase={setupPhase}
        detail={
          isPreview
            ? "Loading the post-payment welcome preview…"
            : sessionId
              ? "Payment confirmed — finishing your account so you can get started."
              : "Loading your welcome…"
        }
      />
    );
  }

  if (state.status === "error") {
    return (
      <AuthSplitShell
        title="Almost there"
        subtitle={
          isPreview
            ? "We couldn’t open the welcome preview."
            : "We couldn’t finish automatic sign-in from this checkout link."
        }
      >
        <p className="text-sm text-rose-600" role="alert">
          {state.message}
        </p>
        <button
          type="button"
          className={authPrimaryButtonClassName}
          onClick={() => router.push(isPreview ? "/admin/links" : "/login")}
        >
          {isPreview ? "Back to admin links" : "Go to login"}
        </button>
      </AuthSplitShell>
    );
  }

  const firstName = state.fullName.trim().split(/\s+/)[0] || "there";

  return (
    <WelcomeCelebration
      firstName={firstName}
      fullName={state.fullName}
      email={state.email}
      phone={state.phone}
      initialLinkedinUrl={state.linkedinUrl}
      guest={state.guest}
      preview={state.preview}
      continueBusy={continueBusy}
      passwordError={passwordError}
      password={password}
      confirmPassword={confirmPassword}
      onPasswordChange={setPassword}
      onConfirmPasswordChange={setConfirmPassword}
      onContinue={() => void handleContinue()}
      onSaveIntake={handleSaveIntake}
    />
  );
}

export default function WelcomePage() {
  return (
    <Suspense
      fallback={
        <WelcomeSetupLoading
          phase="confirm"
          detail="Payment confirmed — finishing your account so you can get started."
        />
      }
    >
      <WelcomeInner />
    </Suspense>
  );
}
