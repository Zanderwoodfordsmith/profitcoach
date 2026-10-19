/**
 * How well each sector answers on LinkedIn, scored 1 to 10 from the Oct 2026
 * review of 110k coach invites (interest weighted most, then replies, then
 * acceptance; small sectors pulled towards the average). First match wins,
 * checked against company name + job title.
 */
export type SectorTier = { sector: string; re: RegExp; score: number };

export const SECTOR_TIERS: SectorTier[] = [
  { sector: "Trades (electrical, plumbing, heating, roofing)", re: /electric|plumb|heating|gas |hvac|roofing|roofer|joiner|carpent|plaster|scaffold|glazing|glazier|locksmith|landscap|groundwork|decorat|tiling|kitchens|bathrooms/, score: 4 },
  { sector: "Construction & building", re: /construct|builders?\b|building ser|civil|contractor|developments?\b|homes\b|groundworks|demolition|surveying|quantity surveyor|fit[- ]?out|interiors/, score: 4 },
  { sector: "Engineering & manufacturing", re: /engineer|manufactur|precision|fabricat|machin|cnc|tooling|plastics|metal|steel|foundry|components|industrial|automation|packaging|print(ing)?\b/, score: 4 },
  { sector: "Legal", re: /\blaw\b|legal|solicitor|barrister|attorney|lawyer|llp\b.*law|notary|conveyanc/, score: 5 },
  { sector: "Accountancy & finance", re: /accountan|accounting|bookkeep|tax\b|chartered|wealth|financial|finance|insurance|mortgage|investment|capital|family office|pension/, score: 7 },
  { sector: "Recruitment & HR", re: /recruit|talent|staffing|resourcing|search\b|executive search|\bhr\b|human resources|people\b/, score: 7 },
  { sector: "IT, software & tech", re: /software|saas|\bit\b|tech|digital|cyber|data|cloud|\bai\b|app\b|platform|systems|computing|developer|web\b/, score: 8 },
  { sector: "Marketing, media & creative", re: /marketing|agency|media|creative|design|brand|advertis|pr\b|communications|video|film|photograph|content|seo/, score: 7 },
  { sector: "Consulting & professional services", re: /consult|advis|management|strategy|coaching|training|learning|leadership/, score: 9 },
  { sector: "Health, care & wellbeing", re: /health|care\b|care home|dental|dentist|clinic|medical|pharma|physio|wellness|wellbeing|fitness|gym|beauty|salon|aesthetic|therapy|nursing|life science|biotech/, score: 3 },
  { sector: "Property & real estate", re: /property|properties|estate agent|real estate|lettings|housing|facilities|fm\b/, score: 7 },
  { sector: "Hospitality, food & drink", re: /hotel|hospitality|restaurant|cafe|bar\b|pub\b|catering|food|drink|brewery|distill|coffee|leisure|events?\b|venue/, score: 4 },
  { sector: "Retail, e-commerce & consumer", re: /retail|shop|store|e-?commerce|fashion|clothing|apparel|consumer|brand\b|wholesale|distribut|import/, score: 6 },
  { sector: "Logistics & transport", re: /logistic|transport|haulage|freight|shipping|courier|fleet|removals|storage|warehouse|supply chain/, score: 4 },
  { sector: "Education & training", re: /school|education|tutor|academy|university|college|nursery/, score: 7 },
  { sector: "Energy & environment", re: /energy|solar|renewab|electric vehicle|ev\b|environment|sustainab|waste|recycl|water/, score: 5 },
  { sector: "Automotive", re: /automotive|motor|garage|car\b|cars\b|vehicle|dealership/, score: 4 },
  { sector: "Charity & public sector", re: /charity|foundation|trust\b|council|nhs|public sector|government/, score: 5 },
];

export function sectorOf(company: string | null | undefined, title: string | null | undefined): SectorTier | null {
  const text = `${company ?? ""} ${title ?? ""}`.toLowerCase();
  return SECTOR_TIERS.find((t) => t.re.test(text)) ?? null;
}

/** The sector most of these people are in, if one clearly dominates (35%+). */
export function dominantSector(people: { company: string | null; title: string | null }[]): { tier: SectorTier; share: number } | null {
  const counts = new Map<string, { tier: SectorTier; n: number }>();
  for (const p of people) {
    const t = sectorOf(p.company, p.title);
    if (!t) continue;
    const row = counts.get(t.sector) ?? { tier: t, n: 0 };
    row.n += 1;
    counts.set(t.sector, row);
  }
  const top = [...counts.values()].sort((a, b) => b.n - a.n)[0];
  if (!top || !people.length) return null;
  const share = top.n / people.length;
  return share >= 0.35 ? { tier: top.tier, share } : null;
}
