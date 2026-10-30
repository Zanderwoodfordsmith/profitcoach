"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

/** Menu button for widths where the nav links are hidden (below 1100px). */
export function NavMenu({
  links,
  active,
}: {
  links: readonly { href: string; label: string; key: string }[];
  active: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="v5-menu">
      <button
        type="button"
        className="v5-menu-btn"
        aria-expanded={open}
        aria-controls="v5-menu-panel"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X aria-hidden /> : <Menu aria-hidden />}
      </button>
      {open && (
        <nav id="v5-menu-panel" className="v5-menu-panel" aria-label="Main">
          {links.map((n) => (
            <Link
              key={n.key}
              href={n.href}
              aria-current={active === n.key ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
