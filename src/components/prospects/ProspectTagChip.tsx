"use client";

import { X } from "lucide-react";
import { prospectTagTone } from "@/lib/prospects/tagAppearance";

type Props = {
  tag: string;
  size?: "card" | "editor";
  onClick?: () => void;
  onRemove?: () => void;
  removeOnHover?: boolean;
  disabled?: boolean;
  title?: string;
};

export function ProspectTagChip({
  tag,
  size = "card",
  onClick,
  onRemove,
  removeOnHover = false,
  disabled = false,
  title,
}: Props) {
  const tone = prospectTagTone(tag);
  const compact = size === "card";
  const className = `group/chip inline-flex max-w-full items-center gap-0.5 truncate rounded-full ring-1 ring-inset ${tone.chip} ${
    compact
      ? "px-1.5 py-0.5 text-[10px] font-medium"
      : "px-2 py-0.5 text-[12px] font-medium"
  } ${onClick ? `${tone.hover} ${disabled ? "opacity-50" : ""}` : ""}`;

  const label = (
    <span className="truncate">{tag}</span>
  );

  const removeButton = onRemove ? (
    <button
      type="button"
      aria-label={`Remove ${tag}`}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className={`inline-flex rounded-full p-0.5 disabled:opacity-50 ${tone.remove} ${
        removeOnHover
          ? "[@media(hover:hover)_and_(pointer:fine)]:hidden [@media(hover:hover)_and_(pointer:fine)]:group-hover/chip:inline-flex [@media(hover:hover)_and_(pointer:fine)]:group-focus-within/chip:inline-flex"
          : ""
      }`}
    >
      <X className="h-3 w-3" strokeWidth={2} aria-hidden />
    </button>
  ) : null;

  if (onClick) {
    return (
      <button
        type="button"
        title={title ?? tag}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className={className}
      >
        {label}
      </button>
    );
  }

  return (
    <span className={className} title={title ?? tag}>
      {label}
      {removeButton}
    </span>
  );
}
