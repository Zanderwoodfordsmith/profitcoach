"use client";

import type { PieceKind, PieceVersion } from "./types";

/**
 * Classes that place a piece on its page (position, margins, show/hide)
 * rather than make its look. Dropped so every preview sits still in its box.
 */
const PLACEMENT =
  /^(?:[a-z0-9-]+:)*(?:fixed|absolute|sticky|relative|inset-.*|top-.*|bottom-.*|left-.*|right-.*|z-.*|-?m[trblxy]?-.*|-?translate-.*|hidden|block|pointer-events-.*|animate-.*|w-screen|h-screen|h-full|min-h-screen|max-h-.*|overflow.*|col-span.*|row-span.*|order-.*|self-.*|shrink.*|grow.*|flex-1|w-full|sr-only|peer|group|opacity-0|invisible)$/;

function look(className: string) {
  return className
    .split(/\s+/)
    .filter((t) => t && !PLACEMENT.test(t))
    .join(" ");
}

function label(text: string, fallback: string) {
  return text && text.length <= 40 ? text : fallback;
}

/** One live version drawn at true size with its real classes. */
export function Preview({ kind, version }: { kind: PieceKind; version: PieceVersion }) {
  const cls = look(version.className);
  const tag = version.tag.toLowerCase();

  switch (kind) {
    case "button":
      // Full-width buttons have no side padding of their own; give them some so they don't squash.
      return (
        <button type="button" tabIndex={-1} className={/(^|\s)(px|p)-/.test(cls) ? cls : `${cls} px-8`}>
          {label(version.text, "Save changes")}
        </button>
      );
    case "badge":
      return <span className={cls}>{label(version.text, "New")}</span>;
    case "header":
      return <h1 className={cls}>{label(version.text, "Page title")}</h1>;
    case "card":
      return (
        <div className={`${cls} w-full max-w-[300px]`}>
          <p className="text-sm font-semibold text-slate-900">Card title</p>
          <p className="mt-1 text-sm text-slate-500">A line of text inside the card.</p>
        </div>
      );
    case "empty":
      return (
        <div className={`${cls} w-full max-w-[300px]`}>
          <p className="text-sm text-slate-500">{label(version.text, "Nothing here yet.")}</p>
        </div>
      );
    case "modal":
      return (
        <div className="relative h-32 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="space-y-2 p-3">
            <div className="h-2 w-3/4 rounded bg-slate-200" />
            <div className="h-2 w-1/2 rounded bg-slate-200" />
            <div className="h-2 w-2/3 rounded bg-slate-200" />
          </div>
          <div className={`${cls} absolute inset-0 flex items-center justify-center`}>
            <div className="h-14 w-28 rounded-lg bg-white shadow-lg" />
          </div>
        </div>
      );
    case "table":
      if (tag === "th") {
        return (
          <table className="border-collapse">
            <thead>
              <tr>
                <th className={cls}>{label(version.text, "Name")}</th>
                <th className={cls}>Status</th>
              </tr>
            </thead>
          </table>
        );
      }
      return (
        <table className={`${cls} max-w-[300px]`}>
          <tbody>
            <tr>
              <td className="px-2 py-1">Row one</td>
              <td className="px-2 py-1">12</td>
            </tr>
          </tbody>
        </table>
      );
    case "field":
      if (tag === "select") {
        return (
          <select className={`${cls} w-64`} defaultValue="a" tabIndex={-1}>
            <option value="a">Choose one</option>
          </select>
        );
      }
      if (tag === "textarea") {
        return <textarea className={`${cls} w-64`} rows={2} readOnly tabIndex={-1} placeholder="Type here" />;
      }
      return <input className={`${cls} w-64`} readOnly tabIndex={-1} placeholder="Type here" />;
  }
}
