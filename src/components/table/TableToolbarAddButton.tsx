"use client";

import { Plus } from "lucide-react";
import { TableToolbarButton } from "@/components/table/TableToolbarButton";

type Props = {
  onClick: () => void;
  active?: boolean;
  label?: string;
  disabled?: boolean;
};

export function TableToolbarAddButton({
  onClick,
  active = false,
  label = "Add",
  disabled = false,
}: Props) {
  return (
    <TableToolbarButton
      label={label}
      active={active}
      disabled={disabled}
      onClick={onClick}
      icon={<Plus className="h-5 w-5 text-slate-500" aria-hidden />}
    />
  );
}
