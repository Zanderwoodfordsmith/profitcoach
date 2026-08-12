"use client";

import { useRouter } from "next/navigation";

import {
  AuthSplitShell,
  authPrimaryButtonClassName,
} from "@/components/auth/AuthSplitShell";
import { programmeJoinCheckoutHref } from "@/config/programmeJoin";

export default function JoinCanceledPage() {
  const router = useRouter();

  return (
    <AuthSplitShell
      title="Checkout canceled"
      subtitle="No payment was taken. You can restart whenever you’re ready."
      footer={
        <p className="text-center text-sm text-slate-600">
          Already have an account?{" "}
          <button
            type="button"
            className="font-semibold text-[var(--landing-navy)] underline-offset-4 hover:underline"
            onClick={() => router.push("/login")}
          >
            Log in
          </button>
        </p>
      }
    >
      <button
        type="button"
        className={authPrimaryButtonClassName}
        onClick={() => {
          window.location.assign(programmeJoinCheckoutHref());
        }}
      >
        Continue to payment
      </button>
    </AuthSplitShell>
  );
}
