import type { StoredInsights } from "@/lib/insightGenerator";

/** Seeded coaching copy for admin / preview report routes (no API). */
export function buildPreviewInsights(): StoredInsights {
  return {
    overallShort: {
      title: "You have momentum",
      body:
        "You have built more than most owners ever do, and now your bottleneck is consistency in the commercial engine. Focus on pricing discipline and lead generation rhythm first, then the rest of the system gets easier.",
    },
    overallLong: {
      title: "What this report means",
      body:
        "Your business has real foundations, which is why growth is now possible.\n\nThe biggest drag is not effort, it is inconsistency in the parts that create predictable cash.\n\nIf you lock in one reliable lead source and tighten your offer-to-price fit, your time pressure drops and decisions become easier.\n\nTreat this phase as system building, not hustle.",
    },
    levelsDefault: {
      title: "Level pattern",
      body:
        "Your lower levels are mostly in place, and your current frontier is moving from operator to system owner. That is the right progression.",
    },
    pillarsDefault: {
      title: "Pillar pattern",
      body:
        "Your biggest upside sits in Control Velocity. A stronger revenue and delivery rhythm will create space to improve higher-level value systems.",
    },
    areasDefault: {
      title: "Area pattern",
      body:
        "You are strongest where execution is close to you, and weaker where delegation and process clarity are required. That is normal at this stage.",
    },
    levels: Object.fromEntries(
      [0, 1, 2, 3, 4].map((idx) => [
        String(idx),
        {
          title: `Level ${idx + 1} coaching`,
          body:
            idx === 0
              ? "Locking in basics here removes daily friction everywhere else."
              : idx === 1
                ? "This is where you reclaim time by replacing heroics with repeatable systems."
                : idx === 2
                  ? "You are shifting from doing to building. Keep structure simple and consistent."
                  : idx === 3
                    ? "Leadership quality becomes the multiplier now. Build management cadence."
                    : "This is the long-game layer. Build it steadily after lower-level consistency.",
        },
      ])
    ),
    pillars: {
      foundation: {
        title: "Owner Performance",
        body: "Protect your focus and energy first. If you are scattered, the business follows.",
      },
      vision: {
        title: "Clarify Vision",
        body:
          "Direction is mostly clear. The next lift is translating strategy into decisions your team can make without you.",
      },
      velocity: {
        title: "Control Velocity",
        body:
          "This is your biggest lever. Improve lead flow and pricing confidence to create immediate breathing room.",
      },
      value: {
        title: "Create Value",
        body:
          "You are building longer-term value now. Focus on better reporting and stronger systems so growth does not depend on memory.",
      },
    },
    areas: Object.fromEntries(
      Array.from({ length: 10 }, (_, idx) => [
        String(idx),
        {
          title: `Area ${idx + 1} insight`,
          body:
            "You have partial progress here. Tighten one core playbook in this area and you will feel a noticeable operational shift within weeks.",
        },
      ])
    ),
  };
}
