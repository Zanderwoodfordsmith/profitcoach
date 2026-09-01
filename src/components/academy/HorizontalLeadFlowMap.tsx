"use client";

import { useRef, useState, type KeyboardEvent } from "react";

type FlowTone = "blue" | "sky" | "teal" | "green" | "amber" | "red" | "slate" | "muted";
type Anchor = "top" | "right" | "bottom" | "left";

type Point = {
  x: number;
  y: number;
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
  details?: string[];
  dotted?: boolean;
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
  stackedLabel?: boolean;
  via?: Point[];
  fromPoint?: Point;
  toPoint?: Point;
  curve?: {
    control1: Point;
    control2: Point;
  };
  dotted?: boolean;
};

const TONES: Record<FlowTone, { stroke: string; fill: string; text: string; line: string }> = {
  blue: {
    stroke: "#b9cbd4",
    fill: "#ffffff",
    text: "#475b67",
    line: "#6d9bb1",
  },
  sky: {
    stroke: "#b9cbd4",
    fill: "#ffffff",
    text: "#475b67",
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
    stroke: "#b9cbd4",
    fill: "#ffffff",
    text: "#475b67",
    line: "#9caeb9",
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
    id: "prospect-lists",
    title: "Prospect\nlists",
    x: 115,
    y: 55,
    width: 170,
    height: 58,
    shape: "rect",
    tone: "slate",
    description: "The wider list of good-fit people.",
    details: [
      "Build from base search, narrowed prospect search, your network, and existing relationships.",
      "This is the wider pool before the active interest-generation sequence.",
    ],
  },
  {
    id: "interest-sequence",
    title: "Generate Interest\nSequence",
    x: 375,
    y: 55,
    width: 170,
    height: 58,
    shape: "rect",
    tone: "blue",
    description: "The active sequence for generating interest.",
    details: [
      "Only include people who are reachable through a legitimate contact route.",
      "The working target is 200 people through the sequence, producing 10 Interested.",
    ],
  },
  {
    id: "reply-sequence",
    title: "Reply\nsequence",
    x: 635,
    y: 55,
    width: 170,
    height: 58,
    shape: "rect",
    tone: "blue",
    description: "Respond to an Interested person and move them toward a booked conversation.",
    details: [
      "Use the relevant reply sequence for a positive reply or completed scorecard.",
      "The goal is a clear next step, not another long pitch.",
    ],
  },
  {
    id: "discovery-call",
    title: "Discovery\ncall*",
    x: 895,
    y: 55,
    width: 170,
    height: 58,
    shape: "rect",
    tone: "sky",
    dotted: true,
    description: "An optional conversation before the Value Session.",
    details: ["Use it when a short conversation will help confirm fit or readiness."],
  },
  {
    id: "value",
    title: "Value\nsession",
    x: 1155,
    y: 55,
    width: 170,
    height: 58,
    shape: "rect",
    tone: "sky",
    description: "Show the gap and the route forward.",
    details: [
      "This is the main next step after qualification.",
      "After the Value Session, move toward a decision.",
    ],
  },
  {
    id: "reachable",
    title: "Reachable?",
    x: 140,
    y: 200,
    width: 120,
    height: 120,
    shape: "diamond",
    tone: "amber",
    description: "Do we have a legitimate way to reach this person?",
  },
  {
    id: "interested",
    title: "Interested?",
    x: 400,
    y: 200,
    width: 120,
    height: 120,
    shape: "diamond",
    tone: "amber",
    description: "Is there a positive reply or completed BOSS Scorecard?",
    details: [
      "Interested is the only KPI members need to focus on.",
      "Count positive replies and completed BOSS Scorecards unless they have explicitly said no.",
      "Not right now goes to nurture. Not interested means stop. No response is parked.",
    ],
  },
  {
    id: "booked",
    title: "Booked?",
    x: 660,
    y: 200,
    width: 120,
    height: 120,
    shape: "diamond",
    tone: "amber",
    description: "Has the reply sequence led to a booked conversation?",
    details: [
      "YES: continue through the optional Discovery Call route.",
      "NO: use Personal Follow-up and revisit the booking decision.",
    ],
  },
  {
    id: "qualified",
    title: "Qualified?",
    x: 920,
    y: 200,
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
    id: "won",
    title: "Won?",
    x: 1180,
    y: 200,
    width: 120,
    height: 120,
    shape: "diamond",
    tone: "amber",
    description: "Has the person decided to become a client?",
    details: ["YES: start coaching. NO: schedule a later follow-up."],
  },
  {
    id: "connector-campaign",
    title: "Connector\nCampaign",
    x: 115,
    y: 395,
    width: 170,
    height: 58,
    shape: "rect",
    tone: "blue",
    description: "A route to create a legitimate LinkedIn connection.",
    details: ["Use a connection request and relevant follow-up. Do not scrape emails."],
  },
  {
    id: "nurture-list",
    title: "Nurture\nlist",
    x: 375,
    y: 395,
    width: 170,
    height: 58,
    shape: "rect",
    tone: "slate",
    description: "The route for people who are not ready yet.",
    details: [
      "Use for Not right now: record a date or note for the next follow-up.",
      "No response can be parked here for longer-term nurture.",
    ],
  },
  {
    id: "personal-follow-up",
    title: "Personal\nfollow-up",
    x: 635,
    y: 395,
    width: 170,
    height: 58,
    shape: "rect",
    tone: "blue",
    description: "A personal recovery path when a booking has not happened.",
    details: [
      "Use the relevant personal follow-up sequence.",
      "The goal is a clear next step, not another long pitch.",
    ],
  },
  {
    id: "nurture-revisit",
    title: "Nurture /\nrevisit",
    x: 895,
    y: 395,
    width: 170,
    height: 58,
    shape: "rect",
    tone: "slate",
    description: "Not ready for a Value Session yet.",
    details: ["Return to nurture and revisit when timing or fit changes."],
  },
  {
    id: "new-client",
    title: "New\nclient",
    x: 1400,
    y: 221,
    width: 78,
    height: 78,
    shape: "rect",
    tone: "green",
    description: "Start coaching with the new client.",
    details: ["Take payment, confirm onboarding, and begin coaching."],
  },
  {
    id: "won-follow-up",
    title: "Follow-up\nin 90 days",
    x: 1155,
    y: 395,
    width: 170,
    height: 58,
    shape: "rect",
    tone: "slate",
    description: "A later follow-up for someone who has not won yet.",
    details: ["Temporary placeholder for the future follow-up route."],
  },
];

const CONNECTIONS: DiagramConnection[] = [
  {
    id: "list-reachable",
    from: "prospect-lists",
    to: "reachable",
    fromAnchor: "bottom",
    toAnchor: "top",
  },
  {
    id: "reachable-yes",
    from: "reachable",
    to: "interest-sequence",
    fromAnchor: "right",
    toAnchor: "left",
    tone: "teal",
    label: "YES · 200 (20%)",
    labelPoint: { x: 330, y: 170 },
    via: [{ x: 330, y: 260 }, { x: 330, y: 84 }],
  },
  {
    id: "reachable-no",
    from: "reachable",
    to: "connector-campaign",
    fromAnchor: "bottom",
    toAnchor: "top",
    tone: "slate",
    label: "NO",
    labelPoint: { x: 200, y: 350 },
  },
  {
    id: "connector-reachable",
    from: "connector-campaign",
    to: "reachable",
    fromAnchor: "top",
    toAnchor: "bottom",
    tone: "muted",
    fromPoint: { x: 135, y: 395 },
    toPoint: { x: 164, y: 296 },
    curve: {
      control1: { x: 140, y: 325 },
      control2: { x: 140, y: 325 },
    },
    dotted: true,
  },
  {
    id: "sequence-interested",
    from: "interest-sequence",
    to: "interested",
    fromAnchor: "bottom",
    toAnchor: "top",
  },
  {
    id: "interested-yes",
    from: "interested",
    to: "reply-sequence",
    fromAnchor: "right",
    toAnchor: "left",
    tone: "teal",
    label: "YES · 10 (5%)",
    labelPoint: { x: 590, y: 170 },
    via: [{ x: 590, y: 260 }, { x: 590, y: 84 }],
  },
  {
    id: "interested-no",
    from: "interested",
    to: "nurture-list",
    fromAnchor: "bottom",
    toAnchor: "top",
    tone: "slate",
    label: "NO",
    labelPoint: { x: 460, y: 350 },
  },
  {
    id: "nurture-interested",
    from: "nurture-list",
    to: "interested",
    fromAnchor: "top",
    toAnchor: "bottom",
    tone: "muted",
    fromPoint: { x: 395, y: 395 },
    toPoint: { x: 424, y: 296 },
    curve: {
      control1: { x: 400, y: 325 },
      control2: { x: 400, y: 325 },
    },
    dotted: true,
  },
  {
    id: "reply-booked",
    from: "reply-sequence",
    to: "booked",
    fromAnchor: "bottom",
    toAnchor: "top",
  },
  {
    id: "booked-yes",
    from: "booked",
    to: "discovery-call",
    fromAnchor: "right",
    toAnchor: "left",
    tone: "sky",
    label: "YES · 5 (50%)",
    labelPoint: { x: 850, y: 170 },
    via: [{ x: 850, y: 260 }, { x: 850, y: 84 }],
    dotted: true,
  },
  {
    id: "booked-no",
    from: "booked",
    to: "personal-follow-up",
    fromAnchor: "bottom",
    toAnchor: "top",
    tone: "blue",
    label: "NO",
    labelPoint: { x: 720, y: 350 },
    dotted: true,
  },
  {
    id: "follow-up-booked",
    from: "personal-follow-up",
    to: "booked",
    fromAnchor: "top",
    toAnchor: "bottom",
    tone: "muted",
    fromPoint: { x: 655, y: 395 },
    toPoint: { x: 684, y: 296 },
    curve: {
      control1: { x: 660, y: 325 },
      control2: { x: 660, y: 325 },
    },
    dotted: true,
  },
  {
    id: "discovery-qualified",
    from: "discovery-call",
    to: "qualified",
    fromAnchor: "bottom",
    toAnchor: "top",
    tone: "sky",
    dotted: true,
  },
  {
    id: "qualified-yes",
    from: "qualified",
    to: "value",
    fromAnchor: "right",
    toAnchor: "left",
    tone: "teal",
    label: "YES · 4 (80%)",
    labelPoint: { x: 1110, y: 170 },
    via: [{ x: 1110, y: 260 }, { x: 1110, y: 84 }],
  },
  {
    id: "qualified-no",
    from: "qualified",
    to: "nurture-revisit",
    fromAnchor: "bottom",
    toAnchor: "top",
    tone: "slate",
    label: "NO",
    labelPoint: { x: 980, y: 350 },
  },
  {
    id: "revisit-qualified",
    from: "nurture-revisit",
    to: "qualified",
    fromAnchor: "top",
    toAnchor: "bottom",
    tone: "muted",
    fromPoint: { x: 915, y: 395 },
    toPoint: { x: 944, y: 296 },
    curve: {
      control1: { x: 920, y: 325 },
      control2: { x: 920, y: 325 },
    },
    dotted: true,
  },
  {
    id: "value-won",
    from: "value",
    to: "won",
    fromAnchor: "bottom",
    toAnchor: "top",
  },
  {
    id: "won-yes",
    from: "won",
    to: "new-client",
    fromAnchor: "right",
    toAnchor: "left",
    tone: "teal",
    label: "YES · 1 (25%)",
    labelPoint: { x: 1350, y: 230 },
    stackedLabel: true,
  },
  {
    id: "won-no",
    from: "won",
    to: "won-follow-up",
    fromAnchor: "bottom",
    toAnchor: "top",
    tone: "slate",
    label: "NO",
    labelPoint: { x: 1240, y: 350 },
  },
  {
    id: "follow-up-won",
    from: "won-follow-up",
    to: "won",
    fromAnchor: "top",
    toAnchor: "bottom",
    tone: "muted",
    fromPoint: { x: 1175, y: 395 },
    toPoint: { x: 1204, y: 296 },
    curve: {
      control1: { x: 1180, y: 325 },
      control2: { x: 1180, y: 325 },
    },
    dotted: true,
  },
];

const NODE_BY_ID = Object.fromEntries(NODES.map((node) => [node.id, node])) as Record<string, DiagramNode>;

export function HorizontalLeadFlowMap() {
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeNode = activeNodeId ? NODE_BY_ID[activeNodeId] : null;
  const hoveredNode = hoveredNodeId ? NODE_BY_ID[hoveredNodeId] : null;

  function selectNode(nodeId: string) {
    setActiveNodeId((current) => (current === nodeId ? null : nodeId));
  }

  function showHoverCard(nodeId: string) {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
      hoverTimeout.current = null;
    }
    setHoveredNodeId(nodeId);
  }

  function hideHoverCard() {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
    }
    hoverTimeout.current = setTimeout(() => {
      setHoveredNodeId(null);
      hoverTimeout.current = null;
    }, 120);
  }

  function keepHoverCard() {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
      hoverTimeout.current = null;
    }
  }

  function handleNodeKeyDown(event: KeyboardEvent<SVGGElement>, nodeId: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectNode(nodeId);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] pb-16 pt-5">
      <section aria-label="Horizontal lead flow map">
        <div className="overflow-x-auto pb-2">
          <svg
            viewBox="0 0 1750 650"
            role="img"
            aria-labelledby="horizontal-flow-map-title horizontal-flow-map-description"
            className="h-auto min-w-[1600px] w-full"
          >
            <title id="horizontal-flow-map-title">Horizontal lead generation workflow</title>
            <desc id="horizontal-flow-map-description">
              A horizontal workflow from prospect lists through reachability, interest generation,
              reply handling, qualification, value session, and new client.
            </desc>
            <defs>
              <filter id="horizontal-flow-shadow" x="-20%" y="-30%" width="140%" height="160%">
                <feDropShadow dx="0" dy="5" stdDeviation="6" floodColor="#15324f" floodOpacity="0.11" />
              </filter>
              <marker id="horizontal-arrow-blue" markerHeight="6" markerWidth="6" refX="5.5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#5b7d99" />
              </marker>
              <marker id="horizontal-arrow-teal" markerHeight="6" markerWidth="6" refX="5.5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#087890" />
              </marker>
              <marker id="horizontal-arrow-sky" markerHeight="6" markerWidth="6" refX="5.5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#287fc1" />
              </marker>
              <marker id="horizontal-arrow-slate" markerHeight="6" markerWidth="6" refX="5.5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#7b8b98" />
              </marker>
              <marker id="horizontal-arrow-muted" markerHeight="6" markerWidth="6" refX="5.5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#c0cad1" />
              </marker>
            </defs>
            <g aria-hidden="true">
              {CONNECTIONS.map((connection) => (
                <HorizontalConnectionLine key={connection.id} connection={connection} />
              ))}
            </g>
            {NODES.map((node) => (
              <HorizontalDiagramNode
                key={node.id}
                node={node}
                active={activeNodeId === node.id}
                onSelect={() => selectNode(node.id)}
                onKeyDown={(event) => handleNodeKeyDown(event, node.id)}
                onHoverStart={() => showHoverCard(node.id)}
                onHoverEnd={hideHoverCard}
              />
            ))}
            {hoveredNode ? (
              <HorizontalHoverCard
                node={hoveredNode}
                onMouseEnter={keepHoverCard}
                onMouseLeave={hideHoverCard}
              />
            ) : null}
          </svg>
        </div>
        {activeNode ? <HorizontalNodeDetails node={activeNode} onClose={() => setActiveNodeId(null)} /> : null}
      </section>
    </div>
  );
}

function anchorPoint(node: DiagramNode, anchor: Anchor): Point {
  const centerX = node.x + node.width / 2;
  const centerY = node.y + node.height / 2;

  switch (anchor) {
    case "top":
      return { x: centerX, y: node.y };
    case "right":
      return { x: node.x + node.width, y: centerY };
    case "bottom":
      return { x: centerX, y: node.y + node.height };
    case "left":
      return { x: node.x, y: centerY };
  }
}

function HorizontalConnectionLine({ connection }: { connection: DiagramConnection }) {
  const from = NODE_BY_ID[connection.from];
  const to = NODE_BY_ID[connection.to];
  const start = connection.fromPoint ?? anchorPoint(from, connection.fromAnchor);
  const end = connection.toPoint ?? anchorPoint(to, connection.toAnchor);
  const tone = TONES[connection.tone ?? "slate"];
  const points = [start, ...(connection.via ?? []), end];
  const path = connection.curve
    ? `M ${start.x},${start.y} C ${connection.curve.control1.x},${connection.curve.control1.y} ${connection.curve.control2.x},${connection.curve.control2.y} ${end.x},${end.y}`
    : points.map((point) => `${point.x},${point.y}`).join(" ");
  const marker =
    connection.tone === "teal"
      ? "url(#horizontal-arrow-teal)"
      : connection.tone === "sky"
        ? "url(#horizontal-arrow-sky)"
        : connection.tone === "blue"
          ? "url(#horizontal-arrow-blue)"
          : connection.tone === "muted"
            ? "url(#horizontal-arrow-muted)"
            : "url(#horizontal-arrow-slate)";
  const sharedProps = {
    fill: "none",
    stroke: tone.line,
    strokeDasharray: connection.dotted || (connection.tone === "slate" && connection.label === "NO") ? "5 4" : undefined,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: connection.tone === "teal" || connection.tone === "green" ? 2.6 : 2.1,
    markerEnd: marker,
  };

  return (
    <g>
      {connection.curve ? <path d={path} {...sharedProps} /> : <polyline points={path} {...sharedProps} />}
      {connection.label && connection.labelPoint ? (
        <HorizontalFlowLabel
          point={connection.labelPoint}
          text={connection.label}
          tone={connection.label.startsWith("YES") ? "teal" : connection.label === "NO" ? "red" : "slate"}
          stacked={connection.stackedLabel}
        />
      ) : null}
    </g>
  );
}

function HorizontalDiagramNode({
  node,
  active,
  onSelect,
  onKeyDown,
  onHoverStart,
  onHoverEnd,
}: {
  node: DiagramNode;
  active: boolean;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<SVGGElement>) => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}) {
  const tone = TONES[node.tone];
  const titleLines = node.title.split("\n");
  const centerX = node.x + node.width / 2;
  const centerY = node.y + node.height / 2;
  const firstLineY = centerY + 4 - ((titleLines.length - 1) * 18) / 2;

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${node.title.replace("\n", " ")}: ${node.description}`}
      aria-pressed={active}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onFocus={onHoverStart}
      onBlur={onHoverEnd}
      className="cursor-pointer outline-none"
    >
      <title>{node.description}</title>
      {node.shape === "diamond" ? (
        <polygon
          points={`${centerX},${node.y} ${node.x + node.width},${centerY} ${centerX},${node.y + node.height} ${node.x},${centerY}`}
          fill={tone.fill}
          stroke={tone.stroke}
          fillOpacity={0.94}
          strokeDasharray={node.dotted ? "5 4" : undefined}
          strokeOpacity={0.82}
          strokeWidth={active ? 2 : 1.25}
          filter="url(#horizontal-flow-shadow)"
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
          fillOpacity={0.94}
          strokeDasharray={node.dotted ? "5 4" : undefined}
          strokeOpacity={0.82}
          strokeWidth={active ? 2 : 1.25}
          filter="url(#horizontal-flow-shadow)"
        />
      )}
      <text
        x={centerX}
        y={firstLineY}
        fill="#172433"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fontSize="15"
        fontWeight="600"
        textAnchor="middle"
      >
        {titleLines.map((line, index) => (
          <tspan key={`${node.id}-${line}`} x={centerX} dy={index === 0 ? 0 : 18}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function HorizontalHoverCard({
  node,
  onMouseEnter,
  onMouseLeave,
}: {
  node: DiagramNode;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const { x, y } = hoverCardPosition(node);
  const details = node.details?.slice(0, 2) ?? [];
  const tooltipId = `horizontal-node-tooltip-${node.id}`;

  return (
    <foreignObject
      x={x}
      y={y}
      width={420}
      height={400}
      role="tooltip"
      id={tooltipId}
      pointerEvents="all"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        className="w-[420px] rounded-2xl border border-slate-200/90 bg-white/95 p-8 text-left shadow-[0_18px_50px_rgba(21,50,79,0.18)] backdrop-blur-md"
      >
        <div className="mb-3 h-1 w-12 rounded-full bg-gradient-to-r from-[#0c5290] to-[#1a8fd4]" />
        <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-slate-400">Flow detail</p>
        <h3 className="mt-2 text-[28px] font-semibold leading-8 text-slate-900">{node.title.replace("\n", " ")}</h3>
        <p className="mt-5 text-lg leading-8 text-slate-600">{node.description}</p>
        {details.length > 0 ? (
          <ul className="mt-6 space-y-4 border-t border-slate-100 pt-6 text-base leading-7 text-slate-500">
            {details.map((detail) => (
              <li key={detail} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#4b9bb3]" />
                <span>{detail}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </foreignObject>
  );
}

function hoverCardPosition(node: DiagramNode): Point {
  const cardWidth = 420;
  const cardHeight = 400;
  const edge = 16;
  const gap = 18;
  const maxX = 1750 - cardWidth - edge;
  const maxY = 650 - cardHeight - edge;
  const centerX = node.x + node.width / 2;
  const centerY = node.y + node.height / 2;

  if (node.y >= 360) {
    return {
      x: Math.min(Math.max(centerX - cardWidth / 2, edge), maxX),
      y: Math.max(node.y - cardHeight - gap, edge),
    };
  }

  if (node.shape === "diamond") {
    return {
      x: Math.min(Math.max(node.x + node.width + gap, edge), maxX),
      y: Math.min(Math.max(centerY - cardHeight / 2, edge), maxY),
    };
  }

  return {
    x: Math.min(Math.max(centerX - cardWidth / 2, edge), maxX),
    y: Math.min(node.y + node.height + gap, maxY),
  };
}

function HorizontalFlowLabel({
  point,
  text,
  tone,
  stacked = false,
}: {
  point: Point;
  text: string;
  tone: "teal" | "red" | "slate";
  stacked?: boolean;
}) {
  const colors = {
    teal: { text: "#ffffff", fill: "#3f9aa8" },
    red: { text: "#b23b47", fill: "#fff0f1" },
    slate: { text: "#5b6b78", fill: "#f1f5f8" },
  };
  const color = colors[tone];
  if (stacked) {
    const [title, metric] = text.split(" · ");
    return (
      <g>
        <rect x={point.x - 32} y={point.y - 19} width={64} height={38} rx={10} fill={color.fill} />
        <text x={point.x} y={point.y - 4} fill={color.text} fontSize="10" fontWeight="700" letterSpacing="0.6" textAnchor="middle">
          <tspan x={point.x} dy="0">
            {title}
          </tspan>
          <tspan x={point.x} dy="14">
            {metric}
          </tspan>
        </text>
      </g>
    );
  }
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

function HorizontalNodeDetails({ node, onClose }: { node: DiagramNode; onClose: () => void }) {
  return (
    <aside className="relative mt-4 rounded-2xl border border-slate-200/80 bg-white/85 p-5 shadow-[0_14px_45px_rgba(21,50,79,0.08)] backdrop-blur-sm">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
      >
        Close
      </button>
      <p className="pr-20 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Node detail</p>
      <h2 className="mt-1 text-xl font-semibold text-slate-900">{node.title.replace("\n", " ")}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{node.description}</p>
      {node.details ? (
        <ul className="mt-4 grid max-w-4xl gap-2 text-sm leading-5 text-slate-600 md:grid-cols-2">
          {node.details.map((detail) => (
            <li key={detail} className="rounded-xl bg-slate-50 px-3 py-2">
              {detail}
            </li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}
