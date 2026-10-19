"use client";

import Link from "next/link";
import {
  useId,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Info, Loader2, X } from "lucide-react";
import "./connectGate.css";

export type ConnectGateAction =
  | { label: string; onClick: () => void; busy?: boolean; busyLabel?: string }
  | { label: string; href: string };

type GateCopy = {
  icon: ReactNode;
  /** Names the thing to connect, e.g. "Connect LinkedIn". */
  title: string;
  /** One or two short lines on what they get once it is connected. */
  description: ReactNode;
  action: ConnectGateAction;
  /** Behind the info button: how connecting works, what else it powers. */
  details?: ReactNode;
};

/** What every LinkedIn gate says behind its info button. */
export const LINKEDIN_CONNECT_DETAILS = (
  <>
    You sign in with your LinkedIn email and password on a secure connect page.
    If you usually sign in to LinkedIn with Google or Outlook, set a LinkedIn
    password first under{" "}
    <a
      href="https://www.linkedin.com/mypreferences/d/change-password"
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-[#0c5290] underline underline-offset-2 hover:text-[#051e36]"
    >
      Sign in &amp; security
    </a>
    . One connection powers Campaigns, Content and Today. You can disconnect it
    any time in Settings.
  </>
);

/** Brand tile for a lucide icon, so non-LinkedIn gates match the LinkedIn mark. */
export function ConnectGateIcon({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="flex h-full w-full items-center justify-center rounded-[22%] bg-gradient-to-br from-[#0c5290] to-[#1a8fd4] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]"
    >
      {children}
    </span>
  );
}

function GateAction({
  action,
  size,
}: {
  action: ConnectGateAction;
  size: "sm" | "md";
}) {
  const className = `connect-gate-action inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 disabled:opacity-60 ${
    size === "sm" ? "h-8 px-3.5 text-xs" : "h-10 px-5 text-sm"
  }`;
  if ("href" in action) {
    return (
      <Link href={action.href} className={className}>
        {action.label}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.busy}
      className={className}
    >
      {action.busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : null}
      {action.busy ? action.busyLabel ?? "Opening…" : action.label}
    </button>
  );
}

function TitleRow({
  title,
  details,
  detailsId,
  open,
  onToggle,
  size,
}: {
  title: string;
  details?: ReactNode;
  detailsId: string;
  open: boolean;
  onToggle: () => void;
  size: "sm" | "md";
}) {
  return (
    <div className="flex items-center gap-1.5">
      <h3
        className={`font-semibold tracking-tight text-slate-900 ${
          size === "sm" ? "text-sm" : "text-base"
        }`}
      >
        {title}
      </h3>
      {details ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          aria-label={open ? "Hide details" : "How this works"}
          onClick={onToggle}
          className={`inline-flex h-6 w-6 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
            open
              ? "bg-white/70 text-[#0c5290]"
              : "text-slate-400 hover:bg-white/60 hover:text-[#0c5290]"
          }`}
        >
          <Info className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function Details({
  id,
  open,
  children,
  size,
}: {
  id: string;
  open: boolean;
  children: ReactNode;
  size: "sm" | "md";
}) {
  return (
    <div id={id} className="connect-gate-more" data-open={open}>
      <div className="min-h-0 overflow-hidden" inert={!open}>
        <p
          className={`mt-2.5 rounded-xl bg-white/55 px-3 py-2.5 text-left leading-relaxed text-slate-600 ring-1 ring-white/80 ${
            size === "sm" ? "text-xs" : "text-[13px]"
          }`}
        >
          {children}
        </p>
      </div>
    </div>
  );
}

function GatePanel({
  icon,
  title,
  description,
  action,
  details,
  size,
}: GateCopy & { size: "sm" | "md" }) {
  const detailsId = useId();
  const [open, setOpen] = useState(false);

  if (size === "sm") {
    return (
      <div
        role="group"
        aria-label={title}
        className="connect-gate-panel w-full max-w-[24rem] rounded-[20px] p-4"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 h-9 w-9 shrink-0">{icon}</span>
          <div className="min-w-0 flex-1">
            <TitleRow
              title={title}
              details={details}
              detailsId={detailsId}
              open={open}
              onToggle={() => setOpen((v) => !v)}
              size="sm"
            />
            <p className="mt-0.5 text-[13px] leading-snug text-slate-600">
              {description}
            </p>
            {details ? (
              <Details id={detailsId} open={open} size="sm">
                {details}
              </Details>
            ) : null}
            <div className="mt-3">
              <GateAction action={action} size="sm" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={title}
      className="connect-gate-panel w-full max-w-[26rem] rounded-[24px] px-6 py-6 text-center sm:px-8"
    >
      <span className="mx-auto block h-11 w-11">{icon}</span>
      <div className="mt-3.5 flex justify-center">
        <TitleRow
          title={title}
          details={details}
          detailsId={detailsId}
          open={open}
          onToggle={() => setOpen((v) => !v)}
          size="md"
        />
      </div>
      <p className="mx-auto mt-1 max-w-[21rem] text-sm leading-relaxed text-slate-600">
        {description}
      </p>
      {details ? (
        <Details id={detailsId} open={open} size="md">
          {details}
        </Details>
      ) : null}
      <div className="mt-5">
        <GateAction action={action} size="md" />
      </div>
    </div>
  );
}

/**
 * Shows a feature that needs a connection as a blurred preview with a glass
 * card on top: what to connect, what they get, and the one button to do it.
 * Unlocked, it renders the children untouched. Wrap only the part that needs
 * the connection, so everything else on the page stays usable.
 */
export function ConnectGate({
  locked,
  size = "md",
  align = "center",
  className,
  contentClassName,
  children,
  ...copy
}: GateCopy & {
  locked: boolean;
  size?: "sm" | "md";
  /** "top" keeps the card in view over tall content. */
  align?: "center" | "top";
  /** Wrapper, incl. its rounding; the gate is never shorter than its card. */
  className?: string;
  /** Layout for the blurred children (e.g. "flex flex-col gap-3"). */
  contentClassName?: string;
  children: ReactNode;
}) {
  if (!locked) return <>{children}</>;
  return (
    <div
      className={`relative isolate grid overflow-hidden ${className ?? ""}`}
    >
      <div
        aria-hidden
        inert
        className={`connect-gate-content col-start-1 row-start-1 ${
          contentClassName ?? ""
        }`}
      >
        {children}
      </div>
      <div className="connect-gate-veil" aria-hidden />
      <div
        className={`relative z-10 col-start-1 row-start-1 flex justify-center ${
          align === "top" ? "items-start" : "items-center"
        } ${
          size === "sm"
            ? "p-3"
            : align === "top"
              ? "p-4 pt-16 sm:p-6 sm:pt-24"
              : "p-4 sm:p-6"
        }`}
      >
        <GatePanel size={size} {...copy} />
      </div>
    </div>
  );
}

function readDismissed(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/**
 * The same glass as a slim bar, for when the page still works without the
 * connection and only adds something once connected. Nothing gets blurred.
 */
export function ConnectNudge({
  className,
  dismissKey,
  ...copy
}: GateCopy & {
  className?: string;
  /** Remembers a close in this browser, so it stops asking. */
  dismissKey?: string;
}) {
  const { icon, title, description, action, details } = copy;
  const detailsId = useId();
  const [open, setOpen] = useState(false);
  const [closedNow, setClosedNow] = useState(false);
  // Hidden on the server and until storage is read, so it never flashes.
  const closedBefore = useSyncExternalStore(
    subscribeStorage,
    () => (dismissKey ? readDismissed(dismissKey) : false),
    () => true
  );

  if (closedNow || closedBefore) return null;

  return (
    <div
      role="group"
      aria-label={title}
      className={`connect-nudge rounded-2xl px-4 py-3 ${className ?? ""}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <span className="h-8 w-8 shrink-0">{icon}</span>
        <div className="min-w-[12rem] flex-1">
          <TitleRow
            title={title}
            details={details}
            detailsId={detailsId}
            open={open}
            onToggle={() => setOpen((v) => !v)}
            size="sm"
          />
          <p className="text-[13px] leading-snug text-slate-600">
            {description}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <GateAction action={action} size="sm" />
          {dismissKey ? (
            <button
              type="button"
              aria-label="Not now"
              onClick={() => {
                setClosedNow(true);
                try {
                  window.localStorage.setItem(dismissKey, "1");
                } catch {
                  // Private mode: it just comes back next visit.
                }
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/70 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
      {details ? (
        <Details id={detailsId} open={open} size="sm">
          {details}
        </Details>
      ) : null}
    </div>
  );
}
