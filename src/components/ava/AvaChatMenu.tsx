"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, MoreHorizontal, Pencil, Pin, PinOff, Trash2 } from "lucide-react";

import { AvaAction } from "./AvaKit";

export type AvaChatMenuChat = {
  title: string;
  pinned: boolean;
  onPin: (pinned: boolean) => Promise<boolean>;
  onRename: (title: string) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
};

/**
 * The ⋯ on an open chat in Ava's side panel (5 Nov, like Claude's app): open
 * her full page, pin the chat to the top of her chats, rename it (a renamed
 * chat keeps its name) or delete it. A new chat gets a plain Full page button.
 */
export function AvaChatMenu({ onFullPage, chat }: { onFullPage?: () => void; chat: AvaChatMenuChat | null }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"menu" | "rename" | "delete">("menu");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    setStep("menu");
    setFailed(false);
  };

  // Click outside or Escape closes the menu, not the whole panel.
  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      close();
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const run = async (job: () => Promise<boolean>) => {
    setBusy(true);
    setFailed(false);
    const ok = await job();
    setBusy(false);
    if (ok) close();
    else setFailed(true);
  };

  // A new chat has nothing else to offer, so Full page is its own button (wide screens only).
  if (!chat) {
    return onFullPage ? (
      <span className="max-md:hidden">
        <AvaAction iconOnly icon={<Maximize2 className="h-4 w-4" aria-hidden />} label="Full page" onClick={onFullPage} />
      </span>
    ) : null;
  }

  return (
    <div ref={ref} className="relative">
      <AvaAction
        iconOnly
        active={open}
        icon={<MoreHorizontal className="h-4 w-4" aria-hidden />}
        label="More for this chat"
        onClick={() => {
          if (open) return close();
          setName(chat.title);
          setOpen(true);
        }}
      />
      {open ? (
        <div className="ava-menu" role="menu" aria-label="This chat">
          {step === "rename" ? (
            <form
              className="flex flex-col gap-2 p-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                const next = name.trim();
                if (next && next !== chat.title) void run(() => chat.onRename(next));
                else close();
              }}
            >
              <label className="px-1 text-xs font-semibold text-[var(--ava-muted)]" htmlFor="ava-chat-name">
                Name this chat
              </label>
              <input
                id="ava-chat-name"
                autoFocus
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                className="ava-menu-input"
              />
              <div className="flex justify-end gap-1.5">
                <button type="button" onClick={close} className="ava-menu-btn">
                  Cancel
                </button>
                <button type="submit" disabled={busy || !name.trim()} className="ava-menu-btn is-primary">
                  Save
                </button>
              </div>
            </form>
          ) : step === "delete" ? (
            <div className="flex flex-col gap-2 p-1.5">
              <p className="px-1 text-sm leading-5 text-[var(--ava-ink)]">Delete this chat? It goes from your chats for good.</p>
              <div className="flex justify-end gap-1.5">
                <button type="button" onClick={close} className="ava-menu-btn">
                  Cancel
                </button>
                <button type="button" autoFocus disabled={busy} onClick={() => void run(chat.onDelete)} className="ava-menu-btn is-danger">
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <>
              {onFullPage ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    close();
                    onFullPage();
                  }}
                  className="ava-menu-item max-md:hidden"
                >
                  <Maximize2 className="h-4 w-4" aria-hidden />
                  Full page
                </button>
              ) : null}
              {onFullPage ? <hr className="ava-menu-rule max-md:hidden" /> : null}
              <button type="button" role="menuitem" disabled={busy} onClick={() => void run(() => chat.onPin(!chat.pinned))} className="ava-menu-item">
                {chat.pinned ? <PinOff className="h-4 w-4" aria-hidden /> : <Pin className="h-4 w-4" aria-hidden />}
                {chat.pinned ? "Unpin" : "Pin"}
              </button>
              <button type="button" role="menuitem" onClick={() => setStep("rename")} className="ava-menu-item">
                <Pencil className="h-4 w-4" aria-hidden />
                Rename
              </button>
              <hr className="ava-menu-rule" />
              <button type="button" role="menuitem" onClick={() => setStep("delete")} className="ava-menu-item is-danger">
                <Trash2 className="h-4 w-4" aria-hidden />
                Delete
              </button>
            </>
          )}
          {failed ? <p className="px-2.5 pb-1.5 text-xs text-[var(--ava-danger)]">That didn&apos;t save. Try again.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
