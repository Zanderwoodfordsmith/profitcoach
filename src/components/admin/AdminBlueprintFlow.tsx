"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Check, Copy, Loader2 } from "lucide-react";

import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import type { FlowGraph, FlowKind, FlowNode, FlowNodeStatus } from "@/lib/practiceKnowledge/flow";

type Coach = { id: string; name: string };
type Prompt = { system: string | null; user: string | null; note: string | null };

const KIND_LABEL: Record<FlowKind, string> = {
  coach: "Only the coach knows",
  research: "BCA can research, coach checks",
  import: "Imported",
  build: "BCA writes first",
  out: "What the coach gets",
};

const DOT: Record<FlowKind, string> = {
  coach: "bg-[#0c5290]",
  research: "border-2 border-[#1a8fd4]",
  import: "border-2 border-slate-400",
  build: "",
  out: "",
};

const NODE: Record<FlowKind, string> = {
  coach: "bg-white text-slate-900 ring-1 ring-slate-200",
  research: "bg-white text-slate-900 ring-1 ring-slate-200",
  import: "bg-white text-slate-900 ring-1 ring-slate-200",
  build: "bg-sky-50 text-[#06223d] ring-1 ring-sky-100",
  out: "bg-[#06223d] text-white ring-1 ring-[#06223d]",
};

const STATE_DOT: Record<FlowNodeStatus["state"], { cls: string; label: string }> = {
  filled: { cls: "bg-emerald-500", label: "Filled" },
  written: { cls: "bg-emerald-500", label: "Written" },
  ready: { cls: "bg-sky-500", label: "Ready to write" },
  open: { cls: "bg-amber-400", label: "Needs answers" },
  missing: { cls: "bg-amber-400", label: "Missing something" },
};

function Dot({ kind }: { kind: FlowKind }) {
  if (kind === "build" || kind === "out") return null;
  return <span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT[kind]}`} />;
}

function walk(start: string, next: Map<string, string[]>): Set<string> {
  const seen = new Set<string>();
  const queue = [...(next.get(start) ?? [])];
  while (queue.length) {
    const id = queue.shift() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    queue.push(...(next.get(id) ?? []));
  }
  return seen;
}

function blueprintHref(node: FlowNode, coachId: string | null): string | null {
  if (!node.page || !node.sectionKey) return null;
  const query = coachId ? `?${new URLSearchParams({ coach: coachId }).toString()}` : "";
  return `/admin/blueprint/coach/${node.page}${query}#s-${node.sectionKey.replace(":", "-")}`;
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }, () => undefined);
      }}
      className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900"
    >
      {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}

export function AdminBlueprintFlow() {
  const [graph, setGraph] = useState<FlowGraph | null>(null);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  // The page renders "Loading" until the map arrives, so reading the URL here cannot change the first paint.
  const [coachId, setCoachId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("coach")
  );
  const [status, setStatus] = useState<Record<string, FlowNodeStatus> | null>(null);
  const [selected, setSelected] = useState(
    () => (typeof window === "undefined" ? "" : decodeURIComponent(window.location.hash.replace("#", ""))) || "linkedin"
  );
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<{ node: string; coach: string | null; data?: Prompt; error?: string; busy?: boolean } | null>(null);

  const load = useCallback(async (coach: string | null) => {
    const headers = await getCoachAuthHeaders(null);
    if (!headers) return;
    // Admin data: never send a "View as" coach header with it.
    delete headers["x-impersonate-coach-id"];
    const res = await fetch(`/api/admin/practice/flow${coach ? `?coach=${encodeURIComponent(coach)}` : ""}`, { headers });
    const body = (await res.json().catch(() => null)) as { graph?: FlowGraph; coaches?: Coach[]; status?: Record<string, FlowNodeStatus> | null; error?: string } | null;
    if (!res.ok || !body?.graph) {
      setError(body?.error ?? "Could not load the flow map.");
      return;
    }
    setError(null);
    setGraph(body.graph);
    setCoaches(body.coaches ?? []);
    setStatus(body.status ?? null);
  }, []);

  const firstCoach = useRef(coachId);
  useEffect(() => {
    void load(firstCoach.current);
  }, [load]);

  function pickCoach(id: string | null) {
    setCoachId(id);
    setPrompt(null);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("coach", id);
    else url.searchParams.delete("coach");
    window.history.replaceState(null, "", url.toString());
    void load(id);
  }

  function select(id: string) {
    setSelected(id);
    setPrompt(null);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${encodeURIComponent(id)}`);
  }

  async function showPrompt(node: FlowNode) {
    setPrompt({ node: node.id, coach: coachId, busy: true });
    const headers = await getCoachAuthHeaders(null);
    if (!headers) return;
    delete headers["x-impersonate-coach-id"];
    const params = new URLSearchParams({ node: node.id });
    if (coachId) params.set("coach", coachId);
    const res = await fetch(`/api/admin/practice/flow/prompt?${params.toString()}`, { headers });
    const body = (await res.json().catch(() => null)) as (Prompt & { error?: string }) | null;
    setPrompt(
      res.ok && body
        ? { node: node.id, coach: coachId, data: { system: body.system, user: body.user, note: body.note } }
        : { node: node.id, coach: coachId, error: body?.error ?? "Could not build the prompt." }
    );
  }

  const model = useMemo(() => {
    if (!graph) return null;
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    const parents = new Map<string, string[]>();
    const children = new Map<string, string[]>();
    for (const [a, b] of graph.edges) {
      children.set(a, [...(children.get(a) ?? []), b]);
      parents.set(b, [...(parents.get(b) ?? []), a]);
    }
    const inputOf = new Map<string, string>();
    for (const n of graph.nodes) for (const f of n.fields) inputOf.set(f.path, n.id);
    return { byId, parents, children, inputOf };
  }, [graph]);

  const focus = useMemo(() => {
    if (!model || !model.byId.has(selected)) return null;
    const up = walk(selected, model.parents);
    const down = walk(selected, model.children);
    return { up, down };
  }, [model, selected]);

  // Wires between the boxes, measured from the page.
  const mapRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const svgRef = useRef<SVGSVGElement | null>(null);

  const draw = useCallback(() => {
    const map = mapRef.current;
    const svg = svgRef.current;
    if (!map || !svg || !graph) return;
    if (window.matchMedia("(max-width: 1023px)").matches) {
      svg.innerHTML = "";
      return;
    }
    const frame = map.getBoundingClientRect();
    const out: { d: string; on: boolean }[] = [];
    for (const [a, b] of graph.edges) {
      const ea = nodeRefs.current.get(a);
      const eb = nodeRefs.current.get(b);
      if (!ea || !eb) continue;
      const ra = ea.getBoundingClientRect();
      const rb = eb.getBoundingClientRect();
      const y1 = ra.top + ra.height / 2 - frame.top;
      const y2 = rb.top + rb.height / 2 - frame.top;
      let d: string;
      if (rb.left > ra.right - 1) {
        const x1 = ra.right - frame.left;
        const x2 = rb.left - frame.left;
        const dx = Math.max(24, (x2 - x1) / 2);
        d = `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
      } else {
        // Same column: a small arc out to the right and back.
        const x1 = ra.right - frame.left;
        const x2 = rb.right - frame.left;
        const bulge = Math.min(44, 16 + Math.abs(y2 - y1) * 0.12);
        d = `M${x1},${y1} C${x1 + bulge},${y1} ${x2 + bulge},${y2} ${x2},${y2}`;
      }
      const on = Boolean(
        focus &&
          ((focus.up.has(a) && (b === selected || focus.up.has(b))) ||
            ((a === selected || focus.down.has(a)) && focus.down.has(b)))
      );
      out.push({ d, on });
    }
    out.sort((x, y) => Number(x.on) - Number(y.on));
    svg.setAttribute("width", String(frame.width));
    svg.setAttribute("height", String(frame.height));
    // Paths are built from measured numbers only, never from content.
    svg.innerHTML = out
      .map(
        (w) =>
          `<path d="${w.d}" fill="none" stroke="${w.on ? "#0ea5e9" : "#cbd5e1"}" stroke-width="${w.on ? 1.75 : 1}" opacity="${w.on ? 1 : focus ? 0.25 : 0.6}"></path>`
      )
      .join("");
  }, [graph, focus, selected]);

  useLayoutEffect(() => {
    draw();
  }, [draw, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(map);
    window.addEventListener("resize", draw);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", draw);
    };
  }, [draw]);

  if (error) return <p className="p-6 text-sm text-red-700">{error}</p>;
  if (!graph || !model) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading the flow map…
      </div>
    );
  }

  const node = model.byId.get(selected) ?? graph.nodes[0];
  const related = (id: string) => !focus || id === selected || focus.up.has(id) || focus.down.has(id);

  const nodeButton = (n: FlowNode) => {
    const st = status?.[n.id];
    return (
      <button
        key={n.id}
        ref={(el) => {
          if (el) nodeRefs.current.set(n.id, el);
          else nodeRefs.current.delete(n.id);
        }}
        type="button"
        aria-pressed={n.id === selected}
        onClick={() => select(n.id)}
        className={`flex min-h-[34px] w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-ui font-medium leading-tight transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${NODE[n.kind]} ${
          n.id === selected ? "!ring-2 !ring-sky-500" : "hover:ring-sky-300"
        } ${related(n.id) ? "" : "opacity-30"}`}
      >
        <Dot kind={n.kind} />
        <span className="min-w-0 flex-1">{n.label}</span>
        {st ? <span title={STATE_DOT[st.state].label} className={`h-2 w-2 shrink-0 rounded-full ${STATE_DOT[st.state].cls}`} /> : null}
        <span className={`font-mono text-caption tabular-nums ${n.kind === "out" ? "text-white/70" : "text-slate-400"}`} title="Outputs it reaches">
          {n.kind === "out" ? "" : n.reach}
        </span>
      </button>
    );
  };

  const chip = (id: string) => {
    const n = model.byId.get(id);
    if (!n) return null;
    return (
      <button
        key={id}
        type="button"
        onClick={() => select(id)}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
          n.kind === "out" ? "bg-[#06223d] text-white" : n.kind === "build" ? "bg-sky-50 text-[#06223d]" : "bg-slate-100 text-slate-800"
        } hover:ring-1 hover:ring-sky-300`}
      >
        <Dot kind={n.kind} />
        {n.label}
      </button>
    );
  };
  const chips = (ids: string[]) =>
    ids.length ? <div className="flex flex-wrap gap-1.5">{ids.map(chip)}</div> : <p className="text-xs text-slate-400">None</p>;

  const ofKind = (ids: Set<string>, kinds: FlowKind[]) =>
    graph.nodes.filter((n) => ids.has(n.id) && kinds.includes(n.kind)).map((n) => n.id);

  const inputs = (kind: FlowKind) => graph.nodes.filter((n) => n.kind === kind);
  const st = status?.[node.id];
  const href = blueprintHref(node, coachId);
  const readsInputs = node.writer
    ? [...new Set(node.writer.reads.map((p) => model.inputOf.get(p)).filter((x): x is string => Boolean(x)))]
    : [];
  const outputsReached = focus ? ofKind(focus.down, ["out"]) : [];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-4 py-6 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <h1 className="text-lg font-semibold text-slate-900">Blueprint flow</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              What each output is built from, drawn from the writer contracts in the code. Click a box to see what it reads,
              what it feeds, and the prompt its writer is sent. The number is how many of the {graph.outputCount} outputs it reaches.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="flow-coach" className="text-sm text-slate-600">
              Coach
            </label>
            <select
              id="flow-coach"
              value={coachId ?? ""}
              onChange={(e) => pickCoach(e.target.value || null)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900"
            >
              <option value="">No coach, just the map</option>
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Link href="/admin/blueprint/map" className="text-sm font-medium text-sky-700 hover:underline">
              Section list
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
          {(["coach", "research", "import"] as FlowKind[]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <Dot kind={k} />
              {KIND_LABEL[k]}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-4 rounded bg-sky-100" /> {KIND_LABEL.build}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-4 rounded bg-[#06223d]" /> {KIND_LABEL.out}
          </span>
          {status
            ? (["filled", "ready", "missing"] as const).map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${STATE_DOT[s].cls}`} />
                  {s === "filled" ? "Filled or written" : STATE_DOT[s].label}
                </span>
              ))
            : null}
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div ref={mapRef} className="relative grid gap-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-x-16">
            <svg ref={svgRef} aria-hidden className="pointer-events-none absolute left-0 top-0 hidden overflow-visible lg:block" />
            <div className="relative z-10 flex min-w-0 flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Answers</p>
              {(["coach", "research", "import"] as FlowKind[]).map((k) => (
                <div key={k} className="flex flex-col gap-1.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <Dot kind={k} />
                    {KIND_LABEL[k]}
                  </p>
                  {inputs(k).map(nodeButton)}
                </div>
              ))}
            </div>
            <div className="relative z-10 flex min-w-0 flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">BCA writes first</p>
              <div className="flex flex-1 flex-col justify-around gap-1.5">{inputs("build").map(nodeButton)}</div>
            </div>
            <div className="relative z-10 flex min-w-0 flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">The coach gets</p>
              <div className="flex flex-1 flex-col justify-around gap-1.5">{inputs("out").map(nodeButton)}</div>
            </div>
          </div>

          <aside className={cardClass("plain", "flex min-w-0 flex-col gap-4 p-5 lg:sticky lg:top-4")}>
            <div>
              <p className="flex items-center gap-1.5 text-kicker font-semibold uppercase text-slate-500">
                <Dot kind={node.kind} />
                {KIND_LABEL[node.kind]}
              </p>
              <h2 className="mt-1.5 text-lg font-semibold leading-snug text-slate-900">{node.label}</h2>
              {node.about ? <p className="mt-1.5 text-sm leading-6 text-slate-600">{node.about}</p> : null}
              {href ? (
                <Link href={href} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:underline">
                  Open in the Blueprint
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              ) : null}
            </div>

            {st ? (
              <div className={`rounded-xl px-3.5 py-3 text-sm ${st.state === "filled" || st.state === "written" ? "bg-emerald-50 text-emerald-900" : st.state === "ready" ? "bg-sky-50 text-sky-900" : "bg-amber-50 text-amber-900"}`}>
                <p className="font-semibold">{STATE_DOT[st.state].label}</p>
                {st.answers.length ? (
                  <p className="mt-1 leading-6">
                    <span className="font-medium">Answers needed:</span> {st.answers.slice(0, 8).join("; ")}
                    {st.answers.length > 8 ? `; and ${st.answers.length - 8} more` : ""}
                  </p>
                ) : null}
                {st.sections.length ? (
                  <p className="mt-1 leading-6">
                    <span className="font-medium">Write first:</span> {st.sections.join(", ")}
                  </p>
                ) : null}
              </div>
            ) : null}

            {node.writer ? (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <p className="border-b border-slate-200 bg-slate-50 px-3.5 py-2 font-mono text-xs text-slate-500">contract · {node.label.toLowerCase()}</p>
                <dl className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 px-3.5 py-1 text-sm">
                  {(
                    [
                      ["Reads answers", node.writer.readsAll ? <p className="text-slate-700">Every answer</p> : chips(readsInputs)],
                      ["Also reads", node.writer.sources.length ? <p className="text-slate-700">{node.writer.sources.join(", ")}</p> : <p className="text-xs text-slate-400">Nothing else</p>],
                      ["Built on", chips(node.writer.builtOn)],
                      ...(node.writer.alsoReads.length ? [["Also given", chips(node.writer.alsoReads)] as const] : []),
                      ["Method", node.writer.method ? <code className="break-all font-mono text-xs text-slate-700">{node.writer.method}</code> : <p className="text-xs text-slate-400">None</p>],
                      ["Signed off by", <p key="s" className="text-slate-700">{node.writer.signOff ?? "The coach"}</p>],
                      ["Goes to", <p key="g" className="text-slate-700">{node.writer.goesTo ?? "Stays in the Blueprint"}{node.writer.sendsToGetClients ? " (send button on the section)" : ""}</p>],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="contents">
                      <dt className="border-b border-slate-100 py-2 text-xs font-medium text-slate-500 last-of-type:border-0">{label}</dt>
                      <dd className="min-w-0 border-b border-slate-100 py-2">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-slate-700">The answers in this box</p>
                <ul className="flex flex-col gap-1 text-sm">
                  {node.fields.map((f) => {
                    const filled = status?.[node.id]?.filled?.includes(f.path);
                    return (
                      <li key={f.path} className="flex items-baseline gap-2">
                        {status ? (
                          <span className={`h-2 w-2 shrink-0 rounded-full ${filled ? "bg-emerald-500" : f.required ? "bg-amber-400" : "bg-slate-200"}`} />
                        ) : null}
                        <span className="text-slate-800">{f.label}</span>
                        {f.required ? <span className="text-caption text-slate-400">required</span> : null}
                        <code className="ml-auto font-mono text-caption text-slate-400">{f.path}</code>
                      </li>
                    );
                  })}
                </ul>
                {node.everyWriter ? <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900">Every writer is given this, whatever its contract says.</p> : null}
                {node.kind === "research" ? (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Today the coach fills this box. BCA could draft it from research for the chosen market, and the coach checks it.
                  </p>
                ) : null}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-slate-700">
                Reaches {outputsReached.length} of {graph.outputCount} outputs
              </p>
              {chips(outputsReached)}
            </div>

            {node.writer && focus ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-slate-700">Everything underneath it</p>
                {(["coach", "research", "import", "build"] as FlowKind[]).map((k) => {
                  const ids = ofKind(focus.up, [k]);
                  return ids.length ? (
                    <div key={k} className="flex flex-col gap-1">
                      <p className="text-caption text-slate-500">
                        {KIND_LABEL[k]} · {ids.length}
                      </p>
                      {chips(ids)}
                    </div>
                  ) : null;
                })}
              </div>
            ) : null}

            {node.writer?.task ? (
              <details className={cardClass("plain", "px-3.5 py-2.5")}>
                <summary className="cursor-pointer text-sm font-semibold text-slate-800">The task this writer is given</summary>
                <pre className="mt-2 whitespace-pre-wrap font-mono text-xs leading-5 text-slate-700">{node.writer.task}</pre>
              </details>
            ) : null}

            {node.writer?.preview ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => void showPrompt(node)}
                  disabled={prompt?.busy}
                  className={buttonClass("main", "small", "self-start")}
                >
                  {prompt?.busy ? "Building…" : coachId ? "Show the full prompt for this coach" : "Show the prompt"}
                </button>
                <p className="text-xs leading-5 text-slate-500">
                  Every Blueprint writer also loads {graph.shared.join(", ")}.
                </p>
                {prompt && prompt.node === node.id && !prompt.busy ? (
                  prompt.error ? (
                    <p className="text-sm text-red-700">{prompt.error}</p>
                  ) : prompt.data ? (
                    <div className="flex flex-col gap-3">
                      {prompt.data.note ? <p className="text-xs leading-5 text-slate-600">{prompt.data.note}</p> : null}
                      {(
                        [
                          ["System prompt (method, rules, format)", prompt.data.system],
                          ["Message (this coach's answers and written sections)", prompt.data.user],
                        ] as const
                      ).map(([label, text]) =>
                        text ? (
                          <div key={label} className={cardClass("plain", "overflow-hidden")}>
                            <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5">
                              <span className="text-xs font-semibold text-slate-600">{label}</span>
                              <span className="flex items-center gap-3">
                                <span className="font-mono text-caption text-slate-400">{text.length.toLocaleString()} chars</span>
                                <CopyButton text={text} />
                              </span>
                            </div>
                            <pre className="max-h-96 overflow-auto whitespace-pre-wrap px-3 py-2 font-mono text-caption leading-5 text-slate-700">{text}</pre>
                          </div>
                        ) : null
                      )}
                    </div>
                  ) : null
                ) : null}
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
