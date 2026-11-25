"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Clock,
  Eye,
  EyeOff,
  ExternalLink,
  Link2,
  Mail,
  MapPin,
  Phone,
  Video,
} from "lucide-react";
import { figtree } from "@/fonts";
import { StartApplyPanelNative } from "@/components/booking/StartApplyPanelNative";
import { Editable } from "@/components/directoryProfile/Editable";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import type { MeetingLocationMode } from "@/lib/booking/locationMode";
import { supabaseClient } from "@/lib/supabaseClient";
import "@/components/beyondlean/v5/book.css";
import "./clean-booking.css";

export type CleanBookingCoach = {
  name: string;
  /** One line under the name, e.g. who they help. Shared with the directory page. */
  summary: string | null;
  photoUrl: string | null;
  email: string | null;
  phone: string | null;
  /** Digits only, from the coach's connected WhatsApp. */
  whatsapp: string | null;
};

export type CleanBookingCall = {
  name: string;
  description: string | null;
  minutes: number;
  location: MeetingLocationMode;
};

/** What the coach has switched off on the page. */
export type BookingPageHidden = {
  phone?: boolean;
  email?: boolean;
  whatsapp?: boolean;
};

const LOCATION: Record<
  MeetingLocationMode,
  { icon: typeof Video; text: string }
> = {
  google_meet: { icon: Video, text: "Google Meet" },
  zoom: { icon: Video, text: "Zoom" },
  phone: { icon: Phone, text: "Phone call" },
  custom: { icon: MapPin, text: "Details come with your booking" },
};

const LENGTHS = [15, 20, 30, 45, 60, 90];

/** UK mobiles read as +44 7815 008224; anything else shows as saved. */
function formatPhone(raw: string) {
  const digits = raw.replace(/[^\d+]/g, "");
  const uk = digits.match(/^\+44(\d{4})(\d{6})$/);
  return uk ? `+44 ${uk[1]} ${uk[2]}` : raw;
}

type SaveState = "saved" | "saving" | "error";
type Patch = {
  name?: string;
  description?: string;
  meeting_duration_minutes?: number;
  directory_summary?: string;
  coach_business_name?: string;
  hidden?: BookingPageHidden;
};

/**
 * A coach's booking page in the BCA look: the coach and the call on a navy band, then one
 * wide white card (form, with the calendar waiting beside it), then how to reach the coach.
 * The form's skin is Paul's, shared with /beyondlean.
 *
 * When the coach (or an admin) opens it signed in, the same page turns editable in place,
 * like the directory page: click the words to change them, with a toolbar to see it live.
 */
export function CleanBookingPage({
  slug,
  calendarSlug,
  intent,
  coach: initialCoach,
  call: initialCall,
  hidden: initialHidden,
  forceLive,
}: {
  slug: string;
  calendarSlug: string;
  intent: "owner" | "discovery";
  coach: CleanBookingCoach;
  call: CleanBookingCall;
  hidden: BookingPageHidden;
  /** ?view=live: exactly what visitors see, with no editing. */
  forceLive: boolean;
}) {
  const [coach, setCoach] = useState(initialCoach);
  const [call, setCall] = useState(initialCall);
  const [hidden, setHidden] = useState<BookingPageHidden>(initialHidden);
  const [editor, setEditor] = useState<{
    actingAsAdmin: boolean;
    coachId: string;
  } | null>(null);
  const [mode, setMode] = useState<"edit" | "live">("live");
  const [save, setSave] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pending = useRef(0);

  const api = `/api/coach/booking-page?slug=${encodeURIComponent(slug)}&calendar=${encodeURIComponent(calendarSlug)}`;

  // Signed in as this coach (or an admin)? Then the page can be edited.
  useEffect(() => {
    if (forceLive) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabaseClient.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const res = await fetch(api, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);
      if (cancelled || !res?.ok) return;
      const body = (await res.json()) as {
        actingAsAdmin: boolean;
        coachId: string;
      };
      setEditor(body);
      // Coaches land ready to edit; admins see the page as visitors do first.
      setMode(body.actingAsAdmin ? "live" : "edit");
    })();
    return () => {
      cancelled = true;
    };
  }, [api, forceLive]);

  const commit = useCallback(
    async (patch: Patch) => {
      pending.current += 1;
      setSave("saving");
      setError(null);
      try {
        const { data } = await supabaseClient.auth.getSession();
        const token = data.session?.access_token;
        if (!token)
          throw new Error(
            "You have been signed out. Sign in again to keep editing.",
          );
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        };
        if (editor?.actingAsAdmin)
          headers["x-impersonate-coach-id"] = editor.coachId;
        const res = await fetch(api, {
          method: "PATCH",
          headers,
          body: JSON.stringify(patch),
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok)
          throw new Error(body.error || "That did not save. Try again.");
        pending.current -= 1;
        if (pending.current === 0) setSave("saved");
      } catch (err) {
        pending.current -= 1;
        setSave("error");
        setError(
          err instanceof Error && err.message
            ? err.message
            : "That did not save. Try again.",
        );
      }
    },
    [api, editor],
  );

  const editing = Boolean(editor) && mode === "edit";
  const where = LOCATION[call.location];
  const WhereIcon = where.icon;
  const initials = coach.name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const showPhone = Boolean(coach.phone) && (editing || !hidden.phone);
  const showEmail = Boolean(coach.email) && (editing || !hidden.email);
  const showWhatsapp = Boolean(coach.whatsapp) && (editing || !hidden.whatsapp);

  /** In edit mode, a small eye to show or hide one way to reach the coach. */
  function toggle(key: keyof BookingPageHidden, label: string) {
    if (!editing) return null;
    const off = Boolean(hidden[key]);
    return (
      <button
        type="button"
        className="cb-eye"
        aria-pressed={!off}
        title={
          off
            ? `${label} is hidden. Click to show it.`
            : `Click to hide your ${label.toLowerCase()}.`
        }
        onClick={() => {
          const next = { ...hidden, [key]: !off };
          setHidden(next);
          void commit({ hidden: next });
        }}
      >
        {off ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        <span>{off ? "Hidden" : "Shown"}</span>
      </button>
    );
  }

  const pageUrl = `/book/${encodeURIComponent(slug)}/${encodeURIComponent(calendarSlug)}`;

  return (
    <main className={`cb ${figtree.className}${editing ? " cb--editing" : ""}`}>
      <header className="cb-band">
        <div className="cb-wrap cb-band-row">
          <div className="cb-call">
            <Editable
              as="h1"
              className="cb-title"
              value={call.name}
              editing={editing}
              label="Call name"
              placeholder="Name of the call"
              maxLength={80}
              onCommit={(next) => {
                if (!next) return;
                setCall((c) => ({ ...c, name: next }));
                void commit({ name: next });
              }}
            />
            <Editable
              className="cb-lead"
              value={call.description ?? ""}
              editing={editing}
              label="What the call is for"
              placeholder="Add a line on what this call is for (optional)"
              multiline
              maxLength={400}
              onCommit={(next) => {
                setCall((c) => ({ ...c, description: next || null }));
                void commit({ description: next });
              }}
            />
            <ul className="cb-facts">
              <li>
                <Clock aria-hidden />
                {editing ? (
                  <select
                    className="cb-length"
                    aria-label="Call length"
                    value={call.minutes}
                    onChange={(e) => {
                      const minutes = Number(e.target.value);
                      setCall((c) => ({ ...c, minutes }));
                      void commit({ meeting_duration_minutes: minutes });
                    }}
                  >
                    {Array.from(new Set([...LENGTHS, call.minutes]))
                      .sort((a, b) => a - b)
                      .map((m) => (
                        <option key={m} value={m}>
                          {m} minutes
                        </option>
                      ))}
                  </select>
                ) : (
                  <>{call.minutes} minutes</>
                )}
              </li>
              <li>
                <WhereIcon aria-hidden /> {where.text}
              </li>
            </ul>
          </div>

          <div className="cb-coach">
            {coach.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="cb-photo"
                src={coach.photoUrl}
                alt=""
                width={64}
                height={64}
              />
            ) : (
              <span className="cb-photo cb-photo--empty" aria-hidden>
                {initials}
              </span>
            )}
            <div className="cb-coach-text">
              <Editable
                className="cb-coach-name"
                value={coach.name}
                editing={editing}
                label="Your name as owners see it"
                placeholder="Your name, e.g. Hilary McNair, Profit Coach"
                maxLength={100}
                onCommit={(next) => {
                  if (!next) return;
                  setCoach((c) => ({ ...c, name: next }));
                  void commit({ coach_business_name: next });
                }}
              />
              <Editable
                className="cb-coach-line"
                value={coach.summary ?? ""}
                editing={editing}
                label="Who you help"
                placeholder="One line on who you help (also on your directory page)"
                multiline
                maxLength={220}
                onCommit={(next) => {
                  setCoach((c) => ({ ...c, summary: next || null }));
                  void commit({ directory_summary: next });
                }}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="cb-wrap cb-body">
        <div className="v5-bk is-light cb-form">
          <StartApplyPanelNative
            variant="page"
            enableLeadCapture
            intent={intent}
            slug={slug}
            calendarSlug={calendarSlug}
            title="Your details"
            lead="Then pick a time that suits you."
          />
        </div>

        {showPhone || showEmail || showWhatsapp ? (
          <footer className="cb-help">
            <p className="cb-help-label">Need help booking?</p>
            <div className="cb-help-links">
              {showPhone && coach.phone ? (
                <span
                  className={`cb-help-item${hidden.phone ? " is-hidden" : ""}`}
                >
                  <a href={`tel:${coach.phone.replace(/[^\d+]/g, "")}`}>
                    <Phone aria-hidden /> {formatPhone(coach.phone)}
                  </a>
                  {toggle("phone", "Phone")}
                </span>
              ) : null}
              {showEmail && coach.email ? (
                <span
                  className={`cb-help-item${hidden.email ? " is-hidden" : ""}`}
                >
                  <a href={`mailto:${coach.email}`}>
                    <Mail aria-hidden /> {coach.email}
                  </a>
                  {toggle("email", "Email")}
                </span>
              ) : null}
            </div>
            {showWhatsapp && coach.whatsapp ? (
              <span
                className={`cb-help-item cb-help-item--wa${hidden.whatsapp ? " is-hidden" : ""}`}
              >
                <a
                  className="cb-whatsapp"
                  href={`https://wa.me/${coach.whatsapp}?text=${encodeURIComponent(
                    `Hi ${coach.name.split(/[\s,]+/)[0]}, I'm trying to book a ${call.name}.`,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <WhatsAppIcon /> Message on WhatsApp
                </a>
                {toggle("whatsapp", "WhatsApp")}
              </span>
            ) : null}
          </footer>
        ) : null}
      </div>

      {editor ? (
        <>
          {error ? (
            <p className="cb-toolbar-error" role="alert">
              {error}
            </p>
          ) : null}
          <div
            className="cb-toolbar"
            role="toolbar"
            aria-label="Edit your booking page"
          >
            <span
              className="cb-toolbar__status"
              data-state={save}
              aria-live="polite"
            >
              <i aria-hidden />
              {save === "saving"
                ? "Saving…"
                : save === "error"
                  ? "Not saved"
                  : "Saved"}
            </span>
            <span className="cb-seg">
              <button
                type="button"
                aria-pressed={mode === "edit"}
                onClick={() => setMode("edit")}
              >
                Edit
              </button>
              <button
                type="button"
                aria-pressed={mode === "live"}
                onClick={() => setMode("live")}
              >
                Live view
              </button>
            </span>
            <button
              type="button"
              className="cb-tbtn"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(`${window.location.origin}${pageUrl}`)
                  .then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1800);
                  });
              }}
            >
              {copied ? <Check aria-hidden /> : <Link2 aria-hidden />}
              {copied ? "Copied" : "Copy link"}
            </button>
            <a
              className="cb-tbtn"
              href={`${pageUrl}?view=live`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink aria-hidden />
              Open live page
            </a>
          </div>
        </>
      ) : null}
    </main>
  );
}
