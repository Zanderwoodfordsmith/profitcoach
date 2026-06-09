"use client";

import { Check, Trash2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

type TodoItem = {
  id: string;
  label: string;
  completed: boolean;
};

type Particle = {
  id: string;
  anchorX: number;
  anchorY: number;
  scatterX: number;
  scatterY: number;
  size: number;
  peakOpacity: number;
  color: string;
  durationMs: number;
};


const INITIAL_ITEMS: TodoItem[] = [
  { id: "1", label: "Buy a milk", completed: false },
  { id: "2", label: "Buy a shampoo", completed: false },
  { id: "3", label: "Buy a toothbrush", completed: false },
];

const ACTION_THRESHOLD_PX = 58;
const MAX_REVEAL_PX = 80;
const REVEAL_RESISTANCE = 0.35;
const DISSOLVE_START_PX = 32;
const DISSOLVE_COMPLETE_PX = 78;
const AUTO_FINISH_MS = 520;
const PARTICLE_TAIL_MS = 1400;
const COLLAPSE_MS = 500;
const ICON_DISSOLVE_AT = 0.9;

const PARTICLE_SHADES: [number, number, number][] = [
  [30, 41, 59],
  [45, 55, 72],
  [71, 85, 105],
  [100, 116, 139],
  [130, 145, 165],
  [148, 163, 184],
  [175, 184, 198],
  [200, 208, 218],
];

type DeletePhase = "idle" | "finishing" | "collapse";

function applySwipeOffset(delta: number, maxRight: number): number {
  const distance = Math.abs(delta);
  const direction = delta < 0 ? -1 : 1;
  const max = direction < 0 ? MAX_REVEAL_PX : maxRight;

  if (distance <= ACTION_THRESHOLD_PX) {
    return direction * Math.min(distance, max);
  }

  const overflow = distance - ACTION_THRESHOLD_PX;
  const resisted = ACTION_THRESHOLD_PX + overflow * REVEAL_RESISTANCE;
  return direction * Math.min(resisted, max);
}

function offsetToProgress(offset: number): number {
  if (offset >= -DISSOLVE_START_PX) return 0;
  const travelled = Math.abs(offset) - DISSOLVE_START_PX;
  const range = DISSOLVE_COMPLETE_PX - DISSOLVE_START_PX;
  return Math.min(1, travelled / range);
}

function pseudoRandom(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function pickParticleColor(r1: number, r2: number): string {
  const shade =
    PARTICLE_SHADES[Math.floor(r1 * PARTICLE_SHADES.length) % PARTICLE_SHADES.length];
  const alpha = 0.22 + r2 * 0.62;
  return `rgba(${shade[0]}, ${shade[1]}, ${shade[2]}, ${alpha})`;
}

function buildLabelParticles(text: string, seed: number): Particle[] {
  const count = Math.max(text.replace(/\s/g, "").length * 7, 36);

  return Array.from({ length: count }, (_, dotIndex) => {
    const randomSeed = seed + dotIndex * 31;
    const r1 = pseudoRandom(randomSeed);
    const r2 = pseudoRandom(randomSeed + 1);
    const r3 = pseudoRandom(randomSeed + 2);
    const r4 = pseudoRandom(randomSeed + 3);
    const r5 = pseudoRandom(randomSeed + 4);
    const r6 = pseudoRandom(randomSeed + 5);
    const floatsUp = r6 > 0.93;

    return {
      id: `p-${dotIndex}`,
      anchorX: 4 + r1 * 92,
      anchorY: 28 + r2 * 36,
      scatterX: 6 + r3 * 58,
      scatterY: floatsUp ? -(3 + r4 * 10) : 20 + r4 * 115,
      size: 0.8 + r5 * 3.8,
      peakOpacity: 0.22 + r1 * 0.45,
      color: pickParticleColor(r1, r2),
      durationMs: 1800 + r2 * 1600,
    };
  });
}

function particleStyle(particle: Particle): CSSProperties {
  return {
    left: `${particle.anchorX}%`,
    top: `${particle.anchorY}%`,
    width: particle.size,
    height: particle.size,
    backgroundColor: particle.color,
    animationDelay: `${((100 - particle.anchorX) / 100) * 140}ms`,
    ["--sx" as string]: `${particle.scatterX}px`,
    ["--sy" as string]: `${particle.scatterY}px`,
    ["--mid-x" as string]: `${particle.scatterX * 0.48}px`,
    ["--mid-y" as string]: `${particle.scatterY * 0.45}px`,
    ["--particle-duration" as string]: `${particle.durationMs}ms`,
    ["--particle-peak-opacity" as string]: `${particle.peakOpacity}`,
  };
}

function dissolveMasks(progress: number) {
  const edge = Math.max(0, Math.min(100, (1 - progress) * 100));
  const feather = 16;
  const softEdge = Math.max(0, edge - feather);

  return {
    text: `linear-gradient(to right, black 0%, black ${softEdge}%, transparent ${edge}%)`,
    particles: `linear-gradient(to right, transparent ${softEdge}%, black ${Math.min(100, edge + feather * 0.6)}%, black 100%)`,
  };
}

function HolisticDissolveLabel({
  label,
  progress,
  particles,
  tone,
}: {
  label: string;
  progress: number;
  particles: Particle[];
  tone: "default" | "completed";
}) {
  const textTone = tone === "completed" ? "text-slate-400" : "text-slate-500";
  const masks = dissolveMasks(progress);

  return (
    <span className="relative inline-block w-fit max-w-full overflow-visible pb-14">
      <span className="relative inline-block w-fit">
        <span
          className={`relative z-[1] inline-block whitespace-nowrap text-base line-through ${textTone}`}
          style={{
            maskImage: masks.text,
            WebkitMaskImage: masks.text,
          }}
        >
          {label}
        </span>

        {progress > 0 ? (
          <span
            className="pointer-events-none absolute inset-0 z-[2] overflow-visible"
            style={{
              maskImage: masks.particles,
              WebkitMaskImage: masks.particles,
            }}
          >
            {particles.map((particle) => (
              <span
                key={particle.id}
                className="todo-disintegrate-particle absolute rounded-full"
                style={particleStyle(particle)}
              />
            ))}
          </span>
        ) : null}
      </span>
    </span>
  );
}

function SwipeableTodoRow({
  item,
  onComplete,
  onDelete,
}: {
  item: TodoItem;
  onComplete: () => void;
  onDelete: () => void;
}) {
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [deletePhase, setDeletePhase] = useState<DeletePhase>("idle");
  const [dissolveProgress, setDissolveProgress] = useState(0);
  const [finishProgress, setFinishProgress] = useState<number | null>(null);
  const startXRef = useRef(0);
  const offsetXRef = useRef(0);
  const rowRef = useRef<HTMLDivElement>(null);
  const deletedRef = useRef(false);
  const finishStartRef = useRef<number | null>(null);
  const finishFromRef = useRef(0);

  const labelParticles = useMemo(
    () => buildLabelParticles(item.label, item.label.length * 11),
    [item.label]
  );

  const activeProgress =
    finishProgress !== null ? finishProgress : dissolveProgress;

  const showDissolve = activeProgress > 0 || deletePhase !== "idle";

  const syncDissolveFromOffset = useCallback((offset: number) => {
    setDissolveProgress(offsetToProgress(offset));
  }, []);

  const resetSwipe = useCallback(() => {
    offsetXRef.current = 0;
    setOffsetX(0);
    setDissolveProgress(0);
    setFinishProgress(null);
    finishStartRef.current = null;
    setDeletePhase("idle");
  }, []);

  const beginCollapse = useCallback(() => {
    window.setTimeout(() => {
      setDeletePhase("collapse");
    }, PARTICLE_TAIL_MS);
  }, []);

  const commitDelete = useCallback(
    (currentProgress: number) => {
      setDragging(false);
      setDeletePhase("finishing");
      offsetXRef.current = 0;
      setOffsetX(0);

      if (currentProgress >= 0.97) {
        setDissolveProgress(1);
        setFinishProgress(1);
        beginCollapse();
        return;
      }

      finishFromRef.current = currentProgress;
      finishStartRef.current = performance.now();
      setFinishProgress(currentProgress);
    },
    [beginCollapse]
  );

  const finishDrag = useCallback(
    (finalOffset: number) => {
      setDragging(false);

      if (finalOffset <= -ACTION_THRESHOLD_PX) {
        const progress = offsetToProgress(finalOffset);
        setDissolveProgress(progress);
        commitDelete(progress);
        return;
      }

      if (!item.completed && finalOffset >= ACTION_THRESHOLD_PX) {
        resetSwipe();
        onComplete();
        return;
      }

      resetSwipe();
    },
    [commitDelete, item.completed, onComplete, resetSwipe]
  );

  useEffect(() => {
    if (deletePhase !== "finishing" || finishStartRef.current === null) return;

    let frame = 0;
    const tick = (now: number) => {
      const elapsed = now - (finishStartRef.current ?? now);
      const t = Math.min(1, elapsed / AUTO_FINISH_MS);
      const eased = 1 - (1 - t) ** 2;
      const next = finishFromRef.current + (1 - finishFromRef.current) * eased;
      setFinishProgress(next);
      setDissolveProgress(next);

      if (t < 1) {
        frame = window.requestAnimationFrame(tick);
      } else {
        setFinishProgress(1);
        setDissolveProgress(1);
        beginCollapse();
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [beginCollapse, deletePhase]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (deletePhase !== "idle") return;
    rowRef.current?.setPointerCapture(event.pointerId);
    startXRef.current = event.clientX;
    setDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || deletePhase !== "idle") return;
    const delta = event.clientX - startXRef.current;
    const maxRight = item.completed ? 0 : MAX_REVEAL_PX;
    const nextOffset = applySwipeOffset(delta, maxRight);
    offsetXRef.current = nextOffset;
    setOffsetX(nextOffset);
    syncDissolveFromOffset(nextOffset);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    rowRef.current?.releasePointerCapture(event.pointerId);
    finishDrag(offsetXRef.current);
  };

  const handlePointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    rowRef.current?.releasePointerCapture(event.pointerId);
    finishDrag(offsetXRef.current);
  };

  const handleCollapseEnd = (event: React.TransitionEvent<HTMLDivElement>) => {
    if (deletePhase !== "collapse" || event.propertyName !== "max-height") return;
    if (deletedRef.current) return;
    deletedRef.current = true;
    onDelete();
  };

  return (
    <div
      className={`relative overflow-hidden border-b border-slate-200 transition-[max-height,opacity,border-color] ease-in-out last:border-b-0 ${
        deletePhase === "collapse"
          ? "max-h-0 overflow-hidden border-b-0 opacity-0"
          : showDissolve
            ? "max-h-40 overflow-visible opacity-100"
            : "max-h-24 overflow-hidden opacity-100"
      }`}
      style={{ transitionDuration: `${COLLAPSE_MS}ms` }}
      onTransitionEnd={handleCollapseEnd}
    >
      {!item.completed && offsetX > 0 ? (
        <div
          className="absolute inset-y-0 left-0 flex items-center bg-emerald-500 px-4"
          style={{ width: offsetX }}
          aria-hidden
        >
          <Check className="h-5 w-5 text-white" strokeWidth={2.5} />
        </div>
      ) : null}

      {offsetX < 0 && deletePhase === "idle" ? (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end bg-red-500 px-4"
          style={{ width: Math.abs(offsetX) }}
          aria-hidden
        >
          <Trash2 className="h-5 w-5 text-white" strokeWidth={2.25} />
        </div>
      ) : null}

      <div
        ref={rowRef}
        className={`relative flex touch-none select-none items-center gap-4 bg-white px-4 py-4 ${
          dragging && deletePhase === "idle"
            ? ""
            : "transition-transform duration-200 ease-out"
        }`}
        style={{
          transform:
            deletePhase === "idle" ? `translateX(${offsetX}px)` : undefined,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center transition-opacity duration-500 ${
            item.completed ? "text-slate-400" : "text-slate-900"
          }`}
          style={{
            opacity:
              showDissolve && activeProgress >= ICON_DISSOLVE_AT ? 0 : 1,
          }}
          aria-hidden
        >
          {item.completed ? (
            <Check className="h-4 w-4" strokeWidth={2.5} />
          ) : (
            <span className="text-lg leading-none">—</span>
          )}
        </span>

        {showDissolve ? (
          <HolisticDissolveLabel
            label={item.label}
            progress={activeProgress}
            particles={labelParticles}
            tone={item.completed ? "completed" : "default"}
          />
        ) : (
          <span
            className={`text-base ${
              item.completed
                ? "text-slate-400 line-through"
                : "text-slate-900"
            }`}
          >
            {item.label}
          </span>
        )}
      </div>
    </div>
  );
}

export function SwipeToCompleteTodoList() {
  const [items, setItems] = useState(INITIAL_ITEMS);

  const handleComplete = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: true } : item
      )
    );
  }, []);

  const handleDelete = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleReset = useCallback(() => {
    setItems(INITIAL_ITEMS.map((item) => ({ ...item, completed: false })));
  }, []);

  const isInitialState =
    items.length === INITIAL_ITEMS.length &&
    items.every(
      (item, index) =>
        item.id === INITIAL_ITEMS[index].id && !item.completed
    );

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">
            All items removed.
          </p>
        ) : (
          items.map((item) => (
            <SwipeableTodoRow
              key={item.id}
              item={item}
              onComplete={() => handleComplete(item.id)}
              onDelete={() => handleDelete(item.id)}
            />
          ))
        )}
      </div>

      <p className="mt-4 text-center text-sm text-slate-500">
        Swipe right to complete, swipe left to delete.
      </p>

      {!isInitialState ? (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Reset list
          </button>
        </div>
      ) : null}
    </div>
  );
}
