export function formatPaymentMoney(amountCents: number, currency: string): string {
  const code = currency.toUpperCase();
  const locale = code === "USD" ? "en-US" : "en-GB";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}

export function formatPaymentDate(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  const date = new Date(parsed);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "2-digit" }),
  }).format(date);
}

export function paymentStatusLabel(status: string): string {
  switch (status) {
    case "succeeded":
      return "Paid";
    case "failed":
      return "Failed";
    case "canceled":
      return "Canceled";
    case "refunded":
      return "Refunded";
    case "pending":
      return "Pending";
    default:
      return status;
  }
}

export function paymentStatusBadgeClass(status: string): string {
  switch (status) {
    case "succeeded":
      return "bg-emerald-100 text-emerald-800";
    case "failed":
      return "bg-rose-100 text-rose-800";
    case "canceled":
      return "bg-amber-100 text-amber-900";
    case "refunded":
      return "bg-slate-200 text-slate-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}
