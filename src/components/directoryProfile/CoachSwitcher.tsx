"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type Coach = { slug: string; name: string; listed: boolean };

/** Admin only: jump to any coach's directory page from the bottom bar. */
export function CoachSwitcher({ coaches, current, label }: { coaches: Coach[]; current: string; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? coaches.filter((c) => c.name.toLowerCase().includes(q) || c.slug.includes(q)) : coaches;
  }, [coaches, query]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function go(slug: string) {
    setOpen(false);
    if (slug !== current) router.push(`/directory/${encodeURIComponent(slug)}`);
  }

  return (
    <div className="dp-switch-wrap" ref={box}>
      <button
        type="button"
        className="dp-switcher"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setQuery("");
          setActive(0);
          setOpen(!open);
        }}
      >
        <span className="dp-toolbar__label">{label}</span>
        <ChevronDown aria-hidden />
      </button>
      {open ? (
        <div className="dp-picker">
          <label className="dp-picker__search">
            <Search aria-hidden />
            <input
              autoFocus
              value={query}
              placeholder={`Find a coach (${coaches.length})`}
              aria-label="Find a coach"
              aria-controls="dp-picker-list"
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((i) => Math.min(i + 1, shown.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter" && shown[active]) {
                  go(shown[active].slug);
                } else if (e.key === "Escape") {
                  setOpen(false);
                }
              }}
            />
          </label>
          <ul className="dp-picker__list" id="dp-picker-list" role="listbox" ref={list}>
            {shown.map((c, i) => (
              <li
                key={c.slug}
                role="option"
                data-i={i}
                aria-selected={c.slug === current}
                data-active={i === active}
                onPointerEnter={() => setActive(i)}
                onClick={() => go(c.slug)}
              >
                <span>{c.name}</span>
                {c.slug === current ? <Check aria-hidden /> : !c.listed ? <small>Not listed</small> : null}
              </li>
            ))}
            {!shown.length ? <li className="dp-picker__none">No coach called that</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
