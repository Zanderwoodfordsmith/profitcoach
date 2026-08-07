import { normalizeOverview537 } from "./cascade";
import type {
  NewsletterCover,
  NewsletterEditionRow,
  NewsletterFixedBlocks,
  NewsletterSeriesRow,
} from "./types";

export function mapSeriesRow(row: Record<string, unknown>): NewsletterSeriesRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: String(row.name ?? ""),
    tagline: (row.tagline as string | null) ?? null,
    cadence: (row.cadence as NewsletterSeriesRow["cadence"]) ?? "fortnightly",
    lead_topic: (row.lead_topic as string | null) ?? null,
    overview_537: normalizeOverview537(row.overview_537),
    fixed_blocks: (row.fixed_blocks as NewsletterFixedBlocks) ?? {},
    status: (row.status as NewsletterSeriesRow["status"]) ?? "active",
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export function mapEditionRow(row: Record<string, unknown>): NewsletterEditionRow {
  return {
    id: String(row.id),
    series_id: String(row.series_id),
    user_id: String(row.user_id),
    sequence_index: Number(row.sequence_index ?? 0),
    kind: row.kind as NewsletterEditionRow["kind"],
    kind_index: row.kind_index == null ? null : Number(row.kind_index),
    title: String(row.title ?? ""),
    tagline: (row.tagline as string | null) ?? null,
    format: (row.format as NewsletterEditionRow["format"]) ?? "pam_deep_dive",
    length_mode: (row.length_mode as NewsletterEditionRow["length_mode"]) ?? "short",
    seo_title: (row.seo_title as string | null) ?? null,
    seo_description: (row.seo_description as string | null) ?? null,
    body_markdown: String(row.body_markdown ?? ""),
    blocks: Array.isArray(row.blocks) ? row.blocks : [],
    promo_post_text: (row.promo_post_text as string | null) ?? null,
    cover: (row.cover as NewsletterCover) ?? {},
    status: (row.status as NewsletterEditionRow["status"]) ?? "planned",
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}
