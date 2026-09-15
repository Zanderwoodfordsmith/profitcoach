"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
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
import { GripVertical, Lock, Plus } from "lucide-react";
import { TabOverflowMenu } from "@/components/table/TabOverflowMenu";
import {
  DEFAULT_PROSPECT_TABLE_VIEW_NAME,
  isDefaultProspectTableViewName,
  isProtectedProspectViewName,
} from "@/lib/prospects/prospectTableViews";

/** Ghost add-tab control — same chrome as Pool, without a filled tab surface. */
export const VIEW_BAR_ADD_TAB_CLASS =
  "inline-flex shrink-0 items-center gap-1 rounded-tl-md rounded-tr-md border-b-[3px] border-transparent px-2 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-200/50 hover:text-slate-700";

type SavedViewTab = {
  id: string;
  name: string;
  canEdit: boolean;
};

type Props = {
  views: SavedViewTab[];
  activeViewId: string | null;
  onSwitchView: (viewId: string) => void;
  onAddView: (name: string) => void;
  onRenameView: (viewId: string, name: string) => void;
  onDeleteView: (viewId: string) => void;
  onReorderViews: (orderedViewIds: string[]) => void;
  /** Extra tabs after saved views (e.g. pool import lists), before + View. */
  afterViews?: ReactNode;
  /** Label for the add-tab control. */
  addViewLabel?: string;
  showAddView?: boolean;
  onDuplicateView?: (viewId: string) => void;
};

function SortableViewTab({
  view,
  active,
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
  canDuplicate,
  onDuplicate,
}: {
  view: SavedViewTab;
  active: boolean;
  renamingViewId: string | null;
  renameValue: string;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  onSwitchView: (viewId: string) => void;
  onStartRename: (view: SavedViewTab) => void;
  onRenameChange: (value: string) => void;
  onSubmitRename: (viewId: string) => void;
  onCancelRename: () => void;
  onDeleteView: (viewId: string) => void;
  canDelete: boolean;
  canRename: boolean;
  canDuplicate?: boolean;
  onDuplicate?: () => void;
}) {
  const isAllView = isDefaultProspectTableViewName(view.name);
  const isProtected = isProtectedProspectViewName(view.name);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: view.id,
    disabled: isProtected,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const tabSurface = active
    ? "border-b-[3px] border-sky-600 bg-sky-100/90 text-sky-800"
    : "border-b-[3px] border-transparent bg-slate-200/90 text-slate-600 hover:bg-slate-300/70 hover:text-slate-800";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex shrink-0 items-stretch"
    >
      {renamingViewId === view.id ? (
        <form
          className={`flex items-center rounded-tl-md rounded-tr-md px-2 py-1.5 ${tabSurface}`}
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
        <div
          className={`group relative flex touch-none items-center rounded-tl-md rounded-tr-md ${tabSurface} ${
            isProtected ? "" : "cursor-grab active:cursor-grabbing"
          }`}
          {...(isProtected ? {} : { ...attributes, ...listeners })}
        >
          {!isProtected ? (
            <span
              className="ml-0.5 rounded p-0.5 text-slate-400"
              aria-hidden
            >
              <GripVertical className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => onSwitchView(view.id)}
            className={`inline-flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium transition-colors ${
              canRename || canDelete || canDuplicate ? "pr-6" : ""
            }`}
            title={
              isAllView
                ? "Built-in list. Everyone in this list."
                : isProtected
                  ? "Built-in list. Cannot be renamed or deleted."
                  : "Drag to reorder. Click to open."
            }
          >
            {isProtected ? (
              <Lock className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
            ) : null}
            <span className="max-w-[12rem] truncate">
              {isAllView ? DEFAULT_PROSPECT_TABLE_VIEW_NAME : view.name}
            </span>
          </button>
          <div
            className="absolute right-0.5 top-1/2 -translate-y-1/2"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <TabOverflowMenu
              label={view.name}
              canRename={canRename}
              canDelete={canDelete}
              canDuplicate={canDuplicate}
              onRename={() => onStartRename(view)}
              onDelete={() => onDeleteView(view.id)}
              onDuplicate={onDuplicate}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function ProspectsTableViewBar({
  views,
  activeViewId,
  onSwitchView,
  onAddView,
  onRenameView,
  onDeleteView,
  onReorderViews,
  afterViews,
  addViewLabel = "View",
  showAddView = true,
  onDuplicateView,
}: Props) {
  const [addingView, setAddingView] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [renamingViewId, setRenamingViewId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const sortableIds = useMemo(() => views.map((view) => view.id), [views]);
  const draggingView = draggingId
    ? views.find((view) => view.id === draggingId) ?? null
    : null;

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
      return;
    }
    onAddView(trimmed);
    setAddingView(false);
    setNewViewName("");
  }

  function submitRename(viewId: string) {
    const trimmed = renameValue.trim();
    if (trimmed) onRenameView(viewId, trimmed);
    setRenamingViewId(null);
    setRenameValue("");
  }

  function commitOrder(nextViews: SavedViewTab[]) {
    onReorderViews(
      nextViews
        .filter((view) => !isDefaultProspectTableViewName(view.name))
        .map((view) => view.id)
    );
  }

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = views.findIndex((view) => view.id === active.id);
    const newIndex = views.findIndex((view) => view.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    if (isProtectedProspectViewName(views[oldIndex]?.name ?? "")) return;

    const allIndex = views.findIndex((view) =>
      isDefaultProspectTableViewName(view.name)
    );
    const lastPinnedIndex = views.reduce((last, view, index) => {
      return isProtectedProspectViewName(view.name) ? index : last;
    }, allIndex);
    if (allIndex === 0 && newIndex === 0) return;
    const minIndex = Math.max(lastPinnedIndex + 1, allIndex === 0 ? 1 : 0);
    const clampedNewIndex = Math.max(newIndex, minIndex);
    if (oldIndex === clampedNewIndex) return;

    commitOrder(arrayMove(views, oldIndex, clampedNewIndex));
  }

  function handleDragCancel() {
    setDraggingId(null);
  }

  return (
    <nav
      className="flex min-w-0 flex-1 items-end gap-0.5 overflow-x-auto pt-1"
      aria-label="Saved prospect views"
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext
          items={sortableIds}
          strategy={horizontalListSortingStrategy}
        >
          {views.map((view) => {
            const active = view.id === activeViewId;
            const isProtected = isProtectedProspectViewName(view.name);
            const canDelete = views.length > 1 && view.canEdit && !isProtected;
            const canRename = view.canEdit && !isProtected;

            return (
              <SortableViewTab
                key={view.id}
                view={view}
                active={active}
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
                canDuplicate={Boolean(onDuplicateView)}
                onDuplicate={
                  onDuplicateView
                    ? () => onDuplicateView(view.id)
                    : undefined
                }
              />
            );
          })}
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {draggingView ? (
            <div className="inline-flex cursor-grabbing items-center gap-1 rounded-tl-md rounded-tr-md border-b-[3px] border-sky-600 bg-sky-100 px-2 py-1.5 text-sm font-medium text-sky-800 shadow-md">
              <GripVertical className="h-3.5 w-3.5 text-sky-500" aria-hidden />
              <span className="max-w-[12rem] truncate">{draggingView.name}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {afterViews}

      {showAddView ? (
        addingView ? (
          <form
            className="flex items-center gap-2 rounded-tl-md rounded-tr-md border-b-[3px] border-transparent px-2 py-1.5"
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
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setAddingView(false);
                  setNewViewName("");
                }
              }}
              placeholder="View name"
              className="w-36 rounded border border-slate-300 bg-white px-2 py-0.5 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              aria-label="New view name"
            />
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
            className={VIEW_BAR_ADD_TAB_CLASS}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {addViewLabel}
          </button>
        )
      ) : null}
    </nav>
  );
}
