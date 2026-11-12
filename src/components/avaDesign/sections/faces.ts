/** Face photos the Ava mock-ups draw with. Her face, picked 11 Nov, is v3a (wide: WIDE.v3, live as /ava/face-wide.webp). */
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
  | "rimFront"
  | "v3a"
  | "v3b"
  | "v3c"
  | "v3aNet"
  | "v3bNet";

/** Each portrait, the room colour its mist fades into, and why it might be her. */
export const FACES: Record<FaceId, { src: string; room: string; dark: boolean; name: string; line: string }> = {
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
  v3a: {
    src: "/ava-design/faces/v3-a.webp",
    room: "#e6edf4",
    dark: false,
    name: "Soft light",
    line: "Natural and striking, after your screenshots: light eyes, soft long hair, blue turtleneck.",
  },
  v3b: {
    src: "/ava-design/faces/v3-b.webp",
    room: "#e8eef5",
    dark: false,
    name: "Window light",
    line: "Head slightly turned, green-hazel eyes, a confident half-smile.",
  },
  v3c: {
    src: "/ava-design/faces/v3-c.webp",
    room: "#e9edf2",
    dark: false,
    name: "Warm and dark-haired",
    line: "Brown eyes, hair loosely back. The warmest of the three.",
  },
  v3aNet: {
    src: "/ava-design/faces/v3-a-net.webp",
    room: "#1f5f9c",
    dark: true,
    name: "Soft light, with her network",
    line: "A few points of light along her cheek, the same dots as her Halo. An honest sign she is AI, kinder than a glass neck.",
  },
  v3bNet: {
    src: "/ava-design/faces/v3-b-net.webp",
    room: "#2a6aa6",
    dark: true,
    name: "Window light, with her network",
    line: "Her network traced along the jaw and cheekbone, fading before her eyes.",
  },
};

export const WIDE = {
  mist: "/ava-design/faces/wide-mist.webp",
  glassNavy: "/ava-design/faces/wide-glass-navy.webp",
  dawn: "/ava-design/faces/wide-dawn.webp",
  navyV2: "/ava-design/faces/v2-wide-navy.webp",
  rimV2: "/ava-design/faces/v2-wide-rim.webp",
  v3: "/ava-design/faces/v3-wide-a.webp",
};

