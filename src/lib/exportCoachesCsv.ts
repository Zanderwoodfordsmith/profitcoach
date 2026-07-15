import {
  COACH_ACCESS_TIER_LABELS,
  type CoachAccessTier,
} from "@/lib/coachAccess/tiers";
import {
  COACH_RECURRING_PAYMENT_LABELS,
  type CoachRecurringPaymentStatus,
} from "@/lib/coachBilling";
import {
  buildCsvContent,
  csvFilenameStem,
  downloadCsvFile,
  type CsvCell,
} from "@/lib/exportCsv";
import { buildCoachLandingLink } from "@/lib/buildCoachLandingLink";
import { LADDER_LEVELS } from "@/lib/ladder";
import type { CoachTableColumnVisibility } from "@/lib/admin/coachTableViews";
import type { CoachPaymentSummary } from "@/lib/admin/coachPaymentSummary";
import { formatCoachPaymentsExportValue } from "@/lib/admin/coachPaymentSummary";

export type CoachExportRow = {
  id: string;
  slug: string;
  email: string | null;
  full_name: string | null;
  coach_business_name: string | null;
  linkedin_url: string | null;
  joined_at: string | null;
  client_count: number;
  directory_listed: boolean;
  directory_level: string | null;
  conference_status: "no" | "maybe" | "yes" | null;
  current_monthly_income: number | null;
  goal_monthly_income: number | null;
  ladder_level: string | null;
  ladder_goal_level: string | null;
  ladder_goal_target_date: string | null;
  last_login_at: string | null;
  crm_profile_name: string | null;
  crm_location_id: string | null;
  calendar_sync_ready: boolean;
  has_calendar_embed: boolean;
  has_lead_webhook: boolean;
  lead_webhook_url: string | null;
  has_community_bio: boolean;
  has_directory_summary: boolean;
  has_directory_bio: boolean;
  has_sales_robot_account: boolean;
  sales_robot_active_campaigns: number | null;
  sales_robot_paying_accounts: number | null;
  has_profit_coach_email_account: boolean;
  recurring_payment_status: CoachRecurringPaymentStatus | null;
  recurring_billing_active: boolean;
  payment_summary: CoachPaymentSummary;
  access_tier: CoachAccessTier;
  access_tier_locked: boolean;
};

export type CoachTableColumnKey = keyof CoachTableColumnVisibility;

export type CoachExportColumnKey =
  | "coach"
  | "business"
  | "slug"
  | "email"
  | "joinDate"
  | "goalLevel"
  | "clients"
  | "linkedinProfile"
  | "directory"
  | "certification"
  | "conference"
  | "currentLevel"
  | "ladderLevel"
  | "ladderGoalLevel"
  | "goalBy"
  | "lastLogin"
  | "crm"
  | "crmLocationId"
  | "salesRobot"
  | "activeCampaigns"
  | "payingAccounts"
  | "profitCoachEmail"
  | "accessTier"
  | "accessTierLocked"
  | "recurringPayment"
  | "recurringActive"
  | "payments"
  | "calendarEmbed"
  | "leadWebhook"
  | "leadWebhookUrl"
  | "communityBio"
  | "directorySummary"
  | "directoryBio"
  | "landing";

const EXPORT_COLUMN_DEFS: Array<{ key: CoachExportColumnKey; label: string }> =
  [
    { key: "coach", label: "Coach" },
    { key: "business", label: "Business" },
    { key: "slug", label: "Slug" },
    { key: "email", label: "Email" },
    { key: "joinDate", label: "Join date" },
    { key: "goalLevel", label: "Goal income" },
    { key: "clients", label: "Clients" },
    { key: "linkedinProfile", label: "LinkedIn" },
    { key: "directory", label: "Directory listed" },
    { key: "certification", label: "Certification" },
    { key: "conference", label: "Conference" },
    { key: "currentLevel", label: "Current income" },
    { key: "ladderLevel", label: "Ladder level" },
    { key: "ladderGoalLevel", label: "Ladder goal level" },
    { key: "goalBy", label: "Goal by" },
    { key: "lastLogin", label: "Last login" },
    { key: "crm", label: "CRM" },
    { key: "crmLocationId", label: "CRM location ID" },
    { key: "salesRobot", label: "Sales Robot" },
    { key: "activeCampaigns", label: "Active campaigns" },
    { key: "payingAccounts", label: "Sales robot accounts" },
    { key: "profitCoachEmail", label: "PC email" },
    { key: "accessTier", label: "Access tier" },
    { key: "accessTierLocked", label: "Access tier locked" },
    { key: "recurringPayment", label: "Billing" },
    { key: "recurringActive", label: "Recurring active" },
    { key: "payments", label: "Payments" },
    { key: "calendarEmbed", label: "Calendar embed" },
    { key: "leadWebhook", label: "Lead webhook" },
    { key: "leadWebhookUrl", label: "Lead webhook URL" },
    { key: "communityBio", label: "Community bio" },
    { key: "directorySummary", label: "Directory summary" },
    { key: "directoryBio", label: "Directory bio" },
    { key: "landing", label: "Landing page" },
  ];

const TABLE_KEY_TO_EXPORT: Partial<
  Record<CoachTableColumnKey, CoachExportColumnKey[]>
> = {
  slug: ["slug"],
  email: ["email"],
  joinDate: ["joinDate"],
  goalLevel: ["goalLevel"],
  clients: ["clients"],
  linkedinProfile: ["linkedinProfile"],
  directory: ["directory"],
  certification: ["certification"],
  conference: ["conference"],
  currentLevel: ["currentLevel"],
  goalBy: ["goalBy"],
  lastLogin: ["lastLogin"],
  crm: ["crm"],
  salesRobot: ["salesRobot"],
  activeCampaigns: ["activeCampaigns"],
  payingAccounts: ["payingAccounts"],
  profitCoachEmail: ["profitCoachEmail"],
  accessTier: ["accessTier", "accessTierLocked"],
  recurringPayment: ["recurringPayment"],
  recurringActive: ["recurringActive"],
  payments: ["payments"],
  calendarEmbed: ["calendarEmbed"],
  leadWebhook: ["leadWebhook", "leadWebhookUrl"],
  communityBio: ["communityBio"],
  directorySummary: ["directorySummary"],
  directoryBio: ["directoryBio"],
  landing: ["landing"],
};

export type ExportCoachesCsvInput = {
  mode: "shown" | "all";
  columnOrder: CoachTableColumnKey[];
  columnVisibility: CoachTableColumnVisibility;
  origin: string;
};

function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const dateOnly = iso.slice(0, 10);
  const ms = Date.parse(`${dateOnly}T12:00:00`);
  if (Number.isNaN(ms)) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(ms));
}

function formatGbp(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatMemberFor(joinedIso: string): string {
  const base = joinedIso.includes("T")
    ? new Date(joinedIso)
    : new Date(`${joinedIso}T12:00:00`);
  if (Number.isNaN(base.getTime())) return joinedIso;
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const totalDays = Math.max(
    0,
    Math.floor(
      (Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) -
        Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) /
        86_400_000
    )
  );
  if (totalDays === 0) return "0d";
  const years = Math.floor(totalDays / 365);
  const months = Math.floor((totalDays % 365) / 30);
  const days = totalDays % 30;
  if (years <= 0 && months <= 0) return `${days}d`;
  if (years <= 0) return `${months}m ${days}d`;
  return `${years}y ${months}m ${days}d`;
}

function ladderLabel(levelId: string | null | undefined): string {
  if (!levelId?.trim()) return "";
  return LADDER_LEVELS.find((l) => l.id === levelId)?.name ?? levelId;
}

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

function getExportCellValue(
  row: CoachExportRow,
  key: CoachExportColumnKey,
  origin: string
): CsvCell {
  switch (key) {
    case "coach":
      return row.full_name ?? "";
    case "business":
      return row.coach_business_name ?? "";
    case "slug":
      return row.slug;
    case "email":
      return row.email ?? "";
    case "joinDate":
      if (!row.joined_at) return "";
      return `${formatIsoDate(row.joined_at)} (${formatMemberFor(row.joined_at)})`;
    case "goalLevel":
      return row.goal_monthly_income == null
        ? ""
        : formatGbp(row.goal_monthly_income);
    case "clients":
      return row.client_count > 0 ? row.client_count : "";
    case "linkedinProfile":
      return row.linkedin_url ?? "";
    case "directory":
      return yesNo(row.directory_listed);
    case "certification":
      return row.directory_level ?? "";
    case "conference":
      return row.conference_status ?? "";
    case "currentLevel":
      return row.current_monthly_income == null
        ? ""
        : formatGbp(row.current_monthly_income);
    case "ladderLevel":
      return ladderLabel(row.ladder_level);
    case "ladderGoalLevel":
      return ladderLabel(row.ladder_goal_level);
    case "goalBy":
      return formatIsoDate(row.ladder_goal_target_date);
    case "lastLogin":
      return row.last_login_at
        ? formatIsoDate(row.last_login_at)
        : "Never";
    case "crm":
      return row.crm_profile_name ?? "";
    case "crmLocationId":
      return row.crm_location_id ?? "";
    case "salesRobot":
      return yesNo(row.has_sales_robot_account);
    case "activeCampaigns":
      return row.sales_robot_active_campaigns ?? "";
    case "payingAccounts":
      return row.sales_robot_paying_accounts ?? "";
    case "profitCoachEmail":
      return yesNo(row.has_profit_coach_email_account);
    case "accessTier":
      return COACH_ACCESS_TIER_LABELS[row.access_tier];
    case "accessTierLocked":
      return yesNo(row.access_tier_locked);
    case "recurringPayment":
      return row.recurring_payment_status
        ? COACH_RECURRING_PAYMENT_LABELS[row.recurring_payment_status]
        : "";
    case "recurringActive":
      return yesNo(row.recurring_billing_active);
    case "payments":
      return formatCoachPaymentsExportValue(row.payment_summary);
    case "calendarEmbed":
      return yesNo(row.has_calendar_embed);
    case "leadWebhook":
      return yesNo(row.has_lead_webhook);
    case "leadWebhookUrl":
      return row.lead_webhook_url ?? "";
    case "communityBio":
      return yesNo(row.has_community_bio);
    case "directorySummary":
      return yesNo(row.has_directory_summary);
    case "directoryBio":
      return yesNo(row.has_directory_bio);
    case "landing":
      return buildCoachLandingLink(row.slug, origin) ?? "";
    default:
      return "";
  }
}

function buildExportColumnKeys(input: ExportCoachesCsvInput): CoachExportColumnKey[] {
  const keys: CoachExportColumnKey[] = ["coach", "business", "email"];
  const seen = new Set<CoachExportColumnKey>(keys);

  for (const tableKey of input.columnOrder) {
    if (input.mode === "shown" && !input.columnVisibility[tableKey]) continue;
    const mapped = TABLE_KEY_TO_EXPORT[tableKey];
    if (!mapped) continue;
    for (const exportKey of mapped) {
      if (!seen.has(exportKey)) {
        seen.add(exportKey);
        keys.push(exportKey);
      }
    }
  }

  if (input.mode === "all") {
    for (const def of EXPORT_COLUMN_DEFS) {
      if (!seen.has(def.key)) {
        seen.add(def.key);
        keys.push(def.key);
      }
    }
  }

  return keys;
}

export function exportCoachesToCsv(
  rows: CoachExportRow[],
  input: ExportCoachesCsvInput,
  filenamePrefix = "coaches"
) {
  const columnKeys = buildExportColumnKeys(input);
  const headers = columnKeys.map(
    (key) => EXPORT_COLUMN_DEFS.find((def) => def.key === key)?.label ?? key
  );
  const csvRows = rows.map((row) =>
    columnKeys.map((key) => getExportCellValue(row, key, input.origin))
  );
  const content = buildCsvContent(headers, csvRows);
  downloadCsvFile(`${csvFilenameStem(filenamePrefix)}.csv`, content);
}
