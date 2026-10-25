"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";

import { MarkControls, type Save } from "./MarkControls";
import { Preview } from "./Preview";
import { PROPOSED_IDS, ProposedSet } from "./ProposedSet";
import type {
  Inventory,
  Mark,
  PieceFamily,
  PieceKind,
  TextStyle,
} from "./types";

type PartId = "proposed" | PieceKind | "text";

const PARTS: { id: PartId; label: string; plural: string }[] = [
  { id: "proposed", label: "Proposed", plural: "" },
  { id: "button", label: "Buttons", plural: "buttons" },
  { id: "card", label: "Cards", plural: "cards" },
  { id: "header", label: "Page titles", plural: "page titles" },
  { id: "modal", label: "Pop-ups", plural: "pop-up backdrops" },
  { id: "empty", label: "Empty states", plural: "empty states" },
  { id: "table", label: "Tables", plural: "table headings" },
  { id: "field", label: "Form fields", plural: "form fields" },
  { id: "badge", label: "Badges", plural: "badges" },
  { id: "text", label: "Text styles", plural: "text styles" },
];

/** A family counts as common, and needs a mark, from this many uses. */
const COMMON_PIECE = 3;
const COMMON_TEXT = 10;

const SIZE_WORDS: Record<string, string> = {
  xs: "tiny text (12px)",
  sm: "small text (14px)",
  base: "normal text (16px)",
  lg: "large text (18px)",
  xl: "big text (20px)",
};

/** "rounded · white, outlined · text sm" → "rounded · white, outlined · small text (14px)". */
function familyLabel(name: string) {
  return name.replace(
    /text (\[[^\]]+\]|\w+)/g,
    (_, s: string) => SIZE_WORDS[s] ?? `${s.replace(/[[\]]/g, "")} text`,
  );
}

const WEIGHTS: Record<string, number> = {
  thin: 100,
  extralight: 200,
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900,
};

function textLabel(t: TextStyle) {
  return `${+t.px.toFixed(2)}px ${t.weight}`;
}

async function authHeaders(): Promise<Record<string, string> | null> {
  const { data } = await supabaseClient.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

/**
 * Admin → Brand → Design: every live version of the common app pieces,
 * grouped into families, for Zander to mark. His marks become the rules
 * in DESIGN.md. Built from the code by scripts/design-inventory.ts.
 */
export function DesignBoard() {
  const [inv, setInv] = useState<Inventory | null>(null);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [part, setPart] = useState<PartId>("proposed");
  const [showRare, setShowRare] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    import("./inventory.json").then((m) =>
      setInv(m.default as unknown as Inventory),
    );
    (async () => {
      const headers = await authHeaders();
      if (!headers) return setError("Sign in again to load your marks.");
      const res = await fetch("/api/admin/design-marks", { headers });
      if (!res.ok) return setError("Couldn't load your marks.");
      const rows = (await res.json()) as {
        piece_id: string;
        mark: Mark["mark"];
        note: string | null;
      }[];
      setMarks(
        Object.fromEntries(
          rows.map((r) => [r.piece_id, { mark: r.mark, note: r.note ?? "" }]),
        ),
      );
    })();
  }, []);

  const save = useCallback(
    async (id: string, kind: string, label: string, next: Mark) => {
      setMarks((m) => ({ ...m, [id]: next }));
      const headers = await authHeaders();
      const res = headers
        ? await fetch("/api/admin/design-marks", {
            method: "PUT",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({
              pieceId: id,
              kind,
              label,
              mark: next.mark,
              note: next.note,
            }),
          })
        : null;
      setError(res?.ok ? null : "That mark didn't save. Try again.");
    },
    [],
  );

  const progress = useMemo(() => {
    const out = {} as Record<PartId, { marked: number; common: number }>;
    if (!inv) return out;
    for (const p of PARTS) {
      const ids =
        p.id === "proposed"
          ? PROPOSED_IDS
          : p.id === "text"
            ? inv.textStyles
                .filter((t) => t.count >= COMMON_TEXT)
                .map((t) => t.id)
            : inv.families
                .filter((f) => f.kind === p.id && f.count >= COMMON_PIECE)
                .map((f) => f.id);
      out[p.id] = {
        common: ids.length,
        marked: ids.filter((id) => marks[id]?.mark).length,
      };
    }
    return out;
  }, [inv, marks]);

  if (!inv) {
    return (
      <p className="flex items-center gap-2 py-10 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Reading the app…
      </p>
    );
  }

  const current = PARTS.find((p) => p.id === part)!;
  const stats = part === "text" ? null : inv.kinds.find((k) => k.kind === part);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-slate-200 bg-white px-6 py-6 sm:px-8">
        <h2 className="text-2xl tracking-tight">
          <span className="font-light text-slate-500">App design: </span>
          <span className="font-bold text-slate-900">
            what fits, what doesn&apos;t
          </span>
        </h2>
        <p className="mt-2 max-w-[68ch] text-[15px] leading-relaxed text-slate-600">
          Start with Proposed: my short set of buttons, text and cards for the
          whole app. Say yes or not yet to each. The other tabs show every live
          version today, grouped into families of near-copies, so you can see
          what the set replaces. Nothing here changes the live app.
        </p>
        <p className="mt-3 text-xs text-slate-400">
          Read from {inv.files} code files on{" "}
          {new Date(inv.scannedAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
          })}
          . Marketing pages are left out.
        </p>
      </section>

      <nav className="flex flex-wrap gap-2" aria-label="Parts of the app">
        {PARTS.map((p) => {
          const pr = progress[p.id];
          const decided = pr && pr.common > 0 && pr.marked === pr.common;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPart(p.id)}
              aria-pressed={part === p.id}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                part === p.id
                  ? "border-[#0c5290] bg-[#0c5290] text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              {p.label}
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  decided
                    ? "bg-emerald-100 text-emerald-800"
                    : part === p.id
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                {decided ? "Decided" : pr ? `${pr.marked} of ${pr.common}` : ""}
              </span>
            </button>
          );
        })}
      </nav>

      {error ? (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {part === "proposed" ? (
        <ProposedSet inv={inv} marks={marks} save={save} />
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {current.label}
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">
              {stats
                ? `${stats.uses} ${current.plural} in the code, written ${stats.versions} different ways, in ${stats.families} families. Most used first.`
                : `${inv.textStyles.length} size and weight pairs across ${new Set(inv.textStyles.map((t) => t.px)).size} font sizes. Smallest first. A short set is about 8.`}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showRare}
              onChange={(e) => setShowRare(e.target.checked)}
            />
            Show rare ones (used{" "}
            {part === "text" ? `under ${COMMON_TEXT}` : `once or twice`})
          </label>
        </div>
      )}

      {part === "proposed" ? null : part === "text" ? (
        <TextStyles
          styles={inv.textStyles.filter(
            (t) => showRare || t.count >= COMMON_TEXT,
          )}
          marks={marks}
          save={save}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {inv.families
            .filter(
              (f) => f.kind === part && (showRare || f.count >= COMMON_PIECE),
            )
            .map((f) => (
              <FamilyRow key={f.id} family={f} mark={marks[f.id]} save={save} />
            ))}
        </div>
      )}
    </div>
  );
}

function FamilyRow({
  family,
  mark,
  save,
}: {
  family: PieceFamily;
  mark?: Mark;
  save: Save;
}) {
  const [open, setOpen] = useState(false);
  const label = familyLabel(family.name);
  const top = family.versions[0];
  const places = [
    ...new Set(
      family.versions.flatMap((v) =>
        v.uses.map((u) => u.page ?? u.file.replace(/^src\//, "")),
      ),
    ),
  ];

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-h-24 items-center justify-center rounded-xl bg-slate-50 p-6">
          <Preview kind={family.kind} version={top} />
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[15px] font-semibold text-slate-900">{label}</p>
            <p className="mt-0.5 text-sm text-slate-500">
              Used {family.count} {family.count === 1 ? "time" : "times"},
              written {family.versionCount}{" "}
              {family.versionCount === 1 ? "way" : "ways"}.
            </p>
            <p className="mt-1 [overflow-wrap:anywhere] text-xs leading-relaxed text-slate-400">
              {places.slice(0, 3).join(" · ")}
            </p>
          </div>
          <MarkControls
            key={mark?.note ?? ""}
            id={family.id}
            kind={family.kind}
            label={label}
            mark={mark}
            save={save}
          />
        </div>
      </div>
      {family.versionCount > 1 ? (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-sm font-semibold text-[#0c5290] hover:underline"
          >
            {open
              ? "Hide the near-copies"
              : `See the ${family.versionCount - 1} near-copies`}
          </button>
          {open ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {family.versions.slice(1).map((v) => (
                <div
                  key={v.id}
                  className="flex flex-col gap-2 rounded-xl bg-slate-50 p-4"
                >
                  <div className="flex min-h-16 items-center justify-center">
                    <Preview kind={family.kind} version={v} />
                  </div>
                  <p className="[overflow-wrap:anywhere] text-xs text-slate-500">
                    Used {v.count}× ·{" "}
                    {v.uses[0].page ?? v.uses[0].file.replace(/^src\//, "")}
                  </p>
                </div>
              ))}
              {family.versionCount > family.versions.length ? (
                <p className="self-center text-sm text-slate-500">
                  And {family.versionCount - family.versions.length} more, used
                  less.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function TextStyles({
  styles,
  marks,
  save,
}: {
  styles: TextStyle[];
  marks: Record<string, Mark>;
  save: Save;
}) {
  return (
    <div className="flex flex-col divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
      {styles.map((t) => (
        <div
          key={t.id}
          className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_320px]"
        >
          <div className="min-w-0">
            <p
              className="truncate text-slate-900"
              style={{ fontSize: t.px, fontWeight: WEIGHTS[t.weight] ?? 400 }}
            >
              Get your first client in 30 days
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Written as {t.spellings.join(", ")}
              {t.variants.some((v) => v.extra !== "plain")
                ? ` · with ${t.variants
                    .filter((v) => v.extra !== "plain")
                    .map((v) => v.extra)
                    .join(", ")}`
                : ""}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-[15px] font-semibold text-slate-900">
                {textLabel(t)}
              </p>
              <p className="mt-0.5 text-sm text-slate-500">
                Used {t.count} times in {t.files} files.
              </p>
            </div>
            <MarkControls
              key={marks[t.id]?.note ?? ""}
              id={t.id}
              kind="text"
              label={textLabel(t)}
              mark={marks[t.id]}
              save={save}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
