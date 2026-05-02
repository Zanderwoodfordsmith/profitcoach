"use client";

import { useState } from "react";
import styles from "./ladder.module.css";

const ICON_BRONZE = "\u25C8";
const ICON_METAL = "\u2B31";
const ICON_GEM = "\u25C6";
const ICON_DIAMOND = "\u25C7";

export default function LadderPage() {
  const [showClients, setShowClients] = useState(false);

  return (
    <div
      className={`${styles.root} ${showClients ? styles.showClients : ""}`}
    >
      <div className={styles.container}>
        <h1 className={styles.title}>The BCA Ladder</h1>
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

        <div className={`${styles.phase} ${styles.onramp}`}>
          <div className={styles.phaseHeader}>
            <span className={styles.phaseName}>Bronze Onramp</span>
            <div className={styles.phaseLine} />
          </div>

          <div className={`${styles.level} ${styles.bronzeI}`}>
            <div className={styles.levelIcon}>{ICON_BRONZE}</div>
            <div className={styles.levelName}>Bronze I</div>
            <div className={styles.levelAmount}>1st client</div>
          </div>

          <div className={`${styles.level} ${styles.bronzeIi}`}>
            <div className={styles.levelIcon}>{ICON_BRONZE}</div>
            <div className={styles.levelName}>Bronze II</div>
            <div className={styles.levelAmount}>2nd client</div>
          </div>

          <div className={`${styles.level} ${styles.bronzeIii}`}>
            <div className={styles.levelIcon}>{ICON_BRONZE}</div>
            <div className={styles.levelName}>Bronze III</div>
            <div className={styles.levelAmount}>3rd client</div>
          </div>
        </div>

        <div className={`${styles.phase} ${styles.metals}`}>
          <div className={styles.phaseHeader}>
            <span className={styles.phaseName}>Promotion</span>
            <div className={styles.phaseLine} />
            <span className={styles.phaseJump}>5K JUMPS</span>
          </div>

          <div className={`${styles.level} ${styles.silver}`}>
            <div className={styles.levelIcon}>{ICON_METAL}</div>
            <div className={styles.levelName}>Silver</div>
            <div className={styles.levelAmount}>5–10K/mo</div>
            <div className={styles.levelClients}>3–5 clients</div>
          </div>

          <div className={`${styles.level} ${styles.gold}`}>
            <div className={styles.levelIcon}>{ICON_METAL}</div>
            <div className={styles.levelName}>Gold</div>
            <div className={styles.levelAmount}>10–15K/mo</div>
            <div className={styles.levelClients}>5–8 clients</div>
          </div>

          <div className={`${styles.level} ${styles.platinum}`}>
            <div className={styles.levelIcon}>{ICON_METAL}</div>
            <div className={styles.levelName}>Platinum</div>
            <div className={styles.levelAmount}>15–20K/mo</div>
            <div className={styles.levelClients}>8–10 clients</div>
          </div>
        </div>

        <div className={`${styles.phase} ${styles.gemstones}`}>
          <div className={styles.phaseHeader}>
            <span className={styles.phaseName}>Proof</span>
            <div className={styles.phaseLine} />
            <span className={styles.phaseJump}>10K JUMPS</span>
          </div>

          <div className={`${styles.level} ${styles.emerald}`}>
            <div className={styles.levelIcon}>{ICON_GEM}</div>
            <div className={styles.levelName}>Emerald</div>
            <div className={styles.levelAmount}>20–30K/mo</div>
            <div className={styles.levelClients}>10–15 clients</div>
          </div>

          <div className={`${styles.level} ${styles.ruby}`}>
            <div className={styles.levelIcon}>{ICON_GEM}</div>
            <div className={styles.levelName}>Ruby</div>
            <div className={styles.levelAmount}>30–40K/mo</div>
            <div className={styles.levelClients}>15–20 clients</div>
          </div>

          <div className={`${styles.level} ${styles.sapphire}`}>
            <div className={styles.levelIcon}>{ICON_GEM}</div>
            <div className={styles.levelName}>Sapphire</div>
            <div className={styles.levelAmount}>40–50K/mo</div>
            <div className={styles.levelClients}>20–25 clients</div>
          </div>
        </div>

        <div className={`${styles.phase} ${styles.diamonds}`}>
          <div className={styles.phaseHeader}>
            <span className={styles.phaseName}>Prestige</span>
            <div className={styles.phaseLine} />
            <span className={styles.phaseJump}>25K JUMPS</span>
          </div>

          <div className={`${styles.level} ${styles.diamond}`}>
            <div className={styles.levelIcon}>{ICON_DIAMOND}</div>
            <div className={styles.levelName}>Diamond</div>
            <div className={styles.levelAmount}>50–75K/mo</div>
            <div className={styles.levelClients}>25–38 clients</div>
          </div>

          <div className={`${styles.level} ${styles.blueDiamond}`}>
            <div className={styles.levelIcon}>{ICON_DIAMOND}</div>
            <div className={styles.levelName}>Blue Diamond</div>
            <div className={styles.levelAmount}>75–100K/mo</div>
            <div className={styles.levelClients}>38–50 clients</div>
          </div>

          <div className={`${styles.level} ${styles.blackDiamond}`}>
            <div className={styles.levelIcon}>{ICON_DIAMOND}</div>
            <div className={styles.levelName}>Black Diamond</div>
            <div className={styles.levelAmount}>100K+/mo</div>
            <div className={styles.levelClients}>50+ clients</div>
          </div>
        </div>

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
