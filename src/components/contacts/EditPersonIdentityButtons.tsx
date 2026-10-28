"use client";

import type { ReactNode } from "react";
import { Camera, Pencil } from "lucide-react";
import { badgeClass } from "@/components/ui/Badge";

export function EditPersonNameButton({
  name,
  onClick,
  nameClassName,
}: {
  name: string;
  onClick: () => void;
  nameClassName: string;
}) {
  const needsName = !name.trim() || name.includes("@");
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-0 max-w-full items-center gap-1.5 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      aria-label={
        needsName
          ? `Add a name for ${name || "this person"}`
          : `Edit name for ${name}`
      }
    >
      <span className={`min-w-0 truncate group-hover:text-sky-800 ${nameClassName}`}>
        {name || "Add name"}
      </span>
      {needsName ? (
        <span className={badgeClass("blue", "shrink-0")}>
          Add name
        </span>
      ) : (
        <Pencil
          className="h-3.5 w-3.5 shrink-0 text-slate-400 opacity-70 transition group-hover:text-sky-700 group-hover:opacity-100"
          aria-hidden
        />
      )}
    </button>
  );
}

export function EditPersonPhotoButton({
  children,
  onClick,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
    >
      {children}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-slate-900/45 text-white opacity-0 transition group-hover:opacity-100">
        <Camera className="h-3.5 w-3.5" aria-hidden />
      </span>
    </button>
  );
}
