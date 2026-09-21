"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  Copy,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { CampaignChannelPills } from "@/components/campaigns/CampaignChannelPills";
import { CampaignLibraryCreateDialog } from "@/components/admin/campaignLibrary/CampaignLibraryCreateDialog";
import { campaignLibraryAuthHeaders } from "@/lib/campaignLibrary/authHeaders";
import {
  CAMPAIGN_LIBRARY_KIND_LABEL,
  CAMPAIGN_LIBRARY_KINDS,
  CAMPAIGN_LIBRARY_TYPE_LABEL,
  libraryItemEditorHref,
  type CampaignLibraryItemSummary,
  type CampaignLibraryItemType,
  type CampaignLibraryKind,
} from "@/lib/campaignLibrary/types";
import { useRouter } from "next/navigation";

function formatUpdated(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function RowMenu({
  open,
  onOpenChange,
  onEdit,
  onDuplicate,
  onDelete,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null
  );
  const menuWidth = 176;

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    function updatePosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuHeight = menuRef.current?.offsetHeight ?? 140;
      const gap = 4;
      const openUp = rect.bottom + gap + menuHeight > window.innerHeight - 8;
      const top = openUp
        ? Math.max(8, rect.top - menuHeight - gap)
        : rect.bottom + gap;
      const left = Math.min(
        window.innerWidth - menuWidth - 8,
        Math.max(8, rect.right - menuWidth)
      );
      setPosition({ top, left });
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      onOpenChange(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open, onOpenChange]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={busy}
        onClick={() => onOpenChange(!open)}
        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
        <span className="sr-only">Actions</span>
      </button>
      {open && position ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          style={{ top: position.top, left: position.left, width: menuWidth }}
          className="fixed z-[80] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onOpenChange(false);
              onEdit();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <Pencil className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onOpenChange(false);
              onDuplicate();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <Copy className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            Duplicate
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onOpenChange(false);
              onDelete();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function CampaignLibraryList({
  itemType,
}: {
  itemType: CampaignLibraryItemType;
}) {
  const router = useRouter();
  const [items, setItems] = useState<CampaignLibraryItemSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<CampaignLibraryKind | "all">(
    "all"
  );
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createKind, setCreateKind] = useState<CampaignLibraryKind>("connector");

  const load = useCallback(async () => {
    const headers = await campaignLibraryAuthHeaders();
    if (!headers) throw new Error("Sign in required.");
    const params = new URLSearchParams({ type: itemType });
    if (kindFilter !== "all") params.set("kind", kindFilter);
    const res = await fetch(`/api/admin/campaign-library?${params}`, {
      headers,
    });
    const body = (await res.json()) as {
      error?: string;
      items?: CampaignLibraryItemSummary[];
    };
    if (!res.ok) throw new Error(body.error || "Failed to load.");
    setItems(body.items ?? []);
  }, [itemType, kindFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void load()
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const noun = CAMPAIGN_LIBRARY_TYPE_LABEL[itemType].toLowerCase();

  async function createItem() {
    setBusy(true);
    setError(null);
    try {
      const headers = await campaignLibraryAuthHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch("/api/admin/campaign-library", {
        method: "POST",
        headers,
        body: JSON.stringify({
          item_type: itemType,
          name: createName,
          kind: createKind,
        }),
      });
      const body = (await res.json()) as {
        error?: string;
        item?: CampaignLibraryItemSummary;
      };
      if (!res.ok || !body.item) {
        throw new Error(body.error || "Could not create.");
      }
      setCreateOpen(false);
      setCreateName("");
      router.push(libraryItemEditorHref(body.item));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create.");
    } finally {
      setBusy(false);
    }
  }

  async function duplicateItem(item: CampaignLibraryItemSummary) {
    setBusy(true);
    setError(null);
    try {
      const headers = await campaignLibraryAuthHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch(
        `/api/admin/campaign-library/${encodeURIComponent(item.id)}/duplicate`,
        { method: "POST", headers }
      );
      const body = (await res.json()) as {
        error?: string;
        item?: CampaignLibraryItemSummary;
      };
      if (!res.ok || !body.item) {
        throw new Error(body.error || "Could not duplicate.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not duplicate.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteItem(item: CampaignLibraryItemSummary) {
    if (
      !window.confirm(
        `Delete “${item.name}”? This cannot be undone.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const headers = await campaignLibraryAuthHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch(
        `/api/admin/campaign-library/${encodeURIComponent(item.id)}`,
        { method: "DELETE", headers }
      );
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Could not delete.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Filter by kind"
        >
          <button
            type="button"
            onClick={() => setKindFilter("all")}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              kindFilter === "all"
                ? "bg-[#0c5290] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All
          </button>
          {CAMPAIGN_LIBRARY_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setKindFilter(kind)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                kindFilter === kind
                  ? "bg-[#0c5290] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {CAMPAIGN_LIBRARY_KIND_LABEL[kind]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0c5290] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0a4578]"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add {noun}
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">
                {CAMPAIGN_LIBRARY_TYPE_LABEL[itemType]}
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Kind
              </th>
              <th scope="col" className="w-[5rem] px-3 py-3 text-center font-semibold">
                Via
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Steps
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Updated
              </th>
              <th scope="col" className="w-12 px-3 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center">
                  <p className="text-sm font-medium text-slate-800">
                    No {noun}s yet
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Add one to start building in the campaign editor.
                  </p>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer border-t border-slate-100 hover:bg-slate-50/70"
                  onClick={() => router.push(libraryItemEditorHref(item))}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        {item.name}
                      </span>
                      {item.status === "published" ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          Ready
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                          Draft
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {CAMPAIGN_LIBRARY_KIND_LABEL[item.kind]}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <CampaignChannelPills
                      stepTypes={item.step_types}
                      variant="stack"
                      className="justify-center"
                    />
                  </td>
                  <td className="px-3 py-3 tabular-nums text-slate-600">
                    {item.step_count}
                  </td>
                  <td className="px-3 py-3 text-slate-500">
                    {formatUpdated(item.updated_at)}
                  </td>
                  <td
                    className="px-3 py-3"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <RowMenu
                      open={menuOpenId === item.id}
                      onOpenChange={(next) =>
                        setMenuOpenId(next ? item.id : null)
                      }
                      onEdit={() => router.push(libraryItemEditorHref(item))}
                      onDuplicate={() => void duplicateItem(item)}
                      onDelete={() => void deleteItem(item)}
                      busy={busy}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CampaignLibraryCreateDialog
        open={createOpen}
        itemType={itemType}
        name={createName}
        kind={createKind}
        busy={busy}
        onClose={() => setCreateOpen(false)}
        onNameChange={setCreateName}
        onKindChange={setCreateKind}
        onSubmit={() => void createItem()}
      />
    </div>
  );
}
