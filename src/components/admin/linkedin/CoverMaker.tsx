"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { buttonClass } from "@/components/ui/Button";
import {
  BACKGROUND_INFO,
  COVER_BACKGROUNDS,
  COVER_TEMPLATES,
  TEMPLATE_INFO,
  type CoverSpec,
  type CoverTemplate,
} from "@/lib/newsletterCover/spec";

type Headers = () => Promise<Record<string, string> | null>;
type Mode = "templates" | "ava" | "upload";

const START: CoverSpec = { template: "behind", background: "mesh", words: { ...TEMPLATE_INFO.behind.example } };

/**
 * "Add a cover photo": pick a template and change its words, let Ava make one
 * from the issue, or upload your own picture. One live preview for all three.
 */
export function CoverMaker({
  open,
  onClose,
  getHeaders,
  issue,
  onUse,
  onUpload,
  showAva,
}: {
  /** "Ava makes it" is admin-only for now. */
  showAva: boolean;
  open: boolean;
  onClose: () => void;
  getHeaders: Headers;
  /** The issue's title and text, for Ava. */
  issue: () => { title: string; text: string };
  onUse: (url: string) => void;
  onUpload: () => void;
}) {
  const [mode, setMode] = useState<Mode>("templates");
  const [spec, setSpec] = useState<CoverSpec>(START);
  const [preview, setPreview] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasPhoto, setHasPhoto] = useState<boolean | null>(null);
  const [avaBusy, setAvaBusy] = useState(false);
  const [avaTried, setAvaTried] = useState<CoverTemplate[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redraw the preview shortly after the last change.
  const key = JSON.stringify(spec);
  const latest = useRef(0);
  useEffect(() => {
    if (!open) return;
    const id = ++latest.current;
    const timer = window.setTimeout(async () => {
      setDrawing(true);
      try {
        const headers = await getHeaders();
        if (!headers) throw new Error("Sign in again to make a cover.");
        const res = await fetch("/api/coach/newsletter/cover", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ spec: JSON.parse(key) }),
        });
        if (!res.ok) throw new Error("Could not draw the cover. Try again.");
        const url = URL.createObjectURL(await res.blob());
        if (id !== latest.current) return URL.revokeObjectURL(url);
        setHasPhoto(res.headers.get("x-cover-photo") === "yes");
        setPreview((old) => {
          if (old) URL.revokeObjectURL(old);
          return url;
        });
        setError(null);
      } catch (err) {
        if (id === latest.current) setError(err instanceof Error ? err.message : "Could not draw the cover.");
      } finally {
        if (id === latest.current) setDrawing(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [key, open, getHeaders]);

  async function askAva(again: boolean) {
    setMode("ava");
    setAvaBusy(true);
    setError(null);
    const avoid = again ? [...avaTried, spec.template] : [];
    try {
      const headers = await getHeaders();
      if (!headers) throw new Error("Sign in again to use Ava.");
      const res = await fetch("/api/coach/newsletter/cover/ava", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ ...issue(), avoid: avoid.length >= COVER_TEMPLATES.length ? [] : avoid }),
      });
      const body = (await res.json().catch(() => ({}))) as { spec?: CoverSpec; error?: string };
      if (!res.ok || !body.spec) throw new Error(body.error || "Ava couldn't make a cover this time. Try again.");
      setAvaTried(avoid.length >= COVER_TEMPLATES.length ? [] : avoid);
      setSpec({ ...body.spec, noPhoto: spec.noPhoto });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ava couldn't make a cover this time.");
    } finally {
      setAvaBusy(false);
    }
  }

  async function use() {
    setSaving(true);
    setError(null);
    try {
      const headers = await getHeaders();
      if (!headers) throw new Error("Sign in again to save the cover.");
      const res = await fetch("/api/coach/newsletter/cover", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ spec, save: true }),
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) throw new Error(body.error || "Could not save the cover. Try again.");
      onUse(body.url);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the cover.");
    } finally {
      setSaving(false);
    }
  }

  function pickTemplate(template: CoverTemplate) {
    setSpec((s) => (s.template === template ? s : { ...s, template, words: { ...TEMPLATE_INFO[template].example } }));
  }

  const info = TEMPLATE_INFO[spec.template];
  const busy = saving || avaBusy;
  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => (m === "ava" && mode !== "ava" ? void askAva(false) : setMode(m))}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${mode === m ? "bg-sky-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
      aria-pressed={mode === m}
    >
      {label}
    </button>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={saving}
      title="Cover photo"
      subtitle={
        showAva
          ? "1920 × 1080, the size LinkedIn asks for. Only admins see Ava makes it for now."
          : "1920 × 1080, the size LinkedIn asks for."
      }
      maxWidthClassName="max-w-5xl"
      // Glass draws on the page body, so the issue's sticky, blurred bars can't trap it.
      glass
    >
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 px-5 py-3">
        {tab("templates", "Templates")}
        {showAva ? tab("ava", "Ava makes it") : null}
        {tab("upload", "Upload your own")}
      </div>

      {mode === "upload" ? (
        <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
          <p className="max-w-sm text-sm text-slate-600">Use your own picture. 1920 × 1080 works best. Keep words in the middle, as the feed trims the edges.</p>
          <button
            type="button"
            className={buttonClass("main")}
            onClick={() => {
              onClose();
              onUpload();
            }}
          >
            <ImagePlus className="h-4 w-4" aria-hidden />
            Choose a picture
          </button>
        </div>
      ) : (
        <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <div className="relative aspect-video overflow-hidden rounded-lg bg-slate-100">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Cover preview" className="h-full w-full object-cover" />
              ) : null}
              {drawing || avaBusy ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/40">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    {avaBusy ? "Ava is making your cover…" : "Drawing…"}
                  </span>
                </div>
              ) : null}
            </div>
            {hasPhoto === false && !spec.noPhoto ? (
              <p className="mt-2 text-xs text-slate-500">
                We haven&apos;t made a cut-out of your photo yet, so it&apos;s left off. Add a profile photo and BCA will make one.
              </p>
            ) : null}
            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            {mode === "ava" ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-slate-600">Ava read your title and issue, picked a design and wrote the words.</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={buttonClass("second", "small")} disabled={busy} onClick={() => void askAva(true)}>
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                    Try another
                  </button>
                  <button type="button" className={buttonClass("second", "small")} disabled={busy} onClick={() => setMode("templates")}>
                    Change the words
                  </button>
                </div>
              </div>
            ) : (
              <>
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Design</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {COVER_TEMPLATES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => pickTemplate(t)}
                        aria-pressed={spec.template === t}
                        className={`rounded-full border px-3 py-1 text-sm transition ${spec.template === t ? "border-sky-600 bg-sky-600 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                      >
                        {TEMPLATE_INFO[t].name}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Background</legend>
                  <div className="flex flex-wrap gap-2">
                    {COVER_BACKGROUNDS.map((b) => (
                      <button
                        key={b}
                        type="button"
                        title={BACKGROUND_INFO[b].name}
                        aria-label={BACKGROUND_INFO[b].name}
                        aria-pressed={spec.background === b}
                        onClick={() => setSpec((s) => ({ ...s, background: b }))}
                        className={`h-9 w-9 rounded-full ring-offset-2 transition ${spec.background === b ? "ring-2 ring-sky-600" : "ring-1 ring-slate-200 hover:ring-slate-400"}`}
                        style={{ background: BACKGROUND_INFO[b].swatch }}
                      />
                    ))}
                  </div>
                </fieldset>
                <fieldset className="grid grid-cols-2 gap-3">
                  <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Words</legend>
                  {info.fields.map((f) => (
                    // Card labels and numbers pair up side by side; other words take the full width.
                    <label key={`${spec.template}-${f.key}`} className={`flex min-w-0 flex-col gap-1 ${/Label$|Value$/.test(f.key) ? "" : "col-span-2"}`}>
                      <span className="text-sm text-slate-700">{f.label}</span>
                      <input
                        id={`cover-${spec.template}-${f.key}`}
                        value={spec.words[f.key] ?? ""}
                        maxLength={f.max}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSpec((s) => ({ ...s, words: { ...s.words, [f.key]: value } }));
                        }}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                      />
                      {f.hint ? <span className="text-xs text-slate-400">{f.hint}</span> : null}
                    </label>
                  ))}
                </fieldset>
              </>
            )}
            {hasPhoto ? (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={!!spec.noPhoto} onChange={(e) => setSpec((s) => ({ ...s, noPhoto: e.target.checked }))} className="h-4 w-4 accent-sky-600" />
                Leave my photo off
              </label>
            ) : null}
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
              <button type="button" className={buttonClass("main")} disabled={busy || drawing || !preview} onClick={() => void use()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Use this cover
              </button>
              {mode === "templates" && showAva ? (
                <button type="button" className={buttonClass("quiet")} disabled={busy} onClick={() => void askAva(false)}>
                  <Sparkles className="h-4 w-4" aria-hidden />
                  Let Ava do it
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
