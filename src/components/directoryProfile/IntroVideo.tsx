"use client";

import { Play, Plus, Smartphone, Trash2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  VIDEO_MAX_BYTES,
  type DirectoryCoachView,
} from "@/lib/directoryPage/types";
import type { ProfileActions } from "./ProfileBody";

/**
 * The intro video: a play button beside the coach's name that opens the video
 * in a dark modal. Coaches film it upright on their phone, so the modal plays
 * portrait at full height (landscape still fits).
 */
export function IntroVideo({
  view,
  editing,
  actions,
}: {
  view: DirectoryCoachView;
  editing: boolean;
  actions: ProfileActions;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const url = view.extras.video_url;

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  if (!url && !editing) return null;

  async function pick(f: File | undefined) {
    if (!f) return;
    if (f.size > VIDEO_MAX_BYTES) {
      setError(
        "That video is over 300MB. Film a shorter one, or send it to yourself on WhatsApp first to shrink it.",
      );
      return;
    }
    setError(null);
    setBusy(true);
    const err = await actions.video(f);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <>
      <button
        type="button"
        className={`dp-play${url ? "" : " dp-play--add"}`}
        onClick={() => setOpen(true)}
        aria-label={
          url ? `Watch ${view.firstName}'s intro video` : "Add an intro video"
        }
      >
        <span className="dp-play__disc" aria-hidden>
          {url ? <Play /> : <Plus />}
        </span>
        <span className="dp-play__label">
          {url ? "Watch intro" : "Add intro video"}
        </span>
      </button>

      {open
        ? createPortal(
            <div
              className="dp-portal dp-video"
              role="dialog"
              aria-modal="true"
              aria-label="Intro video"
              onClick={() => setOpen(false)}
            >
              <button
                type="button"
                className="dp-video__close"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                <X aria-hidden />
              </button>
              <div
                className="dp-video__body"
                onClick={(e) => e.stopPropagation()}
              >
                {url ? (
                  <video
                    key={url}
                    src={url}
                    controls
                    autoPlay
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <div className="dp-video__empty">
                    <Smartphone aria-hidden />
                    <h2>
                      <span>Say hello</span> on video.
                    </h2>
                    <ul>
                      <li>Film it on your phone, held upright.</li>
                      <li>Keep it to 30 to 90 seconds.</li>
                      <li>
                        Who you help, how you help, and one result you are proud
                        of.
                      </li>
                      <li>Face a window for good light. Somewhere quiet.</li>
                    </ul>
                  </div>
                )}
                {editing ? (
                  <div className="dp-video__tools">
                    <button
                      type="button"
                      className="dp-btn dp-btn--light"
                      disabled={busy}
                      onClick={() => file.current?.click()}
                    >
                      <Upload aria-hidden />
                      {busy
                        ? "Uploading… keep this open"
                        : url
                          ? "Replace video"
                          : "Choose a video"}
                    </button>
                    {url && !busy ? (
                      <button
                        type="button"
                        className="dp-btn dp-btn--ghost"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Take the intro video off your page?",
                            )
                          ) {
                            void actions.extras({ video_url: null });
                            setOpen(false);
                          }
                        }}
                      >
                        <Trash2 aria-hidden />
                        Remove
                      </button>
                    ) : null}
                    <input
                      ref={file}
                      type="file"
                      accept="video/mp4,video/quicktime,video/webm"
                      hidden
                      onChange={(e) => {
                        void pick(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                    {error ? (
                      <p className="dp-video__error" role="alert">
                        {error}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
