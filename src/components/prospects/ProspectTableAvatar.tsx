const PERSON_CLASS =
  "bg-[#d8eee4] text-[#1f5c43] ring-1 ring-inset ring-[#b7dcc8]/90";

export function prospectInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

type Props = {
  name: string;
};

export function ProspectTableAvatar({ name }: Props) {
  const label = prospectInitials(name);

  return (
    <span
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tracking-wide ${PERSON_CLASS}`}
      aria-hidden
    >
      {label}
    </span>
  );
}
