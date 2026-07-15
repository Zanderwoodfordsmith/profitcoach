"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, LayoutList, Lock, Plus, Users, X } from "lucide-react";
import {
  DEFAULT_COACH_TABLE_VIEW_NAME,
  isDefaultCoachTableViewName,
  type CoachTableView,
} from "@/lib/admin/coachTableViews";

type Props = {
  views: CoachTableView[];
  activeViewId: string | null;
  currentUserId: string | null;
  onSwitchView: (viewId: string) => void;
  onAddView: (name: string, isPrivate: boolean) => void;
  onRenameView: (viewId: string, name: string) => void;
  onDeleteView: (viewId: string) => void;
  onReorderViews: (orderedViewIds: string[]) => void;
};

function SortableViewTab({
  view,
  active,
  currentUserId,
  renamingViewId,
  renameValue,
  renameInputRef,
  onSwitchView,
  onStartRename,
  onRenameChange,
  onSubmitRename,
  onCancelRename,
  onDeleteView,
  canDelete,
  canRename,
}: {
  view: CoachTableView;
  active: boolean;
  currentUserId: string | null;
  renamingViewId: string | null;
  renameValue: string;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  onSwitchView: (viewId: string) => void;
  onStartRename: (view: CoachTableView) => void;
  onRenameChange: (value: string) => void;
  onSubmitRename: (viewId: string) => void;
  onCancelRename: () => void;
  onDeleteView: (viewId: string) => void;
  canDelete: boolean;
  canRename: boolean;
}) {
  const isAllView = isDefaultCoachTableViewName(view.name);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: view.id,
    disabled: isAllView,
  });

  const privacyLabel = view.isPrivate
    ? "Private view"
    : "Shared with admins";

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex shrink-0 items-stretch"
    >
      {renamingViewId === view.id ? (
        <form
          className="-mb-px flex items-center border-b-[3px] border-sky-600 pb-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmitRename(view.id);
          }}
        >
          <input
            ref={renameInputRef}
            type="text"
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onBlur={() => onSubmitRename(view.id)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onCancelRename();
            }}
            className="w-32 rounded border border-slate-300 px-2 py-0.5 text-sm font-medium text-slate-800 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            aria-label="Rename view"
          />
        </form>
      ) : (
        <div className="group relative flex items-center">
          {!isAllView ? (
            <button
              type="button"
              className="mr-0.5 cursor-grab rounded p-0.5 text-slate-300 opacity-0 transition hover:bg-slate-100 hover:text-slate-500 group-hover:opacity-100 active:cursor-grabbing"
              aria-label={`Drag to reorder ${view.name}`}
              title="Drag to reorder"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onSwitchView(view.id)}
            onDoubleClick={() => {
              if (!canRename) return;
              onStartRename(view);
            }}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-[3px] px-2 pb-2 text-sm font-medium transition-colors ${
              active
                ? "border-slate-800 text-slate-900"
                : "border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-800"
            }`}
            title={
              isAllView
                ? "Shared with every admin. Saves update All for everyone."
                : canRename
                  ? `${privacyLabel}. Double-click to rename. Drag handle to reorder.`
                  : `${privacyLabel}. Created by another admin. Drag handle to reorder.`
            }
          >
            <LayoutList
              className="h-3.5 w-3.5 shrink-0 opacity-60"
              aria-hidden
            />
            {isAllView ? null : view.isPrivate ? (
              <Lock className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
            ) : (
              <Users className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
            )}
            <span className="max-w-[12rem] truncate">
              {isAllView ? DEFAULT_COACH_TABLE_VIEW_NAME : view.name}
            </span>
            {!isAllView &&
            !view.isPrivate &&
            view.createdBy !== currentUserId ? (
              <span className="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                Shared
              </span>
            ) : null}
          </button>
          {canDelete ? (
            <button
              type="button"
              onClick={() => onDeleteView(view.id)}
              className="absolute -right-1 top-0 rounded p-0.5 text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100"
              aria-label={`Delete view ${view.name}`}
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function CoachesTableViewBar({
  views,
  activeViewId,
  currentUserId,
  onSwitchView,
  onAddView,
  onRenameView,
  onDeleteView,
  onReorderViews,
}: Props) {
  const [addingView, setAddingView] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [newViewPrivate, setNewViewPrivate] = useState(false);
  const [renamingViewId, setRenamingViewId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const sortableIds = useMemo(() => views.map((view) => view.id), [views]);

  useEffect(() => {
    if (addingView) addInputRef.current?.focus();
  }, [addingView]);

  useEffect(() => {
    if (renamingViewId) renameInputRef.current?.focus();
  }, [renamingViewId]);

  function submitNewView() {
    const trimmed = newViewName.trim();
    if (!trimmed) {
      setAddingView(false);
      setNewViewName("");
      setNewViewPrivate(false);
      return;
    }
    onAddView(trimmed, newViewPrivate);
    setAddingView(false);
    setNewViewName("");
    setNewViewPrivate(false);
  }

  function submitRename(viewId: string) {
    const trimmed = renameValue.trim();
    if (trimmed) onRenameView(viewId, trimmed);
    setRenamingViewId(null);
    setRenameValue("");
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = views.findIndex((view) => view.id === active.id);
    const newIndex = views.findIndex((view) => view.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    // Keep All pinned as the first tab.
    const allIndex = views.findIndex((view) =>
      isDefaultCoachTableViewName(view.name)
    );
    if (allIndex === 0 && newIndex === 0) return;
    const clampedNewIndex = allIndex === 0 ? Math.max(newIndex, 1) : newIndex;

    const next = arrayMove(views, oldIndex, clampedNewIndex);
    onReorderViews(next.map((view) => view.id));
  }

  return (
    <nav
      className="flex items-center gap-0 overflow-x-auto border-b border-slate-100 pb-0"
      aria-label="Saved table views"
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortableIds}
          strategy={horizontalListSortingStrategy}
        >
          {views.map((view, index) => {
            const active = view.id === activeViewId;
            const isAllView = isDefaultCoachTableViewName(view.name);
            const canDelete = views.length > 1 && view.canEdit && !isAllView;
            const canRename = view.canEdit && !isAllView;

            return (
              <div key={view.id} className="flex shrink-0 items-stretch">
                {index > 0 ? (
                  <span
                    className="mx-1 w-px self-stretch bg-slate-200"
                    aria-hidden
                  />
                ) : null}
                <SortableViewTab
                  view={view}
                  active={active}
                  currentUserId={currentUserId}
                  renamingViewId={renamingViewId}
                  renameValue={renameValue}
                  renameInputRef={renameInputRef}
                  onSwitchView={onSwitchView}
                  onStartRename={(row) => {
                    setRenamingViewId(row.id);
                    setRenameValue(row.name);
                  }}
                  onRenameChange={setRenameValue}
                  onSubmitRename={submitRename}
                  onCancelRename={() => {
                    setRenamingViewId(null);
                    setRenameValue("");
                  }}
                  onDeleteView={onDeleteView}
                  canDelete={canDelete}
                  canRename={canRename}
                />
              </div>
            );
          })}
        </SortableContext>
      </DndContext>

      <span className="mx-2 w-px self-stretch bg-slate-200" aria-hidden />

      {addingView ? (
        <form
          className="-mb-px flex items-center gap-2 border-b-[3px] border-transparent pb-2"
          onSubmit={(e) => {
            e.preventDefault();
            submitNewView();
          }}
        >
          <input
            ref={addInputRef}
            type="text"
            value={newViewName}
            onChange={(e) => setNewViewName(e.target.value)}
            onBlur={() => {
              if (!newViewName.trim()) {
                setAddingView(false);
                setNewViewName("");
                setNewViewPrivate(false);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setAddingView(false);
                setNewViewName("");
                setNewViewPrivate(false);
              }
            }}
            placeholder="View name"
            className="w-36 rounded border border-slate-300 px-2 py-0.5 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            aria-label="New view name"
          />
          <label className="inline-flex items-center gap-1 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={newViewPrivate}
              onChange={(e) => setNewViewPrivate(e.target.checked)}
              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            Private
          </label>
          <button
            type="submit"
            className="rounded px-2 py-0.5 text-xs font-medium text-sky-700 hover:bg-sky-50"
          >
            Add
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAddingView(true)}
          className="-mb-px inline-flex items-center gap-1 border-b-[3px] border-transparent px-2 pb-2 text-sm font-medium text-slate-500 transition-colors hover:border-slate-200 hover:text-slate-800"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          View
        </button>
      )}
    </nav>
  );
}
