/**
 * Geometry and content for the Get Calls lead-flow diagram. Shared by the
 * interactive map on the System page and the static preview on the
 * Classroom hub, so both always draw the same nodes.
 */

export type FlowTone = "blue" | "sky" | "teal" | "green" | "amber" | "red" | "slate" | "muted";
export type Anchor = "top" | "right" | "bottom" | "left";

export type Point = {
  x: number;
  y: number;
};

export type HoverExample = {
  label: string;
  body: string;
};

export type DiagramNode = {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: "rect" | "diamond" | "pill";
  tone: FlowTone;
  /** Short overview. Use \n\n between paragraphs. */
  description: string;
  /** Optional callout under the overview (one strong line). */
  note?: string;
  /** Optional bullets — use only when a list is clearer than prose. */
  details?: string[];
  /** Optional expandable example / wording sample. */
  example?: HoverExample;
  dotted?: boolean;
  /** Classroom lesson path when this node has a matching lesson. */
  href?: string | null;
};

export type DiagramConnection = {
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

export const CLASSROOM_BASE_ADMIN = "/admin/academy/classroom";
export const CLASSROOM_BASE_COACH = "/coach/academy/classroom";

export function classroomLesson(courseId: string, lessonId: string) {
  // Stored against the admin base; remapped to coach/admin at render time.
  return `${CLASSROOM_BASE_ADMIN}/${encodeURIComponent(courseId)}/${encodeURIComponent(lessonId)}`;
}

export function resolveClassroomHref(classroomBase: string, href: string | null | undefined): string | null {
  if (!href) return null;
  if (href.startsWith(CLASSROOM_BASE_ADMIN)) {
    return `${classroomBase}${href.slice(CLASSROOM_BASE_ADMIN.length)}`;
  }
  if (href.startsWith(CLASSROOM_BASE_COACH)) {
    return `${classroomBase}${href.slice(CLASSROOM_BASE_COACH.length)}`;
  }
  return href;
}

export const LEFT = 4;
export const COL_STEP = 217;
export const RECT_W = 150;
export const RECT_H = 52;
export const DIAMOND = 106;
export const NEW_CLIENT_W = 72;
export const NEW_CLIENT_H = 52;
export const TOP_Y = 16;
export const MID_Y = 130;
export const BOTTOM_Y = 306;
export const VIEW_W = 1120;
export const VIEW_H = 380;
/** Shared YES band: slightly above the old bottom-entry Won pill. */
export const YES_LABEL_Y = Math.round((TOP_Y + NEW_CLIENT_H + MID_Y + DIAMOND / 2) / 2) - 12;
/** Sit NO a bit above the midpoint of the down-arrow. */
export const NO_LABEL_Y = Math.round(MID_Y + DIAMOND + (BOTTOM_Y - MID_Y - DIAMOND) * 0.36) + 5;
export const RETURN_CURVE_Y = Math.round(MID_Y + DIAMOND + (BOTTOM_Y - MID_Y - DIAMOND) * 0.5);

export function colRectX(col: number) {
  return LEFT + col * COL_STEP;
}

export function colDiamondX(col: number) {
  return LEFT + Math.round((RECT_W - DIAMOND) / 2) + col * COL_STEP;
}

export function colCenterX(col: number) {
  return colRectX(col) + RECT_W / 2;
}

export function yesViaX(fromCol: number) {
  const diamondRight = colDiamondX(fromCol) + DIAMOND;
  const nextRectLeft = colRectX(fromCol + 1);
  return Math.round((diamondRight + nextRectLeft) / 2);
}

export function newClientX() {
  return colRectX(4) + RECT_W + 22;
}

export function returnFromPoint(col: number): Point {
  // Leave near the left edge of the bottom card (not the column centre).
  return { x: colRectX(col) + 18, y: BOTTOM_Y };
}

export function returnToPoint(col: number): Point {
  // Aim near the middle of the diamond's bottom-left edge, with a small gap so it doesn't touch.
  return {
    x: colDiamondX(col) + Math.round(DIAMOND * 0.28) - 8,
    y: MID_Y + Math.round(DIAMOND * 0.78) + 8,
  };
}

export function returnCurveX(col: number) {
  // Soft left bow between the bottom card and the diamond.
  return colDiamondX(col) - 6;
}

export const TONES: Record<FlowTone, { stroke: string; fill: string; text: string; line: string }> = {
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
    stroke: "#d2dae2",
    fill: "#f0f3f6",
    text: "#7a8794",
    line: "#c0cad1",
  },
};

export const NODES: DiagramNode[] = [
  {
    id: "prospect-lists",
    title: "Prospect\nLists",
    x: colRectX(0),
    y: TOP_Y,
    width: RECT_W,
    height: RECT_H,
    shape: "rect",
    tone: "slate",
    description: "The wider pool of good-fit people before the active interest sequence.",
    details: [
      "Four sources: base search, narrowed ideal search, your network, existing relationships.",
      "Refine until most names look like a fit (~8/10 on sample pages).",
      "Aim for enough volume (~600+) so A/B testing has room to work.",
      "This list feeds Reachable? — only some will already be contactable.",
    ],
    href: classroomLesson(
      "get-calls",
      "get-calls-ideal-clients-linkedin-sales-navigator-build-your-prospect-list",
    ),
  },
  {
    id: "interest-sequence",
    title: "Interest\nSequence",
    x: colRectX(1),
    y: TOP_Y,
    width: RECT_W,
    height: RECT_H,
    shape: "rect",
    tone: "blue",
    description:
      "Also called the VIP 200 / Two Week Sequence. Four messages. Fourteen days. Each one has a different job.\n\n" +
      "Run reachable people through it (about 200). A positive reply or a completed BOSS Scorecard counts as Interested.",
    note: "If you only send message one, you will conclude LinkedIn is dead. Most meetings come from messages three and four.",
    details: [
      "New LinkedIn connection — they accept, then see your posts for ~48 hours (about 30–40% accept).",
      "Day 2 — Problem opener: name a problem they feel, reframe it, soft ask. Under 75 words. One question. No link, no calendar, no word “coaching”.",
      "Day 5 — Forgot to mention: one proof line, then hand over the asset (this is where the V in RSVP lands).",
      "Day 8 — The nudge: their first name and a question mark only. Highest reply of the four.",
      "Day 14 — Loose breakup: take the pressure off. This pulls replies nothing else pulls.",
    ],
    example: {
      label: "Show sample messages",
      body:
        "Day 2 — Hi Sarah, most owners running an engineering business your size tell me revenue is growing but profit isn’t following it. The issue is rarely sales — it’s that nobody has scored the nine areas underneath. Worth a chat? I’ve got two ideas for a business your size.\n\n" +
        "Day 5 — Forgot to mention, the last engineering owner I did this with found £180K in his pricing, not his pipeline. Would it help to see what we changed?\n\n" +
        "Day 8 — Sarah?\n\n" +
        "Day 14 — Totally get it if the timing’s off. When getting profit to move without adding headcount becomes the priority, I’d be glad to help. All the best either way.\n\n" +
        "Change every time: name, sector, size, which opener fits their profile. Leave the four-line shape alone when a version is working — put volume behind it.",
    },
    href: classroomLesson("get-calls", "get-calls-lead-generation-run-your-vip-nurture"),
  },
  {
    id: "reply-sequence",
    title: "Reply\nSequence",
    x: colRectX(2),
    y: TOP_Y,
    width: RECT_W,
    height: RECT_H,
    shape: "rect",
    tone: "blue",
    description: "Respond to an Interested person and move them toward a booked conversation.",
    details: [
      "Use the positive-reply or completed-scorecard reply path — don’t freestyle every time.",
      "Keep replies warm and short; aim for a clear next step (book), not another pitch.",
      "Start in Co-Pilot (approve drafts); Auto-Pilot only after messages are proven.",
      "Booked means a calendar event — a link alone does not count.",
    ],
    href: classroomLesson("get-calls", "get-calls-replying-to-leads-set-up-connector-co-pilot"),
  },
  {
    id: "discovery-call",
    title: "Discovery\nCall",
    x: colRectX(3),
    y: TOP_Y,
    width: RECT_W,
    height: RECT_H,
    shape: "rect",
    tone: "sky",
    description: "An optional short conversation before the Value Session.",
    details: [
      "Use only when fit or readiness is still unclear after booking.",
      "Confirm they match your ideal client and want help now.",
      "If they are already clear and qualified, skip straight to Value Session.",
      "Wrong fit here → Nurture / Revisit, not free ongoing advice.",
    ],
    href: classroomLesson("win-clients", "win-clients-book-and-run-value-sessions"),
  },
  {
    id: "value",
    title: "Value\nSession",
    x: colRectX(4),
    y: TOP_Y,
    width: RECT_W,
    height: RECT_H,
    shape: "rect",
    tone: "sky",
    description: "Show the gap and the route forward — then move to a decision.",
    details: [
      "This is the main conversion conversation after they qualify.",
      "Show the gap (BOSS Pro helps) and a clear route to close it.",
      "End by moving toward a yes/no — don’t leave them in “interesting chat.”",
      "Won? YES → New Client. NO → Follow-up in ~90 days, not endless chasing.",
    ],
    href: classroomLesson("win-clients", "win-clients-book-and-run-value-sessions"),
  },
  {
    id: "reachable",
    title: "Reachable?",
    x: colDiamondX(0),
    y: MID_Y,
    width: DIAMOND,
    height: DIAMOND,
    shape: "diamond",
    tone: "amber",
    description: "Do we already have a legitimate way to contact this person?",
    details: [
      "YES: phone, email, or LinkedIn DM (already connected / 1st degree).",
      "NO: run Connector Campaign first — never scrape emails.",
      "Only reachable people enter the Interest Sequence.",
      "This gate protects deliverability and keeps outreach legitimate.",
    ],
  },
  {
    id: "interested",
    title: "Interested?",
    x: colDiamondX(1),
    y: MID_Y,
    width: DIAMOND,
    height: DIAMOND,
    shape: "diamond",
    tone: "amber",
    description: "Is there a positive reply or completed BOSS Scorecard?",
    details: [
      "Interested is the KPI to watch — protect this number weekly.",
      "Count positive replies and completed scorecards unless they said no.",
      "Not right now → Nurture List with a revisit date.",
      "Not interested → stop. No response → park on nurture longer-term.",
    ],
  },
  {
    id: "booked",
    title: "Booked?",
    x: colDiamondX(2),
    y: MID_Y,
    width: DIAMOND,
    height: DIAMOND,
    shape: "diamond",
    tone: "amber",
    description: "Has the reply sequence led to a booked conversation?",
    details: [
      "YES: Discovery (optional) or straight into qualification / Value Session.",
      "NO: Personal Follow-up, then try booking again.",
      "A booking link alone is not enough — it must be on the calendar.",
      "This is where Win Clients starts to take over from Lead Generation.",
    ],
  },
  {
    id: "qualified",
    title: "Qualified?",
    x: colDiamondX(3),
    y: MID_Y,
    width: DIAMOND,
    height: DIAMOND,
    shape: "diamond",
    tone: "amber",
    description: "Is this the right person for a Value Session?",
    details: [
      "Use the booked conversation to confirm fit and readiness.",
      "YES: book or run the Value Session.",
      "NO: Nurture / Revisit when timing or fit changes.",
      "Qualify hard — wrong-fit Value Sessions waste both sides’ time.",
    ],
  },
  {
    id: "won",
    title: "Won?",
    x: colDiamondX(4),
    y: MID_Y,
    width: DIAMOND,
    height: DIAMOND,
    shape: "diamond",
    tone: "amber",
    description: "Has the person decided to become a client?",
    details: [
      "YES: take payment, confirm onboarding, and start coaching.",
      "NO: schedule a later follow-up (~90 days) instead of chasing cold.",
      "A clear no is healthier than an endless maybe.",
      "Won is the bridge into Keep Clients delivery.",
    ],
  },
  {
    id: "connector-campaign",
    title: "Connector\nCampaign",
    x: colRectX(0),
    y: BOTTOM_Y,
    width: RECT_W,
    height: RECT_H,
    shape: "rect",
    tone: "blue",
    description: "Create a legitimate LinkedIn connection so they become Reachable.",
    details: [
      "Paste your Sales Nav list into Connector and run the proven sequence.",
      "Typical path: connect → Msg1 (~30m) → day1 → day2 → day4 → 2-week close.",
      "Personalise connection + Msg1 with industry, pain/desire, and one proof.",
      "Do not scrape emails — connection first, then Interest Sequence.",
    ],
    href: classroomLesson("get-calls", "get-calls-lead-generation-get-started-with-connector"),
  },
  {
    id: "nurture-list",
    title: "Nurture\nList",
    x: colRectX(1),
    y: BOTTOM_Y,
    width: RECT_W,
    height: RECT_H,
    shape: "rect",
    tone: "muted",
    description: "Park people who are not ready — stay useful without chasing.",
    details: [
      "“Not right now”: note a revisit date and keep light value touchpoints.",
      "No response: park longer-term instead of burning the relationship.",
      "Keep them on VIP / newsletter / social so trust compounds quietly.",
      "When timing changes, pull them back into Interest or Reply Sequence.",
    ],
    href: classroomLesson("get-calls", "get-calls-lead-generation-run-your-vip-nurture"),
  },
  {
    id: "personal-follow-up",
    title: "Personal\nFollow-up",
    x: colRectX(2),
    y: BOTTOM_Y,
    width: RECT_W,
    height: RECT_H,
    shape: "rect",
    tone: "muted",
    description: "Recover when interest was there but the booking did not happen.",
    details: [
      "Use the personal follow-up sequence — don’t invent a new pitch each time.",
      "Goal is a clear next step (book or honest “not now”), not pressure.",
      "Stay short and human; reference the prior interest.",
      "If they still won’t book, move them to nurture with a revisit date.",
    ],
    href: classroomLesson("get-calls", "get-calls-replying-to-leads-set-up-connector-co-pilot"),
  },
  {
    id: "nurture-revisit",
    title: "Nurture /\nRevisit",
    x: colRectX(3),
    y: BOTTOM_Y,
    width: RECT_W,
    height: RECT_H,
    shape: "rect",
    tone: "muted",
    description: "Not ready for a Value Session yet — keep the door open.",
    details: [
      "Wrong timing or soft fit after Discovery / qualification lands here.",
      "Stay useful via nurture; set a date to check readiness again.",
      "Do not keep giving free Value Sessions to unqualified prospects.",
      "When fit returns, re-enter at Qualified? / Value Session.",
    ],
    href: classroomLesson("get-calls", "get-calls-lead-generation-run-your-vip-nurture"),
  },
  {
    id: "won-follow-up",
    title: "Follow-up\nin 90 Days",
    x: colRectX(4),
    y: BOTTOM_Y,
    width: RECT_W,
    height: RECT_H,
    shape: "rect",
    tone: "muted",
    description: "A later follow-up for someone who has not bought yet.",
    details: [
      "After a clear no or delay, diary a ~90-day check-in.",
      "Come back with value and a clean ask — not weekly chasing.",
      "If still no, leave the relationship warm and stop pushing.",
      "Protects your time and keeps the door open for later timing.",
    ],
  },
  {
    id: "new-client",
    title: "New\nClient",
    x: newClientX(),
    y: TOP_Y,
    width: NEW_CLIENT_W,
    height: NEW_CLIENT_H,
    shape: "rect",
    tone: "green",
    description: "Payment cleared — start onboarding and coaching immediately.",
    details: [
      "Take payment, confirm access, and set Session 1 expectations.",
      "Get tools / folder / invite set up the same day if you can.",
      "First weeks: quick wins so belief and momentum stick.",
      "This is the handoff into Keep Clients (step 5).",
    ],
    href: classroomLesson("coach-clients", "coach-clients-client-onboarding-how-to-setup-a-new-client"),
  },
];


export const CONNECTIONS: DiagramConnection[] = [
  {
    id: "list-reachable",
    from: "prospect-lists",
    to: "reachable",
    fromAnchor: "bottom",
    toAnchor: "top",
    tone: "slate",
    labelPoint: {
      x: colCenterX(0),
      y: Math.round((TOP_Y + RECT_H + MID_Y) / 2) - 5,
    },
  },
  {
    id: "reachable-yes",
    from: "reachable",
    to: "interest-sequence",
    fromAnchor: "right",
    toAnchor: "left",
    tone: "teal",
    labelPoint: { x: yesViaX(0), y: YES_LABEL_Y },
    via: [
      { x: yesViaX(0), y: MID_Y + DIAMOND / 2 },
      { x: yesViaX(0), y: TOP_Y + RECT_H / 2 },
    ],
  },
  {
    id: "reachable-no",
    from: "reachable",
    to: "connector-campaign",
    fromAnchor: "bottom",
    toAnchor: "top",
    tone: "slate",
    label: "NO",
    labelPoint: { x: colCenterX(0), y: NO_LABEL_Y },
  },
  {
    id: "connector-reachable",
    from: "connector-campaign",
    to: "reachable",
    fromAnchor: "top",
    toAnchor: "bottom",
    tone: "muted",
    fromPoint: returnFromPoint(0),
    toPoint: returnToPoint(0),
    curve: {
      control1: { x: returnCurveX(0), y: RETURN_CURVE_Y },
      control2: { x: returnCurveX(0), y: RETURN_CURVE_Y },
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
    labelPoint: { x: yesViaX(1), y: YES_LABEL_Y },
    via: [
      { x: yesViaX(1), y: MID_Y + DIAMOND / 2 },
      { x: yesViaX(1), y: TOP_Y + RECT_H / 2 },
    ],
  },
  {
    id: "interested-no",
    from: "interested",
    to: "nurture-list",
    fromAnchor: "bottom",
    toAnchor: "top",
    tone: "slate",
    label: "NO",
    labelPoint: { x: colCenterX(1), y: NO_LABEL_Y },
  },
  {
    id: "nurture-interested",
    from: "nurture-list",
    to: "interested",
    fromAnchor: "top",
    toAnchor: "bottom",
    tone: "muted",
    fromPoint: returnFromPoint(1),
    toPoint: returnToPoint(1),
    curve: {
      control1: { x: returnCurveX(1), y: RETURN_CURVE_Y },
      control2: { x: returnCurveX(1), y: RETURN_CURVE_Y },
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
    tone: "teal",
    labelPoint: { x: yesViaX(2), y: YES_LABEL_Y },
    via: [
      { x: yesViaX(2), y: MID_Y + DIAMOND / 2 },
      { x: yesViaX(2), y: TOP_Y + RECT_H / 2 },
    ],
  },
  {
    id: "booked-no",
    from: "booked",
    to: "personal-follow-up",
    fromAnchor: "bottom",
    toAnchor: "top",
    tone: "slate",
    label: "NO",
    labelPoint: { x: colCenterX(2), y: NO_LABEL_Y },
  },
  {
    id: "follow-up-booked",
    from: "personal-follow-up",
    to: "booked",
    fromAnchor: "top",
    toAnchor: "bottom",
    tone: "muted",
    fromPoint: returnFromPoint(2),
    toPoint: returnToPoint(2),
    curve: {
      control1: { x: returnCurveX(2), y: RETURN_CURVE_Y },
      control2: { x: returnCurveX(2), y: RETURN_CURVE_Y },
    },
    dotted: true,
  },
  {
    id: "discovery-qualified",
    from: "discovery-call",
    to: "qualified",
    fromAnchor: "bottom",
    toAnchor: "top",
    tone: "teal",
  },
  {
    id: "qualified-yes",
    from: "qualified",
    to: "value",
    fromAnchor: "right",
    toAnchor: "left",
    tone: "teal",
    labelPoint: { x: yesViaX(3), y: YES_LABEL_Y },
    via: [
      { x: yesViaX(3), y: MID_Y + DIAMOND / 2 },
      { x: yesViaX(3), y: TOP_Y + RECT_H / 2 },
    ],
  },
  {
    id: "qualified-no",
    from: "qualified",
    to: "nurture-revisit",
    fromAnchor: "bottom",
    toAnchor: "top",
    tone: "slate",
    label: "NO",
    labelPoint: { x: colCenterX(3), y: NO_LABEL_Y },
  },
  {
    id: "revisit-qualified",
    from: "nurture-revisit",
    to: "qualified",
    fromAnchor: "top",
    toAnchor: "bottom",
    tone: "muted",
    fromPoint: returnFromPoint(3),
    toPoint: returnToPoint(3),
    curve: {
      control1: { x: returnCurveX(3), y: RETURN_CURVE_Y },
      control2: { x: returnCurveX(3), y: RETURN_CURVE_Y },
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
    toAnchor: "bottom",
    tone: "teal",
    labelPoint: {
      x: newClientX() + NEW_CLIENT_W / 2,
      y: YES_LABEL_Y,
    },
    via: [{ x: newClientX() + NEW_CLIENT_W / 2, y: MID_Y + DIAMOND / 2 }],
  },
  {
    id: "won-no",
    from: "won",
    to: "won-follow-up",
    fromAnchor: "bottom",
    toAnchor: "top",
    tone: "slate",
    label: "NO",
    labelPoint: { x: colCenterX(4), y: NO_LABEL_Y },
  },
  {
    id: "follow-up-won",
    from: "won-follow-up",
    to: "won",
    fromAnchor: "top",
    toAnchor: "bottom",
    tone: "muted",
    fromPoint: returnFromPoint(4),
    toPoint: returnToPoint(4),
    curve: {
      control1: { x: returnCurveX(4), y: RETURN_CURVE_Y },
      control2: { x: returnCurveX(4), y: RETURN_CURVE_Y },
    },
    dotted: true,
  },
];

export const NODE_BY_ID = Object.fromEntries(NODES.map((node) => [node.id, node])) as Record<string, DiagramNode>;

export function anchorPoint(node: DiagramNode, anchor: Anchor): Point {
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

/** Path data for a connection: cubic `d` when it curves, polyline `points` otherwise. */
export function connectionPath(connection: DiagramConnection): string {
  const start = connection.fromPoint ?? anchorPoint(NODE_BY_ID[connection.from], connection.fromAnchor);
  const end = connection.toPoint ?? anchorPoint(NODE_BY_ID[connection.to], connection.toAnchor);
  if (connection.curve) {
    return `M ${start.x},${start.y} C ${connection.curve.control1.x},${connection.curve.control1.y} ${connection.curve.control2.x},${connection.curve.control2.y} ${end.x},${end.y}`;
  }
  return [start, ...(connection.via ?? []), end].map((point) => `${point.x},${point.y}`).join(" ");
}
