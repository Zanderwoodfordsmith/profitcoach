"use client";

import { useState, type KeyboardEvent } from "react";

type FlowTone = "blue" | "sky" | "teal" | "green" | "amber" | "red" | "slate" | "muted";
type Anchor = "top" | "right" | "bottom" | "left";

type Point = {
  x: number;
  y: number;
};

type MessageStep = {
  day: string;
  title: string;
  detail: string;
};

type DiagramNode = {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: "rect" | "diamond" | "pill";
  tone: FlowTone;
  description: string;
  meta?: string;
  dotted?: boolean;
  details?: string[];
  messageSteps?: MessageStep[];
};

type DiagramConnection = {
  id: string;
  from: string;
  to: string;
  fromAnchor: Anchor;
  toAnchor: Anchor;
  tone?: FlowTone;
  label?: string;
  labelPoint?: Point;
  via?: Point[];
  fromPoint?: Point;
  toPoint?: Point;
  curve?: {
    control1: Point;
    control2: Point;
  };
  dotted?: boolean;
};

const TONES: Record<
  FlowTone,
  { stroke: string; fill: string; text: string; line: string }
> = {
  blue: {
    stroke: "#0c5290",
    fill: "#ffffff",
    text: "#0c5290",
    line: "#5b7d99",
  },
  sky: {
    stroke: "#42a1ee",
    fill: "#ffffff",
    text: "#287fc1",
    line: "#7faecc",
  },
  teal: {
    stroke: "#1ca0c2",
    fill: "#ffffff",
    text: "#087890",
    line: "#2f8f9f",
  },
  green: {
    stroke: "#3c9b70",
    fill: "#effaf3",
    text: "#24764f",
    line: "#3c9b70",
  },
  amber: {
    stroke: "#d19a22",
    fill: "#fffaf0",
    text: "#96620d",
    line: "#c79d4a",
  },
  red: {
    stroke: "#c2414e",
    fill: "#fff7f7",
    text: "#a9323d",
    line: "#c87982",
  },
  slate: {
    stroke: "#aebdca",
    fill: "#f8fafc",
    text: "#5b6b78",
    line: "#7b8b98",
  },
  muted: {
    stroke: "#c8d2dc",
    fill: "#f4f7fa",
    text: "#71808d",
    line: "#c0cad1",
  },
};

const NODES: DiagramNode[] = [
  {
    id: "start",
    title: "Start",
    x: 220,
    y: 56,
    width: 100,
    height: 48,
    shape: "pill",
    tone: "teal",
    description: "A good-fit person is identified.",
  },
  {
    id: "prospect-lists",
    title: "Prospect\nLists",
    x: 360,
    y: 46,
    width: 190,
    height: 68,
    shape: "rect",
    tone: "slate",
    description: "The wider list of good-fit people.",
    details: [
      "Build from base search, narrowed prospect search, your network, and existing relationships.",
      "This is the wider pool—not the people already in the active campaign.",
    ],
  },
  {
    id: "contactable",
    title: "Reachable?",
    x: 650,
    y: 20,
    width: 120,
    height: 120,
    shape: "diamond",
    tone: "amber",
    description: "Do we have a legitimate way to reach this person?",
  },
  {
    id: "connector-campaign",
    title: "Connector\nCampaign",
    x: 870,
    y: 48,
    width: 200,
    height: 64,
    shape: "rect",
    tone: "blue",
    description: "A route to create a legitimate LinkedIn connection.",
    details: [
      "Use a connection request and relevant follow-up. Do not scrape emails.",
      "If they connect, move them into the active interest-generation sequence.",
    ],
  },
  {
    id: "top-200",
    title: "Generate Interest\nSequence",
    x: 360,
    y: 246,
    width: 190,
    height: 68,
    shape: "rect",
    tone: "blue",
    description: "The active sequence for generating interest.",
    details: [
      "Only include people who are connected, have an email, or have another legitimate contact route.",
      "Twenty new people each weekday means 200 people complete the sequence in four weeks.",
      "Working target: 10 Interested, 5 discovery calls, 4 value sessions, 1 client.",
    ],
  },
  {
    id: "interested",
    title: "Interested?",
    x: 650,
    y: 220,
    width: 120,
    height: 120,
    shape: "diamond",
    tone: "amber",
    description: "Is there a positive reply or completed BOSS Scorecard?",
    details: [
      "Interested is the only KPI members need to focus on.",
      "Count positive replies and completed BOSS Scorecards unless they have explicitly said no.",
      "The other internal tags are Not right now, Not interested, and No response.",
      "Not right now goes to nurture. Not interested means stop. No response is parked.",
    ],
  },
  {
    id: "reply-sequence",
    title: "Reply\nsequence",
    x: 360,
    y: 446,
    width: 190,
    height: 68,
    shape: "rect",
    tone: "blue",
    description: "Respond to an Interested person and move them toward a booked conversation.",
    details: [
      "Use the relevant reply sequence for a positive reply or completed scorecard.",
      "The goal is a clear next step, not another long pitch.",
    ],
  },
  {
    id: "personal-follow-up",
    title: "Personal\nfollow-up",
    x: 870,
    y: 446,
    width: 200,
    height: 68,
    shape: "rect",
    tone: "blue",
    description: "Move an Interested person toward a booked conversation.",
    details: [
      "Use the relevant personal follow-up sequence for the reply or completed scorecard.",
      "The goal is a clear next step, not another long pitch.",
    ],
  },
  {
    id: "booked-call",
    title: "Booked?",
    x: 650,
    y: 420,
    width: 120,
    height: 120,
    shape: "diamond",
    tone: "amber",
    description: "Has the reply sequence led to a booked conversation?",
    details: [
      "YES: continue to the Discovery Call or Value Session.",
      "NO: return to nurture rather than forcing the next step.",
    ],
  },
  {
    id: "qualified",
    title: "Qualified?",
    x: 650,
    y: 620,
    width: 120,
    height: 120,
    shape: "diamond",
    tone: "amber",
    description: "Is this the right person for a Value Session?",
    details: [
      "Use the booked conversation to confirm fit and readiness.",
      "A qualified person moves toward a Value Session.",
      "If they are not ready, return them to nurture.",
    ],
  },
  {
    id: "not-qualified",
    title: "Nurture /\nrevisit",
    x: 870,
    y: 646,
    width: 200,
    height: 68,
    shape: "rect",
    tone: "slate",
    description: "Not ready for a Value Session yet.",
    details: ["Return to the nurture list and revisit when timing or fit changes."],
  },
  {
    id: "nurture-list",
    title: "Nurture\nlist",
    x: 870,
    y: 248,
    width: 200,
    height: 64,
    shape: "rect",
    tone: "slate",
    description: "The route for people who are not ready yet.",
    details: [
      "Use for Not right now: record a date or note for the next follow-up.",
      "No response can be parked here for longer-term nurture.",
      "Return them to the active conversation when the timing is right.",
    ],
  },
  {
    id: "discovery-call",
    title: "Discovery\ncall*",
    x: 360,
    y: 646,
    width: 190,
    height: 68,
    shape: "rect",
    tone: "sky",
    dotted: true,
    description: "An optional conversation before the Value Session.",
    details: ["Use it when a short conversation will help confirm fit or readiness."],
  },
  {
    id: "value",
    title: "Value\nsession",
    x: 360,
    y: 846,
    width: 190,
    height: 68,
    shape: "rect",
    tone: "sky",
    description: "Show the gap and the route forward.",
    details: [
      "This is the main next step after a positive signal.",
      "A discovery call can be used first when a short conversation will help.",
      "After the value session, present the offer and move toward close.",
    ],
  },
  {
    id: "one",
    title: "Won?",
    x: 650,
    y: 820,
    width: 120,
    height: 120,
    shape: "diamond",
    tone: "amber",
    description: "One new client from the working target.",
    details: ["Take payment and start coaching."],
  },
  {
    id: "new-client",
    title: "New Client",
    x: 610,
    y: 1006,
    width: 200,
    height: 68,
    shape: "pill",
    tone: "green",
    description: "Start coaching with the new client.",
    details: ["Take payment, confirm onboarding, and begin coaching."],
  },
  {
    id: "won-follow-up",
    title: "Follow-up\nin 90 days",
    x: 870,
    y: 846,
    width: 200,
    height: 68,
    shape: "rect",
    tone: "slate",
    description: "A later follow-up for someone who has not won yet.",
    details: ["Temporary placeholder for the future follow-up route."],
  },
];

const CONNECTIONS: DiagramConnection[] = [
  { id: "start-list", from: "start", to: "prospect-lists", fromAnchor: "right", toAnchor: "left" },
  { id: "list-contactable", from: "prospect-lists", to: "contactable", fromAnchor: "right", toAnchor: "left" },
  {
    id: "contactable-connector",
    from: "contactable",
    to: "connector-campaign",
    fromAnchor: "right",
    toAnchor: "left",
    tone: "slate",
    label: "NO",
    labelPoint: { x: 820, y: 80 },
  },
  {
    id: "contactable-top-200",
    from: "contactable",
    to: "top-200",
    fromAnchor: "bottom",
    toAnchor: "top",
    tone: "teal",
    label: "YES · 200 (20%)",
    labelPoint: { x: 710, y: 160 },
    via: [{ x: 710, y: 180 }, { x: 455, y: 180 }],
  },
  {
    id: "connector-contactable",
    from: "connector-campaign",
    to: "contactable",
    fromAnchor: "top",
    toAnchor: "top",
    tone: "muted",
    fromPoint: { x: 900, y: 48 },
    toPoint: { x: 745, y: 45 },
    curve: {
      control1: { x: 900, y: 8 },
      control2: { x: 790, y: 8 },
    },
    dotted: true,
  },
  {
    id: "top-200-intent",
    from: "top-200",
    to: "interested",
    fromAnchor: "right",
    toAnchor: "left",
    tone: "blue",
  },
  {
    id: "interested-no",
    from: "interested",
    to: "nurture-list",
    fromAnchor: "right",
    toAnchor: "left",
    tone: "slate",
    label: "NO",
    labelPoint: { x: 820, y: 280 },
  },
  {
    id: "nurture-interested",
    from: "nurture-list",
    to: "interested",
    fromAnchor: "top",
    toAnchor: "top",
    tone: "muted",
    fromPoint: { x: 900, y: 248 },
    toPoint: { x: 745, y: 245 },
    curve: {
      control1: { x: 900, y: 208 },
      control2: { x: 790, y: 208 },
    },
    dotted: true,
  },
  {
    id: "interested-yes",
    from: "interested",
    to: "reply-sequence",
    fromAnchor: "bottom",
    toAnchor: "top",
    tone: "teal",
    label: "YES · 10 (5%)",
    labelPoint: { x: 710, y: 360 },
    via: [{ x: 710, y: 380 }, { x: 455, y: 380 }],
  },
  {
    id: "reply-sequence-booked",
    from: "reply-sequence",
    to: "booked-call",
    fromAnchor: "right",
    toAnchor: "left",
    tone: "blue",
  },
  {
    id: "booked-call-follow-up",
    from: "booked-call",
    to: "personal-follow-up",
    fromAnchor: "right",
    toAnchor: "left",
    tone: "blue",
    label: "NO",
    labelPoint: { x: 820, y: 480 },
    dotted: true,
  },
  {
    id: "follow-up-booked",
    from: "personal-follow-up",
    to: "booked-call",
    fromAnchor: "top",
    toAnchor: "top",
    tone: "muted",
    fromPoint: { x: 900, y: 446 },
    toPoint: { x: 745, y: 445 },
    curve: {
      control1: { x: 900, y: 406 },
      control2: { x: 790, y: 406 },
    },
    dotted: true,
  },
  {
    id: "booked-call-yes",
    from: "booked-call",
    to: "discovery-call",
    fromAnchor: "bottom",
    toAnchor: "top",
    tone: "sky",
    label: "YES · 5 (50%)",
    labelPoint: { x: 710, y: 560 },
    via: [{ x: 710, y: 580 }, { x: 455, y: 580 }],
    dotted: true,
  },
  {
    id: "discovery-qualified",
    from: "discovery-call",
    to: "qualified",
    fromAnchor: "right",
    toAnchor: "left",
    tone: "sky",
    dotted: true,
  },
  {
    id: "qualified-no",
    from: "qualified",
    to: "not-qualified",
    fromAnchor: "right",
    toAnchor: "left",
    tone: "slate",
    label: "NO",
    labelPoint: { x: 820, y: 680 },
  },
  {
    id: "nurture-revisit-qualified",
    from: "not-qualified",
    to: "qualified",
    fromAnchor: "top",
    toAnchor: "top",
    tone: "muted",
    fromPoint: { x: 900, y: 646 },
    toPoint: { x: 745, y: 645 },
    curve: {
      control1: { x: 900, y: 606 },
      control2: { x: 790, y: 606 },
    },
    dotted: true,
  },
  {
    id: "qualified-value",
    from: "qualified",
    to: "value",
    fromAnchor: "bottom",
    toAnchor: "top",
    tone: "teal",
    label: "YES · 4 (80%)",
    labelPoint: { x: 710, y: 760 },
    via: [{ x: 710, y: 780 }, { x: 455, y: 780 }],
  },
  {
    id: "value-closed",
    from: "value",
    to: "one",
    fromAnchor: "right",
    toAnchor: "left",
    tone: "teal",
  },
  {
    id: "won-yes",
    from: "one",
    to: "new-client",
    fromAnchor: "bottom",
    toAnchor: "top",
    tone: "green",
    label: "YES · 1 (25%)",
    labelPoint: { x: 710, y: 973 },
  },
  {
    id: "won-no",
    from: "one",
    to: "won-follow-up",
    fromAnchor: "right",
    toAnchor: "left",
    tone: "slate",
    label: "NO",
    labelPoint: { x: 820, y: 880 },
  },
  {
    id: "won-follow-up-won",
    from: "won-follow-up",
    to: "one",
    fromAnchor: "top",
    toAnchor: "top",
    tone: "muted",
    fromPoint: { x: 900, y: 846 },
    toPoint: { x: 745, y: 845 },
    curve: {
      control1: { x: 900, y: 806 },
      control2: { x: 790, y: 806 },
    },
    dotted: true,
  },
];

const NODE_BY_ID = Object.fromEntries(NODES.map((node) => [node.id, node])) as Record<string, DiagramNode>;

export function LeadFlowMap() {
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const activeNode = activeNodeId ? NODE_BY_ID[activeNodeId] : null;

  function selectNode(nodeId: string) {
    setActiveNodeId((current) => (current === nodeId ? null : nodeId));
  }

  function handleNodeKeyDown(event: KeyboardEvent<SVGGElement>, nodeId: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectNode(nodeId);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] pb-16 pt-5">
      <section aria-label="Lead flow map">
        <div className="overflow-x-auto pb-2">
          <svg
            viewBox="0 0 2000 1200"
            role="img"
            aria-labelledby="flow-map-title flow-map-description"
            className="h-auto min-w-[1300px] w-full"
          >
            <title id="flow-map-title">Lead generation workflow</title>
            <desc id="flow-map-description">
              A connected workflow from prospect lists through contactability,
              the interest-generation sequence, the Interested decision, nurture, and sales.
            </desc>
            <defs>
              <filter id="flow-glass-shadow" x="-20%" y="-30%" width="140%" height="160%">
                <feDropShadow dx="0" dy="5" stdDeviation="6" floodColor="#15324f" floodOpacity="0.11" />
              </filter>
              <marker id="flow-arrow-blue" markerHeight="6" markerWidth="6" refX="5.5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#5b7d99" />
              </marker>
              <marker id="flow-arrow-teal" markerHeight="6" markerWidth="6" refX="5.5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#087890" />
              </marker>
              <marker id="flow-arrow-green" markerHeight="6" markerWidth="6" refX="5.5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#24764f" />
              </marker>
              <marker id="flow-arrow-red" markerHeight="6" markerWidth="6" refX="5.5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#c87982" />
              </marker>
              <marker id="flow-arrow-slate" markerHeight="6" markerWidth="6" refX="5.5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#7b8b98" />
              </marker>
              <marker id="flow-arrow-muted" markerHeight="6" markerWidth="6" refX="5.5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#c0cad1" />
              </marker>
            </defs>

            <g aria-hidden="true">
              {CONNECTIONS.map((connection) => (
                <ConnectionLine key={connection.id} connection={connection} />
              ))}
            </g>

            {NODES.map((node) => (
              <DiagramNode
                key={node.id}
                node={node}
                active={activeNodeId === node.id}
                onSelect={() => selectNode(node.id)}
                onKeyDown={(event) => handleNodeKeyDown(event, node.id)}
              />
            ))}
          </svg>
        </div>

        {activeNode ? <NodeDetails node={activeNode} onClose={() => setActiveNodeId(null)} /> : null}
      </section>
    </div>
  );
}

function ConnectionLine({ connection }: { connection: DiagramConnection }) {
  const from = NODE_BY_ID[connection.from];
  const to = NODE_BY_ID[connection.to];
  const start = connection.fromPoint ?? anchorPoint(from, connection.fromAnchor);
  const end = connection.toPoint ?? anchorPoint(to, connection.toAnchor);
  const tone = TONES[connection.tone ?? "slate"];
  const points = [
    start,
    ...(connection.via ?? []),
    end,
  ];
  const path = connection.curve
    ? `M ${start.x},${start.y} C ${connection.curve.control1.x},${connection.curve.control1.y} ${connection.curve.control2.x},${connection.curve.control2.y} ${end.x},${end.y}`
    : points.map((point) => `${point.x},${point.y}`).join(" ");
  const marker =
    connection.tone === "teal"
      ? "url(#flow-arrow-teal)"
      : connection.tone === "green"
        ? "url(#flow-arrow-green)"
        : connection.tone === "blue"
          ? "url(#flow-arrow-blue)"
          : connection.tone === "red"
            ? "url(#flow-arrow-red)"
            : connection.tone === "muted"
              ? "url(#flow-arrow-muted)"
              : "url(#flow-arrow-slate)";

  return (
    <g>
      {connection.curve ? (
        <path
          d={path}
          fill="none"
          stroke={tone.line}
          strokeDasharray={connection.dotted || (connection.tone === "slate" && connection.label === "NO") ? "5 4" : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={connection.tone === "teal" || connection.tone === "green" ? 2.6 : 2.1}
          markerEnd={marker}
        />
      ) : (
        <polyline
          points={path}
          fill="none"
          stroke={tone.line}
          strokeDasharray={connection.dotted || (connection.tone === "slate" && connection.label === "NO") ? "5 4" : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={connection.tone === "teal" || connection.tone === "green" ? 2.6 : 2.1}
          markerEnd={marker}
        />
      )}
      {connection.label && connection.labelPoint ? (
        <FlowLabel
          point={connection.labelPoint}
          text={connection.label}
          tone={
            connection.label.startsWith("YES")
              ? "teal"
              : connection.label === "NO" || connection.label === "STOP"
                ? "red"
                : connection.label === "LATER"
                  ? "amber"
                  : "slate"
          }
        />
      ) : null}
    </g>
  );
}

function DiagramNode({
  node,
  active,
  onSelect,
  onKeyDown,
}: {
  node: DiagramNode;
  active: boolean;
  onSelect: () => void;
    onKeyDown: (event: KeyboardEvent<SVGGElement>) => void;
}) {
  const tone = TONES[node.tone];
  const titleLines = node.title.split("\n");
  const centerX = node.x + node.width / 2;
  const centerY = node.y + node.height / 2;
  const textLineCount = titleLines.length + (node.meta ? 1 : 0);
  const firstLineY = centerY + 4 - ((textLineCount - 1) * 18) / 2;

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${node.title.replace("\n", " ")}: ${node.description}`}
      aria-pressed={active}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className="cursor-pointer outline-none"
    >
      <title>{node.description}</title>
      {node.shape === "diamond" ? (
        <polygon
          points={`${centerX},${node.y} ${node.x + node.width},${centerY} ${centerX},${node.y + node.height} ${node.x},${centerY}`}
          fill={tone.fill}
          stroke={tone.stroke}
          fillOpacity={0.88}
          strokeDasharray={node.dotted ? "5 4" : undefined}
          strokeOpacity={0.82}
          strokeWidth={active ? 2 : 1.25}
          filter="url(#flow-glass-shadow)"
        />
      ) : (
        <rect
          x={node.x}
          y={node.y}
          width={node.width}
          height={node.height}
          rx={node.shape === "pill" ? node.height / 2 : 10}
          fill={tone.fill}
          stroke={tone.stroke}
          fillOpacity={0.88}
          strokeDasharray={node.dotted ? "5 4" : undefined}
          strokeOpacity={0.82}
          strokeWidth={active ? 2 : 1.25}
          filter="url(#flow-glass-shadow)"
        />
      )}
      <text
        x={centerX}
        y={firstLineY}
        fill="#172433"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fontSize={node.shape === "diamond" ? 15 : 15}
        fontWeight="600"
        textAnchor="middle"
      >
        {titleLines.map((line, index) => (
          <tspan key={line} x={centerX} dy={index === 0 ? 0 : 18}>
            {line}
          </tspan>
        ))}
        {node.meta ? (
          <tspan x={centerX} dy="18" fill={tone.text} fontSize="11" fontWeight="700" letterSpacing="1">
            {node.meta}
          </tspan>
        ) : null}
      </text>
    </g>
  );
}

function FlowLabel({
  point,
  text,
  tone,
}: {
  point: Point;
  text: string;
  tone: "teal" | "green" | "red" | "amber" | "slate";
}) {
  const colors = {
    teal: { text: "#ffffff", fill: "#3f9aa8" },
    green: { text: "#24764f", fill: "#eaf7ef" },
    red: { text: "#b23b47", fill: "#fff0f1" },
    amber: { text: "#96620d", fill: "#fff8e8" },
    slate: { text: "#5b6b78", fill: "#f1f5f8" },
  };
  const color = colors[tone];
  const width = text.length * 7.2 + 24;

  return (
    <g>
      <rect x={point.x - width / 2} y={point.y - 14} width={width} height={28} rx={14} fill={color.fill} />
      <text x={point.x} y={point.y + 4} fill={color.text} fontSize="12" fontWeight="700" letterSpacing="0.6" textAnchor="middle">
        {text}
      </text>
    </g>
  );
}

function NodeDetails({ node, onClose }: { node: DiagramNode; onClose: () => void }) {
  const tone = TONES[node.tone];

  return (
    <aside
      className="mt-5 rounded-xl border bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
      style={{ borderColor: tone.stroke }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: tone.text }}>
            Route detail
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">{node.title.replace("\n", " ")}</h3>
          <p className="mt-1 text-sm text-slate-600">{node.description}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          Close
        </button>
      </div>
      {node.messageSteps ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {node.messageSteps.map((step) => (
            <div key={step.day} className={`rounded-lg p-2.5 ${tone.fill === "#ffffff" ? "bg-slate-50" : "bg-[#f1fafb]"}`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: tone.text }}>
                {step.day}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-800">{step.title}</p>
              <p className="mt-0.5 text-xs leading-4 text-slate-600">{step.detail}</p>
            </div>
          ))}
        </div>
      ) : null}
      {node.details ? (
        <ul className={`${node.messageSteps ? "mt-4 border-t border-slate-200 pt-3" : "mt-4"} space-y-2 text-sm leading-5 text-slate-600`}>
          {node.details.map((detail) => (
            <li key={detail} className="flex gap-2">
              <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${tone.fill === "#ffffff" ? "bg-slate-400" : "bg-[#1ca0c2]"}`} />
              <span>{detail}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}

function anchorPoint(node: DiagramNode, anchor: Anchor): Point {
  switch (anchor) {
    case "top":
      return { x: node.x + node.width / 2, y: node.y };
    case "right":
      return { x: node.x + node.width, y: node.y + node.height / 2 };
    case "bottom":
      return { x: node.x + node.width / 2, y: node.y + node.height };
    case "left":
      return { x: node.x, y: node.y + node.height / 2 };
  }
}
