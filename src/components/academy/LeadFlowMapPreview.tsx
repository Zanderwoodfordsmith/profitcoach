import {
  CONNECTIONS,
  NODES,
  TONES,
  connectionPath,
  type DiagramConnection,
  type DiagramNode,
  type FlowTone,
} from "@/components/academy/leadFlowMapModel";

/**
 * Static, server-rendered crop of the lead-flow diagram: Reply Sequence
 * through to New Client. Purely decorative, so the whole thing is
 * aria-hidden and carries no interactivity.
 */
const CROP = { x: 400, y: -8, width: 760, height: 272 };

const MARKER_FILL: Partial<Record<FlowTone, string>> = {
  teal: "#087890",
  sky: "#287fc1",
  blue: "#5b7d99",
  muted: "#c0cad1",
};
const MARKER_TONES = ["teal", "sky", "blue", "muted", "slate"] as const;

function markerId(tone: FlowTone | undefined) {
  const key = tone && tone in MARKER_FILL ? tone : "slate";
  return `lead-flow-preview-arrow-${key}`;
}

/** The forward path a lead takes; these carry the hover pulse. */
function isForward(connection: DiagramConnection) {
  return connection.tone !== "muted" && connection.label !== "NO";
}

export function LeadFlowMapPreview({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`${CROP.x} ${CROP.y} ${CROP.width} ${CROP.height}`}
      preserveAspectRatio="xMaxYMin slice"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <defs>
        <filter id="lead-flow-preview-shadow" x="-20%" y="-30%" width="140%" height="160%">
          <feDropShadow dx="0" dy="5" stdDeviation="6" floodColor="#15324f" floodOpacity="0.11" />
        </filter>
        {MARKER_TONES.map((tone) => (
          <marker
            key={tone}
            id={markerId(tone)}
            markerHeight="6"
            markerWidth="6"
            refX="5.5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill={MARKER_FILL[tone] ?? "#7b8b98"} />
          </marker>
        ))}
      </defs>
      {CONNECTIONS.map((connection) => (
        <PreviewConnection key={connection.id} connection={connection} />
      ))}
      {NODES.map((node) => (
        <PreviewNode key={node.id} node={node} />
      ))}
    </svg>
  );
}

function PreviewConnection({ connection }: { connection: DiagramConnection }) {
  const tone = TONES[connection.tone ?? "slate"];
  const path = connectionPath(connection);
  const strokeWidth = connection.tone === "teal" || connection.tone === "green" ? 2.6 : 2.1;
  const line = {
    fill: "none",
    stroke: tone.line,
    strokeDasharray:
      connection.dotted || (connection.tone === "slate" && connection.label === "NO")
        ? "5 4"
        : undefined,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth,
    markerEnd: `url(#${markerId(connection.tone)})`,
  };
  // Hidden until a parent's stylesheet reveals and animates it.
  const pulse = {
    className: "lead-flow-preview-pulse",
    opacity: 0,
    fill: "none",
    stroke: "#ffffff",
    strokeDasharray: "5 15",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: strokeWidth - 0.6,
  };
  const label =
    connection.label === "NO" ? "NO" : connection.tone === "teal" && connection.labelPoint ? "YES" : null;

  return (
    <g>
      {connection.curve ? <path d={path} {...line} /> : <polyline points={path} {...line} />}
      {isForward(connection) ? (
        connection.curve ? <path d={path} {...pulse} /> : <polyline points={path} {...pulse} />
      ) : null}
      {label && connection.labelPoint ? (
        <PreviewLabel x={connection.labelPoint.x} y={connection.labelPoint.y} text={label} />
      ) : null}
    </g>
  );
}

function PreviewLabel({ x, y, text }: { x: number; y: number; text: "YES" | "NO" }) {
  const yes = text === "YES";
  const width = yes ? 36 : 30;
  return (
    <g>
      <rect
        x={x - width / 2}
        y={y - 10}
        width={width}
        height={20}
        rx={10}
        fill={yes ? "#3f9aa8" : "#fff0f1"}
      />
      <text
        x={x}
        y={y + 3.5}
        fill={yes ? "#ffffff" : "#b23b47"}
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fontSize="10"
        fontWeight="700"
        letterSpacing="0.04em"
        textAnchor="middle"
      >
        {text}
      </text>
    </g>
  );
}

function PreviewNode({ node }: { node: DiagramNode }) {
  const tone = TONES[node.tone];
  const titleLines = node.title.split("\n");
  const centerX = node.x + node.width / 2;
  const centerY = node.y + node.height / 2;
  const lineHeight = node.shape === "diamond" ? 16 : 17;
  const firstLineY = centerY + 4 - ((titleLines.length - 1) * lineHeight) / 2;
  const shape = {
    fill: tone.fill,
    stroke: tone.stroke,
    fillOpacity: node.tone === "muted" ? 0.88 : 0.94,
    strokeDasharray: node.dotted ? "5 4" : undefined,
    strokeOpacity: node.tone === "muted" ? 0.55 : 0.82,
    strokeWidth: 1.25,
    filter: node.tone === "muted" ? undefined : "url(#lead-flow-preview-shadow)",
  };

  return (
    <g>
      {node.shape === "diamond" ? (
        <polygon
          points={`${centerX},${node.y} ${node.x + node.width},${centerY} ${centerX},${node.y + node.height} ${node.x},${centerY}`}
          {...shape}
        />
      ) : (
        <rect
          x={node.x}
          y={node.y}
          width={node.width}
          height={node.height}
          rx={node.shape === "pill" ? node.height / 2 : 10}
          {...shape}
        />
      )}
      <text
        x={centerX}
        y={firstLineY}
        fill={node.tone === "muted" ? tone.text : "#172433"}
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fontSize="13"
        fontWeight="600"
        textAnchor="middle"
      >
        {titleLines.map((line, index) => (
          <tspan key={`${node.id}-${line}`} x={centerX} dy={index === 0 ? 0 : lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}
