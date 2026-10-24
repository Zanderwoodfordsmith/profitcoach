"use client";

import { Option, SectionIntro } from "../Option";

export type FaceId =
  | "mist"
  | "dawn"
  | "mesh"
  | "glass"
  | "navy"
  | "rim"
  | "glassNavy"
  | "navyTurn"
  | "navyFront"
  | "navyGlass"
  | "rimTurn"
  | "rimFront";

/** Each portrait, the room colour its mist fades into, and why it might be her. */
export const FACES: Record<
  FaceId,
  { src: string; room: string; dark: boolean; name: string; line: string }
> = {
  mist: {
    src: "/ava-design/faces/mist-1.webp",
    room: "#e3eef8",
    dark: false,
    name: "Morning mist",
    line: "Plain, warm and real. She melts into the pale sky like the simulator faces.",
  },
  dawn: {
    src: "/ava-design/faces/dawn-1.webp",
    room: "#eef3f8",
    dark: false,
    name: "First light",
    line: "The sun comes up behind her. Matches the sunrise screens.",
  },
  mesh: {
    src: "/ava-design/faces/mesh-1.webp",
    room: "#d7e7f5",
    dark: false,
    name: "A hint of made",
    line: "Human until you look closely: a fine mesh at the jaw and neck.",
  },
  glass: {
    src: "/ava-design/faces/glass-1.webp",
    room: "#e8eef4",
    dark: false,
    name: "Ex Machina, light",
    line: "A real face on a glass neck with light inside. The film's idea, kept gentle.",
  },
  navy: {
    src: "/ava-design/faces/navy-1.webp",
    room: "#13283f",
    dark: true,
    name: "Navy mist",
    line: "The Doer look in our navy, cream knit, soft and calm.",
  },
  rim: {
    src: "/ava-design/faces/rim-1.webp",
    room: "#0b2440",
    dark: true,
    name: "Rim light",
    line: "Sky-blue light traces her edge. The most cinematic, a little colder.",
  },
  glassNavy: {
    src: "/ava-design/faces/glass-navy.webp",
    room: "#0c2540",
    dark: true,
    name: "Ex Machina, navy",
    line: "Light runs through glass at her neck. The boldest; the most clearly not human.",
  },
  navyTurn: {
    src: "/ava-design/faces/v2-navy-turn.webp",
    room: "#17304c",
    dark: true,
    name: "Navy mist, turned",
    line: "The Navy mist woman, a touch more striking, head slightly turned, eyes on you.",
  },
  navyFront: {
    src: "/ava-design/faces/v2-navy-front.webp",
    room: "#17304c",
    dark: true,
    name: "Navy mist, front on",
    line: "The same woman facing you straight on. Best for a call.",
  },
  navyGlass: {
    src: "/ava-design/faces/v2-navy-glass.webp",
    room: "#0d1d30",
    dark: true,
    name: "Navy mist, glass neck",
    line: "The film idea on her: a glass neck with light inside. Judge whether it stays.",
  },
  rimTurn: {
    src: "/ava-design/faces/v2-rim-turn.webp",
    room: "#0b2440",
    dark: true,
    name: "Rim light, turned",
    line: "The Rim light woman, softer and warmer, head slightly turned.",
  },
  rimFront: {
    src: "/ava-design/faces/v2-rim-front.webp",
    room: "#0b2440",
    dark: true,
    name: "Rim light, front on",
    line: "The same woman facing you straight on.",
  },
};

export const WIDE = {
  mist: "/ava-design/faces/wide-mist.webp",
  glassNavy: "/ava-design/faces/wide-glass-navy.webp",
  dawn: "/ava-design/faces/wide-dawn.webp",
  navyV2: "/ava-design/faces/v2-wide-navy.webp",
  rimV2: "/ava-design/faces/v2-wide-rim.webp",
};

export function FaceOptions() {
  const order: FaceId[] = [
    "mist",
    "dawn",
    "mesh",
    "glass",
    "navy",
    "rim",
    "glassNavy",
  ];
  const round2: FaceId[] = [
    "navyTurn",
    "navyFront",
    "navyGlass",
    "rimTurn",
    "rimFront",
  ];
  return (
    <div className="flex flex-col gap-12">
      <SectionIntro title="Round two: your two favourites">
        New on 24 Oct. You liked the women in Navy mist and Rim light, a little
        more striking, slightly turned or front on. Each pair is the same woman.
        The glass neck is on the Navy mist woman so you can judge the film idea
        on her.
      </SectionIntro>
      <FaceGrid ids={round2} start={7} />
      <div className="h-px bg-[var(--rule)]" />
      <SectionIntro title="Round one">
        The first round: seven women, so you can choose who Ava is. Each is
        shown the way she would appear: fading into her room, then small beside
        a message. These are different people. Once you pick one, I make the
        rest of her from that face (other angles, a talking version for calls).
      </SectionIntro>
      <FaceGrid ids={order} start={0} />
    </div>
  );
}

function FaceGrid({ ids, start }: { ids: FaceId[]; start: number }) {
  return (
    <div className="grid gap-x-6 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
      {ids.map((id, i) => {
        const f = FACES[id];
        return (
          <Option
            key={id}
            letter={String.fromCharCode(65 + start + i)}
            name={f.name}
            why={f.line}
          >
            <div
              className="relative aspect-[4/5] overflow-hidden rounded-2xl"
              style={{ background: f.room }}
            >
              {/* The photo's own mist does the fading; only its hard bottom edge is feathered into the room. */}
              <div
                className="ad-breathe absolute inset-0 bg-cover bg-top"
                style={{
                  backgroundImage: `url(${f.src})`,
                  WebkitMaskImage:
                    "linear-gradient(180deg,#000 62%,transparent 100%)",
                  maskImage:
                    "linear-gradient(180deg,#000 62%,transparent 100%)",
                }}
              />
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 p-5">
                <span
                  className="h-10 w-10 shrink-0 overflow-hidden rounded-full"
                  style={{
                    boxShadow: f.dark
                      ? "0 0 0 2px rgba(255,255,255,.25)"
                      : "0 0 0 2px #fff",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.src}
                    alt=""
                    className="h-full w-full scale-[1.5] object-cover object-[50%_28%]"
                  />
                </span>
                <span className="leading-tight">
                  <span
                    className="block text-[15px] font-bold"
                    style={{ color: f.dark ? "#fff" : "#0b1b2e" }}
                  >
                    Ava
                  </span>
                  <span
                    className="block text-[12.5px]"
                    style={{
                      color: f.dark ? "rgba(207,230,248,.8)" : "#5a6b80",
                    }}
                  >
                    Your assistant at The Profit Coach
                  </span>
                </span>
              </div>
            </div>
          </Option>
        );
      })}
    </div>
  );
}
