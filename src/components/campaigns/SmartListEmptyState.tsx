"use client";

import Link from "next/link";
import { Handshake, ListFilter, Star, UserRoundCheck, Users } from "lucide-react";
import type { ReactNode } from "react";

import { ProspectTagChip } from "@/components/prospects/ProspectTagChip";
import { buttonClass } from "@/components/ui/Button";

/** Starting aims for tagging (28 Nov): a first target, and what great looks like. Not a ceiling. */
export const TAG_AIMS: Record<"vip" | "referral", { start: number; great: number; tag: string }> = {
  vip: { start: 50, great: 100, tag: "VIP" },
  referral: { start: 10, great: 20, tag: "Referral" },
};

/**
 * The tagging gauge on the VIP and Referral lists (28 Nov): how many are
 * tagged, against a start line and a great line. It keeps going past both.
 */
export function TagGauge({
  template,
  count,
  referralOff,
  onReferralOff,
}: {
  template: "vip" | "referral";
  count: number;
  referralOff: boolean;
  onReferralOff: (off: boolean) => void;
}) {
  const aim = TAG_AIMS[template];
  if (template === "referral" && referralOff) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700">
        <span>You&apos;ve chosen not to use your network for referrals for now. Nothing is sent from this list.</span>
        <button type="button" onClick={() => onReferralOff(false)} className={buttonClass("second", "small")}>
          Use my network after all
        </button>
      </div>
    );
  }
  const scale = Math.max(aim.great * 1.2, count);
  const pct = (n: number) => `${Math.min(100, (n / scale) * 100)}%`;
  const done = count >= aim.great ? "great" : count >= aim.start ? "started" : "short";
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-slate-200 bg-white px-4 py-2.5 text-sm">
      <span className="text-slate-800">
        <span className="font-semibold tabular-nums">{count.toLocaleString("en-GB")}</span> tagged{" "}
        <ProspectTagChip tag={aim.tag} />
        <span className="text-slate-500">
          {done === "great"
            ? `: past ${aim.great}, keep going`
            : done === "started"
              ? `: past ${aim.start}, now aim for ${aim.great}+`
              : `: aim for ${aim.start} to start, ${aim.great}+ is great`}
        </span>
      </span>
      <span className="relative h-1.5 min-w-40 flex-1 rounded-full bg-slate-200" aria-hidden>
        <span className="absolute inset-y-0 left-0 rounded-full bg-[#1a8fd4]" style={{ width: pct(count) }} />
        {[aim.start, aim.great].map((n) => (
          <span key={n} className="absolute -top-1 h-3.5 w-px bg-slate-500" style={{ left: pct(n) }}>
            <span className="absolute left-1/2 top-4 -translate-x-1/2 text-xs tabular-nums text-slate-500">{n}</span>
          </span>
        ))}
      </span>
      {template === "referral" ? (
        <button type="button" onClick={() => onReferralOff(true)} className="text-xs font-medium text-[#0C5290] hover:underline">
          Not using my network for now
        </button>
      ) : null}
    </div>
  );
}

/**
 * What an empty smart list says (28 Nov). Ready-made lists explain how people
 * get in: Connections offers the import (or LinkedIn first), VIP and Referral
 * show the tag to add. Other smart lists point at their rules.
 */
export function SmartListEmptyState({
  template,
  linkedInConnected,
  hasConnections,
  onImportConnections,
  onShowRules,
  referralOff = false,
  onReferralOff,
}: {
  template: string | null;
  linkedInConnected: boolean;
  /** Anyone in Prospects they're connected to yet. */
  hasConnections: boolean;
  onImportConnections: () => void;
  onShowRules: () => void;
  /** Referral list only: they chose not to use their network for now. */
  referralOff?: boolean;
  onReferralOff?: (off: boolean) => void;
}) {
  const importConnections = linkedInConnected ? (
    <button type="button" onClick={onImportConnections} className={buttonClass("main")}>
      <Users className="h-4 w-4" aria-hidden />
      Import your connections
    </button>
  ) : (
    <Link href="/coach/settings?tab=integrations" className={buttonClass("main")}>
      Connect LinkedIn
    </Link>
  );
  const rulesButton = (
    <button type="button" onClick={onShowRules} className={buttonClass("second")}>
      <ListFilter className="h-4 w-4" aria-hidden />
      See the rules
    </button>
  );

  if (template === "connections" || (template === "connected-owners" && !hasConnections)) {
    const owners = template === "connected-owners";
    return (
      <Shell icon={owners ? <UserRoundCheck className="h-5 w-5" aria-hidden /> : <Users className="h-5 w-5" aria-hidden />}>
        <Heading>{linkedInConnected ? (owners ? "Bring in your connections first" : "Bring in your connections") : "Connect LinkedIn first"}</Heading>
        <Body>
          {linkedInConnected
            ? owners
              ? "Connected owners fills itself from your LinkedIn connections. Import them once and the owners among them show up here."
              : "Everyone you're connected to on LinkedIn lands here. You import them once; new connections then show up by themselves."
            : "Your connections come straight from LinkedIn. Connect it in Settings, under Integrations. It takes about five minutes."}
        </Body>
        <Actions>{importConnections}</Actions>
      </Shell>
    );
  }

  if (template === "connected-owners") {
    return (
      <Shell icon={<UserRoundCheck className="h-5 w-5" aria-hidden />}>
        <Heading>No owners among your connections yet</Heading>
        <Body>
          This list shows connections whose job title says owner, founder, MD or CEO. Some people never fill in their title, so change the
          rules if you want other titles in too.
        </Body>
        <Actions>{rulesButton}</Actions>
      </Shell>
    );
  }

  if (template === "referral" && referralOff) {
    return (
      <Shell icon={<Handshake className="h-5 w-5" aria-hidden />}>
        <Heading>Referrals are off for now</Heading>
        <Body>You chose not to use your network for referrals. Nothing is sent from this list, and nobody will remind you about it.</Body>
        <Actions>
          <button type="button" onClick={() => onReferralOff?.(false)} className={buttonClass("second")}>
            Use my network after all
          </button>
        </Actions>
      </Shell>
    );
  }

  if (template === "vip" || template === "referral") {
    const vip = template === "vip";
    const aim = TAG_AIMS[template];
    return (
      <Shell icon={vip ? <Star className="h-5 w-5" aria-hidden /> : <Handshake className="h-5 w-5" aria-hidden />}>
        <Heading>{vip ? "Tag your VIPs" : "Tag people who could refer you"}</Heading>
        <Body>
          {vip
            ? "VIP is for the few people you'll message personally. Nobody is added for you: you choose them."
            : "Ex-colleagues, suppliers, advisers, and accountants or solicitors who could introduce you. Nobody is added for you: you choose them."}
        </Body>
        <ol className="mx-auto mt-5 flex max-w-sm flex-col gap-2.5 text-left text-sm text-slate-700">
          <Step n={1}>{vip ? "Open Connected owners, or any list." : "Open Connections, or any list."}</Step>
          <Step n={2}>Tick the people you want.</Step>
          <Step n={3}>
            <span className="inline-flex flex-wrap items-center gap-1.5">
              Click <span className="font-semibold text-slate-900">Tags</span> and add
              <ProspectTagChip tag={vip ? "VIP" : "Referral"} size="editor" />
            </span>
          </Step>
        </ol>
        <p className="mt-4 text-sm text-slate-500">
          They show up here straight away. Aim for {aim.start} to start; {aim.great}+ is great.
        </p>
        {vip ? null : (
          <button type="button" onClick={() => onReferralOff?.(true)} className="mt-3 text-sm font-medium text-[#0C5290] hover:underline">
            Not using my network for now
          </button>
        )}
      </Shell>
    );
  }

  return (
    <Shell icon={<ListFilter className="h-5 w-5" aria-hidden />}>
      <Heading>Nobody matches yet</Heading>
      <Body>People join this list by themselves as soon as they match its rules.</Body>
      <Actions>{rulesButton}</Actions>
    </Shell>
  );
}

function Shell({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-12 text-center">
      <span className="mb-4 grid h-11 w-11 place-items-center rounded-full bg-sky-50 text-[#0C5290]">{icon}</span>
      {children}
    </div>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <h3 className="text-subhead font-semibold text-slate-900">{children}</h3>;
}

function Body({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-sm leading-relaxed text-slate-600">{children}</p>;
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>;
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold tabular-nums text-slate-700">{n}</span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}
