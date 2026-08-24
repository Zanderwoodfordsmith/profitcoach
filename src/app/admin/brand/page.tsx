"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";

import { StickyPageHeader } from "@/components/layout/StickyPageHeader";
import { NineStepRoadmap } from "@/components/profitSystem/NineStepRoadmap";
import { OwnerLevelsDiagram } from "@/components/profitSystem/OwnerLevelsDiagram";
import { ProfitPillarsHexagons } from "@/components/profitSystem/ProfitPillarsHexagons";
import { ProgramPyramid } from "@/components/profitSystem/ProgramPyramid";
import { AreaIcon } from "@/components/profitSystem/elements/AreaIcon";
import { IsoHexagon } from "@/components/profitSystem/elements/IsoHexagon";
import { StepCard } from "@/components/profitSystem/elements/StepCard";
import {
  ACCELERATORS,
  AREA_ICON_SET,
  OWNER_LEVELS,
  PILLARS,
  PS_TONES,
  type DiagramIcon,
  type PillarKey,
} from "@/components/profitSystem/profitSystemData";
import {
  PROFIT_COACH_OUTPUTS,
  PROFIT_COACH_ROLES,
} from "@/lib/profitCoachAi/registry";
import { supabaseClient } from "@/lib/supabaseClient";

const TABS = [
  { key: "typography", label: "Typography" },
  { key: "graphics", label: "Graphics" },
  { key: "model", label: "Model" },
  { key: "frameworks", label: "Frameworks" },
  { key: "brain", label: "Core brain" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const FRAMEWORK_TABS = [
  { key: "three-pillars", label: "Three Pillars" },
  { key: "five-levels", label: "Five Levels" },
  { key: "nine-steps", label: "Nine Steps" },
  { key: "reports", label: "Reports" },
] as const;
type FrameworkKey = (typeof FRAMEWORK_TABS)[number]["key"];

const PILLAR_TONE: Record<PillarKey, "navy" | "blue" | "teal"> = {
  vision: "navy",
  velocity: "blue",
  value: "teal",
};

const SWATCHES: { name: string; hex: string; usage: string }[] = [
  { name: "Navy — Vision", hex: PS_TONES.navy.base, usage: "Primary brand blue; Vision pillar; headers and CTAs" },
  { name: "Blue — Velocity", hex: PS_TONES.blue.base, usage: "Velocity pillar; accents, links, icon highlights" },
  { name: "Teal — Value", hex: PS_TONES.teal.base, usage: "Value pillar; success and long-term value" },
  { name: "Ink", hex: PS_TONES.ink.base, usage: "Icon outlines, dark panels, body headings" },
  { name: "Violet", hex: PS_TONES.violet.base, usage: "Sparingly — community / bonus elements" },
  { name: "Canvas", hex: "#f8fafc", usage: "Page background (slate-50)" },
];

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-6 py-6 sm:px-8">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {hint ? <p className="mt-1 text-sm text-slate-500">{hint}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function TypographyTab() {
  return (
    <div className="flex flex-col gap-4">
      <Section
        title="Typefaces"
        hint="What the product and marketing surfaces actually run on."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-3xl font-bold text-slate-900" style={{ fontFamily: "Outfit, sans-serif" }}>
              Outfit
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Display
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Marketing headlines, reports, AI studio.
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-3xl font-bold text-slate-900">Geist Sans</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Body / UI
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Product UI and body copy everywhere.
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="font-mono text-3xl font-bold text-slate-900">
              Geist Mono
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Mono
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Numbers, scores, code-ish detail.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Scale" hint="The working hierarchy used across marketing and reports.">
        <div className="flex flex-col gap-4">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-700">
            Kicker — uppercase, tracked, sky-700
          </p>
          <p className="text-4xl font-bold tracking-tight text-slate-900">
            Display — bold, tight tracking
          </p>
          <p className="text-2xl font-semibold text-slate-900">
            Heading — semibold slate-900
          </p>
          <p className="text-lg font-semibold text-slate-900">
            Subheading — semibold, one size down
          </p>
          <p className="max-w-xl text-base leading-relaxed text-slate-600">
            Body — slate-600, relaxed leading. Written to the owner in their
            language: diagnostic, specific, maths-friendly. No hype urgency.
          </p>
          <p className="text-sm text-slate-500">Support — slate-500 small.</p>
        </div>
      </Section>
    </div>
  );
}

function GraphicsTab() {
  return (
    <div className="flex flex-col gap-4">
      <Section title="Colours" hint="Pillar colours carry meaning — don't reassign them.">
        <div className="grid gap-3 sm:grid-cols-3">
          {SWATCHES.map((s) => (
            <div key={s.name} className="overflow-hidden rounded-xl ring-1 ring-slate-200">
              <div className="h-14" style={{ backgroundColor: s.hex }} />
              <div className="px-3 py-2.5">
                <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                <p className="font-mono text-xs text-slate-400">{s.hex}</p>
                <p className="mt-1 text-xs text-slate-500">{s.usage}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Area icons (10)"
        hint="Ink outline glyphs — placeholders from the app icon set until the custom brand set lands."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {AREA_ICON_SET.map((a) => (
            <div
              key={a.id}
              className="flex flex-col items-center gap-2 rounded-xl bg-slate-50 px-2 py-4"
            >
              <AreaIcon icon={a.icon} className="h-10 w-10" />
              <p className="text-center text-xs font-semibold leading-tight text-slate-700">
                {a.id === 0 ? "+" : a.id} · {a.name}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Step cards — all nine"
        hint="Header band + chevron, icon body, transformation footer. Toned by pillar."
      >
        <div className="flex flex-wrap gap-4">
          {ACCELERATORS.map((a) => (
            <StepCard
              key={a.step}
              eyebrow={`Step ${a.step}`}
              title={a.name}
              icon={a.icon}
              tone={PILLAR_TONE[a.pillar]}
              footer={`${a.from} → ${a.to}`}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Cube hexagons — pillars + all nine"
        hint="Bevelled variant: icon centred on the top face, name centred across the two front sides."
      >
        <div className="flex flex-wrap items-end gap-4">
          {(Object.keys(PILLARS) as PillarKey[]).map((p) => (
            <IsoHexagon
              key={p}
              variant="cube"
              tone={PILLAR_TONE[p]}
              icon={PILLARS[p].icon}
              label={PILLARS[p].label}
              className="w-40"
            />
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {ACCELERATORS.map((a) => (
            <IsoHexagon
              key={a.step}
              variant="cube"
              tone={PILLAR_TONE[a.pillar]}
              icon={a.icon}
              label={a.name}
              className="w-28"
            />
          ))}
        </div>
      </Section>

      <Section
        title="Flat hexagons — pillars + all nine"
        hint="Single full colour: icon and name centred together."
      >
        <div className="flex flex-wrap items-end gap-4">
          {(Object.keys(PILLARS) as PillarKey[]).map((p) => (
            <IsoHexagon
              key={p}
              variant="flat"
              tone={PILLAR_TONE[p]}
              icon={PILLARS[p].icon}
              label={PILLARS[p].label}
              className="w-40"
            />
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {ACCELERATORS.map((a) => (
            <IsoHexagon
              key={a.step}
              variant="flat"
              tone={PILLAR_TONE[a.pillar]}
              icon={a.icon}
              label={a.name}
              className="w-28"
            />
          ))}
        </div>
      </Section>
    </div>
  );
}

function FrameworkVersion({
  title,
  useCase,
  children,
}: {
  title: string;
  useCase: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
          {useCase}
        </p>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const REPORT_PREVIEWS: { title: string; useCase: string; href: string }[] = [
  {
    title: "BOSS Scorecard results",
    useCase:
      "What a business owner sees after the 13-question scorecard — the front-end lead magnet result.",
    href: "/preview/scorecard-results?preview=1&coach=pam",
  },
  {
    title: "Boss Pro report",
    useCase:
      "The full 50-question diagnostic report — the deep-dive a coach walks a prospect through on a call.",
    href: "/preview/boss-pro-report?preview=1&coach=BCA",
  },
  {
    title: "BOSS report (design system)",
    useCase:
      "The report design language: brand canvas, glass hero, pillar/level/area charts.",
    href: "/preview/report-design-system",
  },
];

function FrameworksTab({
  framework,
  setFramework,
}: {
  framework: FrameworkKey;
  setFramework: (f: FrameworkKey) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {FRAMEWORK_TABS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFramework(f.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
              framework === f.key
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {framework === "three-pillars" ? (
        <Section
          title="The Three Pillars"
          hint="Vision, Velocity, Value — the simplest true explanation of the model. Start here with anyone new; everything else is an expansion of this."
        >
          <div className="flex flex-col gap-10">
            <FrameworkVersion
              title="Pillars only"
              useCase="The ten-second version — first mention on the homepage, in a talk, or opening a diagnostic conversation. Animates into the full system below."
            >
              <ProfitPillarsHexagons showAccelerators={false} />
            </FrameworkVersion>
            <FrameworkVersion
              title="The full Profit System"
              useCase="The model reveal — pillars plus all nine accelerators. Homepage centrepiece and 'how it all fits together' moment on sales calls."
            >
              <ProfitPillarsHexagons showAccelerators />
            </FrameworkVersion>
            <FrameworkVersion
              title="Pillar strip"
              useCase="Compact cube-hexagon trio for slide headers, report sections, and social graphics."
            >
              <div className="flex flex-wrap gap-4">
                {(["vision", "velocity", "value"] as PillarKey[]).map((p) => (
                  <IsoHexagon
                    key={p}
                    variant="cube"
                    tone={PILLAR_TONE[p]}
                    icon={PILLARS[p].icon}
                    label={PILLARS[p].label}
                    className="w-36"
                  />
                ))}
              </div>
            </FrameworkVersion>
          </div>
        </Section>
      ) : null}

      {framework === "five-levels" ? (
        <Section
          title="The Five Levels of Business Owner"
          hint="Overwhelm → Overworked → Organised → Overseer → Owner. The wake-up call: owners instantly place themselves on it. Use early — it creates the gap the programme closes."
        >
          <FrameworkVersion
            title="Levels staircase"
            useCase="Assessment results, homepage 'which one are you?', and the opening of a diagnostic call. The level copy is canonical — same words everywhere."
          >
            <OwnerLevelsDiagram />
          </FrameworkVersion>
        </Section>
      ) : null}

      {framework === "nine-steps" ? (
        <Section
          title="The Nine Steps"
          hint="The journey through the nine accelerators — the programme promise. Use after the pillars have landed: this is 'here's exactly what we'll do, in order'."
        >
          <div className="flex flex-col gap-10">
            <FrameworkVersion
              title="Roadmap cards"
              useCase="The step-by-step sell: today's business → ideal business, with the transformation named on every card. Numbers read top-left to bottom-right."
            >
              <NineStepRoadmap />
            </FrameworkVersion>
            <FrameworkVersion
              title="Programme pyramid"
              useCase="The climb view — Going Pro at the base, accelerators installed stage by stage, owner levels rising alongside. Best for explaining why the order matters."
            >
              <ProgramPyramid />
            </FrameworkVersion>
          </div>
        </Section>
      ) : null}

      {framework === "reports" ? (
        <Section
          title="Reports"
          hint="Where the frameworks meet a real business — the assessment outputs prospects actually receive. Open in a new tab (live previews with demo data)."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {REPORT_PREVIEWS.map((r) => (
              <a
                key={r.href}
                href={r.href}
                target="_blank"
                rel="noreferrer"
                className="group rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-4 transition hover:border-sky-300 hover:bg-sky-50/50"
              >
                <p className="text-sm font-semibold text-slate-900 group-hover:text-sky-800">
                  {r.title} →
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                  {r.useCase}
                </p>
              </a>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}

type ModelEntity = {
  id: string;
  kind: "Pillars" | "Levels" | "Areas";
  name: string;
  facts: string;
  icon?: DiagramIcon;
  color: string;
};

const MODEL_ENTITIES: ModelEntity[] = [
  ...(Object.keys(PILLARS) as PillarKey[]).map((p) => ({
    id: `pillar-${p}`,
    kind: "Pillars" as const,
    name: PILLARS[p].label,
    facts: PILLARS[p].tagline,
    icon: PILLARS[p].icon,
    color: PILLARS[p].color,
  })),
  ...OWNER_LEVELS.map((l) => ({
    id: `level-${l.id}`,
    kind: "Levels" as const,
    name: `${l.id} · ${l.name}`,
    facts: l.description,
    color: "#0c5290",
  })),
  ...AREA_ICON_SET.map((a) => {
    const accel = ACCELERATORS.find((x) => x.step === a.id);
    return {
      id: `area-${a.id}`,
      kind: "Areas" as const,
      name: `${a.id === 0 ? "+" : a.id} · ${a.name}`,
      facts: accel
        ? `${accel.from} → ${accel.to}`
        : "The foundation — the owner's own readiness, scored alongside the nine areas.",
      icon: a.icon,
      color: a.color,
    };
  }),
];

type ModelEntryImage = { path: string; url: string; caption: string | null };
type ModelEntry = {
  entry_id: string;
  copy_md: string | null;
  images: ModelEntryImage[];
};

function ModelTab() {
  const [entries, setEntries] = useState<Record<string, ModelEntry>>({});
  const [activeId, setActiveId] = useState<string>(MODEL_ENTITIES[0].id);
  const [copyDraft, setCopyDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [caption, setCaption] = useState("");

  const authHeaders = useCallback(async (): Promise<Record<
    string,
    string
  > | null> => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return null;
    return { Authorization: `Bearer ${session.access_token}` };
  }, []);

  const load = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch("/api/admin/brand-model", { headers });
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const body = (await res.json()) as { entries?: ModelEntry[] };
    const map: Record<string, ModelEntry> = {};
    for (const e of body.entries ?? []) map[e.entry_id] = e;
    setEntries(map);
    setLoading(false);
  }, [authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  const entity = MODEL_ENTITIES.find((e) => e.id === activeId)!;
  const entry = entries[activeId];

  useEffect(() => {
    setCopyDraft(entries[activeId]?.copy_md ?? "");
    setStatus(null);
    setCaption("");
  }, [activeId, entries]);

  async function saveCopy() {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch("/api/admin/brand-model", {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ entry_id: activeId, copy_md: copyDraft }),
      });
      setStatus(res.ok ? "Copy saved." : "Save failed.");
      if (res.ok) await load();
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(file: File) {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const form = new FormData();
      form.set("entry_id", activeId);
      form.set("file", file);
      if (caption.trim()) form.set("caption", caption.trim());
      const res = await fetch("/api/admin/brand-model/image", {
        method: "POST",
        headers,
        body: form,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setStatus(body.error || "Upload failed.");
        return;
      }
      setCaption("");
      setStatus("Image uploaded.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function deleteImage(path: string) {
    if (busy || !window.confirm("Remove this image?")) return;
    setBusy(true);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      await fetch(
        `/api/admin/brand-model/image?entry_id=${encodeURIComponent(activeId)}&path=${encodeURIComponent(path)}`,
        { method: "DELETE", headers }
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  const copyDirty = copyDraft !== (entry?.copy_md ?? "");

  return (
    <div className="flex flex-col gap-4">
      <Section
        title="The model, part by part"
        hint="Depth per part: canonical copy plus reusable images (slide visuals, illustrations) for content, blogs and decks. Image counts show what's stocked."
      >
        {(["Pillars", "Levels", "Areas"] as const).map((kind) => (
          <div key={kind} className="mt-2 first:mt-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              {kind}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5 pb-2">
              {MODEL_ENTITIES.filter((e) => e.kind === kind).map((e) => {
                const count = entries[e.id]?.images?.length ?? 0;
                const hasCopy = Boolean(entries[e.id]?.copy_md?.trim());
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setActiveId(e.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      activeId === e.id
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {e.name}
                    {count > 0 ? (
                      <span
                        className={`ml-1.5 font-normal ${activeId === e.id ? "text-slate-300" : "text-slate-400"}`}
                      >
                        {count} img
                      </span>
                    ) : null}
                    {hasCopy ? (
                      <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-sky-400 align-middle" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {loading ? (
          <p className="py-6 text-sm text-slate-500">Loading model…</p>
        ) : (
          <div className="mt-4 border-t border-slate-100 pt-5">
            <div className="flex items-start gap-3">
              {entity.icon ? (
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${entity.color}1a` }}
                >
                  <entity.icon
                    className="h-5 w-5"
                    style={{ color: entity.color }}
                  />
                </span>
              ) : null}
              <div>
                <p className="text-base font-semibold text-slate-900">
                  {entity.name}
                </p>
                <p className="text-sm text-slate-500">{entity.facts}</p>
              </div>
            </div>

            <h3 className="mt-5 text-sm font-semibold text-slate-900">
              How we talk about it
            </h3>
            <textarea
              value={copyDraft}
              onChange={(e) => setCopyDraft(e.target.value)}
              rows={6}
              placeholder="The canonical copy for this part — the paragraphs you'd want in a blog post, a lesson, or a deck. The AI will draw on this."
              className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:outline-none"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void saveCopy()}
                disabled={busy || !copyDirty}
                className="rounded-lg bg-sky-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-40"
              >
                Save copy
              </button>
              {status ? (
                <span className="text-sm font-medium text-slate-600">
                  {status}
                </span>
              ) : null}
            </div>

            <h3 className="mt-6 text-sm font-semibold text-slate-900">
              Images{" "}
              <span className="font-normal text-slate-400">
                — slide visuals, illustrations, photos for this part
              </span>
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(entry?.images ?? []).map((img) => (
                <div
                  key={img.path}
                  className="group overflow-hidden rounded-xl ring-1 ring-slate-200"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.caption ?? entity.name}
                    className="aspect-[4/3] w-full bg-slate-100 object-cover"
                  />
                  <div className="flex items-center gap-1 px-2 py-1.5">
                    <p className="min-w-0 flex-1 truncate text-[11px] text-slate-500">
                      {img.caption ?? "—"}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(img.url);
                        setStatus("Image URL copied.");
                      }}
                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 hover:bg-sky-50"
                    >
                      Copy URL
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteImage(img.path)}
                      className="shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Caption (optional)…"
                className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
              />
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Upload image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadImage(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

type CanonFile = {
  file: string;
  label: string;
  description: string;
  group: "core" | "skill";
  content: string;
  overridden: boolean;
  updated_at: string | null;
  missing: boolean;
};

function wordCount(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

function SkillsSubTab() {
  const [openSkill, setOpenSkill] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <Section
        title="AI skills"
        hint="Every skill the coach AI can run — what it's told to do and which knowledge it loads on top of the core brain. Read-only for now; editable instructions are on the roadmap."
      >
        <div className="flex flex-col gap-3">
          {PROFIT_COACH_OUTPUTS.map((o) => {
            const roles = PROFIT_COACH_ROLES.filter((r) =>
              r.outputIds.includes(o.id)
            ).map((r) => r.label);
            const open = openSkill === o.id;
            return (
              <div
                key={o.id}
                className="rounded-xl border border-slate-200 bg-slate-50/50"
              >
                <button
                  type="button"
                  onClick={() => setOpenSkill(open ? null : o.id)}
                  className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left"
                >
                  <span className="text-sm font-semibold text-slate-900">
                    {o.label}
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    {o.id}
                  </span>
                  <span className="text-xs text-slate-500">
                    — {o.description}
                  </span>
                  <span className="ml-auto flex items-center gap-1.5">
                    {o.useMarketingIcpTier2 ? (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                        + marketing ICP
                      </span>
                    ) : null}
                    <span className="text-xs text-slate-400">
                      {open ? "Hide" : "View"}
                    </span>
                  </span>
                </button>
                {open ? (
                  <div className="border-t border-slate-200 px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      System instructions
                    </p>
                    <pre className="mt-1.5 whitespace-pre-wrap rounded-lg bg-white px-3 py-2.5 font-mono text-xs leading-relaxed text-slate-700 ring-1 ring-slate-200">
                      {o.systemInstructions}
                    </pre>
                    <div className="mt-3 flex flex-wrap items-start gap-x-8 gap-y-2">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                          Knowledge loaded
                        </p>
                        <ul className="mt-1 flex flex-wrap gap-1.5">
                          {o.knowledgeRefs.map((ref, i) => (
                            <li
                              key={i}
                              className="rounded-full bg-white px-2 py-0.5 font-mono text-[10px] text-slate-500 ring-1 ring-slate-200"
                            >
                              {ref.type === "playbook" ? ref.path : ref.file}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {o.contextHints?.keys?.length ? (
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                            Coach brain keys used
                          </p>
                          <p className="mt-1 font-mono text-xs text-slate-500">
                            {o.contextHints.keys.join(", ")}
                          </p>
                        </div>
                      ) : null}
                      {roles.length ? (
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                            In roles
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {roles.join(", ")}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-slate-400">
          Related prompt controls elsewhere:{" "}
          <a href="/admin/settings/ai-coach" className="font-medium text-sky-700 hover:underline">
            AI Coach system prompt
          </a>{" "}
          ·{" "}
          <a href="/admin/settings/linkedin-profile" className="font-medium text-sky-700 hover:underline">
            LinkedIn Optimizer prompt
          </a>{" "}
          — candidates to consolidate here.
        </p>
      </Section>
    </div>
  );
}

function CanonTab({ initialBrainTab }: { initialBrainTab?: string | null }) {
  const [subTab, setSubTab] = useState<"knowledge" | "skills">(
    initialBrainTab === "skills" ? "skills" : "knowledge"
  );
  const [files, setFiles] = useState<CanonFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const authHeaders = useCallback(async (): Promise<Record<
    string,
    string
  > | null> => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return null;
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    };
  }, []);

  useEffect(() => {
    if (initialBrainTab === "skills" || initialBrainTab === "knowledge") {
      setSubTab(initialBrainTab);
    }
  }, [initialBrainTab]);

  const load = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch("/api/admin/brand-knowledge", { headers });
    if (!res.ok) {
      setStatus("Could not load the canon files.");
      setLoading(false);
      return;
    }
    const body = (await res.json()) as { files?: CanonFile[] };
    const next = body.files ?? [];
    setFiles(next);
    setLoading(false);
    setActiveFile((current) => current ?? next[0]?.file ?? null);
  }, [authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = useMemo(
    () => files.find((f) => f.file === activeFile) ?? null,
    [files, activeFile]
  );

  useEffect(() => {
    setDraft(active?.content ?? "");
    setStatus(null);
  }, [active?.file, active?.content]);

  async function save() {
    if (!active || saving) return;
    setSaving(true);
    setStatus(null);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch("/api/admin/brand-knowledge", {
        method: "PUT",
        headers,
        body: JSON.stringify({ file: active.file, content: draft }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setStatus(body.error || "Save failed.");
        return;
      }
      setStatus("Saved — live in the next AI message.");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function resetToRepo() {
    if (!active || saving) return;
    if (
      !window.confirm(
        "Remove the edited version and fall back to the repo file?"
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      await fetch(
        `/api/admin/brand-knowledge?file=${encodeURIComponent(active.file)}`,
        { method: "DELETE", headers }
      );
      setStatus("Reset to the repo version.");
      await load();
    } finally {
      setSaving(false);
    }
  }

  const dirty = active ? draft !== active.content : false;

  const filePill = (f: CanonFile) => (
    <button
      key={f.file}
      type="button"
      onClick={() => setActiveFile(f.file)}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        activeFile === f.file
          ? "bg-slate-900 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {f.label}
      <span
        className={`ml-1.5 font-normal ${activeFile === f.file ? "text-slate-300" : "text-slate-400"}`}
      >
        {wordCount(f.content).toLocaleString()}w
      </span>
      {f.overridden ? (
        <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-sky-400 align-middle" />
      ) : null}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5">
        {(
          [
            ["knowledge", "Knowledge"],
            ["skills", "Skills"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSubTab(key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
              subTab === key
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {subTab === "skills" ? (
        <SkillsSubTab />
      ) : loading ? (
        <p className="py-10 text-sm text-slate-500">Loading knowledge…</p>
      ) : (
      <Section
        title="Core brain knowledge"
        hint="The business's own brain — loaded into every AI prompt before each coach's personal brain. The core six are currently short stubs (word counts on each pill); filling them with the real material is the high-leverage job. Edits go live immediately for every coach's AI."
      >
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
          Always loaded — the core
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {files.filter((f) => f.group === "core").map(filePill)}
        </div>
        <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-slate-400">
          Loaded per skill
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {files.filter((f) => f.group === "skill").map(filePill)}
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Also loaded per skill: the 50 BOSS playbooks (edited under Coach
          Clients → Playbooks) and the coach&apos;s own brain.
        </p>

        {active ? (
          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {active.label}
                  <span className="ml-2 font-mono text-xs font-normal text-slate-400">
                    {active.file}
                  </span>
                </p>
                <p className="text-xs text-slate-500">{active.description}</p>
              </div>
              <p className="text-xs text-slate-400">
                {active.overridden
                  ? `Edited version live${active.updated_at ? ` · ${new Date(active.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}`
                  : "Repo version (no edits)"}
              </p>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={22}
              spellCheck={false}
              className="mt-3 w-full resize-y rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 font-mono text-[13px] leading-relaxed text-slate-800 focus:border-sky-400 focus:bg-white focus:outline-none"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || !dirty || !draft.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-40"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save changes
              </button>
              {active.overridden ? (
                <button
                  type="button"
                  onClick={() => void resetToRepo()}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset to repo version
                </button>
              ) : null}
              <span className="ml-auto text-xs text-slate-400">
                {draft.length.toLocaleString()} characters
              </span>
            </div>
            {status ? (
              <p className="mt-2 text-sm font-medium text-slate-600">{status}</p>
            ) : null}
          </div>
        ) : null}
      </Section>
      )}
    </div>
  );
}

function BrandPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  // "canon" was the original name of the Core brain tab.
  const tabRaw = tabParam === "canon" ? "brain" : tabParam;
  const tab: TabKey = TABS.some((t) => t.key === tabRaw)
    ? (tabRaw as TabKey)
    : "graphics";

  const fwRaw = searchParams.get("fw");
  const framework: FrameworkKey = FRAMEWORK_TABS.some((f) => f.key === fwRaw)
    ? (fwRaw as FrameworkKey)
    : "three-pillars";

  const setTab = useCallback(
    (next: TabKey) => {
      router.replace(`/admin/brand?tab=${next}`, { scroll: false });
    },
    [router]
  );

  const setFramework = useCallback(
    (next: FrameworkKey) => {
      router.replace(`/admin/brand?tab=frameworks&fw=${next}`, {
        scroll: false,
      });
    },
    [router]
  );

  return (
    <div className="w-full">
      <StickyPageHeader
        title="Brand"
        description="The canonical Profit System layer — visual elements, frameworks, and the verbal core the coaches' industry layer sits on."
        tabs={
          <nav className="flex gap-5" aria-label="Brand sections">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`border-b-2 pb-1.5 text-sm font-semibold transition ${
                  tab === t.key
                    ? "border-[#0c5290] text-[#0c5290]"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        }
      />
      <div className="mt-4 pb-10">
        {tab === "typography" ? <TypographyTab /> : null}
        {tab === "graphics" ? <GraphicsTab /> : null}
        {tab === "model" ? <ModelTab /> : null}
        {tab === "frameworks" ? (
          <FrameworksTab framework={framework} setFramework={setFramework} />
        ) : null}
        {tab === "brain" ? (
          <CanonTab initialBrainTab={searchParams.get("brainTab")} />
        ) : null}
      </div>
    </div>
  );
}

export default function AdminBrandPage() {
  return (
    <Suspense fallback={<p className="py-10 text-sm text-slate-500">Loading…</p>}>
      <BrandPageInner />
    </Suspense>
  );
}
