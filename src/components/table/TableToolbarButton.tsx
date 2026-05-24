"use client";

type Props = {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  badge?: number | string | null;
  title?: string;
  id?: string;
  disabled?: boolean;
  "aria-expanded"?: boolean;
  "aria-haspopup"?: boolean | "true" | "menu";
  "aria-controls"?: string;
  onClick?: () => void;
};

export function TableToolbarButton({
  label,
  icon,
  active = false,
  badge = null,
  title,
  id,
  disabled = false,
  ...buttonProps
}: Props) {
  return (
    <button
      type="button"
      id={id}
      disabled={disabled}
      title={title ?? label}
      {...buttonProps}
      className={`relative inline-flex flex-col items-center gap-0.5 rounded-md px-2 py-1 text-slate-600 outline-none transition hover:bg-slate-100 hover:text-slate-800 focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50 ${active ? "bg-slate-100 text-slate-900" : ""}`}
    >
      <span className="relative inline-flex">
        {icon}
        {badge != null ? (
          <span className="absolute -right-2 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-semibold leading-none text-white">
            {badge}
          </span>
        ) : null}
      </span>
      <span className="text-[10px] font-medium leading-none text-slate-500">
        {label}
      </span>
    </button>
  );
}
