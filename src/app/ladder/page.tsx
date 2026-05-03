"use client";

import { useState } from "react";

import styles from "./ladder.module.css";
import {
  iconForKind,
  LADDER_LEVELS,
  LADDER_PHASE_UI,
  type LadderLevelConfig,
} from "@/lib/ladder";

const stylesMap = styles as Record<string, string>;

export default function LadderPage() {
  const [showClients, setShowClients] = useState(false);

  function renderLevel(level: LadderLevelConfig) {
    const levelCls = stylesMap[level.cssLevelClass] ?? "";
    const icon = iconForKind(level.iconKind);

    return (
      <div key={level.id} className={`${styles.level} ${levelCls}`}>
        <div className={styles.levelIcon}>{icon}</div>
        <div className={styles.levelName}>{level.name}</div>
        <div className={styles.levelAmount}>{level.amountText}</div>
        <div className={styles.levelClients}>{level.clientsText}</div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.root} ${showClients ? styles.showClients : ""}`}
    >
      <div className={styles.container}>
        <h1 className={styles.title}>The Profit Coach Ladder</h1>
        <p className={styles.subtitle}>Promotion → Proof → Prestige</p>

        <div className={styles.toggleWrap}>
          <button
            type="button"
            className={`${styles.toggleBtn} ${showClients ? styles.toggleBtnActive : ""}`}
            onClick={() => setShowClients((v) => !v)}
          >
            Show client estimates
          </button>
        </div>

        {LADDER_PHASE_UI.map((phase) => (
          <div
            key={phase.key}
            className={`${styles.phase} ${stylesMap[phase.cssPhaseClass] ?? ""}`}
          >
            <div className={styles.phaseHeader}>
              <span className={styles.phaseName}>{phase.label}</span>
              <div className={styles.phaseLine} />
              {phase.jumpLabel ? (
                <span className={styles.phaseJump}>{phase.jumpLabel}</span>
              ) : null}
            </div>
            {LADDER_LEVELS.filter((l) => l.phase === phase.key).map((level) =>
              renderLevel(level)
            )}
          </div>
        ))}

        <div className={styles.footer}>
          <span className={styles.footerRule}>
            <strong>Cash collected</strong> · not projected
          </span>
          <span className={styles.footerRule}>
            <strong>Hold 3 months</strong> · to earn level
          </span>
          <span className={styles.footerRule}>
            <strong>1 level up</strong> · per cycle
          </span>
        </div>
      </div>
    </div>
  );
}
