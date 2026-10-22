"use client";

import { Check, ExternalLink, Link2, Monitor, Smartphone } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { InlineGraphic } from "@/lib/coachSite/graphics";
import {
  VIDEO_BUCKET,
  type DirectoryCoachView,
  type DirectoryEditorExtras,
} from "@/lib/directoryPage/types";
import { supabaseClient } from "@/lib/supabaseClient";
import { CoachSwitcher } from "./CoachSwitcher";
import { PhonePreview } from "./PhonePreview";
import {
  ProfileBody,
  type ProfileActions,
  type ProfileFields,
} from "./ProfileBody";
import "./directoryProfile.css";

type Props = {
  slug: string;
  /** The public page, or null when the coach is not listed. */
  initial: DirectoryCoachView | null;
  wheel: InlineGraphic;
  /** ?view=live: show exactly what visitors see, with no editing. */
  forceLive: boolean;
};

type SaveState = "saved" | "saving" | "error";

const PROFILE_TO_VIEW: Record<keyof ProfileFields, keyof DirectoryCoachView> = {
  directory_summary: "summary",
  directory_bio: "bio",
  coach_business_name: "business",
  location: "location",
  directory_listed: "listed",
};

/**
 * The coach directory page. Visitors get the live page. When the signed-in
 * coach opens their own page (or an admin opens any page) the same page turns
 * editable in place, with a toolbar to flip to the live view.
 */
export function CoachProfile({ slug, initial, wheel, forceLive }: Props) {
  const [view, setView] = useState<DirectoryCoachView | null>(initial);
  const [editor, setEditor] = useState<DirectoryEditorExtras | null>(null);
  const [checked, setChecked] = useState(false);
  const [mode, setMode] = useState<"edit" | "live">("live");
  const [save, setSave] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Phone preview: opened fresh each time so it shows the latest saves.
  const [phone, setPhone] = useState<number | null>(null);
  const [drafting, setDrafting] = useState(false);
  const pending = useRef(0);
  const closePhone = useCallback(() => setPhone(null), []);
  // Page extras live in one JSON column the server merges into, so saves go one at a time.
  const extrasQueue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabaseClient.auth.getSession();
      const token = data.session?.access_token;
      // The live view of a listed page needs no sign-in at all.
      if (!token || (forceLive && initial)) {
        if (!cancelled) setChecked(true);
        return;
      }
      const res = await fetch(
        `/api/coach/directory/page?slug=${encodeURIComponent(slug)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      ).catch(() => null);
      if (cancelled) return;
      if (res?.ok) {
        const body = (await res.json()) as {
          view: DirectoryCoachView;
          editor: DirectoryEditorExtras;
        };
        setView(body.view);
        setEditor(body.editor);
        // Coaches land ready to edit; admins browsing other pages see them as visitors do.
        setMode(forceLive || body.editor.actingAsAdmin ? "live" : "edit");
      }
      setChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, initial, forceLive]);

  const headers = useCallback(
    async (json = true): Promise<Record<string, string> | null> => {
      const { data } = await supabaseClient.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return null;
      const h: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (json) h["Content-Type"] = "application/json";
      if (editor?.actingAsAdmin) h["x-impersonate-coach-id"] = editor.coachId;
      return h;
    },
    [editor],
  );

  /** Runs a save and keeps the toolbar status honest across overlapping saves. */
  const track = useCallback(
    async <T,>(
      job: () => Promise<T>,
      failMessage: string,
    ): Promise<T | null> => {
      pending.current += 1;
      setSave("saving");
      setError(null);
      try {
        const out = await job();
        pending.current -= 1;
        if (pending.current === 0) setSave("saved");
        return out;
      } catch (err) {
        pending.current -= 1;
        setSave("error");
        setError(
          err instanceof Error && err.message ? err.message : failMessage,
        );
        return null;
      }
    },
    [],
  );

  async function send(url: string, init: RequestInit, json = true) {
    const h = await headers(json);
    if (!h)
      throw new Error(
        "You have been signed out. Sign in again to keep editing.",
      );
    const res = await fetch(url, { ...init, headers: h });
    const body = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!res.ok)
      throw new Error(typeof body.error === "string" ? body.error : "");
    return body;
  }

  const actions: ProfileActions = {
    profile: (fields) => {
      setView((v) => {
        if (!v) return v;
        const next = { ...v } as Record<string, unknown>;
        for (const [k, val] of Object.entries(fields)) {
          next[PROFILE_TO_VIEW[k as keyof ProfileFields]] =
            typeof val === "string" ? val || null : val;
        }
        return next as DirectoryCoachView;
      });
      void track(
        () =>
          send("/api/coach/profile", {
            method: "PATCH",
            body: JSON.stringify(fields),
          }),
        "That did not save. Try again.",
      );
    },
    extras: async (patch) => {
      const run = extrasQueue.current.then(() =>
        track(
          () =>
            send("/api/coach/directory/page", {
              method: "PATCH",
              body: JSON.stringify({ slug, directory_page: patch }),
            }),
          "That did not save. Try again.",
        ),
      );
      extrasQueue.current = run;
      const body = await run;
      const next = (body?.view as DirectoryCoachView | undefined) ?? null;
      if (next) setView(next);
      return next;
    },
    socials: async (patch) => {
      let message: string | null = null;
      const body = await track(async () => {
        try {
          return await send("/api/coach/share-hub/socials", {
            method: "PATCH",
            body: JSON.stringify(patch),
          });
        } catch (err) {
          message =
            err instanceof Error && err.message
              ? err.message
              : "That link did not save.";
          throw err;
        }
      }, "That link did not save.");
      if (body) {
        setView((v) =>
          v
            ? {
                ...v,
                linkedinUrl: (body.linkedin_url as string | null) ?? null,
                socials:
                  (body.social_links as DirectoryCoachView["socials"]) ?? {},
              }
            : v,
        );
      }
      return body ? null : message;
    },
    photo: async (file) => {
      const form = new FormData();
      form.append("file", file);
      let message: string | null = null;
      const body = await track(async () => {
        try {
          const up = await send(
            "/api/coach/avatar",
            { method: "POST", body: form },
            false,
          );
          // Same storage path every time, so bust caches with a version.
          const url = `${String(up.avatar_url).split("?")[0]}?v=${Date.now()}`;
          await send("/api/coach/profile", {
            method: "PATCH",
            body: JSON.stringify({ avatar_url: url }),
          });
          return url;
        } catch (err) {
          message =
            err instanceof Error && err.message
              ? err.message
              : "That photo did not upload.";
          throw err;
        }
      }, "That photo did not upload.");
      if (body) {
        setView((v) => (v ? { ...v, avatarUrl: body } : v));
        await actions.extras({ photo_focus: null });
      }
      return body ? null : message;
    },
    video: async (file) => {
      let message: string | null = null;
      const publicUrl = await track(async () => {
        try {
          const slot = (await send("/api/coach/directory/page", {
            method: "POST",
            body: JSON.stringify({ slug, type: file.type }),
          })) as { path: string; token: string; publicUrl: string };
          const up = await supabaseClient.storage
            .from(VIDEO_BUCKET)
            .uploadToSignedUrl(slot.path, slot.token, file, { contentType: file.type });
          if (up.error) throw new Error("The video did not upload. Check your connection and try again.");
          return slot.publicUrl;
        } catch (err) {
          message = err instanceof Error && err.message ? err.message : "The video did not upload.";
          throw err;
        }
      }, "The video did not upload.");
      if (!publicUrl) return message;
      const next = await actions.extras({ video_url: publicUrl });
      return next ? null : "The video uploaded but did not save to your page. Try again.";
    },
    draftBio: async () => {
      if (
        view?.bio &&
        !window.confirm(
          "Replace your About text with a new draft from your LinkedIn?",
        )
      )
        return;
      setDrafting(true);
      const body = await track(
        () =>
          send("/api/coach/directory/draft-copy", {
            method: "POST",
            body: JSON.stringify({}),
          }),
        "Could not write a draft. Check your LinkedIn link in the box above, then try again.",
      );
      setDrafting(false);
      const bio =
        typeof body?.directory_bio === "string"
          ? body.directory_bio.trim()
          : "";
      const summary =
        typeof body?.directory_summary === "string"
          ? body.directory_summary.trim()
          : "";
      if (bio) {
        actions.profile(
          view?.summary || !summary
            ? { directory_bio: bio }
            : { directory_bio: bio, directory_summary: summary },
        );
      }
    },
    drafting,
  };

  if (!view) {
    if (!checked) {
      return (
        <div className="dp dp-skeleton" aria-busy="true">
          <aside className="dp-aside" />
          <main className="dp-main" />
        </div>
      );
    }
    return (
      <div className="dp-private">
        <div>
          <h1>
            <span>This coach page</span>
            is not public.
          </h1>
          <p>
            The coach has not added it to the directory yet. You can find
            another Profit Coach in the directory.
          </p>
          <Link className="dp-btn dp-btn--navy" href="/directory">
            See all coaches
          </Link>
        </div>
      </div>
    );
  }

  const canEdit = Boolean(editor) && !forceLive;
  const editing = canEdit && mode === "edit";
  const pageUrl = `/directory/${encodeURIComponent(view.slug)}`;



  return (
    <>
      <div className={`dp${editing ? " dp--editing" : ""}`}>
        <ProfileBody
          view={view}
          editing={editing}
          actions={actions}
          wheel={wheel}
         
        />

        {canEdit ? (
          <>
            {phone !== null ? (
              <PhonePreview
                src={`${pageUrl}?view=live&preview=${phone}`}
                onClose={closePhone}
              />
            ) : null}
            {error ? (
              <p className="dp-toolbar-error" role="alert">
                {error}
              </p>
            ) : null}
            <div
              className="dp-toolbar"
              role="toolbar"
              aria-label="Edit your page"
            >
              {editor?.coaches ? (
                <CoachSwitcher
                  coaches={editor.coaches}
                  current={view.slug}
                  label={editor.actingAsAdmin ? `${view.firstName}'s page` : "Your page"}
                />
              ) : null}
              <span
                className="dp-toolbar__status"
                data-state={save}
                aria-live="polite"
              >
                <i aria-hidden />
                <span className="dp-toolbar__label">
                  {editor?.actingAsAdmin && !editor.coaches
                    ? `${view.firstName}'s page · `
                    : ""}
                  {save === "saving"
                    ? "Saving…"
                    : save === "error"
                      ? "Not saved"
                      : "Saved"}
                </span>
              </span>
              <span className="dp-seg">
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
              <span className="dp-seg dp-seg--device">
                <button
                  type="button"
                  aria-pressed={phone === null}
                  aria-label="Desktop"
                  title="Desktop"
                  onClick={() => setPhone(null)}
                >
                  <Monitor aria-hidden />
                </button>
                <button
                  type="button"
                  aria-pressed={phone !== null}
                  aria-label="Phone preview"
                  title="Phone preview"
                  onClick={() => setPhone(Date.now())}
                >
                  <Smartphone aria-hidden />
                </button>
              </span>
              <button
                type="button"
                className="dp-tbtn"
                role="switch"
                aria-checked={view.listed}
                onClick={() =>
                  actions.profile({ directory_listed: !view.listed })
                }
                title={
                  view.listed
                    ? "Owners can find your page in the directory. Switch off to hide it."
                    : "Only you can see your page. Switch on to show it in the directory."
                }
              >
                <span className="dp-switch" data-on={view.listed} aria-hidden />
                <span className="dp-toolbar__label">In directory</span>
              </button>
              <button
                type="button"
                className="dp-tbtn"
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
                <span className="dp-toolbar__label">
                  {copied ? "Copied" : "Copy link"}
                </span>
              </button>
              <a
                className="dp-tbtn"
                href={`${pageUrl}?view=live`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink aria-hidden />
                <span className="dp-toolbar__label">Open live page</span>
              </a>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
