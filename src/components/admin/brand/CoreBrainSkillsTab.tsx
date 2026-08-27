"use client";

import { useEffect, useMemo, useState } from "react";

import { AdminCoachAiPromptEditor } from "@/components/admin/AdminCoachAiPromptEditor";
import { AdminLinkedInOptimizerPromptEditor } from "@/components/admin/AdminLinkedInOptimizerPromptEditor";
import { BrainExpandableItem } from "@/components/admin/brand/BrainExpandableItem";
import {
  getOutputById,
  PROFIT_COACH_OUTPUTS,
  PROFIT_COACH_ROLES,
} from "@/lib/profitCoachAi/registry";
import type { ProfitCoachOutputDefinition } from "@/lib/profitCoachAi/types";
import { STUDIO_HUB_CARDS, type StudioHubCard } from "@/lib/profitCoachAi/studioHub";

export type ProgrammeSection = {
  id: string;
  title: string;
  subtitle: string;
  step?: number;
  card?: StudioHubCard;
  skillIds: string[];
  group: "programme" | "extra" | "other";
};

function skillIdsForCard(card: StudioHubCard): string[] {
  if (card.relatedSkillIds?.length) return card.relatedSkillIds;
  if (card.outputId) return [card.outputId];
  return [];
}

export function buildProgrammeSections(): {
  programme: ProgrammeSection[];
  extra: ProgrammeSection[];
  other: ProgrammeSection[];
} {
  const covered = new Set<string>();
  const programme: ProgrammeSection[] = STUDIO_HUB_CARDS.map((card, index) => {
    const skillIds = skillIdsForCard(card);
    for (const id of skillIds) covered.add(id);
    return {
      id: `card:${card.id}`,
      title: card.title,
      subtitle: card.description,
      step: index + 1,
      card,
      skillIds,
      group: "programme" as const,
    };
  });

  const extraSkills = PROFIT_COACH_OUTPUTS.filter(
    (s) => s.coachPicker !== false && !covered.has(s.id)
  );
  const extra: ProgrammeSection[] = extraSkills.map((skill) => ({
    id: `skill:${skill.id}`,
    title: skill.label,
    subtitle: skill.description,
    skillIds: [skill.id],
    group: "extra" as const,
  }));

  const otherSkills = PROFIT_COACH_OUTPUTS.filter(
    (s) => s.coachPicker === false
  );
  const other: ProgrammeSection[] = otherSkills.map((skill) => ({
    id: `skill:${skill.id}`,
    title: skill.label,
    subtitle: skill.description,
    skillIds: [skill.id],
    group: "other" as const,
  }));

  return { programme, extra, other };
}

function SkillDetail({ skill }: { skill: ProfitCoachOutputDefinition }) {
  const roles = PROFIT_COACH_ROLES.filter((r) =>
    r.outputIds.includes(skill.id)
  ).map((r) => r.label);

  return (
    <div className="flex flex-col gap-4">
      {skill.promptEditor === "coach-ai" ? (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            System prompt
          </p>
          <div className="mt-2">
            <AdminCoachAiPromptEditor />
          </div>
        </div>
      ) : null}

      {skill.promptEditor === "linkedin-optimizer" ? (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Rewrite voice (LinkedIn Profile Optimizer tool)
          </p>
          <div className="mt-2">
            <AdminLinkedInOptimizerPromptEditor />
          </div>
        </div>
      ) : null}

      {skill.systemInstructions.trim() ? (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            {skill.promptEditor
              ? "Profit Coach AI skill instructions"
              : "System instructions"}
          </p>
          <pre className="mt-1.5 whitespace-pre-wrap rounded-lg bg-white px-3 py-2.5 font-mono text-xs leading-relaxed text-slate-700 ring-1 ring-slate-200">
            {skill.systemInstructions}
          </pre>
        </div>
      ) : null}

      {skill.knowledgeRefs.length > 0 ? (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Knowledge loaded
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {skill.knowledgeRefs.map((ref, i) => (
              <li
                key={i}
                className="rounded-full bg-white px-2 py-0.5 font-mono text-[10px] text-slate-500 ring-1 ring-slate-200"
              >
                {ref.type === "playbook" ? ref.path : ref.file}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {skill.contextHints?.keys?.length ? (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Coach brain keys used
          </p>
          <p className="mt-1 font-mono text-xs text-slate-500">
            {skill.contextHints.keys.join(", ")}
          </p>
        </div>
      ) : null}

      {roles.length ? (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            In roles
          </p>
          <p className="mt-1 text-xs text-slate-500">{roles.join(", ")}</p>
        </div>
      ) : null}
    </div>
  );
}

function CardMeta({ card }: { card: StudioHubCard }) {
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
          Create hub card
        </dt>
        <dd className="mt-0.5 font-mono text-xs text-slate-700">{card.id}</dd>
      </div>
      <div>
        <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
          Eyebrow
        </dt>
        <dd className="mt-0.5 text-xs text-slate-700">{card.eyebrow}</dd>
      </div>
      {card.dedicatedPath ? (
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Opens
          </dt>
          <dd className="mt-0.5 font-mono text-xs text-slate-700">
            {card.dedicatedPath}
          </dd>
        </div>
      ) : null}
      {card.outputId ? (
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            AI workspace skill
          </dt>
          <dd className="mt-0.5 font-mono text-xs text-slate-700">
            {card.outputId}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

function ProgrammeSectionDetail({ section }: { section: ProgrammeSection }) {
  const skills = section.skillIds
    .map((id) => getOutputById(id))
    .filter((s): s is ProfitCoachOutputDefinition => Boolean(s));

  return (
    <div className="flex flex-col gap-6">
      {section.card ? <CardMeta card={section.card} /> : null}

      {skills.length === 0 ? (
        <p className="text-xs text-slate-500">
          No AI skill attached — this is a dedicated tool only.
        </p>
      ) : (
        skills.map((skill, i) => (
          <div
            key={skill.id}
            className={
              i > 0 || section.card
                ? "border-t border-slate-200 pt-5"
                : undefined
            }
          >
            <p className="text-sm font-semibold text-slate-900">
              Skill: {skill.label}
              <span className="ml-2 font-mono text-xs font-normal text-slate-400">
                {skill.id}
              </span>
            </p>
            <div className="mt-3">
              <SkillDetail skill={skill} />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ProgrammeSectionRow({
  section,
  open,
  onToggle,
}: {
  section: ProgrammeSection;
  open: boolean;
  onToggle: () => void;
}) {
  const card = section.card;
  const primarySkill =
    section.skillIds.length === 1
      ? getOutputById(section.skillIds[0]!)
      : undefined;

  return (
    <BrainExpandableItem
      id={section.id}
      open={open}
      onToggle={onToggle}
      title={
        <>
          {section.step != null ? (
            <span className="mr-2 font-mono text-xs font-normal text-slate-400">
              {section.step}.
            </span>
          ) : null}
          {section.title}
        </>
      }
      subtitle={section.subtitle}
      badges={
        <>
          {card ? (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-800">
              Create card
            </span>
          ) : (
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
              Skill only
            </span>
          )}
          {card?.dedicatedPath ? (
            <span className="rounded-full bg-white px-2 py-0.5 font-mono text-[10px] text-slate-600 ring-1 ring-slate-200">
              {card.dedicatedPath}
            </span>
          ) : null}
          {card?.outputId ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-800">
              → {card.outputId}
            </span>
          ) : null}
          {section.skillIds.length > 1 ? (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
              {section.skillIds.length} skills
            </span>
          ) : primarySkill ? (
            <span className="font-mono text-[10px] text-slate-400">
              {primarySkill.id}
            </span>
          ) : null}
          {card?.adminOnly ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
              Admin only
            </span>
          ) : null}
          {primarySkill?.promptEditor ? (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
              DB prompt
            </span>
          ) : null}
        </>
      }
    >
      <ProgrammeSectionDetail section={section} />
    </BrainExpandableItem>
  );
}

function resolveOpenSectionId(
  skillOrCardId: string | null | undefined
): string | null {
  if (!skillOrCardId) return null;
  if (skillOrCardId.startsWith("card:") || skillOrCardId.startsWith("skill:")) {
    return skillOrCardId;
  }
  const byCard = STUDIO_HUB_CARDS.find(
    (c) =>
      c.id === skillOrCardId ||
      c.outputId === skillOrCardId ||
      c.relatedSkillIds?.includes(skillOrCardId)
  );
  if (byCard) return `card:${byCard.id}`;
  if (getOutputById(skillOrCardId)) return `skill:${skillOrCardId}`;
  return null;
}

export function CoreBrainSkillsTab({
  initialOpen,
}: {
  initialOpen?: string | null;
}) {
  const sections = useMemo(() => buildProgrammeSections(), []);
  const [openId, setOpenId] = useState<string | null>(() =>
    resolveOpenSectionId(initialOpen)
  );

  useEffect(() => {
    if (initialOpen) {
      setOpenId(resolveOpenSectionId(initialOpen));
    }
  }, [initialOpen]);

  function renderGroup(
    title: string,
    hint: string,
    items: ProgrammeSection[]
  ) {
    if (items.length === 0) return null;
    return (
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            {title}
          </p>
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
        </div>
        {items.map((section) => (
          <ProgrammeSectionRow
            key={section.id}
            section={section}
            open={openId === section.id}
            onToggle={() =>
              setOpenId(openId === section.id ? null : section.id)
            }
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-slate-500">
        Create hub cards and their AI skills in one place — programme order at
        the top, then skills that don&apos;t have a card yet. Open any row to
        edit prompts or review instructions.
      </p>
      {renderGroup(
        "Create hub (programme order)",
        "What coaches see on Create — each card and the skill(s) behind it.",
        sections.programme
      )}
      {renderGroup(
        "Skills without a Create card",
        "Available in the AI panel skill picker but not a separate Create card.",
        sections.extra
      )}
      {renderGroup(
        "Other product surfaces",
        "Not in the coach Create picker.",
        sections.other
      )}
    </div>
  );
}
