"use client";

import { useState } from "react";
import { PenLine } from "lucide-react";

/** Accept and sign: their full name and a tick. Then the signed record. */
export function ProposalSign({
  token,
  prospectName,
  coachFirstName,
  signed,
}: {
  token: string;
  prospectName: string;
  coachFirstName: string;
  signed: { name: string; at: string } | null;
}) {
  const [done, setDone] = useState(signed);
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <div className="cxp-signed" role="status">
        <p className="cxp-signed__name">{done.name}</p>
        <p>
          Signed on {new Date(done.at).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })}. This proposal is now
          locked. {coachFirstName} will be in touch with your next steps.
        </p>
      </div>
    );
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/proposal/${token}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, agree }),
    });
    const body = (await res.json().catch(() => null)) as { signed_at?: string; signed_name?: string; error?: string } | null;
    setBusy(false);
    if (!res.ok || !body?.signed_at) {
      setError(body?.error ?? "Something went wrong. Please try again.");
      return;
    }
    setDone({ name: body.signed_name ?? name, at: body.signed_at });
  };

  return (
    <>
      <p className="cxp-sign__intro">Happy to go ahead? Type your full name and tick the box. That&apos;s your signature.</p>
      <form
        className="cxp-sign__form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label htmlFor="sign-name">
          Your full name
          <input id="sign-name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={prospectName} />
        </label>
        <label className="cxp-sign__agree" htmlFor="sign-agree">
          <input id="sign-agree" type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>I accept this proposal and its terms.</span>
        </label>
        {error ? (
          <p className="cxp-sign__error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="cxd-btn cxd-btn--solid" disabled={busy || name.trim().length < 2 || !agree}>
          <PenLine size={16} strokeWidth={2} aria-hidden="true" />
          {busy ? "Signing…" : "Accept and sign"}
        </button>
      </form>
    </>
  );
}
