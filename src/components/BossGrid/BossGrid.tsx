"use client";

import { useRouter } from "next/navigation";
import { LEVELS, PLAYBOOKS } from "@/lib/bossData";
import {
  computePillarScores,
  type AnswersMap,
  type PillarScores,
} from "@/lib/bossScores";
import { SpeedDials } from "./SpeedDials";

export type BossGridProps = {
  answers: AnswersMap;
  showDials?: boolean;
  showHeaders?: boolean;
  interactive?: boolean;
  onScoreChange?: (ref: string, score: 0 | 1 | 2) => void;
  /** When set, cells link to playbook detail (e.g. /client/playbooks or /coach/contacts/123/playbooks) */
  playbookLinkBase?: string;
};

const AREA_NAMES = [
  "Owner Performance",
  "Aligned Vision",
  "Defined Strategy",
  "Disciplined Planning",
  "Profit & Cash Flow",
  "Revenue & Marketing",
  "Operations & Delivery",
  "Financials & Metrics",
  "Infrastructure & Systems",
  "Team & Leadership",
];

function getScoreClass(score: 0 | 1 | 2 | undefined): string {
  if (score === 0) return "bg-[#f4c7c3] text-[#434343]";
  if (score === 1) return "bg-[#fce8b2] text-[#434343]";
  if (score === 2) return "bg-[#b7e1cd] text-[#434343]";
  return "bg-[#efefef] text-[#999999]";
}

function getLevelBgClass(levelId: number): string {
  const map: Record<number, string> = {
    1: "bg-[#edb4ba]",
    2: "bg-[#f2d2b8]",
    3: "bg-[#f7e5b5]",
    4: "bg-[#badfae]",
    5: "bg-[#b5d0ed]",
  };
  return map[levelId] ?? "bg-slate-200";
}

export function BossGrid({
  answers,
  showDials = true,
  showHeaders = true,
  interactive = false,
  onScoreChange,
  playbookLinkBase,
}: BossGridProps) {
  const router = useRouter();
  const pillarScores = computePillarScores(answers);

  return (
    <div className="flex flex-col w-full min-w-[900px]">
      {showDials && <SpeedDials pillarScores={pillarScores} />}
      <div
        className="grid w-full text-[0.8rem] min-w-[900px]"
        style={{
          gridTemplateColumns: "56px 94px repeat(10, minmax(0, 1fr))",
          gridTemplateRows: "auto auto repeat(5, 52px)",
        }}
        role="grid"
        aria-label="BOSS playbook grid"
      >
        {showHeaders && (
          <>
            {/* Row 1: corner, corner, pillar headers */}
            <div className="flex flex-col justify-center items-center p-2 min-w-0 bg-[#f1f5f9]" />
            <div className="flex flex-col justify-center items-center p-2 min-w-0 bg-[#f1f5f9]" />
            <div className="flex flex-col justify-center items-center p-3 font-bold leading-tight text-white bg-[#a21caf]">
              Foundation
            </div>
            <div
              className="flex flex-col justify-center items-center p-3 font-bold leading-tight text-white bg-[#0c5290] border-l-[3px] border-[#6d737a] col-span-3"
              style={{ gridColumn: "span 3" }}
            >
              Clarify Vision
            </div>
            <div
              className="flex flex-col justify-center items-center p-3 font-bold leading-tight text-white bg-[#42a1ee] border-l-[3px] border-[#6d737a] col-span-3"
              style={{ gridColumn: "span 3" }}
            >
              Control Velocity
            </div>
            <div
              className="flex flex-col justify-center items-center p-3 font-bold leading-tight text-white bg-[#1ca0c2] border-l-[3px] border-[#6d737a] col-span-3"
              style={{ gridColumn: "span 3" }}
            >
              Create Value
            </div>
            {/* Row 2: level header + area names */}
            <div
              className="col-span-2 flex flex-col justify-center bg-[#363d47] text-white font-bold text-left pl-6"
              style={{ gridColumn: "span 2" }}
            >
              Business Owner Level
            </div>
            {AREA_NAMES.map((name, i) => (
              <div
                key={name}
                className={`flex flex-col justify-center items-center p-2 font-semibold text-[0.9rem] text-white ${
                  i === 1 || i === 4 || i === 7 ? "border-l-[3px] border-[#6d737a]" : ""
                } ${
                  i === 0 ? "bg-[#a21caf]" :
                  i >= 1 && i <= 3 ? "bg-[#0c5290]" :
                  i >= 4 && i <= 6 ? "bg-[#42a1ee]" :
                  "bg-[#1ca0c2]"
                }`}
              >
                {name}
              </div>
            ))}
          </>
        )}
        {/* Data rows: level number, level name, 10 playbook cells each */}
        {LEVELS.map((level) => (
          <LevelRow
            key={level.id}
            level={level}
            answers={answers}
            interactive={interactive}
            onScoreChange={onScoreChange}
            playbookLinkBase={playbookLinkBase}
            onPlaybookClick={
              playbookLinkBase
                ? (ref) => router.push(`${playbookLinkBase}/${ref}`)
                : undefined
            }
            getScoreClass={getScoreClass}
            getLevelBgClass={getLevelBgClass}
            isFirstDataRow={LEVELS[0].id === level.id}
          />
        ))}
      </div>
    </div>
  );
}

function LevelRow({
  level,
  answers,
  interactive,
  onScoreChange,
  playbookLinkBase,
  onPlaybookClick,
  getScoreClass,
  getLevelBgClass,
  isFirstDataRow,
}: {
  level: { id: number; name: string };
  answers: AnswersMap;
  interactive: boolean;
  onScoreChange?: (ref: string, score: 0 | 1 | 2) => void;
  playbookLinkBase?: string;
  onPlaybookClick?: (ref: string) => void;
  getScoreClass: (s: 0 | 1 | 2 | undefined) => string;
  getLevelBgClass: (id: number) => string;
  isFirstDataRow: boolean;
}) {
  return (
    <>
      <div
        className={`flex flex-col justify-center items-center font-bold text-[1.25rem] text-slate-800 ${getLevelBgClass(level.id)}`}
      >
        {level.id}
      </div>
      <div className="flex flex-col justify-center items-start pl-5 bg-[#363d47] text-white font-medium text-left">
        {level.name}
      </div>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((area) => {
        const playbook = PLAYBOOKS.find(
          (p) => p.level === level.id && p.area === area
        );
        if (!playbook) return null;
        const score = answers[playbook.ref] as 0 | 1 | 2 | undefined;
        const pillarStart = area === 1 || area === 4 || area === 7;

        const handleClick = () => {
          if (interactive && onScoreChange) {
            const next = ((score ?? 0) + 1) % 3 as 0 | 1 | 2;
            onScoreChange(playbook.ref, next);
          } else if (onPlaybookClick) {
            onPlaybookClick(playbook.ref);
          }
        };

        const handleContextMenu = onPlaybookClick
          ? (e: React.MouseEvent) => {
              e.preventDefault();
              onPlaybookClick(playbook.ref);
            }
          : undefined;

        const isClickable = (interactive && onScoreChange) || onPlaybookClick;

        return (
          <div
            key={playbook.ref}
            className={`flex flex-col justify-center items-center p-2 min-w-0 text-center font-semibold leading-tight ${
              isFirstDataRow ? "" : "border-t border-black/5"
            } ${pillarStart ? "border-l-[3px] border-[#6d737a]" : ""} ${
              isClickable ? "cursor-pointer" : ""
            } ${getScoreClass(score)}`}
            role={interactive && onScoreChange ? "button" : isClickable ? "button" : "gridcell"}
            tabIndex={isClickable ? 0 : undefined}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            onKeyDown={
              interactive && onScoreChange
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      const next = ((score ?? 0) + 1) % 3 as 0 | 1 | 2;
                      onScoreChange(playbook.ref, next);
                    }
                  }
                : onPlaybookClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onPlaybookClick(playbook.ref);
                      }
                    }
                  : undefined
            }
            aria-label={
              interactive && onScoreChange
                ? `${playbook.name}: ${score === 0 ? "Not in place" : score === 1 ? "Partially in place" : score === 2 ? "Fully in place" : "Not scored"}. Click to cycle. Right-click to open playbook.`
                : onPlaybookClick
                  ? `${playbook.name}. Click to open playbook.`
                  : undefined
            }
          >
            <span className="block">{playbook.name.replace(/ & /g, " &\n")}</span>
          </div>
        );
      })}
    </>
  );
}
