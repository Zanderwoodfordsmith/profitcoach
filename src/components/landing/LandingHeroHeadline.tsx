import {
  getLandingHeroHeadline,
  LANDING_HERO_GRADIENT,
  LANDING_HERO_HEADLINE_TRACKING,
  type LandingHeroHeadlineVariant,
} from "@/lib/landingHeroHeadline";
import { LANDING_OVERRIDE_MAX_LEN } from "@/lib/landingCopy";
import { Editable } from "@/components/directoryProfile/Editable";
import { LANDING_EDIT_FIELD } from "@/components/landing/landingEdit";
import type { LandingCopyEditor } from "@/components/landing/landingEdit";

type LandingHeroHeadlineProps = {
  variant: LandingHeroHeadlineVariant;
  className?: string;
  /** Coach's own wording; each part falls back to the variant's default. */
  lead?: string;
  highlight?: string;
  /** Set while the coach edits their page: both parts become fields. */
  editor?: LandingCopyEditor;
};

export function LandingHeroHeadline({
  variant,
  className = "",
  lead,
  highlight,
  editor,
}: LandingHeroHeadlineProps) {
  const defaults = getLandingHeroHeadline(variant);
  const leadText = lead || defaults.lead;
  const highlightText = highlight || defaults.gradient;
  const h1Class = `text-balance font-light text-white [text-shadow:0_2px_28px_rgba(0,0,0,0.35)] ${LANDING_HERO_HEADLINE_TRACKING} ${className}`;

  if (editor) {
    return (
      <h1 className={h1Class}>
        <Editable
          value={leadText.trim()}
          editing
          onCommit={(v) => editor.save("headlineLead", v)}
          label="Headline"
          placeholder={defaults.lead.trim()}
          maxLength={LANDING_OVERRIDE_MAX_LEN.headlineLead}
          className={LANDING_EDIT_FIELD}
        />
        <Editable
          value={highlightText}
          editing
          onCommit={(v) => editor.save("headlineHighlight", v)}
          label="Headline, coloured part"
          placeholder={defaults.gradient}
          maxLength={LANDING_OVERRIDE_MAX_LEN.headlineHighlight}
          className={`${LANDING_EDIT_FIELD} mt-1 font-semibold text-[#6cd6ff]`}
        />
      </h1>
    );
  }

  return (
    <h1 className={h1Class}>
      {leadText.endsWith(" ") ? leadText : `${leadText} `}
      <span
        className="bg-clip-text font-semibold text-transparent"
        style={{ backgroundImage: LANDING_HERO_GRADIENT }}
      >
        {highlightText}
      </span>
    </h1>
  );
}
