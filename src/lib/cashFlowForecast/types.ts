export const CASH_FLOW_FORECAST_WEEKS = 13;

export type ForecastStreamKind = "recurring" | "plan";

export type ForecastPaymentSource = "actual" | "projected";

export type ForecastCoachBilling = {
  recurring_payment_status: string | null;
  full_name: string | null;
  coach_business_name: string | null;
  email: string | null;
};

export type ForecastPaymentInput = {
  id: string;
  customer_email: string;
  customer_company_name: string | null;
  coach_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  description: string | null;
  paid_at: string;
  billing_kind: string;
};

export type ForecastCashEvent = {
  streamKey: string;
  customerLabel: string;
  companyName: string | null;
  kind: ForecastStreamKind;
  amountCents: number;
  currency: string;
  dateIso: string;
  source: ForecastPaymentSource;
  paymentDayOfMonth: number;
  coachId: string | null;
};

export type ForecastCustomerRow = {
  streamKey: string;
  customerLabel: string;
  companyName: string | null;
  kind: ForecastStreamKind;
  amountCents: number;
  currency: string;
  paymentDayOfMonth: number;
  coachId: string | null;
  amountsByWeek: Record<string, number>;
  /** Compact subtitle under the customer name. */
  note: string | null;
  amountOwedCents: number | null;
  owedLabel: string | null;
  /** Due or failed date — used to rank overdue customers. */
  owedSortDateIso: string | null;
  /** Last successful payment — used to rank current customers. */
  lastPaidIso: string | null;
};

export type ForecastExpenseRow = {
  id: string;
  label: string;
  section: string;
  amountsByWeek: Record<string, number>;
  /** Shown in the grid — e.g. payment timing or end date. */
  note?: string | null;
  monthlyAmountCents?: number;
  paymentDayOfMonth?: number | null;
};

export type ForecastWeekSummary = {
  weekStart: string;
  weekLabel: string;
  cashInRecurringCents: number;
  cashInPlanCents: number;
  cashInTotalCents: number;
  cashOutCents: number;
  netDifferenceCents: number;
  beginningCashCents: number;
  endingCashCents: number;
};

export type CashFlowForecastPayload = {
  startMonday: string;
  weekStarts: string[];
  openingBalanceCents: number;
  customerRows: ForecastCustomerRow[];
  expenseRows: ForecastExpenseRow[];
  excludedStreamKeys: string[];
  weekSummaries: ForecastWeekSummary[];
};

export type CashFlowForecastSettings = {
  openingBalanceCents: number;
  stripeBalanceCents: number;
  stripeBalanceAsOf: string | null;
  startMonday: string | null;
  expenseRows: ForecastExpenseRow[];
  excludedStreamKeys: string[];
};
