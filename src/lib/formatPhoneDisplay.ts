function groupDigits(value: string, sizes: number[]): string {
  const parts: string[] = [];
  let index = 0;
  for (const size of sizes) {
    if (index >= value.length) break;
    parts.push(value.slice(index, index + size));
    index += size;
  }
  if (index < value.length) {
    parts.push(value.slice(index));
  }
  return parts.filter(Boolean).join(" ");
}

function groupInternationalNational(value: string): string {
  const parts: string[] = [];
  let index = 0;
  while (index < value.length) {
    const remaining = value.length - index;
    const size = remaining <= 4 ? remaining : 3;
    parts.push(value.slice(index, index + size));
    index += size;
  }
  return parts.join(" ");
}

function formatUkNational(national: string): string {
  const digits = national.replace(/\D/g, "").replace(/^0+/, "");
  if (/^7\d{9}$/.test(digits)) {
    return `+44 ${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  if (/^20\d{8}$/.test(digits)) {
    return `+44 20 ${digits.slice(2, 6)} ${digits.slice(6)}`;
  }
  if (/^1\d{9}$/.test(digits)) {
    return `+44 ${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  if (/^1\d{10}$/.test(digits)) {
    return `+44 ${digits.slice(0, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  if (digits.length >= 9) {
    return `+44 ${groupDigits(digits, [4, 3, 3, 4])}`.trim();
  }
  return `+44 ${groupInternationalNational(digits)}`.trim();
}

function formatUsNational(national: string): string {
  const digits = national.replace(/\D/g, "").slice(-10);
  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length > 0) {
    return `+1 ${groupInternationalNational(digits)}`.trim();
  }
  return "+1";
}

const INTERNATIONAL_COUNTRY_CODES = [
  "971",
  "353",
  "358",
  "351",
  "886",
  "852",
  "420",
  "972",
  "234",
  "254",
  "255",
  "256",
  "44",
  "61",
  "64",
  "49",
  "33",
  "39",
  "34",
  "91",
  "86",
  "81",
  "82",
  "31",
  "32",
  "41",
  "43",
  "45",
  "46",
  "47",
  "48",
  "27",
  "52",
  "55",
  "65",
  "66",
  "84",
  "62",
  "63",
  "60",
  "1",
];

function formatInternationalDigits(digits: string): string {
  for (const code of INTERNATIONAL_COUNTRY_CODES) {
    if (digits.startsWith(code) && digits.length > code.length + 5) {
      const national = digits.slice(code.length);
      return `+${code} ${groupInternationalNational(national)}`.trim();
    }
  }

  if (digits.length > 11) {
    const codeLength = Math.min(3, digits.length - 7);
    return `+${digits.slice(0, codeLength)} ${groupInternationalNational(
      digits.slice(codeLength)
    )}`.trim();
  }

  return `+${groupInternationalNational(digits)}`.trim();
}

/** Display phone numbers in UK, US, or grouped international format. */
export function formatPhoneDisplay(
  raw: string | null | undefined
): string | null {
  if (!raw?.trim()) return null;

  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7) return trimmed;

  if (trimmed.startsWith("+")) {
    if (digits.startsWith("44")) {
      return formatUkNational(digits.slice(2));
    }
    if (digits.startsWith("1") && digits.length >= 11) {
      return formatUsNational(digits.slice(1));
    }
    return formatInternationalDigits(digits);
  }

  if (digits.startsWith("44") && digits.length >= 11) {
    return formatUkNational(digits.slice(2));
  }

  if (digits.startsWith("0") && digits.length === 11) {
    return formatUkNational(digits.slice(1));
  }

  if (digits.startsWith("7") && digits.length === 10) {
    return formatUkNational(digits);
  }

  if (digits.startsWith("1") && digits.length === 11) {
    return formatUsNational(digits.slice(1));
  }

  if (digits.length === 10) {
    return formatUsNational(digits);
  }

  if (digits.length > 10) {
    return formatInternationalDigits(digits);
  }

  return trimmed;
}

/** E.164-style URI for tel: links (digits only after tel:+). */
export function phoneToTelHref(
  raw: string | null | undefined
): string | null {
  if (!raw?.trim()) return null;

  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7) return null;

  if (trimmed.startsWith("+")) {
    return `tel:+${digits}`;
  }

  if (digits.startsWith("44") && digits.length >= 11) {
    return `tel:+${digits}`;
  }

  if (digits.startsWith("0") && digits.length === 11) {
    return `tel:+44${digits.slice(1)}`;
  }

  if (digits.startsWith("7") && digits.length === 10) {
    return `tel:+44${digits}`;
  }

  if (digits.startsWith("1") && digits.length === 11) {
    return `tel:+${digits}`;
  }

  if (digits.length === 10) {
    return `tel:+1${digits}`;
  }

  return `tel:+${digits}`;
}
